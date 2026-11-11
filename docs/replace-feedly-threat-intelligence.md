# Move an intelligence working set from Feedly

Feedly documents IoC export from articles and Insights Cards as CSV, STIX, MISP or Markdown: https://docs.feedly.com/article/608-how-can-i-export-iocs . Its export can carry original article context. Checked 11 November 2026.

This importer supports an article's CSV indicator list. It does not claim a complete Feedly account restore, recreate its intelligence collection, or extract indicators from raw articles. A real customer export has not been tested. The fixture in examples/feedly-iocs.csv is synthetic; its headers are a documented importer convention, not a claim about every Feedly export version.

1. In Feedly, open an article's indicators and choose CSV export. Keep the source URL, title and sharing instructions. Export individual articles separately so source provenance stays clear.
2. Start a new database with `npm run migrate`, without loading the demo. Inspect the CSV header. The default aliases are Type / Indicator Type / kind, Indicator / Value / IoC, and optional Context / Description / source_context. If yours differ, supply a mapping.
3. Run one import command, first as a dry run:

```bash
node scripts/intel.mjs import feedly --file=imports/article.csv --source=https://example.org/report --title="Report title" --tlp=TLP:CLEAR --owner="Responsible analyst" --dry-run
```

Remove `--dry-run` after reviewing the result. The whole file is one transaction. A malformed row leaves the database unchanged. The source URL identifies the report. Kind plus canonical indicator value identifies the indicator. Re-import preserves analyst confidence, status, rationale and expiry; it only refreshes the link's source context. Duplicate indicators within one CSV are rejected so they can be reconciled deliberately.

For other headers, save a mapping and append `--mapping=imports/headers.json`:

```json
{"kind":"Observable type","value":"Observable","context":"Article context"}
```

Supported types are IPv4, IPv6, domain, URL, email, MD5, SHA1 and SHA256, including common STIX type aliases. Defanged `[.]` and `hxxp` values are normalised without visiting them. Unsupported types stop the import. Never relabel an unknown source as CLEAR to get through import: confirm its permission or add the report with an unknown label for manual triage.

4. Compare row counts, indicator values, source URL and sharing label with the original. Read `/unreviewed-indicators`, `/source-coverage` and `/compliance`. Review each indicator before accepting it.
5. Reconcile actions, intelligence questions and assessments separately. Feed definitions, newsletter history, proprietary enrichment, alerting rules, attachments and user permissions are not imported. Ask Enterprise DNA to map any additional authorised exports into your version. Keep collection sources running until you have an approved replacement for that separate service.

## Leave this system too

`node scripts/intel.mjs export --dir=exports/backup` writes CSV per entity and a complete snapshot. CSV is an analysis copy, not a lossless restore. It preserves raw cell values, so use a spreadsheet's text import mode and do not execute formulas from untrusted records. Restore the snapshot into an empty migrated database with `node scripts/intel.mjs restore --file=exports/backup/snapshot.json`. The test suite proves a full record and audit round trip. Restore refuses a populated database. All snapshots contain private information, including source restrictions and analyst notes.
