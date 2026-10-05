/**
 * Pure domain rules for the shift calendar.
 *
 * Dates are represented as local calendar keys (`YYYY-MM-DD`). Month indexes
 * deliberately follow JavaScript's `Date#getMonth()` convention (0-11).
 * No function in this module reads browser state or the current clock unless a
 * caller explicitly omits a helper's optional `today`/`now` value.
 */

import { resolveAssignmentTime } from "./assignment-time";

export const CYCLE_ANCHOR = "2026-04-01";
export const ASSIGNMENT_RATE = 20;
export const WEEKEND_DAYS = [5, 6] as const;
export const SHIFTS = ["A", "B", "C", "M"] as const;
export const LANGUAGES = ["ar", "en"] as const;
export const ENTRY_COLORS = ["", "red", "blue", "yellow", "green", "purple"] as const;

export type Shift = (typeof SHIFTS)[number];
export type Language = (typeof LANGUAGES)[number];
export type EntryKind = "assignment" | "guard";
export type EntryColor = (typeof ENTRY_COLORS)[number];
export type ShiftStatus = "duty" | "off";
export type DayStatusKey = "off" | "free" | "assignment" | "guard" | "mixed";
export type DateLike = Date | string;

export interface Entry {
  id: string;
  kind: EntryKind;
  date: string;
  name: string;
  time: string;
  notes: string;
  color: EntryColor;
  source: string;
  reminderOffsetMinutes: number;
}

export interface UserSettings {
  language?: Language;
  contactName?: string;
  phone?: string;
  onboardingCompleted?: boolean;
  [key: string]: unknown;
}

/** A password is intentionally not part of the safe user/domain model. */
export interface User {
  id?: string;
  type?: "user";
  username: string;
  employee_id: string;
  shift: Shift;
  assignments: Entry[];
  settings: UserSettings;
  assignmentCount?: number;
  guardCount?: number;
}

export interface DayStatus {
  key: DayStatusKey;
  label: string;
  shiftStatus: ShiftStatus;
  entries: Entry[];
}

export interface MonthCursor {
  year: number;
  /** Zero-based month, matching `Date#getMonth()` (January = 0). */
  monthIndex: number;
}

export interface Totals {
  assignmentCount: number;
  guardCount: number;
  totalAmount: number;
  rate: number;
}

type UnknownRecord = Record<string, unknown>;

const DAY_MS = 86_400_000;
const CYCLE_SHIFTS = ["A", "B", "C"] as const;

const MONTH_NAMES: Record<Language, readonly string[]> = {
  ar: ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};

const STATUS_LABELS: Record<Language, Record<DayStatusKey | "weekend", string>> = {
  ar: {
    off: "راحة",
    free: "دوام",
    assignment: "فيه تكليف",
    guard: "فيه خفارة",
    mixed: "فيه تكليف وخفارة",
    weekend: "عطلة أسبوعية",
  },
  en: {
    off: "Off",
    free: "Duty",
    assignment: "Has assignment",
    guard: "Has guard",
    mixed: "Has assignment and guard",
    weekend: "Weekend Off",
  },
};

const SEARCH_COPY = {
  ar: {
    title: "نتيجة البحث الذكي",
    prompt: "اكتب سؤالك بشكل طبيعي، والنظام يبحث داخل جدولك فقط.",
    noResults: "ما لقيت نتائج مطابقة داخل بياناتك الحالية.",
    date: "التاريخ",
    today: "شفتي اليوم",
    tomorrow: "شفتي باجر",
    week: "هذا الأسبوع",
    month: "هذا الشهر",
    free: "فاضي",
    openDay: "يوم",
  },
  en: {
    title: "Smart Search Result",
    prompt: "Ask naturally and the system will search your own data only.",
    noResults: "No matching results were found in your current data.",
    date: "Date",
    today: "Today's shift",
    tomorrow: "Tomorrow's shift",
    week: "This week",
    month: "This month",
    free: "Free",
    openDay: "day",
  },
} as const;

const CLINIC_LABELS: Record<Language, Record<string, string>> = {
  ar: {
    boulevard: "عيادة البوليفارد",
    science: "عيادة المركز العلمي",
    marina: "عيادة المارينا",
    promenade: "عيادة البروميناد",
    courts: "عيادة مجمع المحاكم",
    other: "أخرى",
  },
  en: {
    boulevard: "Boulevard Clinic",
    science: "Science Center Clinic",
    marina: "Marina Clinic",
    promenade: "Promenade Clinic",
    courts: "Courts Complex Clinic",
    other: "Other",
  },
};

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertMonthIndex(monthIndex: number): void {
  if (!Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    throw new RangeError("monthIndex must be an integer from 0 to 11");
  }
}

