import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, Check, Clock3, Phone, Search, UsersRound } from "lucide-react";
import type { Language } from "./core";

const targets = ["calendar", "add", "team", "search"] as const;
const icons = [CalendarDays, Clock3, UsersRound, Search, Check];
const STEP_COUNT = 5;
type Highlight = { top: number; left: number; width: number; height: number };

export default function OnboardingTour({ step, language, onStep, onFinish }: {
  step: number;
  language: Language;
  onStep: (step: number) => void;
  onFinish: (destination?: "calendar" | "settings") => void;
}) {
  const ar = language === "ar";
  const finalStep = step === STEP_COUNT - 1;
  const panel = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [highlight, setHighlight] = useState<Highlight | null>(null);
  const Icon = icons[step];
  const Forward = ar ? ArrowLeft : ArrowRight;
  const Back = ar ? ArrowRight : ArrowLeft;
  const titles = ar
    ? ["هذا تقويمك", "أضف أول تكليف", "اعرف منو معاك", "طلع أيامك المتاحة بثواني", "جاهز تبدأ؟"]
    : ["Your calendar", "Add your first assignment", "Meet your colleagues", "Find your available dates", "Ready to begin?"];

  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [step]);

  useLayoutEffect(() => {
    if (finalStep) { setHighlight(null); return; }
    const target = document.querySelector<HTMLElement>(`[data-tour="${targets[step]}"]`);
    if (!target) { setHighlight(null); return; }
    const measure = () => {
      const rect = target.getBoundingClientRect();
      const cardTop = panel.current?.getBoundingClientRect().top ?? window.innerHeight;
      // Clip the spotlight above the card on short screens and when the keyboard is open.
      const top = Math.max(8, rect.top - 7);
      const bottom = Math.min(rect.bottom + 7, cardTop - 16, window.innerHeight - 8);
      setHighlight(rect.width > 0 && bottom > top ? {
        top, left: Math.max(8, rect.left - 7),
        width: Math.min(rect.width + 14, window.innerWidth - 16), height: bottom - top,
      } : null);
    };
    const placeTarget = () => {
      const rect = target.getBoundingClientRect();
      const cardTop = panel.current?.getBoundingClientRect().top ?? window.innerHeight;
      const desiredTop = Math.max(16, Math.min(90, cardTop - rect.height - 24));
      if (rect.width > 0) window.scrollTo({ top: Math.max(0, window.scrollY + rect.top - desiredTop), behavior: "instant" });
      measure();
    };
    placeTarget();
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", placeTarget);
    window.visualViewport?.addEventListener("resize", placeTarget);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(placeTarget);
    observer?.observe(target);
    if (panel.current) observer?.observe(panel.current);
    return () => {
      observer?.disconnect();
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", placeTarget);
      window.visualViewport?.removeEventListener("resize", placeTarget);
    };
  }, [step, finalStep]);

  function keyboard(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") { event.preventDefault(); onFinish(); return; }
    if (event.key !== "Tab") return;
    const controls = panel.current?.querySelectorAll<HTMLElement>("button:not([disabled]), a[href]");
    if (!controls?.length) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === heading.current)) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  }

  return createPortal(<div className="tour-layer" dir={ar ? "rtl" : "ltr"}>
    {highlight && !finalStep ? <div className="tour-spotlight" style={highlight} aria-hidden="true" /> : <div className="tour-shade" aria-hidden="true" />}
    <section ref={panel} className={`tour-card${finalStep ? " tour-final" : ""}`} role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-description" onKeyDown={keyboard}>
      <header className="tour-header">
        <span className="tour-brand"><BookOpen size={16} />{ar ? "جولة سريعة" : "Quick tour"}<b>V3</b></span>
        <button className="text-button tour-skip" type="button" onClick={() => onFinish()}>{ar ? "تخطي" : "Skip"}</button>
      </header>
      <div className="tour-progress" aria-label={ar ? `الخطوة ${step + 1} من ${STEP_COUNT}` : `Step ${step + 1} of ${STEP_COUNT}`}>
        {Array.from({ length: STEP_COUNT }, (_, index) => <span key={index} className={index <= step ? "complete" : ""} />)}
      </div>
      <div className="tour-title-row"><span className="tour-icon"><Icon size={23} /></span><h2 id="tour-title" ref={heading} tabIndex={-1}>{titles[step]}</h2></div>
      <div id="tour-description" className="tour-copy">
        {step === 0 ? <p>{ar ? "التقويم يترتب حسب شفتك. «دوام» يوضح يوم دوامك، و«راحة» يوم راحتك. اضغط أي يوم عشان تشوف تفاصيله وتكاليفك." : "Your calendar follows your shift. Duty marks work days and Off marks rest days. Select a date to see its details and assignments."}</p> : null}
        {step === 1 ? <>
          <p>{ar ? "من «إضافة تكليف» اختَر العيادة والتاريخ والفترة." : "Select Add assignment, then choose the clinic, date and period."}</p>
          <div className="tour-periods"><span>{ar ? "الصباحي" : "First period"}<strong>{ar ? "٢–٦ مساءً" : "2–6 PM"}</strong></span><span>{ar ? "النايت" : "Night"}<strong>{ar ? "٦–١٠ مساءً" : "6–10 PM"}</strong></span></div>
          <p className="tour-tip">{ar ? "تذكير قبلها بساعة: ١ الظهر أو ٥ العصر. بعد الحفظ، أضف التكليف لتقويم جهازك عشان يتفعّل التنبيه." : "A one-hour reminder is at 1 PM or 5 PM. After saving, add the assignment to your device calendar to activate the alert."}</p>
        </> : null}
        {step === 2 ? <>
          <p>{ar ? "المكلفين بنفس العيادة والتاريخ والفترة يطلعون لبعض في ٣ خانات. افتح تكليفك واختر «المكلفين معاك» عشان تنسخ الرسالة بالأسماء وم.ط.ط والتلفونات؛ اسم المستلم يبقى فاضي." : "Colleagues with the same clinic, date and period appear in three slots. Open your assignment team to copy names, employee IDs and phone numbers; the recipient stays blank."}</p>
          <p className="tour-tip">{ar ? "كمّل اسمك ورقم تلفونك من الإعدادات عشان تظهر بياناتك لزملائك." : "Add your name and phone in Settings so colleagues can see your details."}</p>
          <button className="text-button tour-profile-link" type="button" onClick={() => onFinish("settings")}>{ar ? "كمّل اسمك ورقم تلفونك" : "Add your name and phone"}<Forward size={15} /></button>
        </> : null}
        {step === 3 ? <>
          <p>{ar ? "اكتب «أيام الراحة» بالبحث الذكي، أو اضغط الاختصار المحدد. تطلع لك الأيام المتاحة للتكليف حسب شفتك وحجوزاتك." : "Search for “available days”, or use the highlighted shortcut, to find assignment dates that fit your shift and bookings."}</p>
          <p className="tour-tip">{ar ? "اضغط «نسخ التواريخ»: كل تاريخ بسطر، بدون كلمة راحة أو أي كلام إضافي." : "Select Copy dates: one date per line, with no labels or extra text."}</p>
        </> : null}
        {finalStep ? <>
          <p>{ar ? "جولتك خلصت. تقدر ترجع لها بأي وقت من الإعدادات ← شرح الموقع." : "You can revisit this tour anytime in Settings → Site guide."}</p>
          <div className="tour-contact"><span>{ar ? "أي استفسار" : "For any questions"}</span><strong>{ar ? "الفني عبدالله جاسم" : "Technician Abdullah Jassim"}</strong><bdi>{ar ? "٥٥٩٩٢٣٧٥" : "55992375"}</bdi><a className="button button-secondary" href="tel:+96555992375"><Phone size={17} />{ar ? "اتصال بعبدالله" : "Call Abdullah"}</a></div>
        </> : null}
      </div>
      <footer className="tour-actions">
        {step > 0 ? <button className="button button-ghost" type="button" onClick={() => onStep(step - 1)}><Back size={17} />{ar ? "السابق" : "Back"}</button> : <span className="tour-duration">{ar ? "أقل من دقيقة" : "Under a minute"}</span>}
        <button className="button button-primary" type="button" onClick={() => finalStep ? onFinish() : onStep(step + 1)}>{finalStep ? ar ? "يلا أبدأ" : "Let's begin" : ar ? "التالي" : "Next"}<Forward size={17} /></button>
      </footer>
    </section>
  </div>, document.body);
}
