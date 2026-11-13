---
name: onboarding-flow-metrics
description: Measure how an Orderful onboarding project actually flows, from kickoff to go-live, using the PM's or contractor's own Gmail (Gmail connector / MCP, with a Chrome fallback). Produces standard CSVs per person (time per trading partner, emails per step, who each wait was on, what the question was about) so the whole team's data can be combined. Read only. Use when someone says "/onboarding-flow-metrics", "measure my projects", "time per trading partner", "where do my onboardings get stuck", "collect flow data for my clients", or the team lead asks everyone to send their onboarding metrics.
---

# Onboarding flow metrics

Reads your mailbox, and for each of your clients and trading partners it records:

- start, trade request accepted, first test, go-live (or current state)
- how many emails each step took
- every wait: who asked, who had to answer (client, partner, Orderful, us), how many days, and the topic
- waits over 30 days, flagged as exceptions so normal flow and problems can be split

**Read only. Never send, reply, draft, label, archive or delete any email.** The output CSVs hold dates, counts, company names, topic tags and Gmail thread links. They hold no email text, so they are safe to share inside the team.

## When to use this skill

- "/onboarding-flow-metrics"
- "measure my onboarding projects from my email"
- "how long does each trading partner take for my clients?"
- "where do my onboardings get stuck, and who are we waiting on?"
- "the team lead wants everyone's onboarding metrics in the shared folder"

## Behaviour rules

1. **Read only.** Never send, reply, draft, forward, label, archive, mark or delete any email, in either path.
2. **No email text in outputs.** CSVs and summaries carry dates, counts, company names, topic tags and links only. Never paste email bodies into the shared files or into a PR.
3. **The raw JSONL thread files stay local.** They contain email text: keep them in the user's own work folder, never in the skills repo or a shared folder. Offer to delete them once the CSVs are built.
4. **Confirm the client list and client domains with the user before collecting.** Wrong domains silently turn client replies into "partner" replies.
5. **Confirm milestones with the user** (Step 3) before saving the partner table; the regex guesses are a starting point, not the answer.
6. **Do not change Gmail or connector settings** to make the skill work. If the connector is broken, use the Chrome path or stop.

## Files in this skill

| File | What it is |
|---|---|
| `flow_core.js` | The single definition of every column and calculation. Used by both paths below. |
| `build_metrics.cjs` | Node script for the Gmail connector path: turns saved threads into the CSVs + a summary. |
| `gmail_extract.js` | Chrome fallback: reads Gmail in the browser when the connector does not work. |

## Inputs (ask, then confirm)

1. **Your initials**, used in file names.
2. **Your clients**: name, a Gmail search for each, and the client's email domains. Suggest these from `~/orderful-onboarding/<client>/` folders and ask the user to confirm. Example `config.json`:
   ```json
   {
     "us": [".cr@orderful.com", "@yourcompany.com"],
     "clientDomains": {"Acme Foods": ["acmefoods.com"], "Widget Co": ["widgetco.com"]},
     "queries": {"Acme Foods": "\"Acme Foods\" OR acmefoods.com", "Widget Co": "\"Widget Co\" OR widgetco.com"},
     "maxWait": 30,
     "acct": "0"
   }
   ```
   - Use the client name as it appears in Orderful email subjects ("Northwind Retail Inc.", not "NRI"). Its first word of 3+ letters is used to tell which side of "Client <> Partner" is the partner.
   - Client domains matter: anything that is not ours, not `orderful.com` and not a client domain counts as the PARTNER. Add the client's NetSuite consultant or 3PL domain if they act for the client.
   - `us`: your team's address patterns (the `.cr@orderful.com` contractor pattern plus your own company domain). Everyone else at `orderful.com` counts as ORDERFUL.
   - `acct`: the Gmail account index of the work mailbox (`u/0`, `u/1`), only used to build links.
3. **Date range** (optional). Default: all mail. Add `after:2026/01/01` to the queries if wanted.

Save `config.json` in a work folder: `~/orderful-onboarding/_report/flow_work_<initials>/`.

## Path A (default): Gmail connector (MCP)

Check the session has the Gmail connector tools (names end in `search_threads` and `get_thread`, for example `mcp__claude_ai_Gmail__search_threads`). If they are missing, or the connector shows "connected" with "no tools available", use Path B.

### A1. Collect threads, one client at a time

Reading hundreds of threads fills the context, so **give each client to its own subagent** (general-purpose, run several in parallel) with this brief, filled in:

> Read only, never send, draft, label or archive. Using the Gmail connector, run `search_threads` with: `<client query> -from:no-reply -from:noreply -from:calendar-notification -subject:"Relationship Status Update" -subject:"Transaction Status" -subject:Invitation -subject:Accepted -subject:Canceled -subject:Notes`, following page tokens up to about 200 threads. Also search `<client query> subject:"Trade Request Update"` and keep only results whose subject contains `<client key word>`. For every thread, call `get_thread` and append ONE JSON line to `<work folder>/<client-slug>.jsonl`:
> `{"client":"<Client Name>","thread_id":"<Gmail thread id>","subject":"<subject>","messages":[{"from":"Name <email>","date":"<ISO date-time>","body":"<plain text, first 600 characters, quoted replies removed>"}]}`
> Skip auto-replies and out-of-office messages. Write the file with a script or the Write tool, not by echoing email text into a shell command. Report only: number of threads written and any errors.

