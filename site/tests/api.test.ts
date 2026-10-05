import { describe, expect, it, vi } from "vitest";
import {
  ApiError,
  MOCK_ACCOUNT_CREDENTIALS,
  createApiClient,
  type AssignmentInput,
} from "../src/api";

const assignment = (name = "Test assignment"): AssignmentInput => ({
  kind: "assignment",
  date: "2026-09-10",
  name,
  time: "A",
  notes: "Mock-only test data",
  color: "",
  reminderOffsetMinutes: 30,
});

describe("production API adapter", () => {
  it("posts the legacy action and payload to the relative endpoint", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            ok: true,
            user: {
              username: "demo-a",
              employee_id: "DEMO-001",
              shift: "A",
              assignments: [],
              settings: {},
            },
            sessionToken: "test-token",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    );
    const api = createApiClient("production", {
      fetch: fetchMock as typeof fetch,
    });

    await expect(
      api.login({ identifier: "DEMO-001", password: "not-a-real-password" }),
    ).resolves.toMatchObject({ sessionToken: "test-token", admin: false });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/action");
    expect(init).toMatchObject({
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      action: "login",
      identifier: "DEMO-001",
      password: "not-a-real-password",
    });
  });

  it("preserves legacy assignment action names and payload fields", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            ok: true,
            user: {
              username: "demo-a",
              employee_id: "DEMO-001",
              shift: "A",
              assignments: [],
              settings: {},
            },
          }),
        ),
    );
    const api = createApiClient("production", {
      fetch: fetchMock as typeof fetch,
    });
    await api.addAssignment("session", assignment());

    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      action: "addAssignment",
      sessionToken: "session",
      assignment: assignment(),
    });
  });

  it("accepts an admin restore response with no user", async () => {
    const api = createApiClient("production", {
      fetch: vi.fn(async () =>
        new Response(
          JSON.stringify({
            ok: true,
            admin: true,
          }),
        ),
      ) as typeof fetch,
    });

    await expect(api.restoreSession("admin-token")).resolves.toEqual({
      admin: true,
      sessionToken: "admin-token",
    });
  });

  it("turns server failures and malformed replies into ApiError", async () => {
    const failedFetch = vi.fn(async () =>
      new Response(JSON.stringify({ ok: false, error: "No access" }), {
        status: 403,
      }),
    );
    const api = createApiClient("production", {
      fetch: failedFetch as typeof fetch,
    });

    await expect(api.restoreSession("token")).rejects.toMatchObject({
      name: "ApiError",
      code: "API_ERROR",
      status: 403,
      message: "No access",
    });

    const malformedApi = createApiClient("production", {
      fetch: vi.fn(async () => new Response("not json")) as typeof fetch,
    });
    await expect(malformedApi.restoreSession("token")).rejects.toBeInstanceOf(
      ApiError,
    );
  });

  it("aborts and reports requests that exceed the timeout", async () => {
    const hangingFetch = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );
    const api = createApiClient("production", {
      fetch: hangingFetch as typeof fetch,
      timeoutMs: 5,
    });

    await expect(api.restoreSession("token")).rejects.toMatchObject({
      name: "ApiError",
      code: "TIMEOUT",
    });
  });
});

