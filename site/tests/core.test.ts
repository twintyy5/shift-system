import { describe, expect, it } from "vitest";

import {
  ASSIGNMENT_RATE,
  CYCLE_ANCHOR,
  CoreValidationError,
  addDays,
  buildBulkAddPreview,
  buildIcsFile,
  buildSmartSearchResult,
  calculateTotals,
  canAssign,
  canGuard,
  dateFromKey,
  dayStatus,
  endOfMonth,
  escapeIcsText,
  foldIcsLine,
  formatMonthLabel,
  getCycleShiftKey,
  getDaysInMonth,
  getDaysInRange,
  getMonthEntries,
  getNameMatchScore,
  getRangeFromQuery,
  getShiftForDate,
  getSmartSearchIntent,
  getWeekRange,
  isDateWithinRange,
  isValidDateKey,
  isWeekend,
  normalizeArabicDigits,
  normalizeEntry,
  normalizeLanguage,
  normalizeSearchText,
  normalizeShift,
  normalizeUser,
  parseBulkDateList,
  parseBulkDates,
  parseDateFromQuery,
  toDateInputValue,
  type Entry,
  type User,
} from "../src/core";

const entry = (overrides: Partial<Entry> = {}): Entry => ({
  id: "entry-1",
  kind: "assignment",
  date: "2026-04-02",
  name: "Test assignment",
  time: "A",
  notes: "",
  color: "",
  source: "",
  reminderOffsetMinutes: 0,
  ...overrides,
});

const user = (overrides: Partial<User> = {}): User => ({
  id: "user-test",
  type: "user",
  username: "test-user",
  employee_id: "EMP-001",
  shift: "A",
  assignments: [],
  settings: { language: "ar" },
  ...overrides,
});

describe("date and month helpers", () => {
  it("validates and round-trips local date keys", () => {
    expect(isValidDateKey("2028-02-29")).toBe(true);
    expect(isValidDateKey("2027-02-29")).toBe(false);
    expect(isValidDateKey("2026-2-01")).toBe(false);
    expect(toDateInputValue(dateFromKey("2026-04-09"))).toBe("2026-04-09");
  });

  it("adds days safely across month and leap-year boundaries", () => {
    expect(toDateInputValue(addDays("2028-02-28", 1))).toBe("2028-02-29");
    expect(toDateInputValue(addDays("2028-02-29", 1))).toBe("2028-03-01");
    expect(toDateInputValue(addDays("2026-01-01", -1))).toBe("2025-12-31");
  });

  it("builds inclusive ranges, month days, and Sunday-based weeks", () => {
    expect(getDaysInRange("2026-04-29", "2026-05-02")).toEqual([
      "2026-04-29",
      "2026-04-30",
      "2026-05-01",
      "2026-05-02",
    ]);
    expect(getDaysInRange("2026-05-02", "2026-04-29")).toEqual([]);
    expect(getDaysInMonth(2028, 1)).toHaveLength(29);
    expect(toDateInputValue(endOfMonth(2026, 3))).toBe("2026-04-30");

    const week = getWeekRange("2026-04-08");
    expect(toDateInputValue(week.start)).toBe("2026-04-05");
    expect(toDateInputValue(week.end)).toBe("2026-04-11");
    expect(isDateWithinRange("2026-04-07", week.start, week.end)).toBe(true);
    expect(isDateWithinRange("2026-04-12", week.start, week.end)).toBe(false);
  });

  it("formats Arabic and English month labels with explicit zero-based months", () => {
    expect(formatMonthLabel(3, 2026, "ar")).toBe("أبريل 2026");
    expect(formatMonthLabel(3, 2026, "en")).toBe("April 2026");
    expect(() => formatMonthLabel(12, 2026, "en")).toThrow(RangeError);
  });
});

