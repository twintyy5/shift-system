const FALLBACK_UPSTREAM =
  "https://script.google.com/macros/s/AKfycbwCgvV4eakfLdHHBLcUOSOVERT9gU0AJU6Cm6vChzUMZMwokQeG04uQIRUnv2Jx6ij1-Q/exec";

const LOGIN_ACTIONS = new Set(["login", "register", "adminLogin"]);
const READ_ACTIONS = new Set(["restoreSession", "adminListUsers", "getAssignmentTeam"]);
const inFlightReads = new Map();
const UPSTREAM_TIMEOUT_MS = 18_000;

function normalizeIdentifier(value) {
  return text(value, 120)
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, "")
    .trim();
}

class UpstreamError extends Error {
  constructor(code) { super(code); this.code = code; }
}
const SUPPORTED_ACTIONS = new Set([
  "login",
  "register",
  "adminLogin",
  "restoreSession",
  "addAssignment",
  "updateAssignment",
  "deleteAssignment",
  "bulkUpsertAssignments",
  "updateProfile",
  "clearAssignments",
  "adminListUsers",
  "logout",
  "getAssignmentTeam",
]);

const rateBuckets = globalThis.__shiftSystemRateBuckets ?? new Map();
globalThis.__shiftSystemRateBuckets = rateBuckets;

function json(res, status, payload) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  return res.status(status).json(payload);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function text(value, maximum = 500) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function secret(value, maximum = 300) {
  return typeof value === "string" ? value.slice(0, maximum) : "";
}

function sessionToken(body) {
  return text(body.sessionToken, 500);
}

function safeSettings(value) {
  if (!isRecord(value)) return {};
  const settings = {};
  if (typeof value.onboardingCompleted === "boolean") settings.onboardingCompleted = value.onboardingCompleted;
  if (typeof value.contactName === "string") settings.contactName = text(value.contactName, 120);
  if (typeof value.phone === "string") {
    const phone = value.phone.replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
      .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))).replace(/[\s()\-]/g, "");
    if (phone && !/^\+?\d{7,15}$/.test(phone)) throw new Error("PHONE_INVALID");
    settings.phone = phone;
  }
  if (value.language === "ar" || value.language === "en") settings.language = value.language;
  if (value.theme === "light" || value.theme === "dark" || value.theme === "system") {
    settings.theme = value.theme;
  }
  return settings;
}

function safeEntry(value) {
  const item = isRecord(value) ? value : {};
  const kind = item.kind === "guard" ? "guard" : "assignment";
  const date = text(item.date, 10);
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Invalid date");
  const reminder = Number(item.reminderOffsetMinutes || 0);
  return {
    ...(text(item.id, 300) ? { id: text(item.id, 300) } : {}),
    kind,
    date,
    name: text(item.name, 160),
    time: text(item.time, 40),
    notes: text(item.notes, 1500),
    color: text(item.color, 24),
    source: text(item.source, 80),
    reminderOffsetMinutes:
      Number.isFinite(reminder) && reminder >= 0 ? Math.min(reminder, 10080) : 0,
  };
}

function safeUser(value) {
  if (!isRecord(value)) return undefined;
  const assignments = Array.isArray(value.assignments)
    ? value.assignments.slice(0, 5000).map(safeEntry)
    : [];
  const shift = ["A", "B", "C", "M"].includes(String(value.shift))
    ? String(value.shift)
    : "A";
  return {
    id: text(value.id, 160),
    type: "user",
    username: text(value.username, 120),
    employee_id: text(value.employee_id, 120),
    shift,
    assignments,
    settings: safeSettings(value.settings),
    assignmentCount: Number.isFinite(Number(value.assignmentCount))
      ? Number(value.assignmentCount)
      : assignments.filter((entry) => entry.kind === "assignment").length,
    guardCount: Number.isFinite(Number(value.guardCount))
      ? Number(value.guardCount)
      : assignments.filter((entry) => entry.kind === "guard").length,
  };
}

