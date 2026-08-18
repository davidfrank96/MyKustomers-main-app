# Validation

Shared Zod schemas belong here only when multiple domains depend on the same
contract. External input must be validated at server boundaries before business
logic executes.
