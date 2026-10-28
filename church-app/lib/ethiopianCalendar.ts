/**
 * Ethiopian (Ge'ez) Calendar Utilities
 *
 * Anchor: September 11, 2007 (Gregorian) = Meskerem 1, 2000 AM (Ethiopian)
 * - 13 months: 12 x 30 days + Pagume (5 or 6 days in leap year)
 * - Ethiopian year n is a leap year when n % 4 === 3
 * - 4-year cycle = 1461 days (same as Julian)
 *
 * Holiday definitions live in:
 *   lib/data/ethiopian-holidays.json
 *   lib/data/gregorian-holidays.json
 * Edit those files to add/remove/rename holidays — no code changes needed.
 */

import ethHolidayDefs from './data/ethiopian-holidays.json';
import ethFastDefs from './data/ethiopian-fasts.json';
import gregHolidayDefs from './data/gregorian-holidays.json';

export const ETHIOPIAN_MONTHS = [
  'Meskerem','Tikimt','Hidar','Tahsas','Ter','Yekatit',
  'Megabit','Miyazia','Ginbot','Sene','Hamle','Nehase','Pagume',
];

export const ETHIOPIAN_MONTHS_AM = [
  'መስከረም','ጥቅምት','ህዳር','ታህሳስ','ጥር','የካቲት',
  'መጋቢት','ሚያዚያ','ግንቦት','ሰኔ','ሐምሌ','ነሐሴ','ጳጉሜ',
];

export interface EthiopianDate {
  year: number;
  month: number;      // 1-13
  day: number;        // 1-30 (or 1-5/6 for Pagume)
  monthName: string;
  monthNameAm: string;
}

export interface Holiday {
  id: string;
  name: string;
  date: string;            // ISO Gregorian date  e.g. '2026-01-07'
  ethiopianDate?: string;  // display label e.g. '29 Tahsas'
  type: 'holiday' | 'fasting';
  calendarType: 'ethiopian' | 'gregorian';
  isDefault: boolean;
}

// ─── Anchor-based conversion ──────────────────────────────────────────────────

/** UTC midnight for a date, avoids timezone drift. */
function utcDate(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d));
}

// Known anchor: Meskerem 1, 2000 AM = September 11, 2007 (Gregorian)
const ANCHOR_GREG = utcDate(2007, 9, 11);
const ANCHOR_ETH_YEAR = 2000;
const MS_PER_DAY = 86_400_000;

/** Days in Ethiopian year n (leap if n % 4 === 3). */
function ethYearDays(n: number): number {
  return n % 4 === 3 ? 366 : 365;
}

/** Convert a Gregorian Date to an Ethiopian date. */
export function gregorianToEthiopian(date: Date): EthiopianDate {
  const utc = utcDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
  let remaining = Math.round((utc.getTime() - ANCHOR_GREG.getTime()) / MS_PER_DAY);
  let ethYear = ANCHOR_ETH_YEAR;

  if (remaining >= 0) {
    while (remaining >= ethYearDays(ethYear)) {
      remaining -= ethYearDays(ethYear);
      ethYear++;
    }
  } else {
    while (remaining < 0) {
      ethYear--;
      remaining += ethYearDays(ethYear);
    }
  }

  const ethMonth = Math.floor(remaining / 30) + 1;
  const ethDay   = (remaining % 30) + 1;
  const idx = Math.min(ethMonth - 1, 12);

  return {
    year: ethYear,
    month: ethMonth,
    day: ethDay,
    monthName: ETHIOPIAN_MONTHS[idx],
    monthNameAm: ETHIOPIAN_MONTHS_AM[idx],
  };
}

/** Convert an Ethiopian date to a Gregorian Date. */
export function ethiopianToGregorian(year: number, month: number, day: number): Date {
  let greg = new Date(ANCHOR_GREG.getTime());
  let y = ANCHOR_ETH_YEAR;

  if (year > y) {
    while (y < year) { greg = new Date(greg.getTime() + ethYearDays(y) * MS_PER_DAY); y++; }
  } else if (year < y) {
    while (y > year) { y--; greg = new Date(greg.getTime() - ethYearDays(y) * MS_PER_DAY); }
  }

  const daysOffset = (month - 1) * 30 + (day - 1);
  return new Date(greg.getTime() + daysOffset * MS_PER_DAY);
}