describe("normalization", () => {
  it("normalizes both Arabic digit sets and Arabic/English search text", () => {
    expect(normalizeArabicDigits("٠١٢٣ ۴۵۶۷")).toBe("0123 4567");
    expect(normalizeSearchText("  أَهْلًا، بالمحكمةِ!  ")).toBe("اهلا بالمحكمه");
    expect(normalizeSearchText("CAFÉ — North_Wing")).toBe("cafe north wing");
  });

  it("normalizes enum-like values to safe defaults", () => {
    expect(normalizeShift(" b ")).toBe("B");
    expect(normalizeShift("unknown")).toBe("A");
    expect(normalizeLanguage("EN")).toBe("en");
    expect(normalizeLanguage("anything")).toBe("ar");
  });

  it("normalizes legacy entries and safe users without leaking passwords", () => {
    const normalizedEntry = normalizeEntry({
      kind: "unexpected",
      date: "2026-04-02",
      color: "ORANGE",
      reminderOffsetMinutes: "60",
    });
    expect(normalizedEntry).toMatchObject({
      kind: "assignment",
      date: "2026-04-02",
      color: "",
      reminderOffsetMinutes: 60,
    });
    expect(normalizedEntry.id).toContain("assignment|2026-04-02");

    const normalizedUser = normalizeUser({
      id: 7,
      username: "sample",
      employeeId: 42,
      shift: "m",
      password: "must-not-survive",
      assignments: [normalizedEntry, { date: "not-a-date" }],
      settings: { language: "EN", compact: true },
    });
    expect(normalizedUser).toEqual({
      id: "7",
      username: "sample",
      employee_id: "42",
      shift: "M",
      assignments: [normalizedEntry],
      settings: { language: "en", compact: true },
    });
    expect(normalizedUser).not.toHaveProperty("password");
    expect(normalizeUser(null)).toBeNull();
  });

  it("scores exact and partial normalized name matches", () => {
    const exact = getNameMatchScore("عبدالله جاسم محمد", ["عبدالله", "جاسم"]);
    const partial = getNameMatchScore("عبدالله جاسم محمد", ["عبد", "جاس"]);
    expect(exact).toBeGreaterThan(partial);
    expect(partial).toBeGreaterThan(0);
    expect(getNameMatchScore("someone else", ["عبدالله"])).toBe(0);
  });
});

describe("shift, weekend, eligibility, and day status rules", () => {
  it("uses 2026-04-01 as A in a repeating A/B/C cycle in both directions", () => {
    expect(CYCLE_ANCHOR).toBe("2026-04-01");
    expect(getCycleShiftKey("2026-04-01")).toBe("A");
    expect(getCycleShiftKey("2026-04-02")).toBe("B");
    expect(getCycleShiftKey("2026-04-03")).toBe("C");
    expect(getCycleShiftKey("2026-04-04")).toBe("A");
    expect(getCycleShiftKey("2026-03-31")).toBe("C");
  });

  it("treats Friday and Saturday as weekends", () => {
    expect(isWeekend("2026-04-02")).toBe(false); // Thursday
    expect(isWeekend("2026-04-03")).toBe(true); // Friday
    expect(isWeekend("2026-04-04")).toBe(true); // Saturday
    expect(isWeekend("2026-04-05")).toBe(false); // Sunday
  });

  it("calculates rotating and M shift duty", () => {
    expect(getShiftForDate("2026-04-01", "A")).toBe("duty");
    expect(getShiftForDate("2026-04-01", "B")).toBe("off");
    expect(getShiftForDate("2026-04-02", "M")).toBe("duty");
    expect(getShiftForDate("2026-04-03", "M")).toBe("off");
  });

  it("only assigns eligible off-days and only guards M weekdays", () => {
    expect(canAssign("2026-04-01", "A")).toBe(false); // A duty
    expect(canAssign("2026-04-02", "A")).toBe(true); // A off-day
    expect(canAssign("2026-04-03", "A")).toBe(false); // weekend
    expect(canAssign("2026-04-02", "M")).toBe(true);
    expect(canAssign("2026-04-03", "M")).toBe(false);
    expect(canGuard("2026-04-02", "M")).toBe(true);
    expect(canGuard("2026-04-03", "M")).toBe(false);
    expect(canGuard("2026-04-02", "A")).toBe(false);
  });

  it("prioritizes mixed, assignment, and guard entries in day status", () => {
    const assignment = entry();
    const guard = entry({ id: "guard-1", kind: "guard", name: "" });
    expect(dayStatus("2026-04-02", "M", [assignment, guard], "ar")).toMatchObject({
      key: "mixed",
      label: "فيه تكليف وخفارة",
      shiftStatus: "duty",
    });
    expect(dayStatus("2026-04-02", "A", [assignment], "en").key).toBe("assignment");
    expect(dayStatus("2026-04-02", "M", [guard], "en").key).toBe("guard");
    expect(dayStatus("2026-04-01", "A", [], "en")).toMatchObject({ key: "free", label: "Duty" });
    expect(dayStatus("2026-04-02", "A", [], "en")).toMatchObject({ key: "off", label: "Off" });
  });

  it("labels M weekends as weekend off even if stale entries exist", () => {
    expect(dayStatus("2026-04-03", "M", [entry({ date: "2026-04-03" })], "en")).toMatchObject({
      key: "off",
      label: "Weekend Off",
      shiftStatus: "off",
    });
  });
});

