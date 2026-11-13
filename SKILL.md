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

1. **Read only.** Never send, reply, draft, forward, label, archive, mark or delete any email, in either path. In Slack, never post, reply, react, edit or join channels; only read channels the user is already in.
2. **No email or Slack text in outputs.** CSVs and summaries carry dates, counts, company names, topic tags and links only. Never paste email bodies into the shared files or into a PR.
3. **The raw JSONL thread files stay local.** They contain email and Slack text: keep them in the user's own work folder, never in the skills repo or a shared folder. Offer to delete them once the CSVs are built.
4. **Find the client list, domains and initials yourself, then get one OK from the user before collecting.** Never ask the user to type them. Wrong domains silently turn client replies into "partner" replies, which is why the OK is still needed.
5. **Confirm milestones with the user** (Step 3) before saving the partner table; the regex guesses are a starting point, not the answer.
6. **Do not change Gmail or connector settings** to make the skill work. If the connector is broken, use the Chrome path or stop.

## Files in this skill

| File | What it is |
|---|---|
| `flow_core.js` | The single definition of every column and calculation. Used by both paths below. |
| `build_metrics.cjs` | Node script for the Gmail connector path: turns saved threads into the CSVs + a summary. |
| `gmail_extract.js` | Chrome fallback: reads Gmail in the browser when the connector does not work. |

## Inputs (found automatically, the user only confirms)

The user does not type initials or client names. Find everything below, then show ONE table and ask "OK, or anything to fix?" before collecting. Run the discovery in one subagent so the subject lists stay out of the main context; it returns only the table.