function toISO(d: Date): string {
  return d.toISOString().split('T')[0];
}

/** Format an Ethiopian date label from an ISO Gregorian date string. */
export function formatEthiopianLabel(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const eth = gregorianToEthiopian(utcDate(y, m, d));
  return `${eth.day} ${eth.monthName}`;
}

// ─── Holiday generators ───────────────────────────────────────────────────────

/** Ethiopian Orthodox holidays — driven by lib/data/ethiopian-holidays.json */
export function getEthiopianHolidays(gregorianYear: number, language: 'en' | 'am' = 'en'): Holiday[] {
  // Ethiopian year covering Jan-Sep of gregorianYear
  const ethYearEarly = gregorianYear - 8;
  // Ethiopian year starting ~Sep 11 of gregorianYear
  const ethYearLate  = gregorianYear - 7;

  const fasikaDate = calculateFasika(gregorianYear);
  const holidays: Holiday[] = [];

  for (const def of ethHolidayDefs as any[]) {
    const ethYear = def.yearGroup === 'late' ? ethYearLate : ethYearEarly;
    let greg: Date;
    let ethLabel: string;

    if (def.moveable) {
      // Moveable feast — anchor on Fasika (Easter) + offset days
      if (!fasikaDate) continue;
      greg = new Date(fasikaDate.getTime() + (def.offset ?? 0) * MS_PER_DAY);
      const eth = gregorianToEthiopian(greg);
      ethLabel = `${eth.day} ${language === 'am' ? eth.monthNameAm : eth.monthName}`;
    } else {
      greg = ethiopianToGregorian(ethYear, def.month, def.day);
      ethLabel = `${def.day} ${language === 'am' ? ETHIOPIAN_MONTHS_AM[def.month - 1] : ETHIOPIAN_MONTHS[def.month - 1]}`;
    }

    const iso = toISO(greg);
    const holidayName = language === 'am' && def.name_am ? def.name_am : def.name;
    
    holidays.push({
      id: `eth-${def.name.replace(/\s+/g, '-').toLowerCase()}-${gregorianYear}`,
      name: holidayName,
      date: iso,
      ethiopianDate: ethLabel,
      type: 'holiday',
      calendarType: 'ethiopian',
      isDefault: true,
    });
  }

  return holidays;
}

export interface FastSummary {
  id: string;
  name: string;
  nameAm: string;
  periodLabel: string;
  ethiopianLabel: string;
  isDefault: boolean;
}

