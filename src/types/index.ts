// ==============================================================================
// MEALTRACK: DOMAIN TYPES & INTERFACES
// ==============================================================================

export type UserRole = 'manager' | 'member';
export type MembershipStatus = 'active' | 'inactive' | 'left';
export type CookingStatus = 'cooking' | 'no_cooking' | 'pending';
export type FundingSource = 'shared_fund' | 'personal_credit';

export type ExpenseCategory =
  | 'rice'
  | 'vegetables'
  | 'fish'
  | 'meat'
  | 'eggs'
  | 'oil'
  | 'spices'
  | 'snacks'
  | 'household'
  | 'other';

export type PaymentMethod =
  | 'cash'
  | 'bkash'
  | 'nagad'
  | 'rocket'
  | 'bank_transfer'
  | 'other';

export type LedgerTransactionType =
  | 'opening_balance'
  | 'deposit'
  | 'personal_bazar_credit'
  | 'meal_charge'
  | 'adjustment'
  | 'reversal';

export type AccountingPeriodStatus = 'open' | 'finalized' | 'reopened';

export interface UserProfile {
  id: string;
  email?: string;
  full_name: string;
  phone?: string | null;
  avatar_url?: string | null;
  created_at?: string;
}

export interface MealSystem {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  created_by: string;
  created_at: string;
  updated_at?: string;
}

export interface SystemSettings {
  system_id: string;
  currency_symbol: string;
  currency_code: string;
  timezone: string;
  default_daily_meals: number; // 2 meals (Afternoon + Night)
  lunch_cutoff_time?: string;  // Afternoon meal cutoff, e.g. "10:00:00"
  dinner_cutoff_time?: string; // Night meal cutoff, e.g. "17:00:00"
  cutoff_time?: string;        // Fallback / legacy
  allow_custom_meals: boolean;
  auto_assign_meals: boolean;
  meal_start_date?: string | null; // Date when mess meals started / opened (YYYY-MM-DD)
  updated_at?: string;
}

export interface SystemMembership {
  id: string;
  system_id: string;
  user_id: string;
  role: UserRole;
  status: MembershipStatus;
  joined_at: string;
  profile?: UserProfile;
}

export interface SystemInvitation {
  id: string;
  system_id: string;
  token: string;
  role: UserRole;
  invited_by: string;
  email?: string | null;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  expires_at: string;
  created_at: string;
  system_name?: string;
}

export interface CookingDay {
  id: string;
  system_id: string;
  date: string; // YYYY-MM-DD
  status: CookingStatus;
  note?: string | null;
  updated_by?: string | null;
  updated_at?: string;
}

export interface DailyMealRecord {
  id: string;
  system_id: string;
  member_id: string;
  date: string; // YYYY-MM-DD
  // 2 meals: Afternoon & Night
  lunch_count?: number;        // Afternoon meal count (1.0 or 0)
  dinner_count?: number;       // Night meal count (1.0 or 0)
  lunch_turned_off?: boolean;  // Afternoon meal cut
  dinner_turned_off?: boolean; // Night meal cut
  meal_count: number;          // Total = lunch_count + dinner_count
  is_turned_off: boolean;      // Full day cut (both lunch & dinner cut)
  is_post_cutoff_change: boolean;
  previous_value?: number | null;
  change_reason?: string | null;
  changed_by?: string | null;
  created_at?: string;
  updated_at?: string;
  member_name?: string;
}

export interface BazarExpense {
  id: string;
  system_id: string;
  date: string; // YYYY-MM-DD
  category: ExpenseCategory;
  description: string;
  amount: number;
  shop_name?: string | null;
  purchaser_id: string;
  created_by: string;
  funding_source: FundingSource;
  receipt_url?: string | null;
  no_receipt_reason?: string | null;
  is_reversed: boolean;
  reversal_reason?: string | null;
  reversed_at?: string | null;
  reversed_by?: string | null;
  created_at: string;
  purchaser_name?: string;
}

export interface Deposit {
  id: string;
  system_id: string;
  member_id: string;
  amount: number;
  date: string; // YYYY-MM-DD
  payment_method: PaymentMethod;
  transaction_reference?: string | null;
  note?: string | null;
  recorded_by: string;
  is_reversed: boolean;
  reversal_reason?: string | null;
  reversed_at?: string | null;
  reversed_by?: string | null;
  created_at: string;
  member_name?: string;
  recorder_name?: string;
}

export interface FinancialAdjustment {
  id: string;
  system_id: string;
  member_id: string;
  amount: number; // positive = credit, negative = debit
  reason: string;
  accounting_period: string; // YYYY-MM
  date: string;
  authorized_by: string;
  created_at: string;
  member_name?: string;
}

