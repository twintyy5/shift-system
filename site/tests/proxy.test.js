import { afterEach, describe, expect, it, vi } from "vitest";
import handler from "../api/action.js";

function makeResponse() {
  return {
    statusCode: 200,
    headers: {},
    payload: undefined,
    ended: false,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
    end() {
      this.ended = true;
      return this;
    },
  };
}

function makeRequest(body, headers = {}) {
  return {
    method: "POST",
    body,
    headers: {
      host: "preview.example.test",
      origin: "https://preview.example.test",
      "x-forwarded-for": `test-${Math.random()}`,
      ...headers,
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Vercel API proxy", () => {
  it.each([true, false, "true"])("round-trips only a boolean tour preference (%s)", async (preference) => {
    const allowed = typeof preference === "boolean" ? { onboardingCompleted: preference } : {};
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
      expect(JSON.parse(init.body).changes.settings).toEqual(allowed);
      return new Response(JSON.stringify({ ok: true, user: {
        username: "staff", employee_id: "100", shift: "A", assignments: [],
        settings: { onboardingCompleted: preference, language: "ar", _id: "private" },
      } }));
    }));
    const res = makeResponse();
    await handler(makeRequest({ action: "updateProfile", sessionToken: "token",
      changes: { settings: { onboardingCompleted: preference, _id: "spoof" } },
    }), res);
    expect(res.statusCode).toBe(200);
    expect(res.payload.user.settings).toEqual({ ...allowed, language: "ar" });
  });

  it("derives coworker scope upstream and returns only the three contact fields and identity", async () => {
    const upstream = vi.fn(async (_url, init) => {
      expect(JSON.parse(init.body)).toEqual({ action: "getAssignmentTeam", sessionToken: "token", entryId: "mine" });
      return new Response(JSON.stringify({ ok: true, team: { capacity: 3, members: [{
        userId: "colleague", name: "زميل", employeeId: "100", phone: "50000001",
        password: "private", assignments: [{ notes: "private" }], settings: { _id: "private" },
      }] } }));
    });
    vi.stubGlobal("fetch", upstream);
    const res = makeResponse();
    await handler(makeRequest({ action: "getAssignmentTeam", sessionToken: "token", entryId: "mine", userId: "someone-else", clinic: "other", date: "2026-10-13" }), res);
    expect(res.statusCode).toBe(200);
    expect(res.payload.team.members).toEqual([{ userId: "colleague", name: "زميل", employeeId: "100", phone: "50000001" }]);
    const denied = makeResponse();
    await handler(makeRequest({ action: "getAssignmentTeam", entryId: "mine" }), denied);
    expect(denied.statusCode).toBe(400);
    expect(upstream).toHaveBeenCalledTimes(1);
  });

  it("normalizes coworker contact data while excluding internal settings", async () => {
    const upstream = vi.fn(async (_url, init) => {
      expect(JSON.parse(init.body).changes.settings).toEqual({ contactName: "الاسم", phone: "+96550000001", language: "ar" });
      return new Response(JSON.stringify({ ok: true }));
    });
    vi.stubGlobal("fetch", upstream);
    const res = makeResponse();
    await handler(makeRequest({ action: "updateProfile", sessionToken: "token", changes: { settings: { contactName: "الاسم", phone: "+٩٦٥ ٥٠٠٠-٠٠٠١", language: "ar", _id: "spoof" } } }), res);
    expect(res.statusCode).toBe(200);
  });

  it("forwards the legacy assignment contract and removes private fields", async () => {
    let forwarded;
    const upstream = vi.fn(async (_url, init) => {
      forwarded = JSON.parse(init.body);
      return new Response(JSON.stringify({
        ok: true,
        user: {
          id: "user-1",
          username: "staff",
          password: "must-not-leak",
          employee_id: "100",
          shift: "A",
          assignments: [],
          settings: { language: "ar", _id: "private" },
        },
      }));
    });
    vi.stubGlobal("fetch", upstream);
    const res = makeResponse();

    await handler(makeRequest({
      action: "addAssignment",
      sessionToken: "session-token",
      assignment: {
        kind: "assignment",
        date: "2026-09-10",
        name: "Clinic",
        color: "blue",
        reminderOffsetMinutes: 60,
      },
    }), res);

    expect(forwarded).toEqual({
      action: "addAssignment",
      sessionToken: "session-token",
      assignment: {
        kind: "assignment",
        date: "2026-09-10",
        name: "Clinic",
        time: "",
        notes: "",
        color: "blue",
        source: "",
        reminderOffsetMinutes: 60,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.payload.ok).toBe(true);
    expect(res.payload.user).not.toHaveProperty("password");
    expect(res.payload.user.settings).toEqual({ language: "ar" });
  });

  it("preserves password characters without trimming them", async () => {
    const upstream = vi.fn(async (_url, init) => {
      expect(JSON.parse(init.body).password).toBe(" demo password ");
      return new Response(JSON.stringify({
        ok: true,
        user: { username: "demo", employee_id: "1", shift: "A", assignments: [] },
        sessionToken: "token",
      }));
    });
    vi.stubGlobal("fetch", upstream);
    const res = makeResponse();

    await handler(makeRequest({
      action: "login",
      identifier: "demo",
      password: " demo password ",
    }), res);

    expect(res.statusCode).toBe(200);
  });

  it("rejects cross-origin and unsupported requests before networking", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    const crossOrigin = makeResponse();
    await handler(makeRequest(
      { action: "restoreSession", sessionToken: "token" },
      { origin: "https://attacker.example" },
    ), crossOrigin);
    expect(crossOrigin.statusCode).toBe(403);

    const unsupported = makeResponse();
    await handler(makeRequest({ action: "unknown" }), unsupported);
    expect(unsupported.statusCode).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });
});
