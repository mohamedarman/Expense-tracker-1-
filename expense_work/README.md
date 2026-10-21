# CostCurve — Student Expense Tracker

A responsive student finance web app built with Flask, MySQL, SQLAlchemy, HTML, CSS, JavaScript, and Chart.js.

## Features

- User registration and login with hashed passwords
- User-specific transaction records
- Create, edit, delete, search, and filter income and expenses
- Default expense and income categories
- Overall and category-specific monthly budgets
- Budget usage indicators and exceeded-budget warnings
- Dashboard with monthly income/expense charts and category breakdown
- Monthly reports and CSV export
- Responsive desktop and mobile layout
- MySQL database configuration through environment variables

## Stack

- Python 3.10+
- Flask
- Flask-SQLAlchemy / SQLAlchemy
- MySQL 8+
- PyMySQL
- Chart.js (loaded from CDN)

## 1. Prerequisites

Install Python 3.10 or newer, MySQL Server, and (optionally) MySQL Workbench.

## 2. Create the database and database user

Sign in to MySQL as an administrator and run the commands in `database/schema.sql`. Choose a strong password for the dedicated `expense_user`.

## 3. Configure environment

### Windows PowerShell

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

### macOS/Linux

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Edit `.env` and set `DATABASE_URL` to your own MySQL username/password and database. Generate a strong `SECRET_KEY` with `python -c "import secrets; print(secrets.token_hex(32))"`; do not commit `.env`.

Example:

```env
SECRET_KEY=replace-with-a-long-random-secret
DATABASE_URL=mysql+pymysql://expense_user:YOUR_PASSWORD@localhost/student_expense_tracker?charset=utf8mb4
FLASK_DEBUG=true
COOKIE_SECURE=false
```

If the database password contains URL-reserved characters, URL-encode them in `DATABASE_URL`.

## 4. Initialize and run

The app creates its tables and seeds default categories when run locally. You can also initialize using Flask CLI:

```bash
flask --app app init-db
flask --app app run --debug
```

Or:

```bash
python app.py
```

Open http://127.0.0.1:5000.

## Run automated tests

Install the dependencies, then run `pytest -q`. The tests use an isolated in-memory SQLite database, so they do not require a running MySQL server. GitHub Actions runs these tests on pushes to `main` and pull requests.

## Main routes

- `/register` — create account
- `/login` — sign in
- `/dashboard` — dashboard
- `/transactions` — transactions and filters
- `/transactions/add` — add transaction
- `/budgets` — budget setup and progress
- `/reports` — monthly reports
- `/reports/export.csv` — download CSV
- `/health` — health check

## Security and production notes

This is a student project foundation, not a claim of a completed production security audit. Before public deployment:
- Set a unique random `SECRET_KEY`.
- Set `COOKIE_SECURE=true` behind HTTPS.
- CSRF protection is enabled for POST requests using Flask-WTF.
- Add login rate limiting and email verification/password recovery if required.
- Use a least-privilege database account.
- Configure HTTPS, secure environment variables, backups, logging, and monitoring.
- Run automated tests and a security review before using real financial data.

## GitHub

Do not commit `.env`, passwords, database dumps with personal data, or tokens. Review the existing repository before copying these files into it, then commit on a feature branch and open a pull request.
