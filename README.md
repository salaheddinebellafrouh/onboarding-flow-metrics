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

Paste this as is, nothing to fill in:

```
Run /onboarding-flow-metrics on my Gmail and Slack.
Find my initials, all my clients, their email domains and their Slack channels yourself,
and inspect every client in both Gmail and Slack.
Use the Gmail and Slack connectors. Read only: do not send, post or change anything.
Show me what you found in one table before you start.
When done, show me the per-partner milestone table so I can fix the dates,
then save the 3 CSVs and give me a 5-bullet summary.
```

No Slack? Remove "and Slack" and "and their Slack channels". Gmail alone still works.

## What happens

1. Claude finds your initials, your clients (from "Client <> Partner" subjects, trade request emails and kickoffs), their email domains and Slack channels, and shows them in one table. Say OK or fix a row.
2. It reads your mail and Slack for every client (about 10 minutes), then shows how many threads it found per client. A client with nothing found is flagged, not skipped.
3. It shows a table with one row per trading partner. Fix any wrong dates.
4. It saves 3 CSVs in `~/orderful-onboarding/_report/` and gives a short summary.
5. Send those 3 files to your team lead or drop them in the shared folder.

Details are in [SKILL.md](SKILL.md).
