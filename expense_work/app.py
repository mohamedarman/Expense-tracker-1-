import os
import csv
import io
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
import secrets
from functools import wraps

from flask import Flask, render_template, request, redirect, url_for, flash, session, make_response
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from sqlalchemy import func
from flask_wtf.csrf import CSRFProtect
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
secret_key = os.getenv("SECRET_KEY")
if not secret_key:
    secret_key = secrets.token_hex(32)
    app.logger.warning("SECRET_KEY was not explicitly provided in environment. A secure runtime token was generated.")
app.config["SECRET_KEY"] = secret_key

raw_db_url = os.getenv("DATABASE_URL")
if raw_db_url:
    # Standardize legacy/cloud prefixes (e.g. postgres:// or mysql://)
    if raw_db_url.startswith("postgres://"):
        raw_db_url = raw_db_url.replace("postgres://", "postgresql://", 1)
    elif raw_db_url.startswith("mysql://") and not raw_db_url.startswith("mysql+pymysql://"):
        raw_db_url = raw_db_url.replace("mysql://", "mysql+pymysql://", 1)
    db_uri = raw_db_url
else:
    default_db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "student_expense.db")
    db_uri = f"sqlite:///{default_db_path}"

app.config["SQLALCHEMY_DATABASE_URI"] = db_uri
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_SECURE"] = os.getenv("COOKIE_SECURE", "false").lower() == "true"
db = SQLAlchemy(app)
csrf = CSRFProtect(app)

DEFAULT_CATEGORIES = [
    ("Food", "expense"), ("Transport", "expense"), ("Education", "expense"),
    ("Shopping", "expense"), ("Entertainment", "expense"), ("Health", "expense"),
    ("Hostel & Rent", "expense"), ("Bills", "expense"), ("Personal Care", "expense"),
    ("Other", "expense"), ("Allowance", "income"), ("Scholarship", "income"),
    ("Part-time Job", "income"), ("Gift", "income"), ("Other Income", "income")
]

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    transactions = db.relationship("Transaction", backref="owner", cascade="all, delete-orphan")
    budgets = db.relationship("Budget", backref="owner", cascade="all, delete-orphan")

