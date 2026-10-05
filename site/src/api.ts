import { addDays, canAssign, getClinicLabel, toDateKey, todayLocal, type Entry, type Shift, type User } from "./core";
import { matchAssignmentTeam, normalizeContactPhone, validContactPhone, type AssignmentTeam } from "./assignment-team";

export type ApiMode = "production" | "mock";

/** Action names intentionally match the existing Apps Script contract. */
export const API_ACTIONS = {
  login: "login",
  register: "register",
  adminLogin: "adminLogin",
  restoreSession: "restoreSession",
  logout: "logout",
  adminListUsers: "adminListUsers",
  updateProfile: "updateProfile",
  addAssignment: "addAssignment",
  updateAssignment: "updateAssignment",
  bulkUpsertAssignments: "bulkUpsertAssignments",
  deleteAssignment: "deleteAssignment",
  clearAssignments: "clearAssignments",
  getAssignmentTeam: "getAssignmentTeam",
} as const;

export type ApiAction = (typeof API_ACTIONS)[keyof typeof API_ACTIONS];

/** The deliberately small envelope shared with `/api/action`. */
export interface ApiEnvelope {
  ok: boolean;
  error?: string;
  user?: User;
  users?: User[];
  admin?: boolean;
  sessionToken?: string;
  team?: AssignmentTeam;
}

export interface LoginInput {
  identifier: string;
  password: string;
}

export interface RegisterInput {
  username: string;
  password: string;
  employeeId: string;
  shift: Shift;
}

export interface AdminLoginInput {
  password: string;
}

/**
 * Legacy accepts partial assignment objects and normalizes omitted presentation
 * fields on the server. Keeping the same shape makes migration lossless.
 */
export type AssignmentInput = Pick<Entry, "kind" | "date"> &
  Partial<Omit<Entry, "kind" | "date">>;

export interface ProfileChanges {
  username?: string;
  password?: string;
  employeeId?: string;
  employee_id?: string;
  shift?: Shift;
  settings?: User["settings"];
}

export interface DeleteAssignmentInput {
  entryId: string;
  kind: Entry["kind"];
  date: string;
}

export interface UserSession {
  user: User;
  admin: false;
  sessionToken: string;
}

export interface AdminSession {
  admin: true;
  sessionToken: string;
  user?: never;
}

export type ApiSession = UserSession | AdminSession;

export interface ApiClient {
  login(input: LoginInput): Promise<UserSession>;
  register(input: RegisterInput): Promise<UserSession>;
  adminLogin(input: AdminLoginInput): Promise<AdminSession>;
  restoreSession(sessionToken: string): Promise<ApiSession>;
  logout(sessionToken: string): Promise<void>;
  adminListUsers(sessionToken: string, query?: string): Promise<User[]>;
  updateProfile(
    sessionToken: string,
    changes: ProfileChanges,
  ): Promise<User>;
  addAssignment(
    sessionToken: string,
    assignment: AssignmentInput,
  ): Promise<User>;
  updateAssignment(
    sessionToken: string,
    entryId: string,
    assignment: AssignmentInput,
  ): Promise<User>;
  bulkUpsertAssignments(
    sessionToken: string,
    assignments: AssignmentInput[],
  ): Promise<User>;
  deleteAssignment(
    sessionToken: string,
    input: DeleteAssignmentInput,
  ): Promise<User>;
  clearAssignments(sessionToken: string): Promise<User>;
  getAssignmentTeam(sessionToken: string, entryId: string): Promise<AssignmentTeam>;
}

export interface ApiClientOptions {
  /** Covers the server's 18-second upstream budget plus response delivery. */
  timeoutMs?: number;
  /** Dependency injection for tests. Mock mode intentionally ignores this. */
  fetch?: typeof globalThis.fetch;
}

export class ApiError extends Error {
  readonly code: string;
  readonly status?: number;
  readonly cause?: unknown;

  constructor(
    message: string,
    code = "API_ERROR",
    status?: number,
    cause?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.cause = cause;
  }
}

interface MockCredential {
  readonly username: string;
  readonly password: string;
  readonly shift: Shift;
  readonly admin: boolean;
}

