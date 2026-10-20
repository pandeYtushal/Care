import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronDown, Clock3, Copy, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Checkbox } from "../components/ui/checkbox";
import { Select } from "../components/ui/select";
import { api, ApiError } from "../lib/api";
import { PageHeader } from "../portal/PortalPrimitives";

type Rule = {
  id: string;
  weekday: number;
  startsAt: string;
  endsAt: string;
  slotMinutes: number;
  bufferMinutes: number;
};

type ProfileResult = { profile?: { timezone?: string | null } | null };
type TimeOff = { id: string; starts_at: string; ends_at: string; label?: string | null };

const weekdays = [
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
  { value: 0, label: "Sunday", short: "Sun" },
];
const durationOptions = [15, 30, 45, 60];
const bufferOptions = [0, 5, 10, 15, 20, 30, 45, 60, 90, 120];
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

function createId() {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function cloneRules(rules: Rule[]) {
  return rules.map((rule) => ({ ...rule }));
}

function scheduleSignature(rules: Rule[]) {
  return JSON.stringify([...rules]
    .sort((a, b) => a.weekday - b.weekday || a.startsAt.localeCompare(b.startsAt))
    .map(({ weekday, startsAt, endsAt, slotMinutes, bufferMinutes }) => ({ weekday, startsAt, endsAt, slotMinutes, bufferMinutes })));
}

function overlaps(a: Rule, b: Rule) {
  return a.weekday === b.weekday && a.startsAt < b.endsAt && b.startsAt < a.endsAt;
}

function ruleIssue(rule: Rule, peers: Rule[]) {
  if (!timePattern.test(rule.startsAt) || !timePattern.test(rule.endsAt)) return "Enter a valid start and end time.";
  if (rule.endsAt <= rule.startsAt) return "End time must be later than start time.";
  if (peers.some((peer) => peer.id !== rule.id && overlaps(rule, peer))) return "This interval overlaps another one.";
  return "";
}

function createFreeInterval(weekday: number, rules: Rule[]): Rule | null {
  for (let startMinute = 9 * 60; startMinute + 60 <= 17 * 60; startMinute += 30) {
    const endMinute = startMinute + 60;
    const startsAt = `${String(Math.floor(startMinute / 60)).padStart(2, "0")}:${String(startMinute % 60).padStart(2, "0")}`;
    const endsAt = `${String(Math.floor(endMinute / 60)).padStart(2, "0")}:${String(endMinute % 60).padStart(2, "0")}`;
    const candidate: Rule = { id: createId(), weekday, startsAt, endsAt, slotMinutes: 30, bufferMinutes: 0 };
    if (!rules.some((rule) => overlaps(rule, candidate))) return candidate;
  }
  return null;
}

function timeZoneDisplay(timezone: string) {
  try {
    const zoneName = new Intl.DateTimeFormat(undefined, { timeZone: timezone, timeZoneName: "long" })
      .formatToParts(new Date())
      .find((part) => part.type === "timeZoneName")?.value;
    return zoneName ? `${zoneName} · ${timezone}` : timezone;
  } catch {
    return timezone;
  }
}

function zoneInputToIso(value: string, timezone: string) {
  const [date, time] = value.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let estimate = target;
  const formatter = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  for (let index = 0; index < 4; index += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(estimate)).map((part) => [part.type, part.value]));
    const represented = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
    estimate += target - represented;
  }
  const result = new Date(estimate);
  const parts = Object.fromEntries(formatter.formatToParts(result).map((part) => [part.type, part.value]));
  const converted = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  if (converted !== value) throw new Error("That local time does not exist in the practice timezone. Choose another time.");
  return result.toISOString();
}

