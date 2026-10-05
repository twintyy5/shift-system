/** Clock values are wall-clock times in Kuwait, independent of the browser zone. */
export function resolveAssignmentTime(value: unknown, kind: "assignment" | "guard" = "assignment"): { hours: number; minutes: number } | null {
  const time = String(value ?? "").trim().toUpperCase()
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
  if (["A", "صباحي", "الفترة الأولى", "الفترة الاولى"].includes(time)) return { hours: kind === "guard" ? 8 : 14, minutes: 0 };
  if (["N", "نايت", "ليلي", "الفترة الثانية"].includes(time)) return { hours: kind === "guard" ? 20 : 18, minutes: 0 };
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return null;
  return { hours: Number(match[1]), minutes: Number(match[2]) };
}

export function assignmentPeriodKey(value: unknown, kind: "assignment" | "guard" = "assignment"): string {
  const time = resolveAssignmentTime(value, kind);
  return time ? `${String(time.hours).padStart(2, "0")}:${String(time.minutes).padStart(2, "0")}` : "";
}

export function assignmentTimeLabel(value: unknown, language: "ar" | "en" = "ar", kind: "assignment" | "guard" = "assignment"): string {
  const key = assignmentPeriodKey(value, kind);
  if (kind === "guard") return key;
  if (key === "14:00") return language === "ar" ? "الصباحي · ٢–٦ مساءً" : "First period · 2–6 PM";
  if (key === "18:00") return language === "ar" ? "النايت · ٦–١٠ مساءً" : "Night · 6–10 PM";
  return key || String(value ?? "");
}

export function reminderLabel(date: string, time: unknown, offset: number, language: "ar" | "en" = "ar", kind: "assignment" | "guard" = "assignment"): string {
  const start = assignmentPeriodKey(time, kind);
  if (!start || !Number.isFinite(offset) || offset <= 0) return "";
  const instant = new Date(`${date}T${start}:00+03:00`);
  if (Number.isNaN(instant.getTime())) return "";
  instant.setTime(instant.getTime() - offset * 60_000);
  const options: Intl.DateTimeFormatOptions = { timeZone: "Asia/Kuwait", hour: "numeric", minute: "2-digit" };
  const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuwait", year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
  if (localDate !== date) Object.assign(options, { day: "numeric", month: "short" });
  return new Intl.DateTimeFormat(language === "ar" ? "ar-KW" : "en-GB", options).format(instant);
}