describe("totals", () => {
  const entries = [
    entry({ id: "a1", date: "2026-04-02" }),
    entry({ id: "a2", date: "2026-04-05" }),
    entry({ id: "g1", kind: "guard", date: "2026-04-05" }),
    entry({ id: "a3", date: "2026-05-02" }),
  ];

  it("filters entries by month and optional kind", () => {
    expect(getMonthEntries(entries, 2026, 3)).toHaveLength(3);
    expect(getMonthEntries(entries, 2026, 3, "guard").map((item) => item.id)).toEqual(["g1"]);
  });

  it("counts guards separately and never gives them a financial value", () => {
    expect(calculateTotals(entries, { year: 2026, monthIndex: 3 })).toEqual({
      assignmentCount: 2,
      guardCount: 1,
      totalAmount: 2 * ASSIGNMENT_RATE,
      rate: ASSIGNMENT_RATE,
    });
    expect(calculateTotals(entries, { rate: 25 })).toMatchObject({
      assignmentCount: 3,
      guardCount: 1,
      totalAmount: 75,
    });
  });

  it("rejects ambiguous partial month filters", () => {
    expect(() => calculateTotals(entries, { year: 2026 })).toThrow(TypeError);
  });
});

describe("rule-based smart search", () => {
  const context = {
    year: 2026,
    monthIndex: 3,
    today: "2026-04-01",
    language: "ar" as const,
    user: user({
      shift: "A",
      assignments: [
        entry({ id: "hawalli", date: "2026-04-02", name: "محكمة حولي" }),
        entry({ id: "clinic", date: "2026-04-05", name: "عيادة المارينا" }),
        entry({ id: "guard", kind: "guard", date: "2026-04-06", name: "" }),
      ],
    }),
  };

  it("recognizes equivalent Arabic and English intents", () => {
    expect(getSmartSearchIntent("وين أقرب يوم فاضي؟")).toBe("free");
    expect(getSmartSearchIntent("show available days")).toBe("free");
    expect(getSmartSearchIntent("متى عندي خفارة")).toBe("guard");
    expect(getSmartSearchIntent("my assignments")).toBe("assignment");
    expect(getSmartSearchIntent("Hawalli court")).toBe("hawalli");
    expect(getSmartSearchIntent("what is my shift today")).toBe("shift");
  });

  it("parses ISO, Arabic-digit, short, and current-month day queries strictly", () => {
    expect(parseDateFromQuery("تاريخ ٢٠٢٦/٤/٢", context)).toBe("2026-04-02");
    expect(parseDateFromQuery("2/4", context)).toBe("2026-04-02");
    expect(parseDateFromQuery("يوم 9", context)).toBe("2026-04-09");
    expect(parseDateFromQuery("2026-02-30", context)).toBe("");
  });

  it("builds today, tomorrow, week, and month ranges deterministically", () => {
    const today = getRangeFromQuery("شنو شفتي اليوم", context);
    const tomorrow = getRangeFromQuery("my shift tomorrow", { ...context, language: "en" });
    const week = getRangeFromQuery("هذا الأسبوع", context);
    const month = getRangeFromQuery("assignments this month", { ...context, language: "en" });
    expect(toDateInputValue(today.start)).toBe("2026-04-01");
    expect(toDateInputValue(tomorrow.start)).toBe("2026-04-02");
    expect(getDaysInRange(week.start, week.end)).toHaveLength(7);
    expect(toDateInputValue(month.start)).toBe("2026-04-01");
    expect(toDateInputValue(month.end)).toBe("2026-04-30");
  });

  it("returns an exact date card even when that day has no entries", () => {
    const result = buildSmartSearchResult("شنو عندي بتاريخ 2026-04-09؟", context);
    expect(result.kind).toBe("day");
    if (result.kind === "day") {
      expect(result.item.date).toBe("2026-04-09");
      expect(result.item.entries).toEqual([]);
    }
  });

  it("filters assignment, guard, and Hawalli searches", () => {
    const assignments = buildSmartSearchResult("تكاليف هذا الشهر", context);
    const guards = buildSmartSearchResult("خفارات هذا الشهر", context);
    const hawalli = buildSmartSearchResult("متى محكمة حولي", context);
    expect(assignments.kind).toBe("list");
    expect(assignments.kind === "list" && assignments.items.map((item) => item.date)).toEqual([
      "2026-04-02",
      "2026-04-05",
    ]);
    expect(guards.kind === "list" && guards.items.map((item) => item.date)).toEqual(["2026-04-06"]);
    expect(hawalli.kind === "list" && hawalli.items[0].entries.map((item) => item.id)).toEqual(["hawalli"]);
  });

  it("finds the first eligible empty day and supports English shift queries", () => {
    const nearest = buildSmartSearchResult("أقرب يوم فاضي هذا الشهر", context);
    expect(nearest.kind).toBe("day");
    expect(nearest.kind === "day" && nearest.item.date).toBe("2026-04-08");

    const tomorrow = buildSmartSearchResult("what is my shift tomorrow", { ...context, language: "en" });
    expect(tomorrow.kind).toBe("day");
    expect(tomorrow.kind === "day" && tomorrow.item.date).toBe("2026-04-02");
  });

  it("returns a localized empty result for blank and unmatched searches", () => {
    expect(buildSmartSearchResult("", context)).toMatchObject({ kind: "empty", intent: "empty" });
    const noGuards = buildSmartSearchResult("guards this month", {
      ...context,
      language: "en",
      user: user({ shift: "M", assignments: [] }),
    });
    expect(noGuards).toMatchObject({
      kind: "empty",
      intent: "guard",
      description: "No matching results were found in your current data.",
    });
  });
});