export function getEthiopianFastSummaries(gregorianYear: number, language: 'en' | 'am' = 'en'): FastSummary[] {
  const ethYearEarly = gregorianYear - 8;
  const ethYearLate  = gregorianYear - 7;
  const fasikaDate = calculateFasika(gregorianYear);
  const summaries: FastSummary[] = [];

  const fmtGreg = (d: Date) =>
    d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const fmtEth = (d: Date) => {
    const e = gregorianToEthiopian(d);
    return `${e.day} ${language === 'am' ? e.monthNameAm : e.monthName}`;
  };

  for (const def of ethFastDefs as any[]) {
    let periodLabel = '';
    let ethiopianLabel = '';

    if (def.type === 'moveable' && fasikaDate) {
      const start = new Date(fasikaDate.getTime() + def.startOffset * MS_PER_DAY);
      const end = new Date(fasikaDate.getTime() + def.endOffset * MS_PER_DAY);
      periodLabel = `${fmtGreg(start)} – ${fmtGreg(end)}`;
      ethiopianLabel = `${fmtEth(start)} – ${fmtEth(end)}`;
    } else if (def.type === 'moveable-to-fixed' && fasikaDate) {
      const start = new Date(fasikaDate.getTime() + def.startOffset * MS_PER_DAY);
      const end = ethiopianToGregorian(ethYearLate, def.endMonth, def.endDay);
      periodLabel = `${fmtGreg(start)} – ${fmtGreg(end)}`;
      ethiopianLabel = `${fmtEth(start)} – ${fmtEth(end)}`;
    } else if (def.type === 'fixed') {
      const isLateStart = def.startMonth <= 4;
      const isLateEnd = def.endMonth <= 4;
      const start = ethiopianToGregorian(isLateStart ? ethYearLate : ethYearEarly, def.startMonth, def.startDay);
      const end = ethiopianToGregorian(isLateEnd ? ethYearLate : ethYearEarly, def.endMonth, def.endDay);
      periodLabel = `${fmtGreg(start)} – ${fmtGreg(end)}`;
      ethiopianLabel = `${fmtEth(start)} – ${fmtEth(end)}`;
    } else if (def.type === 'fixed-multi') {
      const gregDates = def.days.map((dayDef: any) => {
        const isLate = dayDef.month <= 4;
        return ethiopianToGregorian(isLate ? ethYearLate : ethYearEarly, dayDef.month, dayDef.day);
      });
      periodLabel = gregDates.map(fmtGreg).join(', ');
      ethiopianLabel = gregDates.map(fmtEth).join(', ');
    } else if (def.type === 'periodic') {
      periodLabel = language === 'am'
        ? 'ዘወትር ረቡዕ እና አርብ (ከበዓለ ሃምሳ በስተቀር)'
        : 'Every Wednesday & Friday (except 50 days after Easter)';
      ethiopianLabel = language === 'am' ? 'ዓመታዊ ቋሚ ጾም' : 'Weekly Periodic Fast';
    }

    summaries.push({
      id: def.id,
      name: language === 'am' && def.name_am ? def.name_am : def.name,
      nameAm: def.name_am || def.name,
      periodLabel,
      ethiopianLabel,
      isDefault: def.isDefault ?? true,
    });
  }

  return summaries;
}

export function getEthiopianFasts(gregorianYear: number, language: 'en' | 'am' = 'en'): Holiday[] {
  const ethYearEarly = gregorianYear - 8;
  const ethYearLate  = gregorianYear - 7;
  const fasikaDate = calculateFasika(gregorianYear);
  const fasts: Holiday[] = [];

  const addFastDays = (startGreg: Date, endGreg: Date, def: any) => {
    let current = new Date(startGreg.getTime());
    while (current <= endGreg) {
      const eth = gregorianToEthiopian(current);
      fasts.push({
        id: `fast-${def.id}-${current.getTime()}`,
        name: language === 'am' && def.name_am ? def.name_am : def.name,
        date: toISO(current),
        ethiopianDate: `${eth.day} ${language === 'am' ? eth.monthNameAm : eth.monthName}`,
        type: 'fasting',
        calendarType: 'ethiopian',
        isDefault: def.isDefault,
      });
      current = new Date(current.getTime() + MS_PER_DAY);
    }
  };

  for (const def of ethFastDefs as any[]) {
    if (def.type === 'moveable' && fasikaDate) {
      const start = new Date(fasikaDate.getTime() + def.startOffset * MS_PER_DAY);
      const end = new Date(fasikaDate.getTime() + def.endOffset * MS_PER_DAY);
      addFastDays(start, end, def);
    } 
    else if (def.type === 'moveable-to-fixed' && fasikaDate) {
      const start = new Date(fasikaDate.getTime() + def.startOffset * MS_PER_DAY);
      // Determine which eth year this ends in. Hamle (11) is late.
      const end = ethiopianToGregorian(ethYearLate, def.endMonth, def.endDay);
      addFastDays(start, end, def);
    }
    else if (def.type === 'fixed') {
      const isLateStart = def.startMonth <= 4;
      const isLateEnd = def.endMonth <= 4;
      const start = ethiopianToGregorian(isLateStart ? ethYearLate : ethYearEarly, def.startMonth, def.startDay);
      const end = ethiopianToGregorian(isLateEnd ? ethYearLate : ethYearEarly, def.endMonth, def.endDay);
      addFastDays(start, end, def);
    }
    else if (def.type === 'fixed-multi') {
      for (const dayDef of def.days) {
        const isLate = dayDef.month <= 4;
        const greg = ethiopianToGregorian(isLate ? ethYearLate : ethYearEarly, dayDef.month, dayDef.day);
        addFastDays(greg, greg, def);
      }
    }
    else if (def.type === 'periodic' && def.rule === 'wed-fri' && fasikaDate) {
      // Calculate Wed/Fri for the entire year, excluding the exception period
      const exceptionStart = fasikaDate;
      const exceptionEnd = new Date(fasikaDate.getTime() + 49 * MS_PER_DAY);
      
      let current = new Date(Date.UTC(gregorianYear, 0, 1));
      const yearEnd = new Date(Date.UTC(gregorianYear, 11, 31));
      
      while (current <= yearEnd) {
        const dayOfWeek = current.getUTCDay();
        if (dayOfWeek === 3 || dayOfWeek === 5) { // Wed=3, Fri=5
          if (current < exceptionStart || current > exceptionEnd) {
            // Also need to check if it's already covered by another fast? No, it's fine to have overlapping, 
            // but we can just add it. Calendar will merge entries.
            addFastDays(current, current, def);
          }
        }
        current = new Date(current.getTime() + MS_PER_DAY);
      }
    }
  }

  // Deduplicate fasts by date to avoid multiple fasting entries per day
  const uniqueFasts = new Map<string, Holiday>();
  for (const f of fasts) {
    // If it's wed/fri fast, don't overwrite a major fast
    if (uniqueFasts.has(f.date) && f.id.includes('tsome-dihnet')) continue;
    uniqueFasts.set(f.date, f);
  }

  return Array.from(uniqueFasts.values());
}