class Category(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id", ondelete="CASCADE"), nullable=True, index=True)
    name = db.Column(db.String(60), nullable=False)
    kind = db.Column(db.String(10), nullable=False, default="expense")
    __table_args__ = (db.UniqueConstraint("user_id", "name", "kind", name="uq_category_owner_name_kind"),)

class Transaction(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True)
    category_id = db.Column(db.Integer, db.ForeignKey("category.id"), nullable=False)
    kind = db.Column(db.String(10), nullable=False)
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    transaction_date = db.Column(db.Date, nullable=False, default=date.today, index=True)
    payment_method = db.Column(db.String(30), nullable=False, default="UPI")
    description = db.Column(db.String(255), nullable=False, default="")
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    category = db.relationship("Category")

class Budget(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True)
    category_id = db.Column(db.Integer, db.ForeignKey("category.id"), nullable=True)
    month = db.Column(db.Date, nullable=False)
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    category = db.relationship("Category")
    __table_args__ = (db.UniqueConstraint("user_id", "category_id", "month", name="uq_budget_scope_month"),)

def current_user():
    uid = session.get("user_id")
    return db.session.get(User, uid) if uid else None

def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if not current_user():
            flash("Please sign in to continue.", "info")
            return redirect(url_for("login"))
        return view(*args, **kwargs)
    return wrapped

def money(value):
    try:
        amount = Decimal(str(value))
        return amount if amount.is_finite() else Decimal("0.00")
    except (InvalidOperation, TypeError, ValueError):
        return Decimal("0.00")

def month_start(value=None):
    value = value or date.today()
    return value.replace(day=1)

def month_end(value=None):
    value = value or date.today()
    if value.month == 12:
        return date(value.year + 1, 1, 1)
    return date(value.year, value.month + 1, 1)

def user_categories(user, kind=None):
    q = Category.query.filter((Category.user_id == None) | (Category.user_id == user.id))
    if kind:
        q = q.filter_by(kind=kind)
    return q.order_by(Category.name.asc()).all()

def seed_categories():
    for name, kind in DEFAULT_CATEGORIES:
        exists = Category.query.filter_by(user_id=None, name=name, kind=kind).first()
        if not exists:
            db.session.add(Category(user_id=None, name=name, kind=kind))
    db.session.commit()

def month_totals(user, start=None, end=None):
    start = start or month_start()
    end = end or month_end()
    rows = db.session.query(Transaction.kind, func.coalesce(func.sum(Transaction.amount), 0)).filter(
        Transaction.user_id == user.id,
        Transaction.transaction_date >= start,
        Transaction.transaction_date < end
    ).group_by(Transaction.kind).all()
    totals = {"income": Decimal("0"), "expense": Decimal("0")}
    for kind, amount in rows:
        totals[kind] = Decimal(str(amount or 0))
    return totals

@app.context_processor
def inject_globals():
    return {"current_user": current_user(), "today": date.today(), "current_hour": datetime.now().hour}

@app.route("/")
def index():
    return redirect(url_for("dashboard")) if current_user() else redirect(url_for("login"))

@app.route("/register", methods=["GET", "POST"])
def register():
    if current_user():
        return redirect(url_for("dashboard"))
    if request.method == "POST":
        name = request.form.get("name", "").strip()
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")
        confirm = request.form.get("confirm_password", "")
        if not name or len(name) > 100 or not email or len(email) > 150:
            flash("Enter your name and a valid email address.", "error")
        elif len(password) < 8:
            flash("Use a password with at least 8 characters.", "error")
        elif password != confirm:
            flash("Passwords do not match.", "error")
        elif User.query.filter_by(email=email).first():
            flash("An account with this email already exists.", "error")
        else:
            user = User(name=name, email=email, password_hash=generate_password_hash(password))
            db.session.add(user)
            db.session.flush()
            db.session.commit()
            session.clear()
            session["user_id"] = user.id
            flash("Welcome to CostCurve. Your account is ready!", "success")
            return redirect(url_for("dashboard"))
    return render_template("register.html")

@app.route("/login", methods=["GET", "POST"])
def login():
    if current_user():
        return redirect(url_for("dashboard"))
    if request.method == "POST":
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")
        user = User.query.filter_by(email=email).first()
        if user and check_password_hash(user.password_hash, password):
            session.clear()
            session["user_id"] = user.id
            flash("You're signed in.", "success")
            return redirect(url_for("dashboard"))
        flash("Email or password is incorrect.", "error")
    return render_template("login.html")

@app.route("/logout", methods=["POST"])
def logout():
    session.clear()
    flash("You have been signed out.", "info")
    return redirect(url_for("login"))

@app.route("/dashboard")
@login_required
def dashboard():
    user = current_user()
    start, end = month_start(), month_end()
    totals = month_totals(user, start, end)
    budget = Budget.query.filter_by(user_id=user.id, month=start, category_id=None).first()
    spent = totals["expense"]
    budget_amount = Decimal(str(budget.amount)) if budget else Decimal("0")
    remaining = budget_amount - spent
    usage = min(100, int((spent / budget_amount * 100) if budget_amount else 0))
    recent = Transaction.query.filter_by(user_id=user.id).order_by(
        Transaction.transaction_date.desc(), Transaction.id.desc()).limit(6).all()
    category_rows_raw = db.session.query(Category.name, func.sum(Transaction.amount)).join(
        Transaction, Transaction.category_id == Category.id).filter(
        Transaction.user_id == user.id, Transaction.kind == "expense",
        Transaction.transaction_date >= start, Transaction.transaction_date < end
    ).group_by(Category.name).order_by(func.sum(Transaction.amount).desc()).all()
    category_rows = [(name, float(amount or 0)) for name, amount in category_rows_raw]
    monthly_rows = []
    for offset in range(5, -1, -1):
        year, month = start.year, start.month - offset
        while month <= 0:
            month += 12
            year -= 1
        mstart = date(year, month, 1)
        mend = date(year + (month == 12), 1 if month == 12 else month + 1, 1)
        mt = month_totals(user, mstart, mend)
        monthly_rows.append({"label": mstart.strftime("%b"), "expense": float(mt["expense"]), "income": float(mt["income"])})
    return render_template("dashboard.html", totals=totals, budget=budget, spent=spent,
        budget_amount=budget_amount, remaining=remaining, usage=usage, recent=recent,
        category_rows=category_rows, monthly_rows=monthly_rows)

@app.route("/transactions")
@login_required
def transactions():
    user = current_user()
    q = Transaction.query.filter_by(user_id=user.id)
    search = request.args.get("q", "").strip()
    kind = request.args.get("kind", "")
    category_id = request.args.get("category", type=int)
    start_date = request.args.get("start", "")
    end_date = request.args.get("end", "")
    if search:
        q = q.filter(Transaction.description.ilike(f"%{search}%"))
    if kind in ("expense", "income"):
        q = q.filter_by(kind=kind)
    if category_id:
        q = q.filter_by(category_id=category_id)
    try:
        if start_date:
            q = q.filter(Transaction.transaction_date >= date.fromisoformat(start_date))
        if end_date:
            q = q.filter(Transaction.transaction_date <= date.fromisoformat(end_date))
    except ValueError:
        flash("A date filter was invalid and has been ignored.", "error")
    items = q.order_by(Transaction.transaction_date.desc(), Transaction.id.desc()).all()
    return render_template("transactions.html", items=items, categories=user_categories(user), filters=request.args)

@app.route("/transactions/add", methods=["GET", "POST"])
@app.route("/transactions/<int:transaction_id>/edit", methods=["GET", "POST"])
@login_required
def transaction_form(transaction_id=None):
    user = current_user()
    item = Transaction.query.filter_by(id=transaction_id, user_id=user.id).first() if transaction_id else None
    if transaction_id and not item:
        flash("Transaction not found.", "error")
        return redirect(url_for("transactions"))
    if request.method == "POST":
        kind = request.form.get("kind", "expense")
        category_id = request.form.get("category_id", type=int)
        amount = money(request.form.get("amount"))
        try:
            trans_date = date.fromisoformat(request.form.get("transaction_date", ""))
        except ValueError:
            trans_date = None
        category = Category.query.filter(Category.id == category_id,
            (Category.user_id == None) | (Category.user_id == user.id)).first()
        description = request.form.get("description", "").strip()
        payment = request.form.get("payment_method", "UPI")
        if kind not in ("expense", "income") or not category or category.kind != kind:
            flash("Choose a valid category for the selected transaction type.", "error")
        elif amount <= 0 or amount > Decimal("99999999.99"):
            flash("Enter an amount greater than zero.", "error")
        elif not trans_date:
            flash("Choose a valid transaction date.", "error")
        elif len(description) > 255:
            flash("Description must be 255 characters or fewer.", "error")
        else:
            if not item:
                item = Transaction(user_id=user.id)
                db.session.add(item)
            item.kind = kind
            item.category_id = category.id
            item.amount = amount
            item.transaction_date = trans_date
            item.payment_method = payment if payment in ["Cash", "UPI", "Card", "Bank transfer", "Other"] else "Other"
            item.description = description
            db.session.commit()
            flash("Transaction saved successfully.", "success")
            return redirect(url_for("transactions"))
    return render_template("transaction_form.html", item=item, categories=user_categories(user))

@app.route("/transactions/<int:transaction_id>/delete", methods=["POST"])
@login_required
def transaction_delete(transaction_id):
    item = Transaction.query.filter_by(id=transaction_id, user_id=current_user().id).first()
    if item:
        db.session.delete(item)
        db.session.commit()
        flash("Transaction deleted.", "success")
    else:
        flash("Transaction not found.", "error")
    return redirect(url_for("transactions"))

@app.route("/budgets", methods=["GET", "POST"])
@login_required
def budgets():
    user = current_user()
    if request.method == "POST":
        category_raw = request.form.get("category_id", "")
        category_id = int(category_raw) if category_raw.isdigit() else None
        amount = money(request.form.get("amount"))
        try:
            selected = date.fromisoformat(request.form.get("month", "") + "-01")
        except ValueError:
            selected = None
        category = Category.query.filter(Category.id == category_id,
            (Category.user_id == None) | (Category.user_id == user.id)).first() if category_id else None
        if amount <= 0:
            flash("Budget amount must be greater than zero.", "error")
        elif not selected:
            flash("Choose a valid budget month.", "error")
        elif category_id and (not category or category.kind != "expense"):
            flash("Choose a valid expense category.", "error")
        else:
            selected = month_start(selected)
            existing = Budget.query.filter_by(user_id=user.id, category_id=category_id, month=selected).first()
            if existing:
                existing.amount = amount
            else:
                db.session.add(Budget(user_id=user.id, category_id=category_id, month=selected, amount=amount))
            db.session.commit()
            flash("Budget saved.", "success")
            return redirect(url_for("budgets"))
    selected_month = request.args.get("month", date.today().strftime("%Y-%m"))
    try:
        selected_start = date.fromisoformat(selected_month + "-01")
    except ValueError:
        selected_start = month_start()
        selected_month = selected_start.strftime("%Y-%m")
    selected_end = month_end(selected_start)
    budget_items = Budget.query.filter_by(user_id=user.id, month=selected_start).all()
    spent_by_category = dict(db.session.query(Transaction.category_id, func.sum(Transaction.amount)).filter(
        Transaction.user_id == user.id, Transaction.kind == "expense",
        Transaction.transaction_date >= selected_start, Transaction.transaction_date < selected_end
    ).group_by(Transaction.category_id).all())
    total_spent = month_totals(user, selected_start, selected_end)["expense"]
    overall = next((b for b in budget_items if b.category_id is None), None)
    return render_template("budgets.html", budget_items=budget_items, categories=user_categories(user, "expense"),
        selected_month=selected_month, spent_by_category=spent_by_category, total_spent=total_spent, overall=overall)

@app.route("/budgets/<int:budget_id>/delete", methods=["POST"])
@login_required
def budget_delete(budget_id):
    item = Budget.query.filter_by(id=budget_id, user_id=current_user().id).first()
    if item:
        db.session.delete(item)
        db.session.commit()
        flash("Budget removed.", "success")
    return redirect(url_for("budgets"))

@app.route("/reports")
@login_required
def reports():
    user = current_user()
    selected = request.args.get("month", date.today().strftime("%Y-%m"))
    try:
        start = date.fromisoformat(selected + "-01")
    except ValueError:
        start = month_start()
        selected = start.strftime("%Y-%m")
    end = month_end(start)
    totals = month_totals(user, start, end)
    categories = db.session.query(Category.name, func.sum(Transaction.amount)).join(
        Transaction, Transaction.category_id == Category.id).filter(
        Transaction.user_id == user.id, Transaction.kind == "expense",
        Transaction.transaction_date >= start, Transaction.transaction_date < end
    ).group_by(Category.name).order_by(func.sum(Transaction.amount).desc()).all()
    return render_template("reports.html", selected_month=selected, totals=totals, categories=categories)

@app.route("/reports/export.csv")
@login_required
def export_csv():
    user = current_user()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Date", "Type", "Category", "Amount (INR)", "Payment method", "Description"])
    items = Transaction.query.filter_by(user_id=user.id).order_by(Transaction.transaction_date.desc()).all()
    for item in items:
        writer.writerow([item.transaction_date.isoformat(), item.kind, item.category.name, str(item.amount), item.payment_method, item.description])
    # Prevent spreadsheet formula execution from user-controlled CSV fields.
    def safe_cell(value):
        text = "" if value is None else str(value)
        if text.lstrip().startswith(("=", "+", "-", "@")):
            return "'" + text
        return text
    safe_output = io.StringIO()
    safe_writer = csv.writer(safe_output)
    for row in csv.reader(io.StringIO(output.getvalue())):
        safe_writer.writerow([safe_cell(cell) for cell in row])
    response = make_response("\ufeff" + safe_output.getvalue())
    response.headers["Content-Type"] = "text/csv; charset=utf-8"
    response.headers["Content-Disposition"] = "attachment; filename=student-expenses.csv"
    return response

@app.route("/health")
def health():
    return {"status": "ok"}, 200

@app.cli.command("init-db")
def init_db():
    """Create tables and seed default categories."""
    db.create_all()
    seed_categories()
    print("Database tables created and default categories seeded.")

@app.cli.command("seed-categories")
def seed_categories_command():
    seed_categories()
    print("Default categories seeded.")

_tables_initialized = False

@app.before_request
def auto_init_tables():
    global _tables_initialized
    if not _tables_initialized:
        try:
            db.create_all()
            seed_categories()
            _tables_initialized = True
        except Exception as e:
            app.logger.warning(f"Auto-init tables notice: {e}")

@app.errorhandler(404)
def not_found(e):
    return render_template("base.html"), 404

@app.errorhandler(500)
def server_error(e):
    return render_template("base.html"), 500

if __name__ == "__main__":
    with app.app_context():
        db.create_all()
        seed_categories()
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 5000))
    debug = os.getenv("FLASK_DEBUG", "false").lower() == "true"
    app.run(host=host, port=port, debug=debug)
