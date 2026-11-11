# Story: Register a supplier

As a purchasing analyst, I want to register a supplier with its tax id and contact, so that I can issue purchase orders to it.

## Acceptance criteria
1. A supplier needs a name and a valid tax id; the form blocks saving otherwise.
2. A tax id already registered shows the existing supplier instead of creating a duplicate.
3. A deactivated supplier no longer appears in the purchase order picker.
4. Only users with the "purchasing" permission can create or edit suppliers.

## Business rules
- Tax id is unique per company.
- Deactivation is reversible; deletion is not offered.

## Definition of ready
- [x] Criteria are verifiable
- [x] Permission rule named
- [ ] Foreign supplier rule (open)