export interface FinancialLedgerEntry {
  id: string;
  system_id: string;
  member_id: string;
  transaction_type: LedgerTransactionType;
  amount: number; // positive = credit (increases balance), negative = charge (decreases)
  reference_id?: string | null;
  accounting_period: string; // YYYY-MM
  date: string;
  description: string;
  created_by?: string | null;
  created_at: string;
  member_name?: string;
}

export interface AccountingPeriod {
  id: string;
  system_id: string;
  period: string; // YYYY-MM
  status: AccountingPeriodStatus;
  finalized_at?: string | null;
  finalized_by?: string | null;
  version: number;
  total_bazar_expense: number;
  total_finalized_meals: number;
  meal_rate: number | null; // null if 0 meals
  notes?: string | null;
}

export type FixedCostCategory = 'cook' | 'wifi' | 'electricity' | 'gas' | 'waste' | 'cleaning' | 'other';

export interface FixedCostItem {
  id: string;
  system_id?: string;
  period?: string;
  title: string;
  amount: number;
  category: FixedCostCategory;
}

export interface MemberRentItem {
  member_id: string;
  house_rent: number;
  member_name?: string;
}

export interface MonthlyCostsConfig {
  period: string;
  mealOpenDate?: string;              // YYYY-MM-DD when meals started/opened for this month
  fixedCosts: FixedCostItem[];
  totalFixedCost: number;
  perMemberFixedCost: number;
  memberRents: Record<string, number>; // member_id -> house_rent
}

export interface MonthlyMemberSummary {
  member_id: string;
  member_name: string;
  opening_balance: number;
  deposits: number;
  personal_bazar_credits: number;
  total_bazar_done: number; // Total value of groceries purchased by this member (shared + personal)
  bazar_trips_count: number;
  meal_count: number;
  meal_cost: number;
  meal_contribution_pct: number;
  shared_fixed_cost: number; // Equal per-member share of mess bills (cook, wifi, electricity, etc.)
  house_rent: number;        // Individual room/seat rent set by manager
  total_billed: number;      // meal_cost + shared_fixed_cost + house_rent + other_charges
  total_paid: number;        // deposits + personal_bazar_credits + opening_balance + positive_adjustments
  amount_need_to_pay: number;// If total_billed > total_paid: exact net amount member must pay to mess
  surplus_advance: number;   // If total_paid > total_billed: advance surplus credit
  positive_adjustments: number;
  negative_adjustments: number;
  other_charges: number;
  closing_balance: number;   // total_paid - total_billed (positive = credit, negative = debt)
  balance_status: 'credit' | 'debt' | 'settled';
}

export interface MonthlyAccountingSummary {
  period: string; // YYYY-MM
  status: AccountingPeriodStatus;
  version: number;
  meal_open_date: string;           // Date when meals started for this period (YYYY-MM-DD)
  days_elapsed: number;             // Count of days counted so far (day by day)
  total_days_in_period: number;     // Total calendar days in the month
  total_expenses: number;
  total_meals: number;
  meal_rate: number | null;
  is_meal_rate_available: boolean;
  total_deposits: number;
  total_personal_credits: number;
  // Account & Fund Ledger Metrics
  total_shared_fund_spent: number;  // Shared bazar + shared fixed costs paid from mess fund
  fund_balance_remaining: number;   // Total Deposits - Total Shared Fund Spent (Cash in hand)
  total_fixed_costs: number;        // Sum of cook, wifi, utility bills for the month
  per_member_fixed_cost: number;    // Equal share divided among active members
  total_house_rent: number;         // Total house rent sum across all members
  total_amount_due: number;         // Sum of amount_need_to_pay across all members
  members: MonthlyMemberSummary[];
  fixed_costs_items: FixedCostItem[];
  finalized_at?: string | null;
  finalized_by_name?: string | null;
  notes?: string | null;
}

export interface MonthlyReportSnapshot {
  id: string;
  system_id: string;
  period: string;
  version: number;
  finalized_at: string;
  finalized_by: string;
  reason?: string | null;
  summary_data: {
    period: string;
    version: number;
    total_bazar_expenses: number;
    total_finalized_meals: number;
    meal_rate: number | null;
    finalized_at: string;
    finalized_by_name?: string;
  };
  member_balances: MonthlyMemberSummary[];
  created_at: string;
}

export interface AuditLogEntry {
  id: string;
  system_id: string;
  actor_id: string;
  actor_name?: string;
  action_type: string;
  target_type: string;
  target_id?: string | null;
  previous_value?: Record<string, any> | null;
  new_value?: Record<string, any> | null;
  reason?: string | null;
  created_at: string;
}

export interface SystemNotification {
  id: string;
  system_id: string;
  user_id?: string | null;
  type: string;
  title: string;
  message: string;
  link?: string | null;
  is_read: boolean;
  created_at: string;
}
