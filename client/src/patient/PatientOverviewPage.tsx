import { ArrowRight, ArrowUpRight, CalendarDays, Clock3, FileText, Pill } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { dateTime, safeGoogleMeetUrl } from "../portal/format";
import { Status } from "../portal/PortalPrimitives";
import type { Appointment } from "../portal/types";
import { usePortalOverview } from "../portal/usePortalOverview";

const endedStatuses = new Set(["CANCELLED", "NO_SHOW", "COMPLETED"]);

function appointmentTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(value));
}

function clockTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { timeStyle: "short" }).format(new Date(value));
}

function upcomingAppointments(items: Appointment[]) {
  const now = Date.now();
  return items
    .filter((appointment) => new Date(appointment.starts_at).getTime() >= now && !endedStatuses.has(appointment.status))
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
    .slice(0, 3);
}

export default function PatientOverviewPage() {
  const { user } = useAuth();
  const { data, error, loading, retry } = usePortalOverview();
  const appointments = data?.appointments ?? [];
  const upcoming = upcomingAppointments(appointments);
  const nextAppointment = upcoming[0];
  const laterAppointments = upcoming.slice(1);
  const firstName = user?.fullName?.trim().split(/\s+/)[0];
  const dayPart = new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening";

  const destinations = [
    { key: "appointments", label: "Appointments", description: "Requests and visits", to: "/patient/appointments", icon: CalendarDays },
    { key: "reports", label: "Reports", description: "Documents you’ve shared", to: "/patient/reports", icon: FileText },
    { key: "prescriptions", label: "Prescriptions", description: "From your practice", to: "/patient/prescriptions", icon: Pill },
  ] as const;

  return (
    <main className="portal-content patient-dashboard">
      <header className="patient-dashboard-heading">
        <div>
          <h1>Good {dayPart}{firstName ? `, ${firstName}` : ""}</h1>
          <p>Your appointments and care information, together in one place.</p>
        </div>
        {nextAppointment && <Link className="patient-heading-action" to="/patient/book">
          Book another visit <ArrowRight size={16} aria-hidden="true" />
        </Link>}
      </header>

      <Status loading={loading} error={error} onRetry={retry}>
        {data && <div className="patient-dashboard-content">
          <section className="patient-next-visit" aria-labelledby="patient-next-visit-title">
            <div className="patient-next-visit-main">
              <div className="patient-next-visit-heading">
                <div className="patient-next-visit-icon"><CalendarDays size={19} aria-hidden="true" /></div>
                <div>
                  <p className="patient-section-kicker">Your next step</p>
                  <h2 id="patient-next-visit-title">{nextAppointment ? "Your next appointment" : "No appointment booked"}</h2>
                </div>
              </div>

              {nextAppointment ? <>
                <div className="patient-next-visit-details">
                  <h3>{nextAppointment.service_name}</h3>
                  <p>{nextAppointment.doctor_name ?? nextAppointment.doctorName ?? "Dr. Kiran"}</p>
                  <span className={`status-pill status-${nextAppointment.status.toLowerCase()}`}>
                    {nextAppointment.status.replaceAll("_", " ")}
                  </span>
                </div>
                <div className="patient-next-visit-footer">
                  <div className="patient-visit-time">
                    <Clock3 size={16} aria-hidden="true" />
                    <span>{dateTime(nextAppointment.starts_at)}</span>
                  </div>
                  <div className="patient-next-visit-actions">
                    <Link className="btn btn-primary" to={`/patient/appointments/${nextAppointment.id}`}>
                      View appointment <ArrowRight size={15} aria-hidden="true" />
                    </Link>
                    {safeGoogleMeetUrl(nextAppointment.meeting_url) && (
                      <a className="patient-meeting-link" href={safeGoogleMeetUrl(nextAppointment.meeting_url)!} target="_blank" rel="noreferrer">
                        Join Google Meet <ArrowUpRight size={14} aria-hidden="true" />
                      </a>
                    )}
                  </div>
                </div>
              </> : <div className="patient-next-visit-empty">
                <p>When you’re ready, choose a consultation that works for you. Your appointment details will appear here.</p>
                <Link className="btn btn-primary" to="/patient/book">
                  Explore appointments <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </div>}
            </div>
            <aside className="patient-next-visit-aside" aria-label="Appointment information">
              {nextAppointment ? <>
                <span className="patient-date-day">{new Intl.DateTimeFormat(undefined, { day: "2-digit" }).format(new Date(nextAppointment.starts_at))}</span>
                <span className="patient-date-month">{new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(new Date(nextAppointment.starts_at))}</span>
                <span className="patient-visit-method">{nextAppointment.method.replaceAll("_", " ")}</span>
              </> : <>
                <CalendarDays size={28} aria-hidden="true" />
                <span>Care, on your time</span>
              </>}
            </aside>
          </section>

          <section className="patient-care-section" aria-labelledby="patient-care-heading">
            <div className="patient-dashboard-section-heading">
              <div>
                <h2 id="patient-care-heading">Your care</h2>
                <p>Quick access to your practice information.</p>
              </div>
            </div>
            <div className="patient-care-links">
              {destinations.map(({ key, label, description, to, icon: Icon }) => (
                <Link className="patient-care-link" to={to} key={key}>
                  <span className="patient-care-icon"><Icon size={18} aria-hidden="true" /></span>
                  <span className="patient-care-copy">
                    <strong>{label}</strong>
                    <small>{description}</small>
                  </span>
                  <span className="patient-care-count">{data.counts[key] ?? 0}</span>
                  <ArrowUpRight className="patient-care-arrow" size={16} aria-hidden="true" />
                </Link>
              ))}
            </div>
          </section>

          <section className="patient-upcoming-panel" aria-labelledby="patient-upcoming-heading">
            <div className="patient-dashboard-section-heading patient-upcoming-heading">
              <div>
                <h2 id="patient-upcoming-heading">Upcoming appointments</h2>
                <p>Your confirmed and pending visits.</p>
              </div>
              <Link to="/patient/appointments">All appointments <ArrowRight size={15} aria-hidden="true" /></Link>
            </div>

            {laterAppointments.length ? <div className="patient-upcoming-list">
              {laterAppointments.map((appointment) => {
                const meetingUrl = safeGoogleMeetUrl(appointment.meeting_url);
                return <article className="patient-upcoming-item" key={appointment.id}>
                  <div className="patient-upcoming-date">
                    <strong>{new Intl.DateTimeFormat(undefined, { day: "2-digit" }).format(new Date(appointment.starts_at))}</strong>
                    <span>{new Intl.DateTimeFormat(undefined, { month: "short" }).format(new Date(appointment.starts_at))}</span>
                  </div>
                  <div className="patient-upcoming-info">
                    <span>{appointmentTime(appointment.starts_at)} · {clockTime(appointment.starts_at)}</span>
                    <h3>{appointment.service_name}</h3>
                    <p>{appointment.doctor_name ?? appointment.doctorName ?? "Dr. Kiran"} · {appointment.method.replaceAll("_", " ")}</p>
                  </div>
                  <span className={`status-pill status-${appointment.status.toLowerCase()}`}>
                    {appointment.status.replaceAll("_", " ")}
                  </span>
                  <div className="patient-upcoming-actions">
                    <Link to={`/patient/appointments/${appointment.id}`}>View details</Link>
                    {meetingUrl && <a href={meetingUrl} target="_blank" rel="noreferrer">Join Meet</a>}
                  </div>
                </article>;
              })}
            </div> : <div className="patient-upcoming-empty">
              <span className="patient-empty-icon"><CalendarDays size={19} aria-hidden="true" /></span>
              <div>
                <h3>{nextAppointment ? "You’re all set for now" : "No upcoming visits"}</h3>
                <p>{nextAppointment ? "Your next visit is shown above. Any additional appointments will appear here." : "Your booked appointments will appear here."}</p>
              </div>
            </div>}
          </section>
        </div>}
      </Status>
    </main>
  );
}
