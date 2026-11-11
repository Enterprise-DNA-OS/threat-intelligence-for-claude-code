# /customise

Read CLAUDE.md, the relevant CLI command and the current migration. Ask the operator for the field, rule or stage they want if it is not already clear. Write the next numbered migration, never edit one already applied. Update the CLI's allowed fields, recurring command and relevant view. Add a test for the changed business behaviour, migrate the local database and run npm test. Report the actual result and the migration name. Back up business records before applying a schema change. Do not invent a sharing permission or weaken a rule to make an import pass.
