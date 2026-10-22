// ==============================================================================
// MEALTRACK: CSV EXPORT UTILITY
// Generates standardized, formatted CSV reports for transparency and audits.
// ==============================================================================

import type { BazarExpense, MonthlyMemberSummary } from '../types';

/**
 * Escapes a cell value for standard CSV compatibility.
 */
function escapeCsv(val: any): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Triggers a browser download of CSV string.
 */
function downloadCsv(csvContent: string, filename: string) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports itemized Bazar Expenses to CSV
 */
export function exportBazarExpensesToCsv(
  expenses: BazarExpense[],
  filename = 'mealtrack-bazar-expenses.csv'
) {
  const headers = [
    'Date',
    'Category',
    'Description',
    'Amount (BDT)',
    'Purchaser',
    'Funding Source',
    'Shop / Vendor',
    'Receipt Available',
    'Missing Reason',
    'Status',
  ];

  const rows = expenses.map((exp) => [
    escapeCsv(exp.date),
    escapeCsv(exp.category),
    escapeCsv(exp.description),
    escapeCsv(exp.amount.toFixed(2)),
    escapeCsv(exp.purchaser_name || exp.purchaser_id),
    escapeCsv(exp.funding_source === 'personal_credit' ? 'Personally Paid (Credit)' : 'Shared Mess Fund'),
    escapeCsv(exp.shop_name || 'N/A'),
    escapeCsv(exp.receipt_url ? 'Yes' : 'No'),
    escapeCsv(exp.no_receipt_reason || ''),
    escapeCsv(exp.is_reversed ? `REVERSED: ${exp.reversal_reason || ''}` : 'Active'),
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  downloadCsv(csvContent, filename);
}

/**
 * Exports Monthly Accounting Member Breakdown & Balances to CSV
 */
export function exportMonthlySummaryToCsv(
  period: string,
  members: MonthlyMemberSummary[],
  totalExpenses: number,
  totalMeals: number,
  mealRate: number | null,
  filename = `mealtrack-monthly-statement-${period}.csv`
) {
  const meta = [
    ['Accounting Period', escapeCsv(period)],
    ['Total Eligible Bazar Expenses (BDT)', escapeCsv(totalExpenses.toFixed(2))],
    ['Total Finalized Meals', escapeCsv(totalMeals.toFixed(2))],
    ['Calculated Meal Rate (BDT)', escapeCsv(mealRate !== null ? mealRate.toFixed(4) : 'Unavailable')],
    [],
  ];

  const headers = [
    'Member Name',
    'Finalized Meals',
    'Contribution (%)',
    'Meal Cost (BDT)',
    'Shared Fixed Bills (BDT)',
    'House Rent (BDT)',
    'Total Billed (BDT)',
    'Opening Balance (BDT)',
    'Deposits Paid (BDT)',
    'Bazar Shopped (BDT)',
    'Adjustments (BDT)',
    'Need to Pay (Due) (BDT)',
    'Closing Balance (BDT)',
    'Status',
  ];

  const rows = members.map((m) => [
    escapeCsv(m.member_name),
    escapeCsv(m.meal_count.toFixed(2)),
    escapeCsv(`${m.meal_contribution_pct.toFixed(2)}%`),
    escapeCsv(m.meal_cost.toFixed(2)),
    escapeCsv((m.shared_fixed_cost || 0).toFixed(2)),
    escapeCsv((m.house_rent || 0).toFixed(2)),
    escapeCsv((m.total_billed || 0).toFixed(2)),
    escapeCsv(m.opening_balance.toFixed(2)),
    escapeCsv(m.deposits.toFixed(2)),
    escapeCsv((m.total_bazar_done || 0).toFixed(2)),
    escapeCsv((m.positive_adjustments - m.negative_adjustments).toFixed(2)),
    escapeCsv((m.amount_need_to_pay || 0).toFixed(2)),
    escapeCsv(m.closing_balance.toFixed(2)),
    escapeCsv(m.amount_need_to_pay > 0 ? `Need to Pay (${m.amount_need_to_pay.toFixed(2)})` : m.surplus_advance > 0 ? `Advance (+${m.surplus_advance.toFixed(2)})` : 'Settled'),
  ]);

  const metaString = meta.map((m) => m.join(',')).join('\r\n');
  const tableString = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const csvContent = `${metaString}\r\n${tableString}`;

  downloadCsv(csvContent, filename);
}
