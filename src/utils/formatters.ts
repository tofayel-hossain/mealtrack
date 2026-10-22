// ==============================================================================
// MEALTRACK: FORMATTERS & DATE/TIME UTILITIES
// Asia/Dhaka default timezone, BDT (৳) currency, and 2-meal cutoff helpers
// ==============================================================================

/**
 * Formats a monetary amount into BDT currency string
 */
export function formatCurrency(
  amount: number | null | undefined,
  symbol: string = '৳'
): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return `${symbol}0.00`;
  }
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  const formatted = absAmount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return isNegative ? `-${symbol}${formatted}` : `${symbol}${formatted}`;
}

/**
 * Formats meal rate with up to 4 decimal places
 */
export function formatMealRate(
  rate: number | null | undefined,
  symbol: string = '৳'
): string {
  if (rate === null || rate === undefined || isNaN(rate)) {
    return 'Unavailable';
  }
  return `${symbol}${rate.toFixed(4)}`;
}

/**
 * Formats an ISO date or YYYY-MM-DD into a localized readable date
 */
export function formatDate(
  dateStr: string | Date | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateStr) return '';
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (isNaN(d.getTime())) return String(dateStr);

  const defaultOptions: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Dhaka',
  };

  return d.toLocaleDateString('en-US', options || defaultOptions);
}

/**
 * Formats date and time in Asia/Dhaka timezone
 */
export function formatDateTime(dateStr: string | Date | undefined): string {
  if (!dateStr) return '';
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (isNaN(d.getTime())) return String(dateStr);

  return d.toLocaleString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Dhaka',
  });
}

/**
 * Formats a period string (YYYY-MM) into month name and year
 */
export function formatPeriodName(periodStr: string): string {
  if (!periodStr || !periodStr.includes('-')) return periodStr;
  const [year, month] = periodStr.split('-');
  const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * Get current date in Asia/Dhaka timezone formatted as YYYY-MM-DD
 */
export function getDhakaTodayDateString(): string {
  const now = new Date();
  return now.toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
}

/**
 * Evaluates cutoff time against current Dhaka time for a given slot (HH:MM:SS)
 */
function checkSlotCutoff(slotTimeStr: string, targetDateStr: string): { isPast: boolean; timeLeftText: string } {
  const todayStr = getDhakaTodayDateString();

  if (targetDateStr < todayStr) {
    return { isPast: true, timeLeftText: 'Passed' };
  }
  if (targetDateStr > todayStr) {
    return { isPast: false, timeLeftText: 'Open for tomorrow' };
  }

  const parts = slotTimeStr.split(':').map((s) => parseInt(s, 10));
  const cutoffHour = parts[0] ?? 10;
  const cutoffMinute = parts[1] ?? 0;
  const cutoffSecond = parts[2] ?? 0;

  const now = new Date();
  const dhakaTimeParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Dhaka',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  }).formatToParts(now);

  const curHour = parseInt(dhakaTimeParts.find((p) => p.type === 'hour')?.value || '0', 10);
  const curMin = parseInt(dhakaTimeParts.find((p) => p.type === 'minute')?.value || '0', 10);
  const curSec = parseInt(dhakaTimeParts.find((p) => p.type === 'second')?.value || '0', 10);

  const curSeconds = curHour * 3600 + curMin * 60 + curSec;
  const cutoffSeconds = cutoffHour * 3600 + cutoffMinute * 60 + cutoffSecond;

  const diff = cutoffSeconds - curSeconds;
  if (diff <= 0) {
    return { isPast: true, timeLeftText: 'Cutoff Passed' };
  }

  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  return { isPast: false, timeLeftText: `${h}h ${m}m left` };
}

/**
 * Sequential Day Cutoff Status for 2 Meals:
 * - Afternoon meal cutoff happens first (e.g. 10:00 AM)
 * - Night meal cutoff happens next (e.g. 5:00 PM)
 */
export function getMealCutoffInfo(params: {
  lunchCutoffTime?: string;  // Afternoon
  dinnerCutoffTime?: string; // Night
  targetDateStr?: string;
}): {
  isAfternoonPastCutoff: boolean;
  isNightPastCutoff: boolean;
  isFullPastCutoff: boolean;
  afternoonTimeLeft: string;
  nightTimeLeft: string;
  phase: 'before_afternoon' | 'between_cutoffs' | 'after_night';
  statusSummary: string;
} {
  const targetDate = params.targetDateStr || getDhakaTodayDateString();
  if (!params.lunchCutoffTime && !params.dinnerCutoffTime) {
    return {
      isAfternoonPastCutoff: false,
      isNightPastCutoff: false,
      isFullPastCutoff: false,
      afternoonTimeLeft: '',
      nightTimeLeft: '',
      phase: 'before_afternoon',
      statusSummary: '',
    };
  }

  const lunchTime = params.lunchCutoffTime || '23:59:59';
  const dinnerTime = params.dinnerCutoffTime || '23:59:59';

  const lunchStatus = checkSlotCutoff(lunchTime, targetDate);
  const dinnerStatus = checkSlotCutoff(dinnerTime, targetDate);

  const isAfternoonPastCutoff = lunchStatus.isPast;
  const isNightPastCutoff = dinnerStatus.isPast;
  const isFullPastCutoff = isAfternoonPastCutoff && isNightPastCutoff;

  let phase: 'before_afternoon' | 'between_cutoffs' | 'after_night' = 'before_afternoon';
  let statusSummary = `Afternoon: ${lunchStatus.timeLeftText} • Night: ${dinnerStatus.timeLeftText}`;

  if (isFullPastCutoff) {
    phase = 'after_night';
    statusSummary = 'All meal cutoffs passed for today';
  } else if (isAfternoonPastCutoff) {
    phase = 'between_cutoffs';
    statusSummary = `Afternoon locked • Night: ${dinnerStatus.timeLeftText}`;
  }

  return {
    isAfternoonPastCutoff,
    isNightPastCutoff,
    isFullPastCutoff,
    afternoonTimeLeft: lunchStatus.timeLeftText,
    nightTimeLeft: dinnerStatus.timeLeftText,
    phase,
    statusSummary,
  };
}

/**
 * Legacy wrapper
 */
export function getCutoffStatus(cutoffTimeStr: string = '10:00:00', targetDateStr?: string) {
  const targetDate = targetDateStr || getDhakaTodayDateString();
  const res = checkSlotCutoff(cutoffTimeStr, targetDate);
  return {
    isPastCutoff: res.isPast,
    timeLeftText: res.timeLeftText,
    hoursLeft: 0,
    minutesLeft: 0,
    secondsLeft: 0,
  };
}
