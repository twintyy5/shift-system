import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App, visibleEntriesForUser } from "../src/App";
import type { Entry } from "../src/core";

describe("V2 application shell", () => {
  it("hides historical guard rows from non-M accounts without changing the source data", () => {
    const assignment: Entry = { id: "a", kind: "assignment", date: "2026-09-06", name: "Clinic", time: "A", notes: "", color: "blue", source: "test", reminderOffsetMinutes: 60 };
    const guard: Entry = { ...assignment, id: "g", kind: "guard", name: "Guard", color: "red" };
    const source = [assignment, guard];

    expect(visibleEntriesForUser({ shift: "A", assignments: source })).toEqual([assignment]);
    expect(visibleEntriesForUser({ shift: "M", assignments: source })).toEqual(source);
    expect(source).toHaveLength(2);
  });

  beforeEach(() => {
    window.history.replaceState({}, "", "/?demo=1");
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function signInDemo() {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("heading", { name: "تسجيل الدخول" });
    await user.type(screen.getByLabelText("كلمة السر"), "demo");
    await user.click(screen.getByRole("button", { name: "تسجيل الدخول" }));
    await screen.findByRole("heading", { name: "الرئيسية" });
    return user;
  }

  it.each([502, 504])("keeps the saved session during a temporary service failure (%s)", async (status) => {
    window.history.replaceState({}, "", "/");
    sessionStorage.setItem("shift-system-v2-session-production", "synthetic-session");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: false, error: "Service unavailable" }), { status })));
    render(<App />);
    await screen.findByRole("heading", { name: "تسجيل الدخول" });
    expect(sessionStorage.getItem("shift-system-v2-session-production")).toBe("synthetic-session");
  });

  it("removes a rejected session instead of reusing it after reload", async () => {
    window.history.replaceState({}, "", "/");
    sessionStorage.setItem("shift-system-v2-session-production", "synthetic-expired");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: false, error: "Invalid session" }), { status: 400 })));
    render(<App />);
    await screen.findByRole("heading", { name: "تسجيل الدخول" });
    expect(sessionStorage.getItem("shift-system-v2-session-production")).toBeNull();
  });

  it("shows a service failure in Arabic on the login form", async () => {
    window.history.replaceState({}, "", "/");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: false, error: "Service unavailable" }), { status: 502 })));
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByLabelText("اسم المستخدم / رقم م.ط.ط"), "synthetic");
    await user.type(screen.getByLabelText("كلمة السر"), "synthetic-password");
    await user.click(screen.getByRole("button", { name: "تسجيل الدخول" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("تعذر الاتصال بالخدمة حالياً");
  });

  it("signs into the isolated demo and renders the mobile-ready dashboard without networking", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const user = await signInDemo();
    expect(screen.queryByText("دوامك وتكاليفك، بصورة أوضح")).not.toBeInTheDocument();
    expect(screen.getAllByText("بيانات تجريبية").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("navigation", { name: "القائمة" }).length).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();

    const addButton = screen.getByLabelText("إضافة تكليف");
    await user.click(addButton);
    const dialog = await screen.findByRole("dialog", { name: "إضافة تكليف" });
    expect(screen.getByRole("button", { name: "إغلاق" })).toHaveFocus();
    await user.tab({ shift: true });
    expect(dialog.querySelector("button[type='submit']")).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "إضافة تكليف" })).not.toBeInTheDocument();
    expect(addButton).toHaveFocus();

    const bottomNavigation = screen.getAllByRole("navigation", { name: "القائمة" })
      .find((navigation) => navigation.classList.contains("bottom-nav"));
    expect(bottomNavigation).toBeDefined();
    expect(within(bottomNavigation!).getAllByRole("button")).toHaveLength(5);
    expect(within(bottomNavigation!).getByRole("button", { name: "تسجيل الخروج" })).toBeVisible();

    await user.click(within(bottomNavigation!).getByRole("button", { name: "التقويم" }));
    await screen.findByRole("heading", { name: "التقويم" });
    const calendarLabels = [...document.querySelectorAll(".day-labels .day-status")]
      .map((label) => label.textContent);
    expect(calendarLabels).toContain("دوام");
    expect(calendarLabels).toContain("راحة");
    expect(screen.queryByText(/خفارة/)).not.toBeInTheDocument();

    await user.click(within(bottomNavigation!).getByRole("button", { name: "الإعدادات" }));
    expect(screen.queryByText(/خفارة/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "مسح كل البيانات" }));
    expect(await screen.findByRole("dialog", { name: "مسح كل البيانات" })).toHaveTextContent("سيتم حذف جميع بيانات التقويم");
    expect(screen.queryByText(/خفارة/)).not.toBeInTheDocument();
  });

  it("uses an entry color as a visible calendar-cell custom color", async () => {
    const user = await signInDemo();
    await user.click(screen.getByLabelText("إضافة تكليف"));
    await user.click(await screen.findByRole("button", { name: "red" }));
    await user.click(screen.getByRole("button", { name: "حفظ" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "إضافة تكليف" })).not.toBeInTheDocument());

    const bottomNavigation = screen.getAllByRole("navigation", { name: "القائمة" })
      .find((navigation) => navigation.classList.contains("bottom-nav"));
    await user.click(within(bottomNavigation!).getByRole("button", { name: "التقويم" }));

    const coloredDay = await waitFor(() => {
      const element = [...document.querySelectorAll<HTMLElement>(".day-cell.has-entry-color")]
        .find((day) => day.style.getPropertyValue("--entry-color") === "#ef4444");
      expect(element).toBeDefined();
      return element!;
    });
    expect(coloredDay.style.getPropertyValue("--entry-color")).toBe("#ef4444");
  });

  it("copies the shared three-person message, then plain available dates, and previews both reminder times", async () => {
    const user = await signInDemo();
    const clipboard = vi.spyOn(navigator.clipboard, "writeText");
    await user.click(screen.getByRole("button", { name: "المكلفين معاك والرسالة" }));
    await user.click(await screen.findByRole("button", { name: "نسخ رسالة التكليف" }));
    await waitFor(() => expect(clipboard).toHaveBeenCalled());
    const message = clipboard.mock.calls.at(-1)![0];
    expect(message).toContain("المكلف الأول: أحمد التجريبي\nم.ط.ط: DEMO-001\nرقم التلفون: 00000001");
    expect(message.match(/المكلف /g)).toHaveLength(3);
    expect(message.endsWith("اسم المستلم:")).toBe(true);
    await user.keyboard("{Escape}");
    const nav = screen.getAllByRole("navigation", { name: "القائمة" }).find((item) => item.classList.contains("bottom-nav"))!;
    await user.click(within(nav).getByRole("button", { name: "البحث" }));
    await user.click(screen.getByRole("button", { name: "أيام الراحة" }));
    await user.click(screen.getByRole("button", { name: "نسخ التواريخ" }));
    const dates = clipboard.mock.calls.at(-1)![0];
    expect(dates).toMatch(/^\d{2}\/\d{2}\/\d{4}(\n\d{2}\/\d{2}\/\d{4})*$/);
    await user.click(screen.getByLabelText("إضافة تكليف"));
    expect(await screen.findByText("التذكير الساعة ١:٠٠ م")).toBeVisible();
    await user.selectOptions(document.querySelector<HTMLSelectElement>("#entry-time")!, "N");
    expect(screen.getByText("التذكير الساعة ٥:٠٠ م")).toBeVisible();
    await user.selectOptions(document.querySelector<HTMLSelectElement>("#entry-reminder")!, "0");
    expect(screen.queryByText(/التذكير الساعة/)).not.toBeInTheDocument();
  });
});
