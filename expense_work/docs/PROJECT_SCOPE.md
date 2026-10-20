# Project Scope

## Core modules
1. Authentication and user profile identity
2. Income and expense transaction CRUD
3. Default categories
4. Monthly overall and category budgets
5. Dashboard and charts
6. Monthly report and CSV export

## Main data rules
- Each transaction and budget belongs to one user.
- A transaction amount must be positive.
- Transaction type must match the selected category type.
- Budgets are positive and unique per user, month, and scope.
- Monetary amounts use SQL DECIMAL.

## Acceptance checklist
- A new user can register, sign in, and sign out.
- Users can add, edit, delete, and filter their own transactions.
- A user cannot access another user's records by changing an ID.
- Dashboard totals use saved database transactions.
- Monthly budget usage reflects current expenses.
- Reports filter by selected month.
- CSV export downloads the user's transactions only.
- The UI is responsive on desktop and mobile.