/** Public, synthetic credentials for local previews only. */
export const MOCK_ACCOUNT_CREDENTIALS: readonly MockCredential[] = Object.freeze([
  Object.freeze({ username: "demo-a", password: "demo", shift: "A", admin: false }),
  Object.freeze({ username: "demo-b", password: "demo", shift: "B", admin: false }),
  Object.freeze({ username: "demo-c", password: "demo", shift: "C", admin: false }),
  Object.freeze({ username: "demo-m", password: "demo", shift: "M", admin: false }),
  Object.freeze({
    username: "demo-admin",
    password: "demo",
    shift: "A",
    admin: true,
  }),
]);

const API_ENDPOINT = "/api/action";
const DEFAULT_TIMEOUT_MS = 20_000;
const VALID_SHIFTS: readonly Shift[] = ["A", "B", "C", "M"];

type JsonRecord = Record<string, unknown>;
type ActionTransport = (
  action: ApiAction,
  payload: JsonRecord,
) => Promise<ApiEnvelope>;

interface MockAccount {
  password: string;
  admin: boolean;
  user: User;
}

function cloneEntry(entry: Entry): Entry {
  return { ...entry };
}

function cloneUser(user: User): User {
  const settings =
    typeof structuredClone === "function"
      ? structuredClone(user.settings)
      : JSON.parse(JSON.stringify(user.settings)) as User["settings"];
  return {
    ...user,
    assignments: user.assignments.map(cloneEntry),
    settings,
  };
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ApiError(`${field} is required`, "VALIDATION_ERROR", 400);
  }
  return value.trim();
}

function requiredPassword(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new ApiError("password is required", "VALIDATION_ERROR", 400);
  }
  return value;
}

function requiredSessionToken(payload: JsonRecord): string {
  return requiredString(payload.sessionToken, "sessionToken");
}

function readShift(value: unknown): Shift {
  if (!VALID_SHIFTS.includes(value as Shift)) {
    throw new ApiError("Invalid shift", "VALIDATION_ERROR", 400);
  }
  return value as Shift;
}

function requireUser(envelope: ApiEnvelope, action: ApiAction): User {
  if (!envelope.user) {
    throw new ApiError(
      `The ${action} response did not include a user`,
      "INVALID_RESPONSE",
    );
  }
  return envelope.user;
}

function requireSessionToken(
  envelope: ApiEnvelope,
  action: ApiAction,
  fallback?: string,
): string {
  const sessionToken = envelope.sessionToken || fallback;
  if (!sessionToken) {
    throw new ApiError(
      `The ${action} response did not include a session token`,
      "INVALID_RESPONSE",
    );
  }
  return sessionToken;
}

function requireUserSession(
  envelope: ApiEnvelope,
  action: ApiAction,
): UserSession {
  return {
    user: requireUser(envelope, action),
    admin: false,
    sessionToken: requireSessionToken(envelope, action),
  };
}

function requireAdminSession(
  envelope: ApiEnvelope,
  action: ApiAction,
): AdminSession {
  if (envelope.admin !== true) {
    throw new ApiError(
      `The ${action} response did not include an admin session`,
      "INVALID_RESPONSE",
    );
  }
  return {
    admin: true,
    sessionToken: requireSessionToken(envelope, action),
  };
}

function requireRestoredSession(
  envelope: ApiEnvelope,
  action: ApiAction,
  sessionToken: string,
): ApiSession {
  if (envelope.admin === true) {
    return {
      admin: true,
      sessionToken: requireSessionToken(envelope, action, sessionToken),
    };
  }
  return {
    user: requireUser(envelope, action),
    admin: false,
    sessionToken: requireSessionToken(envelope, action, sessionToken),
  };
}

function requireUsers(envelope: ApiEnvelope, action: ApiAction): User[] {
  if (!Array.isArray(envelope.users)) {
    throw new ApiError(
      `The ${action} response did not include users`,
      "INVALID_RESPONSE",
    );
  }
  return envelope.users;
}

