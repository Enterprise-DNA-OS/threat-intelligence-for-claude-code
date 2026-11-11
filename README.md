# Threat Intelligence for Claude Code

Source reports, indicators, intelligence questions and follow-through in a database you own. Built by Enterprise DNA. Works with Claude Code, Codex, OpenCode or Cursor.

| Do it yourself | We customise it | We run it for you |
|---|---|---|
| Free MIT source. Install and run the demo. | Your questions, fields, source rules and Feedly data mapped across. | Installed, connected and operated through Omni by Enterprise DNA. |
| [Quick start](#quick-start) | [Get your version built](https://enterprisedna.co/omni/book/?offer=replace-software&utm_campaign=feedly-threat-intelligence&utm_medium=readme) | [Setup fee, then a retainer](https://enterprisedna.co/omni/book/?offer=replace-software&utm_campaign=feedly-threat-intelligence&utm_medium=readme-managed) |

## What the desk runs

The morning source review, indicator expiry check, intelligence collection-gap review, overdue action follow-up and weekly briefing preparation. Every indicator links back to its source. Relevance assessments name the analyst and evidence. Accepted indicators need confidence and expiry. Draft assessment dossiers carry the original source sharing label and restrictions.

[Feedly's own pricing page](https://feedly.com/threat-intelligence/pricing) asks for a quote for Standard and Advanced. This page makes no public dollar-price claim. Checked 11 November 2026. This base covers the analyst's working records after export. It does not reproduce Feedly's intelligence collection, enrichment, proprietary models, live feeds or integrations. See [scope](docs/why-no-front-end.md).

## Quick start

Node.js 22 or newer. No separate database installation is needed for the demo.

```bash
git clone https://github.com/Enterprise-DNA-OS/threat-intelligence-for-claude-code.git
cd threat-intelligence-for-claude-code
npm install
npm test
npm run demo
npm run view
npm run docs
```

Open the folder in your coding agent and ask for `/attention`. The fictional demo contains an expired accepted indicator, two overdue actions, unanswered intelligence questions and a source whose sharing label is unknown. Addresses and names are synthetic. Dates move with the day of the first seed. Running the seed again preserves changes.

Use a separate empty DATA_DIR for your own data and run `npm run migrate` without seeding. Set DATABASE_URL for a shared Postgres database. Migrations and both database adapters use the same schema and commands. The database owner is a trusted operator; this is not a public multi-tenant service. Row-level security blocks public clients, with no public policies. It does not separate individual CLI users. Keep private outputs away from source control.

## The commands

- `/reports`: Read source reports and their sharing labels.
- `/indicators`: Read the complete indicator register.
- `/morning-triage`: Review source reports due today or still unreviewed.
- `/unreviewed-indicators`: Review imported indicators before accepting any.
- `/expiring-indicators`: Reassess accepted indicators expiring within seven days.
- `/source-overlap`: Find indicator values mentioned by more than one source.
- `/requirements`: Read the questions the intelligence desk must answer.
- `/collection-gaps`: Find unanswered or overdue intelligence questions.
- `/assessments`: Read relevance decisions and their evidence.
- `/actions`: Read action ownership and completion evidence.
- `/overdue-actions`: Review overdue follow-through.
- `/compliance`: Check source labels and local recordkeeping policies.
- `/notes`: Read analyst notes.
- `/audit`: Read the latest record changes.
- `/source-coverage`: Compare each source with its accepted and unreviewed indicators.
- `/attention`: Read the combined review queue.
- `/report-pack`: Read one source and all its linked evidence.
- `/weekly-review`: Prepare the Monday review from triage, collection gaps and overdue actions.
- `/add`: Add the verified source, indicator, question or action supplied by the operator.
- `/update`: Read the record, then apply the operator's specific correction.
- `/link`: Attach an indicator to its original source.
- `/review-indicator`: Record an analyst decision with confidence, rationale and expiry.
- `/assess`: Record a source's relevance to an intelligence question.
- `/complete-action`: Close an action only with supplied completion evidence.
- `/log`: Append the operator's note to a source report.
- `/draft-brief`: Create a source-labelled draft for one reviewed source, never send.
- `/draft-weekly-review`: Save a private Monday working paper, never send.
- `/import`: Import an authorised Feedly article CSV, preserving analyst decisions.
- `/export`: Save all records and audit history in a private backup.
- `/restore`: Restore a snapshot into an empty migrated database.
- `/customise`: add a field or change a local rule through a numbered migration.
- `/new-view`: add a read-only report for an operator's question.

Every CLI route supports --json. Exact references, partial IDs and case-insensitive names work. Ambiguity prints matching choices and exits one. `npm run intel -- help` prints syntax. There is no send, fetch, scan or blocking integration.

## Switch your working set in a day

Export an article's indicators as CSV from Feedly, inspect the header and source restrictions, then use one command:

```bash
node scripts/intel.mjs import feedly --file=imports/article.csv --source=https://example.org/report --title="Source report" --tlp=TLP:CLEAR --owner="Responsible analyst" --dry-run
```

Remove --dry-run to apply. Repeat imports preserve existing analyst decisions. The [replace guide](docs/replace-feedly-threat-intelligence.md) explains aliases, explicit header mapping, what transfers and what needs separate work. The included fixture is synthetic; no real customer export has been tested. Keep intelligence collection available until its separate replacement has been agreed.

## Ten questions the desk answers today

These answers come from your imported evidence and your own decisions. They are not an unsupported claim that Feedly cannot answer similar questions in its wider service.

1. Which source reports are still waiting for an analyst? (`/morning-triage`)
2. Which accepted indicators have expired or expire this week? (`/expiring-indicators`)
3. Which indicator values appear in more than one source? (`/source-overlap`)
4. Which intelligence questions have no relevant assessment? (`/collection-gaps`)
5. Which actions are late and who owns each one? (`/overdue-actions`)
6. Which sources have no confirmed sharing label? (`/compliance`)
7. Which imported indicators still have no review decision? (`/unreviewed-indicators`)
8. Which source has the most accepted indicators in our working set? (`/source-coverage`)
9. What evidence explains a report's relevance to our questions? (`/report-pack`)
10. Which records changed, and where can I inspect their before-and-after versions? (`/audit`)

The audit list identifies changed records. The audit_events records retain before_record and after_record for inspection with a read-only database query. The log does not authenticate the human who ran the CLI and is not tamper-proof.

## Your first hour: ten things to ask for

1. Show the two source reports due for review.
2. Explain why the expired indicator is still accepted.
3. Show the two reports linked to that same indicator.
4. List the intelligence questions without relevant evidence.
5. Read the missing sharing label and its source restriction.
6. Assign the unowned action after I supply the accountable person.
7. Record my indicator decision with its rationale and new expiry date.
8. Add my relevance assessment to the supplier question.
9. Draft the gateway assessment dossier and show its source label.
10. Add a business-unit field and a view of unanswered questions by unit.

## Paperwork and backups

`npm run docs` creates an assessment dossier for each source, including its indicators, relevance decisions, actions and notes. `npm run view` renders the morning desk, intelligence coverage and action review. Change brand.json to set the business name, colours and logo. HTML is private and read-only. Dossiers preserve source markings at the top and bottom, including print styling. Mixed-source weekly papers and dashboards are operator working copies, not distribution-ready reports.

Export writes CSV and a complete snapshot. Restore requires an empty migrated database and preserves original audit history. The tests prove the round trip. CSV keeps raw values for analysis; open untrusted CSV in text-import mode and never execute embedded spreadsheet formulas. Backups and dossiers can contain restricted information.

## Source handling

Read [compliance.md](docs/compliance.md) for FIRST TLP 2.0 guidance and the local owner, evidence, review and expiry checks. These checks do not certify compliance or determine whether a value is malicious. Draft brief creation refuses unknown labels, RED sources and additional source restrictions. An accepted indicator does not trigger any network or blocking action.

## Verification

`npm test` uses disposable local databases and covers every CLI route, rejected inputs, import rollback, repeat imports, evidence requirements, sharing checks, HTML escaping and full backup restoration. CI runs Node 22 on Linux and Windows, plus a PostgreSQL service check. Workflow results state which platforms have actually passed.

## Installed and run for you

Enterprise DNA maps your Feedly exports, builds the fields, source connections and team screens you need, and operates your version through **Omni by Enterprise DNA**. One setup fee, then a retainer. [Spend 30 minutes with Sam](https://enterprisedna.co/omni/book/?offer=replace-software&utm_campaign=feedly-threat-intelligence&utm_medium=readme-closing).

MIT licence. Feedly is a separate product. This project is not affiliated with Feedly.
