# bills — Delta Spec

## ADDED Requirements

### Requirement: The pay transition has an inner helper for composability

The system SHALL refactor `payBill` in `src/features/bills/bill-service.ts` so that its body lives in a private `payBillInner(tx, billId, actorId)` helper that takes an externally-provided Prisma transaction client. The public `payBill` SHALL become a thin wrapper that opens a transaction and calls `payBillInner`. This mirrors the existing `submitBillInner` and `createBillInner` pattern and enables future composition (e.g., a hypothetical `createAndPayBill`) without nesting `$transaction` calls.

The refactor SHALL be behavior-preserving: `payBill`'s public signature, return value, error contract, and side effects (status update, confirmation generation, `paid` `BillEvent`) SHALL remain identical to today.

#### Scenario: The public payBill behaves identically after extraction

- **GIVEN** the refactor extracting `payBillInner` has been applied
- **WHEN** the existing tRPC `bill.pay` mutation is invoked on a `SCHEDULED` bill
- **THEN** the bill transitions to `PAID`
- **AND** `paymentConfirmation` matches `/^SETTLE-\d+-[A-Z0-9]{6}$/`
- **AND** a `paid` `BillEvent` is created
- **AND** the response shape and timing are observationally indistinguishable from the pre-refactor behavior
