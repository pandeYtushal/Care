import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { PageHeader } from "../portal/PortalPrimitives";
import { Select } from "../components/ui/select";

type CalendarAppointment = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  method: string;
  service_name: string;
  patient_name?: string;
  other_person?: string;
};
type ViewMode = "day" | "week" | "month";

function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}
function startOfWeek(date: Date): Date {
  const result = startOfDay(date);
  result.setDate(result.getDate() - ((result.getDay() + 6) % 7));
  return result;
}
function statusLabel(status: string): string {
  return status.toLowerCase().replaceAll("_", " ");
}
function timeLabel(value: string): string {
  return new Intl.DateTimeFormat(undefined, { timeStyle: "short" }).format(new Date(value));
}
function patientLabel(item: CalendarAppointment): string {
  return item.patient_name ?? item.other_person ?? "Appointment request";
}

export default function DoctorCalendarPage() {
  const [appointments, setAppointments] = useState<CalendarAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [mode, setMode] = useState<ViewMode>("week");
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    const from = mode === "month" ? new Date(anchor.getFullYear(), anchor.getMonth(), 1) : mode === "week" ? startOfWeek(anchor) : startOfDay(anchor);
    const to = new Date(from);
    if (mode === "month") to.setMonth(to.getMonth() + 1);
    else to.setDate(to.getDate() + (mode === "week" ? 7 : 1));
    const range = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
    api<{ appointments: CalendarAppointment[] }>(`/portal/appointments?${range.toString()}`)
      .then((result) => { if (alive) setAppointments(result.appointments); })
      .catch((reason: unknown) => {
        if (!alive) return;
        setError(reason instanceof ApiError ? reason.message : "Could not load the schedule. Check your connection and retry.");
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [anchor, mode, reload]);

  const rangeStart = useMemo(() => {
    if (mode === "month") return new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    return mode === "week" ? startOfWeek(anchor) : startOfDay(anchor);
  }, [anchor, mode]);
  const rangeEnd = useMemo(() => {
    const end = new Date(rangeStart);
    if (mode === "month") end.setMonth(end.getMonth() + 1);
    else end.setDate(end.getDate() + (mode === "week" ? 7 : 1));
    return end;
  }, [mode, rangeStart]);
  const filteredAppointments = useMemo(() => appointments
    .filter((item) => {
      const startsAt = new Date(item.starts_at);
      if (startsAt < rangeStart || startsAt >= rangeEnd) return false;
      if (statusFilter !== "ALL" && item.status !== statusFilter) return false;
      const searchText = `${patientLabel(item)} ${item.service_name} ${item.method}`.toLowerCase();
      return searchText.includes(query.trim().toLowerCase());
    })
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()),
  [appointments, query, rangeEnd, rangeStart, statusFilter]);
  const appointmentsByDay = useMemo(() => {
    const grouped = new Map<string, CalendarAppointment[]>();
    for (const item of filteredAppointments) {
      const key = localDateKey(new Date(item.starts_at));
      grouped.set(key, [...(grouped.get(key) ?? []), item]);
    }
    return grouped;
  }, [filteredAppointments]);

  const dateRangeLabel = mode === "day"
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "full" }).format(rangeStart)
    : mode === "week"
      ? `${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(rangeStart)} – ${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(rangeEnd.getTime() - 1))}`
      : new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(rangeStart);

  function move(direction: number) {
    const next = new Date(anchor);
    if (mode === "month") next.setMonth(next.getMonth() + direction);
    else next.setDate(next.getDate() + direction * (mode === "week" ? 7 : 1));
    setAnchor(startOfDay(next));
  }
  function goToday() { setAnchor(startOfDay(new Date())); }
  function selectMode(nextMode: ViewMode) { setMode(nextMode); }

  const monthCells = useMemo(() => {
    if (mode !== "month") return [];
    const firstWeekStart = startOfWeek(rangeStart);
    const lastDate = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), 0);
    const lastWeekEnd = startOfWeek(lastDate);
    lastWeekEnd.setDate(lastWeekEnd.getDate() + 6);
    const cells: Date[] = [];
    for (const date = new Date(firstWeekStart); date <= lastWeekEnd; date.setDate(date.getDate() + 1)) cells.push(new Date(date));
    return cells;
  }, [mode, rangeEnd, rangeStart]);

  return (
    <main className="portal-content calendar-page doctor-calendar-page">
      <PageHeader
        eyebrow="PRACTICE SCHEDULE"
        title="Calendar"
        description="Review appointments by day, week, or month. Select a visit to manage its details."
        actions={<Link className="btn btn-secondary" to="/doctor/availability">Manage availability</Link>}
      />

      <section className="calendar-toolbar" aria-label="Calendar controls">
        <div className="calendar-range-controls">
          <button type="button" className="btn btn-secondary" aria-label="Previous period" onClick={() => move(-1)}>←</button>
          <strong aria-live="polite">{dateRangeLabel}</strong>
          <button type="button" className="btn btn-secondary" aria-label="Next period" onClick={() => move(1)}>→</button>
          <button type="button" className="btn btn-secondary" onClick={goToday}>Today</button>
        </div>
        <div className="calendar-view-switch" role="group" aria-label="Calendar view">
          {(["day", "week", "month"] as const).map((option) => (
            <button type="button" aria-pressed={mode === option} className={mode === option ? "active" : ""} onClick={() => selectMode(option)} key={option}>
              {option[0].toUpperCase() + option.slice(1)}
            </button>
          ))}
        </div>
      </section>

      <section className="doctor-calendar-filters" aria-label="Filter appointments">
        <label>
          <span>Find a patient or visit</span>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search patient or service" />
        </label>
        <label>
          <span>Appointment status</span>
          <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="ALL">All statuses</option>
            <option value="PENDING">Needs response</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="UPCOMING">Upcoming</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="NO_SHOW">No show</option>
          </Select>
        </label>
      </section>

      <div className="calendar-legend" aria-label="Appointment status key">
        <span><i className="legend-pending" />Needs response</span>
        <span><i className="legend-confirmed" />Scheduled</span>
        <span><i className="legend-progress" />In progress</span>
        <span><i className="legend-completed" />Completed</span>
      </div>

      {loading ? <section className="empty-state" role="status">Loading your schedule…</section>
        : error ? <section className="empty-state empty-state-error" role="alert"><p>{error}</p><button className="btn btn-secondary" onClick={() => setReload((value) => value + 1)}><RefreshCw size={15} /> Try again</button></section>
          : mode === "month" ? (
            <div className="doctor-month-calendar" role="grid" aria-label={dateRangeLabel}>
              <div className="doctor-month-weekdays" role="row">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <div role="columnheader" key={day}>{day}</div>)}</div>
              <div className="doctor-month-days">
                {Array.from({ length: monthCells.length / 7 }, (_, weekIndex) => <div className="doctor-month-week" role="row" key={`week-${weekIndex}`}>
                {monthCells.slice(weekIndex * 7, weekIndex * 7 + 7).map((date) => {
                  const dateKey = localDateKey(date);
                  const dayAppointments = appointmentsByDay.get(dateKey) ?? [];
                  const inCurrentMonth = date.getMonth() === rangeStart.getMonth();
                  const isToday = dateKey === localDateKey(new Date());
                  return <section className={`doctor-month-day${inCurrentMonth ? "" : " is-outside"}${isToday ? " is-today" : ""}`} role="gridcell" key={dateKey}>
                    <button className="doctor-month-date" type="button" aria-label={`Show ${new Intl.DateTimeFormat(undefined, { dateStyle: "full" }).format(date)}`} onClick={() => { setAnchor(date); setMode("day"); }}>
                      <span>{date.getDate()}</span>{isToday && <small>Today</small>}
                    </button>
                    <div className="doctor-month-events">
                      {dayAppointments.slice(0, 3).map((item) => <Link className={`doctor-month-event status-${item.status.toLowerCase()}`} to={`/doctor/appointments/${item.id}`} key={item.id} aria-label={`${timeLabel(item.starts_at)}, ${patientLabel(item)}, ${statusLabel(item.status)}`} title={`${timeLabel(item.starts_at)} · ${patientLabel(item)} · ${statusLabel(item.status)}`}>
                        <time>{timeLabel(item.starts_at)}</time><span>{patientLabel(item)}</span><small>{statusLabel(item.status)}</small>
                      </Link>)}
                      {dayAppointments.length > 3 && <button className="doctor-month-more" type="button" onClick={() => { setAnchor(date); setMode("day"); }}>+{dayAppointments.length - 3} more</button>}
                    </div>
                  </section>;
                })}
                </div>)}
              </div>
            </div>
          ) : filteredAppointments.length ? (
            <div className="calendar-days">
              {[...appointmentsByDay.entries()].map(([dayKey, items]) => (
                <section className="calendar-day" key={dayKey}>
                  <div className="calendar-day-heading">
                    <h2>{new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date(`${dayKey}T12:00:00`))}</h2>
                    <span>{items.length} {items.length === 1 ? "visit" : "visits"}</span>
                  </div>
                  <div className="calendar-appointments">
                    {items.map((item) => {
                      const duration = Math.max(0, Math.round((new Date(item.ends_at).getTime() - new Date(item.starts_at).getTime()) / 60000));
                      return <article className={`calendar-appointment status-${item.status.toLowerCase()}`} key={item.id}>
                        <time>{timeLabel(item.starts_at)}<small>{duration} min</small></time>
                        <div><strong>{patientLabel(item)}</strong><p>{item.service_name} · {item.method.replaceAll("_", " ")}</p><span className="calendar-appointment-status">{statusLabel(item.status)}</span></div>
                        <Link to={`/doctor/appointments/${item.id}`}>Open visit</Link>
                      </article>;
                    })}
                  </div>
                </section>
              ))}
            </div>
          ) : <section className="empty-state"><h2>{query || statusFilter !== "ALL" ? "No matching visits" : mode === "day" ? "Nothing scheduled this day" : "Nothing scheduled this week"}</h2><p>{query || statusFilter !== "ALL" ? "Try another search or status filter." : "New appointment requests and confirmed visits will appear here."}</p></section>}
    </main>
  );
}