function createClient(transport: ActionTransport): ApiClient {
  return {
    async login(input) {
      const result = await transport(API_ACTIONS.login, {
        identifier: input.identifier,
        password: input.password,
      });
      return requireUserSession(result, API_ACTIONS.login);
    },

    async register(input) {
      const result = await transport(API_ACTIONS.register, {
        username: input.username,
        password: input.password,
        employeeId: input.employeeId,
        shift: input.shift,
      });
      return requireUserSession(result, API_ACTIONS.register);
    },

    async adminLogin(input) {
      const result = await transport(API_ACTIONS.adminLogin, {
        password: input.password,
      });
      return requireAdminSession(result, API_ACTIONS.adminLogin);
    },

    async restoreSession(sessionToken) {
      const result = await transport(API_ACTIONS.restoreSession, {
        sessionToken,
      });
      return requireRestoredSession(
        result,
        API_ACTIONS.restoreSession,
        sessionToken,
      );
    },

    async logout(sessionToken) {
      await transport(API_ACTIONS.logout, { sessionToken });
    },

    async adminListUsers(sessionToken, query = "") {
      const result = await transport(API_ACTIONS.adminListUsers, {
        sessionToken,
        query,
      });
      return requireUsers(result, API_ACTIONS.adminListUsers);
    },

    async updateProfile(sessionToken, changes) {
      const result = await transport(API_ACTIONS.updateProfile, {
        sessionToken,
        changes,
      });
      return requireUser(result, API_ACTIONS.updateProfile);
    },

    async addAssignment(sessionToken, assignment) {
      const result = await transport(API_ACTIONS.addAssignment, {
        sessionToken,
        assignment,
      });
      return requireUser(result, API_ACTIONS.addAssignment);
    },

    async updateAssignment(sessionToken, entryId, assignment) {
      const result = await transport(API_ACTIONS.updateAssignment, {
        sessionToken,
        entryId,
        assignment,
      });
      return requireUser(result, API_ACTIONS.updateAssignment);
    },

    async bulkUpsertAssignments(sessionToken, assignments) {
      const result = await transport(API_ACTIONS.bulkUpsertAssignments, {
        sessionToken,
        assignments,
      });
      return requireUser(result, API_ACTIONS.bulkUpsertAssignments);
    },

    async deleteAssignment(sessionToken, input) {
      const result = await transport(API_ACTIONS.deleteAssignment, {
        sessionToken,
        entryId: input.entryId,
        kind: input.kind,
        date: input.date,
      });
      return requireUser(result, API_ACTIONS.deleteAssignment);
    },

    async clearAssignments(sessionToken) {
      const result = await transport(API_ACTIONS.clearAssignments, {
        sessionToken,
      });
      return requireUser(result, API_ACTIONS.clearAssignments);
    },

    async getAssignmentTeam(sessionToken, entryId) {
      const result = await transport(API_ACTIONS.getAssignmentTeam, { sessionToken, entryId });
      if (!result.team || result.team.capacity !== 3 || !Array.isArray(result.team.members) || result.team.members.length > 3) {
        throw new ApiError("TEAM_INVALID_RESPONSE", "INVALID_RESPONSE");
      }
      return { capacity: 3, members: result.team.members.map((member) => ({
        userId: String(member.userId ?? ""), name: String(member.name ?? ""),
        employeeId: String(member.employeeId ?? ""), phone: normalizeContactPhone(member.phone),
      })) };
    },
  };
}