function assertYear(year: number): void {
  if (!Number.isInteger(year) || year < 1 || year > 9999) {
    throw new RangeError("year must be an integer from 1 to 9999");
  }
}

function calendarParts(value: DateLike): { year: number; monthIndex: number; day: number } {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new RangeError("Invalid date");
    return { year: value.getFullYear(), monthIndex: value.getMonth(), day: value.getDate() };
  }

  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new RangeError(`Invalid date key: ${String(value)}`);
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, monthIndex, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== monthIndex ||
    candidate.getUTCDate() !== day
  ) {
    throw new RangeError(`Invalid date key: ${String(value)}`);
  }
  return { year, monthIndex, day };
}

function utcDayNumber(value: DateLike): number {
  const { year, monthIndex, day } = calendarParts(value);
  return Math.floor(Date.UTC(year, monthIndex, day) / DAY_MS);
}

function dateKeyFromParts(year: number, monthIndex: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function isValidDateKey(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    calendarParts(value);
    return true;
  } catch {
    return false;
  }
}

export function dateFromKey(value: string): Date {
  const { year, monthIndex, day } = calendarParts(value);
  return new Date(year, monthIndex, day);
}

export function toDateInputValue(value: DateLike): string {
  const { year, monthIndex, day } = calendarParts(value);
  return dateKeyFromParts(year, monthIndex, day);
}

export const toDateKey = toDateInputValue;

export function todayLocal(now = new Date()): Date {
  const { year, monthIndex, day } = calendarParts(now);
  return new Date(year, monthIndex, day);
}

export function addDays(value: DateLike, offset: number): Date {
  if (!Number.isInteger(offset)) throw new RangeError("offset must be an integer");
  const serial = utcDayNumber(value) + offset;
  const utcDate = new Date(serial * DAY_MS);
  return new Date(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate());
}

export function startOfMonth(year: number, monthIndex: number): Date {
  assertYear(year);
  assertMonthIndex(monthIndex);
  return new Date(year, monthIndex, 1);
}

export function endOfMonth(year: number, monthIndex: number): Date {
  assertYear(year);
  assertMonthIndex(monthIndex);
  return new Date(year, monthIndex + 1, 0);
}

export function getMonthRange(year: number, monthIndex: number): { start: Date; end: Date } {
  return { start: startOfMonth(year, monthIndex), end: endOfMonth(year, monthIndex) };
}

export function formatMonthLabel(monthIndex: number, year: number, language: Language = "ar"): string {
  assertYear(year);
  assertMonthIndex(monthIndex);
  return `${MONTH_NAMES[normalizeLanguage(language)][monthIndex]} ${year}`;
}

export function getWeekRange(value: DateLike): { start: Date; end: Date } {
  const date = dateFromKey(toDateInputValue(value));
  const start = addDays(date, -date.getDay());
  return { start, end: addDays(start, 6) };
}

export function isDateWithinRange(date: DateLike, start: DateLike, end: DateLike): boolean {
  const serial = utcDayNumber(date);
  return serial >= utcDayNumber(start) && serial <= utcDayNumber(end);
}

export function getDaysInRange(start: DateLike, end: DateLike): string[] {
  const startDay = utcDayNumber(start);
  const endDay = utcDayNumber(end);
  if (endDay < startDay) return [];

  const dates: string[] = [];
  for (let day = startDay; day <= endDay; day += 1) {
    const utcDate = new Date(day * DAY_MS);
    dates.push(dateKeyFromParts(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate()));
  }
  return dates;
}

export function getDaysInMonth(year: number, monthIndex: number): string[] {
  const { start, end } = getMonthRange(year, monthIndex);
  return getDaysInRange(start, end);
}

export function normalizeShift(value: unknown): Shift {
  const candidate = String(value ?? "").trim().toUpperCase();
  return (SHIFTS as readonly string[]).includes(candidate) ? (candidate as Shift) : "A";
}

export function normalizeLanguage(value: unknown): Language {
  return String(value ?? "").trim().toLowerCase() === "en" ? "en" : "ar";
}

export function normalizeReminder(value: unknown): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

