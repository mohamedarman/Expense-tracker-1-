import os
import sys

# Ensure expense_work directory is always in sys.path for test execution
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
EXPENSE_WORK_DIR = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
ROOT_DIR = os.path.abspath(os.path.join(EXPENSE_WORK_DIR, ".."))

for p in [EXPENSE_WORK_DIR, ROOT_DIR]:
    if p not in sys.path:
        sys.path.insert(0, p)

os.environ.setdefault("SECRET_KEY", "test-secret-key-that-is-long-enough-for-tests")
os.environ.setdefault("FLASK_DEBUG", "false")

import pytest
from app import app, db, User, Category, Transaction, Budget, seed_categories


@pytest.fixture()
def client():
    app.config.update(
        TESTING=True,
        WTF_CSRF_ENABLED=False,
        SQLALCHEMY_DATABASE_URI="sqlite:///:memory:",
        SECRET_KEY="test-secret-key-that-is-long-enough-for-tests",
    )
    with app.app_context():
        db.drop_all()
        db.create_all()
        seed_categories()
        yield app.test_client()
        db.session.remove()
        db.drop_all()


def register(client, email="student@example.com"):
    return client.post("/register", data={
        "name": "Test Student",
        "email": email,
        "password": "safe-password-123",
        "confirm_password": "safe-password-123",
    }, follow_redirects=True)


def test_health_endpoint(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.get_json() == {"status": "ok"}


def test_registration_login_and_logout(client):
    response = register(client)
    assert response.status_code == 200
    assert b"Your account is ready" in response.data
    with client.session_transaction() as session:
        assert session.get("user_id") is not None
    client.post("/logout", follow_redirects=True)
    with client.session_transaction() as session:
        assert session.get("user_id") is None
    response = client.post("/login", data={
        "email": "student@example.com", "password": "safe-password-123"
    }, follow_redirects=True)
    assert response.status_code == 200
    with client.session_transaction() as session:
        assert session.get("user_id") is not None
    assert (
        b"signed in" in response.data.lower()
        or b"overview" in response.data.lower()
        or b"workspace" in response.data.lower()
    )


def test_rejects_mismatched_passwords(client):
    response = client.post("/register", data={
        "name": "Test Student", "email": "mismatch@example.com",
        "password": "safe-password-123", "confirm_password": "different-password",
    }, follow_redirects=True)
    assert b"Passwords do not match" in response.data
    with app.app_context():
        assert User.query.filter_by(email="mismatch@example.com").first() is None


def test_transaction_budget_and_report_flow(client):
    register(client)
    with app.app_context():
        expense_category = Category.query.filter_by(name="Food", kind="expense", user_id=None).first()
        category_id = expense_category.id
    response = client.post("/transactions/add", data={
        "kind": "expense", "category_id": str(category_id), "amount": "125.50",
        "transaction_date": "2026-10-10", "payment_method": "UPI", "description": "Lunch",
    }, follow_redirects=True)
    assert response.status_code == 200
    assert b"Transaction saved successfully" in response.data
    response = client.post("/budgets", data={
        "month": "2026-10", "category_id": "", "amount": "1000.00",
    }, follow_redirects=True)
    assert response.status_code == 200
    assert b"Budget saved" in response.data
    response = client.get("/reports?month=2026-10")
    assert response.status_code == 200
    assert b"125.50" in response.data
    response = client.get("/reports/export.csv")
    assert response.status_code == 200
    assert response.mimetype == "text/csv"
    assert b"Lunch" in response.data


def test_user_cannot_access_another_users_transaction(client):
    register(client, "first@example.com")
    with app.app_context():
        category = Category.query.filter_by(name="Food", kind="expense", user_id=None).first()
        first_user = User.query.filter_by(email="first@example.com").first()
        item = Transaction(user_id=first_user.id, category_id=category.id, kind="expense", amount="10.00", description="private")
        db.session.add(item)
        db.session.commit()
        transaction_id = item.id
    client.post("/logout", follow_redirects=True)
    register(client, "second@example.com")
    response = client.get(f"/transactions/{transaction_id}/edit", follow_redirects=True)
    assert b"Transaction not found" in response.data


def test_new_user_has_zero_records_and_clean_dashboard(client):
    register(client, "brandnew@example.com")
    response = client.get("/dashboard")
    assert response.status_code == 200
    assert b"0.00" in response.data
    assert b"clean slate" in response.data.lower() or b"no spending data" in response.data.lower()
    tx_page = client.get("/transactions")
    assert tx_page.status_code == 200
    assert b"No transactions found" in tx_page.data or b"Add your first transaction" in tx_page.data

