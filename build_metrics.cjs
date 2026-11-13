#!/usr/bin/env node
// Copyright (c) 2026 Orderful, Inc.
// Builds the flow CSVs from threads saved by the Gmail connector (MCP) path.
//
// Usage:
//   node build_metrics.cjs --in <dir with *.jsonl> --config <config.json> --who <initials> [--out <dir>]
//
// Each JSONL line is one thread (email or Slack):
//   {"client":"Acme Foods","thread_id":"18c0ffee00000001","subject":"...",
//    "messages":[{"from":"Pat Lee <pat@widgetco.com>","date":"2026-10-28T02:02:00Z","body":"..."}]}
// Slack lines add "source":"slack" and optionally "link" and "partner" (the trading partner the thread is about); a Slack message may carry "party":"US|CLIENT|PARTNER|ORDERFUL"
//   when the Slack tool gives no email for the sender (or map names in config "people").
// config.json: {"us":[".cr@orderful.com","@yourcompany.com"],"clientDomains":{"Acme Foods":["acmefoods.com"]},"maxWait":30,"acct":"0"}

const fs = require('fs');
const path = require('path');
const os = require('os');
// flow_core.js is shared with the browser path; load it the same way regardless of the repo's module type.
const ctx = {};
require('vm').runInNewContext(fs.readFileSync(path.join(__dirname, 'flow_core.js'), 'utf8'), ctx);
const core = ctx.OFMCore;

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
if (!args.in || !args.config || !args.who) {
  console.error('Usage: node build_metrics.cjs --in <dir> --config <config.json> --who <initials> [--out <dir>]');
  process.exit(1);
}
const out = args.out || path.join(os.homedir(), 'orderful-onboarding', '_report');
const cfg = JSON.parse(fs.readFileSync(args.config, 'utf8'));
const C = core(cfg);

const clean = (s) => {
  s = String(s || '').replace(/\r/g, '').replace(/\[Quoted text hidden\]/g, '');
  const m = s.search(/\n\s*(On [^\n]{5,120}wrote:|From:\s[^\n]+\n\s*(Sent|Date):|-{3,}\s*Original Message|_{8,}|>\s?On .{5,120}wrote)/i);
  if (m > 0) s = s.slice(0, m);
  return s.split('\n').filter((l) => !/^\s*>/.test(l)).join(' ').replace(/\s+/g, ' ').trim().slice(0, 400);
};
const emailOf = (from) => ((String(from).match(/<([^>]+)>/) || [])[1] || String(from)).trim().toLowerCase();
const nameOf = (from) => String(from).replace(/<[^>]*>/, '').replace(/"/g, '').trim();

const files = fs.statSync(args.in).isDirectory()
  ? fs.readdirSync(args.in).filter((f) => f.endsWith('.jsonl')).map((f) => path.join(args.in, f))
  : [args.in];
const seen = new Map();
let bad = 0;
for (const f of files) {
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let t;
    try { t = JSON.parse(line); } catch { bad++; continue; }
    if (!t.thread_id || seen.has(t.thread_id)) continue; // first client wins, like the Chrome path
    const msgs = (t.messages || []).map((m) => ({ name: nameOf(m.from), em: emailOf(m.from), dt: +new Date(m.date), body: clean(m.body), party: m.party })).filter((m) => m.dt);
    seen.set(t.thread_id, { client: t.client, lid: t.thread_id, subj: t.subject || '', partner: t.partner, source: t.source === 'slack' ? 'slack' : 'email', link: t.link, msgs });
  }
}

const res = C.build([...seen.values()]);
const day = new Date().toISOString().slice(0, 10);
fs.mkdirSync(out, { recursive: true });
const wf = path.join(out, `flow_waits_${args.who}_${day}.csv`);
const tf = path.join(out, `flow_threads_${args.who}_${day}.csv`);
fs.writeFileSync(wf, res.csv.waits.join('\n') + '\n');
fs.writeFileSync(tf, res.csv.threads.join('\n') + '\n');
console.log(JSON.stringify({ threads_in: seen.size, bad_lines: bad, waits_file: wf, threads_file: tf, summary: C.summary(res.waits) }, null, 2));
