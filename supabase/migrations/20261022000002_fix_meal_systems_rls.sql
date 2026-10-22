-- ==============================================================================
-- FIX ROW LEVEL SECURITY & ADD TRANSACTIONAL MEAL SYSTEM CREATION
-- ==============================================================================

-- 1. Ensure created_by column on meal_systems defaults to auth.uid()
ALTER TABLE public.meal_systems ALTER COLUMN created_by SET DEFAULT auth.uid();

-- 2. Update RLS policies on meal_systems
DROP POLICY IF EXISTS meal_systems_insert ON public.meal_systems;
CREATE POLICY meal_systems_insert ON public.meal_systems
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() IS NOT NULL AND (created_by = auth.uid() OR created_by IS NULL));

DROP POLICY IF EXISTS meal_systems_select ON public.meal_systems;
CREATE POLICY meal_systems_select ON public.meal_systems
    FOR SELECT TO authenticated
    USING (created_by = auth.uid() OR public.is_system_member(id, auth.uid()));

-- 3. Allow system creators to insert initial system settings
DROP POLICY IF EXISTS system_settings_insert ON public.system_settings;
CREATE POLICY system_settings_insert ON public.system_settings
    FOR INSERT TO authenticated
    WITH CHECK (
        public.is_system_manager(system_id, auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.meal_systems
            WHERE id = system_id AND created_by = auth.uid()
        )
    );

-- 3.1 Ensure bazar expense insertion works smoothly for managers and purchasers
DROP POLICY IF EXISTS bazar_expenses_insert ON public.bazar_expenses;
CREATE POLICY bazar_expenses_insert ON public.bazar_expenses
    FOR INSERT TO authenticated
    WITH CHECK (
        public.is_system_member(system_id, auth.uid())
        AND (public.is_system_manager(system_id, auth.uid()) OR purchaser_id = auth.uid() OR created_by = auth.uid())
    );

-- 3.2 Ensure users can select, insert, and update their own membership
DROP POLICY IF EXISTS memberships_select ON public.system_memberships;
CREATE POLICY memberships_select ON public.system_memberships
    FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR public.is_system_member(system_id, auth.uid()));

DROP POLICY IF EXISTS memberships_insert ON public.system_memberships;
CREATE POLICY memberships_insert ON public.system_memberships
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid() OR public.is_system_manager(system_id, auth.uid()));

DROP POLICY IF EXISTS memberships_update ON public.system_memberships;
CREATE POLICY memberships_update ON public.system_memberships
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid() OR public.is_system_manager(system_id, auth.uid()))
    WITH CHECK (user_id = auth.uid() OR public.is_system_manager(system_id, auth.uid()));

-- 3.3 Ensure invitations can be updated when accepted
DROP POLICY IF EXISTS invitations_manage ON public.system_invitations;
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

-- 4. Transactional RPC for atomic Meal System Creation
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

-- 5. Atomic Member Invitation Acceptance RPC
CREATE OR REPLACE FUNCTION public.accept_system_invitation(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_inv RECORD;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to accept an invitation.';
    END IF;

    -- Ensure profile exists
    INSERT INTO public.profiles (id, full_name, created_at, updated_at)
    VALUES (
        v_user_id,
        COALESCE((SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = v_user_id), 'Member'),
        now(),
        now()
    )
    ON CONFLICT (id) DO NOTHING;

    -- Find valid invitation
    SELECT * INTO v_inv
    FROM public.system_invitations
    WHERE token = p_token
      AND status = 'pending'
      AND expires_at > now();

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid, expired, or already used invitation token.';
    END IF;

    -- Add or reactivate membership
    INSERT INTO public.system_memberships (system_id, user_id, role, status, joined_at)
    VALUES (v_inv.system_id, v_user_id, v_inv.role, 'active', now())
    ON CONFLICT (system_id, user_id) DO UPDATE
    SET status = 'active', role = v_inv.role;

    -- Mark invitation accepted
    UPDATE public.system_invitations
    SET status = 'accepted'
    WHERE id = v_inv.id;

    -- Audit log
    INSERT INTO public.audit_logs (system_id, actor_id, action_type, target_type, target_id, new_value)
    VALUES (
        v_inv.system_id,
        v_user_id,
        'MEMBER_JOINED',
        'system_memberships',
        v_user_id::TEXT,
        jsonb_build_object('token', p_token, 'role', v_inv.role)
    );

    RETURN jsonb_build_object('success', true, 'system_id', v_inv.system_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_system_invitation TO authenticated;
