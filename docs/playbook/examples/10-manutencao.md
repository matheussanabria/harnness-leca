# Maintenance log: Supplier registration

| Date | Type | Item | Severity | Missing BDD scenario | Destination |
|---|---|---|---|---|---|
| 2026-12-02 | bug | Tax id with punctuation creates a duplicate | high | "Duplicate tax id" ignores formatting | hotfix, new dossier `supplier-taxid-format`, Origin: supplier-registration |

The new dossier carries `Origin: supplier-registration` in its _status.md. The regression test is the missing scenario above.
