import { assignmentPeriodKey } from "./assignment-time";

export interface TeamMember {
  userId: string;
  name: string;
  employeeId: string;
  phone: string;
}

export interface AssignmentTeam {
  members: TeamMember[];
  capacity: 3;
}

type MatchingEntry = { kind: string; date: string; name: string; time: string; id?: string };
type TeamAccount = {
  id?: string;
  username: string;
  employee_id: string;
  settings?: { contactName?: unknown; phone?: unknown; [key: string]: unknown };
  assignments: MatchingEntry[];
};

function normalizeName(value: unknown): string {
  return String(value ?? "").normalize("NFKD").toLowerCase()
    .replace(/[\u0300-\u036f\u064b-\u065f\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
}

const clinics: Record<string, string[]> = {
  science: ["المركز العلمي", "عيادة المركز العلمي", "science center", "science centre", "science center clinic", "science centre clinic"],
  boulevard: ["البوليفارد", "عيادة البوليفارد", "boulevard", "boulevard clinic"],
  marina: ["المارينا", "عيادة المارينا", "marina", "marina clinic"],
  promenade: ["البروميناد", "عيادة البروميناد", "promenade", "promenade clinic"],
  courts: ["مجمع المحاكم", "عيادة مجمع المحاكم", "courts complex", "courts complex clinic"],
};
const aliases = new Map(Object.entries(clinics).flatMap(([key, names]) => names.map((name) => [normalizeName(name), key] as const)));

export function clinicKey(name: string): string {
  const normalized = normalizeName(name);
  return aliases.get(normalized) ?? normalized;
}

export function assignmentTeamKey(entry: MatchingEntry): string {
  const clinic = clinicKey(entry.name);
  const period = assignmentPeriodKey(entry.time);
  if (entry.kind !== "assignment" || !clinic || !period || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) return "";
  const date = new Date(`${entry.date}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== entry.date) return "";
  return JSON.stringify([entry.date, clinic, period]);
}

export function normalizeContactPhone(value: unknown): string {
  return String(value ?? "").trim()
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[\s()\-]/g, "").slice(0, 20);
}

export function validContactPhone(value: string): boolean {
  return !value || /^(?:\+?[1-9]\d{6,14}|0\d{6,14})$/.test(value);
}

/** Expose only contact fields of accounts with an exact matching assignment. */
export function matchAssignmentTeam(entry: MatchingEntry, users: TeamAccount[]): AssignmentTeam {
  const key = assignmentTeamKey(entry);
  if (!key) throw new Error("TEAM_INVALID_ASSIGNMENT");
  const seen = new Set<string>();
  const members = users.filter((user) => user.assignments.some((item) => assignmentTeamKey(item) === key))
    .filter((user) => {
      const identity = user.id || user.employee_id;
      if (!identity || seen.has(identity)) return false;
      seen.add(identity); return true;
    })
    .map((user) => ({
      userId: String(user.id || user.employee_id),
      name: String(user.settings?.contactName || user.username).trim().slice(0, 120),
      employeeId: String(user.employee_id).trim().slice(0, 120),
      phone: normalizeContactPhone(user.settings?.phone),
    }))
    .sort((a, b) => a.employeeId.localeCompare(b.employeeId, "en", { numeric: true }) || a.userId.localeCompare(b.userId));
  // Never silently hide the fourth colleague or give different rosters to different accounts.
  if (members.length > 3) throw new Error("TEAM_OVER_CAPACITY");
  return { members, capacity: 3 };
}

export function buildAssignmentMessage(entry: MatchingEntry, members: readonly TeamMember[]): string {
  const parts = entry.date.split("-");
  const date = new Date(`${entry.date}T12:00:00+03:00`);
  if (!assignmentTeamKey(entry) || Number.isNaN(date.getTime()) || members.length > 3) throw new Error("TEAM_INVALID_ASSIGNMENT");
  const day = new Intl.DateTimeFormat("ar-KW", { weekday: "long", timeZone: "Asia/Kuwait" }).format(date);
  const clinic = entry.name.trim().replace(/^عيادة\s+/u, "");
  const labels = ["الأول", "الثاني", "الثالث"];
  return [
    "السلام عليكم",
    `تكليف عيادة ${clinic} خارج الدوام`,
    `بتاريخ ${parts[2]}/${parts[1]}/${parts[0]}`,
    day,
    "",
    ...labels.flatMap((label, index) => {
      const member = members[index];
      return [`المكلف ${label}: ${member?.name || ""}`, `م.ط.ط: ${member?.employeeId || ""}`, `رقم التلفون: ${member?.phone || ""}`, ""];
    }),
    "اسم المستلم:",
  ].join("\n");
}
