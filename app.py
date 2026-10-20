"""
Root Flask Application Entry Point.
Exports Flask `app` for PaaS hosting platforms (Render, Railway, Heroku, Docker).
"""
import sys
import os

EXPENSE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "expense_work")
if EXPENSE_DIR not in sys.path:
    sys.path.insert(0, EXPENSE_DIR)

from app import app, db, seed_categories  # noqa: F401

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