function createProductionTransport(options: ApiClientOptions): ActionTransport {
  const pending = new Map<string, Promise<ApiEnvelope>>();
  const coalescedActions = new Set<ApiAction>([
    API_ACTIONS.login, API_ACTIONS.adminLogin, API_ACTIONS.restoreSession,
    API_ACTIONS.adminListUsers, API_ACTIONS.getAssignmentTeam,
  ]);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new ApiError("timeoutMs must be greater than zero", "CONFIG_ERROR");
  }

  const fetchImplementation = options.fetch ?? globalThis.fetch?.bind(globalThis);
  if (!fetchImplementation) {
    throw new ApiError("Fetch is unavailable", "CONFIG_ERROR");
  }

  const perform: ActionTransport = async (action, payload) => {
    const controller = new AbortController();
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;

    const timeout = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        timedOut = true;
        controller.abort();
        reject(new ApiError("The request timed out", "TIMEOUT"));
      }, timeoutMs);
    });

    const request = async (): Promise<ApiEnvelope> => {
      const response = await fetchImplementation(API_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action, ...payload }),
        signal: controller.signal,
      });

      let decoded: unknown;
      try {
        decoded = await response.json();
      } catch (error) {
        throw new ApiError(
          "The server returned an invalid response",
          "INVALID_RESPONSE",
          response.status,
          error,
        );
      }

      if (!isRecord(decoded) || typeof decoded.ok !== "boolean") {
        throw new ApiError(
          "The server returned an invalid response",
          "INVALID_RESPONSE",
          response.status,
        );
      }

      const envelope = decoded as unknown as ApiEnvelope;
      if (!response.ok || !envelope.ok) {
        throw new ApiError(
          typeof envelope.error === "string" && envelope.error
            ? envelope.error
            : "The request could not be completed",
          response.status === 401 && action === API_ACTIONS.login ? "INVALID_CREDENTIALS"
            : response.status === 504 ? "TIMEOUT"
            : response.status >= 500 ? "SERVICE_UNAVAILABLE" : "API_ERROR",
          response.status,
        );
      }
      return envelope;
    };

    try {
      return await Promise.race([request(), timeout]);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (timedOut || (error instanceof Error && error.name === "AbortError")) {
        throw new ApiError("The request timed out", "TIMEOUT", undefined, error);
      }
      throw new ApiError(
        "Unable to reach the server",
        "NETWORK_ERROR",
        undefined,
        error,
      );
    } finally {
      if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
    }
  };

  return async (action, payload) => {
    if (!coalescedActions.has(action)) return perform(action, payload);
    const key = JSON.stringify({ action, ...payload });
    const existing = pending.get(key);
    if (existing) return existing;
    const request = perform(action, payload);
    pending.set(key, request);
    try { return await request; }
    finally { if (pending.get(key) === request) pending.delete(key); }
  };
}

function makeDemoEntry(username: string, shift: Shift): Entry {
  let date = todayLocal();
  while (!canAssign(date, "A") || !canAssign(date, "B")) date = addDays(date, 1);
  return {
    id: `sample-${username}`,
    kind: "assignment",
    date: toDateKey(date),
    name: getClinicLabel("science", "ar"),
    time: shift === "C" ? "N" : "A",
    notes: "Sample data only",
    color: "",
    source: "mock",
    reminderOffsetMinutes: 60,
  };
}

function createMockAccounts(): Map<string, MockAccount> {
  return new Map(
    MOCK_ACCOUNT_CREDENTIALS.map((credentials, index) => {
      const assignments = credentials.admin
        ? []
        : [makeDemoEntry(credentials.username, credentials.shift)];
      const user: User = {
        id: `mock-user-${index + 1}`,
        type: "user",
        username: credentials.username,
        employee_id: `DEMO-${String(index + 1).padStart(3, "0")}`,
        shift: credentials.shift,
        assignments,
        settings: { language: "ar", contactName: ["أحمد التجريبي", "خالد التجريبي", "ناصر التجريبي", "عبدالله التجريبي"][index] || credentials.username, phone: `0000000${index + 1}` },
        assignmentCount: assignments.length,
        guardCount: 0,
      };
      return [
        credentials.username,
        {
          password: credentials.password,
          admin: credentials.admin,
          user,
        },
      ];
    }),
  );
}

function readAssignment(value: unknown): AssignmentInput {
  if (!isRecord(value)) {
    throw new ApiError("assignment is required", "VALIDATION_ERROR", 400);
  }
  return value as AssignmentInput;
}

function readAssignments(value: unknown): AssignmentInput[] {
  if (!Array.isArray(value)) {
    throw new ApiError(
      "assignments must be an array",
      "VALIDATION_ERROR",
      400,
    );
  }
  return value.map(readAssignment);
}

function readProfileChanges(value: unknown): ProfileChanges {
  if (!isRecord(value)) {
    throw new ApiError("changes is required", "VALIDATION_ERROR", 400);
  }
  return value as ProfileChanges;
}

