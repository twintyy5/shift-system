import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { SourceTextModule } from "node:vm";

// Load the production client and its real domain dependencies. Only HTTP
// responses use synthetic accounts; no real account or session is accessed.
const modules = new Map();
async function loadModule(url) {
  if (modules.has(url.href)) return modules.get(url.href);
  const source = await readFile(url, "utf8");
  const loaded = new SourceTextModule(stripTypeScriptTypes(source), { identifier: url.href });
  modules.set(url.href, loaded);
  await loaded.link(specifier => loadModule(new URL(`${specifier}.ts`, url)));
  return loaded;
}
const module = await loadModule(new URL("../src/api.ts", import.meta.url));
await module.evaluate();
const { createApiClient } = module.namespace;
const user = { id: "synthetic", username: "demo", employee_id: "1234", shift: "A", assignments: [], settings: {} };
const success = () => new Response(JSON.stringify({ ok: true, user, sessionToken: "synthetic-session" }));

test("simultaneous identical logins send only one network request", async () => {
  let calls = 0, release;
  const client = createApiClient("production", { fetch: () => { calls++; return new Promise(resolve => { release = () => resolve(success()); }); } });
  const input = { identifier: "synthetic", password: "synthetic-password" };
  const first = client.login(input), second = client.login(input);
  assert.equal(calls, 1); release();
  const [a, b] = await Promise.all([first, second]); assert.equal(a.user.id, b.user.id);
});

test("completed session reads are fetched again, so revocation is not hidden by a cache", async () => {
  let calls = 0;
  const client = createApiClient("production", { fetch: async () => { calls++; return success(); } });
  await client.restoreSession("synthetic-session"); await client.restoreSession("synthetic-session"); assert.equal(calls, 2);
});

test("simultaneous profile writes are never merged", async () => {
  let calls = 0;
  const client = createApiClient("production", { fetch: async () => { calls++; return success(); } });
  await Promise.all([client.updateProfile("synthetic-session", { shift: "A" }), client.updateProfile("synthetic-session", { shift: "A" })]);
  assert.equal(calls, 2);
});

test("different session tokens never share a network response", async () => {
  let calls = 0;
  const client = createApiClient("production", { fetch: async () => { calls++; return success(); } });
  await Promise.all([client.restoreSession("synthetic-a"), client.restoreSession("synthetic-b")]); assert.equal(calls, 2);
});

test("authentication failures, timeouts, and unavailable service remain distinguishable", async () => {
  for (const [status, code] of [[401, "INVALID_CREDENTIALS"], [504, "TIMEOUT"], [502, "SERVICE_UNAVAILABLE"]]) {
    const client = createApiClient("production", { fetch: async () => new Response(JSON.stringify({ ok: false, error: "Synthetic failure" }), { status }) });
    await assert.rejects(client.login({ identifier: "synthetic", password: "synthetic" }), error => error.code === code && error.status === status);
  }
});

test("timeout aborts the underlying request and does not leave a rejected request pinned", async () => {
  let signal, calls = 0;
  const client = createApiClient("production", { timeoutMs: 10, fetch: (_, options) => { calls++; signal = options.signal; return new Promise(() => {}); } });
  await assert.rejects(client.restoreSession("synthetic-session"), error => error.code === "TIMEOUT"); assert.equal(signal.aborted, true);
  await assert.rejects(client.restoreSession("synthetic-session"), error => error.code === "TIMEOUT"); assert.equal(calls, 2);
});
