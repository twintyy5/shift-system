# Shift System V3

Responsive React/TypeScript refresh of the existing staff shift calendar.

## Safety model

- The deployed app uses the existing Google Apps Script contract through the
  same-origin `/api/action` Vercel Function.
- The Google Sheet schema and existing records are not migrated or rewritten.
- `?demo=1` enables a fully in-memory demo; it never contacts the production
  data service.
- The previous production deployment remains separate for instant rollback.

## Commands

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm build
pnpm dev
```

Node.js 22 or newer is recommended.

## V3 first-account tour

A successful new registration opens a short Arabic/English guided tour of the
actual calendar, assignment button, colleague contact settings and smart search.
The last step displays technician Abdullah Jassim and 55992375 with a call link.
Next, back and skip work on phones and with a keyboard. Existing accounts can
open it through Settings → Site guide without an automatic interruption.

Finishing or skipping saves the boolean `settings.onboardingCompleted` through
the existing authenticated profile endpoint. A failed save leaves the app usable
and shows an error. The tour is loaded on demand, creates no assignments, and
keeps the existing session and local preference keys. No Sheet schema or Apps
Script deployment change is needed; the backend already merges settings JSON.
`/api/health` adds version `3.0.0` and retains its existing service identifier.

## Assignment teams and reminders

Assignments use Kuwait time: A is 14:00–18:00 and N is 18:00–22:00.
A 60-minute reminder is exported to the device calendar at 13:00 or 17:00;
the site does not promise background push notifications. Existing guard hours
and shift eligibility are preserved.

`أيام الراحة` returns eligible unoccupied dates. Copy produces DD/MM/YYYY,
one date per line. The team dialog has three slots and a ready Arabic message
with an empty recipient. Accounts must share the exact date, canonical clinic,
and period to see one another. Name and phone are saved in the account's existing
settings JSON; employee ID comes from the account. Missing contacts remain blank.

### Apps Script deployment

The live backend must implement `getAssignmentTeam` before publishing the UI.
Generate a secret-free extension from the same matching code used in tests:

```bash
node scripts/build-apps-script.mjs --extension-only work/TeamService.gs
```

Add that as a new Apps Script file. In the **current** `doPost` handler, after
session validation, the admin rejection, and the existing `u` lookup, add:

```javascript
if(a==='getAssignmentTeam')return json(ShiftAssignmentTeams.getTeamForUser(u,all(),b.entryId));
```

Never place this route before authentication. It derives clinic/date/period from
an assignment owned by the signed-in user, and exposes only matched contact
records. More than three matches produces a visible conflict instead of silently
dropping a person. The extension does not alter spreadsheet columns or records.

Publish a new version on the existing Apps Script deployment to retain its URL.
Keep its prior version for rollback. Then deploy the frontend to a Vercel preview,
verify `/api/health` and the real team endpoint with an owner-provided session,
and only then promote production. Demo tests use isolated in-memory accounts
`demo-a`, `demo-b`, `demo-m` (password `demo`); they share a seeded assignment.
`demo-c` has a different period and must not appear in their team.

The script also accepts a reviewed current backend file as its first argument
to produce a complete patched file under ignored `work/`. That output may contain
existing secrets: do not commit or include it in release archives.