describe("bulk date parsing and preview", () => {
  it("parses Arabic digits, day ranges, full dates, de-duplicates, and reports bad tokens", () => {
    const result = parseBulkDates("١، 2-4\n2026/04/05, 2, bad, 31", { year: 2026, monthIndex: 3 });
    expect(result.dates).toEqual([
      "2026-04-01",
      "2026-04-02",
      "2026-04-03",
      "2026-04-04",
      "2026-04-05",
    ]);
    expect(result.invalidTokens).toEqual(["bad", "31"]);
    expect(parseBulkDateList("7, 7, 8", { year: 2026, monthIndex: 3 })).toEqual([
      "2026-04-07",
      "2026-04-08",
    ]);
  });

  it("builds normalized items and separates duty/weekend dates", () => {
    const preview = buildBulkAddPreview(
      {
        datesText: "1-5, nonsense",
        namePreset: "courts",
        timePreset: "N",
        notes: "  bring ID  ",
        color: "BLUE",
        reminderOffsetMinutes: "60",
      },
      { year: 2026, monthIndex: 3, language: "en", user: user({ shift: "A" }) },
    );

    expect(preview.employeeName).toBe("test-user");
    expect(preview.name).toBe("Courts Complex Clinic");
    expect(preview.invalidDates).toEqual(["2026-04-01", "2026-04-03", "2026-04-04"]);
    expect(preview.invalidTokens).toEqual(["nonsense"]);
    expect(preview.items.map((item) => item.date)).toEqual(["2026-04-02", "2026-04-05"]);
    expect(preview.items[0]).toMatchObject({
      kind: "assignment",
      time: "N",
      notes: "bring ID",
      color: "blue",
      reminderOffsetMinutes: 60,
    });
  });

  it("reports stable validation codes for missing or wholly ineligible input", () => {
    expect(() =>
      buildBulkAddPreview(
        { datesText: "not-a-date", name: "Task", time: "A" },
        { year: 2026, monthIndex: 3, user: user() },
      ),
    ).toThrowError(expect.objectContaining({ code: "bulkNoDates" }));

    expect(() =>
      buildBulkAddPreview(
        { datesText: "1", name: "Task", time: "A" },
        { year: 2026, monthIndex: 3, user: user() },
      ),
    ).toThrowError(expect.objectContaining({ code: "bulkInvalidDates" }));

    try {
      buildBulkAddPreview(
        { datesText: "2", namePreset: "other", time: "A" },
        { year: 2026, monthIndex: 3, language: "en", user: user() },
      );
    } catch (error) {
      expect(error).toBeInstanceOf(CoreValidationError);
      expect(error).toMatchObject({ code: "customNameRequired", message: "Please enter the item name" });
    }
  });
});