function normalizeAssignment(
  assignment: AssignmentInput,
  fallbackId: string,
): Entry {
  const kind = assignment.kind;
  if (kind !== "assignment" && kind !== "guard") {
    throw new ApiError("Invalid assignment kind", "VALIDATION_ERROR", 400);
  }
  const date = requiredString(assignment.date, "assignment.date");
  const parsedDate = new Date(`${date}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(parsedDate.valueOf()) ||
    parsedDate.toISOString().slice(0, 10) !== date
  ) {
    throw new ApiError("Invalid assignment date", "VALIDATION_ERROR", 400);
  }

  const name = typeof assignment.name === "string" ? assignment.name.trim() : "";

  const reminderOffsetMinutes = Number(assignment.reminderOffsetMinutes ?? 0);
  if (!Number.isFinite(reminderOffsetMinutes) || reminderOffsetMinutes < 0) {
    throw new ApiError(
      "Invalid reminder offset",
      "VALIDATION_ERROR",
      400,
    );
  }

  const colorValue =
    typeof assignment.color === "string" ? assignment.color.trim() : "";
  const color = ["", "red", "blue", "yellow", "green", "purple"].includes(
    colorValue,
  )
    ? (colorValue as Entry["color"])
    : "";

  return {
    id:
      typeof assignment.id === "string" && assignment.id.trim()
        ? assignment.id.trim()
        : fallbackId,
    kind,
    date,
    name,
    time: typeof assignment.time === "string" ? assignment.time.trim() : "",
    notes: typeof assignment.notes === "string" ? assignment.notes.trim() : "",
    color,
    source: typeof assignment.source === "string" ? assignment.source.trim() : "",
    reminderOffsetMinutes,
  };
}

function assertAssignmentAllowed(user: User, assignment: Entry): void {
  const day = new Date(`${assignment.date}T00:00:00.000Z`).getUTCDay();
  if (day === 5 || day === 6) {
    throw new ApiError(
      "Cannot add assignments on Friday and Saturday",
      "VALIDATION_ERROR",
      400,
    );
  }
  if (assignment.kind === "guard" && user.shift !== "M") {
    throw new ApiError(
      "Guards are only allowed for M shift",
      "VALIDATION_ERROR",
      400,
    );
  }
}

function withCounts(user: User): void {
  user.assignmentCount = user.assignments.filter(
    (entry) => entry.kind === "assignment",
  ).length;
  user.guardCount = user.assignments.filter((entry) => entry.kind === "guard").length;
}

function createMockTransport(): ActionTransport {
  const accounts = createMockAccounts();
  const sessions = new Map<string, MockAccount>();
  let userSequence = accounts.size;
  let tokenSequence = 0;
  let entrySequence = 0;

  const accountForSession = (sessionToken: string): MockAccount => {
    const account = sessions.get(sessionToken);
    if (!account) {
      throw new ApiError("Session is invalid or expired", "UNAUTHORIZED", 401);
    }
    return account;
  };

  const userAccountForSession = (sessionToken: string): MockAccount => {
    const account = accountForSession(sessionToken);
    if (account.admin) {
      throw new ApiError("A user session is required", "FORBIDDEN", 403);
    }
    return account;
  };

  const newSessionToken = (account: MockAccount): string => {
    const sessionToken = `mock-session-${++tokenSequence}`;
    sessions.set(sessionToken, account);
    return sessionToken;
  };

  const sessionEnvelope = (
    account: MockAccount,
    sessionToken: string,
  ): ApiEnvelope =>
    account.admin
      ? { ok: true, admin: true, sessionToken }
      : {
          ok: true,
          user: cloneUser(account.user),
          admin: false,
          sessionToken,
        };

  const userEnvelope = (account: MockAccount): ApiEnvelope => ({
    ok: true,
    user: cloneUser(account.user),
  });

  const findUserAccount = (identifier: string): MockAccount | undefined => {
    const normalized = identifier.toLowerCase();
    return [...accounts.values()].find(
      (account) =>
        !account.admin &&
        (account.user.username.toLowerCase() === normalized ||
          account.user.employee_id.toLowerCase() === normalized),
    );
  };

  const usernameExists = (username: string, except?: MockAccount): boolean =>
    [...accounts.values()].some(
      (account) =>
        account !== except &&
        account.user.username.toLowerCase() === username.toLowerCase(),
    );

  const employeeIdExists = (employeeId: string, except?: MockAccount): boolean =>
    [...accounts.values()].some(
      (account) =>
        account !== except &&
        account.user.employee_id.toLowerCase() === employeeId.toLowerCase(),
    );

  const nextEntryId = (): string => `mock-entry-${++entrySequence}`;

  return async (action, payload) => {
    switch (action) {
      case API_ACTIONS.login: {
        const identifier = requiredString(payload.identifier, "identifier");
        const password = requiredPassword(payload.password);
        const account = findUserAccount(identifier);
        if (!account || account.password !== password) {
          throw new ApiError("Invalid username or password", "AUTH_FAILED", 401);
        }
        const sessionToken = newSessionToken(account);
        return sessionEnvelope(account, sessionToken);
      }

      case API_ACTIONS.register: {
        const username = requiredString(payload.username, "username");
        const password = requiredPassword(payload.password);
        const employeeId = requiredString(payload.employeeId, "employeeId");
        const shift = readShift(payload.shift);
        if (usernameExists(username)) {
          throw new ApiError("Username already exists", "CONFLICT", 409);
        }
        if (employeeIdExists(employeeId)) {
          throw new ApiError("Employee ID already exists", "CONFLICT", 409);
        }
        const account: MockAccount = {
          password,
          admin: false,
          user: {
            id: `mock-user-${++userSequence}`,
            type: "user",
            username,
            employee_id: employeeId,
            shift,
            assignments: [],
            settings: { language: "ar" },
            assignmentCount: 0,
            guardCount: 0,
          },
        };
        accounts.set(username, account);
        const sessionToken = newSessionToken(account);
        return sessionEnvelope(account, sessionToken);
      }

      case API_ACTIONS.adminLogin: {
        const password = requiredPassword(payload.password);
        const account = [...accounts.values()].find((item) => item.admin);
        if (!account || account.password !== password) {
          throw new ApiError("Invalid administrator password", "AUTH_FAILED", 401);
        }
        const sessionToken = newSessionToken(account);
        return sessionEnvelope(account, sessionToken);
      }

      case API_ACTIONS.restoreSession: {
        const sessionToken = requiredSessionToken(payload);
        return sessionEnvelope(accountForSession(sessionToken), sessionToken);
      }

      case API_ACTIONS.logout: {
        const sessionToken = requiredSessionToken(payload);
        accountForSession(sessionToken);
        sessions.delete(sessionToken);
        return { ok: true };
      }

      case API_ACTIONS.adminListUsers: {
        const account = accountForSession(requiredSessionToken(payload));
        if (!account.admin) {
          throw new ApiError("Administrator access is required", "FORBIDDEN", 403);
        }
        const query =
          typeof payload.query === "string"
            ? payload.query.trim().toLowerCase()
            : "";
        const users = [...accounts.values()]
          .filter((item) => !item.admin)
          .map((item) => item.user)
          .filter((user) =>
            [user.username, user.employee_id, user.shift].some((value) =>
              value.toLowerCase().includes(query),
            ),
          )
          .map(cloneUser);
        return { ok: true, users };
      }

      case API_ACTIONS.getAssignmentTeam: {
        const account = userAccountForSession(requiredSessionToken(payload));
        const entry = account.user.assignments.find((item) => item.id === payload.entryId && item.kind === "assignment");
        if (!entry) throw new ApiError("TEAM_FORBIDDEN", "FORBIDDEN", 403);
        try {
          return { ok: true, team: matchAssignmentTeam(entry, [...accounts.values()].filter((item) => !item.admin).map((item) => item.user)) };
        } catch (error) { throw new ApiError(error instanceof Error ? error.message : "TEAM_ERROR", "TEAM_ERROR", 400); }
      }

      case API_ACTIONS.updateProfile: {
        const account = userAccountForSession(requiredSessionToken(payload));
        const changes = readProfileChanges(payload.changes);

        if (changes.username !== undefined) {
          const username = requiredString(changes.username, "username");
          if (usernameExists(username, account)) {
            throw new ApiError("Username already exists", "CONFLICT", 409);
          }
          accounts.delete(account.user.username);
          account.user.username = username;
          accounts.set(username, account);
        }
        if (changes.password !== undefined) {
          account.password = requiredPassword(changes.password);
        }
        const requestedEmployeeId = changes.employeeId ?? changes.employee_id;
        if (requestedEmployeeId !== undefined) {
          const employeeId = requiredString(requestedEmployeeId, "employeeId");
          if (employeeIdExists(employeeId, account)) {
            throw new ApiError("Employee ID already exists", "CONFLICT", 409);
          }
          account.user.employee_id = employeeId;
        }
        if (changes.shift !== undefined) {
          account.user.shift = readShift(changes.shift);
        }
        if (changes.settings !== undefined) {
          if (!isRecord(changes.settings)) {
            throw new ApiError("Invalid settings", "VALIDATION_ERROR", 400);
          }
          if ("phone" in changes.settings) {
            const phone = normalizeContactPhone(changes.settings.phone);
            if (!validContactPhone(phone)) throw new ApiError("PHONE_INVALID", "VALIDATION_ERROR", 400);
            changes.settings = { ...changes.settings, phone };
          }
          account.user.settings = {
            ...account.user.settings,
            ...changes.settings,
          };
        }
        return userEnvelope(account);
      }

      case API_ACTIONS.addAssignment: {
        const account = userAccountForSession(requiredSessionToken(payload));
        const assignment = normalizeAssignment(
          readAssignment(payload.assignment),
          nextEntryId(),
        );
        assertAssignmentAllowed(account.user, assignment);
        if (
          account.user.assignments.some(
            (item) =>
              item.id === assignment.id ||
              (item.date === assignment.date && item.kind === assignment.kind),
          )
        ) {
          throw new ApiError("Assignment already exists", "CONFLICT", 409);
        }
        account.user.assignments.push(assignment);
        withCounts(account.user);
        return userEnvelope(account);
      }

      case API_ACTIONS.updateAssignment: {
        const account = userAccountForSession(requiredSessionToken(payload));
        const entryId = requiredString(payload.entryId, "entryId");
        const index = account.user.assignments.findIndex((item) => item.id === entryId);
        if (index < 0) {
          throw new ApiError("Assignment was not found", "NOT_FOUND", 404);
        }
        const assignment = normalizeAssignment(
          { ...account.user.assignments[index], ...readAssignment(payload.assignment) },
          entryId,
        );
        assignment.id = entryId;
        assertAssignmentAllowed(account.user, assignment);
        account.user.assignments[index] = assignment;
        withCounts(account.user);
        return userEnvelope(account);
      }

      case API_ACTIONS.bulkUpsertAssignments: {
        const account = userAccountForSession(requiredSessionToken(payload));
        const staged = account.user.assignments.map(cloneEntry);
        for (const input of readAssignments(payload.assignments)) {
          const assignment = normalizeAssignment(input, nextEntryId());
          assertAssignmentAllowed(account.user, assignment);
          const index = staged.findIndex(
            (item) =>
              item.id === assignment.id ||
              (item.date === assignment.date && item.kind === assignment.kind),
          );
          if (index < 0) staged.push(assignment);
          else staged[index] = assignment;
        }
        account.user.assignments = staged;
        withCounts(account.user);
        return userEnvelope(account);
      }

      case API_ACTIONS.deleteAssignment: {
        const account = userAccountForSession(requiredSessionToken(payload));
        const entryId = requiredString(payload.entryId, "entryId");
        const index = account.user.assignments.findIndex(
          (item) => item.id === entryId,
        );
        if (index < 0) {
          throw new ApiError("Assignment was not found", "NOT_FOUND", 404);
        }
        account.user.assignments.splice(index, 1);
        withCounts(account.user);
        return userEnvelope(account);
      }

      case API_ACTIONS.clearAssignments: {
        const account = userAccountForSession(requiredSessionToken(payload));
        account.user.assignments = [];
        withCounts(account.user);
        return userEnvelope(account);
      }
    }
  };
}

/**
 * Creates an isolated client. Every mock client owns fresh in-memory state and
 * never calls fetch, which makes it safe for demos, previews, and tests.
 */
export function createApiClient(
  mode: ApiMode,
  options: ApiClientOptions = {},
): ApiClient {
  return createClient(
    mode === "mock" ? createMockTransport() : createProductionTransport(options),
  );
}
