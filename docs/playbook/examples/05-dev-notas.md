# Dev notes: Supplier registration

## Done
- Entity, repository and POST/PATCH/GET endpoints per the contract.
- List and form screens, wired to the API; the mocks were removed.

## Decisions
- Duplicate tax id returns 409 with the existing supplier body; the form renders it.

## Layer map
`mapa-camadas.json` updated: 9 fields implemented, 0 mock, 0 diverging.

## Checks
Build compiles. Lint clean.
