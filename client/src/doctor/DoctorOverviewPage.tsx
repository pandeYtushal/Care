import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Users,
} from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { dateTime } from "../portal/format";
import { Status } from "../portal/PortalPrimitives";
import { nextActiveAppointment, usePortalOverview } from "../portal/usePortalOverview";

export default function DoctorOverviewPage() {
  const { user } = useAuth();
  const { data, error, loading, retry } = usePortalOverview();
  const appointments = data?.appointments ?? [];
  const nextAppointment = nextActiveAppointment(appointments);
  const pendingRequests = appointments.filter((appointment) => appointment.status === "PENDING");
  const todayAppointments = appointments.filter((appointment) => {
    const start = new Date(appointment.starts_at);
    return start.toDateString() === new Date().toDateString() && !["CANCELLED", "NO_SHOW"].includes(appointment.status);
  });
  const clinicianName = user?.fullName?.trim() || "Doctor";
  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 17 ? "Good afternoon" : "Good evening";

  return (
    <main className="portal-content doctor-dashboard">
      <header className="page-header doctor-welcome-heading">
        <div>
          <h1 className="greeting">{greeting}, {clinicianName}</h1>
          <p>Appointments, patient care, and requests in one workspace.</p>
        </div>
      </header>
      <Status loading={loading} error={error} onRetry={retry}>
        {data && <section className="doctor-dashboard-intro">
          <div className="doctor-dashboard-heading">
            <div>
              <span className="eyebrow">YOUR PRACTICE</span>
              <h2>Today at a glance</h2>
              <p>{new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date())}</p>
            </div>
            <Link to="/doctor/calendar" className="btn btn-secondary"><CalendarDays size={16} /> Open calendar</Link>
          </div>
          <div className="doctor-quick-stats">
            <article><span>Today&apos;s visits</span><strong>{data.counts.today ?? 0}</strong><small>Scheduled for today</small></article>
            <article><span>Needs response</span><strong>{data.counts.pending ?? 0}</strong><small>Booking requests</small></article>
            <article><span>Patients</span><strong>{data.counts.patients ?? 0}</strong><small>Seen at your practice</small></article>
            <article><span>Completed visits</span><strong>{data.counts.completed ?? 0}</strong><small>Recorded consultations</small></article>
          </div>
          <nav className="doctor-quick-actions" aria-label="Practice shortcuts">
            <Link to="/doctor/appointments"><CalendarDays size={16} aria-hidden="true" /> Review appointments</Link>
            <Link to="/doctor/patients"><Users size={16} aria-hidden="true" /> Find a patient</Link>
            <Link to="/doctor/availability"><Clock3 size={16} aria-hidden="true" /> Manage availability</Link>
            <Link to="/doctor/services"><ClipboardList size={16} aria-hidden="true" /> Consultation services</Link>
          </nav>
          <div className="doctor-focus-grid">
            <section className="doctor-focus-card doctor-requests-card">
              <div className="doctor-focus-title"><div><span className="eyebrow">NEEDS YOUR RESPONSE</span><h3>Booking requests</h3></div><Link to="/doctor/appointments">View all</Link></div>
              {pendingRequests.length ? <div className="doctor-request-list">
                {pendingRequests.slice(0, 3).map((request) => <article key={request.id}>
                  <div className="doctor-request-time"><Clock3 size={15} />{dateTime(request.starts_at)}</div>
                  <strong>{request.patient_name || "Patient"}</strong>
                  <p>{request.service_name} · {request.method.replaceAll("_", " ")}</p>
                  <div className="doctor-request-actions"><Link className="button-secondary button" to={`/doctor/appointments/${request.id}`}>Review request</Link></div>
                </article>)}
              </div> : <ClearState icon={<CheckCircle2 size={19} />} title="You’re all caught up" text="New booking requests will appear here." />}
            </section>
            <section className="doctor-focus-card doctor-next-card">
              <div className="doctor-focus-title"><div><span className="eyebrow">UP NEXT</span><h3>Next appointment</h3></div><CalendarDays size={20} /></div>
              {nextAppointment ? <>
                <div className="doctor-next-time">{dateTime(nextAppointment.starts_at)}</div>
                <strong className="doctor-next-patient">{nextAppointment.patient_name || "Patient"}</strong>
                <p>{nextAppointment.service_name} · {nextAppointment.method.replaceAll("_", " ")}</p>
                <div className="doctor-next-actions">
                  <Link to={`/doctor/appointments/${nextAppointment.id}`} className="btn btn-primary">Open consultation</Link>
                  {nextAppointment.patient_id && <Link to={`/doctor/patients/${nextAppointment.patient_id}`} className="button-secondary button">Patient record</Link>}
                </div>
              </> : <ClearState icon={<CalendarDays size={19} />} title="No upcoming appointments" text="Your schedule is clear for now." />}
            </section>
          </div>
          <section className="doctor-today-panel">
            <div className="doctor-focus-title"><div><span className="eyebrow">CLINICAL SCHEDULE</span><h3>Today&apos;s appointments</h3></div><Link to="/doctor/calendar">Open calendar</Link></div>
            {todayAppointments.length ? <div className="doctor-agenda">
              {[...todayAppointments].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()).map((appointment) => <article key={appointment.id}>
                <time>{new Intl.DateTimeFormat(undefined, { timeStyle: "short" }).format(new Date(appointment.starts_at))}</time>
                <span className="agenda-marker" />
                <div className="agenda-visit"><strong>{appointment.patient_name || "Patient"}</strong><p>{appointment.service_name} · {appointment.method.replaceAll("_", " ")}</p></div>
                <span className={`status-pill status-${appointment.status.toLowerCase()}`}>{appointment.status.replaceAll("_", " ")}</span>
                <Link className="button-secondary button" to={`/doctor/appointments/${appointment.id}`}>{appointment.status === "PENDING" ? "Review request" : "Open visit"}</Link>
              </article>)}
            </div> : <ClearState icon={<Clock3 size={19} />} title="No visits scheduled today" text="Use the calendar to review your upcoming schedule." />}
          </section>
        </section>}
      </Status>
    </main>
  );
}

function ClearState({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return <div className="doctor-clear-state">{icon}<div><strong>{title}</strong><p>{text}</p></div></div>;
}
