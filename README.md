# onboarding-flow-metrics

A Claude Code skill that measures how Orderful onboarding projects flow, from kickoff to go-live, using each person's own Gmail. It outputs fixed-column CSVs (time per trading partner, emails per step, who each wait was on, what the question was about) so the team's data can be combined.

Read only. The CSVs hold dates, counts, company names and Gmail links, no email text.

## Install

```bash
git clone https://github.com/salaheddinebellafrouh/onboarding-flow-metrics.git ~/.claude/skills/onboarding-flow-metrics
```

Then in Claude Code run `/onboarding-flow-metrics`. Details are in [SKILL.md](SKILL.md).
