# Prototype: Supplier registration

Prototype: design/prototypes/supplier-registration/ (link in the artifact)

## Screens
1. Supplier list - table, status filter, "New supplier" button.
2. Supplier form - name, tax id, contact, active switch.

## Mocks
Mock data follows the API contract in 04-modelagem.md: fields `id`, `name`, `tax_id`, `active`, `contact.email`, `contact.phone`. No field exists only in the mock.

## States
Empty list, loading, validation error, duplicate tax id (shows the existing supplier), forbidden.

## Components
Only design-system components: table, form field, switch, toast. Accessibility reviewed against WCAG 2.1 AA.