1. **Initials**, used in file names. Take the mailbox owner's name: the Gmail connector profile tool if there is one, else the `From:` name on one thread from `in:sent`. Initials = first letter of the first and last name, upper case (`Pat Lee` -> `PL`). With only an address, use the letters around the dot (`pat.lee@` -> `PL`).
2. **`us`** (your team's addresses): the owner's own domain, unless it is `orderful.com` or a free mail domain; then the owner's own address. Always add `.cr@orderful.com` (contractors). Everyone else at `orderful.com` counts as ORDERFUL.
3. **Clients.** Run these Gmail searches (subjects only, up to about 300 results each, default the last 18 months):
   - `subject:"<>" (from:orderful.com OR to:orderful.com OR cc:orderful.com)` (onboarding threads are named "A <> B")
   - `subject:"Trade Request Update"`
   - `subject:(kickoff OR "kick-off" OR "kick off" OR onboarding) orderful`
   - also list the folders in `~/orderful-onboarding/` and, with Slack on, channel names like `#ext-*` / `#client-*` / `#*-orderful`

   Rules to pick clients from the subjects:
   - "Orderful <> X" or "X <> Orderful": X is a client.
   - "X <> Y": the client is the side that shows up with several different partners ("Acme Foods <> Walmart", "Acme Foods <> Target" -> Acme Foods). Names that show up across several different clients (Walmart, Target, Home Depot, Lowe's, Amazon, Kroger, SPS...) are trading partners, not clients.
   - Merge spellings of the same company and keep the full name as it appears in subjects ("Northwind Retail Inc.", not "NRI"). Its first word of 3+ letters is used to tell which side of "Client <> Partner" is the partner.
   - Keep clients with 3+ threads. List the rest under "maybe" in the table so the user can add them.
4. **Client domains.** For each client, read 2 or 3 of its threads and take the most common sender domain that is not ours, not `orderful.com`, not a free mail domain and not a known partner's. Add the client's NetSuite consultant or 3PL domain if they write for the client. Domains matter: anything that is not ours, not `orderful.com` and not a client domain counts as the PARTNER.
5. **Gmail search per client**: `"<Client Name>" OR <domain>` (add more domains with OR).
6. **Slack channels** (only when Slack is on): for every client, search Slack channels by the client name, its key word and its domain. If a client has no channel, its Slack threads are found later by a message search for the client name. Slack often gives names, not emails, so also map the regular people in those channels to `US`, `CLIENT`, `PARTNER` or `ORDERFUL` from their email or title where the Slack tool shows it; unmapped names show as `UNKNOWN`.
7. **`acct`**: the Gmail account index of the work mailbox (`u/0`, `u/1`), only used to build links. **Date range**: all mail unless the user says otherwise.

The table to confirm:

| client | domains | email threads | Slack channels |
|---|---|---|---|

with the initials above it and the "maybe" list under it. Then write `config.json`:
```json
{
  "us": [".cr@orderful.com", "@yourcompany.com"],
  "clientDomains": {"Acme Foods": ["acmefoods.com"], "Widget Co": ["widgetco.com"]},
  "queries": {"Acme Foods": "\"Acme Foods\" OR acmefoods.com", "Widget Co": "\"Widget Co\" OR widgetco.com"},
  "slackChannels": {"Acme Foods": ["#acme-orderful", "#ext-acme-orderful"]},
  "people": {"Pat Lee": "US", "Ann Smith": "CLIENT", "Sam Ray": "PARTNER"},
  "maxWait": 30,
  "acct": "0"
}
```

Save `config.json` in a work folder: `~/orderful-onboarding/_report/flow_work_<initials>/`.

**Every client in the list is inspected in every source.** Gmail always, and Slack too when Slack is on. Before building, show a coverage line per client: `client: <n> email threads, <n> Slack threads`. A client with 0 in a source is not dropped silently: widen the search once (client key word alone, domain alone, or a channel search), then tell the user which clients still have nothing.

## Path A (default): Gmail connector (MCP)

Check the session has the Gmail connector tools (names end in `search_threads` and `get_thread`, for example `mcp__claude_ai_Gmail__search_threads`). If they are missing, or the connector shows "connected" with "no tools available", use Path B.

### A1. Collect threads, one client at a time

Reading hundreds of threads fills the context, so **give each client to its own subagent** (general-purpose, run several in parallel) with this brief, filled in:

> Read only, never send, draft, label or archive. Using the Gmail connector, run `search_threads` with: `<client query> -from:no-reply -from:noreply -from:calendar-notification -subject:"Relationship Status Update" -subject:"Transaction Status" -subject:Invitation -subject:Accepted -subject:Canceled -subject:Notes`, following page tokens up to about 200 threads. Also search `<client query> subject:"Trade Request Update"` and keep only results whose subject contains `<client key word>`. For every thread, call `get_thread` and append ONE JSON line to `<work folder>/<client-slug>.jsonl`:
> `{"client":"<Client Name>","thread_id":"<Gmail thread id>","subject":"<subject>","messages":[{"from":"Name <email>","date":"<ISO date-time>","body":"<plain text, first 600 characters, quoted replies removed>"}]}`
> Skip auto-replies and out-of-office messages. Write the file with a script or the Write tool, not by echoing email text into a shell command. Report only: number of threads written and any errors.

Thread ids from the connector are the same hex ids Gmail uses in links, so `#all/<thread_id>` links work.

### A1b (optional). Collect Slack for context

Only if the session has a Slack connector (tools to search messages and read channel or thread history) and the user asked for Slack. Cover every client in the list, the same ones as Gmail, with the channels confirmed in Inputs step 6. If a client has no channel, also search Slack messages for the client name over the date range so client threads in general channels are not missed. Give each client to a subagent with this brief:

> Read only: never post, reply, react, edit or join. For each channel in `<channels>`, read the history for `<date range>` with the Slack connector, including thread replies. Write ONE JSON line per Slack thread (a parent message plus its replies; a run of loose channel messages on the same day counts as one thread) to `<work folder>/<client-slug>.slack.jsonl`:
> `{"client":"<Client Name>","source":"slack","thread_id":"slack-<channel id>-<parent ts>","partner":"<trading partner the thread is about, or (general)>","link":"<message permalink if available>","subject":"#<channel>: <first 60 characters of the parent message>","messages":[{"from":"<Name> <email if the tool gives it>","date":"<ISO date-time>","body":"<plain text, first 600 characters>","party":"<US|CLIENT|PARTNER|ORDERFUL if known from the people list, else omit>"}]}`
> Skip bot and app messages (join notices, integrations, reminders). Write the file with a script or the Write tool. Report only: threads written per channel and any errors.

What Slack adds:
- Slack threads become rows like email threads (`source = slack`), so reply times and topics include Slack work.
- Every email wait of 3+ days gets `slack_msgs_during_wait`: how many Slack messages for that client fell inside the wait. A high count means the work was moving in Slack, so that email gap was not a real stall.
- The printed summary keeps reply-time numbers **email only** (comparable with the baseline below) and reports Slack as context: `slack_exchanges`, `slow_email_waits_with_slack_activity`.

### A2. Build the CSVs

```bash
node skills/onboarding-flow-metrics/build_metrics.cjs --in ~/orderful-onboarding/_report/flow_work_<initials> --config ~/orderful-onboarding/_report/flow_work_<initials>/config.json --who <initials>
```

It reads every `*.jsonl` in the folder (email and Slack), writes `flow_waits_<initials>_<date>.csv` and `flow_threads_<initials>_<date>.csv` to `~/orderful-onboarding/_report/` and prints a summary (normal-flow reply times per party, share of slow replies, wait days by topic). `bad_lines` above 0 means a JSONL line was malformed; fix or re-collect that client.

Then go to Step 3.

## Path B (fallback): Claude in Chrome

Use only if the connector does not work. Load the Chrome tools in one ToolSearch call: `tabs_context_mcp, navigate, javascript_tool, tabs_close_mcp`.

1. `navigate` to `https://mail.google.com/mail/u/<acct>/#inbox` and check the tab title shows the work address.
2. Wait about 5 seconds, then inject the full text of `flow_core.js`, then the full text of `gmail_extract.js`, each with `javascript_tool`. The second returns `{ready: true}`; if not, reload and retry.
3. Discover first (Inputs above): `OFM.discover(['subject:"<>" (from:orderful.com OR to:orderful.com OR cc:orderful.com)', 'subject:"Trade Request Update"', 'subject:(kickoff OR "kick-off" OR "kick off" OR onboarding) orderful'])`, poll `OFM.state` until `phase` is `done`, then read `OFM.subjects` (in chunks if long) and pick clients with the rules above. For domains, `await OFM.parse('<thread id>')` on 2 or 3 threads per client. After the user's OK:
4. Set config and start (runs in the background; each tool call times out at 45 seconds, so never await the job):
   ```js
   OFM.cfg = {us: ['.cr@orderful.com', '@yourcompany.com'], clientDomains: {...}, maxWait: 30}
   OFM.collect({'Acme Foods': '"Acme Foods" OR acmefoods.com', ...}, 4)
   ```
5. Poll with `await OFM.sleep(40000); OFM.state` until `phase` is `done`. A client with 0 threads in `log` usually means the page was not settled; re-run `OFM.collect` for that client. About 600 threads take about 10 minutes.
6. `OFM.build()` returns counts and the summary. Read rows with `OFM.chunk('threads', 0, 150)` and `OFM.chunk('waits', 0, 150)` (then 150, 300, ... until empty) and write them, header first, to `~/orderful-onboarding/_report/flow_threads_<initials>_<date>.csv` and `flow_waits_<initials>_<date>.csv`.
7. Close the tab with `tabs_close_mcp`.

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
- if Slack was collected: how many slow email waits had Slack activity during them (those were probably not real stalls)

No em dashes in anything written for others.

## Columns (fixed, so everyone's files can be combined)

**flow_waits**: `client, partner, thread_id, step, asked_by, waited_on, asked_date, answered_date, days, chasers, exception, topics, source, slack_msgs_during_wait`
- `step`: CONNECT, TEST, GOLIVE, LIVE_ISSUE, GENERAL, from the subject
- `asked_by` / `waited_on`: US, ORDERFUL, CLIENT, PARTNER (UNKNOWN for unmapped Slack names)
- `days`: from the first message of the asking turn to the first answer, so chaser time is included
- `chasers`: extra messages the asker sent at least a day apart before getting an answer
- `exception`: Y when `days` is over `maxWait`
- `topics`: test_data, test_files, edi_ids, connection, mapping, decision, labels, ns_ids, items, portal, vendor_setup
- `source`: email or slack
- `slack_msgs_during_wait`: for email waits of 3+ days when Slack was collected, the number of Slack messages for that client during the wait; empty otherwise

**flow_threads**: `client, partner, thread_id, subject_short, step, first_date, last_date, days_open, emails, our_chasers, trade_request, mentions_test_sent, mentions_live, gmail_link, source` (`gmail_link` holds the Slack permalink for Slack rows)

**flow_partners**: `client, partner, start, trade_request_accepted, first_test, go_live_or_state, emails, days_start_to_live`

## Combining the team's files

Everyone drops their three CSVs in one shared folder. Concatenate each type, keeping one header row. Baseline from the first run (one mailbox, 26 clients, Nov 2026):

- single replies: same day, typically
- 11% of replies take 3+ days and cause about 75% of all waiting
- partner connection: 14 days and 9 emails, typically; half need a chaser
- per trading partner, start to live: about 48 days median (21 to 89)
- top topic by wait days: building test data in the sandbox

## Known limits

- Without the optional Slack step, work done in Slack does not show. Calls and work in the Orderful app never show, so some gaps look longer than they were.
- Slack threads are grouped by the collecting agent; loose channel chatter is grouped per day, so Slack reply times are rougher than email ones.
- Days are calendar days.
- Topic tags are keyword based and overlap. Use them for ranking, not exact totals.
- A thread found under two clients is counted under the first one.
- Chrome path: Gmail's page layout can change. If `OFM.rows()` returns nothing on a results page, the row selector (`tr.zA`, `[data-legacy-thread-id]`) needs updating.
