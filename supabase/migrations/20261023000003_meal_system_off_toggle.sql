-- ==============================================================================
-- MEALTRACK: MASTER MEAL SYSTEM OFF TOGGLE
-- Adds is_meal_system_off and meal_system_off_date to public.system_settings
-- ==============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'system_settings'
          AND column_name = 'is_meal_system_off'
    ) THEN
        ALTER TABLE public.system_settings
        ADD COLUMN is_meal_system_off BOOLEAN NOT NULL DEFAULT false;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'system_settings'
          AND column_name = 'meal_system_off_date'
    ) THEN
        ALTER TABLE public.system_settings
        ADD COLUMN meal_system_off_date DATE;
    END IF;
END $$;

COMMENT ON COLUMN public.system_settings.is_meal_system_off IS 'When true, the entire meal system is turned off and all meals count as 0 until opened by manager.';
COMMENT ON COLUMN public.system_settings.meal_system_off_date IS 'Date when the meal system was turned off.';
