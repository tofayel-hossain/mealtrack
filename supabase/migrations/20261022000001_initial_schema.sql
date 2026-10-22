-- ==============================================================================
-- MEALTRACK: PRODUCTION POSTGRESQL DATABASE SCHEMA & MIGRATIONS
-- ==============================================================================

-- 1. EXTENSIONS & SETUP
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. CORE TABLES
-- ==============================================================================

-- 2.1 Profiles (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.2 Meal Systems (Multi-tenant groups: Mess / Flat / Hostel)
CREATE TABLE IF NOT EXISTS public.meal_systems (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    description TEXT,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.3 System Settings
CREATE TABLE IF NOT EXISTS public.system_settings (
    system_id UUID PRIMARY KEY REFERENCES public.meal_systems(id) ON DELETE CASCADE,
    currency_symbol TEXT NOT NULL DEFAULT '৳',
    currency_code TEXT NOT NULL DEFAULT 'BDT',
    timezone TEXT NOT NULL DEFAULT 'Asia/Dhaka',
    default_daily_meals NUMERIC(4,2) NOT NULL DEFAULT 2.00,
    allow_custom_meals BOOLEAN NOT NULL DEFAULT true,
    lunch_cutoff_time TIME NOT NULL DEFAULT '10:00:00',
    dinner_cutoff_time TIME NOT NULL DEFAULT '17:00:00',
    cutoff_time TIME NOT NULL DEFAULT '10:00:00',
    auto_assign_meals BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.4 System Memberships
CREATE TABLE IF NOT EXISTS public.system_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_id UUID NOT NULL REFERENCES public.meal_systems(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('manager', 'member')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'left')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(system_id, user_id)
);

-- 2.5 System Invitations
CREATE TABLE IF NOT EXISTS public.system_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_id UUID NOT NULL REFERENCES public.meal_systems(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'manager')),
    invited_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    email TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.6 Daily Cooking Calendar (System-level cooking status)
CREATE TABLE IF NOT EXISTS public.cooking_days (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_id UUID NOT NULL REFERENCES public.meal_systems(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'cooking' CHECK (status IN ('cooking', 'no_cooking', 'pending')),
    note TEXT,
    updated_by UUID REFERENCES public.profiles(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(system_id, date)
);

-- 2.7 Daily Meal Records (Per-member meal state)
CREATE TABLE IF NOT EXISTS public.daily_meal_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_id UUID NOT NULL REFERENCES public.meal_systems(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    lunch_count NUMERIC(4,2) NOT NULL DEFAULT 1.00 CHECK (lunch_count >= 0),
    dinner_count NUMERIC(4,2) NOT NULL DEFAULT 1.00 CHECK (dinner_count >= 0),
    lunch_turned_off BOOLEAN NOT NULL DEFAULT false,
    dinner_turned_off BOOLEAN NOT NULL DEFAULT false,
    meal_count NUMERIC(4,2) NOT NULL DEFAULT 2.00 CHECK (meal_count >= 0),
    is_turned_off BOOLEAN NOT NULL DEFAULT false,
    is_post_cutoff_change BOOLEAN NOT NULL DEFAULT false,
    previous_value NUMERIC(4,2),
    change_reason TEXT,
    changed_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(system_id, member_id, date)
);

-- 2.8 Bazar Expenses (Itemized mess grocery purchases)
CREATE TABLE IF NOT EXISTS public.bazar_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_id UUID NOT NULL REFERENCES public.meal_systems(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    category TEXT NOT NULL CHECK (category IN (
        'rice', 'vegetables', 'fish', 'meat', 'eggs', 'oil', 'spices', 'snacks', 'household', 'other'
    )),
    description TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    shop_name TEXT,
    purchaser_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    funding_source TEXT NOT NULL CHECK (funding_source IN ('shared_fund', 'personal_credit')),
    receipt_url TEXT,
    no_receipt_reason TEXT,
    is_reversed BOOLEAN NOT NULL DEFAULT false,
    reversal_reason TEXT,
    reversed_at TIMESTAMPTZ,
    reversed_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.9 Deposits (Money paid by members to mess fund)
CREATE TABLE IF NOT EXISTS public.deposits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_id UUID NOT NULL REFERENCES public.meal_systems(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    date DATE NOT NULL,
    payment_method TEXT NOT NULL CHECK (payment_method IN (
        'cash', 'bkash', 'nagad', 'rocket', 'bank_transfer', 'other'
    )),
    transaction_reference TEXT,
    note TEXT,
    recorded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    is_reversed BOOLEAN NOT NULL DEFAULT false,
    reversal_reason TEXT,
    reversed_at TIMESTAMPTZ,
    reversed_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.10 Financial Adjustments (Authorized balance corrections)
CREATE TABLE IF NOT EXISTS public.financial_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_id UUID NOT NULL REFERENCES public.meal_systems(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    amount NUMERIC(12,2) NOT NULL, -- Positive adds to member balance, negative subtracts
    reason TEXT NOT NULL,
    accounting_period TEXT NOT NULL, -- e.g. '2026-10'
    date DATE NOT NULL,
    authorized_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.11 Unified Financial Ledger
CREATE TABLE IF NOT EXISTS public.financial_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_id UUID NOT NULL REFERENCES public.meal_systems(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN (
        'opening_balance', 'deposit', 'personal_bazar_credit', 'meal_charge', 'adjustment', 'reversal'
    )),
    amount NUMERIC(12,2) NOT NULL, -- Positive increases balance (credit), negative decreases (debt)
    reference_id UUID,
    accounting_period TEXT NOT NULL, -- Format YYYY-MM
    date DATE NOT NULL,
    description TEXT NOT NULL,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.12 Monthly Accounting Periods
CREATE TABLE IF NOT EXISTS public.accounting_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_id UUID NOT NULL REFERENCES public.meal_systems(id) ON DELETE CASCADE,
    period TEXT NOT NULL, -- e.g. '2026-10'
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'finalized', 'reopened')),
    finalized_at TIMESTAMPTZ,
    finalized_by UUID REFERENCES public.profiles(id),
    version INTEGER NOT NULL DEFAULT 1,
    total_bazar_expense NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_finalized_meals NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    meal_rate NUMERIC(10,4), -- NULL if zero meals
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(system_id, period)
);

-- 2.13 Monthly Report Snapshots (Immutable version history of finalizations)
CREATE TABLE IF NOT EXISTS public.monthly_report_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_id UUID NOT NULL REFERENCES public.meal_systems(id) ON DELETE CASCADE,
    period TEXT NOT NULL,
    version INTEGER NOT NULL,
    finalized_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    finalized_by UUID NOT NULL REFERENCES public.profiles(id),
    reason TEXT,
    summary_data JSONB NOT NULL,
    member_balances JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(system_id, period, version)
);

-- 2.14 Transparent Audit Logs (Read-only historical audit trail)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_id UUID NOT NULL REFERENCES public.meal_systems(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    action_type TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT,
    previous_value JSONB,
    new_value JSONB,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.15 System Notifications
CREATE TABLE IF NOT EXISTS public.system_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_id UUID NOT NULL REFERENCES public.meal_systems(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE, -- NULL for all members in system
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 3. INDEXES FOR HIGH-PERFORMANCE QUERYING
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_memberships_system_user ON public.system_memberships(system_id, user_id);
CREATE INDEX IF NOT EXISTS idx_cooking_days_system_date ON public.cooking_days(system_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_meal_records_lookup ON public.daily_meal_records(system_id, date, member_id);
CREATE INDEX IF NOT EXISTS idx_bazar_expenses_system_date ON public.bazar_expenses(system_id, date);
CREATE INDEX IF NOT EXISTS idx_deposits_system_date ON public.deposits(system_id, date);
CREATE INDEX IF NOT EXISTS idx_ledger_system_period ON public.financial_ledger(system_id, accounting_period, member_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_system_created ON public.audit_logs(system_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.system_notifications(system_id, user_id, is_read);

-- ==============================================================================
-- 4. ROW LEVEL SECURITY (RLS) HELPER FUNCTIONS
-- ==============================================================================

-- Check if authenticated user belongs to the system
CREATE OR REPLACE FUNCTION public.is_system_member(p_system_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.system_memberships
        WHERE system_id = p_system_id
          AND user_id = p_user_id
          AND status = 'active'
    );
$$;

-- Check if authenticated user is active manager in the system
CREATE OR REPLACE FUNCTION public.is_system_manager(p_system_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.system_memberships
        WHERE system_id = p_system_id
          AND user_id = p_user_id
          AND role = 'manager'
          AND status = 'active'
    );
$$;

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_systems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cooking_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_meal_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bazar_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_report_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_notifications ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 5. RLS POLICIES
-- ==============================================================================

-- 5.1 Profiles: Users can view profiles of fellow mess members and edit their own
CREATE POLICY profiles_select_policy ON public.profiles
    FOR SELECT TO authenticated
    USING (
        id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.system_memberships m1
            JOIN public.system_memberships m2 ON m1.system_id = m2.system_id
            WHERE m1.user_id = auth.uid() AND m2.user_id = profiles.id
        )
    );

CREATE POLICY profiles_update_policy ON public.profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid());

CREATE POLICY profiles_insert_policy ON public.profiles
    FOR INSERT TO authenticated
    WITH CHECK (id = auth.uid());

-- 5.2 Meal Systems: Members can select systems they belong to, anyone authenticated can create
CREATE POLICY meal_systems_select ON public.meal_systems
    FOR SELECT TO authenticated
    USING (public.is_system_member(id, auth.uid()) OR created_by = auth.uid());

CREATE POLICY meal_systems_insert ON public.meal_systems
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() IS NOT NULL AND (created_by = auth.uid() OR created_by IS NULL));

CREATE POLICY meal_systems_update ON public.meal_systems
    FOR UPDATE TO authenticated
    USING (public.is_system_manager(id, auth.uid()));

-- 5.3 System Settings
CREATE POLICY system_settings_select ON public.system_settings
    FOR SELECT TO authenticated
    USING (public.is_system_member(system_id, auth.uid()));

CREATE POLICY system_settings_insert ON public.system_settings
    FOR INSERT TO authenticated
    WITH CHECK (
        public.is_system_manager(system_id, auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.meal_systems
            WHERE id = system_id AND created_by = auth.uid()
        )
    );

CREATE POLICY system_settings_all_manager ON public.system_settings
    FOR ALL TO authenticated
    USING (public.is_system_manager(system_id, auth.uid()))
    WITH CHECK (public.is_system_manager(system_id, auth.uid()));

-- 5.4 System Memberships
CREATE POLICY memberships_select ON public.system_memberships
    FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR public.is_system_member(system_id, auth.uid()));

CREATE POLICY memberships_insert ON public.system_memberships
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid() OR public.is_system_manager(system_id, auth.uid()));

CREATE POLICY memberships_update ON public.system_memberships
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid() OR public.is_system_manager(system_id, auth.uid()))
    WITH CHECK (user_id = auth.uid() OR public.is_system_manager(system_id, auth.uid()));

-- 5.5 Invitations
CREATE POLICY invitations_select ON public.system_invitations
    FOR SELECT TO authenticated
    USING (public.is_system_member(system_id, auth.uid()) OR token IS NOT NULL);

CREATE POLICY invitations_manage ON public.system_invitations
    FOR ALL TO authenticated
    USING (
        public.is_system_manager(system_id, auth.uid())
        OR (status = 'pending' AND expires_at > now())
    )
    WITH CHECK (
        public.is_system_manager(system_id, auth.uid())
        OR status = 'accepted'
    );

-- 5.6 Cooking Days
CREATE POLICY cooking_days_select ON public.cooking_days
    FOR SELECT TO authenticated
    USING (public.is_system_member(system_id, auth.uid()));

CREATE POLICY cooking_days_manage ON public.cooking_days
    FOR ALL TO authenticated
    USING (public.is_system_manager(system_id, auth.uid()));

-- 5.7 Daily Meal Records
CREATE POLICY meal_records_select ON public.daily_meal_records
    FOR SELECT TO authenticated
    USING (public.is_system_member(system_id, auth.uid()));

CREATE POLICY meal_records_insert ON public.daily_meal_records
    FOR INSERT TO authenticated
    WITH CHECK (
        public.is_system_member(system_id, auth.uid())
        AND (member_id = auth.uid() OR public.is_system_manager(system_id, auth.uid()))
    );

CREATE POLICY meal_records_update ON public.daily_meal_records
    FOR UPDATE TO authenticated
    USING (
        public.is_system_member(system_id, auth.uid())
        AND (member_id = auth.uid() OR public.is_system_manager(system_id, auth.uid()))
    );

-- 5.8 Bazar Expenses (Transparent to all members)
CREATE POLICY bazar_expenses_select ON public.bazar_expenses
    FOR SELECT TO authenticated
    USING (public.is_system_member(system_id, auth.uid()));

CREATE POLICY bazar_expenses_insert ON public.bazar_expenses
    FOR INSERT TO authenticated
    WITH CHECK (
        public.is_system_member(system_id, auth.uid())
        AND (public.is_system_manager(system_id, auth.uid()) OR purchaser_id = auth.uid())
    );

CREATE POLICY bazar_expenses_update ON public.bazar_expenses
    FOR UPDATE TO authenticated
    USING (public.is_system_manager(system_id, auth.uid()));

-- 5.9 Deposits
CREATE POLICY deposits_select ON public.deposits
    FOR SELECT TO authenticated
    USING (public.is_system_member(system_id, auth.uid()));

CREATE POLICY deposits_manage ON public.deposits
    FOR ALL TO authenticated
    USING (public.is_system_manager(system_id, auth.uid()));

-- 5.10 Financial Adjustments
CREATE POLICY adjustments_select ON public.financial_adjustments
    FOR SELECT TO authenticated
    USING (public.is_system_member(system_id, auth.uid()));

CREATE POLICY adjustments_manage ON public.financial_adjustments
    FOR ALL TO authenticated
    USING (public.is_system_manager(system_id, auth.uid()));

-- 5.11 Unified Financial Ledger (Transparent to all members)
CREATE POLICY ledger_select ON public.financial_ledger
    FOR SELECT TO authenticated
    USING (public.is_system_member(system_id, auth.uid()));

CREATE POLICY ledger_manage ON public.financial_ledger
    FOR ALL TO authenticated
    USING (public.is_system_manager(system_id, auth.uid()));

-- 5.12 Accounting Periods
CREATE POLICY accounting_periods_select ON public.accounting_periods
    FOR SELECT TO authenticated
    USING (public.is_system_member(system_id, auth.uid()));

CREATE POLICY accounting_periods_manage ON public.accounting_periods
    FOR ALL TO authenticated
    USING (public.is_system_manager(system_id, auth.uid()));

-- 5.13 Monthly Report Snapshots (Transparent to all members)
CREATE POLICY snapshots_select ON public.monthly_report_snapshots
    FOR SELECT TO authenticated
    USING (public.is_system_member(system_id, auth.uid()));

CREATE POLICY snapshots_manage ON public.monthly_report_snapshots
    FOR ALL TO authenticated
    USING (public.is_system_manager(system_id, auth.uid()));

-- 5.14 Audit Logs (Read-only for all members, cannot be deleted or forged)
CREATE POLICY audit_logs_select ON public.audit_logs
    FOR SELECT TO authenticated
    USING (public.is_system_member(system_id, auth.uid()));

CREATE POLICY audit_logs_insert ON public.audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (public.is_system_member(system_id, auth.uid()));

-- 5.15 Notifications
CREATE POLICY notifications_select ON public.system_notifications
    FOR SELECT TO authenticated
    USING (
        public.is_system_member(system_id, auth.uid())
        AND (user_id IS NULL OR user_id = auth.uid())
    );

CREATE POLICY notifications_manage ON public.system_notifications
    FOR ALL TO authenticated
    USING (public.is_system_member(system_id, auth.uid()));

-- ==============================================================================
-- 6. BUSINESS LOGIC & RPC FUNCTIONS
-- ==============================================================================

-- 6.0 Transactional Meal System Creation Function
CREATE OR REPLACE FUNCTION public.create_meal_system_tx(
    p_name TEXT,
    p_description TEXT DEFAULT NULL,
    p_currency_symbol TEXT DEFAULT '৳',
    p_currency_code TEXT DEFAULT 'BDT',
    p_timezone TEXT DEFAULT 'Asia/Dhaka',
    p_default_daily_meals NUMERIC DEFAULT 2.0,
    p_lunch_cutoff TIME DEFAULT '10:00:00',
    p_dinner_cutoff TIME DEFAULT '17:00:00'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_system_id UUID;
    v_code TEXT;
    v_new_system RECORD;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to create a meal system.';
    END IF;

    -- Ensure profile exists for the creator
    INSERT INTO public.profiles (id, full_name, created_at, updated_at)
    VALUES (
        v_user_id,
        COALESCE((SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = v_user_id), 'Manager'),
        now(),
        now()
    )
    ON CONFLICT (id) DO NOTHING;

    -- Generate a unique code (e.g., MESSNA-1234)
    v_code := UPPER(SUBSTRING(REGEXP_REPLACE(p_name, '[^A-Za-z0-9]', '', 'g') FROM 1 FOR 6)) 
              || '-' || LPAD(FLOOR(RANDOM() * 9000 + 1000)::TEXT, 4, '0');

    -- Insert meal system
    INSERT INTO public.meal_systems (name, code, description, created_by, created_at, updated_at)
    VALUES (p_name, v_code, p_description, v_user_id, now(), now())
    RETURNING * INTO v_new_system;

    v_system_id := v_new_system.id;

    -- Add creator as active Manager
    INSERT INTO public.system_memberships (system_id, user_id, role, status, joined_at)
    VALUES (v_system_id, v_user_id, 'manager', 'active', now())
    ON CONFLICT (system_id, user_id) DO UPDATE SET role = 'manager', status = 'active';

    -- Initialize system settings
    INSERT INTO public.system_settings (
        system_id, currency_symbol, currency_code, timezone,
        default_daily_meals, allow_custom_meals,
        lunch_cutoff_time, dinner_cutoff_time, cutoff_time,
        auto_assign_meals, created_at, updated_at
    ) VALUES (
        v_system_id, p_currency_symbol, p_currency_code, p_timezone,
        p_default_daily_meals, true,
        p_lunch_cutoff, p_dinner_cutoff, p_lunch_cutoff,
        true, now(), now()
    )
    ON CONFLICT (system_id) DO NOTHING;

    -- Audit log
    INSERT INTO public.audit_logs (system_id, actor_id, action_type, target_type, target_id, new_value)
    VALUES (v_system_id, v_user_id, 'SYSTEM_CREATED', 'meal_systems', v_system_id::TEXT, row_to_json(v_new_system)::jsonb);

    RETURN row_to_json(v_new_system)::jsonb;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_meal_system_tx TO authenticated;

-- 6.1 Safe Role Transfer Function
CREATE OR REPLACE FUNCTION public.transfer_manager_role(
    p_system_id UUID,
    p_new_manager_id UUID,
    p_reason TEXT DEFAULT 'Manager role reassignment'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_prev_manager_id UUID;
BEGIN
    v_caller_id := auth.uid();

    -- Verify caller is current manager
    IF NOT public.is_system_manager(p_system_id, v_caller_id) THEN
        RAISE EXCEPTION 'Only the active manager can transfer system leadership.';
    END IF;

    -- Verify target is active member of this system
    IF NOT public.is_system_member(p_system_id, p_new_manager_id) THEN
        RAISE EXCEPTION 'Target user must be an active member of this system.';
    END IF;

    v_prev_manager_id := v_caller_id;

    -- Demote caller to member
    UPDATE public.system_memberships
    SET role = 'member'
    WHERE system_id = p_system_id AND user_id = v_caller_id;

    -- Promote new manager
    UPDATE public.system_memberships
    SET role = 'manager'
    WHERE system_id = p_system_id AND user_id = p_new_manager_id;

    -- Log to audit trail
    INSERT INTO public.audit_logs (
        system_id, actor_id, action_type, target_type, target_id,
        previous_value, new_value, reason
    ) VALUES (
        p_system_id,
        v_caller_id,
        'MANAGER_ROLE_TRANSFERRED',
        'system_memberships',
        p_new_manager_id::text,
        jsonb_build_object('manager_id', v_prev_manager_id),
        jsonb_build_object('manager_id', p_new_manager_id),
        p_reason
    );

    -- Notify system
    INSERT INTO public.system_notifications (
        system_id, user_id, type, title, message
    ) VALUES (
        p_system_id,
        NULL,
        'ROLE_CHANGE',
        'Manager Role Transferred',
        'Manager role was transferred to a new member.'
    );

    RETURN jsonb_build_object('success', true, 'new_manager_id', p_new_manager_id);
END;
$$;

-- 6.2 Record Bazar Purchase with Optional Personal Credit (No Duplicate Expense)
CREATE OR REPLACE FUNCTION public.record_bazar_expense_tx(
    p_system_id UUID,
    p_date DATE,
    p_category TEXT,
    p_description TEXT,
    p_amount NUMERIC,
    p_shop_name TEXT,
    p_purchaser_id UUID,
    p_funding_source TEXT,
    p_receipt_url TEXT,
    p_no_receipt_reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_expense_id UUID;
    v_period TEXT;
BEGIN
    v_caller_id := auth.uid();
    IF NOT public.is_system_member(p_system_id, v_caller_id) THEN
        RAISE EXCEPTION 'Access denied. You are not a member of this system.';
    END IF;

    v_period := to_char(p_date, 'YYYY-MM');

    -- Insert expense record
    INSERT INTO public.bazar_expenses (
        system_id, date, category, description, amount, shop_name,
        purchaser_id, created_by, funding_source, receipt_url, no_receipt_reason
    ) VALUES (
        p_system_id, p_date, p_category, p_description, p_amount, p_shop_name,
        p_purchaser_id, v_caller_id, p_funding_source, p_receipt_url, p_no_receipt_reason
    ) RETURNING id INTO v_expense_id;

    -- If personally paid by a member, credit their balance in the ledger
    -- (This gives them credit without counting as a deposit or duplicating expense)
    IF p_funding_source = 'personal_credit' THEN
        INSERT INTO public.financial_ledger (
            system_id, member_id, transaction_type, amount, reference_id,
            accounting_period, date, description, created_by
        ) VALUES (
            p_system_id, p_purchaser_id, 'personal_bazar_credit', p_amount,
            v_expense_id, v_period, p_date,
            'Personal Bazar Credit: ' || p_description, v_caller_id
        );
    END IF;

    -- Audit log
    INSERT INTO public.audit_logs (
        system_id, actor_id, action_type, target_type, target_id,
        new_value, reason
    ) VALUES (
        p_system_id, v_caller_id, 'EXPENSE_RECORDED', 'bazar_expenses',
        v_expense_id::text,
        jsonb_build_object(
            'amount', p_amount,
            'category', p_category,
            'funding_source', p_funding_source,
            'purchaser_id', p_purchaser_id
        ),
        'New grocery expense added'
    );

    RETURN v_expense_id;
END;
$$;

-- 6.3 Reverse Bazar Expense Safely
CREATE OR REPLACE FUNCTION public.reverse_bazar_expense(
    p_expense_id UUID,
    p_reason TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_exp RECORD;
BEGIN
    v_caller_id := auth.uid();
    SELECT * INTO v_exp FROM public.bazar_expenses WHERE id = p_expense_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Expense not found.';
    END IF;

    IF NOT public.is_system_manager(v_exp.system_id, v_caller_id) THEN
        RAISE EXCEPTION 'Only the manager can reverse an expense.';
    END IF;

    IF v_exp.is_reversed THEN
        RAISE EXCEPTION 'This expense is already reversed.';
    END IF;

    -- Mark reversed
    UPDATE public.bazar_expenses
    SET is_reversed = true,
        reversal_reason = p_reason,
        reversed_at = now(),
        reversed_by = v_caller_id
    WHERE id = p_expense_id;

    -- If it had created personal credit, insert reversal ledger entry
    IF v_exp.funding_source = 'personal_credit' THEN
        INSERT INTO public.financial_ledger (
            system_id, member_id, transaction_type, amount, reference_id,
            accounting_period, date, description, created_by
        ) VALUES (
            v_exp.system_id, v_exp.purchaser_id, 'reversal', -v_exp.amount,
            v_exp.id, to_char(v_exp.date, 'YYYY-MM'), current_date,
            'Reversal: Personal Bazar Credit for ' || v_exp.description || ' (' || p_reason || ')',
            v_caller_id
        );
    END IF;

    -- Audit log
    INSERT INTO public.audit_logs (
        system_id, actor_id, action_type, target_type, target_id,
        previous_value, new_value, reason
    ) VALUES (
        v_exp.system_id, v_caller_id, 'EXPENSE_REVERSED', 'bazar_expenses',
        p_expense_id::text,
        jsonb_build_object('amount', v_exp.amount, 'is_reversed', false),
        jsonb_build_object('amount', v_exp.amount, 'is_reversed', true),
        p_reason
    );

    RETURN true;
END;
$$;

-- 6.4 Record Member Deposit
CREATE OR REPLACE FUNCTION public.record_deposit_tx(
    p_system_id UUID,
    p_member_id UUID,
    p_amount NUMERIC,
    p_date DATE,
    p_payment_method TEXT,
    p_trx_reference TEXT,
    p_note TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_deposit_id UUID;
    v_period TEXT;
BEGIN
    v_caller_id := auth.uid();
    IF NOT public.is_system_manager(p_system_id, v_caller_id) THEN
        RAISE EXCEPTION 'Only managers can record member deposits.';
    END IF;

    v_period := to_char(p_date, 'YYYY-MM');

    -- Insert deposit
    INSERT INTO public.deposits (
        system_id, member_id, amount, date, payment_method,
        transaction_reference, note, recorded_by
    ) VALUES (
        p_system_id, p_member_id, p_amount, p_date, p_payment_method,
        p_trx_reference, p_note, v_caller_id
    ) RETURNING id INTO v_deposit_id;

    -- Add to financial ledger (positive amount = credit)
    INSERT INTO public.financial_ledger (
        system_id, member_id, transaction_type, amount, reference_id,
        accounting_period, date, description, created_by
    ) VALUES (
        p_system_id, p_member_id, 'deposit', p_amount, v_deposit_id,
        v_period, p_date,
        'Deposit via ' || p_payment_method || COALESCE(' (' || p_trx_reference || ')', ''),
        v_caller_id
    );

    -- Audit log
    INSERT INTO public.audit_logs (
        system_id, actor_id, action_type, target_type, target_id,
        new_value, reason
    ) VALUES (
        p_system_id, v_caller_id, 'DEPOSIT_RECORDED', 'deposits',
        v_deposit_id::text,
        jsonb_build_object('member_id', p_member_id, 'amount', p_amount, 'method', p_payment_method),
        'Member deposit logged'
    );

    RETURN v_deposit_id;
END;
$$;

-- 6.5 Reverse Deposit Safely
CREATE OR REPLACE FUNCTION public.reverse_deposit(
    p_deposit_id UUID,
    p_reason TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_dep RECORD;
BEGIN
    v_caller_id := auth.uid();
    SELECT * INTO v_dep FROM public.deposits WHERE id = p_deposit_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Deposit not found.';
    END IF;

    IF NOT public.is_system_manager(v_dep.system_id, v_caller_id) THEN
        RAISE EXCEPTION 'Only the manager can reverse a deposit.';
    END IF;

    IF v_dep.is_reversed THEN
        RAISE EXCEPTION 'This deposit is already reversed.';
    END IF;

    UPDATE public.deposits
    SET is_reversed = true,
        reversal_reason = p_reason,
        reversed_at = now(),
        reversed_by = v_caller_id
    WHERE id = p_deposit_id;

    -- Reverse ledger balance
    INSERT INTO public.financial_ledger (
        system_id, member_id, transaction_type, amount, reference_id,
        accounting_period, date, description, created_by
    ) VALUES (
        v_dep.system_id, v_dep.member_id, 'reversal', -v_dep.amount,
        v_dep.id, to_char(v_dep.date, 'YYYY-MM'), current_date,
        'Deposit Reversal (' || p_reason || ')', v_caller_id
    );

    -- Audit log
    INSERT INTO public.audit_logs (
        system_id, actor_id, action_type, target_type, target_id,
        previous_value, new_value, reason
    ) VALUES (
        v_dep.system_id, v_caller_id, 'DEPOSIT_REVERSED', 'deposits',
        p_deposit_id::text,
        jsonb_build_object('amount', v_dep.amount, 'is_reversed', false),
        jsonb_build_object('amount', v_dep.amount, 'is_reversed', true),
        p_reason
    );

    RETURN true;
END;
$$;

-- 6.6 Toggle or Update Daily Meal Record (respecting Sequential Cutoffs & No-Cooking Days)
CREATE OR REPLACE FUNCTION public.save_daily_meal(
    p_system_id UUID,
    p_member_id UUID,
    p_date DATE,
    p_meal_count NUMERIC DEFAULT NULL,
    p_is_turned_off BOOLEAN DEFAULT false,
    p_reason TEXT DEFAULT NULL,
    p_lunch_turned_off BOOLEAN DEFAULT NULL,
    p_dinner_turned_off BOOLEAN DEFAULT NULL,
    p_lunch_count NUMERIC DEFAULT NULL,
    p_dinner_count NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_is_mgr BOOLEAN;
    v_settings RECORD;
    v_cooking_status TEXT;
    v_now_time TIME;
    v_is_past_cutoff BOOLEAN := false;
    v_existing RECORD;
    v_lunch_off BOOLEAN;
    v_dinner_off BOOLEAN;
    v_full_off BOOLEAN;
    v_lunch_cnt NUMERIC(4,2);
    v_dinner_cnt NUMERIC(4,2);
    v_effective_total NUMERIC(4,2);
BEGIN
    v_caller_id := auth.uid();
    v_is_mgr := public.is_system_manager(p_system_id, v_caller_id);

    -- Authorization check
    IF NOT (v_is_mgr OR v_caller_id = p_member_id) THEN
        RAISE EXCEPTION 'You cannot modify another member meals.';
    END IF;

    -- Load system settings
    SELECT * INTO v_settings FROM public.system_settings WHERE system_id = p_system_id;

    -- Check cooking day status
    SELECT status INTO v_cooking_status FROM public.cooking_days
    WHERE system_id = p_system_id AND date = p_date;

    IF v_cooking_status = 'no_cooking' THEN
        RAISE EXCEPTION 'Cooking is cancelled for %! No meals can be counted or charged.', p_date;
    END IF;

    -- Load existing record if any
    SELECT * INTO v_existing FROM public.daily_meal_records
    WHERE system_id = p_system_id AND member_id = p_member_id AND date = p_date;

    -- Check sequential cutoffs for afternoon and night meals
    IF p_date < current_date THEN
        v_is_past_cutoff := true;
    ELSIF p_date = current_date THEN
        v_now_time := (timezone(COALESCE(v_settings.timezone, 'Asia/Dhaka'), now()))::time;

        -- Afternoon cutoff check (e.g. 10:00 AM)
        IF v_now_time > COALESCE(v_settings.lunch_cutoff_time, v_settings.cutoff_time, '10:00:00'::time) THEN
            IF p_lunch_turned_off IS NOT NULL AND v_existing.id IS NOT NULL AND p_lunch_turned_off != COALESCE(v_existing.lunch_turned_off, false) THEN
                v_is_past_cutoff := true;
            ELSIF p_is_turned_off AND (v_existing.id IS NULL OR NOT v_existing.is_turned_off) THEN
                v_is_past_cutoff := true;
            END IF;
        END IF;

        -- Night cutoff check (e.g. 5:00 PM)
        IF v_now_time > COALESCE(v_settings.dinner_cutoff_time, '17:00:00'::time) THEN
            IF p_dinner_turned_off IS NOT NULL AND v_existing.id IS NOT NULL AND p_dinner_turned_off != COALESCE(v_existing.dinner_turned_off, false) THEN
                v_is_past_cutoff := true;
            END IF;
        END IF;
    END IF;

    -- If past cutoff and NOT manager, disallow
    IF v_is_past_cutoff AND NOT v_is_mgr THEN
        RAISE EXCEPTION 'Cutoff time has passed for this slot. Only the manager can make authorized corrections.';
    END IF;

    -- Resolve slot values
    v_lunch_off := COALESCE(p_lunch_turned_off, (CASE WHEN p_is_turned_off THEN true ELSE COALESCE(v_existing.lunch_turned_off, false) END));
    v_dinner_off := COALESCE(p_dinner_turned_off, (CASE WHEN p_is_turned_off THEN true ELSE COALESCE(v_existing.dinner_turned_off, false) END));
    v_full_off := (v_lunch_off AND v_dinner_off) OR p_is_turned_off;

    v_lunch_cnt := CASE WHEN v_lunch_off THEN 0.00 ELSE COALESCE(p_lunch_count, COALESCE(v_existing.lunch_count, 1.00)) END;
    v_dinner_cnt := CASE WHEN v_dinner_off THEN 0.00 ELSE COALESCE(p_dinner_count, COALESCE(v_existing.dinner_count, 1.00)) END;
    v_effective_total := CASE WHEN v_full_off THEN 0.00 ELSE (v_lunch_cnt + v_dinner_cnt) END;

    -- Check custom meals permitted
    IF NOT v_settings.allow_custom_meals AND NOT v_full_off AND v_effective_total != v_settings.default_daily_meals THEN
        RAISE EXCEPTION 'Custom meal counts are not allowed in this system. Default is %.', v_settings.default_daily_meals;
    END IF;

    -- Upsert daily record
    INSERT INTO public.daily_meal_records (
        system_id, member_id, date,
        lunch_count, dinner_count, lunch_turned_off, dinner_turned_off,
        meal_count, is_turned_off,
        is_post_cutoff_change, previous_value, change_reason, changed_by
    ) VALUES (
        p_system_id, p_member_id, p_date,
        v_lunch_cnt, v_dinner_cnt, v_lunch_off, v_dinner_off,
        v_effective_total, v_full_off,
        v_is_past_cutoff,
        CASE WHEN v_existing.id IS NOT NULL THEN (CASE WHEN v_existing.is_turned_off THEN 0 ELSE v_existing.meal_count END) ELSE NULL END,
        p_reason, v_caller_id
    )
    ON CONFLICT (system_id, member_id, date) DO UPDATE SET
        lunch_count = EXCLUDED.lunch_count,
        dinner_count = EXCLUDED.dinner_count,
        lunch_turned_off = EXCLUDED.lunch_turned_off,
        dinner_turned_off = EXCLUDED.dinner_turned_off,
        meal_count = EXCLUDED.meal_count,
        is_turned_off = EXCLUDED.is_turned_off,
        is_post_cutoff_change = (daily_meal_records.is_post_cutoff_change OR v_is_past_cutoff),
        previous_value = (CASE WHEN daily_meal_records.is_turned_off THEN 0 ELSE daily_meal_records.meal_count END),
        change_reason = COALESCE(p_reason, daily_meal_records.change_reason),
        changed_by = v_caller_id,
        updated_at = now();

    -- If post cutoff correction, log to audit trail
    IF v_is_past_cutoff THEN
        INSERT INTO public.audit_logs (
            system_id, actor_id, action_type, target_type, target_id,
            previous_value, new_value, reason
        ) VALUES (
            p_system_id, v_caller_id, 'POST_CUTOFF_MEAL_CORRECTION', 'daily_meal_records',
            p_date::text || ':' || p_member_id::text,
            jsonb_build_object('turned_off', v_existing.is_turned_off, 'count', v_existing.meal_count),
            jsonb_build_object('turned_off', v_full_off, 'count', v_effective_total, 'lunch_off', v_lunch_off, 'dinner_off', v_dinner_off),
            p_reason
        );
    END IF;

    RETURN jsonb_build_object('success', true, 'is_post_cutoff', v_is_past_cutoff, 'effective_meals', v_effective_total);
END;
$$;

-- 6.7 Comprehensive Monthly Finalization & Snapshot Engine
CREATE OR REPLACE FUNCTION public.finalize_monthly_accounting_tx(
    p_system_id UUID,
    p_period TEXT, -- 'YYYY-MM'
    p_reason TEXT DEFAULT 'Monthly accounting finalized'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_start_date DATE;
    v_end_date DATE;
    v_total_expenses NUMERIC(12,2) := 0.00;
    v_total_meals NUMERIC(10,2) := 0.00;
    v_meal_rate NUMERIC(10,4) := NULL;
    v_period_rec RECORD;
    v_next_version INT := 1;
    v_members JSONB := '[]'::jsonb;
    v_summary JSONB;
BEGIN
    v_caller_id := auth.uid();
    IF NOT public.is_system_manager(p_system_id, v_caller_id) THEN
        RAISE EXCEPTION 'Only the manager can finalize monthly accounting.';
    END IF;

    v_start_date := (p_period || '-01')::DATE;
    v_end_date := (v_start_date + INTERVAL '1 month - 1 day')::DATE;

    -- Calculate total eligible bazar expenses (excluding reversed items)
    SELECT COALESCE(SUM(amount), 0.00) INTO v_total_expenses
    FROM public.bazar_expenses
    WHERE system_id = p_system_id
      AND date >= v_start_date AND date <= v_end_date
      AND is_reversed = false;

    -- Calculate total meals for cooking days based on slot state
    SELECT COALESCE(SUM(
        CASE
            WHEN cd.status = 'no_cooking' THEN 0
            WHEN dmr.is_turned_off THEN 0
            ELSE (
                (CASE WHEN dmr.lunch_turned_off THEN 0 ELSE COALESCE(dmr.lunch_count, 1.0) END) +
                (CASE WHEN dmr.dinner_turned_off THEN 0 ELSE COALESCE(dmr.dinner_count, 1.0) END)
            )
        END
    ), 0.00) INTO v_total_meals
    FROM public.daily_meal_records dmr
    LEFT JOIN public.cooking_days cd ON cd.system_id = dmr.system_id AND cd.date = dmr.date
    WHERE dmr.system_id = p_system_id
      AND dmr.date >= v_start_date AND dmr.date <= v_end_date;

    -- Meal rate = expenses / meals (NULL if 0 meals)
    IF v_total_meals > 0 THEN
        v_meal_rate := ROUND(v_total_expenses / v_total_meals, 4);
    ELSE
        v_meal_rate := NULL;
    END IF;

    -- Check if period already exists
    SELECT * INTO v_period_rec FROM public.accounting_periods
    WHERE system_id = p_system_id AND period = p_period;

    IF v_period_rec.id IS NOT NULL THEN
        v_next_version := v_period_rec.version + 1;
    END IF;

    -- Upsert accounting period
    INSERT INTO public.accounting_periods (
        system_id, period, status, finalized_at, finalized_by,
        version, total_bazar_expense, total_finalized_meals, meal_rate, notes
    ) VALUES (
        p_system_id, p_period, 'finalized', now(), v_caller_id,
        v_next_version, v_total_expenses, v_total_meals, v_meal_rate, p_reason
    )
    ON CONFLICT (system_id, period) DO UPDATE SET
        status = 'finalized',
        finalized_at = now(),
        finalized_by = v_caller_id,
        version = v_next_version,
        total_bazar_expense = v_total_expenses,
        total_finalized_meals = v_total_meals,
        meal_rate = v_meal_rate,
        notes = p_reason,
        updated_at = now();

    -- Build Summary JSON
    v_summary := jsonb_build_object(
        'period', p_period,
        'version', v_next_version,
        'total_bazar_expenses', v_total_expenses,
        'total_finalized_meals', v_total_meals,
        'meal_rate', v_meal_rate,
        'finalized_at', now(),
        'finalized_by', v_caller_id
    );

    -- Insert snapshot
    INSERT INTO public.monthly_report_snapshots (
        system_id, period, version, finalized_at, finalized_by,
        reason, summary_data, member_balances
    ) VALUES (
        p_system_id, p_period, v_next_version, now(), v_caller_id,
        p_reason, v_summary, v_members
    );

    -- Audit log
    INSERT INTO public.audit_logs (
        system_id, actor_id, action_type, target_type, target_id,
        new_value, reason
    ) VALUES (
        p_system_id, v_caller_id, 'MONTHLY_REPORT_FINALIZED', 'accounting_periods',
        p_period,
        jsonb_build_object('version', v_next_version, 'meal_rate', v_meal_rate, 'total_meals', v_total_meals),
        p_reason
    );

    -- Notification
    INSERT INTO public.system_notifications (
        system_id, user_id, type, title, message
    ) VALUES (
        p_system_id, NULL, 'REPORT_FINALIZED',
        'Monthly Report Finalized (' || p_period || ')',
        'Manager finalized month ' || p_period || ' with meal rate: ' || COALESCE(v_meal_rate::text, 'N/A')
    );

    RETURN jsonb_build_object(
        'success', true,
        'period', p_period,
        'version', v_next_version,
        'total_expenses', v_total_expenses,
        'total_meals', v_total_meals,
        'meal_rate', v_meal_rate
    );
END;
$$;

-- ==============================================================================
-- 7. AUTOMATIC PROFILE TRIGGER ON AUTH.USERS
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, phone, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        NEW.raw_user_meta_data->>'phone',
        NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 8. STORAGE BUCKET CONFIGURATION FOR BAZAR RECEIPTS
-- ==============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('bazar-receipts', 'bazar-receipts', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload receipts"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'bazar-receipts');

CREATE POLICY "Anyone in mess can view receipts"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'bazar-receipts');
