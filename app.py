"""
Root Flask Application Entry Point.
Exports Flask `app` for PaaS hosting platforms (Render, Railway, Heroku, Docker).
"""
import sys
import os

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
EXPENSE_DIR = os.path.join(ROOT_DIR, "expense_work")

if EXPENSE_DIR not in sys.path:
    sys.path.insert(0, EXPENSE_DIR)

# Import directly from expense_work to prevent self-referencing circular import
try:
    from expense_work.app import app, db, User, Category, Transaction, Budget, seed_categories  # noqa: F401
except ImportError:
    import importlib.util
    spec = importlib.util.spec_from_file_location("expense_work_pkg_app", os.path.join(EXPENSE_DIR, "app.py"))
    _mod = importlib.util.module_from_spec(spec)
    sys.modules["expense_work_pkg_app"] = _mod
    spec.loader.exec_module(_mod)
    app = _mod.app
    db = _mod.db
    User = _mod.User
    Category = _mod.Category
    Transaction = _mod.Transaction
    Budget = _mod.Budget
    seed_categories = _mod.seed_categories

if __name__ == "__main__":
    with app.app_context():
        try:
            db.create_all()
            seed_categories()
        except Exception as e:
            app.logger.warning(f"Startup DB init notice: {e}")
    port = int(os.environ.get("PORT", 5000))
    host = os.environ.get("HOST", "0.0.0.0")
    debug = os.environ.get("FLASK_DEBUG", "false").lower() == "true"
    app.run(host=host, port=port, debug=debug)
