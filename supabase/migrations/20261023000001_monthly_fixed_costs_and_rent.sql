-- ==============================================================================
-- MEALTRACK: MONTHLY FIXED COSTS & MEMBER HOUSE RENT SCHEMA
-- ==============================================================================

-- 1. Monthly Fixed Shared Costs (Cook, WiFi, Electricity, Gas, Waste, etc.)
CREATE TABLE IF NOT EXISTS public.monthly_fixed_costs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_id UUID NOT NULL REFERENCES public.meal_systems(id) ON DELETE CASCADE,
    period TEXT NOT NULL, -- Format: YYYY-MM
    title TEXT NOT NULL,  -- e.g. 'Cook (Khala) Bill', 'WiFi Internet', 'Electricity', 'Gas'
    amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    category TEXT NOT NULL DEFAULT 'utility', -- 'cook', 'wifi', 'electricity', 'gas', 'waste', 'cleaning', 'other'
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Monthly Member House Rent (Variable per member)
CREATE TABLE IF NOT EXISTS public.monthly_member_rent (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_id UUID NOT NULL REFERENCES public.meal_systems(id) ON DELETE CASCADE,
    period TEXT NOT NULL, -- Format: YYYY-MM
    member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    house_rent NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(system_id, period, member_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_monthly_fixed_costs_system_period ON public.monthly_fixed_costs(system_id, period);
CREATE INDEX IF NOT EXISTS idx_monthly_member_rent_system_period ON public.monthly_member_rent(system_id, period);

-- Row Level Security (RLS)
ALTER TABLE public.monthly_fixed_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_member_rent ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view monthly fixed costs" ON public.monthly_fixed_costs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.system_memberships
            WHERE system_id = monthly_fixed_costs.system_id AND user_id = auth.uid() AND status = 'active'
        )
    );

CREATE POLICY "Managers can manage monthly fixed costs" ON public.monthly_fixed_costs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.system_memberships
            WHERE system_id = monthly_fixed_costs.system_id AND user_id = auth.uid() AND role = 'manager' AND status = 'active'
        )
    );

CREATE POLICY "Members can view monthly member rent" ON public.monthly_member_rent
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.system_memberships
            WHERE system_id = monthly_member_rent.system_id AND user_id = auth.uid() AND status = 'active'
        )
    );

CREATE POLICY "Managers can manage monthly member rent" ON public.monthly_member_rent
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.system_memberships
            WHERE system_id = monthly_member_rent.system_id AND user_id = auth.uid() AND role = 'manager' AND status = 'active'
        )
    );
