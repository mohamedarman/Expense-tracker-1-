-- =========================================================================
-- Pennywise: Student Expense Tracker
-- Supabase / PostgreSQL Production Schema with Strict Row-Level Security (RLS)
-- Guarantees 100% User Isolation: Zero cross-account data leakage
-- =========================================================================

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Table (for Flask or Supabase Auth integration)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(150) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    currency VARCHAR(10) DEFAULT '₹',
    theme VARCHAR(10) DEFAULT 'dark',
    monthly_budget NUMERIC(12, 2) DEFAULT 15000.00,
    semester_budget NUMERIC(12, 2) DEFAULT 60000.00,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Categories Table (System defaults have user_id = NULL; custom categories belong to a user)
CREATE TABLE IF NOT EXISTS public.categories (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'cat_' || gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    name VARCHAR(60) NOT NULL,
    kind VARCHAR(10) NOT NULL CHECK (kind IN ('expense', 'income')),
    color VARCHAR(20) DEFAULT '#3b82f6',
    icon VARCHAR(30) DEFAULT 'Tag',
    is_essential BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT uq_category_owner_name_kind UNIQUE (user_id, name, kind)
);

-- 3. Transactions Table (Private to each user)
CREATE TABLE IF NOT EXISTS public.transactions (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'tx_' || gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    category_id VARCHAR(50) NOT NULL REFERENCES public.categories(id),
    category_name VARCHAR(60) NOT NULL,
    kind VARCHAR(10) NOT NULL CHECK (kind IN ('expense', 'income')),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method VARCHAR(30) DEFAULT 'UPI' NOT NULL,
    merchant VARCHAR(100) DEFAULT '',
    description VARCHAR(255) DEFAULT '',
    account VARCHAR(50) DEFAULT 'Primary Bank',
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 4. Budgets Table
CREATE TABLE IF NOT EXISTS public.budgets (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'bdg_' || gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    category_id VARCHAR(50) REFERENCES public.categories(id) ON DELETE CASCADE,
    period VARCHAR(20) DEFAULT 'monthly' NOT NULL,
    month VARCHAR(7) NOT NULL, -- Format: YYYY-MM
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    warning_threshold INT DEFAULT 80 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT uq_user_category_month UNIQUE (user_id, category_id, month)
);

-- 5. Savings Goals Table
CREATE TABLE IF NOT EXISTS public.savings_goals (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'gl_' || gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title VARCHAR(120) NOT NULL,
    target_amount NUMERIC(12, 2) NOT NULL CHECK (target_amount > 0),
    current_amount NUMERIC(12, 2) DEFAULT 0.00 NOT NULL CHECK (current_amount >= 0),
    target_date DATE NOT NULL,
    category VARCHAR(60) DEFAULT 'General',
    icon VARCHAR(30) DEFAULT 'Target',
    status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 6. Recurring Subscriptions & Bills Table
CREATE TABLE IF NOT EXISTS public.recurring_payments (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'rec_' || gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title VARCHAR(120) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    kind VARCHAR(10) DEFAULT 'expense' NOT NULL,
    frequency VARCHAR(20) DEFAULT 'monthly' NOT NULL,
    category_id VARCHAR(50) REFERENCES public.categories(id),
    payment_method VARCHAR(30) DEFAULT 'UPI',
    next_due_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    auto_log BOOLEAN DEFAULT FALSE,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 7. Split Expenses Table
CREATE TABLE IF NOT EXISTS public.split_expenses (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'spl_' || gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title VARCHAR(120) NOT NULL,
    total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0),
    user_share NUMERIC(12, 2) NOT NULL CHECK (user_share >= 0),
    paid_by VARCHAR(80) NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(20) DEFAULT 'pending',
    participants JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 8. Debts Table
CREATE TABLE IF NOT EXISTS public.debts (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'dbt_' || gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    person_name VARCHAR(100) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    type VARCHAR(20) NOT NULL CHECK (type IN ('owes_you', 'you_owe')),
    description VARCHAR(255) DEFAULT '',
    due_date DATE,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for lightning-fast queries per user
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions(user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_budgets_user_month ON public.budgets(user_id, month);
CREATE INDEX IF NOT EXISTS idx_goals_user ON public.savings_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_user ON public.recurring_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_splits_user ON public.split_expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_debts_user ON public.debts(user_id);

-- =========================================================================
-- STRICT ROW-LEVEL SECURITY (RLS) POLICIES
-- =========================================================================

-- Enable RLS on all user-owned tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.split_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;

-- Helper macro function to identify current authenticated owner
-- Compatible with Supabase Auth (auth.uid()) and custom Flask claims
CREATE OR REPLACE FUNCTION public.current_app_user()
RETURNS UUID AS $$
BEGIN
    RETURN COALESCE(
        NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID,
        auth.uid()
    );
EXCEPTION WHEN OTHERS THEN
    RETURN auth.uid();
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 1. Users RLS
CREATE POLICY "users_select_own" ON public.users
    FOR SELECT USING (id = public.current_app_user());

CREATE POLICY "users_update_own" ON public.users
    FOR UPDATE USING (id = public.current_app_user());

-- 2. Categories RLS (Global defaults readable by all; custom only by owner)
CREATE POLICY "categories_select" ON public.categories
    FOR SELECT USING (user_id IS NULL OR user_id = public.current_app_user());

CREATE POLICY "categories_insert" ON public.categories
    FOR INSERT WITH CHECK (user_id = public.current_app_user());

CREATE POLICY "categories_update" ON public.categories
    FOR UPDATE USING (user_id = public.current_app_user());

CREATE POLICY "categories_delete" ON public.categories
    FOR DELETE USING (user_id = public.current_app_user());

-- 3. Transactions RLS (100% strict user isolation)
CREATE POLICY "transactions_select_own" ON public.transactions
    FOR SELECT USING (user_id = public.current_app_user());

CREATE POLICY "transactions_insert_own" ON public.transactions
    FOR INSERT WITH CHECK (user_id = public.current_app_user());

CREATE POLICY "transactions_update_own" ON public.transactions
    FOR UPDATE USING (user_id = public.current_app_user());

CREATE POLICY "transactions_delete_own" ON public.transactions
    FOR DELETE USING (user_id = public.current_app_user());

-- 4. Budgets RLS
CREATE POLICY "budgets_select_own" ON public.budgets
    FOR SELECT USING (user_id = public.current_app_user());

CREATE POLICY "budgets_insert_own" ON public.budgets
    FOR INSERT WITH CHECK (user_id = public.current_app_user());

CREATE POLICY "budgets_update_own" ON public.budgets
    FOR UPDATE USING (user_id = public.current_app_user());

CREATE POLICY "budgets_delete_own" ON public.budgets
    FOR DELETE USING (user_id = public.current_app_user());

-- 5. Savings Goals RLS
CREATE POLICY "goals_select_own" ON public.savings_goals
    FOR SELECT USING (user_id = public.current_app_user());

CREATE POLICY "goals_insert_own" ON public.savings_goals
    FOR INSERT WITH CHECK (user_id = public.current_app_user());

CREATE POLICY "goals_update_own" ON public.savings_goals
    FOR UPDATE USING (user_id = public.current_app_user());

CREATE POLICY "goals_delete_own" ON public.savings_goals
    FOR DELETE USING (user_id = public.current_app_user());

-- 6. Recurring Subscriptions RLS
CREATE POLICY "recurring_select_own" ON public.recurring_payments
    FOR SELECT USING (user_id = public.current_app_user());

CREATE POLICY "recurring_insert_own" ON public.recurring_payments
    FOR INSERT WITH CHECK (user_id = public.current_app_user());

CREATE POLICY "recurring_update_own" ON public.recurring_payments
    FOR UPDATE USING (user_id = public.current_app_user());

CREATE POLICY "recurring_delete_own" ON public.recurring_payments
    FOR DELETE USING (user_id = public.current_app_user());

-- 7. Splits RLS
CREATE POLICY "splits_select_own" ON public.split_expenses
    FOR SELECT USING (user_id = public.current_app_user());

CREATE POLICY "splits_insert_own" ON public.split_expenses
    FOR INSERT WITH CHECK (user_id = public.current_app_user());

CREATE POLICY "splits_update_own" ON public.split_expenses
    FOR UPDATE USING (user_id = public.current_app_user());

CREATE POLICY "splits_delete_own" ON public.split_expenses
    FOR DELETE USING (user_id = public.current_app_user());

-- 8. Debts RLS
CREATE POLICY "debts_select_own" ON public.debts
    FOR SELECT USING (user_id = public.current_app_user());

CREATE POLICY "debts_insert_own" ON public.debts
    FOR INSERT WITH CHECK (user_id = public.current_app_user());

CREATE POLICY "debts_update_own" ON public.debts
    FOR UPDATE USING (user_id = public.current_app_user());

CREATE POLICY "debts_delete_own" ON public.debts
    FOR DELETE USING (user_id = public.current_app_user());

-- Default system categories seed (owned by NULL so all users have basic categories)
INSERT INTO public.categories (id, user_id, name, kind, color, icon, is_essential) VALUES
    ('cat-food', NULL, 'Food & Mess', 'expense', '#10b981', 'Utensils', TRUE),
    ('cat-hostel', NULL, 'Hostel & Rent', 'expense', '#06b6d4', 'Home', TRUE),
    ('cat-books', NULL, 'Books & Academics', 'expense', '#3b82f6', 'BookOpen', TRUE),
    ('cat-fees', NULL, 'College Fees', 'expense', '#6366f1', 'GraduationCap', TRUE),
    ('cat-transport', NULL, 'Transport & Commute', 'expense', '#8b5cf6', 'Bus', TRUE),
    ('cat-bills', NULL, 'Bills & Mobile Recharge', 'expense', '#ec4899', 'Smartphone', TRUE),
    ('cat-health', NULL, 'Health & Pharmacy', 'expense', '#14b8a6', 'HeartPulse', TRUE),
    ('cat-entertainment', NULL, 'Entertainment & Outings', 'expense', '#f59e0b', 'Film', FALSE),
    ('cat-shopping', NULL, 'Shopping & Gear', 'expense', '#f97316', 'ShoppingBag', FALSE),
    ('cat-personal', NULL, 'Personal Care', 'expense', '#eab308', 'Sparkles', FALSE),
    ('cat-other-exp', NULL, 'Other Expenses', 'expense', '#64748b', 'MoreHorizontal', FALSE),
    ('cat-allowance', NULL, 'Allowance / Pocket Money', 'income', '#10b981', 'Wallet', TRUE),
    ('cat-scholarship', NULL, 'Scholarship / Grant', 'income', '#06b6d4', 'Award', TRUE),
    ('cat-job', NULL, 'Part-time Job / Internship', 'income', '#3b82f6', 'Briefcase', TRUE),
    ('cat-freelance', NULL, 'Freelance / Tutoring', 'income', '#8b5cf6', 'Laptop', TRUE),
    ('cat-gift', NULL, 'Gifts & Awards', 'income', '#f59e0b', 'Gift', FALSE),
    ('cat-other-inc', NULL, 'Other Income', 'income', '#64748b', 'ArrowDownLeft', FALSE)
ON CONFLICT (id) DO NOTHING;