function safeResponse(value) {
  if (!isRecord(value)) return { ok: false, error: "Invalid upstream response" };
  const response = { ok: value.ok === true };
  if (typeof value.error === "string") response.error = value.error.slice(0, 240);
  if (value.admin === true) response.admin = true;
  if (typeof value.sessionToken === "string") {
    response.sessionToken = value.sessionToken.slice(0, 500);
  }
  const user = safeUser(value.user);
  if (user) response.user = user;
  if (Array.isArray(value.users)) {
    response.users = value.users.slice(0, 5000).map(safeUser).filter(Boolean);
  }
  if (isRecord(value.team) && value.team.capacity === 3 && Array.isArray(value.team.members) && value.team.members.length <= 3) {
    response.team = { capacity: 3, members: value.team.members.filter(isRecord).map((member) => ({
      userId: text(member.userId, 160), name: text(member.name, 120),
      employeeId: text(member.employeeId, 120), phone: text(member.phone, 20),
    })) };
  }
  return response;
}

function sameOrigin(req) {
  const origin = text(req.headers.origin, 500);
  if (!origin) return true;
  const host = text(req.headers["x-forwarded-host"] || req.headers.host, 300);
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function clientAddress(req) {
  return text(req.headers["x-forwarded-for"], 200).split(",")[0] || "unknown";
}

function withinRateLimit(req, action, body) {
  const now = Date.now();
  const isLogin = LOGIN_ACTIONS.has(action);
  const windowMs = isLogin ? 15 * 60 * 1000 : 60 * 1000;
  const limit = isLogin ? 12 : 180;
  const loginTarget = action === "adminLogin"
    ? "admin"
    : text(body.identifier || body.username || body.employeeId || body.employee_id, 120).toLowerCase();
  const key = `${clientAddress(req)}:${isLogin ? `auth:${loginTarget || "unknown"}` : "api"}`;
  const previous = rateBuckets.get(key);
  const bucket = !previous || previous.resetAt <= now
    ? { count: 0, resetAt: now + windowMs }
    : previous;
  bucket.count += 1;
  rateBuckets.set(key, bucket);

  if (rateBuckets.size > 2000) {
    for (const [candidate, state] of rateBuckets) {
      if (state.resetAt <= now) rateBuckets.delete(candidate);
    }
  }
  return bucket.count <= limit;
}

async function fetchUpstream(payload, signal) {
  const endpoint = process.env.GOOGLE_APPS_SCRIPT_URL || FALLBACK_UPSTREAM;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
    redirect: "follow",
    signal,
  });
  if (!response.ok) throw new UpstreamError("UPSTREAM_HTTP_ERROR");
  const body = await response.text();
  if (body.length > 5_000_000) throw new Error("Upstream response is too large");
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new UpstreamError("UPSTREAM_INVALID_RESPONSE");
  }
  if (!isRecord(parsed) || typeof parsed.ok !== "boolean") {
    throw new UpstreamError("UPSTREAM_INVALID_RESPONSE");
  }
  return safeResponse(parsed);
}

async function callUpstream(payload, signal) {
  // Only coalesce reads while they are running. Never cache sessions or replay writes.
  if (!READ_ACTIONS.has(payload.action) || inFlightReads.size >= 256) {
    return fetchUpstream(payload, signal);
  }
  const key = JSON.stringify(payload);
  const existing = inFlightReads.get(key);
  if (existing) return existing;
  const request = fetchUpstream(payload, signal);
  inFlightReads.set(key, request);
  try { return await request; }
  finally { if (inFlightReads.get(key) === request) inFlightReads.delete(key); }
}