/** Ethiopian Easter (Fasika) — Julian Easter algorithm + 13-day Gregorian shift. */
function calculateFasika(year: number): Date | null {
  const a = year % 4, b = year % 7, c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const f = Math.floor((d + e + 114) / 31);
  const g = ((d + e + 114) % 31) + 1;
  const julianEaster = new Date(Date.UTC(year, f - 1, g));
  julianEaster.setUTCDate(julianEaster.getUTCDate() + 13);
  return julianEaster;
}

/** Gregorian/Western holidays — driven by lib/data/gregorian-holidays.json */
export function getGregorianHolidays(gregorianYear: number): Holiday[] {
  const y = gregorianYear;
  const easterDate = westernEaster(y);
  const holidays: Holiday[] = [];

  for (const def of gregHolidayDefs as any[]) {
    let date: Date;

    switch (def.type) {
      case 'fixed':
        date = new Date(Date.UTC(y, def.month - 1, def.day));
        break;
      case 'nth-weekday':
        // e.g. 3rd Monday of January: weekday=1, nth=3
        date = nthWeekday(y, def.month, def.weekday, def.nth);
        break;
      case 'last-weekday':
        // e.g. Last Monday of May
        date = lastWeekday(y, def.month, def.weekday);
        break;
      case 'moveable':
        if (def.moveableKey === 'western-easter') {
          date = new Date(easterDate.getTime() + (def.offset ?? 0) * MS_PER_DAY);
        } else {
          continue;
        }
        break;
      default:
        continue;
    }

    holidays.push({
      id: `greg-${def.name.replace(/\s+/g, '-').toLowerCase()}-${y}`,
      name: def.name,
      date: toISO(date),
      type: 'holiday',
      calendarType: 'gregorian',
      isDefault: true,
    });
  }

  return holidays;
}

// ─── Date arithmetic helpers ──────────────────────────────────────────────────

function nthWeekday(year: number, month: number, weekday: number, nth: number): Date {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  return new Date(Date.UTC(year, month - 1, 1 + offset + (nth - 1) * 7));
}

function lastWeekday(year: number, month: number, weekday: number): Date {
  const last = new Date(Date.UTC(year, month, 0));
  const offset = (last.getUTCDay() - weekday + 7) % 7;
  return new Date(Date.UTC(year, month - 1, last.getUTCDate() - offset));
}

function westernEaster(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mo = Math.floor((h + l - 7 * m + 114) / 31);
  const dy = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, mo - 1, dy));
}
