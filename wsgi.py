"""
WSGI Entry Point for Python Flask Deployment.
Supports Gunicorn, uWSGI, Render, Railway, Heroku, and container runtimes.
"""
import sys
import os

EXPENSE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "expense_work")
if EXPENSE_DIR not in sys.path:
    sys.path.insert(0, EXPENSE_DIR)

from app import app, db, seed_categories

with app.app_context():
    try:
        db.create_all()
        seed_categories()
    except Exception as e:
        app.logger.warning(f"Startup DB init notice: {e}")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    host = os.environ.get("HOST", "0.0.0.0")
    debug = os.environ.get("FLASK_DEBUG", "false").lower() == "true"
    app.run(host=host, port=port, debug=debug)
