# Deploy: Supplier registration

## Release
Version 1.8.0, migration `V12__create_supplier.sql` (additive, no downtime).

## Runbook
1. Run the migration.
2. Deploy the API.
3. Deploy the web app.
4. Smoke test: create and list a supplier.

## Rollback
Revert the web app and API; the table stays (additive migration).

## Validation
Pipeline green. Smoke test passed in the target environment. Confirmed by the user before running.