describe("ICS export", () => {
  it("escapes RFC 5545 text and emits deterministic timezone-aware events", () => {
    expect(escapeIcsText("a\\b,c;d\r\ne")).toBe("a\\\\b\\,c\\;d\\ne");
    const ics = buildIcsFile(
      entry({
        id: "entry,1",
        name: "Court, West; Wing\\A",
        notes: "Line one\nLine two",
        reminderOffsetMinutes: 120,
      }),
      { now: new Date("2026-04-01T10:11:12Z"), language: "en" },
    );

    expect(ics).not.toBeNull();
    expect(ics).toContain("DTSTAMP:20260401T101112Z\r\n");
    expect(ics).toContain("DTSTART;TZID=Asia/Kuwait:20260402T140000\r\n");
    expect(ics).toContain("DTEND;TZID=Asia/Kuwait:20260402T180000\r\n");
    expect(ics).toContain("SUMMARY:Assignment - Court\\, West\\; Wing\\\\A\r\n");
    expect(ics).toContain("DESCRIPTION:Line one\\nLine two\r\n");
    expect(ics).toContain("TRIGGER:-PT120M\r\n");
    expect(ics).toMatch(/END:VCALENDAR\r\n$/);
  });

  it("handles overnight custom times and rejects invalid times or dates", () => {
    const overnight = buildIcsFile(entry({ date: "2026-04-30", time: "23:30" }), {
      now: new Date("2026-01-01T00:00:00Z"),
      durationMinutes: 90,
    });
    expect(overnight).toContain("DTSTART;TZID=Asia/Kuwait:20260430T233000");
    expect(overnight).toContain("DTEND;TZID=Asia/Kuwait:20260501T010000");
    expect(buildIcsFile(entry({ time: "24:00" }))).toBeNull();
    expect(buildIcsFile(entry({ date: "2026-02-30" }))).toBeNull();
  });

  it("folds long Unicode lines without exceeding 75 UTF-8 octets", () => {
    const folded = foldIcsLine(`SUMMARY:${"تكليف طويل ".repeat(20)}`);
    const encoder = new TextEncoder();
    const lines = folded.split("\r\n");
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.slice(1).every((line) => line.startsWith(" "))).toBe(true);
    expect(lines.every((line) => encoder.encode(line).length <= 75)).toBe(true);
  });
});
