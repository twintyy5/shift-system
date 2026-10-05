import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App";
import * as apiModule from "../src/api";

describe("V3 onboarding", () => {
  let api: apiModule.ApiClient;
  beforeEach(() => {
    window.history.replaceState({}, "", "/?demo=1");
    localStorage.clear();
    sessionStorage.clear();
    api = apiModule.createApiClient("mock");
    vi.spyOn(apiModule, "createApiClient").mockReturnValue(api);
  });
  afterEach(() => vi.restoreAllMocks());

  async function register() {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole("button", { name: "إنشاء حساب" }));
    await user.type(screen.getByLabelText("اسم المستخدم"), "new-colleague");
    await user.type(screen.getByLabelText("رقم م.ط.ط"), "9000123");
    await user.type(screen.getByLabelText("كلمة السر"), "mock-password");
    await user.click(screen.getByRole("button", { name: "إنشاء حساب" }));
    await screen.findByRole("dialog", { name: "هذا تقويمك" });
    return user;
  }
  function nav() {
    return within(screen.getAllByRole("navigation", { name: "القائمة" }).find(el => el.classList.contains("bottom-nav"))!);
  }
  async function next(user: ReturnType<typeof userEvent.setup>, heading: string) {
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "التالي" }));
    return screen.findByRole("dialog", { name: heading });
  }

  it("guides a new account through real features, traps focus, and persists completion without adding data", async () => {
    const save = vi.spyOn(api, "updateProfile");
    const add = vi.spyOn(api, "addAssignment");
    const user = await register();
    expect(document.querySelector(".tour-background")).toHaveAttribute("inert");
    expect(document.querySelector('[data-tour="calendar"]')).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "هذا تقويمك" })).toHaveFocus();
    await user.tab({ shift: true });
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "التالي" })).toHaveFocus();
    await user.tab();
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "تخطي" })).toHaveFocus();

    const assignment = await next(user, "أضف أول تكليف");
    expect(assignment).toHaveTextContent("٢–٦ مساءً");
    expect(assignment).toHaveTextContent("تقويم جهازك");
    expect(document.querySelector('[data-tour="add"]')).toBeInTheDocument();
    await next(user, "اعرف منو معاك");
    expect(document.querySelector('[data-tour="team"]')).toBeInTheDocument();
    await next(user, "طلع أيامك المتاحة بثواني");
    expect(document.querySelector('[data-tour="search"]')).toBeInTheDocument();
    const final = await next(user, "جاهز تبدأ؟");
    expect(final).toHaveTextContent("الفني عبدالله جاسم");
    expect(final).toHaveTextContent("٥٥٩٩٢٣٧٥");
    expect(within(final).getByRole("link", { name: "اتصال بعبدالله" })).toHaveAttribute("href", "tel:+96555992375");
    await user.click(within(final).getByRole("button", { name: "السابق" }));
    await screen.findByRole("dialog", { name: "طلع أيامك المتاحة بثواني" });
    await next(user, "جاهز تبدأ؟");
    await user.click(screen.getByRole("button", { name: "يلا أبدأ" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole("heading", { name: "التقويم" })).toHaveFocus());
    expect(document.querySelector("[inert]")).toBeNull();
    expect(save).toHaveBeenCalledWith(expect.any(String), { settings: { onboardingCompleted: true } });
    const freshSession = await api.login({ identifier: "9000123", password: "mock-password" });
    expect(freshSession.user.settings.onboardingCompleted).toBe(true);
    expect(freshSession.user.assignments).toEqual([]);
    expect(add).not.toHaveBeenCalled();

    await user.click(nav().getByRole("button", { name: "تسجيل الخروج" }));
    await user.clear(await screen.findByLabelText("اسم المستخدم / رقم م.ط.ط"));
    await user.type(screen.getByLabelText("اسم المستخدم / رقم م.ط.ط"), "9000123");
    await user.type(screen.getByLabelText("كلمة السر"), "mock-password");
    await user.click(screen.getByRole("button", { name: "تسجيل الدخول" }));
    await screen.findByRole("heading", { name: "الرئيسية" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("leaves existing accounts uninterrupted and supports replay, skip and Escape", async () => {
    const save = vi.spyOn(api, "updateProfile");
    const user = userEvent.setup();
    render(<App />);
    await user.type(await screen.findByLabelText("كلمة السر"), "demo");
    await user.click(screen.getByRole("button", { name: "تسجيل الدخول" }));
    await screen.findByRole("heading", { name: "الرئيسية" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const before = await api.login({ identifier: "demo-a", password: "demo" });
    await user.click(nav().getByRole("button", { name: "الإعدادات" }));
    await user.click(screen.getByRole("button", { name: "ابدأ الجولة" }));
    await screen.findByRole("dialog", { name: "هذا تقويمك" });
    await user.click(screen.getByRole("button", { name: "تخطي" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    const after = await api.login({ identifier: "demo-a", password: "demo" });
    expect(after.user).toEqual({ ...before.user, settings: { ...before.user.settings, onboardingCompleted: true } });
    await user.click(nav().getByRole("button", { name: "الإعدادات" }));
    await user.click(screen.getByRole("button", { name: "ابدأ الجولة" }));
    await screen.findByRole("dialog", { name: "هذا تقويمك" });
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("can leave the guide to complete contact details", async () => {
    const user = await register();
    await next(user, "أضف أول تكليف");
    await next(user, "اعرف منو معاك");
    await user.click(screen.getByRole("button", { name: "كمّل اسمك ورقم تلفونك" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("اسمك في رسالة التكليف")).toHaveFocus());
    expect(screen.getByRole("heading", { name: "الإعدادات" })).toBeInTheDocument();
  });

  it("keeps the app usable and reports a failed completion save", async () => {
    vi.spyOn(api, "updateProfile").mockRejectedValue(new Error("offline"));
    const user = await register();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(await screen.findByText("تعذر حفظ إنهاء الجولة. تقدر ترجع لها من الإعدادات.")).toBeInTheDocument();
    const session = await api.login({ identifier: "9000123", password: "mock-password" });
    expect(session.user.settings.onboardingCompleted).toBeUndefined();
  });
});
