# onboarding-flow-metrics

A Claude Code skill that measures how Orderful onboarding projects flow, from kickoff to go-live, using each person's own Gmail. It outputs fixed-column CSVs (time per trading partner, emails per step, who each wait was on, what the question was about) so the team's data can be combined.

Read only. The CSVs hold dates, counts, company names and Gmail/Slack links, no message text.

## Install

```bash
git clone https://github.com/salaheddinebellafrouh/onboarding-flow-metrics.git ~/.claude/skills/onboarding-flow-metrics
```

## Before you start

1. Turn on Gmail in your Claude Code session: in the Claude desktop app, open the + menu in the message box > Connectors > Gmail. It must show tools, not "no tools available".
2. Have Node.js installed (the script that builds the CSVs runs on Node).
3. Optional, for more context: turn on the Slack connector the same way. Slack shows when work moved in Slack while email looked quiet.

## What to tell Claude Code

Paste this and replace the parts in `<>`:

```
Run /onboarding-flow-metrics on my Gmail.
My initials: <XX>
My clients: <Client 1>, <Client 2>, <Client 3>
Use the Gmail connector. Read only, do not send or change any email.
Suggest each client's email domain and search, and let me confirm before you start.
When done, show me the per-partner milestone table so I can fix the dates,
then save the 3 CSVs and give me a 5-bullet summary.
```

With Slack (optional), add these lines to the prompt:

```
Also check Slack for context, read only, do not post anything.
My Slack channels per client: <Client 1>: #channel-a, #channel-b; <Client 2>: #channel-c
```

## What happens

1. Claude asks you to confirm each client's email domain and search (and, with Slack, who in the channels is your team, the client or the partner).
2. It reads your mail (about 10 minutes).
3. It shows a table with one row per trading partner. Fix any wrong dates.
4. It saves 3 CSVs in `~/orderful-onboarding/_report/` and gives a short summary.
5. Send those 3 files to your team lead or drop them in the shared folder.

Details are in [SKILL.md](SKILL.md).
