/**
 * schedule-utils.ts
 * Centralized sending-window, timezone, and follow-up scheduling calculation utilities.
 */

export interface SendingWindowConfig {
  sendWindowStart?: string; // "09:00" in 24h format
  sendWindowEnd?: string;   // "17:00" in 24h format
  sendWindowTz?: string;    // e.g. "Asia/Kolkata", "America/New_York", "UTC"
  sendWindowDays?: number[] | string; // [1, 2, 3, 4, 5] (1 = Mon, 7 = Sun)
}

const DEFAULT_DAYS = [1, 2, 3, 4, 5]; // Mon - Fri

export function normalizeAllowedDays(days?: number[] | string | null): number[] {
  if (!days) return DEFAULT_DAYS;
  if (Array.isArray(days)) return days.map(Number);
  if (typeof days === 'string') {
    try {
      const parsed = JSON.parse(days);
      if (Array.isArray(parsed)) return parsed.map(Number);
    } catch {}
  }
  return DEFAULT_DAYS;
}

/**
 * Extract time parts in the target timezone for a given Date object.
 */
export function getTimePartsInTimezone(date: Date, timeZone: string): {
  year: number;
  month: number; // 1-12
  day: number;   // 1-31
  hour: number;  // 0-23
  minute: number;// 0-59
  second: number;// 0-59
  weekdayNumber: number; // 1 = Mon ... 7 = Sun
  weekdayShort: string;  // "Mon"
  timeString24: string;  // "09:30"
} {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone || 'UTC',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      weekday: 'short',
    });

    const parts = formatter.formatToParts(date);
    const p: Record<string, string> = {};
    for (const part of parts) {
      p[part.type] = part.value;
    }

    const dayMap: Record<string, number> = {
      Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7,
    };

    const weekdayShort = p.weekday || 'Mon';
    const weekdayNumber = dayMap[weekdayShort] || 1;
    const hour = parseInt(p.hour || '0', 10);
    const minute = parseInt(p.minute || '0', 10);
    const second = parseInt(p.second || '0', 10);
    const month = parseInt(p.month || '1', 10);
    const day = parseInt(p.day || '1', 10);
    const year = parseInt(p.year || String(new Date().getFullYear()), 10);

    const timeString24 = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

    return {
      year,
      month,
      day,
      hour,
      minute,
      second,
      weekdayNumber,
      weekdayShort,
      timeString24,
    };
  } catch (e) {
    // Fallback if invalid timezone
    const d = new Date(date);
    const dayMap = [7, 1, 2, 3, 4, 5, 6];
    const weekdayNumber = dayMap[d.getUTCDay()] || 1;
    const hour = d.getUTCHours();
    const minute = d.getUTCMinutes();
    const second = d.getUTCSeconds();
    return {
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
      hour,
      minute,
      second,
      weekdayNumber,
      weekdayShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()],
      timeString24: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    };
  }
}

/**
 * Check whether a given Date is currently inside the allowed sending window and allowed days.
 */
export function isDateInsideSendWindow(
  date: Date,
  config: SendingWindowConfig
): boolean {
  const windowStart = config.sendWindowStart || '09:00';
  const windowEnd = config.sendWindowEnd || '17:00';
  const tz = config.sendWindowTz || 'UTC';
  const allowedDays = normalizeAllowedDays(config.sendWindowDays);

  const parts = getTimePartsInTimezone(date, tz);

  // Check allowed weekday
  if (!allowedDays.includes(parts.weekdayNumber)) {
    return false;
  }

  // Check allowed time range (windowStart <= time <= windowEnd)
  if (parts.timeString24 < windowStart || parts.timeString24 > windowEnd) {
    return false;
  }

  return true;
}

/**
 * Helper to construct a Date in a specific timezone for a specific year, month, day, hour, minute.
 */
function createDateInTimezone(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  // Approximate with UTC first
  const approxUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  
  // Calculate timezone offset at this approximate time
  try {
    const tzParts = getTimePartsInTimezone(approxUtc, timeZone);
    const localAsUtc = Date.UTC(tzParts.year, tzParts.month - 1, tzParts.day, tzParts.hour, tzParts.minute, tzParts.second);
    const offsetMs = localAsUtc - approxUtc.getTime();
    
    // Target UTC timestamp = desired local representation minus offset
    const desiredLocalAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
    return new Date(desiredLocalAsUtc - offsetMs);
  } catch {
    return approxUtc;
  }
}