export function normalizeEntryColor(value: unknown): EntryColor {
  const candidate = String(value ?? "").trim().toLowerCase();
  return (ENTRY_COLORS as readonly string[]).includes(candidate) ? (candidate as EntryColor) : "";
}

export function normalizeEntry(value: unknown, index = 0): Entry {
  const entry = isRecord(value) ? value : {};
  const kind: EntryKind = entry.kind === "guard" ? "guard" : "assignment";
  const date = String(entry.date ?? "");
  const name = String(entry.name ?? "");
  const time = String(entry.time ?? "");
  const notes = String(entry.notes ?? "");
  const color = normalizeEntryColor(entry.color);
  const source = String(entry.source ?? "");
  const reminderOffsetMinutes = normalizeReminder(entry.reminderOffsetMinutes);
  const fallbackId = `${kind}|${date}|${name}|${time}|${index}`;

  return {
    id: String(entry.id || fallbackId),
    kind,
    date,
    name,
    time,
    notes,
    color,
    source,
    reminderOffsetMinutes,
  };
}

export function normalizeUser(value: unknown): User | null {
  if (!isRecord(value)) return null;
  const rawSettings = isRecord(value.settings) ? value.settings : {};
  const settings: UserSettings = { ...rawSettings };
  if ("language" in settings) settings.language = normalizeLanguage(settings.language);
  const rawAssignments = Array.isArray(value.assignments) ? value.assignments : [];
  const normalized: User = {
    username: String(value.username ?? ""),
    employee_id: String(value.employee_id ?? value.employeeId ?? ""),
    shift: normalizeShift(value.shift),
    assignments: rawAssignments.map(normalizeEntry).filter((entry) => isValidDateKey(entry.date)),
    settings,
  };

  if (value.id != null) normalized.id = String(value.id);
  if (value.type === "user") normalized.type = "user";
  if (Number.isFinite(Number(value.assignmentCount))) normalized.assignmentCount = Number(value.assignmentCount);
  if (Number.isFinite(Number(value.guardCount))) normalized.guardCount = Number(value.guardCount);
  return normalized;
}

export function getEntriesForDate(entries: readonly Entry[], date: DateLike): Entry[] {
  const dateKey = toDateInputValue(date);
  return entries
    .filter((entry) => entry.date === dateKey)
    .slice()
    .sort((left, right) => left.kind.localeCompare(right.kind) || left.name.localeCompare(right.name));
}

export function isWeekend(value: DateLike): boolean {
  const serial = utcDayNumber(value);
  const day = new Date(serial * DAY_MS).getUTCDay();
  return (WEEKEND_DAYS as readonly number[]).includes(day);
}

export function getCycleShiftKey(value: DateLike, anchor: DateLike = CYCLE_ANCHOR): Exclude<Shift, "M"> {
  const diff = utcDayNumber(value) - utcDayNumber(anchor);
  const cycleIndex = ((diff % CYCLE_SHIFTS.length) + CYCLE_SHIFTS.length) % CYCLE_SHIFTS.length;
  return CYCLE_SHIFTS[cycleIndex];
}

export function getShiftForDate(value: DateLike, shift: Shift): ShiftStatus {
  if (shift === "M") return isWeekend(value) ? "off" : "duty";
  return getCycleShiftKey(value) === shift ? "duty" : "off";
}

/** Assignments are only permitted on non-weekend off-days (or M weekdays). */
export function canAssign(value: DateLike, shift: Shift): boolean {
  if (isWeekend(value)) return false;
  return shift === "M" || getShiftForDate(value, shift) === "off";
}

export const canAssignOnDate = canAssign;

export function canGuard(value: DateLike, shift: Shift): boolean {
  return shift === "M" && !isWeekend(value);
}

export const canGuardOnDate = canGuard;

export function dayStatus(
  date: DateLike,
  shift: Shift,
  allEntries: readonly Entry[] = [],
  language: Language = "ar",
): DayStatus {
  const lang = normalizeLanguage(language);
  const dateKey = toDateInputValue(date);
  const entries = getEntriesForDate(allEntries, dateKey);
  const hasAssignment = entries.some((entry) => entry.kind === "assignment");
  const hasGuard = entries.some((entry) => entry.kind === "guard");
  const shiftStatus = getShiftForDate(dateKey, shift);

  if (shift === "M" && isWeekend(dateKey)) {
    return { key: "off", label: STATUS_LABELS[lang].weekend, shiftStatus, entries };
  }
  if (hasAssignment && hasGuard) {
    return { key: "mixed", label: STATUS_LABELS[lang].mixed, shiftStatus, entries };
  }
  if (hasAssignment) {
    return { key: "assignment", label: STATUS_LABELS[lang].assignment, shiftStatus, entries };
  }
  if (hasGuard) {
    return { key: "guard", label: STATUS_LABELS[lang].guard, shiftStatus, entries };
  }
  if (shiftStatus === "duty") {
    return { key: "free", label: STATUS_LABELS[lang].free, shiftStatus, entries };
  }
  return { key: "off", label: STATUS_LABELS[lang].off, shiftStatus, entries };
}

