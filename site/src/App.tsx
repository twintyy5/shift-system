import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  lazy,
  Suspense,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Banknote,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Clock3,
  Copy,
  Bell,
  BookOpen,
  Download,
  Eye,
  EyeOff,
  FilePlus2,
  Home,
  Languages,
  LayoutGrid,
  List,
  LogOut,
  Moon,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  UserRoundPlus,
  UsersRound,
  X,
} from "lucide-react";
import {
  createApiClient,
  ApiError,
  type ApiClient,
  type ApiSession,
  type AssignmentInput,
  type ProfileChanges,
} from "./api";
import {
  ENTRY_COLORS,
  SHIFTS,
  addDays,
  buildBulkAddPreview,
  buildAvailableDatesText,
  buildIcsFile,
  buildSmartSearchResult,
  calculateTotals,
  canAssign,
  canGuard,
  dateFromKey,
  dayStatus,
  formatMonthLabel,
  getDaysInMonth,
  getEntriesForDate,
  getMonthEntries,
  normalizeEntry,
  toDateKey,
  todayLocal,
  type BulkAddPreview,
  type Entry,
  type EntryColor,
  type EntryKind,
  type Language,
  type MonthCursor,
  type Shift,
  type SmartSearchItem,
  type User,
} from "./core";
import { translate, weekdayNames } from "./i18n";
import { assignmentTimeLabel, reminderLabel } from "./assignment-time";
import { normalizeContactPhone, validContactPhone } from "./assignment-team";
import { copyText } from "./clipboard";
const TeamPanel = lazy(() => import("./TeamPanel"));
const OnboardingTour = lazy(() => import("./OnboardingTour"));

type Page = "home" | "calendar" | "search" | "settings" | "admin";
type Theme = "system" | "light" | "dark";
type AuthView = "login" | "register" | "admin";
type CalendarView = "month" | "agenda";

type DialogState =
  | { kind: "day"; date: string }
  | { kind: "entry"; date: string; entryKind: EntryKind; entry?: Entry }
  | { kind: "bulk" }
  | { kind: "clear" }
  | { kind: "user"; user: User }
  | { kind: "team"; entry: Entry }
  | null;

interface ToastState {
  id: number;
  message: string;
  error?: boolean;
  undo?: () => void;
}

const SESSION_KEY = "shift-system-v2-session";
const LANGUAGE_KEY = "shift-system-v2-language";
const THEME_KEY = "shift-system-v2-theme";
const COLOR_HEX: Record<EntryColor, string> = {
  "": "#94a3b8",
  red: "#ef4444",
  blue: "#3b82f6",
  yellow: "#eab308",
  green: "#10b981",
  purple: "#8b5cf6",
};

function stringValue(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function localLanguage(): Language {
  return localStorage.getItem(LANGUAGE_KEY) === "en" ? "en" : "ar";
}

function localTheme(): Theme {
  const value = localStorage.getItem(THEME_KEY);
  return value === "light" || value === "dark" ? value : "system";
}

function dateLabel(date: string, language: Language, options?: Intl.DateTimeFormatOptions): string {
  const key = JSON.stringify([language, options]);
  let formatter = dateFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(language === "ar" ? "ar-KW" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...options,
    });
    if (dateFormatters.size >= 32) dateFormatters.clear();
    dateFormatters.set(key, formatter);
  }
  return formatter.format(dateFromKey(date));
}

const dateFormatters = new Map<string, Intl.DateTimeFormat>();

function monthCursorFor(date = todayLocal()): MonthCursor {
  return { year: date.getFullYear(), monthIndex: date.getMonth() };
}

function shiftCursor(cursor: MonthCursor, offset: number): MonthCursor {
  const moved = new Date(cursor.year, cursor.monthIndex + offset, 1);
  return { year: moved.getFullYear(), monthIndex: moved.getMonth() };
}

function nextAssignableDate(user: Pick<User, "shift">, start = todayLocal()): string {
  for (let offset = 0; offset < 60; offset += 1) {
    const candidate = toDateKey(addDays(start, offset));
    if (canAssign(candidate, user.shift)) return candidate;
  }
  return toDateKey(start);
}

/**
 * Historical data can contain guards on any account. Guard concepts belong to
 * shift M only, so non-M users receive a presentation-safe view that never
 * leaks guard rows or labels while the stored data remains untouched.
 */
export function visibleEntriesForUser(user: Pick<User, "shift" | "assignments">): Entry[] {
  return user.shift === "M"
    ? user.assignments
    : user.assignments.filter((entry) => entry.kind !== "guard");
}

function clearDataDescription(language: Language, shift: Shift): string {
  if (shift === "M") return translate(language, "clearDataHint");
  return language === "ar"
    ? "سيتم حذف جميع بيانات التقويم المحفوظة لهذا الحساب. لا يمكن التراجع بعد التأكيد."
    : "All calendar data saved for this account will be deleted. This cannot be undone after confirmation.";
}

function iconForPage(page: Page): ReactNode {
  if (page === "home") return <Home size={19} />;
  if (page === "calendar") return <CalendarDays size={19} />;
  if (page === "search") return <Search size={19} />;
  if (page === "settings") return <Settings size={19} />;
  return <UsersRound size={19} />;
}