describe("in-memory mock API", () => {
  it("ships isolated A, B, C, M and administrator demo accounts without networking", async () => {
    const networkSpy = vi.fn();
    const api = createApiClient("mock", {
      fetch: networkSpy as unknown as typeof fetch,
    });

    const shifts: string[] = [];
    for (const credentials of MOCK_ACCOUNT_CREDENTIALS.filter(
      (item) => !item.admin,
    )) {
      const session = await api.login({
        identifier: credentials.username,
        password: credentials.password,
      });
      shifts.push(session.user.shift);
    }
    const adminSession = await api.adminLogin({ password: "demo" });
    expect(adminSession).toMatchObject({ admin: true });
    expect(shifts).toEqual(["A", "B", "C", "M"]);
    expect(networkSpy).not.toHaveBeenCalled();
  });

  it("registers synthetic users and supports login by employee id", async () => {
    const api = createApiClient("mock");
    const registered = await api.register({
      username: "new-demo-user",
      password: "temporary-demo-password",
      employeeId: "DEMO-NEW",
      shift: "C",
    });
    expect(registered.user).toMatchObject({
      username: "new-demo-user",
      employee_id: "DEMO-NEW",
      shift: "C",
    });

    await expect(
      api.login({
        identifier: "demo-new",
        password: "temporary-demo-password",
      }),
    ).resolves.toMatchObject({ user: { username: "new-demo-user" } });
  });

  it("supports assignment CRUD and does not leak mutable state", async () => {
    const api = createApiClient("mock");
    const session = await api.login({ identifier: "demo-m", password: "demo" });
    const originalCount = session.user.assignments.length;

    const created = await api.addAssignment(session.sessionToken, assignment());
    expect(created.assignments).toHaveLength(originalCount + 1);
    const createdEntry = created.assignments.at(-1)!;

    createdEntry.name = "Mutated outside the API";
    const unchanged = await api.restoreSession(session.sessionToken);
    expect(unchanged.admin).toBe(false);
    if (unchanged.admin) throw new Error("Expected a user session");
    expect(unchanged.user.assignments.at(-1)?.name).toBe("Test assignment");

    const updated = await api.updateAssignment(
      session.sessionToken,
      createdEntry.id,
      { ...createdEntry, name: "Updated assignment", kind: "guard" },
    );
    expect(updated.assignments.at(-1)).toMatchObject({
      id: createdEntry.id,
      name: "Updated assignment",
      kind: "guard",
    });
    expect(updated.guardCount).toBe(1);

    const removed = await api.deleteAssignment(session.sessionToken, {
      entryId: createdEntry.id,
      kind: "assignment",
      date: "1900-01-01",
    });
    expect(removed.assignments).toHaveLength(originalCount);
  });

  it("supports bulk upsert, profile updates, and clearing assignments", async () => {
    const api = createApiClient("mock");
    const { sessionToken } = await api.login({
      identifier: "demo-m",
      password: "demo",
    });

    const bulkResult = await api.bulkUpsertAssignments(sessionToken, [
      { ...assignment("First"), id: "bulk-first" },
      { ...assignment("Second"), id: "bulk-second", kind: "guard" },
      { ...assignment("First updated"), id: "bulk-first" },
    ]);
    expect(bulkResult.assignments.find((item) => item.id === "bulk-first")?.name).toBe(
      "First updated",
    );

    const profile = await api.updateProfile(sessionToken, {
      username: "demo-m-updated",
      password: "updated-demo-password",
      employeeId: "DEMO-UPDATED",
      shift: "M",
      settings: { language: "en", compact: true, nested: { enabled: true } },
    });
    expect(profile).toMatchObject({
      username: "demo-m-updated",
      employee_id: "DEMO-UPDATED",
      shift: "M",
      settings: { language: "en", compact: true, nested: { enabled: true } },
    });

    (profile.settings.nested as { enabled: boolean }).enabled = false;
    const restored = await api.restoreSession(sessionToken);
    if (restored.admin) throw new Error("Expected a user session");
    expect(restored.user.settings.nested).toEqual({ enabled: true });

    const cleared = await api.clearAssignments(sessionToken);
    expect(cleared.assignments).toEqual([]);
    expect(cleared.assignmentCount).toBe(0);
    expect(cleared.guardCount).toBe(0);
  });

  it("restores both session kinds, enforces admin listing, and invalidates logout", async () => {
    const api = createApiClient("mock");
    const userSession = await api.login({ identifier: "demo-c", password: "demo" });
    await expect(api.restoreSession(userSession.sessionToken)).resolves.toMatchObject({
      user: { username: "demo-c" },
    });
    await expect(
      api.adminListUsers(userSession.sessionToken, "demo"),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });

    const adminSession = await api.adminLogin({ password: "demo" });
    await expect(api.restoreSession(adminSession.sessionToken)).resolves.toEqual({
      admin: true,
      sessionToken: adminSession.sessionToken,
    });
    const results = await api.adminListUsers(adminSession.sessionToken, "DEMO-003");
    expect(results.map((user) => user.username)).toEqual(["demo-c"]);

    await api.logout(userSession.sessionToken);
    await expect(api.restoreSession(userSession.sessionToken)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("keeps state isolated between mock client instances", async () => {
    const first = createApiClient("mock");
    const second = createApiClient("mock");
    const firstSession = await first.login({ identifier: "demo-m", password: "demo" });
    const secondSession = await second.login({ identifier: "demo-m", password: "demo" });

    await first.clearAssignments(firstSession.sessionToken);
    const firstRestored = await first.restoreSession(firstSession.sessionToken);
    const secondRestored = await second.restoreSession(secondSession.sessionToken);
    if (firstRestored.admin || secondRestored.admin) {
      throw new Error("Expected user sessions");
    }
    expect(firstRestored.user.assignments).toHaveLength(0);
    expect(secondRestored.user.assignments.length).toBeGreaterThan(0);
  });
});