export const getDayStatus = dayStatus;

export function getMonthEntries(
  entries: readonly Entry[],
  year: number,
  monthIndex: number,
  kind?: EntryKind,
): Entry[] {
  assertYear(year);
  assertMonthIndex(monthIndex);
  return entries.filter((entry) => {
    if (!isValidDateKey(entry.date)) return false;
    const parts = calendarParts(entry.date);
    return parts.year === year && parts.monthIndex === monthIndex && (!kind || entry.kind === kind);
  });
}

export function calculateTotals(
  entries: readonly Entry[],
  options: { year?: number; monthIndex?: number; rate?: number } = {},
): Totals {
  const hasMonth = options.year !== undefined || options.monthIndex !== undefined;
  if (hasMonth && (options.year === undefined || options.monthIndex === undefined)) {
    throw new TypeError("year and monthIndex must be provided together");
  }
  const selected = hasMonth
    ? getMonthEntries(entries, options.year as number, options.monthIndex as number)
    : entries.filter((entry) => isValidDateKey(entry.date));
  const rate = Number.isFinite(options.rate) && Number(options.rate) >= 0 ? Number(options.rate) : ASSIGNMENT_RATE;
  const assignmentCount = selected.filter((entry) => entry.kind === "assignment").length;
  const guardCount = selected.filter((entry) => entry.kind === "guard").length;
  return { assignmentCount, guardCount, totalAmount: assignmentCount * rate, rate };
}

export const getTotals = calculateTotals;

