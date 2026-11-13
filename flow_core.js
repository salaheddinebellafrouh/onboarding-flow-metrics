// Copyright (c) 2026 Orderful, Inc.
/* global window */
// Shared analysis for the onboarding-flow-metrics skill.
// Works in Node (require) and in the browser (window.OFMCore). No message text leaves this file's output:
// the CSVs hold dates, counts, company names, topic tags and Gmail/Slack links only.
//
// Input: threads = [{ client, lid, subj, partner?, source ('email' default | 'slack'), link?, msgs: [{ name, em, dt (ms epoch), body, party? }] }]
// cfg   = { us: ['.cr@orderful.com', '@yourcompany.com'], clientDomains: { Client: ['client.com'] },
//           people: { 'full name': 'US' | 'CLIENT' | 'PARTNER' | 'ORDERFUL' }, maxWait: 30, acct: '0' }
// Slack messages often carry no email, so a message can set `party` itself, or be matched by name in cfg.people.

(function (root) {
  function core(cfg) {
    cfg = Object.assign({ us: ['.cr@orderful.com', '@yourcompany.com'], clientDomains: {}, people: {}, maxWait: 30, acct: '0' }, cfg || {});
    const people = Object.fromEntries(Object.entries(cfg.people).map(([k, v]) => [k.toLowerCase().trim(), v]));
    const C = {};

    C.party = (m, client) => {
      if (m.party) return m.party === 'SKIP' ? null : m.party;
      const e = (m.em || '').toLowerCase();
      if (!e.includes('@')) {
        const byName = people[(m.name || e).toLowerCase().trim()];
        return byName || 'UNKNOWN'; // Slack user with no email and no mapping: add them to cfg.people
      }
      if (cfg.us.some((u) => e.includes(u))) return 'US';
      if (/(google\.com|slack\.com|read\.ai|zoom\.us|calendar|mailer-daemon|zohodesk-noreply)/.test(e)) return null;
      if (/^(The EDI Support Team has received|Thank you for contacting|Your request \d+ has been updated|Hello\s.{0,40}Your ticket has been auto-closed|Out of Office|Automatic reply|I will be out of the office)/i.test(m.body || '')) return null;
      if (/@orderful\.com/.test(e)) return 'ORDERFUL';
      const doms = cfg.clientDomains[client] || [];
      if (doms.some((d) => e.endsWith('@' + d) || e.endsWith('.' + d))) return 'CLIENT';
      return 'PARTNER';
    };

    C.step = (s) =>
      /test|certif|T ?& ?C|uat|validation|sample/i.test(s) ? 'TEST'
        : /information request|trade request|connection|AS2|\bVAN\b|ISA|credential|set ?up|re-engag|contacts|introduction|kick ?off|onboarding/i.test(s) ? 'CONNECT'
        : /go.?live|production|prod |cutover|launch|hypercare/i.test(s) ? 'GOLIVE'
        : /urgent|error|fail|reject|missing|not ackn|864|issue|stuck/i.test(s) ? 'LIVE_ISSUE' : 'GENERAL';

    C.topics = {
      test_data: /fulfil|item fulfillment|test (so|sales order|invoice)|invoice (the|this) so|create .{0,20}(order|invoice)/i,
      test_files: /test (po|order|file|850|856|810|855|846|transaction|invoice|asn)s?|send.{0,20}test|resen[dt]/i,
      edi_ids: /\bISA\b|qualifier|GS ID|EDI ID|sender id|receiver id/i,
      connection: /\bAS2\b|certificate|\bVAN\b|SFTP|\bFTP\b|mailbox|connection details/i,
      mapping: /guideline|spec|mapping|segment|schema/i,
      decision: /decid|decision|confirm (if|whether|how)|which (option|approach)|should we/i,
      labels: /label|SSCC|carton|pallet|\bBOL\b/i,
      ns_ids: /internal id|customer id|ship.?to|store (number|code|id)|location code/i,
      items: /\bUPC|\bSKU|item (number|code|lookup)|catalog|price/i,
      portal: /portal|login|log in|access|activate|credential/i,
      vendor_setup: /vendor (number|#|id)|account number|vendor setup|registration/i,
    };

    // First word of 3+ letters of the client name, used to match subjects.
    C.key = (client) => (client || '').toLowerCase().split(/\s+/).find((w) => w.length >= 3) || (client || '').toLowerCase();

    // Pick the side of "A <> B" that is not the client; "Orderful <> Client" is a general client thread.
    C.otherSide = (a, b, client) => {
      const k = C.key(client), al = a.toLowerCase(), bl = b.toLowerCase();
      if (/orderful/.test(al) && bl.includes(k)) return '(general)';
      if (/orderful/.test(bl) && al.includes(k)) return '(general)';
      return bl.includes(k) && !al.includes(k) ? a : b;
    };

    C.partnerOf = (p, client) => {
      const s = p.subj.replace(/^((re|fw|fwd)\s*:\s*)+/gi, '').replace(/^\W*(\[[^\]]*\]|\(CS-\d+\))\s*/g, '');
      let m = s.match(/\((.+?) to (.+?)\)/);
      if (m && /Trade Request/i.test(s)) return m[2].replace(/\s*\(.*$/, '').trim();
      m = s.match(/Project for \((.+?)\)/i);
      if (m) return m[1].trim();
      m = s.match(/(?:Information Request:\s*)?([^:|]+?)\s*<\s*>\s*(.+?)(\s+ID:|\s*\||\s+-\s|$)/i);
      if (m) return C.otherSide(m[1].replace(/^.*:\s*/, '').trim(), m[2].replace(/\s*\(.*$/, '').trim(), client);
      const c = {};
      p.msgs.forEach((x) => { if (C.party(x, client) === 'PARTNER') { const d = (x.em || '').split('@')[1] || ''; c[d] = (c[d] || 0) + 1; } });
      const top = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
      return top ? top[0] : '(no partner)';
    };

    const iso = (t) => new Date(t).toISOString().slice(0, 10);
    const csv = (v) => { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };

    C.WAIT_COLS = ['client', 'partner', 'thread_id', 'step', 'asked_by', 'waited_on', 'asked_date', 'answered_date', 'days', 'chasers', 'exception', 'topics', 'source', 'slack_msgs_during_wait'];
    C.THREAD_COLS = ['client', 'partner', 'thread_id', 'subject_short', 'step', 'first_date', 'last_date', 'days_open', 'emails', 'our_chasers', 'trade_request', 'mentions_test_sent', 'mentions_live', 'gmail_link', 'source'];

    // Returns { waits: [rowObj], threads: [rowObj], csv: { waits: [lines], threads: [lines] } }
    C.build = (threads) => {
      const waits = [], trows = [];
      for (const p of threads) {
        if (!p || !p.msgs || !p.msgs.length) continue;
        if (/^(automatic reply|out of office|auto.?reply|recall:)/i.test(p.subj)) continue;
        const client = p.client;
        const source = p.source || 'email';
        const partner = p.partner || C.partnerOf(p, client);
        const st = C.step(p.subj);
        const ms = p.msgs.map((m) => Object.assign({}, m, { pt: C.party(m, client) })).filter((m) => m.pt && m.dt).sort((a, b) => a.dt - b.dt);
        const tr = (p.subj.match(/Trade Request Update - (\w+)/) || [])[1] || '';
        let ourChasers = 0, rs = 0;
        for (let i = 1; i <= ms.length; i++) {
          if (i < ms.length && ms[i].pt === 'US' && ms[i - 1].pt === 'US' && (ms[i].dt - ms[i - 1].dt) / 864e5 >= 1) ourChasers++;
          if (i === ms.length || ms[i].pt !== ms[i - 1].pt) {
            const run = ms.slice(rs, i);
            if (i < ms.length) {
              const d = (ms[i].dt - run[0].dt) / 864e5;
              const txt = run.map((m) => m.body || '').join(' ');
              waits.push({
                client, partner, thread_id: p.lid, step: st, asked_by: run[0].pt, waited_on: ms[i].pt,
                asked_date: iso(run[0].dt), answered_date: iso(ms[i].dt), days: +d.toFixed(1),
                chasers: run.filter((m, j) => j > 0 && (m.dt - run[j - 1].dt) / 864e5 >= 1).length,
                exception: d > cfg.maxWait ? 'Y' : '',
                topics: Object.entries(C.topics).filter(([, re]) => re.test(txt)).map(([k]) => k).join('|'),
                source, _from: run[0].dt, _to: ms[i].dt,
              });
            }
            rs = i;
          }
        }
        const all = p.msgs.map((m) => m.body || '').join(' ');
        const dts = p.msgs.map((m) => m.dt).filter(Boolean);
        const first = Math.min(...dts), last = Math.max(...dts);
        trows.push({
          client, partner, thread_id: p.lid, subject_short: p.subj.replace(/^((re|fw|fwd)\s*:\s*)+/gi, '').slice(0, 70), step: st,
          first_date: iso(first), last_date: iso(last), days_open: +((last - first) / 864e5).toFixed(1), emails: p.msgs.length,
          our_chasers: ourChasers, trade_request: tr,
          mentions_test_sent: /(sent|send|resent|uploaded).{0,30}test|test (file|po|850|856|810|order).{0,30}(sent|received)/i.test(all) ? 'Y' : '',
          mentions_live: /(went|is now|are now|now) live|in production|moved to production|go-live (is )?complete|certification (is )?complete|testing (is )?complete/i.test(all) ? 'Y' : '',
          gmail_link: p.link || (source === 'email' ? `https://mail.google.com/mail/u/${cfg.acct}/#all/${p.lid}` : ''),
          source,
        });
      }
      // Slack context: how many Slack messages for the same client fell inside each email wait of 3+ days.
      // A high count means work was moving in Slack, so the email gap was not a real stall.
      const slackTimes = {};
      for (const p of threads) {
        if (!p || p.source !== 'slack') continue;
        for (const m of p.msgs || []) if (m.dt) (slackTimes[p.client] = slackTimes[p.client] || []).push(m.dt);
      }
      const hasSlack = Object.keys(slackTimes).length > 0;
      for (const w of waits) {
        w.slack_msgs_during_wait = hasSlack && w.source === 'email' && w.days >= 3
          ? (slackTimes[w.client] || []).filter((t) => t > w._from && t < w._to).length : '';
        delete w._from; delete w._to;
      }
      const toCsv = (rows, cols) => [cols.join(',')].concat(rows.map((r) => cols.map((c) => csv(r[c])).join(',')));
      return { waits, threads: trows, csv: { waits: toCsv(waits, C.WAIT_COLS), threads: toCsv(trows, C.THREAD_COLS) } };
    };

    // Normal-flow summary (exceptions removed), same numbers the skill reports.
    C.summary = (waits) => {
      const stats = (a) => {
        if (!a.length) return null;
        const s = a.slice().sort((x, y) => x - y);
        const q = (f) => s[Math.min(s.length - 1, Math.floor(f * (s.length - 1)))];
        return { n: a.length, median: q(0.5), p75: q(0.75), share_3d_plus: Math.round((100 * a.filter((x) => x >= 3).length) / a.length) + '%' };
      };
      // Email only, so numbers stay comparable with the email baseline; Slack is reported as context.
      const norm = waits.filter((w) => w.exception !== 'Y' && w.source !== 'slack');
      const slackRows = waits.filter((w) => w.source === 'slack');
      const slowWithSlack = norm.filter((w) => w.days >= 3 && w.slack_msgs_during_wait !== '');
      const by = {}, topicDays = {};
      norm.forEach((w) => {
        (by[w.waited_on] = by[w.waited_on] || []).push(w.days);
        w.topics.split('|').filter(Boolean).forEach((t) => { topicDays[t] = (topicDays[t] || 0) + w.days; });
      });
      const slow = norm.filter((w) => w.days >= 3);
      const totalDays = norm.reduce((a, w) => a + w.days, 0);
      return {
        exchanges: norm.length,
        exceptions_over_max: waits.filter((w) => w.exception === 'Y').length,
        reply_days_by_party: Object.fromEntries(Object.entries(by).map(([k, v]) => [k, stats(v)])),
        slow_replies_share_of_wait_days: totalDays ? Math.round((100 * slow.reduce((a, w) => a + w.days, 0)) / totalDays) + '%' : 'n/a',
        slack_exchanges: slackRows.length,
        slow_email_waits_checked_against_slack: slowWithSlack.length,
        slow_email_waits_with_slack_activity: slowWithSlack.filter((w) => w.slack_msgs_during_wait > 0).length,
        wait_days_by_topic: Object.fromEntries(Object.entries(topicDays).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, Math.round(v)])),
      };
    };

    return C;
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = core;
  else root.OFMCore = core;
})(typeof window !== 'undefined' ? window : globalThis);