/**
 * Calculate the exact next eligible Date that falls inside the campaign's allowed sending window and allowed days.
 * 
 * - If baseDate is inside the window, returns baseDate.
 * - If baseDate is on an allowed day but before windowStart, returns today at windowStart.
 * - If baseDate is after windowEnd or on a disallowed day, scans forward day-by-day to the next allowed day at windowStart.
 */
export function calculateNextEligibleSendTime(
  baseDate: Date,
  config: SendingWindowConfig
): Date {
  const windowStart = config.sendWindowStart || '09:00';
  const windowEnd = config.sendWindowEnd || '17:00';
  const tz = config.sendWindowTz || 'UTC';
  const allowedDays = normalizeAllowedDays(config.sendWindowDays);

  const [startHour, startMinute] = windowStart.split(':').map(Number);

  let checkDate = new Date(baseDate);

  // Search forward up to 14 days
  for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
    const parts = getTimePartsInTimezone(checkDate, tz);
    const isAllowedDay = allowedDays.includes(parts.weekdayNumber);

    if (isAllowedDay) {
      if (dayOffset === 0) {
        // Today: check if inside window
        if (parts.timeString24 >= windowStart && parts.timeString24 <= windowEnd) {
          return checkDate;
        }
        // If earlier than windowStart today
        if (parts.timeString24 < windowStart) {
          return createDateInTimezone(parts.year, parts.month, parts.day, startHour, startMinute, tz);
        }
      } else {
        // Future day: start at windowStart
        return createDateInTimezone(parts.year, parts.month, parts.day, startHour, startMinute, tz);
      }
    }

    // Advance 1 calendar day
    checkDate = new Date(checkDate.getTime() + 24 * 60 * 60 * 1000);
  }

  return baseDate;
}

/**
 * Calculate the scheduled execution time for a follow-up step.
 * 
 * - Base date = previousStepSentAt + delayDays
 * - Targeted at followUpSendTime (e.g. "10:00") in followUpSendTimeTz
 * - Validates against campaign's sending window & allowed days (adjusting forward if needed).
 */
export function calculateFollowupScheduledTime(params: {
  previousStepSentAt: Date | string;
  delayDays: number;
  sendTime?: string; // "10:00" in 24h
  sendTimeTz?: string; // "Asia/Kolkata"
  campaignWindowConfig: SendingWindowConfig;
}): Date {
  const base = new Date(params.previousStepSentAt);
  const delayDays = Math.max(1, params.delayDays || 1);
  const sendTime = params.sendTime || params.campaignWindowConfig.sendWindowStart || '09:00';
  const sendTimeTz = params.sendTimeTz || params.campaignWindowConfig.sendWindowTz || 'UTC';

  const [targetHour, targetMin] = sendTime.split(':').map(Number);

  // Add delay days
  const futureDate = new Date(base.getTime() + delayDays * 24 * 60 * 60 * 1000);
  const futureParts = getTimePartsInTimezone(futureDate, sendTimeTz);

  // Anchor at the target time on that future day
  const targetDayAtSendTime = createDateInTimezone(
    futureParts.year,
    futureParts.month,
    futureParts.day,
    targetHour || 9,
    targetMin || 0,
    sendTimeTz
  );

  // Validate and shift into next eligible sending window if needed
  return calculateNextEligibleSendTime(targetDayAtSendTime, params.campaignWindowConfig);
}

/**
 * Format a Date for human-readable display in a specific timezone.
 */
export function formatDateTimeInTimezone(date: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone || 'UTC',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  } catch {
    return date.toUTCString();
  }
}

/**
 * Format 24h string ("09:30") to 12h string ("09:30 AM")
 */
export function formatTime24To12(time24: string = '09:00'): string {
  const parts = time24.split(':');
  let h = parseInt(parts[0] || '9', 10);
  const m = parts[1] || '00';
  const period = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${String(h).padStart(2, '0')}:${m} ${period}`;
}
