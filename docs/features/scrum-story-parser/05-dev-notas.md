# Scrum story body repair

Short route: one production module, no new UI or API contract.

Acceptance: parse both colon positions in bold criteria, numbered criteria,
emphasized scenario titles, bold section titles and nested context. Preserve
ordered content and existing heading formats. Unstructured exported descriptions
must exclude export metadata and comments. Missing criteria remain empty.

Restore DIS-476, DIS-477, DIS-483 and DIS-485 in the legacy board from the existing
story documents, preserving local IDs, lanes, sprint assignments and history.
The source is a local export, not a live Jira fetch. Personal references in the
DIS-477 context are anonymized during restoration. No comments or authors imported.

Validation: CP-01 through CP-03 failed before the fix and pass after it, alongside
the existing source reconciliation suite. Validate all four actual documents before
updating the board. No fabricated criteria or test scenarios.

Prototype skipped: no new visual element. Modeling skipped: short route.
Review: functionality, maintainability, regression coverage, security, performance
and documentation checked; accessibility unchanged. No blocking findings.
Commit/PR require user authorization and remain pending.
Coordination claim unavailable: legacy project has no initialized ledger.