Thread ids from the connector are the same hex ids Gmail uses in links, so `#all/<thread_id>` links work.

### A2. Build the CSVs

```bash
node skills/onboarding-flow-metrics/build_metrics.cjs --in ~/orderful-onboarding/_report/flow_work_<initials> --config ~/orderful-onboarding/_report/flow_work_<initials>/config.json --who <initials>
```

It writes `flow_waits_<initials>_<date>.csv` and `flow_threads_<initials>_<date>.csv` to `~/orderful-onboarding/_report/` and prints a summary (normal-flow reply times per party, share of slow replies, wait days by topic). `bad_lines` above 0 means a JSONL line was malformed; fix or re-collect that client.

Then go to Step 3.

## Path B (fallback): Claude in Chrome

Use only if the connector does not work. Load the Chrome tools in one ToolSearch call: `tabs_context_mcp, navigate, javascript_tool, tabs_close_mcp`.

1. `navigate` to `https://mail.google.com/mail/u/<acct>/#inbox` and check the tab title shows the work address.
2. Wait about 5 seconds, then inject the full text of `flow_core.js`, then the full text of `gmail_extract.js`, each with `javascript_tool`. The second returns `{ready: true}`; if not, reload and retry.
3. Set config and start (runs in the background; each tool call times out at 45 seconds, so never await the job):
   ```js
   OFM.cfg = {us: ['.cr@orderful.com', '@yourcompany.com'], clientDomains: {...}, maxWait: 30}
   OFM.collect({'Acme Foods': '"Acme Foods" OR acmefoods.com', ...}, 4)
   ```
4. Poll with `await OFM.sleep(40000); OFM.state` until `phase` is `done`. A client with 0 threads in `log` usually means the page was not settled; re-run `OFM.collect` for that client. About 600 threads take about 10 minutes.
5. `OFM.build()` returns counts and the summary. Read rows with `OFM.chunk('threads', 0, 150)` and `OFM.chunk('waits', 0, 150)` (then 150, 300, ... until empty) and write them, header first, to `~/orderful-onboarding/_report/flow_threads_<initials>_<date>.csv` and `flow_waits_<initials>_<date>.csv`.
6. Close the tab with `tabs_close_mcp`.

## Step 3: per-partner milestones (check with the user)

The regexes only guess at milestones. From the threads CSV, build one row per partner:

`client, partner, start, trade_request_accepted, first_test, go_live_or_state, emails, days_start_to_live`

- `start`: earliest thread date for that partner
- `trade_request_accepted`: `first_date` of the row with `trade_request = Accepted` for that partner
- `first_test`: first thread with `mentions_test_sent = Y` (open it if unsure)
- `go_live_or_state`: first thread with `mentions_live = Y`, or the current state in a few words
- `emails`: sum of `emails` for that partner

Merge names that are the same company ("Widget Co" and "widgetco.com"). Rows with partner `(general)` are client-level threads, not a partner. Show the table to the user and let them correct dates they know better, then save `flow_partners_<initials>_<date>.csv` next to the others.

## Step 4: short summary for the user

From the printed summary and the partner table, about 5 short bullets:

- typical reply time per party and who has the most 3+ day replies
- share of waiting caused by slow replies
- top 3 topics by wait days
- typical days and emails per trading partner, start to live
- the exceptions (waits over 30 days), each with its thread link and one line on why (PTO, handoff, partner silent)

No em dashes in anything written for others.

## Columns (fixed, so everyone's files can be combined)

**flow_waits**: `client, partner, thread_id, step, asked_by, waited_on, asked_date, answered_date, days, chasers, exception, topics`
- `step`: CONNECT, TEST, GOLIVE, LIVE_ISSUE, GENERAL, from the subject
- `asked_by` / `waited_on`: US, ORDERFUL, CLIENT, PARTNER
- `days`: from the first message of the asking turn to the first answer, so chaser time is included
- `chasers`: extra messages the asker sent at least a day apart before getting an answer
- `exception`: Y when `days` is over `maxWait`
- `topics`: test_data, test_files, edi_ids, connection, mapping, decision, labels, ns_ids, items, portal, vendor_setup

**flow_threads**: `client, partner, thread_id, subject_short, step, first_date, last_date, days_open, emails, our_chasers, trade_request, mentions_test_sent, mentions_live, gmail_link`

**flow_partners**: `client, partner, start, trade_request_accepted, first_test, go_live_or_state, emails, days_start_to_live`

## Combining the team's files

Everyone drops their three CSVs in one shared folder. Concatenate each type, keeping one header row. Baseline from the first run (one mailbox, 26 clients, Nov 2026):

- single replies: same day, typically
- 11% of replies take 3+ days and cause about 75% of all waiting
- partner connection: 14 days and 9 emails, typically; half need a chaser
- per trading partner, start to live: about 48 days median (21 to 89)
- top topic by wait days: building test data in the sandbox

## Known limits

- Email only. Work in Slack, calls or the Orderful app does not show, so some gaps look longer than they were.
- Days are calendar days.
- Topic tags are keyword based and overlap. Use them for ranking, not exact totals.
- A thread found under two clients is counted under the first one.
- Chrome path: Gmail's page layout can change. If `OFM.rows()` returns nothing on a results page, the row selector (`tr.zA`, `[data-legacy-thread-id]`) needs updating.
