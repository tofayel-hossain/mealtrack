// ==============================================================================
// MEALTRACK: CORE ACCOUNTING MATHEMATICS ENGINE
// High-precision monetary and meal rate calculations for shared mess accounting.
// ==============================================================================

/**
 * Rounds a number to a fixed number of decimal places safely.
 */
export function roundToDecimals(value: number, decimals: number = 2): number {
  if (!isFinite(value) || isNaN(value)) return 0;
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/**
 * Calculates the monthly meal rate:
 * Monthly meal rate = eligible bazar expenses / finalized total meals
 * 
 * If total meals is zero or less, the meal rate is UNAVAILABLE (returns null).
 * Deposits, carried forward balances, and prior months NEVER affect meal rate.
 */
export function calculateMonthlyMealRate(
  eligibleBazarExpenses: number,
  finalizedTotalMeals: number
): number | null {
  if (!isFinite(finalizedTotalMeals) || finalizedTotalMeals <= 0) {
    return null;
  }
  if (!isFinite(eligibleBazarExpenses) || eligibleBazarExpenses < 0) {
    return 0;
  }
  return roundToDecimals(eligibleBazarExpenses / finalizedTotalMeals, 4);
}

/**
 * Calculates a member's meal cost for the period:
 * Member meal cost = finalized member meal count × monthly meal rate
 */
export function calculateMemberMealCost(
  memberMealCount: number,
  mealRate: number | null
): number {
  if (mealRate === null || !isFinite(mealRate) || mealRate <= 0) {
    return 0;
  }
  if (!isFinite(memberMealCount) || memberMealCount <= 0) {
    return 0;
  }
  return roundToDecimals(memberMealCount * mealRate, 2);
}

/**
 * Calculates a member's percentage contribution to total meals:
 * Member meal contribution = (member finalized meals / total finalized meals) * 100
 */
export function calculateMealContributionPercentage(
  memberMeals: number,
  totalMeals: number
): number {
  if (!isFinite(totalMeals) || totalMeals <= 0 || !isFinite(memberMeals) || memberMeals <= 0) {
    return 0;
  }
  return roundToDecimals((memberMeals / totalMeals) * 100, 2);
}

export interface BalanceCalculationInput {
  openingBalance: number;
  deposits: number;
  personalBazarCredits: number;
  positiveAdjustments?: number;
  mealCost: number;
  sharedFixedCost?: number; // Shared mess fixed bills (cook, wifi, electricity, etc.)
  houseRent?: number;        // Individual room/seat rent
  negativeAdjustments?: number;
  otherCharges?: number;
}

/**
 * Calculates member closing balance using standard convention:
 * Positive (+) = Available Credit (advance paid / surplus)
 * Negative (-) = Outstanding Debt (owed to mess / need to pay)
 * 
 * Total Billed = meal costs + shared fixed costs + house rent + other charges + negative adjustments
 * Total Paid = opening balance + deposits + personal bazar credits + positive adjustments
 * Closing balance = Total Paid - Total Billed
 */
export function calculateClosingBalance(input: BalanceCalculationInput): number {
  const opening = Number(input.openingBalance) || 0;
  const deposits = Number(input.deposits) || 0;
  const personalCredits = Number(input.personalBazarCredits) || 0;
  const posAdj = Number(input.positiveAdjustments) || 0;
  const mealCost = Number(input.mealCost) || 0;
  const sharedFixed = Number(input.sharedFixedCost) || 0;
  const rent = Number(input.houseRent) || 0;
  const negAdj = Number(input.negativeAdjustments) || 0;
  const otherCharges = Number(input.otherCharges) || 0;

  const totalCredits = opening + deposits + personalCredits + posAdj;
  const totalDebits = mealCost + sharedFixed + rent + negAdj + otherCharges;

  return roundToDecimals(totalCredits - totalDebits, 2);
}

/**
 * Calculates net payable amount for a member:
 * If closing balance is negative, member owes that amount to the mess.
 * If positive, member has advance surplus credit.
 */
export function calculateNetPayable(closingBalance: number): {
  amountNeedToPay: number;
  surplusAdvance: number;
  status: 'need_to_pay' | 'surplus' | 'settled';
} {
  const rounded = roundToDecimals(closingBalance, 2);
  if (rounded < -0.005) {
    return {
      amountNeedToPay: Math.abs(rounded),
      surplusAdvance: 0,
      status: 'need_to_pay',
    };
  }
  if (rounded > 0.005) {
    return {
      amountNeedToPay: 0,
      surplusAdvance: rounded,
      status: 'surplus',
    };
  }
  return {
    amountNeedToPay: 0,
    surplusAdvance: 0,
    status: 'settled',
  };
}

/**
 * Evaluates whether a balance is credit, debt, or settled
 */
export function getBalanceStatus(balance: number): 'credit' | 'debt' | 'settled' {
  const rounded = roundToDecimals(balance, 2);
  if (rounded > 0.005) return 'credit';
  if (rounded < -0.005) return 'debt';
  return 'settled';
}

/**
 * Computes effective meal count for a day:
 * 2 meals: Afternoon (Lunch) and Night (Dinner).
 * Can be cut one-by-one or cut full meal.
 * No-cooking day cancels both and charges 0 meals.
 */
export function computeEffectiveMealCount(params: {
  cookingStatus: 'cooking' | 'no_cooking' | 'pending';
  isTurnedOff?: boolean;
  lunchTurnedOff?: boolean;
  dinnerTurnedOff?: boolean;
  lunchCount?: number;
  dinnerCount?: number;
  mealCount?: number;
  defaultMeals?: number;
}): number {
  // A no-cooking day ALWAYS overrides and results in 0 meals charged
  if (params.cookingStatus === 'no_cooking') {
    return 0;
  }
  // If full day meal is turned off, 0 meals
  if (params.isTurnedOff) {
    return 0;
  }

  // Check slots (cut one-by-one)
  const defaultPerSlot = (params.defaultMeals ?? 2.0) / 2;
  const lunch = params.lunchTurnedOff ? 0 : (params.lunchCount ?? defaultPerSlot);
  const dinner = params.dinnerTurnedOff ? 0 : (params.dinnerCount ?? defaultPerSlot);

  // If slot info was provided
  if (params.lunchTurnedOff !== undefined || params.dinnerTurnedOff !== undefined || params.lunchCount !== undefined || params.dinnerCount !== undefined) {
    return Math.max(0, lunch + dinner);
  }

  // Fallback to legacy total meal count if slots not specified
  const count = typeof params.mealCount === 'number' && !isNaN(params.mealCount)
    ? params.mealCount
    : (params.defaultMeals ?? 2.0);

  return Math.max(0, count);
}

/**
 * Calculates day-by-day period range, effective open date, and elapsed days.
 * Prevents showing all month meals at the beginnings before days actually happen.
 */
export function calculatePeriodDayRange(params: {
  period: string;               // YYYY-MM
  mealOpenDate?: string | null; // YYYY-MM-DD
  todayDateStr: string;         // YYYY-MM-DD
}): {
  startDate: string;
  endDate: string;
  totalDaysInPeriod: number;
  effectiveOpenDate: string;
  maxCountDate: string;
  daysElapsed: number;
  isCurrentPeriod: boolean;
  isPastPeriod: boolean;
  isFuturePeriod: boolean;
} {
  const { period, mealOpenDate, todayDateStr } = params;
  const [y, m] = period.split('-').map(Number);
  const totalDaysInPeriod = new Date(y, m, 0).getDate();
  const startDate = `${period}-01`;
  const endDate = `${period}-${String(totalDaysInPeriod).padStart(2, '0')}`;

  const currentPeriod = todayDateStr.slice(0, 7);
  const isCurrentPeriod = period === currentPeriod;
  const isPastPeriod = period < currentPeriod;
  const isFuturePeriod = period > currentPeriod;

  // Determine effective open date
  let effectiveOpenDate = mealOpenDate && mealOpenDate >= startDate && mealOpenDate <= endDate
    ? mealOpenDate
    : startDate;

  // Determine the latest date to count meals for
  let maxCountDate: string;
  if (isCurrentPeriod) {
    maxCountDate = todayDateStr;
  } else if (isPastPeriod) {
    maxCountDate = endDate;
  } else {
    maxCountDate = `${period}-00`; // Future month -> 0 days
  }

  // Count active days elapsed between effectiveOpenDate and maxCountDate
  let daysElapsed = 0;
  if (effectiveOpenDate <= maxCountDate) {
    const startDay = parseInt(effectiveOpenDate.slice(8, 10), 10);
    const maxDay = Math.min(totalDaysInPeriod, parseInt(maxCountDate.slice(8, 10), 10));
    daysElapsed = Math.max(0, maxDay - startDay + 1);
  }

  return {
    startDate,
    endDate,
    totalDaysInPeriod,
    effectiveOpenDate,
    maxCountDate,
    daysElapsed,
    isCurrentPeriod,
    isPastPeriod,
    isFuturePeriod,
  };
}

/**
 * Validates whether a monthly period is ready for finalization.
 */
export interface FinalizationChecklistResult {
  canFinalize: boolean;
  warnings: string[];
  blockers: string[];
  summary: {
    totalExpenses: number;
    totalMeals: number;
    mealRate: number | null;
    memberCount: number;
    hasZeroMealRate: boolean;
  };
}

export function validateMonthlyFinalization(params: {
  totalBazarExpenses: number;
  totalFinalizedMeals: number;
  unresolvedCookingDaysCount: number;
  unreceiptedExpensesCount: number;
  memberCount: number;
}): FinalizationChecklistResult {
  const warnings: string[] = [];
  const blockers: string[] = [];

  if (params.memberCount <= 0) {
    blockers.push('No active members found in this meal system.');
  }

  if (params.unresolvedCookingDaysCount > 0) {
    warnings.push(`${params.unresolvedCookingDaysCount} cooking day(s) have "Pending Confirmation" status.`);
  }

  if (params.unreceiptedExpensesCount > 0) {
    warnings.push(`${params.unreceiptedExpensesCount} bazar expense(s) have no receipt or explanation.`);
  }

  if (params.totalBazarExpenses < 0) {
    blockers.push('Total bazar expenses cannot be negative.');
  }

  const hasZeroMealRate = params.totalFinalizedMeals <= 0;
  if (hasZeroMealRate) {
    warnings.push('Total finalized meals is zero. Meal rate will be marked as Unavailable.');
  }

  const mealRate = calculateMonthlyMealRate(params.totalBazarExpenses, params.totalFinalizedMeals);

  return {
    canFinalize: blockers.length === 0,
    warnings,
    blockers,
    summary: {
      totalExpenses: roundToDecimals(params.totalBazarExpenses, 2),
      totalMeals: roundToDecimals(params.totalFinalizedMeals, 2),
      mealRate,
      memberCount: params.memberCount,
      hasZeroMealRate,
    },
  };
}
