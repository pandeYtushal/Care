import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Search } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { dateTime, safeGoogleMeetUrl } from "./format";
import type { Appointment } from "./types";
export function AppointmentRows({
  items,
  doctor = false,
  onChanged,
}: {
  items: Appointment[];
  doctor?: boolean;
  onChanged?: () => void;
}) {
  const [busyId, setBusyId] = useState(""),
    [actionError, setActionError] = useState(""),
    [view, setView] = useState<"Requests" | "Upcoming" | "Today" | "Past">("Upcoming"),
    [query, setQuery] = useState(""),
    [dateFilter, setDateFilter] = useState("");
  const [confirmAction, setConfirmAction] = useState<{
    id: string;
    action: "accept" | "decline" | "cancel";
  } | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const actionBusy = useRef(false);
  actionBusy.current = Boolean(busyId);
  const pendingAppointment = items.find((item) => item.id === confirmAction?.id);
  useEffect(() => {
    if (!confirmAction) return;
    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () => Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? []);
    focusable()[0]?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !actionBusy.current) setConfirmAction(null);
      if (event.key !== "Tab") return;
      const controls = focusable();
      if (!controls.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [confirmAction]);
  async function respond(id: string, status: "CONFIRMED" | "CANCELLED") {
    setBusyId(id);
    setActionError("");
    try {
      await api(`/portal/appointments/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      onChanged?.();
      return true;
    } catch (e) {
      setActionError(
        e instanceof ApiError ? e.message : "Could not update this request.",
      );
      return false;
    } finally {
      setBusyId("");
    }
  }
  async function cancelOwnRequest(id: string) {
    setBusyId(id);
    setActionError("");
    try {
      await api(`/portal/appointments/${id}/cancel-request`, {
        method: "POST",
        body: "{}",
      });
      onChanged?.();
      return true;
    } catch (e) {
      setActionError(
        e instanceof ApiError ? e.message : "Could not cancel this request.",
      );
      return false;
    } finally {
      setBusyId("");
    }
  }
  async function confirmPendingAction() {
    if (!confirmAction) return;
    const { id, action } = confirmAction;
    const succeeded = action === "cancel"
      ? await cancelOwnRequest(id)
      : await respond(id, action === "accept" ? "CONFIRMED" : "CANCELLED");
    if (succeeded) setConfirmAction(null);
  }
  if (!items.length)
    return (
      <div className="empty-state">
        <span className="empty-symbol">
          <CalendarDays size={22} />
        </span>
        <h2>{doctor ? "No appointments yet" : "Nothing scheduled yet"}</h2>
        <p>
          {doctor
            ? "Appointments associated with your practice will appear here."
            : "When you’re ready, book your next consultation with Dr. Kiran."}
        </p>
        {!doctor && (
          <Link to="/patient/book" className="btn btn-primary">
            Book a consultation
          </Link>
        )}
      </div>
    );
  const detailsPath = (id: string) =>
    `/${doctor ? "doctor" : "patient"}/appointments/${id}`;
  const now = new Date(),
    todayKey = now.toLocaleDateString(),
    isToday = (value: string) =>
      new Date(value).toLocaleDateString() === todayKey;
  const isDoctorPending = (appointment: Appointment) => doctor && appointment.status === "PENDING";
  const isActiveListVisit = (appointment: Appointment) =>
    !isDoctorPending(appointment) && !["CANCELLED", "NO_SHOW", "COMPLETED"].includes(appointment.status);
  const visible = items.filter((a) => {
    const at = new Date(a.starts_at).getTime(),
      terminal = ["CANCELLED", "NO_SHOW", "COMPLETED"].includes(a.status);
    const belongs = doctor && view === "Requests"
      ? a.status === "PENDING"
      : view === "Today"
        ? isToday(a.starts_at) && isActiveListVisit(a)
        : view === "Past"
          ? !isDoctorPending(a) && (at < Date.now() || terminal)
          : at >= Date.now() && isActiveListVisit(a);
    const target =
      `${a.other_person ?? a.patient_name ?? ""} ${a.service_name} ${a.status} ${a.method}`.toLowerCase();
    const matchesDate = !dateFilter || a.starts_at.slice(0, 10) === dateFilter;
    return belongs && matchesDate && target.includes(query.trim().toLowerCase());
  });
  const ordered = [...visible].sort(
    (a, b) => view === "Past"
      ? new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime()
      : new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
  );
  return (
    <>
      <div className="appointment-tools">
        <div
          className="appointment-filters"
          role="group"
          aria-label="Filter appointments"
        >
          {(doctor ? ["Requests", "Upcoming", "Today", "Past"] as const : ["Upcoming", "Today", "Past"] as const).map((name) => (
            <button
              type="button"
              aria-pressed={view === name}
              className={view === name ? "active" : ""}
              key={name}
              onClick={() => setView(name)}
            >
              {name}
              <span>
                {name === "Requests"
                  ? items.filter((a) => a.status === "PENDING").length
                  : name === "Today"
                  ? items.filter(
                    (a) =>
                      isToday(a.starts_at) &&
                      isActiveListVisit(a),
                  ).length
                  : name === "Past"
                    ? items.filter(
                      (a) =>
                        (!isDoctorPending(a) && new Date(a.starts_at).getTime() < Date.now()) ||
                        ["CANCELLED", "NO_SHOW", "COMPLETED"].includes(
                          a.status,
                        ),
                    ).length
                    : items.filter(
                      (a) =>
                        new Date(a.starts_at).getTime() >= Date.now() && isActiveListVisit(a),
                    ).length}
              </span>
            </button>
          ))}
        </div>
        <label className="list-search">
          <Search size={16} />
          <span className="sr-only">Search appointments</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search appointments"
          />
        </label>
        {doctor && (
          <label className="appointment-date-filter">
            <span>Date</span>
            <input
              type="date"
              value={dateFilter}
              onChange={(event) => setDateFilter(event.target.value)}
            />
          </label>
        )}
      </div>
      {actionError && !confirmAction && (
        <p className="form-error" role="alert">
          {actionError}
        </p>
      )}
      {visible.length ? (
        <div
          className={`appointment-list ${doctor ? "doctor-appointment-list" : ""}`}
        >
          {ordered.map((a) => (
            <article className="appointment-card" key={a.id}>
              <div className="appointment-date">
                <strong>
                  {new Intl.DateTimeFormat(undefined, {
                    day: "2-digit",
                  }).format(new Date(a.starts_at))}
                </strong>
                <span>
                  {new Intl.DateTimeFormat(undefined, {
                    month: "short",
                  }).format(new Date(a.starts_at))}
                </span>
              </div>
              <div className="appointment-main">
                <div className="appointment-card-title">
                  <div>
                    <span className="appointment-person">
                      {doctor && a.patient_id ? (
                        <Link to={`/doctor/patients/${a.patient_id}`}>
                          {a.patient_name ?? a.other_person ?? "Open patient chart"}
                        </Link>
                      ) : (
                        (a.other_person ?? a.patient_name ?? "Dr. Kiran")
                      )}
                    </span>
                    <h3>{a.service_name}</h3>
                  </div>
                  <span
                    className={`status-pill status-${a.status.toLowerCase()}`}
                  >
                    {a.status.replaceAll("_", " ")}
                  </span>
                </div>
                <p>
                  {new Intl.DateTimeFormat(undefined, {
                    timeStyle: "short",
                  }).format(new Date(a.starts_at))}{" "}
                  · {a.method.replaceAll("_", " ")}
                </p>
                <div className="appointment-card-actions">
                  <Link
                    className="button-secondary button"
                    to={detailsPath(a.id)}
                  >
                    View details
                  </Link>
                  {a.status === "PENDING" && doctor && (
                    <>
                      <button className="button-primary button" type="button" disabled={busyId === a.id} onClick={() => setConfirmAction({ id: a.id, action: "accept" })}>Accept</button>
                      <button className="button-secondary button" type="button" disabled={busyId === a.id} onClick={() => setConfirmAction({ id: a.id, action: "decline" })}>Decline</button>
                    </>
                  )}
                  {a.status === "PENDING" && !doctor && (
                    <button type="button" className="text-button" disabled={busyId === a.id} onClick={() => setConfirmAction({ id: a.id, action: "cancel" })}>Cancel request</button>
                  )}
                  {a.status !== "PENDING" &&
                    a.status !== "COMPLETED" &&
                    safeGoogleMeetUrl(a.meeting_url) && (
                      <a
                        className="button-primary button"
                        href={safeGoogleMeetUrl(a.meeting_url)!}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {doctor ? "Start Meet" : "Join consultation"}
                      </a>
                    )}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h2>
            {query || dateFilter
              ? "No matching appointments"
              : view === "Requests" ? "No requests need a response" : `No ${view.toLowerCase()} appointments`}
          </h2>
          <p>
            {query || dateFilter
              ? "Try another patient, service, status, or date."
              : view === "Requests"
                ? "New patient booking requests will appear here."
                : view === "Past"
                ? "Completed and cancelled visits will appear here."
                : "Choose another date or request a consultation."}
          </p>
          {!doctor && view === "Upcoming" && !query && (
            <Link to="/patient/book" className="btn btn-primary">
              Book a consultation
            </Link>
          )}
        </div>
      )}
      {confirmAction && pendingAppointment && (
        <div className="action-dialog-backdrop" onClick={(event) => {
          if (event.target === event.currentTarget && !busyId) setConfirmAction(null);
        }}>
          <section ref={dialogRef} className="action-dialog" role="dialog" aria-modal="true" aria-labelledby="appointment-action-title" aria-describedby="appointment-action-description">
            <span className="eyebrow">APPOINTMENT REQUEST</span>
            <h2 id="appointment-action-title">
              {confirmAction.action === "accept" ? "Accept this appointment?" : confirmAction.action === "decline" ? "Decline this request?" : "Cancel your request?"}
            </h2>
            <p id="appointment-action-description">
              {confirmAction.action === "accept"
                ? `You are confirming ${pendingAppointment.service_name} with ${pendingAppointment.patient_name ?? "this patient"} for ${dateTime(pendingAppointment.starts_at)}. ${pendingAppointment.method.toLowerCase().includes("meet") ? "If Google Calendar is connected, the visit will also be added to the practice calendar." : "The patient will see the updated appointment status."}`
                : confirmAction.action === "decline"
                  ? `The patient will be notified that this ${pendingAppointment.service_name.toLowerCase()} request cannot be accepted.`
                  : `This will cancel the pending ${pendingAppointment.service_name.toLowerCase()} request. Contact the practice if you need help booking another time.`}
            </p>
            {actionError && <p className="form-error" role="alert">{actionError}</p>}
            <div className="action-dialog-actions">
              <button className="btn btn-secondary" type="button" disabled={Boolean(busyId)} onClick={() => setConfirmAction(null)} autoFocus>{confirmAction.action === "cancel" ? "Keep request" : "Go back"}</button>
              <button className={`btn ${confirmAction.action === "accept" ? "btn-primary" : "btn-destructive"}`} type="button" disabled={Boolean(busyId)} onClick={() => void confirmPendingAction()}>
                {busyId ? "Updating…" : confirmAction.action === "accept" ? "Accept appointment" : confirmAction.action === "decline" ? "Decline request" : "Cancel request"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
