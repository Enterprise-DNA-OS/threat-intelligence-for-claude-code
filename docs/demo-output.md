# Real demo command runs

Captured 11 November 2026 from the fictional seed. No real threat claims.

## Morning source review

```text
node scripts/intel.mjs morning-triage
  ref    title                                 owner  tlp        review_due  overdue_days  unreviewed
  -----  ------------------------------------  -----  ---------  ----------  ------------  ----------
  R-101  Fictional supplier phishing exercise  Mara   TLP:AMBER  2026-11-09  2             1         
  R-103  Fictional partner report                                2026-11-10  1             0
```

## Expiring indicators

```text
node scripts/intel.mjs expiring-indicators
  ref    kind    value            status    confidence  expires_on  reviewer  sources
  -----  ------  ---------------  --------  ----------  ----------  --------  -------
  I-102  ipv4    192.0.2.20       accepted  80          2026-11-10  Mara      2      
  I-103  domain  gateway.example  accepted  70          2026-11-16  Alex      1
```

## Intelligence coverage

```text
node scripts/intel.mjs collection-gaps
  ref    name               owner  priority  review_due  assessments  relevant  last_assessed
  -----  -----------------  -----  --------  ----------  -----------  --------  -------------
  Q-101  Supplier exposure  Mara   1         2026-11-13  0            0                      
  Q-103  Remote access      Alex   1         2026-11-14  0            0                      
  Q-102  Gateway exposure   Alex   2         2026-11-10  1            1         2026-11-09
```