function Dialog({
  title,
  description,
  wide = false,
  onClose,
  children,
}: {
  title: string;
  description?: string;
  wide?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButton.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const panel = closeButton.current?.closest<HTMLElement>("[role='dialog']");
      const focusable = panel
        ? Array.from(panel.querySelectorAll<HTMLElement>("button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"))
        : [];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", keydown);
    return () => {
      window.removeEventListener("keydown", keydown);
      returnFocus.current?.focus();
    };
  }, [onClose]);

  return (
    <div
      className="dialog-overlay"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        className={`dialog-panel${wide ? " dialog-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        <header className="dialog-header">
          <div className="dialog-heading">
            <h2 id="dialog-title">{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          <button ref={closeButton} className="icon-button" type="button" onClick={onClose} aria-label={translate("ar", "close")}>
            <X size={20} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

function PasswordField({
  id,
  name,
  label,
  required = false,
  autoComplete,
}: {
  id: string;
  name: string;
  label: string;
  required?: boolean;
  autoComplete?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="password-wrap">
        <input
          className="input"
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          required={required}
          autoComplete={autoComplete}
        />
        <button
          className="icon-input-button"
          type="button"
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );
}

function AuthScreen({
  api,
  mode,
  language,
  setLanguage,
  onSession,
}: {
  api: ApiClient;
  mode: "production" | "mock";
  language: Language;
  setLanguage: (language: Language) => void;
  onSession: (session: ApiSession, newlyRegistered?: boolean) => void;
}) {
  const [view, setView] = useState<AuthView>("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const t = (key: string) => translate(language, key);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      if (view === "login") {
        onSession(await api.login({
          identifier: stringValue(data.get("identifier")).trim(),
          password: stringValue(data.get("password")),
        }));
      } else if (view === "register") {
        onSession(await api.register({
          username: stringValue(data.get("username")).trim(),
          password: stringValue(data.get("password")),
          employeeId: stringValue(data.get("employeeId")).trim(),
          shift: stringValue(data.get("shift")) as Shift,
        }), true);
      } else {
        onSession(await api.adminLogin({ password: stringValue(data.get("password")) }));
      }
    } catch (caught) {
      setError(caught instanceof ApiError && ["TIMEOUT", "NETWORK_ERROR", "SERVICE_UNAVAILABLE"].includes(caught.code)
        ? t("connectionError") : errorMessage(caught, t("errorGeneric")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-brand" aria-label={t("appTitle")}>
        <div className="brand-lockup">
          <span className="brand-mark"><CalendarDays size={26} /></span>
          <span>{t("appTitle")}</span>
        </div>
        <div className="auth-brand-copy">
          <p className="eyebrow"><Sparkles size={16} /> V3</p>
          <h1>{t("appTagline")}</h1>
          <p>{language === "ar" ? "واجهة أسرع وأوضح للتقويم، مصممة للتلفون والكمبيوتر وتحافظ على نفس بياناتك." : "A faster, clearer calendar built for phone and desktop while keeping your existing data."}</p>
        </div>
        <p className="auth-brand-footer">{language === "ar" ? "V3 · جولة بسيطة تساعدك تبدأ" : "V3 · A simple tour to help you get started"}</p>
      </section>

      <section className="auth-form-side">
        <div className="auth-card">
          <header className="auth-card-header">
            <p className="eyebrow">{view === "admin" ? t("adminLogin") : t("welcomeBack")}</p>
            <h2>{view === "register" ? t("createAccount") : view === "admin" ? t("admin") : t("login")}</h2>
            <p className="muted">{view === "login" ? t("signInHint") : view === "register" ? t("required") : t("adminPassword")}</p>
          </header>

          <form className="stack" onSubmit={submit}>
            {view === "login" ? (
              <div className="field">
                <label htmlFor="identifier">{t("identifier")}</label>
                <input className="input" id="identifier" name="identifier" required autoComplete="username" defaultValue={mode === "mock" ? "demo-a" : ""} />
              </div>
            ) : null}

            {view === "register" ? (
              <>
                <div className="field">
                  <label htmlFor="username">{t("username")}</label>
                  <input className="input" id="username" name="username" required autoComplete="username" />
                </div>
                <div className="field">
                  <label htmlFor="employeeId">{t("employeeId")}</label>
                  <input className="input" id="employeeId" name="employeeId" required inputMode="numeric" />
                </div>
                <div className="field">
                  <label htmlFor="register-shift">{t("shift")}</label>
                  <select className="select" id="register-shift" name="shift" defaultValue="A">
                    {SHIFTS.map((shift) => <option key={shift} value={shift}>{t(`shift${shift}`)}</option>)}
                  </select>
                </div>
              </>
            ) : null}

            <PasswordField
              id={`${view}-password`}
              name="password"
              label={view === "admin" ? t("adminPassword") : t("password")}
              required
              autoComplete={view === "register" ? "new-password" : "current-password"}
            />

            {error ? <div className="notice-box warning" role="alert">{error}</div> : null}
            <button className="button button-primary button-block" type="submit" disabled={busy}>
              {busy ? <RefreshCw className="loader-icon" size={18} /> : view === "register" ? <UserRoundPlus size={18} /> : view === "admin" ? <ShieldCheck size={18} /> : <ArrowLeft size={18} />}
              {busy ? t("loggingIn") : view === "register" ? t("register") : view === "admin" ? t("adminLogin") : t("login")}
            </button>
          </form>

          <div className="auth-links">
            <button className="text-button" type="button" onClick={() => { setView(view === "register" ? "login" : "register"); setError(""); }}>
              {view === "register" ? t("login") : t("register")}
            </button>
            <a className="text-button" href={`tel:${t("supportPhone")}`}>{t("forgotPassword")}</a>
          </div>
          <div className="auth-divider"><span>{t("support")}</span></div>
          <div className="auth-utility">
            <button className="button button-ghost" type="button" onClick={() => { setView(view === "admin" ? "login" : "admin"); setError(""); }}>
              <ShieldCheck size={17} /> {view === "admin" ? t("login") : t("adminLogin")}
            </button>
            <button className="button button-ghost" type="button" onClick={() => setLanguage(language === "ar" ? "en" : "ar")}>
              <Languages size={17} /> {language === "ar" ? "English" : "العربية"}
            </button>
          </div>
          {mode === "mock" ? (
            <div className="demo-credentials" role="note">
              <strong>{t("mockMode")}</strong>
              <span>{t("mockHint")}</span>
              <code>demo-a / demo</code>
              <code>admin: demo</code>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function MetricCard({ icon, value, label }: { icon: ReactNode; value: ReactNode; label: string }) {
  return (
    <article className="metric-card">
      <span className="metric-icon">{icon}</span>
      <div><strong>{value}</strong><span>{label}</span></div>
    </article>
  );
}

function EntryCard({
  entry,
  language,
  onEdit,
  onDelete,
  onExport,
  onTeam,
}: {
  entry: Entry;
  language: Language;
  onEdit?: () => void;
  onDelete?: () => void;
  onExport?: () => void;
  onTeam?: () => void;
}) {
  const t = (key: string) => translate(language, key);
  return (
    <article className="entry-card">
      <div className="date-tile">
        <strong>{dateFromKey(entry.date).getDate()}</strong>
        <span>{new Intl.DateTimeFormat(language === "ar" ? "ar-KW" : "en", { month: "short" }).format(dateFromKey(entry.date))}</span>
      </div>
      <div className="entry-copy">
        <strong>{entry.name || t(entry.kind)}</strong>
        <span>{dateLabel(entry.date, language)}</span>
        {entry.time ? <span className="entry-period"><Clock3 size={13} />{assignmentTimeLabel(entry.time, language, entry.kind)}</span> : null}
        {entry.notes ? <span>{entry.notes}</span> : null}
      </div>
      <div className="row-actions">
        <span className={`kind-chip ${entry.kind}`}>{t(entry.kind)}</span>
        {onTeam && entry.kind === "assignment" ? <button className="button button-secondary" type="button" onClick={onTeam}><UsersRound size={16} />{language === "ar" ? "المكلفين معاك" : "Colleagues"}</button> : null}
        {onExport ? <button className="icon-button" type="button" onClick={onExport} aria-label={t("exportIcs")}><Download size={17} /></button> : null}
        {onEdit ? <button className="button button-secondary" type="button" onClick={onEdit}>{t("edit")}</button> : null}
        {onDelete ? <button className="icon-button" type="button" onClick={onDelete} aria-label={t("delete")}><Trash2 size={17} /></button> : null}
      </div>
    </article>
  );
}

function CalendarPanel({
  cursor,
  setCursor,
  view,
  setView,
  user,
  language,
  onDay,
  onEdit,
  onDelete,
  onExport,
  onTeam,
}: {
  cursor: MonthCursor;
  setCursor: (cursor: MonthCursor) => void;
  view: CalendarView;
  setView: (view: CalendarView) => void;
  user: User;
  language: Language;
  onDay: (date: string) => void;
  onEdit: (entry: Entry) => void;
  onDelete: (entry: Entry) => void;
  onExport: (entry: Entry) => void;
  onTeam: (entry: Entry) => void;
}) {
  const t = (key: string) => translate(language, key);
  const today = toDateKey(todayLocal());
  const visibleEntries = useMemo(() => visibleEntriesForUser(user), [user]);
  const entriesByDate = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const entry of visibleEntries) {
      const entries = map.get(entry.date);
      if (entries) entries.push(entry);
      else map.set(entry.date, [entry]);
    }
    return map;
  }, [visibleEntries]);
  const monthEntries = useMemo(() => getMonthEntries(visibleEntries, cursor.year, cursor.monthIndex)
    .slice().sort((a, b) => a.date.localeCompare(b.date)), [visibleEntries, cursor.year, cursor.monthIndex]);
  const first = new Date(cursor.year, cursor.monthIndex, 1);
  const gridStart = addDays(first, -first.getDay());
  const dates = Array.from({ length: 42 }, (_, index) => toDateKey(addDays(gridStart, index)));

  return (
    <section className="panel calendar-panel">
      <div className="calendar-toolbar">
        <div className="month-navigation">
          <button className="icon-button" type="button" onClick={() => setCursor(shiftCursor(cursor, -1))} aria-label={t("previousMonth")}>
            {language === "ar" ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
          <h2 className="month-title">{formatMonthLabel(cursor.monthIndex, cursor.year, language)}</h2>
          <button className="icon-button" type="button" onClick={() => setCursor(shiftCursor(cursor, 1))} aria-label={t("nextMonth")}>
            {language === "ar" ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
          </button>
          <button className="button button-ghost" type="button" onClick={() => setCursor(monthCursorFor())}>{t("today")}</button>
        </div>
        <div className="segmented" aria-label={t("calendar")}>
          <button className={view === "month" ? "active" : ""} type="button" aria-pressed={view === "month"} onClick={() => setView("month")}><LayoutGrid size={16} />{t("monthView")}</button>
          <button className={view === "agenda" ? "active" : ""} type="button" aria-pressed={view === "agenda"} onClick={() => setView("agenda")}><List size={16} />{t("agendaView")}</button>
        </div>
      </div>

      {view === "month" ? (
        <>
          <div className="calendar-weekdays">
            {weekdayNames[language].map((name) => <span className="weekday" key={name}>{name}</span>)}
          </div>
          <div className="calendar-grid">
            {dates.map((date) => {
              const status = dayStatus(date, user.shift, entriesByDate.get(date) ?? [], language);
              const currentMonth = dateFromKey(date).getMonth() === cursor.monthIndex;
              const hasAssignment = status.entries.some((entry) => entry.kind === "assignment");
              const hasGuard = user.shift === "M" && status.entries.some((entry) => entry.kind === "guard");
              const coloredEntry = status.entries.slice().reverse().find((entry) => entry.color !== "") ?? status.entries[0];
              const classes = [
                "day-cell",
                currentMonth ? "" : "other-month",
                date === today ? "current-day" : "",
                hasAssignment ? "has-assignment" : "",
                hasGuard ? "has-guard" : "",
                coloredEntry ? "has-entry-color" : "",
              ].filter(Boolean).join(" ");
              const entryLabels = [hasAssignment ? t("assignment") : "", hasGuard ? t("guard") : ""].filter(Boolean);
              return (
                <button
                  className={classes}
                  data-tour={date === today ? "calendar" : undefined}
                  key={date}
                  type="button"
                  onClick={() => onDay(date)}
                  aria-label={`${dateLabel(date, language, { weekday: "long" })}، ${t(status.shiftStatus)}${entryLabels.length ? `، ${entryLabels.join("، ")}` : ""}`}
                  style={coloredEntry ? { "--entry-color": COLOR_HEX[coloredEntry.color] } as CSSProperties : undefined}
                >
                  <span className="day-number">{dateFromKey(date).getDate()}</span>
                  <span className="day-labels">
                    <span className={`day-status shift-${status.shiftStatus}`}>{t(status.shiftStatus)}</span>
                    {hasAssignment ? <span className="day-status entry-assignment">{t("assignment")}</span> : null}
                    {hasGuard ? <span className="day-status entry-guard">{t("guard")}</span> : null}
                  </span>
                  <span className="day-markers" aria-hidden="true">
                    {hasAssignment ? <span className="day-marker assignment" /> : null}
                    {hasGuard ? <span className="day-marker guard" /> : null}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="legend">
            <span className="legend-item"><span className="day-marker assignment" />{t("assignment")}</span>
            {user.shift === "M" ? <span className="legend-item"><span className="day-marker guard" />{t("guard")}</span> : null}
            <span className="legend-item"><span className="status-dot" />{t("duty")}</span>
          </div>
        </>
      ) : monthEntries.length ? (
        <div className="agenda-list">
          {monthEntries.map((entry) => (
            <EntryCard key={entry.id} entry={entry} language={language} onEdit={() => onEdit(entry)} onDelete={() => onDelete(entry)} onExport={() => onExport(entry)} onTeam={() => onTeam(entry)} />
          ))}
        </div>
      ) : (
        <div className="empty-state"><span className="empty-state-icon"><CalendarDays /></span><p>{t("noItems")}</p></div>
      )}
    </section>
  );
}

function DayDialog({
  date,
  user,
  language,
  onClose,
  onAdd,
  onEdit,
  onDelete,
  onExport,
  onTeam,
}: {
  date: string;
  user: User;
  language: Language;
  onClose: () => void;
  onAdd: (kind: EntryKind) => void;
  onEdit: (entry: Entry) => void;
  onDelete: (entry: Entry) => void;
  onExport: (entry: Entry) => void;
  onTeam: (entry: Entry) => void;
}) {
  const t = (key: string) => translate(language, key);
  const status = dayStatus(date, user.shift, visibleEntriesForUser(user), language);
  return (
    <Dialog title={t("dayDetails")} description={`${dateLabel(date, language)} · ${status.label}`} onClose={onClose}>
      <div className="entry-list">
        {status.entries.length ? status.entries.map((entry) => (
          <EntryCard key={entry.id} entry={entry} language={language} onEdit={() => onEdit(entry)} onDelete={() => onDelete(entry)} onExport={() => onExport(entry)} onTeam={() => onTeam(entry)} />
        )) : <div className="empty-state"><span className="empty-state-icon"><CalendarDays /></span><p>{t("noItems")}</p></div>}
      </div>
      <div className="dialog-actions">
        {canAssign(date, user.shift) ? <button className="button button-primary" type="button" onClick={() => onAdd("assignment")}><Plus size={17} />{t("addAssignment")}</button> : null}
        {canGuard(date, user.shift) ? <button className="button button-secondary" type="button" onClick={() => onAdd("guard")}><Plus size={17} />{t("addGuard")}</button> : null}
        {!canAssign(date, user.shift) && !canGuard(date, user.shift) ? <div className="notice-box">{t("notAllowed")}</div> : null}
      </div>
    </Dialog>
  );
}

function EntryDialog({
  date,
  entry,
  entryKind,
  user,
  language,
  busy,
  onClose,
  onSave,
}: {
  date: string;
  entry?: Entry;
  entryKind: EntryKind;
  user: User;
  language: Language;
  busy: boolean;
  onClose: () => void;
  onSave: (assignment: AssignmentInput) => Promise<void>;
}) {
  const t = (key: string) => translate(language, key);
  const initialTime = !entry ? "A" : entry.time === "A" || entry.time === "N" ? entry.time : "other";
  const [namePreset, setNamePreset] = useState(entry ? "other" : "boulevard");
  const [timePreset, setTimePreset] = useState(initialTime);
  const [selectedDate, setSelectedDate] = useState(entry?.date ?? date);
  const [customTime, setCustomTime] = useState(entry?.time ?? "14:00");
  const [reminder, setReminder] = useState(entry?.reminderOffsetMinutes ?? 60);
  const reminderTime = reminderLabel(selectedDate, timePreset === "other" ? customTime : timePreset, reminder, language, entry?.kind ?? entryKind);
  const [color, setColor] = useState<EntryColor>(entry?.color ?? "");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const nextDate = stringValue(data.get("date"));
    const kind = entry?.kind ?? entryKind;
    const name = kind === "guard"
      ? t("guard")
      : namePreset === "other"
        ? stringValue(data.get("nameCustom")).trim()
        : t(`clinic${namePreset[0].toUpperCase()}${namePreset.slice(1)}`);
    const time = timePreset === "other" ? stringValue(data.get("timeCustom")).trim() : timePreset;
    if (!name || !time) {
      setError(t("required"));
      return;
    }
    if ((!entry || entry.date !== nextDate) && kind === "assignment" && !canAssign(nextDate, user.shift)) {
      setError(t("notAllowed"));
      return;
    }
    if ((!entry || entry.date !== nextDate) && kind === "guard" && !canGuard(nextDate, user.shift)) {
      setError(t("guardOnlyM"));
      return;
    }
    const duplicate = user.assignments.some((item) => item.id !== entry?.id && item.date === nextDate && item.kind === kind);
    if (duplicate) {
      setError(t("duplicate"));
      return;
    }
    setError("");
    await onSave({
      ...(entry ? { id: entry.id } : {}),
      kind,
      date: nextDate,
      name,
      time,
      notes: stringValue(data.get("notes")).trim(),
      color,
      source: entry?.source ?? "",
      reminderOffsetMinutes: Number(stringValue(data.get("reminderOffsetMinutes"))) || 0,
    });
  }

  return (
    <Dialog title={entry ? t("edit") : entryKind === "guard" ? t("addGuard") : t("addAssignment")} description={dateLabel(date, language)} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="entry-date">{t("date")}</label>
            <input className="input" id="entry-date" name="date" type="date" required value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
          </div>
          {entryKind === "assignment" ? (
            <div className="field">
              <label htmlFor="entry-name-preset">{t("itemName")}</label>
              <select className="select" id="entry-name-preset" value={namePreset} onChange={(event) => setNamePreset(event.target.value)}>
                {(["boulevard", "science", "marina", "promenade", "courts"] as const).map((clinic) => (
                  <option key={clinic} value={clinic}>{t(`clinic${clinic[0].toUpperCase()}${clinic.slice(1)}`)}</option>
                ))}
                <option value="other">{t("other")}</option>
              </select>
            </div>
          ) : null}
          {entryKind === "assignment" && namePreset === "other" ? (
            <div className="field field-full">
              <label htmlFor="entry-name">{t("itemName")}</label>
              <input className="input" id="entry-name" name="nameCustom" required defaultValue={entry?.name ?? ""} />
            </div>
          ) : null}
          <div className="field">
            <label htmlFor="entry-time">{t("itemTime")}</label>
            <select className="select" id="entry-time" value={timePreset} onChange={(event) => setTimePreset(event.target.value)}>
              <option value="A">{assignmentTimeLabel("A", language, entry?.kind ?? entryKind)}</option>
              <option value="N">{assignmentTimeLabel("N", language, entry?.kind ?? entryKind)}</option>
              <option value="other">{t("other")}</option>
            </select>
          </div>
          {timePreset === "other" ? (
            <div className="field">
              <label htmlFor="entry-custom-time">{t("itemTime")}</label>
              <input className="input" id="entry-custom-time" name="timeCustom" type="time" required value={customTime} onChange={(event) => setCustomTime(event.target.value)} />
            </div>
          ) : null}
          <div className="field">
            <label htmlFor="entry-reminder">{t("reminder")}</label>
            <select className="select" id="entry-reminder" name="reminderOffsetMinutes" value={String(reminder)} onChange={(event) => setReminder(Number(event.target.value))}>
              <option value="0">{t("noReminder")}</option>
              <option value="60">{t("oneHour")}</option>
              <option value="720">{t("twelveHours")}</option>
              <option value="1440">{t("oneDay")}</option>
            </select>
          </div>
          {reminderTime ? <div className="reminder-preview field-full"><Bell size={19} /><div><strong>{language === "ar" ? `التذكير الساعة ${reminderTime}` : `Reminder at ${reminderTime}`}</strong><span>{language === "ar" ? "فعّله بإضافة التكليف لتقويم جهازك بعد الحفظ" : "Activate it by adding the saved assignment to your device calendar"}</span></div></div> : null}
          <div className="field field-full">
            <label htmlFor="entry-notes">{t("notes")}</label>
            <textarea className="textarea" id="entry-notes" name="notes" defaultValue={entry?.notes ?? ""} />
          </div>
          <fieldset className="field field-full" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="field-label">{t("selectColor")}</legend>
            <div className="color-options">
              {ENTRY_COLORS.map((option) => (
                <button
                  className={`color-option${color === option ? " active" : ""}`}
                  key={option || "default"}
                  type="button"
                  onClick={() => setColor(option)}
                  style={{ "--option-color": COLOR_HEX[option] } as CSSProperties}
                  aria-label={option || t("other")}
                  aria-pressed={color === option}
                />
              ))}
            </div>
          </fieldset>
        </div>
        {error ? <div className="notice-box warning" role="alert">{error}</div> : null}
        <div className="dialog-actions">
          <button className="button button-ghost" type="button" onClick={onClose}>{t("cancel")}</button>
          <button className="button button-primary" type="submit" disabled={busy}><Check size={17} />{t("save")}</button>
        </div>
      </form>
    </Dialog>
  );
}

function BulkDialog({
  user,
  cursor,
  language,
  busy,
  onClose,
  onSave,
}: {
  user: User;
  cursor: MonthCursor;
  language: Language;
  busy: boolean;
  onClose: () => void;
  onSave: (entries: Entry[]) => Promise<void>;
}) {
  const t = (key: string) => translate(language, key);
  const [preview, setPreview] = useState<BulkAddPreview | null>(null);
  const [error, setError] = useState("");

  function prepare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      setPreview(buildBulkAddPreview({
        datesText: stringValue(data.get("datesText")),
        name: stringValue(data.get("name")),
        time: stringValue(data.get("time")),
        notes: stringValue(data.get("notes")),
        reminderOffsetMinutes: stringValue(data.get("reminderOffsetMinutes")),
      }, { ...cursor, user, language }));
      setError("");
    } catch (caught) {
      setPreview(null);
      setError(errorMessage(caught, t("errorGeneric")));
    }
  }

  return (
    <Dialog title={t("bulkAdd")} description={t("bulkDatesHint")} wide onClose={onClose}>
      <form className="stack" onSubmit={prepare}>
        <div className="form-grid">
          <div className="field field-full">
            <label htmlFor="bulk-dates">{t("bulkDates")}</label>
            <textarea className="textarea" id="bulk-dates" name="datesText" required placeholder="5، 7، 9" />
          </div>
          <div className="field">
            <label htmlFor="bulk-name">{t("itemName")}</label>
            <input className="input" id="bulk-name" name="name" required />
          </div>
          <div className="field">
            <label htmlFor="bulk-time">{t("itemTime")}</label>
            <select className="select" id="bulk-time" name="time" defaultValue="A"><option value="A">{t("morning")}</option><option value="N">{t("night")}</option></select>
          </div>
          <div className="field field-full">
            <label htmlFor="bulk-notes">{t("notes")}</label>
            <textarea className="textarea" id="bulk-notes" name="notes" />
          </div>
          <input type="hidden" name="reminderOffsetMinutes" value="60" />
        </div>
        <div className="dialog-actions"><button className="button button-secondary" type="submit">{t("preparePreview")}</button></div>
      </form>
      {error ? <div className="notice-box warning" role="alert">{error}</div> : null}
      {preview ? (
        <div className="preview-box section-block">
          <strong>{t("preview")}: {preview.items.length}</strong>
          <div className="agenda-list" style={{ marginTop: 12 }}>
            {preview.items.slice(0, 12).map((entry) => <EntryCard key={entry.id} entry={entry} language={language} />)}
          </div>
          {preview.items.length > 12 ? <p className="muted">+{preview.items.length - 12}</p> : null}
          {preview.invalidDates.length || preview.invalidTokens.length ? <div className="notice-box warning">{t("skippedDates")}: {[...preview.invalidDates, ...preview.invalidTokens].join("، ")}</div> : null}
          <div className="dialog-actions">
            <button className="button button-primary" type="button" disabled={busy} onClick={() => onSave(preview.items)}><Check size={17} />{t("saveAll")}</button>
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}

function HomePage({
  user,
  cursor,
  language,
  openCalendar,
  openAdd,
  openBulk,
  openSearch,
  openTeam,
}: {
  user: User;
  cursor: MonthCursor;
  language: Language;
  openCalendar: () => void;
  openAdd: () => void;
  openBulk: () => void;
  openSearch: () => void;
  openTeam: (entry: Entry) => void;
}) {
  const t = (key: string) => translate(language, key);
  const today = toDateKey(todayLocal());
  const visibleEntries = visibleEntriesForUser(user);
  const status = dayStatus(today, user.shift, visibleEntries, language);
  const totals = calculateTotals(visibleEntries, cursor);
  const upcoming = visibleEntries.reduce<Entry | undefined>((next, entry) =>
    entry.date >= today && (!next || entry.date < next.date) ? entry : next, undefined);
  const now = todayLocal();
  return (
    <>
      <section className="dashboard-hero">
        <div className="hero-copy">
          <p className="eyebrow">{t("overview")} · {t(`shift${user.shift}`)}</p>
          <h2>{status.shiftStatus === "duty" ? t("todayDuty") : t("todayOff")}</h2>
          <p>{upcoming ? `${t("nextAssignment")}: ${upcoming.name || t(upcoming.kind)} — ${dateLabel(upcoming.date, language)}` : t("noUpcoming")}</p>
          {upcoming?.kind === "assignment" ? <button className="hero-team-button" type="button" onClick={() => openTeam(upcoming)}><UsersRound size={17} /><span>{language === "ar" ? "المكلفين معاك والرسالة" : "Colleagues and message"}</span>{language === "ar" ? <ArrowLeft size={16} /> : <ArrowRight size={16} />}</button> : null}
        </div>
        <div className="hero-date"><strong>{now.getDate()}</strong><span>{dateLabel(today, language, { weekday: "long", month: "long", year: undefined })}</span></div>
      </section>
      <section className="metric-grid" aria-label={t("overview")}>
        <MetricCard icon={<FilePlus2 size={20} />} value={totals.assignmentCount} label={t("monthAssignments")} />
        {user.shift === "M" ? <MetricCard icon={<ShieldCheck size={20} />} value={totals.guardCount} label={t("monthGuards")} /> : null}
        <MetricCard icon={<Banknote size={20} />} value={`${totals.totalAmount} ${t("kd")}`} label={t("dueAmount")} />
        <MetricCard icon={<Clock3 size={20} />} value={upcoming ? dateFromKey(upcoming.date).getDate() : "—"} label={t("nextAssignment")} />
      </section>
      <section className="section-block">
        <div className="section-heading"><div><h2>{t("quickActions")}</h2><p>{language === "ar" ? "كل شيء مهم بلمسة واحدة" : "Everything important, one tap away"}</p></div></div>
        <div className="quick-grid">
          <button className="action-card" type="button" onClick={openAdd}><span className="action-card-icon"><Plus /></span><strong data-tour="add">{t("addAssignment")}</strong><span>{t("today")}</span></button>
          <button className="action-card" type="button" onClick={openCalendar}><span className="action-card-icon"><CalendarDays /></span><strong>{t("calendar")}</strong><span>{formatMonthLabel(cursor.monthIndex, cursor.year, language)}</span></button>
          <button className="action-card" type="button" onClick={openBulk}><span className="action-card-icon"><FilePlus2 /></span><strong>{t("bulkAdd")}</strong><span>{t("preview")}</span></button>
          <button className="action-card" type="button" onClick={openSearch}><span className="action-card-icon"><Sparkles /></span><strong>{t("smartSearch")}</strong><span>{t("smartSearchHint")}</span></button>
        </div>
      </section>
    </>
  );
}

function SearchPage({ user, cursor, language, onOpenDay }: { user: User; cursor: MonthCursor; language: Language; onOpenDay: (date: string) => void }) {
  const t = (key: string) => translate(language, key);
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyFallback, setCopyFallback] = useState(false);
  const copyArea = useRef<HTMLTextAreaElement>(null);
  const searchableUser = useMemo(() => ({ ...user, assignments: visibleEntriesForUser(user) }), [user]);
  const result = useMemo(() => submittedQuery === null ? null : buildSmartSearchResult(submittedQuery, { ...cursor, user: searchableUser, language }), [submittedQuery, cursor, searchableUser, language]);
  const items: SmartSearchItem[] = result?.kind === "day" ? [result.item] : result?.items ?? [];
  const datesText = result ? buildAvailableDatesText(result, searchableUser) : "";
  useEffect(() => { setCopied(false); setCopyFallback(false); }, [datesText]);
  useEffect(() => { if (copyFallback) { copyArea.current?.focus(); copyArea.current?.select(); } }, [copyFallback]);
  const search = (value: string) => { setQuery(value); setSubmittedQuery(value); setCopied(false); setCopyFallback(false); };
  return (
    <section className="panel search-panel">
      <div className="section-heading"><div><h2>{t("smartSearch")}</h2><p>{t("smartSearchHint")}</p></div><Sparkles /></div>
      <form className="search-form" onSubmit={(event) => { event.preventDefault(); search(query); }}>
        <label className="sr-only" htmlFor="smart-search">{t("smartSearch")}</label>
        <input className="input" id="smart-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("smartSearchHint")} />
        <button className="button button-primary" type="submit"><Search size={17} />{t("runSearch")}</button>
      </form>
      <div className="search-shortcuts"><button className="button button-secondary" data-tour="search" type="button" onClick={() => search(language === "ar" ? "أيام الراحة" : "available days")}>{language === "ar" ? "أيام الراحة" : "Available dates"}</button><button className="button button-ghost" type="button" onClick={() => search(language === "ar" ? "تكاليفي هذا الشهر" : "assignments this month")}>{language === "ar" ? "تكاليف هالشهر" : "This month's assignments"}</button></div>
      {datesText ? <div className="copy-dates-bar"><div><strong>{language === "ar" ? "تواريخ جاهزة للنسخ" : "Dates ready to copy"}</strong><span>{formatMonthLabel(cursor.monthIndex, cursor.year, language)} · {items.length} {language === "ar" ? "يوم متاح" : "available days"}</span></div><button className="button button-primary" type="button" onClick={async () => { const success = await copyText(datesText); setCopied(success); setCopyFallback(!success); }}>{copied ? <Check size={17} /> : <Copy size={17} />}{copied ? language === "ar" ? "تم النسخ" : "Copied" : language === "ar" ? "نسخ التواريخ" : "Copy dates"}</button></div> : null}
      <span className="sr-only" role="status">{copied ? language === "ar" ? "تم نسخ التواريخ" : "Dates copied" : ""}</span>
      {copyFallback ? <div className="copy-fallback"><p role="status">{language === "ar" ? "حدّد التواريخ وانسخها يدويًا" : "Select and copy the dates"}</p><textarea ref={copyArea} className="textarea" dir="ltr" readOnly value={datesText} rows={7} aria-label={language === "ar" ? "التواريخ المتاحة للنسخ" : "Available dates to copy"} /></div> : null}
      {result ? <div className="notice-box"><strong>{result.title}</strong><br />{result.description}</div> : null}
      <div className="search-results section-block">
        {items.map((item) => (
          <button className="search-result-button" type="button" key={item.date} onClick={() => onOpenDay(item.date)}>
            <span><strong>{dateLabel(item.date, language)}</strong>{result?.intent !== "free" ? <span className="muted"> · {item.status.label}</span> : null}</span>
            {language === "ar" ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
          </button>
        ))}
        {result?.kind === "empty" ? <div className="empty-state"><span className="empty-state-icon"><Search /></span><p>{result.description}</p></div> : null}
      </div>
    </section>
  );
}

function SettingsPage({
  user,
  language,
  theme,
  busy,
  setTheme,
  changeLanguage,
  updateProfile,
  requestClear,
  replayTour,
}: {
  user: User;
  language: Language;
  theme: Theme;
  busy: boolean;
  setTheme: (theme: Theme) => void;
  changeLanguage: (language: Language) => void;
  updateProfile: (changes: ProfileChanges) => Promise<boolean>;
  requestClear: () => void;
  replayTour: () => void;
}) {
  const t = (key: string) => translate(language, key);
  const clearHint = clearDataDescription(language, user.shift);
  const [contactError, setContactError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const password = stringValue(data.get("password"));
    const phone = normalizeContactPhone(data.get("phone"));
    if (!validContactPhone(phone)) { setContactError(language === "ar" ? "أدخل رقم تلفون صحيح" : "Enter a valid phone number"); return; }
    setContactError("");
    const saved = await updateProfile({
      username: stringValue(data.get("username")).trim(),
      shift: stringValue(data.get("shift")) as Shift,
      settings: { ...user.settings, contactName: stringValue(data.get("contactName")).trim(), phone },
      ...(password ? { password } : {}),
    });
    if (saved) { const field = form.elements.namedItem("password"); if (field instanceof HTMLInputElement) field.value = ""; }
  }
  return (
    <div className="settings-grid">
      <section className="panel settings-card">
        <h2>{t("appearance")}</h2><p>{t("language")} · {t("theme")}</p>
        <div className="field">
          <label htmlFor="language">{t("language")}</label>
          <select className="select" id="language" value={language} onChange={(event) => changeLanguage(event.target.value as Language)}><option value="ar">العربية</option><option value="en">English</option></select>
        </div>
        <div className="theme-grid section-block">
          {(["system", "light", "dark"] as const).map((option) => (
            <button className={`theme-option${theme === option ? " active" : ""}`} type="button" key={option} onClick={() => setTheme(option)} aria-pressed={theme === option}>
              {option === "dark" ? <Moon size={19} /> : option === "light" ? <Sun size={19} /> : <Settings size={19} />}
              {t(option === "system" ? "themeSystem" : option === "light" ? "themeLight" : "themeDark")}
            </button>
          ))}
        </div>
      </section>
      <section className="panel settings-card">
        <h2>{t("profile")}</h2><p>{user.employee_id} · {t(`shift${user.shift}`)}</p>
        <form className="stack" onSubmit={submit}>
          <div className="field"><label htmlFor="profile-username">{t("username")}</label><input className="input" id="profile-username" name="username" required defaultValue={user.username} /></div>
          <div className="field"><label htmlFor="profile-contact-name">{language === "ar" ? "اسمك في رسالة التكليف" : "Name in the assignment message"}</label><input className="input" id="profile-contact-name" name="contactName" autoComplete="name" maxLength={120} defaultValue={user.settings.contactName || user.username} /></div>
          <div className="field"><label htmlFor="profile-phone">{language === "ar" ? "رقم التلفون" : "Phone number"}</label><input className="input" data-tour="team" id="profile-phone" name="phone" type="tel" inputMode="tel" dir="ltr" autoComplete="tel" maxLength={20} defaultValue={user.settings.phone || ""} /><span className="field-hint">{language === "ar" ? "يظهر للمكلفين معاك بنفس العيادة والتاريخ والفترة" : "Visible to colleagues in the same clinic, date and period"}</span></div>
          <div className="profile-employee-id">{language === "ar" ? "م.ط.ط" : "Employee ID"}: <bdi>{user.employee_id}</bdi></div>
          <div className="field"><label htmlFor="profile-shift">{t("shift")}</label><select className="select" id="profile-shift" name="shift" defaultValue={user.shift}>{SHIFTS.map((shift) => <option value={shift} key={shift}>{t(`shift${shift}`)}</option>)}</select></div>
          <PasswordField id="profile-password" name="password" label={t("newPassword")} autoComplete="new-password" />
          {contactError ? <p className="notice-box warning" role="alert">{contactError}</p> : null}
          <button className="button button-primary" type="submit" disabled={busy}>{t("save")}</button>
        </form>
      </section>
      <section className="panel settings-card guide-settings-card">
        <span className="guide-settings-icon"><BookOpen size={24} /></span>
        <h2>{language === "ar" ? "شرح الموقع" : "Site guide"}</h2>
        <p>{language === "ar" ? "جولة سريعة بالتقويم، التكاليف، المكلفين معاك والبحث الذكي." : "A quick tour of your calendar, assignments, colleagues and smart search."}</p>
        <button className="button button-secondary" type="button" onClick={replayTour}><BookOpen size={18} />{language === "ar" ? "ابدأ الجولة" : "Start the tour"}</button>
      </section>
      <section className="panel settings-card danger-zone">
        <h2>{t("clearData")}</h2><p>{clearHint}</p>
        <button className="button button-danger" type="button" onClick={requestClear} disabled={busy}><Trash2 size={17} />{t("clearData")}</button>
      </section>
    </div>
  );
}

function AdminPage({
  api,
  sessionToken,
  language,
  onUser,
}: {
  api: ApiClient;
  sessionToken: string;
  language: Language;
  onUser: (user: User) => void;
}) {
  const t = (key: string) => translate(language, key);
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async (search = "") => {
    setBusy(true);
    setError("");
    try {
      setUsers(await api.adminListUsers(sessionToken, search));
    } catch (caught) {
      setError(errorMessage(caught, t("errorGeneric")));
    } finally {
      setBusy(false);
    }
  }, [api, sessionToken, language]);

  useEffect(() => { void load(); }, [load]);
  const assignmentCount = users.reduce((sum, user) => sum + (user.assignmentCount ?? user.assignments.filter((entry) => entry.kind === "assignment").length), 0);
  const guardCount = users.reduce((sum, user) => sum + (user.guardCount ?? user.assignments.filter((entry) => entry.kind === "guard").length), 0);
  return (
    <>
      <div className="admin-summary-grid">
        <MetricCard icon={<UsersRound />} value={users.length} label={t("users")} />
        <MetricCard icon={<FilePlus2 />} value={assignmentCount} label={t("assignmentsCount")} />
        <MetricCard icon={<ShieldCheck />} value={guardCount} label={t("guardsCount")} />
      </div>
      <section className="panel admin-panel">
        <form className="admin-filter" onSubmit={(event) => { event.preventDefault(); void load(query); }}>
          <label className="sr-only" htmlFor="admin-search">{t("userSearch")}</label>
          <input className="input" id="admin-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("userSearch")} />
          <button className="button button-primary" type="submit" disabled={busy}><Search size={17} />{t("search")}</button>
          <button className="button button-secondary" type="button" onClick={() => void load(query)} disabled={busy}><RefreshCw size={17} />{t("refresh")}</button>
        </form>
        {error ? <div className="notice-box warning" role="alert">{error}</div> : null}
        <div className="user-list">
          {users.map((user) => (
            <button className="user-card" type="button" key={user.id || `${user.employee_id}-${user.username}`} onClick={() => onUser(user)}>
              <span className="avatar">{user.username.slice(0, 1).toUpperCase()}</span>
              <span className="profile-copy"><strong>{user.username}</strong><span>{user.employee_id}</span></span>
              <span className="shift-chip">{user.shift}</span>
              <span className="user-stats"><span><strong>{user.assignmentCount ?? 0}</strong> {t("assignmentsCount")}</span><span><strong>{user.guardCount ?? 0}</strong> {t("guardsCount")}</span></span>
            </button>
          ))}
          {!busy && !users.length ? <div className="empty-state"><span className="empty-state-icon"><UsersRound /></span><p>{t("noResults")}</p></div> : null}
        </div>
      </section>
    </>
  );
}

export function App() {
  const mode = useMemo(() => new URLSearchParams(window.location.search).get("demo") === "1" ? "mock" as const : "production" as const, []);
  const api = useMemo(() => createApiClient(mode), [mode]);
  const [language, setLanguageState] = useState<Language>(localLanguage);
  const [theme, setThemeState] = useState<Theme>(localTheme);
  const [session, setSession] = useState<ApiSession | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [page, setPage] = useState<Page>("home");
  const [cursor, setCursor] = useState<MonthCursor>(monthCursorFor);
  const [calendarView, setCalendarView] = useState<CalendarView>("month");
  const [dialog, setDialog] = useState<DialogState>(null);
  const [tourStep, setTourStep] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const toastSequence = useRef(0);
  const t = (key: string) => translate(language, key);
  const user = session && !session.admin ? session.user : null;

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    localStorage.setItem(LANGUAGE_KEY, next);
  }, []);
  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    localStorage.setItem(THEME_KEY, next);
  }, []);
  const closeDialog = useCallback(() => setDialog(null), []);

  const showToast = useCallback((message: string, options: { error?: boolean; undo?: () => void } = {}) => {
    const id = ++toastSequence.current;
    setToasts((current) => [...current, { id, message, ...options }].slice(-3));
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), options.undo ? 8_000 : 4_000);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  }, [language]);

  useEffect(() => {
    if (theme === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const token = sessionStorage.getItem(`${SESSION_KEY}-${mode}`);
    if (!token) {
      setRestoring(false);
      return () => { active = false; };
    }
    api.restoreSession(token).then((restored) => {
      if (!active) return;
      setSession(restored);
      if (!restored.admin && restored.user.settings.language) setLanguage(restored.user.settings.language);
      setPage(restored.admin ? "admin" : "home");
    }).catch((caught) => {
      if (!active) return;
      if (caught instanceof ApiError && caught.status && [400, 401, 403].includes(caught.status)) {
        sessionStorage.removeItem(`${SESSION_KEY}-${mode}`);
      }
    }).finally(() => {
      if (active) setRestoring(false);
    });
    return () => { active = false; };
  }, [api, mode, setLanguage]);

  function showTourStep(step: number) {
    setDialog(null);
    setTourStep(step);
    setPage((["calendar", "home", "settings", "search", "calendar"] as const)[step]);
    if (step === 0 || step === 4) {
      setCursor(monthCursorFor());
      setCalendarView("month");
    }
  }

  const finishTour = useCallback((destination: "calendar" | "settings" = "calendar") => {
    setTourStep(null);
    setPage(destination);
    window.setTimeout(() => document.querySelector<HTMLElement>(destination === "settings"
      ? "#profile-contact-name" : ".page-heading h1")?.focus(), 0);
    if (session && !session.admin && session.user.settings.onboardingCompleted !== true) {
      const token = session.sessionToken;
      // Save only the guide preference; never replace assignments changed while this request is pending.
      void api.updateProfile(token, { settings: { onboardingCompleted: true } }).then((updated) => {
        if (updated.settings.onboardingCompleted !== true) throw new Error("Guide preference not saved");
        setSession((current) => current && !current.admin && current.sessionToken === token
          ? { ...current, user: { ...current.user, settings: { ...current.user.settings, onboardingCompleted: true } } }
          : current);
      }).catch(() => showToast(language === "ar"
        ? "تعذر حفظ إنهاء الجولة. تقدر ترجع لها من الإعدادات."
        : "Could not save the tour preference. You can reopen it in Settings.", { error: true }));
    }
  }, [api, session, language, showToast]);

  function acceptSession(next: ApiSession, newlyRegistered = false) {
    setSession(next);
    sessionStorage.setItem(`${SESSION_KEY}-${mode}`, next.sessionToken);
    setPage(next.admin ? "admin" : "home");
    if (!next.admin && next.user.settings.language) setLanguage(next.user.settings.language);
    if (newlyRegistered && !next.admin && next.user.settings.onboardingCompleted !== true) showTourStep(0);
  }

  async function logout() {
    const token = session?.sessionToken;
    setSession(null);
    setDialog(null);
    setTourStep(null);
    setPage("home");
    sessionStorage.removeItem(`${SESSION_KEY}-${mode}`);
    if (token) {
      try { await api.logout(token); } catch { /* Local logout is still complete. */ }
    }
  }

  async function applyUserMutation(operation: () => Promise<User>, success: string): Promise<boolean> {
    setBusy(true);
    try {
      const updated = await operation();
      setSession((current) => current && !current.admin ? { ...current, user: updated } : current);
      if (success) showToast(success);
      return true;
    } catch (caught) {
      showToast(errorMessage(caught, t("errorGeneric")), { error: true });
      return false;
    } finally {
      setBusy(false);
    }
  }

  function exportEntry(entry: Entry) {
    const calendar = buildIcsFile(entry, { language });
    if (!calendar) {
      showToast(t("errorGeneric"), { error: true });
      return;
    }
    const url = URL.createObjectURL(new Blob([calendar], { type: "text/calendar;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `shift-${entry.date}.ics`;
    anchor.click();
    URL.revokeObjectURL(url);
    showToast(t("exported"));
  }

  async function deleteEntry(entry: Entry) {
    if (!session || session.admin) return;
    setDialog(null);
    const removed = await applyUserMutation(
      () => api.deleteAssignment(session.sessionToken, { entryId: entry.id, date: entry.date, kind: entry.kind }),
      "",
    );
    if (removed) {
      showToast(t("deleted"), {
        undo: () => {
          void applyUserMutation(() => api.addAssignment(session.sessionToken, entry), t("restored"));
        },
      });
    }
  }

  if (restoring) return <main className="loading-screen" aria-label={t("loading")}><span className="loader" /></main>;
  if (!session) return <AuthScreen api={api} mode={mode} language={language} setLanguage={setLanguage} onSession={acceptSession} />;

  const isAdmin = session.admin;
  const availablePages: Page[] = isAdmin ? ["admin"] : ["home", "calendar", "search", "settings"];
  const pageTitle = t(page);
  const pageSubtitle = isAdmin
    ? t("allUsers")
    : page === "home"
      ? `${user?.username} · ${t(`shift${user?.shift ?? "A"}`)}`
      : page === "calendar"
        ? formatMonthLabel(cursor.monthIndex, cursor.year, language)
        : page === "search"
          ? language === "ar" ? "أيامك المتاحة وتكاليفك" : "Available dates and assignments"
          : t("profile");

  return (
    <div className="app-root">
      <div className={tourStep !== null ? "tour-background" : undefined} inert={tourStep !== null}>
      <div className="app-shell">
        <aside className="sidebar">
          <div className="sidebar-brand"><span className="sidebar-brand-mark"><CalendarDays size={24} /></span><div><strong>{t("appTitle")}</strong><span>V3</span></div></div>
          <nav className="nav-list" aria-label={t("menu")}>
            {availablePages.map((item) => <button className={`nav-button${page === item ? " active" : ""}`} type="button" key={item} aria-current={page === item ? "page" : undefined} onClick={() => setPage(item)}>{iconForPage(item)}{t(item)}</button>)}
          </nav>
          <div className="sidebar-spacer" />
          {!isAdmin && user ? (
            <div className="sidebar-profile">
              <div className="profile-row"><span className="avatar">{user.username.slice(0, 1).toUpperCase()}</span><span className="profile-copy"><strong>{user.username}</strong><span>{user.employee_id} · {user.shift}</span></span></div>
              <button className="button button-ghost button-block" type="button" onClick={() => void logout()}><LogOut size={17} />{t("logout")}</button>
            </div>
          ) : <button className="button button-ghost" type="button" onClick={() => void logout()}><LogOut size={17} />{t("logout")}</button>}
        </aside>

        <main className="main-area">
          <header className="topbar">
            <div className="page-heading"><h1 tabIndex={-1}>{pageTitle}</h1><p>{pageSubtitle}</p></div>
            <div className="topbar-tools">
              <span className="mode-chip"><span className="mode-dot" />{mode === "mock" ? t("mockMode") : t("apiMode")}</span>
              <span className="status-chip"><span className="status-dot" style={{ color: online ? "var(--green)" : "var(--red)" }} />{online ? t("online") : t("offline")}</span>
              <button className="icon-button" type="button" onClick={() => setLanguage(language === "ar" ? "en" : "ar")} aria-label={t("language")}><Languages size={19} /></button>
              <button className="icon-button" type="button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label={t("theme")}>{theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}</button>
              <button className="button button-secondary" type="button" onClick={() => void logout()}><LogOut size={17} />{t("logout")}</button>
            </div>
          </header>

          <div className="content">
            {!isAdmin && user && page === "home" ? <HomePage user={user} cursor={cursor} language={language} openCalendar={() => setPage("calendar")} openAdd={() => setDialog({ kind: "entry", date: nextAssignableDate(user), entryKind: "assignment" })} openBulk={() => setDialog({ kind: "bulk" })} openSearch={() => setPage("search")} openTeam={(entry) => setDialog({ kind: "team", entry })} /> : null}
            {!isAdmin && user && page === "calendar" ? <CalendarPanel cursor={cursor} setCursor={setCursor} view={calendarView} setView={setCalendarView} user={user} language={language} onDay={(date) => setDialog({ kind: "day", date })} onEdit={(entry) => setDialog({ kind: "entry", date: entry.date, entryKind: entry.kind, entry })} onDelete={(entry) => void deleteEntry(entry)} onExport={exportEntry} onTeam={(entry) => setDialog({ kind: "team", entry })} /> : null}
            {!isAdmin && user && page === "search" ? <SearchPage user={user} cursor={cursor} language={language} onOpenDay={(date) => setDialog({ kind: "day", date })} /> : null}
            {!isAdmin && user && page === "settings" ? <SettingsPage user={user} language={language} theme={theme} busy={busy} setTheme={setTheme} changeLanguage={(next) => {
              setLanguage(next);
              void applyUserMutation(() => api.updateProfile(session.sessionToken, { settings: { ...user.settings, language: next } }), t("saved"));
            }} updateProfile={(changes) => applyUserMutation(() => api.updateProfile(session.sessionToken, changes), t("saved"))} requestClear={() => setDialog({ kind: "clear" })} replayTour={() => showTourStep(0)} /> : null}
            {isAdmin && page === "admin" ? <AdminPage api={api} sessionToken={session.sessionToken} language={language} onUser={(selected) => setDialog({ kind: "user", user: selected })} /> : null}
          </div>
        </main>
      </div>

      <nav className={`bottom-nav${isAdmin ? " bottom-nav-admin" : ""}`} aria-label={t("menu")}>
        {availablePages.map((item) => <button className={`bottom-nav-button${page === item ? " active" : ""}`} type="button" key={item} aria-current={page === item ? "page" : undefined} onClick={() => setPage(item)}>{iconForPage(item)}<span>{t(item)}</span></button>)}
        <button className="bottom-nav-button bottom-nav-logout" type="button" onClick={() => void logout()} aria-label={t("logout")}><LogOut size={19} /><span>{t("logoutShort")}</span></button>
      </nav>

      {!isAdmin ? (
        <>
          <button className="mobile-fab" type="button" onClick={() => user && setDialog({ kind: "entry", date: nextAssignableDate(user), entryKind: "assignment" })} aria-label={t("addAssignment")}><Plus size={24} /></button>
        </>
      ) : null}

      {!isAdmin && user && dialog?.kind === "day" ? <DayDialog date={dialog.date} user={user} language={language} onClose={closeDialog} onAdd={(kind) => setDialog({ kind: "entry", date: dialog.date, entryKind: kind })} onEdit={(entry) => setDialog({ kind: "entry", date: entry.date, entryKind: entry.kind, entry })} onDelete={(entry) => void deleteEntry(entry)} onExport={exportEntry} onTeam={(entry) => setDialog({ kind: "team", entry })} /> : null}
      {!isAdmin && user && dialog?.kind === "team" ? <Dialog title={language === "ar" ? "المكلفين معاك" : "Your assignment team"} description={dateLabel(dialog.entry.date, language, { weekday: "long" })} onClose={closeDialog}><Suspense fallback={<div className="team-loading" role="status">{t("loading")}</div>}><TeamPanel api={api} sessionToken={session.sessionToken} entry={dialog.entry} user={user} language={language} onProfile={() => { closeDialog(); setPage("settings"); }} /></Suspense></Dialog> : null}
      {!isAdmin && user && dialog?.kind === "entry" && (dialog.entryKind !== "guard" || user.shift === "M") ? <EntryDialog date={dialog.date} entry={dialog.entry} entryKind={dialog.entryKind} user={user} language={language} busy={busy} onClose={closeDialog} onSave={async (assignment) => {
        const successful = dialog.entry
          ? await applyUserMutation(() => api.updateAssignment(session.sessionToken, dialog.entry!.id, assignment), t("saved"))
          : await applyUserMutation(() => api.addAssignment(session.sessionToken, assignment), t("saved"));
        if (successful) closeDialog();
      }} /> : null}
      {!isAdmin && user && dialog?.kind === "bulk" ? <BulkDialog user={user} cursor={cursor} language={language} busy={busy} onClose={closeDialog} onSave={async (entries) => {
        const successful = await applyUserMutation(() => api.bulkUpsertAssignments(session.sessionToken, entries), t("saved"));
        if (successful) closeDialog();
      }} /> : null}
      {!isAdmin && user && dialog?.kind === "clear" ? <Dialog title={t("clearData")} description={clearDataDescription(language, user.shift)} onClose={closeDialog}><div className="notice-box warning"><AlertTriangle size={20} /> {clearDataDescription(language, user.shift)}</div><div className="dialog-actions"><button className="button button-ghost" type="button" onClick={closeDialog}>{t("cancel")}</button><button className="button button-danger" type="button" disabled={busy} onClick={async () => { const successful = await applyUserMutation(() => api.clearAssignments(session.sessionToken), t("clearDataDone")); if (successful) closeDialog(); }}><Trash2 size={17} />{t("confirm")}</button></div></Dialog> : null}
      {isAdmin && dialog?.kind === "user" ? <Dialog title={dialog.user.username} description={`${dialog.user.employee_id} · ${t(`shift${dialog.user.shift}`)}`} wide onClose={closeDialog}><div className="entry-list">{dialog.user.assignments.length ? dialog.user.assignments.slice().sort((a, b) => b.date.localeCompare(a.date)).map((entry) => <EntryCard key={entry.id} entry={entry} language={language} />) : <div className="empty-state"><span className="empty-state-icon"><CircleUserRound /></span><p>{t("noItems")}</p></div>}</div></Dialog> : null}

      </div>
      {!isAdmin && user && tourStep !== null ? <Suspense fallback={<div className="tour-loading" role="status">{t("loading")}</div>}><OnboardingTour step={tourStep} language={language} onStep={showTourStep} onFinish={finishTour} /></Suspense> : null}
      <div className="toast-region" role="status" aria-live="polite">
        {toasts.map((toast) => <div className={`toast${toast.error ? " error" : ""}`} key={toast.id}><span>{toast.message}</span>{toast.undo ? <button className="button button-ghost" type="button" onClick={() => { toast.undo?.(); setToasts((current) => current.filter((item) => item.id !== toast.id)); }}>{t("undo")}</button> : null}</div>)}
      </div>
    </div>
  );
}
