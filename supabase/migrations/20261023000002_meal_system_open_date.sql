-- ==============================================================================
-- MEALTRACK MIGRATION: MEAL SYSTEM OPEN DATE & DAY-BY-DAY MEAL ACCOUNTING
-- Adds meal_start_date column to public.system_settings
-- ==============================================================================

-- 1. Add meal_start_date to system_settings if it does not already exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'system_settings'
          AND column_name = 'meal_start_date'
    ) THEN
        ALTER TABLE public.system_settings
        ADD COLUMN meal_start_date DATE;
    END IF;
END $$;

COMMENT ON COLUMN public.system_settings.meal_start_date IS 'The official calendar start/open date for mess meal counting. Meals are tracked day by day starting from this date.';