function formatTimeOff(value: string, timezone: string) {
  try {
    return new Intl.DateTimeFormat(undefined, { timeZone: timezone, dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  } catch {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  }
}

export default function DoctorAvailabilityPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [savedRules, setSavedRules] = useState<Rule[]>([]);
  const [enabledDays, setEnabledDays] = useState<Set<number>>(new Set());
  const [savedSignature, setSavedSignature] = useState("[]");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata");
  const [copySource, setCopySource] = useState(1);
  const [copyTargets, setCopyTargets] = useState<Set<number>>(new Set());
  const [timeOff, setTimeOff] = useState<TimeOff[]>([]);
  const [timeOffLoading, setTimeOffLoading] = useState(true);
  const [timeOffStart, setTimeOffStart] = useState("");
  const [timeOffEnd, setTimeOffEnd] = useState("");
  const [timeOffLabel, setTimeOffLabel] = useState("");
  const [timeOffBusy, setTimeOffBusy] = useState(false);
  const [timeOffError, setTimeOffError] = useState("");
  const [timeOffNotice, setTimeOffNotice] = useState("");
  const [timeOffReload, setTimeOffReload] = useState(0);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError("");
    void api<{ rules: Array<Record<string, unknown>> }>("/portal/availability")
      .then((result) => {
        const loaded = result.rules.map((rule, index) => ({
          id: String(rule.id ?? `saved-${index}`),
          weekday: Number(rule.weekday),
          startsAt: String(rule.starts_at).slice(0, 5),
          endsAt: String(rule.ends_at).slice(0, 5),
          slotMinutes: Number(rule.slot_minutes),
          bufferMinutes: Number(rule.buffer_minutes),
        }));
        const signature = scheduleSignature(loaded);
        setRules(loaded);
        setSavedRules(cloneRules(loaded));
        setSavedSignature(signature);
        setEnabledDays(new Set(loaded.map((rule) => rule.weekday)));
        setExpandedDay(null);
        setError("");
      })
      .catch((reason: unknown) => {
        const text = reason instanceof ApiError ? reason.message : "Could not load availability.";
        setError(text);
        setLoadError(text);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    void api<ProfileResult>("/portal/profile")
      .then((result) => { if (result.profile?.timezone) setTimezone(result.profile.timezone); })
      .catch(() => { /* Fall back to the browser's timezone if the profile is unavailable. */ });
  }, []);
  useEffect(() => {
    let alive = true;
    setTimeOffLoading(true);
    setTimeOffError("");
    void api<{ exceptions: TimeOff[] }>("/portal/availability/exceptions")
      .then((result) => { if (alive) setTimeOff(result.exceptions ?? []); })
      .catch((reason: unknown) => { if (alive) setTimeOffError(reason instanceof ApiError ? reason.message : "Could not load time off."); })
      .finally(() => { if (alive) setTimeOffLoading(false); });
    return () => { alive = false; };
  }, [timeOffReload]);

  const activeRules = useMemo(() => rules.filter((rule) => enabledDays.has(rule.weekday)), [rules, enabledDays]);
  const hasChanges = scheduleSignature(activeRules) !== savedSignature;
  const timezoneLabel = useMemo(() => timeZoneDisplay(timezone), [timezone]);
  const dayCounts = useMemo(() => weekdays.map((day) => ({
    ...day,
    rules: activeRules.filter((rule) => rule.weekday === day.value).sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
  })), [activeRules]);
  const totalBlocks = activeRules.length;
  const totalDays = new Set(activeRules.map((rule) => rule.weekday)).size;

  useEffect(() => {
    if (!hasChanges) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [hasChanges]);

  function toggleDay(day: number) {
    setMessage("");
    setError("");
    if (enabledDays.has(day)) {
      setEnabledDays((current) => {
        const next = new Set(current);
        next.delete(day);
        return next;
      });
      setExpandedDay(null);
      return;
    }
    const existing = rules.some((rule) => rule.weekday === day);
    if (!existing) {
      const candidate = createFreeInterval(day, rules);
      if (candidate) setRules((current) => [...current, candidate]);
      else {
        setError("No free hour is available for this day. Add an interval after adjusting the schedule.");
        return;
      }
    }
    setEnabledDays((current) => new Set(current).add(day));
    setExpandedDay(day);
  }

  function addInterval(day: number) {
    setError("");
    setMessage("");
    if (activeRules.length >= 42) {
      setError("A schedule can have up to 42 weekly intervals.");
      return;
    }
    const candidate = createFreeInterval(day, activeRules);
    if (!candidate) {
      setError(`No free hour remains in the suggested daytime hours for ${weekdays.find((item) => item.value === day)?.label}.`);
      return;
    }
    setRules((current) => [...current, candidate]);
    setEnabledDays((current) => new Set(current).add(day));
    setExpandedDay(day);
  }

  function changeRule(id: string, key: keyof Rule, value: string) {
    setRules((current) => current.map((rule) => rule.id !== id ? rule : ({
      ...rule,
      [key]: key === "weekday" || key === "slotMinutes" || key === "bufferMinutes" ? Number(value) : value,
    })));
    setError("");
    setMessage("");
  }

  function removeRule(id: string) {
    const rule = rules.find((item) => item.id === id);
    setRules((current) => current.filter((item) => item.id !== id));
    setError("");
    setMessage("");
    if (rule && !rules.some((item) => item.id !== id && item.weekday === rule.weekday && enabledDays.has(item.weekday))) {
      setEnabledDays((current) => {
        const next = new Set(current);
        next.delete(rule.weekday);
        return next;
      });
    }
  }

  function toggleCopyTarget(day: number) {
    setCopyTargets((current) => {
      const next = new Set(current);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  }

  function copyHours() {
    const sourceRules = activeRules.filter((rule) => rule.weekday === copySource).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    const targets = [...copyTargets].filter((day) => day !== copySource);
    if (!sourceRules.length) {
      setError("Choose a day that has hours to copy.");
      return;
    }
    if (!targets.length) {
      setError("Choose at least one day to receive these hours.");
      return;
    }
    const nextRules = activeRules.filter((rule) => !targets.includes(rule.weekday));
    const copied = targets.flatMap((weekday) => sourceRules.map((rule) => ({ ...rule, id: createId(), weekday })));
    if (nextRules.length + copied.length > 42) {
      setError("Copying these hours would exceed the 42 interval weekly limit.");
      return;
    }
    setRules((current) => [...current.filter((rule) => enabledDays.has(rule.weekday) && !targets.includes(rule.weekday)), ...copied]);
    setEnabledDays((current) => new Set([...current, ...targets]));
    setError("");
    setMessage("");
  }

  function discardChanges() {
    setRules(cloneRules(savedRules));
    setEnabledDays(new Set(savedRules.map((rule) => rule.weekday)));
    setExpandedDay(null);
    setError("");
    setMessage("");
  }

  async function save() {
    setError("");
    setMessage("");
    if (activeRules.length > 42) {
      setError("A schedule can have up to 42 weekly intervals.");
      return;
    }
    const invalid = activeRules.some((rule, index) => ruleIssue(rule, activeRules.slice(0, index).concat(activeRules.slice(index + 1))));
    if (invalid) {
      setError("Fix the highlighted intervals before saving.");
      return;
    }
    setBusy(true);
    try {
      const result = await api<{ message: string }>("/portal/availability", {
        method: "PUT",
        body: JSON.stringify({ rules: [...activeRules].sort((a, b) => a.weekday - b.weekday || a.startsAt.localeCompare(b.startsAt)).map(({ id: _id, ...rule }) => rule) }),
      });
      setSavedRules(cloneRules(activeRules));
      setSavedSignature(scheduleSignature(activeRules));
      setRules((current) => current.filter((rule) => enabledDays.has(rule.weekday)));
      setMessage(result.message || "Availability saved.");
      setExpandedDay(null);
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Could not save availability. Your edits are still here; please retry.");
    } finally {
      setBusy(false);
    }
  }

  async function addTimeOff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTimeOffError("");
    setTimeOffNotice("");
    let startsAt: string;
    let endsAt: string;
    try {
      startsAt = zoneInputToIso(timeOffStart, timezone);
      endsAt = zoneInputToIso(timeOffEnd, timezone);
    } catch (reason) {
      setTimeOffError(reason instanceof Error ? reason.message : "Enter a valid time-off range.");
      return;
    }
    if (new Date(endsAt) <= new Date(startsAt)) {
      setTimeOffError("The end time must be after the start time.");
      return;
    }
    setTimeOffBusy(true);
    try {
      await api("/portal/availability/exceptions", { method: "POST", body: JSON.stringify({ startsAt, endsAt, label: timeOffLabel }) });
      setTimeOffStart("");
      setTimeOffEnd("");
      setTimeOffLabel("");
      setTimeOffNotice("Time off added. Patients can no longer request visits during this period.");
      setTimeOffReload((value) => value + 1);
    } catch (reason) {
      setTimeOffError(reason instanceof ApiError ? reason.message : "Could not add this time-off period.");
    } finally {
      setTimeOffBusy(false);
    }
  }

  async function removeTimeOff(exception: TimeOff) {
    if (!window.confirm(`Remove this time-off period${exception.label ? ` (“${exception.label}”)` : ""}? New appointment requests may become available again.`)) return;
    setTimeOffBusy(true);
    setTimeOffError("");
    setTimeOffNotice("");
    try {
      await api(`/portal/availability/exceptions/${encodeURIComponent(exception.id)}`, { method: "DELETE" });
      setTimeOffNotice("Time-off period removed.");
      setTimeOffReload((value) => value + 1);
    } catch (reason) {
      setTimeOffError(reason instanceof ApiError ? reason.message : "Could not remove this time-off period.");
    } finally {
      setTimeOffBusy(false);
    }
  }

  return (
    <main className="portal-content doctor-availability-page">
      <PageHeader
        eyebrow="SCHEDULE SETTINGS"
        title="Availability"
        description="Choose the days and hours when patients can request a visit."
      />
      {loading ? <div className="empty-state" role="status">Loading weekly hours…</div> : loadError ? (
        <section className="empty-state empty-state-error">
          <p role="alert">{loadError}</p>
          <button className="btn btn-secondary" onClick={load}>Try again</button>
        </section>
      ) : (
        <section className="availability-workspace" aria-label="Weekly availability editor">
          <div className="availability-summary-bar">
            <div className="availability-timezone"><Clock3 size={15} aria-hidden="true" /><span>{timezoneLabel}</span><small>Practice time</small></div>
            <div className="availability-summary-stats" aria-live="polite">
              <strong>{totalDays}</strong><span>{totalDays === 1 ? "day" : "days"}</span>
              <i aria-hidden="true" />
              <strong>{totalBlocks}</strong><span>{totalBlocks === 1 ? "interval" : "intervals"}</span>
            </div>
          </div>

          <div className="availability-days" aria-label="Weekly schedule">
            {dayCounts.map(({ value: day, label, short, rules: dayRules }) => {
              const enabled = enabledDays.has(day);
              const expanded = expandedDay === day;
              const issues = dayRules.map((rule) => ({ id: rule.id, issue: ruleIssue(rule, dayRules) }));
              return (
                <section className={`availability-day ${enabled ? "is-enabled" : "is-disabled"} ${expanded ? "is-expanded" : ""}`} key={day}>
                  <div className="availability-day-summary">
                    <button type="button" className="availability-day-toggle" aria-expanded={expanded} aria-controls={`availability-day-${day}`} onClick={() => enabled ? setExpandedDay(expanded ? null : day) : toggleDay(day)}>
                      <span className="availability-day-name"><span className="availability-day-short">{short}</span><span>{label}</span></span>
                      <span className="availability-day-hours">
                        {enabled ? dayRules.length ? dayRules.map((rule) => <span className="availability-hours-chip" key={rule.id}>{rule.startsAt}–{rule.endsAt}<small>{rule.slotMinutes} min</small></span>) : <span className="availability-no-hours">Add hours</span> : <span className="availability-day-off">Day off</span>}
                      </span>
                      <ChevronDown className="availability-day-chevron" size={17} aria-hidden="true" />
                    </button>
                    <button type="button" className={`availability-switch ${enabled ? "is-on" : ""}`} role="switch" aria-checked={enabled} aria-label={`${enabled ? "Disable" : "Enable"} ${label}`} onClick={() => toggleDay(day)}>
                      <span />
                    </button>
                  </div>
                  {expanded && enabled && (
                    <div className="availability-day-editor" id={`availability-day-${day}`}>
                      {dayRules.length === 0 && <p className="availability-day-empty-note">This day is on, but no booking hours are set yet.</p>}
                      {dayRules.map((rule) => {
                        const issue = issues.find((item) => item.id === rule.id)?.issue ?? "";
                        return (
                          <div className={`availability-interval ${issue ? "has-error" : ""}`} key={rule.id}>
                            <div className="availability-interval-times">
                              <label><span>From</span><input aria-label={`${label} interval start time`} type="time" value={rule.startsAt} aria-invalid={!!issue} onChange={(event) => changeRule(rule.id, "startsAt", event.target.value)} /></label>
                              <span className="availability-interval-separator" aria-hidden="true">to</span>
                              <label><span>Until</span><input aria-label={`${label} interval end time`} type="time" value={rule.endsAt} aria-invalid={!!issue} onChange={(event) => changeRule(rule.id, "endsAt", event.target.value)} /></label>
                            </div>
                            <label className="availability-interval-setting"><span>Visit length</span><Select aria-label={`${label} appointment length`} value={rule.slotMinutes} onChange={(event) => changeRule(rule.id, "slotMinutes", event.target.value)}>
                              {!durationOptions.includes(rule.slotMinutes) && <option value={rule.slotMinutes}>{rule.slotMinutes} minutes</option>}
                              {durationOptions.map((duration) => <option key={duration} value={duration}>{duration} min</option>)}
                            </Select></label>
                            <label className="availability-interval-setting"><span>Buffer</span><Select aria-label={`${label} buffer between visits`} value={rule.bufferMinutes} onChange={(event) => changeRule(rule.id, "bufferMinutes", event.target.value)}>
                              {!bufferOptions.includes(rule.bufferMinutes) && <option value={rule.bufferMinutes}>{rule.bufferMinutes} min</option>}
                              {bufferOptions.map((buffer) => <option key={buffer} value={buffer}>{buffer ? `${buffer} min` : "None"}</option>)}
                            </Select></label>
                            <button type="button" className="availability-interval-remove" aria-label={`Remove ${label} interval ${rule.startsAt} to ${rule.endsAt}`} onClick={() => removeRule(rule.id)}><Trash2 size={15} aria-hidden="true" /><span>Remove</span></button>
                            {issue && <p className="availability-inline-error" role="alert">{issue}</p>}
                          </div>
                        );
                      })}
                      <button type="button" className="availability-add-interval" onClick={() => addInterval(day)}><Plus size={15} aria-hidden="true" /> Add hours</button>
                    </div>
                  )}
                </section>
              );
            })}
          </div>

          <section className="availability-time-off" aria-labelledby="availability-time-off-title">
            <div className="availability-time-off-heading">
              <div><span>DATES OUTSIDE YOUR USUAL WEEK</span><h2 id="availability-time-off-title">Time off & closures</h2></div>
              <p>Block holidays or one-off periods. Existing appointments are never cancelled automatically.</p>
            </div>
            <form className="availability-time-off-form" onSubmit={(event) => void addTimeOff(event)}>
              <label><span>From · {timezone}</span><input required type="datetime-local" value={timeOffStart} onChange={(event) => setTimeOffStart(event.target.value)} /></label>
              <label><span>Until · {timezone}</span><input required type="datetime-local" value={timeOffEnd} onChange={(event) => setTimeOffEnd(event.target.value)} /></label>
              <label className="availability-time-off-note"><span>Note <small>Optional</small></span><input maxLength={80} value={timeOffLabel} onChange={(event) => setTimeOffLabel(event.target.value)} placeholder="e.g. Clinic closed" /></label>
              <button className="btn btn-secondary" disabled={timeOffBusy}><Plus size={15} aria-hidden="true" />{timeOffBusy ? "Saving…" : "Block time"}</button>
            </form>
            {timeOffError && <p className="form-error availability-time-off-feedback" role="alert">{timeOffError}</p>}
            {timeOffNotice && <p className="form-notice availability-time-off-feedback" role="status">{timeOffNotice}</p>}
            {timeOffLoading ? <p className="availability-time-off-empty" role="status">Loading time off…</p> : timeOff.length ? (
              <ul className="availability-time-off-list">
                {timeOff.map((exception) => <li key={exception.id}>
                  <div><strong>{formatTimeOff(exception.starts_at, timezone)} – {formatTimeOff(exception.ends_at, timezone)}</strong>{exception.label && <span>{exception.label}</span>}</div>
                  <button type="button" className="availability-interval-remove" disabled={timeOffBusy} onClick={() => void removeTimeOff(exception)} aria-label={`Remove time off from ${formatTimeOff(exception.starts_at, timezone)}`}><Trash2 size={14} aria-hidden="true" />Remove</button>
                </li>)}
              </ul>
            ) : <p className="availability-time-off-empty">No upcoming time off. Your regular weekly hours apply.</p>}
          </section>

          <details className="availability-copy-panel">
            <summary><Copy size={15} aria-hidden="true" /><span>Copy hours to other days</span><ChevronDown size={16} aria-hidden="true" /></summary>
            <div className="availability-copy-content">
              <label className="availability-copy-source">Copy hours from<Select value={copySource} onChange={(event) => setCopySource(Number(event.target.value))}>{weekdays.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}</Select></label>
              <fieldset className="availability-copy-targets">
                <legend>Apply to</legend>
                {weekdays.filter((day) => day.value !== copySource).map((day) => <label key={day.value}><Checkbox checked={copyTargets.has(day.value)} onChange={() => toggleCopyTarget(day.value)} />{day.short}</label>)}
              </fieldset>
              <button type="button" className="btn btn-secondary" onClick={copyHours}><Copy size={14} aria-hidden="true" /> Copy schedule</button>
            </div>
          </details>

          <div className="availability-footer">
            <div className="availability-feedback">
              {error && <p className="form-error" role="alert">{error}</p>}
              {message && <p className="form-notice" role="status"><Check size={14} aria-hidden="true" />{message}</p>}
              {hasChanges && !message && !error && <p className="availability-unsaved" role="status">Unsaved changes</p>}
            </div>
            {hasChanges && <button type="button" className="btn btn-secondary availability-discard" onClick={discardChanges} disabled={busy}><RotateCcw size={14} aria-hidden="true" />Discard</button>}
            <button className="btn btn-primary" onClick={() => void save()} disabled={busy || !hasChanges}>{busy ? "Saving…" : "Save changes"}</button>
            <Link to="/doctor/services" className="btn btn-secondary">Configure services</Link>
          </div>
        </section>
      )}
    </main>
  );
}
