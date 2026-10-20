CREATE DATABASE IF NOT EXISTS student_expense_tracker
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- Create a dedicated database user locally and grant access only to this database.
-- Example (run as a MySQL administrator; choose your own password):
-- CREATE USER 'expense_user'@'localhost' IDENTIFIED BY 'replace_with_a_strong_password';
-- GRANT ALL PRIVILEGES ON student_expense_tracker.* TO 'expense_user'@'localhost';
-- FLUSH PRIVILEGES;
-- Tables are created by Flask-SQLAlchemy when you run the app or `flask --app app init-db`.
