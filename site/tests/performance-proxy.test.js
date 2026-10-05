import assert from "node:assert/strict";
import { test, afterEach } from "node:test";
import handler from "../api/action.js";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
function request(action, payload = {}) {
  return { method: "POST", headers: { host: "test.local", origin: "https://test.local", "x-forwarded-for": "test" }, body: { action, ...payload } };
}
function response() {
  return { headers: {}, statusCode: 0, body: null, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}
function upstream(body, ok = true) { return { ok, text: async () => JSON.stringify(body) }; }
const user = { id: "synthetic", username: "demo", employee_id: "3426", shift: "A", assignments: [], settings: {} };

test("normalizes Arabic employee digits and invisible direction marks without changing passwords", async () => {
  let sent;
  globalThis.fetch = async (_, options) => { sent = JSON.parse(options.body); return upstream({ ok: true, user, sessionToken: "synthetic-session" }); };
  const res = response();
  await handler(request("login", { identifier: "\u200f٣٤٢٦\u200e", password: "  keep spaces  " }), res);
  assert.equal(sent.identifier, "3426"); assert.equal(sent.password, "  keep spaces  "); assert.equal(res.statusCode, 200);
});

test("rejects a failing upstream HTTP response even when its JSON says ok", async () => {
  globalThis.fetch = async () => upstream({ ok: true, user }, false);
  const res = response(); await handler(request("restoreSession", { sessionToken: "http-fail" }), res);
  assert.equal(res.statusCode, 502); assert.equal(res.body.ok, false); assert.equal(res.body.user, undefined);
});

test("distinguishes refused credentials from unavailable service", async () => {
  globalThis.fetch = async () => upstream({ ok: false, error: "Invalid credentials" });
  const res = response(); await handler(request("login", { identifier: "synthetic-login", password: "wrong" }), res);
  assert.equal(res.statusCode, 401); assert.equal(res.body.error, "Invalid credentials");
});

test("coalesces simultaneous reads and releases them when complete", async () => {
  let calls = 0, release;
  globalThis.fetch = () => { calls++; return new Promise(resolve => { release = () => resolve(upstream({ ok: true, user })); }); };
  const a = response(), b = response();
  const first = handler(request("restoreSession", { sessionToken: "same-read" }), a);
  const second = handler(request("restoreSession", { sessionToken: "same-read" }), b);
  assert.equal(calls, 1); release(); await Promise.all([first, second]);
  assert.equal(a.statusCode, 200); assert.equal(b.statusCode, 200);
  globalThis.fetch = async () => { calls++; return upstream({ ok: true, user }); };
  await handler(request("restoreSession", { sessionToken: "same-read" }), response()); assert.equal(calls, 2);
});

test("isolates concurrent reads for different sessions", async () => {
  let calls = 0; globalThis.fetch = async () => { calls++; return upstream({ ok: true, user }); };
  await Promise.all([handler(request("restoreSession", { sessionToken: "isolated-a" }), response()), handler(request("restoreSession", { sessionToken: "isolated-b" }), response())]);
  assert.equal(calls, 2);
});

test("never coalesces or retries mutations", async () => {
  let calls = 0; globalThis.fetch = async () => { calls++; return upstream({ ok: true, user }); };
  const payload = { sessionToken: "write-session", assignment: { date: "2026-10-05", name: "Synthetic clinic" } };
  await Promise.all([handler(request("addAssignment", payload), response()), handler(request("addAssignment", payload), response())]);
  assert.equal(calls, 2);
});

test("uses one deadline across a legacy read-then-write update", async () => {
  const signals = [];
  globalThis.fetch = async (_, options) => { signals.push(options.signal); return upstream({ ok: true, user: { ...user, assignments: [{ id: "legacy", date: "2026-10-05", name: "Synthetic clinic" }] } }); };
  const res = response();
  await handler(request("updateAssignment", { sessionToken: "legacy-update", entryId: "legacy", assignment: { notes: "changed" } }), res);
  assert.equal(signals.length, 2); assert.ok(signals[0] instanceof AbortSignal); assert.equal(signals[0], signals[1]); assert.equal(res.statusCode, 200);
});

test("reports aborts as service timeouts and clears pending reads after failure", async () => {
  globalThis.fetch = async () => { throw new DOMException("The operation was aborted", "AbortError"); };
  const res = response(); await handler(request("restoreSession", { sessionToken: "timeout-read" }), res);
  assert.equal(res.statusCode, 504);
  globalThis.fetch = async () => upstream({ ok: true, user });
  const retry = response(); await handler(request("restoreSession", { sessionToken: "timeout-read" }), retry);
  assert.equal(retry.statusCode, 200);
});

test("rejects malformed upstream success without revealing upstream content", async () => {
  globalThis.fetch = async () => upstream({ user, sensitive: "must-not-leak" });
  const res = response(); await handler(request("restoreSession", { sessionToken: "bad-json" }), res);
  assert.equal(res.statusCode, 502); assert.equal(JSON.stringify(res.body).includes("must-not-leak"), false);
});