export function normalizeArabicDigits(value: unknown): string {
  const arabicIndic = "٠١٢٣٤٥٦٧٨٩";
  const easternArabicIndic = "۰۱۲۳۴۵۶۷۸۹";
  return String(value ?? "")
    .replace(/[٠-٩]/g, (digit) => String(arabicIndic.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String(easternArabicIndic.indexOf(digit)));
}

export function normalizeSearchText(value: unknown): string {
  return normalizeArabicDigits(value)
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ـ/g, "")
    .replace(/[\u0300-\u036f\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed]/g, "")
    .replace(/[^\p{L}\p{N}\s/-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenizeNormalizedText(value: unknown): string[] {
  const normalized = normalizeSearchText(value);
  return normalized ? normalized.split(" ").filter(Boolean) : [];
}

export function getNameMatchScore(haystack: unknown, targetTokens: readonly string[]): number {
  const haystackText = normalizeSearchText(haystack);
  const normalizedTargets = targetTokens.map(normalizeSearchText).filter(Boolean);
  if (!haystackText || !normalizedTargets.length) return 0;

  const haystackTokens = tokenizeNormalizedText(haystackText);
  let score = 0;
  let matchedTokens = 0;
  for (const token of normalizedTargets) {
    if (haystackTokens.includes(token)) {
      score += 5;
      matchedTokens += 1;
    } else if (haystackTokens.some((candidate) => candidate.includes(token) || token.includes(candidate))) {
      score += 3;
      matchedTokens += 1;
    } else if (token.length >= 3 && haystackText.includes(token)) {
      score += 2;
      matchedTokens += 1;
    }
  }
  if (haystackText.includes(normalizedTargets.join(" "))) score += 6;
  if (matchedTokens) score += matchedTokens / normalizedTargets.length;
  return score;
}

export function isEnglishOnly(value: string): boolean {
  return /^[a-zA-Z0-9\s_-]+$/.test(value);
}

export interface DateQueryContext extends MonthCursor {
  today?: DateLike;
  language?: Language;
}

export interface SearchRange {
  start: Date;
  end: Date;
  label: string;
}

export type SmartSearchIntent = "empty" | "free" | "guard" | "assignment" | "hawalli" | "shift" | "summary";

export interface SmartSearchItem {
  date: string;
  status: DayStatus;
  entries: Entry[];
  shift: Shift;
}

export type SmartSearchResult =
  | {
      kind: "empty";
      intent: SmartSearchIntent;
      title: string;
      description: string;
      items: SmartSearchItem[];
    }
  | {
      kind: "day";
      intent: SmartSearchIntent;
      title: string;
      description: string;
      item: SmartSearchItem;
    }
  | {
      kind: "list";
      intent: SmartSearchIntent;
      title: string;
      description: string;
      items: SmartSearchItem[];
    };

export interface SmartSearchContext extends DateQueryContext {
  user: Pick<User, "shift" | "assignments">;
}

function validDateKeyFromNumbers(year: number, month: number, day: number): string {
  const dateKey = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return isValidDateKey(dateKey) ? dateKey : "";
}

export function parseDateFromQuery(query: unknown, context?: Partial<DateQueryContext>): string {
  const now = context?.today ? dateFromKey(toDateInputValue(context.today)) : todayLocal();
  const year = context?.year ?? now.getFullYear();
  const monthIndex = context?.monthIndex ?? now.getMonth();
  assertYear(year);
  assertMonthIndex(monthIndex);
  const raw = normalizeArabicDigits(query).trim();

  const isoMatch = raw.match(/(?:^|\D)(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\D|$)/);
  if (isoMatch) return validDateKeyFromNumbers(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));

  const shortMatch = raw.match(/(?:^|\D)(\d{1,2})[/-](\d{1,2})(?:\D|$)/);
  if (shortMatch) return validDateKeyFromNumbers(now.getFullYear(), Number(shortMatch[2]), Number(shortMatch[1]));

  const normalized = normalizeSearchText(raw);
  const dayPhrase = normalized.match(/(?:(?:يوم|تاريخ|day|date)\s*)?(\d{1,2})\b/);
  if (dayPhrase && !/(?:ساعه|شهر|hour|month)/.test(normalized)) {
    return validDateKeyFromNumbers(year, monthIndex + 1, Number(dayPhrase[1]));
  }
  return "";
}

export function getRangeFromQuery(query: unknown, context: DateQueryContext): SearchRange {
  assertYear(context.year);
  assertMonthIndex(context.monthIndex);
  const language = normalizeLanguage(context.language);
  const copy = SEARCH_COPY[language];
  const normalized = normalizeSearchText(query);
  const today = context.today ? dateFromKey(toDateInputValue(context.today)) : todayLocal();

  if (/(^|\s)(اليوم|today)(\s|$)/.test(normalized)) return { start: today, end: today, label: copy.today };
  if (/(باجر|غدا|tomorrow)/.test(normalized)) {
    const tomorrow = addDays(today, 1);
    return { start: tomorrow, end: tomorrow, label: copy.tomorrow };
  }
  if (/(هذا الاسبوع|هالاسبوع|الاسبوع|this week|week)/.test(normalized)) {
    return { ...getWeekRange(today), label: copy.week };
  }
  if (/(هذا الشهر|هالشهر|الشهر|this month|month)/.test(normalized)) {
    return { ...getMonthRange(context.year, context.monthIndex), label: copy.month };
  }

  const explicitDate = parseDateFromQuery(query, context);
  if (explicitDate) {
    const exact = dateFromKey(explicitDate);
    return { start: exact, end: exact, label: explicitDate };
  }
  return { ...getMonthRange(context.year, context.monthIndex), label: copy.month };
}

export function getSmartSearchIntent(query: unknown): SmartSearchIntent {
  const normalized = normalizeSearchText(query);
  if (!normalized) return "empty";
  if (/(فاضي|فارغ|متاح|راحه|free|available|days? off)/.test(normalized)) return "free";
  if (/(خفاره|خفارات|guard)/.test(normalized)) return "guard";
  if (/(تكليف|تكاليف|assignment)/.test(normalized)) return "assignment";
  if ((normalized.includes("محكمه") && normalized.includes("حولي")) || /hawalli.*court|court.*hawalli/.test(normalized)) return "hawalli";
  if (/(شفتي|دوامي|my shift|shift today|shift tomorrow)/.test(normalized)) return "shift";
  return "summary";
}

function isHawalliEntry(entry: Entry): boolean {
  const name = normalizeSearchText(entry.name);
  return (name.includes("محكمه") && name.includes("حولي")) || /hawalli.*court|court.*hawalli/.test(name);
}

export function buildSmartSearchResult(query: unknown, context: SmartSearchContext): SmartSearchResult {
  const language = normalizeLanguage(context.language);
  const copy = SEARCH_COPY[language];
  const trimmed = String(query ?? "").trim();
  const intent = getSmartSearchIntent(trimmed);
  if (!trimmed) return { kind: "empty", intent, title: copy.title, description: copy.prompt, items: [] };

  const range = getRangeFromQuery(trimmed, context);
  const explicitDate = parseDateFromQuery(trimmed, context);
  const matchingDays: SmartSearchItem[] = [];
  for (const date of getDaysInRange(range.start, range.end)) {
    const entries = getEntriesForDate(context.user.assignments, date);
    const status = dayStatus(date, context.user.shift, context.user.assignments, language);
    const assignments = entries.filter((entry) => entry.kind === "assignment");
    const guards = entries.filter((entry) => entry.kind === "guard");
    const hawalliAssignments = assignments.filter(isHawalliEntry);
    let include: boolean;

    if (intent === "free") include = entries.length === 0 && canAssign(date, context.user.shift);
    else if (intent === "guard") include = guards.length > 0;
    else if (intent === "assignment") include = assignments.length > 0;
    else if (intent === "hawalli") include = hawalliAssignments.length > 0;
    else if (intent === "shift") include = true;
    else include = entries.length > 0 || status.key === "free";

    if (explicitDate && date !== explicitDate) include = false;
    if (include) {
      matchingDays.push({
        date,
        status,
        entries: intent === "hawalli" ? hawalliAssignments : entries,
        shift: context.user.shift,
      });
    }
  }

  if (explicitDate && (intent !== "free" || matchingDays.length)) {
    const entries = getEntriesForDate(context.user.assignments, explicitDate);
    return {
      kind: "day",
      intent,
      title: copy.title,
      description: `${copy.date}: ${explicitDate}`,
      item: {
        date: explicitDate,
        status: dayStatus(explicitDate, context.user.shift, context.user.assignments, language),
        entries,
        shift: context.user.shift,
      },
    };
  }

  if (!matchingDays.length) {
    return { kind: "empty", intent, title: copy.title, description: copy.noResults, items: [] };
  }
  if (matchingDays.length === 1 && (intent === "shift" || utcDayNumber(range.start) === utcDayNumber(range.end))) {
    return {
      kind: "day",
      intent,
      title: copy.title,
      description: `${copy.date}: ${matchingDays[0].date}`,
      item: matchingDays[0],
    };
  }
  if (intent === "free" && /(اقرب|nearest|next)/.test(normalizeSearchText(trimmed))) {
    return {
      kind: "day",
      intent,
      title: copy.title,
      description: `${copy.free} · ${matchingDays[0].date}`,
      item: matchingDays[0],
    };
  }
  return {
    kind: "list",
    intent,
    title: copy.title,
    description: `${range.label} · ${matchingDays.length} ${copy.openDay}`,
    items: matchingDays,
  };
}

export interface BulkDateParseResult {
  dates: string[];
  invalidTokens: string[];
}

export interface BulkPreviewInput {
  datesText: string;
  name?: string;
  namePreset?: string;
  nameCustom?: string;
  time?: string;
  timePreset?: string;
  timeCustom?: string;
  notes?: string;
  color?: string;
  reminderOffsetMinutes?: number | string;
}

export interface BulkPreviewContext extends MonthCursor {
  user: Pick<User, "username" | "shift">;
  language?: Language;
}

export interface BulkAddPreview {
  employeeName: string;
  name: string;
  time: string;
  invalidDates: string[];
  invalidTokens: string[];
  items: Entry[];
}

export type CoreValidationCode = "bulkNoDates" | "bulkInvalidDates" | "customNameRequired" | "customTimeRequired";

const VALIDATION_MESSAGES: Record<Language, Record<CoreValidationCode, string>> = {
  ar: {
    bulkNoDates: "اكتب تاريخًا واحدًا على الأقل",
    bulkInvalidDates: "بعض التواريخ غير صالحة أو لا تقبل التكليف",
    customNameRequired: "اكتب اسم العنصر",
    customTimeRequired: "حدد وقت العنصر",
  },
  en: {
    bulkNoDates: "Enter at least one date",
    bulkInvalidDates: "Some dates are invalid or cannot accept assignments",
    customNameRequired: "Please enter the item name",
    customTimeRequired: "Please choose the item time",
  },
};

export class CoreValidationError extends Error {
  readonly code: CoreValidationCode;

  constructor(code: CoreValidationCode, language: Language = "ar") {
    super(VALIDATION_MESSAGES[normalizeLanguage(language)][code]);
    this.name = "CoreValidationError";
    this.code = code;
  }
}

export function normalizeBulkDateText(value: unknown): string {
  return normalizeArabicDigits(value).replace(/[،؛;]/g, ",");
}

export function parseBulkDates(text: unknown, context: MonthCursor): BulkDateParseResult {
  assertYear(context.year);
  assertMonthIndex(context.monthIndex);
  const tokens = normalizeBulkDateText(text)
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const dates: string[] = [];
  const invalidTokens: string[] = [];

  for (const token of tokens) {
    const fullDate = token.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (fullDate) {
      const date = validDateKeyFromNumbers(Number(fullDate[1]), Number(fullDate[2]), Number(fullDate[3]));
      if (date) dates.push(date);
      else invalidTokens.push(token);
      continue;
    }

    const range = token.match(/^(\d{1,2})\s*-\s*(\d{1,2})$/);
    if (range) {
      const startDay = Number(range[1]);
      const endDay = Number(range[2]);
      if (endDay < startDay) {
        invalidTokens.push(token);
        continue;
      }
      let added = false;
      for (let day = startDay; day <= endDay; day += 1) {
        const date = validDateKeyFromNumbers(context.year, context.monthIndex + 1, day);
        if (date) {
          dates.push(date);
          added = true;
        }
      }
      if (!added || endDay > endOfMonth(context.year, context.monthIndex).getDate()) invalidTokens.push(token);
      continue;
    }

    if (/^\d{1,2}$/.test(token)) {
      const date = validDateKeyFromNumbers(context.year, context.monthIndex + 1, Number(token));
      if (date) dates.push(date);
      else invalidTokens.push(token);
      continue;
    }
    invalidTokens.push(token);
  }

  return { dates: [...new Set(dates)].sort(), invalidTokens };
}

export function parseBulkDateList(text: unknown, context: MonthCursor): string[] {
  return parseBulkDates(text, context).dates;
}

export function getClinicLabel(key: string, language: Language = "ar"): string {
  return CLINIC_LABELS[normalizeLanguage(language)][key] ?? key;
}

export function buildBulkAddPreview(input: BulkPreviewInput, context: BulkPreviewContext): BulkAddPreview {
  const language = normalizeLanguage(context.language);
  const parsed = parseBulkDates(input.datesText, context);
  if (!parsed.dates.length) throw new CoreValidationError("bulkNoDates", language);

  const namePreset = String(input.namePreset ?? "other");
  const timePreset = String(input.timePreset ?? "A");
  const directName = String(input.name ?? "").trim();
  const directTime = String(input.time ?? "").trim();
  const finalName = directName || (namePreset === "other" ? String(input.nameCustom ?? "").trim() : getClinicLabel(namePreset, language));
  const finalTime = directTime || (timePreset === "other" ? String(input.timeCustom ?? "").trim() : timePreset);
  if (!finalName) throw new CoreValidationError("customNameRequired", language);
  if (!finalTime) throw new CoreValidationError("customTimeRequired", language);

  const invalidDates: string[] = [];
  const items: Entry[] = [];
  for (const date of parsed.dates) {
    if (!canAssign(date, context.user.shift)) {
      invalidDates.push(date);
      continue;
    }
    items.push(
      normalizeEntry({
        id: `bulk|assignment|${date}|${finalName}|${finalTime}`,
        kind: "assignment",
        date,
        name: finalName,
        time: finalTime,
        notes: String(input.notes ?? "").trim(),
        color: input.color,
        source: "",
        reminderOffsetMinutes: input.reminderOffsetMinutes,
      }),
    );
  }
  if (!items.length) throw new CoreValidationError("bulkInvalidDates", language);

  return {
    employeeName: context.user.username,
    name: finalName,
    time: finalTime,
    invalidDates,
    invalidTokens: parsed.invalidTokens,
    items,
  };
}

export interface IcsOptions {
  now?: Date;
  durationMinutes?: number;
  defaultReminderMinutes?: number;
  language?: Language;
  calendarName?: string;
  productId?: string;
  uidDomain?: string;
  timeZone?: string;
}

export function escapeIcsText(value: unknown): string {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

/** Fold an iCalendar content line to at most 75 UTF-8 octets per RFC 5545. */
export function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  const chunks: string[] = [];
  let chunk = "";
  let limit = 75;
  for (const character of line) {
    if (chunk && encoder.encode(chunk + character).length > limit) {
      chunks.push(chunk);
      chunk = character;
      limit = 74;
    } else {
      chunk += character;
    }
  }
  chunks.push(chunk);
  return chunks.map((part, index) => (index === 0 ? part : ` ${part}`)).join("\r\n");
}

function formatIcsLocal(date: string, hours: number, minutes: number): string {
  return `${date.replaceAll("-", "")}T${String(hours).padStart(2, "0")}${String(minutes).padStart(2, "0")}00`;
}

function formatIcsUtc(value: Date): string {
  if (Number.isNaN(value.getTime())) throw new RangeError("Invalid ICS timestamp");
  return `${value.getUTCFullYear()}${String(value.getUTCMonth() + 1).padStart(2, "0")}${String(value.getUTCDate()).padStart(2, "0")}T${String(value.getUTCHours()).padStart(2, "0")}${String(value.getUTCMinutes()).padStart(2, "0")}${String(value.getUTCSeconds()).padStart(2, "0")}Z`;
}

function sanitizeIcsParameter(value: unknown, fallback: string): string {
  const safe = String(value ?? "").replace(/[^A-Za-z0-9_+./-]/g, "");
  return safe || fallback;
}

export function buildIcsFile(entry: Entry, options: IcsOptions = {}): string | null {
  if (!isValidDateKey(entry.date)) return null;
  const start = resolveAssignmentTime(entry.time, entry.kind);
  if (!start) return null;

  const durationMinutes = Number.isFinite(options.durationMinutes) && Number(options.durationMinutes) > 0
    ? Math.floor(Number(options.durationMinutes))
    : entry.kind === "assignment" ? 240 : 60;
  const startMinutes = start.hours * 60 + start.minutes;
  const endMinutes = startMinutes + durationMinutes;
  const endDayOffset = Math.floor(endMinutes / 1_440);
  const endDate = toDateInputValue(addDays(entry.date, endDayOffset));
  const endHours = Math.floor((endMinutes % 1_440) / 60);
  const endMinute = endMinutes % 60;
  const language = normalizeLanguage(options.language);
  const reminder = normalizeReminder(entry.reminderOffsetMinutes ?? options.defaultReminderMinutes ?? 60);
  const timeZone = sanitizeIcsParameter(options.timeZone, "Asia/Kuwait");
  const uidDomain = sanitizeIcsParameter(options.uidDomain, "shift-calendar.local");
  const productId = String(options.productId ?? "-//Shift Calendar//V3//AR").replace(/[\r\n]/g, "");
  const calendarName = options.calendarName ?? (language === "ar" ? "تقويم الدوام" : "Shift Calendar");
  const kindLabel = entry.kind === "guard" ? (language === "ar" ? "خفارة" : "Guard") : language === "ar" ? "تكليف" : "Assignment";
  const summary = entry.name ? `${kindLabel} - ${entry.name}` : kindLabel;
  const uid = `${entry.id || `${entry.kind}-${entry.date}-${entry.time}`}@${uidDomain}`;
  const now = options.now ?? new Date();

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `PRODID:${escapeIcsText(productId)}`,
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
    "BEGIN:VEVENT",
    `UID:${escapeIcsText(uid)}`,
    `DTSTAMP:${formatIcsUtc(now)}`,
    `DTSTART;TZID=${timeZone}:${formatIcsLocal(entry.date, start.hours, start.minutes)}`,
    `DTEND;TZID=${timeZone}:${formatIcsLocal(endDate, endHours, endMinute)}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    `DESCRIPTION:${escapeIcsText(entry.notes)}`,
    ...(reminder > 0 ? ["BEGIN:VALARM",
    `TRIGGER:-PT${reminder}M`,
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeIcsText(entry.name || kindLabel)}`,
    "END:VALARM"] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
}

/** Clipboard contains only eligible dates, one per line, with no status labels. */
export function buildAvailableDatesText(result: SmartSearchResult, user: Pick<User, "shift" | "assignments">): string {
  if (result.intent !== "free") return "";
  const items = result.kind === "day" ? [result.item] : result.items;
  return [...new Set(items.map((item) => item.date))]
    .filter((date) => isValidDateKey(date) && canAssign(date, user.shift) && !user.assignments.some((entry) => entry.date === date))
    .sort().map((date) => { const [year, month, day] = date.split("-"); return `${day}/${month}/${year}`; }).join("\n");
}
