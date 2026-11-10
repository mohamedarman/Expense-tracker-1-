# CostCurve — Zero-Trust Security Specification (`security_spec.md`)

## 1. Data Invariants

1. **Default-Deny Catch-All**: Any path not explicitly matched is unconditionally denied (`allow read, write: if false;`).
2. **Strict Ownership (`userId == request.auth.uid`)**: Every financial record (`transactions`, `categories`, `budgets`, `savingsGoals`, `recurringPayments`, `splitExpenses`, `debts`) must have an immutable `userId` matching `request.auth.uid` on creation and verified against `exists(/databases/$(database)/documents/users/$(incoming().userId))`.
3. **Private Financial Isolation**: Normal users and even platform admins cannot read another user's private financial collections via blanket queries. Every `get` and `list` rule on financial collections strictly enforces `resource.data.userId == request.auth.uid`.
4. **PII Isolation on `/users/{userId}`**: User profiles contain PII (`email`, `name`, `collegeName`). Reading `/users/{userId}` is strictly limited to `isOwner(userId) || isAdmin()`.
5. **No Self-Assigned Admin Privileges**: Users cannot grant themselves admin privileges. `/users/{userId}` must be created with `status == 'active'` and contains no user-editable role field. Admin status is determined exclusively by the verified owner email (`mohamedarman536@gmail.com` with `email_verified == true`) or existence in `/admins/$(request.auth.uid)`, which only an existing `isAdmin()` can write.
6. **Temporal Integrity**: Every `create` operation enforces `incoming().createdAt == request.time && incoming().updatedAt == request.time`. Every `update` operation enforces `incoming().createdAt == existing().createdAt && incoming().updatedAt == request.time`.
7. **Terminal State Locking**: Once a `SavingsGoal` reaches `status == 'completed'`, a `RecurringPayment` reaches `status == 'cancelled'`, a `SplitExpense` reaches `status == 'settled'`, or a `DebtRecord` reaches `status == 'settled'`, further client updates are blocked unless overridden by `isAdmin()`.

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Payload 1 (Identity Spoofing on Transaction Create)**: Authenticated User A (`uid_alice`) attempts to create `/transactions/tx_1` with `userId: "uid_bob"`. -> `PERMISSION_DENIED`
2. **Payload 2 (Cross-User Private Transaction Read)**: Authenticated User A (`uid_alice`) attempts to `get` or `list` `/transactions/tx_bob_1` owned by `uid_bob`. -> `PERMISSION_DENIED`
3. **Payload 3 (Self-Assigned Admin Escalation)**: Authenticated User A (`uid_alice`) attempts to create `/admins/uid_alice` to grant themselves admin rights. -> `PERMISSION_DENIED`
4. **Payload 4 (Unverified Owner Email Spoof)**: Attacker with `email: "mohamedarman536@gmail.com"` but `email_verified: false` attempts to list `/users` or write `/admins`. -> `PERMISSION_DENIED`
5. **Payload 5 (Shadow Field Injection on Profile Update)**: User A sends valid profile fields plus an undeclared `"isAdmin": true` ghost key to `/users/uid_alice`. -> `PERMISSION_DENIED`
6. **Payload 6 (Self-Status Tampering on User Profile)**: Suspended User A attempts to update `status` from `"suspended"` back to `"active"` on `/users/uid_alice`. -> `PERMISSION_DENIED`
7. **Payload 7 (PII Blanket Read on `/users/{userId}`)**: Authenticated User A (`uid_alice`) attempts to `get` `/users/uid_bob`. -> `PERMISSION_DENIED`
8. **Payload 8 (Orphaned Transaction Create Without User Profile)**: Authenticated user `uid_ghost` (who has no `/users/uid_ghost` document) attempts to create `/transactions/tx_orphan`. -> `PERMISSION_DENIED`
9. **Payload 9 (Immortal Field Mutation on Update)**: User A attempts to update `createdAt` or `userId` on an existing `/transactions/tx_1` document. -> `PERMISSION_DENIED`
10. **Payload 10 (Value / Size Poisoning)**: User A attempts to update `description` on `/transactions/tx_1` with a 5,000-character string (exceeding `maxLength: 200`) or negative `amount`. -> `PERMISSION_DENIED`
11. **Payload 11 (Terminal State Reversal)**: User A attempts to mutate a `DebtRecord` whose `existing().status == 'settled'` without admin override. -> `PERMISSION_DENIED`
12. **Payload 12 (ID Poisoning Attack)**: User A attempts to create a document with path ID `bad$id/with spaces!` violating `^[a-zA-Z0-9_\-]+$`. -> `PERMISSION_DENIED`
