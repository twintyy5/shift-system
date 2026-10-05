import { build } from "esbuild";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";

// Use an owner-provided/current source. Credentials never enter the tracked tree.
const [source, destination = "work/apps-script-upgraded.gs"] = process.argv.slice(2);
if (!source) throw new Error("Usage: node scripts/build-apps-script.mjs <current-backend.gs|--extension-only> [output.gs]");
const bundle = await build({ entryPoints: ["backend/team-service.ts"], bundle: true, format: "iife", globalName: "ShiftAssignmentTeams", target: "es2020", write: false, legalComments: "none" });
if (source === "--extension-only") {
  await mkdir(dirname(resolve(destination)), { recursive: true });
  await writeFile(resolve(destination), bundle.outputFiles[0].text, { mode: 0o600, flag: "wx" });
  console.log("Secret-free team extension prepared. Add its authenticated route to the current backend.");
  process.exit(0);
}
const legacy = await readFile(resolve(source), "utf8");
const boundary = "if(a==='updateProfile')";
const userAuthorization = "if(!u)return fail('Session expired');";
if (!legacy.includes(userAuthorization) || legacy.indexOf(userAuthorization) > legacy.indexOf(boundary)) {
  throw new Error("Unrecognized authorization boundary; review the current backend before upgrading.");
}
if (legacy.includes("getAssignmentTeam")) throw new Error("Backend already has a team action. Review before updating.");
const teamAction = "if(a==='getAssignmentTeam')return json(ShiftAssignmentTeams.getTeamForUser(u,all(),b.entryId));\n    ";
const upgraded = `${bundle.outputFiles[0].text}\n${legacy.replace(boundary, teamAction + boundary)}`;
await mkdir(dirname(resolve(destination)), { recursive: true });
await writeFile(resolve(destination), upgraded, { mode: 0o600, flag: "wx" });
console.log("Backend upgrade prepared. Existing spreadsheet columns and records are unchanged.");
