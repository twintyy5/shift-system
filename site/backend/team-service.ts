import { matchAssignmentTeam } from "../src/assignment-team";

type TeamUser = Parameters<typeof matchAssignmentTeam>[1][number];

/** Called only after the existing Apps Script session/user authorization. */
export function getTeamForUser(user: TeamUser, users: TeamUser[], entryId: string) {
  const entry = user.assignments.find((item) => item.id === String(entryId || "") && item.kind === "assignment");
  if (!entry) throw new Error("TEAM_FORBIDDEN");
  return { ok: true, team: matchAssignmentTeam(entry, users) };
}
