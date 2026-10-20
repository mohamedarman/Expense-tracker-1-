# Pennywise — Smart Student Expense Tracker

A production-quality full-stack personal finance and allowance management web application designed specifically for college students.

---

## 🎓 Highlights & Features

- **Daily Safe-to-Spend Velocity Meter**: Dynamically computes `(Remaining Monthly Budget) / (Days Left in Month)` to provide an actionable daily allowance.
- **Academic & Semester Budgeting**: Set term-length budgets with term end-date countdowns and configurable warning alerts (>80% and >100% exceeded).
- **Comprehensive Transaction Ledger**: Multi-filter search (by type, category, account, payment method, date range), sorting, pagination, and bulk delete.
- **Safe CSV Import & Export**: CSV importer with column mapping, format validation, and duplicate detection. UTF-8 BOM CSV exporter with spreadsheet formula injection protection.
- **Roommate & Group Bill Splitter**: Split shared bills (WiFi broadband, hostel room groceries, mess advance) with per-person settlement status.
- **Peer Debts & IOUs**: Track money lent to classmates ("Owes You") or borrowed ("You Owe") with target repayment dates and one-click settlement.
- **Recurring Subscriptions**: Manage fixed commitments (Hostel rent, mobile recharge packs, Spotify student, mess tokens) with next-due countdowns and one-click "Pay & Record".
- **Savings Goals**: Save for college laptops, academic books, certifications, and emergency funds with progress bars and deposit actions.
- **Essential vs. Discretionary Analytics**: Visual breakdown separating essentials (Mess, Hostel, Books, Health) from discretionary spending (Shopping, Outings).
- **Grounded AI Student Advisor**: Powered by Google Gemini with deterministic mathematical verification. Never hallucinates amounts.
- **Fintech UI/UX**: Deep navy and teal design system with light/dark theme switching, mobile drawer navigation, accessible contrast, and zero layout shift.

---

## 🛠️ Architecture

- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide Icons.
- **Backend**: Node.js & Express REST API (`server.ts`) with decimal monetary precision and strict user-data isolation.
- **Persistence**: File-backed ACID storage (`data/db.json`) with atomic write buffers and synchronous flush.
- **Security**: Node.js cryptographic scrypt password hashing with random salt, timing-safe verification, and signed session tokens.
- **Alternative / Preserved Backend**: Original Python 3 / Flask / SQLAlchemy backend preserved in `expense_work/` with automatic SQLite fallback.

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js** v20.x or higher
- **npm** v10.x or higher

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/mohamedarman/Expense-tracker-.git
cd Expense-tracker-

# Install dependencies
npm install

# Copy environment example
cp .env.example .env
```

### 3. Run the Development Server
```bash
npm run dev
```
Open **http://localhost:3000** in your browser.

### 4. Instant Demo Account
You can register a new account or click the one-click demo button on the login screen:
- **Email**: `demo@student.edu`
- **Password**: `StudentPass123!`

---

## 🧪 Automated Testing

Run the automated test suite testing cryptographic authentication, decimal monetary rounding, database user isolation, and financial assistant math:

```bash
npm test
```

To run typechecking and linting:
```bash
npm run lint
```

To build for production:
```bash
npm run build
```

---

## 📡 REST API Reference

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/health` | GET | Server health status, uptime, and version |
| `/api/auth/register` | POST | Register new student account |
| `/api/auth/login` | POST | Sign in and obtain session token |
| `/api/auth/me` | GET | Retrieve authenticated profile |
| `/api/auth/profile` | PUT | Update student degree, semester, or budget |
| `/api/transactions` | GET / POST | List filtered transactions or record new |
| `/api/transactions/:id` | PUT / DELETE | Update or delete transaction |
| `/api/transactions/bulk-delete` | POST | Safe bulk removal of selected records |
| `/api/transactions/export-csv` | GET | Download sanitized CSV ledger |
| `/api/transactions/import-csv` | POST | Bulk import CSV rows with duplicate detection |
| `/api/budgets` | GET / POST | Manage monthly and category limits |
| `/api/goals` | GET / POST | Manage savings goals and deposits |
| `/api/recurring` | GET / POST | Manage subscriptions and recurring schedules |
| `/api/splits` | GET / POST | Manage roommate bill splits |
| `/api/debts` | GET / POST | Manage peer IOUs and debts |
| `/api/analytics` | GET | Category distribution and 6-month cashflow |
| `/api/insights` | GET | Explainable data-driven spending insights |
| `/api/ai/ask` | POST | AI Student Advisor with deterministic ledger grounding |

---

## 🔒 Security Best Practices Implemented

1. **Strict User Isolation**: All database queries enforce user ownership checks. Users cannot view, modify, or delete another user's records.
2. **Formula Injection Sanitization**: All CSV cells starting with `=, +, -, @` are escaped with a leading single quote.
3. **No Secrets in Client Code**: All Gemini AI calls and database transactions are processed exclusively on the backend server.
4. **Timing-Safe Password Verification**: Scrypt derived keys are compared using `crypto.timingSafeEqual`.
5. **GDPR / Privacy Compliance**: Students can export their complete ledger in standard JSON format or permanently delete their account at any time.

---

## 🐍 Preserved Flask / Python Application

The original Python Flask project remains preserved in `expense_work/` with an automatic SQLite fallback:

```bash
cd expense_work
python3 -m venv .venv
source .venv/bin/activate # or .venv\Scripts\Activate.ps1 on Windows
pip install -r requirements.txt
python app.py
```
Open **http://127.0.0.1:5000**.
