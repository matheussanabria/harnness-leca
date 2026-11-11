# Tests: Supplier registration

| BDD scenario | Test | Result |
|---|---|---|
| Register a valid supplier | SupplierApiTest.createsSupplier | pass |
| Duplicate tax id | SupplierApiTest.rejectsDuplicateTaxId | pass |
| Missing permission | SupplierApiTest.forbidsWithoutPermission | pass |

## Evidence
Postman: doc/postman/supplier-registration/ (3 requests, status and schema checks).

## Gaps
- Foreign supplier rule has no scenario yet (open question in _status.md).
