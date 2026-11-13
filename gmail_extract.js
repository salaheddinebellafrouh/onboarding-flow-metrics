// Copyright (c) 2026 Orderful, Inc.
/* global window, location, document, DOMParser, trustedTypes */
// Chrome fallback reader for the onboarding-flow-metrics skill (use when the Gmail connector is not available).
// Inject flow_core.js FIRST, then this file, into a mail.google.com tab with the Claude in Chrome javascript tool.
// Read only: it uses Gmail's own search page and print view. It never sends, labels or archives.
// Everything lives on window.OFM. Long jobs run in the background; poll window.OFM.state.

(() => {
  const W = window;
  if (!W.OFMCore) return { ready: false, error: 'Inject flow_core.js first' };
  const O = (W.OFM = W.OFM || {});
  O.state = O.state || { phase: 'idle', log: [] };
  O.threads = O.threads || {};   // lid -> Set(client)
  O.parsed = O.parsed || {};     // lid -> {lid, subj, msgs:[{name, em, dt, body}]}
  O.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  O.ik = (W.GLOBALS || [])[9];
  O.acct = (location.pathname.match(/\/mail\/u\/(\d+)/) || [])[1] || '0';
  try { O.pol = O.pol || trustedTypes.createPolicy('ofm' + Date.now(), { createHTML: (s) => s }); } catch { O.pol = { createHTML: (s) => s }; }

  // Set by the skill before running: O.cfg = {us:[...], clientDomains:{Client:[...]}, maxWait:30}
  O.cfg = O.cfg || { us: ['.cr@orderful.com', '@yourcompany.com'], clientDomains: {}, maxWait: 30 };
  O.core = () => W.OFMCore(Object.assign({}, O.cfg, { acct: O.acct }));

  O.rows = () => [...document.querySelectorAll('div[role=main] tr.zA')].filter((r) => r.offsetParent).map((r) => ({
    lid: r.querySelector('[data-legacy-thread-id]')?.getAttribute('data-legacy-thread-id'),
    subj: r.querySelector('.bog')?.innerText || '',
  }));

  // Search with paging. Waits until the result list really changed, then waits again for it to settle.
  O.search = async (q, maxPages = 4) => {
    const out = [];
    for (let p = 1; p <= maxPages; p++) {
      const prev = JSON.stringify(O.rows().map((x) => x.lid));
      location.hash = '#search/' + encodeURIComponent(q) + (p > 1 ? '/p' + p : '');
      let ok = false, rows = [];
      for (let i = 0; i < 30; i++) {
        await O.sleep(700);
        rows = O.rows();
        if (rows.length && JSON.stringify(rows.map((x) => x.lid)) !== prev) {
          await O.sleep(1200);
          rows = O.rows();
          ok = true;
          break;
        }
        if (i > 10 && /No messages matched/.test(document.querySelector('div[role=main]')?.innerText || '')) break;
      }
      if (!ok) break;
      out.push(...rows);
      if (rows.length < 50) break;
    }
    return out;
  };

  O.clean = (s) => {
    s = s.replace(/\[Quoted text hidden\]/g, '');
    const m = s.search(/\n\s*(On [^\n]{5,120}wrote:|From:\s[^\n]+\n\s*(Sent|Date):|-{3,}\s*Original Message|_{8,})/i);
    if (m > 0) s = s.slice(0, m);
    return s.replace(/\s+/g, ' ').trim();
  };

  O.parse = async (lid) => {
    const h = await (await fetch(`/mail/u/${O.acct}/?ik=${O.ik}&view=pt&search=all&th=${lid}`)).text();
    const d = new DOMParser().parseFromString(O.pol.createHTML(h), 'text/html');
    const subj = (d.querySelector('.maincontent table tr td font b') || d.querySelector('b'))?.innerText || '';
    const msgs = [...d.querySelectorAll('table.message')].map((t) => {
      const trs = t.querySelectorAll(':scope > tbody > tr');
      const td0 = trs[0]?.querySelectorAll('td');
      const name = td0?.[0]?.querySelector('b')?.innerText.trim() || '';
      const em = ((td0?.[0]?.innerText.match(/<([^>]+)>/) || [])[1] || name).toLowerCase();
      const dt = +new Date((td0?.[1]?.innerText || '').replace(' at ', ' '));
      let b = null;
      for (const tr of trs) { if (tr.querySelector('table')) { b = tr; break; } }
      return { name, em, dt, body: b ? O.clean(b.innerText).slice(0, 400) : '' };
    }).filter((m) => m.dt);
    return { lid, subj, msgs };
  };

  // Background job: search each client query, then read every thread found.
  // queries = {ClientName: 'gmail query', ...}
  O.collect = (queries, pages = 4) => {
    O.state = { phase: 'search', log: [], n: 0, total: 0 };
    const noise = ' -from:no-reply -from:noreply -from:calendar-notification -subject:"Relationship Status Update" -subject:"Transaction Status" -subject:Invitation -subject:Accepted -subject:Canceled -subject:Notes';
    const C = O.core();
    (async () => {
      for (const [client, q] of Object.entries(queries)) {
        try {
          let r = await O.search(q + noise, pages);
          if (!r.length) r = await O.search(q + noise, pages); // first search after load sometimes misses
          // Gmail loosens short phrases ("Acme J"), so keep only TR emails whose subject names this client.
          const key = C.key(client);
          const tr = (await O.search(q + ' subject:"Trade Request Update"', 2)).filter((x) => x.subj.toLowerCase().includes(key));
          [...r, ...tr].forEach((x) => { if (x.lid) (O.threads[x.lid] = O.threads[x.lid] || new Set()).add(client); });
          O.state.log.push(client + ':' + r.length + '+' + tr.length + 'TR');
        } catch (e) { O.state.log.push(client + ':ERR ' + e); }
      }
      O.state.phase = 'parse';
      const ids = Object.keys(O.threads).filter((l) => !O.parsed[l]);
      O.state.total = ids.length;
      let i = 0;
      const worker = async () => {
        while (i < ids.length) {
          const l = ids[i++];
          try { O.parsed[l] = await O.parse(l); } catch { O.state.err = (O.state.err || 0) + 1; }
          O.state.n++;
        }
      };
      await Promise.all([1, 2, 3, 4, 5, 6].map(worker));
      O.state.phase = 'done';
    })();
    return 'started';
  };

  // Build the CSVs with the shared core. Returns row counts and the normal-flow summary.
  O.build = () => {
    const C = O.core();
    const list = Object.values(O.parsed).filter(Boolean).map((p) => Object.assign({ client: [...(O.threads[p.lid] || [])][0] }, p));
    const res = C.build(list);
    O.out = res.csv;
    return { waits: res.waits.length, threads: res.threads.length, summary: C.summary(res.waits) };
  };

  // Read output in chunks (tool results are size-limited): O.chunk('waits', 0, 150)
  O.chunk = (name, from, size = 150) => O.out[name].slice(from, from + size);

  return { ready: !!O.ik, acct: O.acct };
})();
