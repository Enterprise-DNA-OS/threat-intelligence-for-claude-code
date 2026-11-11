# Source handling and record checks

These checks support an analyst's recordkeeping. They do not certify legal compliance, decide whether an indicator is malicious, or authorise sharing. The operator confirms the source's licence, restrictions and intended recipients. There is no network access, blocking, message delivery or publication command.

## FIRST Traffic Light Protocol version 2.0

Source: https://www.first.org/tlp/ and https://www.first.org/tlp/use-cases . Checked 11 November 2026. TLP is sharing guidance, not a legal classification or a copyright licence.

- TLP:RED is for the original recipients only. It is not an organisation-wide permission.
- TLP:AMBER permits need-to-know use within the recipient organisation and its clients. TLP:AMBER+STRICT confines it to the organisation.
- TLP:GREEN permits sharing within the relevant community, not on public channels.
- TLP:CLEAR has no TLP distribution limit. Copyright and other applicable restrictions still matter.
- Additional source restrictions continue to apply. Wider distribution requires the source's explicit permission.

`SOURCE-LABEL` flags missing labels. The database accepts only these labels or an explicit unknown value. `/draft-brief` refuses missing labels, RED sources and any additional restriction text. A draft that passes is still only a local working copy, not permission to send. `/compliance` identifies missing labels, not whether the operator selected the correct label.

Assessment dossiers place the source label at the top and bottom, including repeated print markings. They retain additional restrictions beside the source record. Operator dossiers may contain RED or unclassified records and remain private. The weekly review and dashboards are private mixed-source working papers, not distribution-ready intelligence products. Do not share them until source permissions have been checked individually.

## Local analyst policies, not laws

| Rule | Check | Reason |
|---|---|---|
| SOURCE-OWNER | Report has an accountable analyst | Someone owns the relevance decision |
| SOURCE-REVIEW | Review due date is not past | Old intelligence needs reassessment |
| INDICATOR-SOURCE | Every indicator has a source link | A value without evidence is not actionable intelligence |
| INDICATOR-EXPIRY | Accepted indicator has not expired | Acceptance is time-bounded |
| ACTION-OWNER | Open action names its owner | Follow-through has an accountable person |
| REQUIREMENT-OWNER | Open intelligence question names its owner | Collection has a business purpose |

New imported indicators start unreviewed and expire after 30 days as a configurable office policy. The seven-day expiry window is a review queue, not a legal rule. Confidence is the analyst's explicit 0 to 100 assessment, not a probability or a vendor score. Accepting an indicator requires known source labels, confidence, reviewer, rationale and a current expiry date. Rejected and retired indicators retain the decision history. Re-importing cannot overwrite these decisions.

No command checks live DNS, fetches suspicious URLs, executes payloads, scans a system, or changes a firewall. An indicator in a source report is not proof of compromise. All demo indicators use documentation addresses or reserved example names.

## Access and audit

The CLI runs as one trusted database operator. Row-level security with no public policies blocks anonymous database clients but is not per-analyst isolation. Database owners can bypass it and can alter audit history. The change log is useful operational evidence, not a tamper-proof forensic record. Add role separation and independent audit storage before serving multiple trust groups. Generated files, import files, snapshots and the local database are private and ignored by Git. Keep backup files under equivalent access controls.
