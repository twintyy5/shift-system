import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, Phone, RefreshCw, UserRound, UsersRound } from "lucide-react";
import type { ApiClient } from "./api";
import type { Entry, Language, User } from "./core";
import { buildAssignmentMessage, type AssignmentTeam } from "./assignment-team";
import { assignmentTimeLabel } from "./assignment-time";
import { copyText } from "./clipboard";

export default function TeamPanel({ api, sessionToken, entry, user, language, onProfile }: {
  api: ApiClient; sessionToken: string; entry: Entry; user: User; language: Language; onProfile: () => void;
}) {
  const ar = language === "ar";
  const [team, setTeam] = useState<AssignmentTeam | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [revision, setRevision] = useState(0);
  const textArea = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(""); setTeam(null); setCopied(false); setFallback(false);
    api.getAssignmentTeam(sessionToken, entry.id).then((next) => { if (active) setTeam(next); }).catch((caught) => {
      if (!active) return;
      const message = caught instanceof Error ? caught.message : "";
      setError(message === "TEAM_OVER_CAPACITY"
        ? ar ? "مسجّل أكثر من ٣ مكلفين لنفس العيادة والفترة. راجع بيانات التكليف." : "More than three people share this assignment. Check the clinic and period."
        : ar ? "تعذر تحميل المكلفين. جرّب تحديث القائمة." : "Could not load colleagues. Refresh to try again.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api, sessionToken, entry.id, revision, ar]);

  const message = team ? buildAssignmentMessage(entry, team.members) : "";
  const copy = useCallback(async () => {
    const success = await copyText(message);
    setCopied(success); setFallback(!success);
  }, [message]);
  useEffect(() => { if (fallback) { textArea.current?.focus(); textArea.current?.select(); } }, [fallback]);
  const complete = team?.members.filter((member) => member.name && member.employeeId && member.phone).length ?? 0;
  const ordinals = ar ? ["المكلف الأول", "المكلف الثاني", "المكلف الثالث"] : ["First colleague", "Second colleague", "Third colleague"];

  return <section className="team-panel" aria-label={ar ? "المكلفين معاك" : "Your assignment team"}>
    <div className="team-heading"><div><p className="eyebrow">{assignmentTimeLabel(entry.time, language)}</p><h3>{entry.name}</h3></div><button className="icon-button" type="button" onClick={() => setRevision((value) => value + 1)} disabled={loading} aria-label={ar ? "تحديث المكلفين" : "Refresh colleagues"}><RefreshCw size={18} className={loading ? "loader-icon" : ""} /></button></div>
    {!user.settings.phone ? <button className="team-profile-prompt" type="button" onClick={onProfile}><UserRound size={18} /><span>{ar ? "أضف اسمك ورقم تلفونك لإكمال رسالة التكليف" : "Add your name and phone to complete the assignment message"}</span></button> : null}
    {loading ? <div className="team-loading" role="status"><span className="loader" />{ar ? "جاري تحميل المكلفين…" : "Loading colleagues…"}</div> : null}
    {error ? <div className="notice-box warning" role="alert">{error}</div> : null}
    {team ? <>
      <div className="team-completion"><span><UsersRound size={16} />{ar ? "بيانات المكلفين" : "Colleague details"}</span><span>{complete}/3 {ar ? "مكتملة" : "complete"}</span></div>
      <div className="team-members">{ordinals.map((ordinal, index) => {
        const member = team.members[index];
        const self = member && (member.userId === user.id || member.employeeId === user.employee_id);
        return <article className={`team-member${member ? "" : " pending"}`} key={ordinal}>
          <span className="team-number" aria-hidden="true">{index + 1}</span>
          <div className="team-member-copy"><div className="team-member-label">{ordinal}{self ? <span className="team-you">{ar ? "أنت" : "You"}</span> : null}</div><strong>{member?.name || (ar ? "بانتظار تسجيل الزميل" : "Waiting for a colleague")}</strong><span>{ar ? "م.ط.ط" : "Employee ID"}: <bdi>{member?.employeeId || "—"}</bdi></span><span>{ar ? "رقم التلفون" : "Phone"}: <bdi>{member?.phone || "—"}</bdi></span></div>
          {member?.phone && !member.phone.startsWith("000") ? <a className="icon-button team-call" href={`tel:${member.phone}`} aria-label={`${ar ? "اتصال بـ" : "Call"} ${member.name}`}><Phone size={18} /></a> : null}
        </article>;
      })}</div>
      {complete < 3 ? <p className="team-note">{ar ? "الخانات غير المكتملة تبقى فارغة في الرسالة." : "Missing details stay blank in the message."}</p> : null}
      <button className="button button-primary button-block team-copy-button" type="button" onClick={() => void copy()}>{copied ? <Check size={18} /> : <Copy size={18} />}{copied ? ar ? "تم نسخ الرسالة" : "Message copied" : ar ? "نسخ رسالة التكليف" : "Copy assignment message"}</button>
      <span className="sr-only" role="status">{copied ? ar ? "تم نسخ الرسالة" : "Message copied" : ""}</span>
      <details className="message-preview" open={fallback || undefined}><summary>{ar ? "معاينة الرسالة" : "Preview message"}</summary>{fallback ? <p role="status">{ar ? "النسخ التلقائي غير متاح. حدّد النص وانسخه يدويًا." : "Automatic copying is unavailable. Select and copy the text."}</p> : null}<textarea ref={textArea} className="textarea" dir="rtl" readOnly value={message} rows={17} aria-label={ar ? "رسالة التكليف الجاهزة" : "Prepared assignment message"} /></details>
    </> : null}
  </section>;
}
