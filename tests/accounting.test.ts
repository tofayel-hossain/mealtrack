import { describe, it, expect } from 'vitest';
import {
  calculateMonthlyMealRate,
  calculateMemberMealCost,
  calculateMealContributionPercentage,
  calculateClosingBalance,
  getBalanceStatus,
  computeEffectiveMealCount,
  validateMonthlyFinalization,
} from '../src/utils/accounting';

describe('Meal Hisab Accounting Calculations', () => {
  describe('Monthly Meal Rate Calculation', () => {
    it('calculates exact meal rate for normal expenses and meals', () => {
      const rate = calculateMonthlyMealRate(10000, 200);
      expect(rate).toBe(50);
    });

    it('calculates fractional meals and rounds accurately', () => {
      const rate = calculateMonthlyMealRate(12530.5, 247.5);
      expect(rate).toBe(50.6283);
    });

    it('returns null (unavailable) when finalized total meals is zero', () => {
      const rateZero = calculateMonthlyMealRate(5000, 0);
      expect(rateZero).toBeNull();

      const rateNegative = calculateMonthlyMealRate(5000, -5);
      expect(rateNegative).toBeNull();
    });

    it('ensures deposits and previous-month balances never affect current meal rate', () => {
      const eligibleBazarExpenses = 15000;
      const totalFinalizedMeals = 300;
      const rate = calculateMonthlyMealRate(eligibleBazarExpenses, totalFinalizedMeals);
      expect(rate).toBe(50.0);
    });
  });

  describe('Member Meal Cost & Contribution Percentage', () => {
    it('calculates member meal cost correctly', () => {
      const mealRate = 52.45;
      const memberMeals = 45;
      const cost = calculateMemberMealCost(memberMeals, mealRate);
      expect(cost).toBe(2360.25);
    });

    it('returns 0 cost if meal rate is unavailable (null) or meals is 0', () => {
      expect(calculateMemberMealCost(40, null)).toBe(0);
      expect(calculateMemberMealCost(0, 52.45)).toBe(0);
    });

    it('calculates contribution percentage correctly', () => {
      const pct = calculateMealContributionPercentage(60, 300);
      expect(pct).toBe(20.0);

      const fractionalPct = calculateMealContributionPercentage(33.5, 100);
      expect(fractionalPct).toBe(33.5);
    });

    it('returns 0% when total meals is zero', () => {
      expect(calculateMealContributionPercentage(10, 0)).toBe(0);
    });
  });

  describe('Monthly Balances and Carry-Forward', () => {
    it('computes closing balance correctly with standard convention (positive = credit, negative = debt)', () => {
      const closing = calculateClosingBalance({
        openingBalance: 500,
        deposits: 2000,
        personalBazarCredits: 0,
        positiveAdjustments: 0,
        mealCost: 1800,
      });
      expect(closing).toBe(700);
      expect(getBalanceStatus(closing)).toBe('credit');
    });

    it('implements the exact user specification example correctly', () => {
      const octoberClosing = -500;
      const novemberOpening = octoberClosing;

      const balanceBeforeDeposit = calculateClosingBalance({
        openingBalance: novemberOpening,
        deposits: 0,
        personalBazarCredits: 0,
        positiveAdjustments: 0,
        mealCost: 1200,
      });
      expect(balanceBeforeDeposit).toBe(-1700);

      const balanceAfterDeposit = calculateClosingBalance({
        openingBalance: novemberOpening,
        deposits: 1000,
        personalBazarCredits: 0,
        positiveAdjustments: 0,
        mealCost: 1200,
      });
      expect(balanceAfterDeposit).toBe(-700);
      expect(getBalanceStatus(balanceAfterDeposit)).toBe('debt');
    });

    it('handles personal bazar credits properly without double-counting', () => {
      const balance = calculateClosingBalance({
        openingBalance: 0,
        deposits: 0,
        personalBazarCredits: 2400,
        positiveAdjustments: 0,
        mealCost: 1500,
      });
      expect(balance).toBe(900);
      expect(getBalanceStatus(balance)).toBe('credit');
    });

    it('carries forward positive credits into next month opening balance', () => {
      const m1Closing = 1500;
      const m2Opening = m1Closing;
      const m2Closing = calculateClosingBalance({
        openingBalance: m2Opening,
        deposits: 1000,
        personalBazarCredits: 0,
        positiveAdjustments: 0,
        mealCost: 2000,
      });
      expect(m2Closing).toBe(500);
    });
  });

  describe('2 Meals (Afternoon & Night) Slot and Cutoff Rules', () => {
    it('normal active day has 2 meals (1 afternoon + 1 night)', () => {
      const meals = computeEffectiveMealCount({
        cookingStatus: 'cooking',
        lunchTurnedOff: false,
        dinnerTurnedOff: false,
        lunchCount: 1,
        dinnerCount: 1,
      });
      expect(meals).toBe(2);
    });

    it('cuts afternoon meal one-by-one leaving night meal (1 meal charged)', () => {
      const meals = computeEffectiveMealCount({
        cookingStatus: 'cooking',
        lunchTurnedOff: true,  // Afternoon cut
        dinnerTurnedOff: false, // Night on
        lunchCount: 1,
        dinnerCount: 1,
      });
      expect(meals).toBe(1);
    });

    it('cuts night meal one-by-one leaving afternoon meal (1 meal charged)', () => {
      const meals = computeEffectiveMealCount({
        cookingStatus: 'cooking',
        lunchTurnedOff: false, // Afternoon on
        dinnerTurnedOff: true,  // Night cut
        lunchCount: 1,
        dinnerCount: 1,
      });
      expect(meals).toBe(1);
    });

    it('cuts full meal when member turns off the meal for the day (0 meals charged)', () => {
      const meals = computeEffectiveMealCount({
        cookingStatus: 'cooking',
        isTurnedOff: true, // Full meal off
        lunchCount: 1,
        dinnerCount: 1,
      });
      expect(meals).toBe(0);
    });

    it('forces meal count to 0 on a no-cooking day regardless of slot status', () => {
      const meals = computeEffectiveMealCount({
        cookingStatus: 'no_cooking',
        lunchTurnedOff: false,
        dinnerTurnedOff: false,
        lunchCount: 1,
        dinnerCount: 1,
      });
      expect(meals).toBe(0);
    });
  });

  describe('Monthly Finalization Validation Checklist', () => {
    it('blocks finalization if there are no members or negative expenses', () => {
      const resultNoMembers = validateMonthlyFinalization({
        totalBazarExpenses: 5000,
        totalFinalizedMeals: 100,
        unresolvedCookingDaysCount: 0,
        unreceiptedExpensesCount: 0,
        memberCount: 0,
      });
      expect(resultNoMembers.canFinalize).toBe(false);
      expect(resultNoMembers.blockers).toContain('No active members found in this meal system.');
    });

    it('allows finalization with warnings if pending days or zero meals exist', () => {
      const result = validateMonthlyFinalization({
        totalBazarExpenses: 0,
        totalFinalizedMeals: 0,
        unresolvedCookingDaysCount: 2,
        unreceiptedExpensesCount: 1,
        memberCount: 4,
      });
      expect(result.canFinalize).toBe(true);
      expect(result.warnings.length).toBeGreaterThanOrEqual(2);
      expect(result.summary.hasZeroMealRate).toBe(true);
      expect(result.summary.mealRate).toBeNull();
    });
  });
});