async function translateAction(body, signal) {
  const upstream = (payload) => callUpstream(payload, signal);
  const action = body.action;
  const token = sessionToken(body);

  switch (action) {
    case "login":
      return upstream({
        action: "login",
        identifier: normalizeIdentifier(body.identifier || body.username),
        password: secret(body.password),
      });
    case "register":
      return upstream({
        action: "register",
        username: text(body.username, 120),
        password: secret(body.password),
        employeeId: normalizeIdentifier(body.employeeId || body.employee_id),
        shift: ["A", "B", "C", "M"].includes(String(body.shift)) ? body.shift : "A",
      });
    case "adminLogin":
      return upstream({ action: "adminLogin", password: secret(body.password) });
    case "restoreSession":
      return upstream({ action: "restoreSession", sessionToken: token });
    case "getAssignmentTeam":
      if (!token || !text(body.entryId, 300)) return { ok: false, error: "TEAM_FORBIDDEN" };
      return upstream({ action: "getAssignmentTeam", sessionToken: token, entryId: text(body.entryId, 300) });
    case "addAssignment":
      return upstream({
        action: "addAssignment",
        sessionToken: token,
        assignment: safeEntry(body.assignment),
      });
    case "updateAssignment": {
      const entryId = text(body.entryId || body.assignment?.id, 300);
      let assignment = safeEntry(body.assignment);
      if (!assignment.date || !assignment.name && assignment.kind !== "guard") {
        const current = await upstream({ action: "restoreSession", sessionToken: token });
        const existing = current.user?.assignments?.find((entry) => entry.id === entryId);
        if (!existing) return { ok: false, error: "Assignment not found" };
        assignment = safeEntry({ ...existing, ...(isRecord(body.assignment) ? body.assignment : {}), id: entryId });
      }
      return upstream({
        action: "updateAssignment",
        sessionToken: token,
        entryId,
        assignment,
      });
    }
    case "deleteAssignment":
      return upstream({
        action: "deleteAssignment",
        sessionToken: token,
        entryId: text(body.entryId, 300),
        date: text(body.date, 10),
        kind: body.kind === "guard" ? "guard" : "assignment",
      });
    case "bulkUpsertAssignments":
      return upstream({
        action: "bulkUpsertAssignments",
        sessionToken: token,
        assignments: Array.isArray(body.assignments)
          ? body.assignments.slice(0, 400).map(safeEntry)
          : [],
      });
    case "updateProfile": {
      const changes = isRecord(body.changes) ? body.changes : {};
      return upstream({
        action: "updateProfile",
        sessionToken: token,
        changes: {
          ...(text(changes.username, 120) ? { username: text(changes.username, 120) } : {}),
          ...(secret(changes.password) ? { password: secret(changes.password) } : {}),
          ...(["A", "B", "C", "M"].includes(String(changes.shift))
            ? { shift: changes.shift }
            : {}),
          ...(isRecord(changes.settings) ? { settings: safeSettings(changes.settings) } : {}),
        },
      });
    }
    case "clearAssignments":
      return upstream({ action: "clearAssignments", sessionToken: token });
    case "adminListUsers":
      return upstream({
        action: "adminListUsers",
        sessionToken: token,
        query: text(body.query, 120),
      });
    case "logout":
      return upstream({ action: "logout", sessionToken: token });
    default:
      return { ok: false, error: "Unsupported action" };
  }
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }
  if (!sameOrigin(req)) return json(res, 403, { ok: false, error: "Origin not allowed" });

  const contentLength = Number(req.headers["content-length"] || 0);
  if (contentLength > 256_000) {
    return json(res, 413, { ok: false, error: "Request is too large" });
  }
  const body = isRecord(req.body)
    ? req.body
    : (() => {
        try {
          return JSON.parse(typeof req.body === "string" ? req.body : "{}");
        } catch {
          return {};
        }
      })();
  if (JSON.stringify(body).length > 256_000) {
    return json(res, 413, { ok: false, error: "Request is too large" });
  }
  const action = text(body.action, 60);
  if (!SUPPORTED_ACTIONS.has(action)) {
    return json(res, 400, { ok: false, error: "Unsupported action" });
  }
  if (!withinRateLimit(req, action, body)) {
    return json(res, 429, { ok: false, error: "Too many requests. Try again later." });
  }

  try {
    // One budget covers the whole action, including legacy two-call updates.
    const result = await translateAction({ ...body, action }, AbortSignal.timeout(UPSTREAM_TIMEOUT_MS));
    const invalidCredentials = !result.ok && action === "login" && /invalid (credentials|username or password)/i.test(result.error || "");
    return json(res, result.ok ? 200 : invalidCredentials ? 401 : 400, result);
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError" || /timeout|aborted/i.test(error.message));
    console.error("[api/action] upstream failure", { action, code: timedOut ? "UPSTREAM_TIMEOUT" : error instanceof UpstreamError ? error.code : "UPSTREAM_UNAVAILABLE" });
    return json(res, timedOut ? 504 : 502, {
      ok: false,
      error: timedOut ? "The data service took too long to respond" : "The data service is unavailable",
    });
  }
}
