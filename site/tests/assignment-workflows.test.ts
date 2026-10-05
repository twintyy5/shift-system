import { describe, expect, it } from "vitest";
import { buildAvailableDatesText, buildIcsFile, buildSmartSearchResult, canAssign, getDaysInMonth, getSmartSearchIntent, type Entry, type User } from "../src/core";
import { assignmentPeriodKey, reminderLabel } from "../src/assignment-time";
import { buildAssignmentMessage, matchAssignmentTeam, normalizeContactPhone } from "../src/assignment-team";
import { getTeamForUser } from "../backend/team-service";
import { createApiClient } from "../src/api";

const assignment = (overrides: Partial<Entry> = {}): Entry => ({ id: "entry-1", kind: "assignment", name: "عيادة المركز العلمي", time: "A", date: "2026-10-13", color: "", notes: "", source: "", reminderOffsetMinutes: 60, ...overrides });
const account = (index: number, overrides: Partial<User> = {}): User => ({ id: `user-${index}`, username: `اسم ${index}`, employee_id: String(index), shift: "A", settings: { phone: `5000000${index}` }, assignments: [assignment({ id: `entry-${index}` })], ...overrides });

describe("assignment times and reminders", () => {
  it.each([["A", "140000", "180000", "13:00"], ["N", "180000", "220000", "17:00"]])("exports %s as a four-hour Kuwait assignment with a one-hour reminder", (period, start, end, reminder) => {
    const file = buildIcsFile(assignment({ time: period }));
    expect(file).toContain(`DTSTART;TZID=Asia/Kuwait:20261013T${start}`);
    expect(file).toContain(`DTEND;TZID=Asia/Kuwait:20261013T${end}`);
    expect(file).toContain("TRIGGER:-PT60M");
    expect(reminderLabel("2026-10-13", period, 60, "en")).toBe(reminder);
  });
  it("respects no reminder and handles a reminder on the prior date", () => {
    expect(buildIcsFile(assignment({ reminderOffsetMinutes: 0 }))).not.toContain("VALARM");
    expect(reminderLabel("2026-10-13", "A", 1440, "en")).toContain("12 Oct");
    expect(assignmentPeriodKey("١٨:٠٠")).toBe("18:00");
    expect(assignmentPeriodKey("24:00")).toBe("");
  });
  it("preserves the existing guard hours", () => {
    expect(buildIcsFile(assignment({ kind: "guard", time: "A" }))).toContain("DTSTART;TZID=Asia/Kuwait:20261013T080000");
    expect(buildIcsFile(assignment({ kind: "guard", time: "N" }))).toContain("DTSTART;TZID=Asia/Kuwait:20261013T200000");
  });
});

describe("available dates clipboard", () => {
  it("recognizes أيام الراحة and copies only eligible unbooked dates", () => {
    const user = account(1, { assignments: [assignment({ date: "2026-10-05" })] });
    expect(getSmartSearchIntent("ايام الراحة")).toBe("free");
    const result = buildSmartSearchResult("أيام الراحة", { year: 2026, monthIndex: 9, language: "ar", user });
    const text = buildAvailableDatesText(result, user);
    const expected = getDaysInMonth(2026, 9).filter((date) => canAssign(date, "A") && date !== "2026-10-05");
    expect(text.split("\n")).toEqual(expected.map((date) => date.split("-").reverse().join("/")));
    expect(text).not.toMatch(/[\p{L}]/u);
    expect(text).not.toContain("05/10/2026");
  });
  it("does not export an occupied exact date or unrelated search results", () => {
    const user = account(1);
    const exact = buildSmartSearchResult("راحة 2026-10-13", { year: 2026, monthIndex: 9, user });
    expect(buildAvailableDatesText(exact, user)).toBe("");
    expect(buildAvailableDatesText(buildSmartSearchResult("تكاليف", { year: 2026, monthIndex: 9, user }), user)).toBe("");
  });
});

describe("three-person assignment team", () => {
  const users = [account(3), account(1), account(2, { assignments: [assignment({ id: "entry-2", name: "Science Center Clinic", time: "14:00" })] })];
  it("matches bilingual clinic names and equivalent times with the same order for everyone", () => {
    const team = matchAssignmentTeam(assignment(), users);
    expect(team.members.map((member) => member.employeeId)).toEqual(["1", "2", "3"]);
    for (const user of users) expect(getTeamForUser(user, users, user.assignments[0].id).team).toEqual(team);
    expect(team.members[0]).toEqual({ userId: "user-1", name: "اسم 1", employeeId: "1", phone: "50000001" });
  });
  it("does not reveal a different clinic, date, period, or another user's assignment", () => {
    const unrelated = [account(4, { assignments: [assignment({ name: "عيادة المارينا" })] }), account(5, { assignments: [assignment({ time: "N" })] }), account(6, { assignments: [assignment({ date: "2026-10-14" })] })];
    expect(matchAssignmentTeam(assignment(), [...users, ...unrelated]).members).toHaveLength(3);
    expect(() => getTeamForUser(users[0], users, "entry-1")).toThrow("TEAM_FORBIDDEN");
    expect(() => getTeamForUser(account(7, { assignments: [assignment({ kind: "guard" })] }), users, "entry-1")).toThrow("TEAM_FORBIDDEN");
  });
  it("deduplicates accounts and refuses silently truncated rosters", () => {
    expect(matchAssignmentTeam(assignment(), [...users, users[0]]).members).toHaveLength(3);
    expect(() => matchAssignmentTeam(assignment(), [...users, account(4)])).toThrow("TEAM_OVER_CAPACITY");
  });
  it("copies exactly three slots and leaves the recipient blank", () => {
    const text = buildAssignmentMessage(assignment(), matchAssignmentTeam(assignment(), users).members);
    expect(text).toContain("تكليف عيادة المركز العلمي خارج الدوام\nبتاريخ 13/10/2026\nالثلاثاء");
    expect(text).toContain("المكلف الأول: اسم 1\nم.ط.ط: 1\nرقم التلفون: 50000001");
    expect(text.match(/المكلف /g)).toHaveLength(3);
    expect(text.endsWith("اسم المستلم:")).toBe(true);
    expect(buildAssignmentMessage(assignment(), [])).toContain("المكلف الثالث: \nم.ط.ط: \nرقم التلفون: ");
    expect(normalizeContactPhone("+٩٦٥ ٥٠٠٠-٠٠٠١")).toBe("+96550000001");
  });
  it("refreshes real contact changes in the mock API and rejects unauthorized reads", async () => {
    const api = createApiClient("mock");
    const first = await api.login({ identifier: "demo-a", password: "demo" });
    const second = await api.login({ identifier: "demo-b", password: "demo" });
    const entryId = first.user.assignments[0].id;
    expect((await api.getAssignmentTeam(first.sessionToken, entryId)).members).toHaveLength(3);
    await api.updateProfile(second.sessionToken, { settings: { contactName: "اسم جديد", phone: "٥٥٥٥٥٥٥٥" } });
    expect((await api.getAssignmentTeam(first.sessionToken, entryId)).members.find((member) => member.employeeId === second.user.employee_id)?.name).toBe("اسم جديد");
    await expect(api.getAssignmentTeam(second.sessionToken, entryId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await api.deleteAssignment(second.sessionToken, { entryId: second.user.assignments[0].id, date: second.user.assignments[0].date, kind: "assignment" });
    expect((await api.getAssignmentTeam(first.sessionToken, entryId)).members).toHaveLength(2);
  });
});
