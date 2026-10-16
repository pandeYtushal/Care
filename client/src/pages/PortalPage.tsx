import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  Link,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  Settings,
  UserRound,
  Users,
  RefreshCw,
  Clock3,
  Bell,
  CreditCard,
  History,
  Search,
  MoreHorizontal,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { api, apiBaseUrl, ApiError } from "../lib/api";
import BookingPage from "../patient/BookingPage";

type Role = "PATIENT" | "DOCTOR";
type PortalNavLink = { to: string; title: string; icon: LucideIcon; exact?: boolean };
type Appointment = {
  id: string;
  patient_id?: string;
  starts_at: string;
  ends_at: string;
  status: string;
  method: string;
  meeting_url?: string | null;
  service_name: string;
  doctor_name?: string;
  doctorName?: string;
  other_person?: string;
  patient_name?: string;
};
type Rule = {
  id?: string;
  weekday: number;
  startsAt: string;
  endsAt: string;
  slotMinutes: number;
  bufferMinutes: number;
};
const patientLinkGroups: Array<{ title: string; links: PortalNavLink[] }> = [
  { title: "Your care", links: [
    { to: "/patient", title: "Overview", icon: LayoutDashboard, exact: true },
    { to: "/patient/book", title: "Book a consultation", icon: CalendarDays },
    { to: "/patient/appointments", title: "Appointments", icon: CalendarDays },
    { to: "/patient/history", title: "Care history", icon: History },
  ] },
  { title: "Health records", links: [
    { to: "/patient/reports", title: "Reports & documents", icon: FileText },
    { to: "/patient/prescriptions", title: "Prescriptions", icon: ClipboardList },
  ] },
  { title: "Activity", links: [
    { to: "/patient/payments", title: "Payment history", icon: CreditCard },
    { to: "/patient/notifications", title: "Notifications", icon: Bell },
  ] },
  { title: "Account", links: [
    { to: "/patient/profile", title: "Profile", icon: UserRound },
    { to: "/patient/account", title: "Account", icon: Settings },
  ] },
];
const doctorLinks: PortalNavLink[] = [
    { to: "/doctor", title: "Overview", icon: LayoutDashboard, exact: true },
    { to: "/doctor/calendar", title: "Calendar", icon: CalendarDays },
    { to: "/doctor/appointments", title: "Appointments", icon: CalendarDays },
    { to: "/doctor/patients", title: "Patients", icon: Users },
    { to: "/doctor/availability", title: "Availability", icon: Clock3 },
    { to: "/doctor/services", title: "Services", icon: ClipboardList },
    { to: "/doctor/prescriptions", title: "Prescriptions", icon: ClipboardList },
    { to: "/doctor/integrations", title: "Integrations", icon: Settings },
    { to: "/doctor/payments", title: "Payments", icon: CreditCard },
    { to: "/doctor/notifications", title: "Notifications", icon: Bell },
    { to: "/doctor/profile", title: "Profile", icon: UserRound },
    { to: "/doctor/account", title: "Account", icon: Settings },
  ];
const doctorLinkGroups: Array<{ title: string; links: PortalNavLink[] }> = [
  { title: "Today", links: doctorLinks.filter((link) => ["/doctor", "/doctor/calendar", "/doctor/appointments"].includes(link.to)) },
  { title: "Patient care", links: doctorLinks.filter((link) => ["/doctor/patients", "/doctor/prescriptions"].includes(link.to)) },
  { title: "Practice", links: doctorLinks.filter((link) => ["/doctor/availability", "/doctor/services", "/doctor/integrations", "/doctor/payments", "/doctor/notifications"].includes(link.to)) },
  { title: "Settings", links: doctorLinks.filter((link) => ["/doctor/profile", "/doctor/account"].includes(link.to)) },
];

export { BookingPage };

export function PortalLayout({ role }: { role: Role }) {
  const { user, signOut } = useAuth();
  const path = useLocation().pathname;
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const doctor = role === "DOCTOR";
  const renderNavLink = (link: PortalNavLink) => {
    const active = link.exact ? path === link.to : path === link.to || path.startsWith(`${link.to}/`);
    return <Link key={link.to} to={link.to} onClick={() => setMenuOpen(false)} className={`nav-item${active ? " active" : ""}`} aria-current={active ? "page" : undefined}>
      <link.icon size={17} aria-hidden="true" /><span>{link.title}</span>
    </Link>;
  };

  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    const focusable = () => Array.from(sidebarRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? []);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
      if (event.key === "Tab") {
        const items = focusable();
        if (!items.length) return;
        if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus(); }
        else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus(); }
      }
    };
    document.body.style.overflow = "hidden";
    sidebarRef.current?.querySelector<HTMLElement>('button[aria-label="Close navigation"]')?.focus();
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
      menuButtonRef.current?.focus();
    };
  }, [menuOpen]);

  async function logout() {
    setLogoutError("");
    try {
      await signOut();
      navigate("/login", { replace: true });
    } catch {
      setLogoutError("Could not sign out.");
    }
  }

  return (
    <div className={`portal-layout ${doctor ? "doctor-workspace" : "patient-portal"}`}>
      <button className={`portal-sidebar-backdrop${menuOpen ? " is-visible" : ""}`} type="button" aria-label="Close navigation" tabIndex={menuOpen ? 0 : -1} onClick={() => setMenuOpen(false)} />
      <aside ref={sidebarRef} id="portal-navigation" className={`portal-sidebar${menuOpen ? " portal-sidebar-open" : ""}`} aria-label={`${doctor ? "Clinician" : "Patient"} navigation`}>
        <div className="sidebar-header">
          <Link to={doctor ? "/doctor" : "/patient"} className="portal-brand" onClick={() => setMenuOpen(false)}>
            <span className="portal-brand-mark"><HeartPulse size={18} aria-hidden="true" /></span>
            <span><strong>Dr. Kiran</strong><small>{doctor ? "Clinical workspace" : "Patient care"}</small></span>
          </Link>
          <button className="portal-close-button" type="button" aria-label="Close navigation" onClick={() => setMenuOpen(false)}><X size={18} /></button>
        </div>

        <nav className="sidebar-nav" aria-label="Workspace">
          {doctor ? doctorLinkGroups.map((group) => <div className="doctor-nav-group" key={group.title}>
            <p className="doctor-nav-group-title">{group.title}</p>
            {group.links.map(renderNavLink)}
          </div>) : patientLinkGroups.map((group) => <div className="patient-nav-group" key={group.title}>
            <p className="nav-group-label">{group.title}</p>
            {group.links.map(renderNavLink)}
          </div>)}
        </nav>

        <div className="sidebar-footer">
          {logoutError && <p className="portal-logout-error" role="alert">{logoutError}</p>}
          <Link to={`/${doctor ? "doctor" : "patient"}/profile`} onClick={() => setMenuOpen(false)} className="user-profile-button">
            <span className="user-avatar">{(user?.fullName ?? user?.email ?? "U").slice(0, 1).toUpperCase()}</span>
            <span className="user-info"><strong>{user?.fullName ?? user?.email}</strong><span>{doctor ? "Clinician" : "Patient"}</span></span>
          </Link>
          <button onClick={() => void logout()} className="portal-logout" type="button"><LogOut size={16} aria-hidden="true" /> Sign out</button>
        </div>
      </aside>

      <main className="portal-main">
        <header className="portal-topbar">
          <div className="portal-topbar__identity">
            <button ref={menuButtonRef} className="portal-menu-button" type="button" aria-label="Open navigation" aria-expanded={menuOpen} aria-controls="portal-navigation" onClick={() => setMenuOpen(true)}><Menu size={20} /></button>
            <span>{doctor ? "Clinical workspace" : "Patient portal"}</span>
          </div>
          <Link to={`/${doctor ? "doctor" : "patient"}/notifications`} className="portal-notifications" aria-label="Notifications"><Bell size={18} /></Link>
        </header>
        <div className="portal-scroll-area"><Outlet /></div>
      </main>
    </div>
  );
}

function dateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Time unavailable"
    : new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
}
function safeGoogleMeetUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "meet.google.com" && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
function useResource<T>(path: string, field: string) {
  const [data, setData] = useState<T[] | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [reload, setReload] = useState(0);
  useEffect(() => {
    let alive = true;
    setError("");
    if (!path) {
      setData([]);
      setLoading(false);
      return () => {
        alive = false;
      };
    }
    setLoading(true);
    api<Record<string, T[]>>(path)
      .then((r) => {
        if (alive) setData(r[field] ?? []);
      })
      .catch((e) => {
        if (alive)
          setError(
            e instanceof ApiError
              ? e.message
              : "Could not load this information. Check your connection and retry.",
          );
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [path, field, reload]);
  return { data, error, loading, retry: () => setReload((x) => x + 1) };
}
function Status({
  loading,
  error,
  onRetry,
  children,
}: {
  loading: boolean;
  error: string;
  onRetry: () => void;
  children: React.ReactNode;
}) {
  if (loading)
    return (
      <section className="empty-state" role="status">
        Loading secure clinic information…
      </section>
    );
  if (error)
    return (
      <section className="empty-state empty-state-error" role="alert">
        <p>{error}</p>
        <button className="btn btn-secondary" onClick={onRetry}>
          <RefreshCw size={15} /> Try again
        </button>
      </section>
    );
  return <>{children}</>;
}
function AppointmentRows({
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
    [view, setView] = useState<"Upcoming" | "Today" | "Past">("Upcoming"),
    [query, setQuery] = useState("");
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
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const focusable = () => Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    );
    focusable()[0]?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !actionBusy.current) setConfirmAction(null);
      if (event.key === "Tab") {
        const controls = focusable();
        if (!controls.length) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
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
  const visible = items.filter((a) => {
    const at = new Date(a.starts_at).getTime(),
      terminal = ["CANCELLED", "NO_SHOW", "COMPLETED"].includes(a.status);
    const belongs =
      view === "Today"
        ? isToday(a.starts_at) && !terminal
        : view === "Past"
          ? at < Date.now() || terminal
          : at >= Date.now() && !terminal;
    const target =
      `${a.other_person ?? a.patient_name ?? ""} ${a.service_name} ${a.status} ${a.method}`.toLowerCase();
    return belongs && target.includes(query.trim().toLowerCase());
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
          {(["Upcoming", "Today", "Past"] as const).map((name) => (
            <button
              type="button"
              aria-pressed={view === name}
              className={view === name ? "active" : ""}
              key={name}
              onClick={() => setView(name)}
            >
              {name}
              <span>
                {name === "Today"
                  ? items.filter(
                    (a) =>
                      isToday(a.starts_at) &&
                      !["CANCELLED", "NO_SHOW", "COMPLETED"].includes(
                        a.status,
                      ),
                  ).length
                  : name === "Past"
                    ? items.filter(
                      (a) =>
                        new Date(a.starts_at).getTime() < Date.now() ||
                        ["CANCELLED", "NO_SHOW", "COMPLETED"].includes(
                          a.status,
                        ),
                    ).length
                    : items.filter(
                      (a) =>
                        new Date(a.starts_at).getTime() >= Date.now() &&
                        !["CANCELLED", "NO_SHOW", "COMPLETED"].includes(
                          a.status,
                        ),
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
                      {doctor && a.patient_name && a.patient_id ? (
                        <Link to={`/doctor/patients/${a.patient_id}`}>
                          {a.patient_name}
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
                      <button
                        className="button-primary button"
                        type="button"
                        disabled={busyId === a.id}
                        onClick={() => setConfirmAction({ id: a.id, action: "accept" })}
                      >
                        Accept
                      </button>
                      <button
                        className="button-secondary button"
                        type="button"
                        disabled={busyId === a.id}
                        onClick={() => setConfirmAction({ id: a.id, action: "decline" })}
                      >
                        Decline
                      </button>
                    </>
                  )}
                  {a.status === "PENDING" && !doctor && (
                    <button
                      type="button"
                      className="text-button"
                      disabled={busyId === a.id}
                      onClick={() => setConfirmAction({ id: a.id, action: "cancel" })}
                    >
                      Cancel request
                    </button>
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
            {query
              ? "No matching appointments"
              : `No ${view.toLowerCase()} appointments`}
          </h2>
          <p>
            {query
              ? "Try a different patient, service, or status."
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
        <div
          className="action-dialog-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget && !busyId) setConfirmAction(null);
          }}
        >
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
              <button className="btn btn-secondary" type="button" disabled={Boolean(busyId)} onClick={() => setConfirmAction(null)} autoFocus>
                {confirmAction.action === "cancel" ? "Keep request" : "Go back"}
              </button>
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
export function PortalHome({ role }: { role: Role }) {
  const doctor = role === "DOCTOR";
  const { user } = useAuth();
  const [data, setData] = useState<{
    appointments: Appointment[];
    counts: Record<string, string | number>;
  } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    api<{
      appointments: Appointment[];
      counts: Record<string, string | number>;
    }>("/portal/overview")
      .then((x) => {
        if (alive) {
          setData(x);
          setError("");
        }
      })
      .catch((e) => {
        if (alive)
          setError(
            e instanceof ApiError ? e.message : "Could not load your overview.",
          );
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [reload]);

  const nextAppt = data?.appointments?.find(
    (appointment) =>
      new Date(appointment.starts_at).getTime() >= Date.now() &&
      !["CANCELLED", "NO_SHOW", "COMPLETED"].includes(appointment.status),
  );
  const pendingRequests =
    data?.appointments?.filter(
      (appointment) => appointment.status === "PENDING",
    ) ?? [];
  const todayAppointments =
    data?.appointments?.filter((appointment) => {
      const start = new Date(appointment.starts_at);
      return (
        start.toDateString() === new Date().toDateString() &&
        !["CANCELLED", "NO_SHOW"].includes(appointment.status)
      );
    }) ?? [];
  const patientFirstName = user?.fullName?.trim().split(/\s+/)[0] || "there";
  const dayPart = new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening";

  return (
    <main className={`portal-content ${doctor ? "doctor-dashboard" : "patient-dashboard"}`}>
      <div className="page-header">
        {doctor ? (
          <div className="greeting">{`${new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 17 ? "Good afternoon" : "Good evening"}, Dr. Kiran`}</div>
        ) : (
          <>
            <span className="eyebrow patient-welcome-eyebrow">A LITTLE SPACE FOR YOUR HEALTH</span>
            <h1>Good {dayPart}, {patientFirstName}</h1>
          </>
        )}
        <p>{doctor ? "Today's appointments and workspace overview." : "Appointments, reports and prescriptions connected to your care."}</p>
      </div>
      <Status
        loading={loading}
        error={error}
        onRetry={() => setReload((x) => x + 1)}
      >
        {data && (
          <>
            {doctor ? (
              <section className="doctor-dashboard-intro">
                <div className="doctor-dashboard-heading">
                  <div>
                    <span className="eyebrow">YOUR PRACTICE</span>
                    <h2>Today at a glance</h2>
                    <p>
                      {new Intl.DateTimeFormat(undefined, {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                      }).format(new Date())}{" "}
                      · Your clinical day, in one place.
                    </p>
                  </div>
                  <Link to="/doctor/calendar" className="btn btn-secondary">
                    <CalendarDays size={16} /> Open calendar
                  </Link>
                </div>
                <div className="doctor-quick-stats">
                  <article>
                    <span>Today’s visits</span>
                    <strong>{data.counts.today ?? 0}</strong>
                    <small>Scheduled for today</small>
                  </article>
                  <article>
                    <span>Patients</span>
                    <strong>{data.counts.patients ?? 0}</strong>
                    <small>In your practice</small>
                  </article>
                  <article>
                    <span>Completed visits</span>
                    <strong>{data.counts.completed ?? 0}</strong>
                    <small>Recorded consultations</small>
                  </article>
                </div>
                <div className="doctor-focus-grid">
                  <section className="doctor-focus-card doctor-requests-card">
                    <div className="doctor-focus-title">
                      <div>
                        <span className="eyebrow">NEEDS YOUR RESPONSE</span>
                        <h3>Booking requests</h3>
                      </div>
                      <Link to="/doctor/appointments">View all</Link>
                    </div>
                    {pendingRequests.length ? (
                      <div className="doctor-request-list">
                        {pendingRequests.slice(0, 3).map((request) => (
                          <article key={request.id}>
                            <div className="doctor-request-time">
                              <Clock3 size={15} />
                              {dateTime(request.starts_at)}
                            </div>
                            <strong>{request.patient_name || "Patient"}</strong>
                            <p>
                              {request.service_name} ·{" "}
                              {request.method.replaceAll("_", " ")}
                            </p>
                            <div className="doctor-request-actions">
                              <Link
                                className="button-secondary button"
                                to={`/doctor/appointments/${request.id}`}
                              >
                                Review request
                              </Link>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="doctor-clear-state">
                        <CheckCircle2 size={19} />
                        <div>
                          <strong>You’re all caught up</strong>
                          <p>New booking requests will appear here.</p>
                        </div>
                      </div>
                    )}
                  </section>
                  <section className="doctor-focus-card doctor-next-card">
                    <div className="doctor-focus-title">
                      <div>
                        <span className="eyebrow">UP NEXT</span>
                        <h3>Next appointment</h3>
                      </div>
                      <CalendarDays size={20} />
                    </div>
                    {nextAppt ? (
                      <>
                        <div className="doctor-next-time">
                          {dateTime(nextAppt.starts_at)}
                        </div>
                        <strong className="doctor-next-patient">
                          {nextAppt.patient_name || "Patient"}
                        </strong>
                        <p>
                          {nextAppt.service_name} ·{" "}
                          {nextAppt.method.replaceAll("_", " ")}
                        </p>
                        <div className="doctor-next-actions">
                          <Link
                            to={`/doctor/appointments/${nextAppt.id}`}
                            className="btn btn-primary"
                          >
                            Open consultation
                          </Link>
                          {nextAppt.patient_id && (
                            <Link
                              to={`/doctor/patients/${nextAppt.patient_id}`}
                              className="button-secondary button"
                            >
                              Patient record
                            </Link>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="doctor-clear-state">
                        <CalendarDays size={19} />
                        <div>
                          <strong>No upcoming appointments</strong>
                          <p>Your schedule is clear for now.</p>
                        </div>
                      </div>
                    )}
                  </section>
                </div>
                <section className="doctor-today-panel">
                  <div className="doctor-focus-title">
                    <div>
                      <span className="eyebrow">CLINICAL SCHEDULE</span>
                      <h3>Today’s appointments</h3>
                    </div>
                    <Link to="/doctor/calendar">Open calendar</Link>
                  </div>
                  {todayAppointments.length ? (
                    <div className="doctor-agenda">
                      {[...todayAppointments]
                        .sort(
                          (a, b) =>
                            new Date(a.starts_at).getTime() -
                            new Date(b.starts_at).getTime(),
                        )
                        .map((appointment) => (
                          <article key={appointment.id}>
                            <time>
                              {new Intl.DateTimeFormat(undefined, {
                                timeStyle: "short",
                              }).format(new Date(appointment.starts_at))}
                            </time>
                            <span className="agenda-marker" />
                            <div className="agenda-visit">
                              <strong>
                                {appointment.patient_name || "Patient"}
                              </strong>
                              <p>
                                {appointment.service_name} ·{" "}
                                {appointment.method.replaceAll("_", " ")}
                              </p>
                            </div>
                            <span
                              className={`status-pill status-${appointment.status.toLowerCase()}`}
                            >
                              {appointment.status.replaceAll("_", " ")}
                            </span>
                            <Link
                              className="button-secondary button"
                              to={`/doctor/appointments/${appointment.id}`}
                            >
                              Open
                            </Link>
                          </article>
                        ))}
                    </div>
                  ) : (
                    <div className="doctor-clear-state">
                      <Clock3 size={19} />
                      <div>
                        <strong>No visits scheduled today</strong>
                        <p>
                          Use the calendar to review your upcoming schedule.
                        </p>
                      </div>
                    </div>
                  )}
                </section>
              </section>
            ) : (
              <section className="next-step-card">
                <h3>{nextAppt?.status === "PENDING" ? "REQUEST STATUS" : "YOUR NEXT STEP"}</h3>
                {nextAppt ? (
                  <div className="content">
                    <h2 className="next-step-title">{nextAppt.status === "PENDING" ? "Request awaiting a response" : "Next appointment"}</h2>
                    <p className="next-step-subtitle">{nextAppt.doctor_name ?? nextAppt.doctorName ?? "Dr. Kiran"}</p>
                    <span className={`status-pill status-${nextAppt.status.toLowerCase()}`}>{nextAppt.status.replaceAll("_", " ")}</span>
                    <div className="appointment-details">
                      <div className="next-step-info">
                        <div>
                          <div className="next-step-time">
                            {dateTime(nextAppt.starts_at)}
                          </div>
                          <div className="next-step-service">
                            {nextAppt.service_name} ·{" "}
                            {nextAppt.method.replaceAll("_", " ")}
                          </div>
                        </div>
                        <div className="next-step-actions">
                          <Link
                            to={`/patient/appointments/${nextAppt.id}`}
                            className="btn btn-secondary"
                          >
                            View appointment
                          </Link>
                          {safeGoogleMeetUrl(nextAppt.meeting_url) && (
                            <a
                              href={safeGoogleMeetUrl(nextAppt.meeting_url)!}
                              target="_blank"
                              rel="noreferrer"
                              className="btn btn-primary patient-action-light"
                            >
                              Join Meet
                            </a>
                          )}
                          <Link
                            to="/patient/book"
                            className="btn btn-secondary patient-action-outline"
                          >
                            Book another visit
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="content">
                    <h2 className="next-step-title">Nothing scheduled yet</h2>
                    <p className="next-step-subtitle" style={{ marginBottom: '24px' }}>
                      When you book a consultation with Dr. Kiran, your appointment details and joining information will appear here.
                    </p>
                    <Link
                      to="/patient/book"
                      className="btn btn-primary patient-action-light"
                    >
                      Book a consultation
                    </Link>
                  </div>
                )}
              </section>
            )}

            {!doctor && (
              <div className="patient-care-links" aria-label="Your care records">
                {([
                  ["appointments", "Appointments", "/patient/appointments"],
                  ["reports", "Reports", "/patient/reports"],
                  ["prescriptions", "Prescriptions", "/patient/prescriptions"],
                ] as const).map(([key, label, to]) => (
                  <Link className="patient-care-link" to={to} key={key}>
                    <span>{label}</span>
                    <strong>{data.counts[key] ?? 0}</strong>
                    <small>{key === "appointments" ? "All visits" : key === "reports" ? "Shared documents" : "Issued by the practice"}</small>
                  </Link>
                ))}
              </div>
            )}

            {!doctor && (
              <section
                className="card patient-upcoming-panel"
                style={{ padding: "0", overflow: "hidden" }}
              >
                <div
                  style={{
                    padding: "24px",
                    borderBottom: "1px solid var(--color-border)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <h2
                      style={{
                        fontSize: "18px",
                        fontWeight: 600,
                        fontFamily: "var(--font-sans)",
                      }}
                    >
                      {doctor
                        ? "Needs attention / Upcoming"
                        : "Upcoming appointments"}
                    </h2>
                    <p
                      style={{
                        fontSize: "13px",
                        color: "var(--color-ink-muted)",
                        marginTop: "4px",
                      }}
                    >
                      {doctor
                        ? "Recent requests and upcoming consultations."
                        : "Your scheduled consultations."}
                    </p>
                  </div>
                  <Link
                    to={
                      doctor ? "/doctor/appointments" : "/patient/appointments"
                    }
                    style={{ fontSize: "14px", fontWeight: 500 }}
                  >
                    See all
                  </Link>
                </div>
                <div style={{ padding: "24px" }}>
                  <AppointmentRows
                    items={data.appointments.slice(0, 3)}
                    doctor={doctor}
                    onChanged={() => setReload((x) => x + 1)}
                  />
                </div>
              </section>
            )}
          </>
        )}
      </Status>
    </main>
  );
}

function CalendarPage() {
  const resource = useResource<Appointment>(
    "/portal/appointments",
    "appointments",
  );
  const [mode, setMode] = useState<"day" | "week">("week");
  const [anchor, setAnchor] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const from = new Date(anchor);
  if (mode === "week") {
    const weekday = (from.getDay() + 6) % 7;
    from.setDate(from.getDate() - weekday);
  }
  const to = new Date(from);
  to.setDate(to.getDate() + (mode === "week" ? 7 : 1));
  const appointments = (resource.data ?? [])
    .filter((a) => {
      const date = new Date(a.starts_at);
      return date >= from && date < to;
    })
    .sort(
      (a, b) =>
        new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
    );
  const days = new Map<string, Appointment[]>();
  for (const item of appointments) {
    const key = new Intl.DateTimeFormat(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    }).format(new Date(item.starts_at));
    days.set(key, [...(days.get(key) ?? []), item]);
  }
  function move(direction: number) {
    const next = new Date(anchor);
    next.setDate(next.getDate() + direction * (mode === "week" ? 7 : 1));
    setAnchor(next);
  }
  function setWindow(next: "day" | "week") {
    setMode(next);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setAnchor(today);
  }
  const rangeLabel =
    mode === "day"
      ? new Intl.DateTimeFormat(undefined, { dateStyle: "full" }).format(from)
      : `${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(from)} – ${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(to.getTime() - 1))}`;
  return (
    <main className="portal-content calendar-page">
      <div className="eyebrow">PRACTICE SCHEDULE</div>
      <h1>Calendar</h1>
      <p className="page-subtitle">
        A focused view of requests and consultations on your schedule.
      </p>
      <Status
        loading={resource.loading}
        error={resource.error}
        onRetry={resource.retry}
      >
        <section className="calendar-toolbar">
          <div className="calendar-range-controls">
            <button
              type="button"
              className="btn btn-secondary"
              aria-label="Previous period"
              onClick={() => move(-1)}
            >
              ←
            </button>
            <strong>{rangeLabel}</strong>
            <button
              type="button"
              className="btn btn-secondary"
              aria-label="Next period"
              onClick={() => move(1)}
            >
              →
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                const d = new Date();
                d.setHours(0, 0, 0, 0);
                setAnchor(d);
              }}
            >
              Today
            </button>
          </div>
          <div
            className="calendar-view-switch"
            role="tablist"
            aria-label="Calendar view"
          >
            {(["day", "week"] as const).map((option) => (
              <button
                type="button"
                role="tab"
                aria-selected={mode === option}
                className={mode === option ? "active" : ""}
                onClick={() => setWindow(option)}
                key={option}
              >
                {option === "day" ? "Day" : "Week"}
              </button>
            ))}
          </div>
        </section>
        <div className="calendar-legend">
          <span>
            <i className="legend-pending" />
            Needs response
          </span>
          <span>
            <i className="legend-confirmed" />
            Scheduled
          </span>
          <span>
            <i className="legend-progress" />
            In progress
          </span>
        </div>
        {days.size ? (
          <div className="calendar-days">
            {[...days.entries()].map(([day, items]) => (
              <section className="calendar-day" key={day}>
                <div className="calendar-day-heading">
                  <h2>{day}</h2>
                  <span>
                    {items.length} {items.length === 1 ? "visit" : "visits"}
                  </span>
                </div>
                <div className="calendar-appointments">
                  {items.map((a) => (
                    <article
                      className={`calendar-appointment status-${a.status.toLowerCase()}`}
                      key={a.id}
                    >
                      <time>
                        {new Intl.DateTimeFormat(undefined, {
                          timeStyle: "short",
                        }).format(new Date(a.starts_at))}
                      </time>
                      <div>
                        <strong>
                          {a.patient_name ?? "Appointment request"}
                        </strong>
                        <p>
                          {a.service_name} · {a.method.replaceAll("_", " ")}
                        </p>
                        <span className="calendar-appointment-status">
                          {a.status.replaceAll("_", " ")}
                        </span>
                      </div>
                      <Link to={`/doctor/appointments/${a.id}`}>Open</Link>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <Empty
            title={
              mode === "day"
                ? "Nothing scheduled this day"
                : "Nothing scheduled this week"
            }
            text="New appointment requests and confirmed visits will appear here."
          />
        )}
      </Status>
    </main>
  );
}
function CareHistoryPage() {
  const [data, setData] = useState<{
    appointments: Appointment[];
    records: Record<string, unknown>[];
    prescriptions: Record<string, unknown>[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [partialError, setPartialError] = useState("");

  const [reload, setReload] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.allSettled([
      api<{ appointments: Appointment[] }>("/portal/appointments"),
      api<{ records: Record<string, unknown>[] }>("/portal/records"),
      api<{ prescriptions: Record<string, unknown>[] }>(
        "/portal/prescriptions",
      ),
    ] as const)
      .then(([appointmentsResult, recordsResult, prescriptionsResult]) => {
        if (!alive) return;
        const fulfilled = [appointmentsResult, recordsResult, prescriptionsResult]
          .filter((result) => result.status === "fulfilled").length;
        if (!fulfilled) {
          setError("Could not load your care history. Check your connection and try again.");
          setPartialError("");
          return;
        }
        setData({
          appointments: appointmentsResult.status === "fulfilled" ? appointmentsResult.value.appointments || [] : [],
          records: recordsResult.status === "fulfilled" ? recordsResult.value.records || [] : [],
          prescriptions: prescriptionsResult.status === "fulfilled" ? prescriptionsResult.value.prescriptions || [] : [],
        });
        setError("");
        setPartialError(fulfilled < 3 ? "Some parts of your care history could not be loaded." : "");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [reload]);

  let timeline: {
    id: string;
    date: number;
    type: string;
    title: string;
    subtitle: string;
    link?: string;
  }[] = [];
  if (data) {
    data.appointments.forEach((a) =>
      timeline.push({
        id: `app-${a.id}`,
        date: new Date(a.starts_at).getTime(),
        type: "Consultation",
        title: `${a.service_name} ${a.status.replaceAll("_", " ").toLowerCase()}`,
        subtitle: dateTime(a.starts_at),
        link: `/patient/appointments/${a.id}`,
      }),
    );
    data.records.forEach((r) =>
      timeline.push({
        id: `rec-${r.id}`,
        date: new Date(String(r.created_at)).getTime(),
        type: "Report",
        title: `Report uploaded: ${r.original_filename}`,
        subtitle: dateTime(String(r.created_at)),
        link: `${apiBaseUrl}/api/portal/records/${encodeURIComponent(String(r.id))}/download?view=1`,
      }),
    );
    data.prescriptions.forEach((p) =>
      timeline.push({
        id: `pre-${p.id}`,
        date: new Date(String(p.issued_at)).getTime(),
        type: "Prescription",
        title: `Prescription issued by ${p.doctor_name || "Dr. Kiran"}`,
        subtitle: dateTime(String(p.issued_at)),
        link: `/patient/prescriptions`,
      }),
    );
    timeline.sort((a, b) => b.date - a.date);
  }

  return (
    <main className="portal-content">
      <div className="page-header">
        <h1 className="greeting">Care history</h1>
        <p>A timeline of your consultations, reports, and prescriptions.</p>
      </div>
      <Status
        loading={loading}
        error={error}
        onRetry={() => setReload((x) => x + 1)}
      >
        {partialError && <div className="patient-partial-warning" role="status">
          <span>{partialError}</span>
          <button type="button" className="text-button" onClick={() => setReload((x) => x + 1)}>Retry</button>
        </div>}
        {timeline.length ? (
          <div className="card" style={{ padding: "32px" }}>
            <div className="timeline">
              {timeline.map((item) => (
                <div className="timeline-item" key={item.id}>
                  <div className="timeline-date">{item.subtitle}</div>
                  <div className="timeline-content">
                    <strong
                      style={{
                        display: "block",
                        marginBottom: "4px",
                        fontSize: "15px",
                      }}
                    >
                      {item.title}
                    </strong>
                    {item.link &&
                      (item.type === "Report" ? (
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: "13px" }}
                        >
                          See report
                        </a>
                      ) : (
                        <Link to={item.link} style={{ fontSize: "13px" }}>
                          View details
                        </Link>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : partialError ? (
          <Empty title="Care history is incomplete" text="The information we could load is empty. Retry to check for the remaining records." />
        ) : (
          <div className="empty-state">
            <div className="icon">
              <History size={24} />
            </div>
            <h3>No recent activity</h3>
            <p>
              Your consultations, reports and prescriptions will appear here as
              your care progresses.
            </p>
          </div>
        )}
      </Status>
    </main>
  );
}

export function PortalSection({ title, role }: { title: string; role: Role }) {
  const path = useLocation().pathname;
  const dataPath = path.endsWith("/appointments")
    ? "/portal/appointments"
    : path.endsWith("/reports")
      ? "/portal/records"
      : path.endsWith("/prescriptions")
        ? "/portal/prescriptions"
        : path.endsWith("/patients")
          ? "/portal/patients"
          : path.endsWith("/payments")
            ? "/portal/payments"
            : path.endsWith("/notifications")
              ? "/portal/notifications"
              : "";
  const field = path.endsWith("/appointments")
    ? "appointments"
    : path.endsWith("/reports")
      ? "records"
      : path.endsWith("/prescriptions")
        ? "prescriptions"
        : path.endsWith("/payments")
          ? "payments"
          : path.endsWith("/notifications")
            ? "notifications"
            : "patients";
  const resource = useResource<Record<string, unknown>>(dataPath, field);

  if (path.endsWith("/history")) return <CareHistoryPage />;
  if (path.endsWith("/profile")) return <ProfilePage role={role} />;
  if (path.endsWith("/calendar")) return <CalendarPage />;
  if (path.endsWith("/availability")) return <AvailabilityPage />;
  if (path.endsWith("/book")) return <BookingPage />;
  if (path.endsWith("/integrations")) return <IntegrationsPage />;
  if (path.endsWith("/services")) return <ServicesPage />;
  if (path.endsWith("/notifications"))
    return (
      <NotificationsPage
        notifications={(resource.data ?? []) as Record<string, unknown>[]}
        loading={resource.loading}
        error={resource.error}
        retry={resource.retry}
      />
    );
  if (path.endsWith("/payments"))
    return (
      <PaymentsPage
        payments={(resource.data ?? []) as Record<string, unknown>[]}
        loading={resource.loading}
        error={resource.error}
        retry={resource.retry}
        role={role}
      />
    );
  if (path.endsWith("/reports") && role === "PATIENT")
    return (
      <PatientReportsPage
        records={(resource.data ?? []) as Record<string, unknown>[]}
        loading={resource.loading}
        error={resource.error}
        retry={resource.retry}
      />
    );

  return (
    <main className="portal-content">
      <div className="page-header">
        <h1 className="greeting">{title}</h1>
        <p>
          {path.endsWith("/appointments")
            ? "Review appointment details associated with your account."
            : path.endsWith("/patients")
              ? "Patients with appointments at your practice."
              : path.endsWith("/reports")
                ? "Private reports associated with your care."
                : path.endsWith("/prescriptions")
                  ? "Prescriptions issued for your consultations."
                  : ""}
        </p>
      </div>
      <Status
        loading={resource.loading}
        error={resource.error}
        onRetry={resource.retry}
      >
        <div className="card" style={{ padding: "0", overflow: "hidden" }}>
          {path.endsWith("/appointments") ? (
            <AppointmentRows
              items={(resource.data ?? []) as unknown as Appointment[]}
              doctor={role === "DOCTOR"}
              onChanged={resource.retry}
            />
          ) : path.endsWith("/patients") ? (
            <PatientList patients={resource.data ?? []} />
          ) : path.endsWith("/reports") ? (
            <div style={{ padding: "24px" }}>
              <RecordList records={resource.data ?? []} />
            </div>
          ) : (
            <div style={{ padding: "24px" }}>
              <PrescriptionList prescriptions={resource.data ?? []} />
            </div>
          )}
        </div>
      </Status>
    </main>
  );
}

function PatientList({ patients }: { patients: Record<string, unknown>[] }) {
  const [query, setQuery] = useState("");
  if (!patients.length)
    return (
      <Empty
        title="No patient records yet"
        text="Patients with appointments at your practice will appear here."
      />
    );
  const filtered = patients.filter((p) =>
    `${p.full_name ?? ""} ${p.email ?? ""} ${p.phone ?? ""}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  return (
    <>
      <label className="list-search patient-search">
        <Search size={16} />
        <span className="sr-only">Search patients</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search patients by name, email, or phone"
        />
        <span>
          {filtered.length} {filtered.length === 1 ? "patient" : "patients"}
        </span>
      </label>
      {filtered.length ? (
        <div className="data-table-wrap patient-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Appointments</th>
                <th>Last visit</th>
                <th>Patient record</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={String(p.id)}>
                  <td data-label="Patient">
                    <Link to={`/doctor/patients/${p.id}`}>
                      {String(p.full_name)}
                    </Link>
                  </td>
                  <td data-label="Email">{String(p.email)}</td>
                  <td data-label="Phone">{String(p.phone ?? "—")}</td>
                  <td data-label="Appointments">{String(p.appointment_count)}</td>
                  <td data-label="Last visit">
                    {p.last_appointment
                      ? dateTime(String(p.last_appointment))
                      : "—"}
                  </td>
                  <td data-label="Patient record">
                    <Link
                      className="patient-record-link"
                      to={`/doctor/patients/${p.id}`}
                    >
                      Open record
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          title="No matching patients"
          text="Try another name, email, or phone number."
        />
      )}
    </>
  );
}
export function PatientDetail() {
  const { id = "" } = useParams();
  const [data, setData] = useState<{
    patient: Record<string, unknown>;
    appointments: Record<string, unknown>[];
    records: Record<string, unknown>[];
    prescriptions: Record<string, unknown>[];
  } | null>(null);
  const [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [reload, setReload] = useState(0);
  const requestId = useRef(0);
  useEffect(() => {
    let alive = true;
    const current = ++requestId.current;
    setLoading(true);
    setError("");
    api<typeof data>(`/portal/patients/${encodeURIComponent(id)}`)
      .then((x) => {
        if (alive && current === requestId.current && x) setData(x);
      })
      .catch((e) => {
        if (alive && current === requestId.current)
          setError(
            e instanceof ApiError
              ? e.message
              : "Could not load the patient record.",
          );
      })
      .finally(() => {
        if (alive && current === requestId.current) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [id, reload]);
  return (
    <main className="portal-content patient-chart">
      <Link to="/doctor/patients" className="back-link">
        ← Back to patients
      </Link>
      <div className="eyebrow">PRIVATE PATIENT CHART</div>
      <h1>Patient record</h1>
      {typeof data?.patient.full_name === "string" && (
        <p className="patient-chart-name">{data.patient.full_name}</p>
      )}
      <p className="page-subtitle">
        Appointments, shared reports, and prescriptions for this patient.
      </p>
      <Status
        loading={loading}
        error={error}
        onRetry={() => setReload((x) => x + 1)}
      >
        {data && (
          <>
            <section className="card patient-chart-section">
              <div className="patient-chart-section-head">
                <div>
                  <span className="eyebrow">PATIENT DETAILS</span>
                  <h2>Overview</h2>
                </div>
              </div>
              <div className="patient-facts">
                <p>
                  <strong>Contact</strong>
                  <span>
                    {data.patient.email
                      ? String(data.patient.email)
                      : "No email"}
                    {data.patient.phone
                      ? ` · ${String(data.patient.phone)}`
                      : " · No phone"}
                  </span>
                </p>
                <p>
                  <strong>Date of birth</strong>
                  <span>
                    {data.patient.date_of_birth
                      ? String(data.patient.date_of_birth).slice(0, 10)
                      : "Not provided"}
                  </span>
                </p>
                <p>
                  <strong>Conditions</strong>
                  <span>
                    {Array.isArray(data.patient.medical_conditions)
                      ? data.patient.medical_conditions.join(", ") ||
                      "None recorded"
                      : "None recorded"}
                  </span>
                </p>
                <p>
                  <strong>Allergies</strong>
                  <span>
                    {Array.isArray(data.patient.allergies)
                      ? data.patient.allergies.join(", ") || "None recorded"
                      : "None recorded"}
                  </span>
                </p>
                <p>
                  <strong>Current medications</strong>
                  <span>
                    {Array.isArray(data.patient.current_medications)
                      ? data.patient.current_medications.join(", ") ||
                      "None recorded"
                      : "None recorded"}
                  </span>
                </p>
              </div>
            </section>
            <section className="card patient-chart-section patient-chart-reports">
              <div className="patient-chart-section-head">
                <div>
                  <span className="eyebrow">PATIENT-SHARED FILES</span>
                  <h2>Reports and documents</h2>
                  <p>
                    Files uploaded by this patient, kept with their care record.
                  </p>
                </div>
                <span className="chart-count">
                  {data.records.length}{" "}
                  {data.records.length === 1 ? "document" : "documents"}
                </span>
              </div>
              <RecordList records={data.records} />
            </section>
            <section className="card patient-chart-section">
              <div className="patient-chart-section-head">
                <div>
                  <span className="eyebrow">VISIT HISTORY</span>
                  <h2>Appointments</h2>
                </div>
                <span className="chart-count">
                  {data.appointments.length}{" "}
                  {data.appointments.length === 1 ? "visit" : "visits"}
                </span>
              </div>
              {data.appointments.length ? (
                <div className="card-list">
                  {data.appointments.map((a) => (
                    <article
                      className="card timeline-content"
                      key={String(a.id)}
                    >
                      <CalendarDays size={18} />
                      <div>
                        <strong>
                          {String(a.service_name)} ·{" "}
                          {dateTime(String(a.starts_at))}
                        </strong>
                        <p>
                          {String(a.status)} ·{" "}
                          {String(a.method).replaceAll("_", " ")}
                        </p>
                        {typeof a.assessment === "string" && (
                          <small>Assessment: {String(a.assessment)}</small>
                        )}
                        <div>
                          <Link to={`/doctor/appointments/${a.id}`}>
                            Open consultation
                          </Link>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <Empty
                  title="No appointments yet"
                  text="Visits associated with this patient will appear here."
                />
              )}
            </section>
            <section className="card patient-chart-section">
              <div className="patient-chart-section-head">
                <div>
                  <span className="eyebrow">TREATMENT</span>
                  <h2>Prescriptions</h2>
                </div>
                <span className="chart-count">
                  {data.prescriptions.length}{" "}
                  {data.prescriptions.length === 1
                    ? "prescription"
                    : "prescriptions"}
                </span>
              </div>
              <PrescriptionList prescriptions={data.prescriptions} />
            </section>
          </>
        )}
      </Status>
    </main>
  );
}
export function AppointmentDetail({ role }: { role: Role }) {
  const { id = "" } = useParams();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [reload, setReload] = useState(0),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const requestId = useRef(0);
  const [notes, setNotes] = useState(""),
    [assessment, setAssessment] = useState(""),
    [diagnosisCode, setDiagnosisCode] = useState(""),
    [patientSummary, setPatientSummary] = useState(""),
    [followUpAt, setFollowUpAt] = useState("");
  const [instructions, setInstructions] = useState(""),
    [items, setItems] = useState([
      {
        medicine: "",
        dosage: "",
        frequency: "",
        duration: "",
        instructions: "",
      },
    ]);
  const load = useCallback(() => {
    const current = ++requestId.current;
    setLoading(true);
    setError("");
    void api<{ appointment: Record<string, unknown> }>(
      `/portal/appointments/${encodeURIComponent(id)}`,
    )
      .then((x) => {
        if (current !== requestId.current) return;
        setData(x.appointment);
        setNotes(String(x.appointment.notes ?? ""));
        setAssessment(String(x.appointment.assessment ?? ""));
        setDiagnosisCode(String(x.appointment.diagnosisCode ?? ""));
        setPatientSummary(String(x.appointment.patientSummary ?? ""));
        setFollowUpAt(
          x.appointment.followUpAt
            ? new Date(String(x.appointment.followUpAt))
              .toISOString()
              .slice(0, 16)
            : "",
        );
      })
      .catch((e) => {
        if (current === requestId.current)
          setError(
            e instanceof ApiError
              ? e.message
              : "Could not load this appointment.",
          );
      })
      .finally(() => {
        if (current === requestId.current) setLoading(false);
      });
  }, [id]);
  useEffect(() => {
    load();
  }, [load, reload]);
  async function saveConsultation(complete = false) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api(`/portal/appointments/${encodeURIComponent(id)}/consultation`, {
        method: "PUT",
        body: JSON.stringify({
          notes,
          assessment,
          diagnosisCode,
          patientSummary,
          followUpAt: followUpAt ? new Date(followUpAt).toISOString() : null,
          complete,
        }),
      });
      setNotice(
        complete
          ? "Consultation completed and saved."
          : "Consultation notes saved.",
      );
      setReload((x) => x + 1);
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Could not save consultation.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function issuePrescription(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api(
        `/portal/appointments/${encodeURIComponent(id)}/prescriptions`,
        { method: "POST", body: JSON.stringify({ instructions, items }) },
      );
      setInstructions("");
      setItems([
        {
          medicine: "",
          dosage: "",
          frequency: "",
          duration: "",
          instructions: "",
        },
      ]);
      setNotice("Prescription issued and added to the patient portal.");
      setReload((x) => x + 1);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not issue prescription.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main
      className={`portal-content ${role === "DOCTOR" ? "doctor-consultation" : "patient-appointment-detail"}`}
    >
      <Link
        to={`/${role === "DOCTOR" ? "doctor" : "patient"}/appointments`}
        className="back-link"
      >
        ← Back to appointments
      </Link>
      <div className="eyebrow">
        {role === "DOCTOR" ? "CONSULTATION WORKSPACE" : "APPOINTMENT DETAILS"}
      </div>
      <h1>
        {data
          ? String(role === "DOCTOR" ? data.patientName : data.doctorName)
          : "Appointment"}
      </h1>
      <Status loading={loading} error={error} onRetry={load}>
        {data && (
          <>
            <section className="card">
              <div className="appointment-detail-grid">
                <div>
                  <strong>{String(data.serviceName)}</strong>
                  <p>
                    {dateTime(String(data.startsAt))} · {String(data.status)}
                  </p>
                  <p>Method: {String(data.method).replaceAll("_", " ")}</p>
                </div>
                {safeGoogleMeetUrl(data.meetingUrl) &&
                  !["COMPLETED", "CANCELLED", "NO_SHOW"].includes(
                    String(data.status),
                  ) && (
                    <a
                      className="btn btn-primary"
                      href={safeGoogleMeetUrl(data.meetingUrl)!}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {role === "DOCTOR"
                        ? "Start Google Meet"
                        : "Join Google Meet"}
                    </a>
                  )}
              </div>
              {role === "DOCTOR" && (
                <div className="intake-summary">
                  <h2>Pre-consultation details</h2>
                  <p>
                    <b>Main concern:</b>{" "}
                    {String(data.problemDescription ?? "Not provided")}
                  </p>
                  <p>
                    <b>Symptoms:</b> {String(data.symptoms ?? "Not provided")}
                  </p>
                  <p>
                    <b>Severity:</b> {String(data.severity ?? "Not provided")}
                  </p>
                  <p>
                    <b>Current medication:</b>{" "}
                    {String(data.medicationNotes ?? "Not provided")}
                  </p>
                  <p>
                    <b>Conditions:</b>{" "}
                    {String(data.conditionNotes ?? "Not provided")}
                  </p>
                  <p>
                    <b>Allergies:</b>{" "}
                    {String(data.allergyNotes ?? "Not provided")}
                  </p>
                  <p>
                    <b>Previous treatment:</b>{" "}
                    {String(data.previousTreatments ?? "Not provided")}
                  </p>
                  <p>
                    <b>Additional notes:</b>{" "}
                    {String(data.additionalNotes ?? "Not provided")}
                  </p>
                  <p>
                    <b>Patient contact:</b> {String(data.patientEmail ?? "")} ·{" "}
                    {String(data.patientPhone ?? "")}
                  </p>
                </div>
              )}
            </section>
            <section className="card">
              <h2>Files shared for this appointment</h2>
              <RecordList
                records={(data.records ?? []) as Record<string, unknown>[]}
              />
            </section>
            {role === "DOCTOR" ? (
              <>
                <section className="card consultation-form">
                  <h2>Consultation notes</h2>
                  <div className="form-group">
                    <label>
                      Clinical notes
                      <textarea
                        rows={5}
                        maxLength={10000}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                      />
                    </label>
                    <label>
                      Assessment
                      <textarea
                        rows={4}
                        maxLength={10000}
                        value={assessment}
                        onChange={(e) => setAssessment(e.target.value)}
                      />
                    </label>
                    <label>
                      Diagnosis code (optional)
                      <input
                        maxLength={120}
                        value={diagnosisCode}
                        onChange={(e) => setDiagnosisCode(e.target.value)}
                      />
                    </label>
                    <label>
                      Patient-facing summary
                      <textarea
                        rows={3}
                        maxLength={10000}
                        value={patientSummary}
                        onChange={(e) => setPatientSummary(e.target.value)}
                      />
                    </label>
                    <label>
                      Follow-up date and time
                      <input
                        type="datetime-local"
                        value={followUpAt}
                        onChange={(e) => setFollowUpAt(e.target.value)}
                      />
                    </label>
                    {error && (
                      <p className="form-error" role="alert">
                        {error}
                      </p>
                    )}
                    {notice && (
                      <p className="form-notice" role="status">
                        {notice}
                      </p>
                    )}
                    <div className="portal-actions">
                      <button
                        className="btn btn-secondary"
                        disabled={busy}
                        onClick={() => void saveConsultation(false)}
                      >
                        Save notes
                      </button>
                      <button
                        className="btn btn-primary"
                        disabled={busy || data.status === "COMPLETED"}
                        onClick={() => void saveConsultation(true)}
                      >
                        Complete consultation
                      </button>
                    </div>
                  </div>
                </section>
                <section className="card consultation-form">
                  <h2>Issue prescription</h2>
                  <form className="form-group" onSubmit={issuePrescription}>
                    {items.map((item, index) => (
                      <div className="medicine-row" key={index}>
                        <label>
                          Medicine
                          <input
                            required
                            maxLength={200}
                            value={item.medicine}
                            onChange={(e) =>
                              setItems((xs) =>
                                xs.map((x, i) =>
                                  i === index
                                    ? { ...x, medicine: e.target.value }
                                    : x,
                                ),
                              )
                            }
                          />
                        </label>
                        <label>
                          Dosage
                          <input
                            maxLength={500}
                            value={item.dosage}
                            onChange={(e) =>
                              setItems((xs) =>
                                xs.map((x, i) =>
                                  i === index
                                    ? { ...x, dosage: e.target.value }
                                    : x,
                                ),
                              )
                            }
                          />
                        </label>
                        <label>
                          Frequency
                          <input
                            maxLength={500}
                            value={item.frequency}
                            onChange={(e) =>
                              setItems((xs) =>
                                xs.map((x, i) =>
                                  i === index
                                    ? { ...x, frequency: e.target.value }
                                    : x,
                                ),
                              )
                            }
                          />
                        </label>
                        <label>
                          Duration
                          <input
                            maxLength={500}
                            value={item.duration}
                            onChange={(e) =>
                              setItems((xs) =>
                                xs.map((x, i) =>
                                  i === index
                                    ? { ...x, duration: e.target.value }
                                    : x,
                                ),
                              )
                            }
                          />
                        </label>
                        <label>
                          Instructions
                          <input
                            maxLength={500}
                            value={item.instructions}
                            onChange={(e) =>
                              setItems((xs) =>
                                xs.map((x, i) =>
                                  i === index
                                    ? { ...x, instructions: e.target.value }
                                    : x,
                                ),
                              )
                            }
                          />
                        </label>
                        {items.length > 1 && (
                          <button
                            type="button"
                            className="text-button"
                            onClick={() =>
                              setItems((xs) => xs.filter((_, i) => i !== index))
                            }
                          >
                            Remove medicine
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() =>
                        setItems((xs) => [
                          ...xs,
                          {
                            medicine: "",
                            dosage: "",
                            frequency: "",
                            duration: "",
                            instructions: "",
                          },
                        ])
                      }
                      disabled={items.length >= 30}
                    >
                      Add medicine
                    </button>
                    <label>
                      Prescription instructions
                      <textarea
                        rows={3}
                        maxLength={5000}
                        value={instructions}
                        onChange={(e) => setInstructions(e.target.value)}
                      />
                    </label>
                    <button
                      className="btn btn-primary "
                      disabled={busy || !data.consultationId}
                    >
                      {busy ? "Saving…" : "Issue prescription"}
                    </button>
                    {!Boolean(data.consultationId) && (
                      <small>Save consultation notes first.</small>
                    )}
                  </form>
                </section>
              </>
            ) : (
              <>
                <section className="card">
                  <h2>Visit summary</h2>
                  <p>
                    {String(
                      data.patientSummary ??
                      "Your clinician has not added a visit summary yet.",
                    )}
                  </p>
                  {typeof data.followUpAt === "string" && (
                    <p>Follow-up: {dateTime(String(data.followUpAt))}</p>
                  )}
                </section>
                <section className="card">
                  <h2>Prescriptions</h2>
                  <PrescriptionList
                    prescriptions={
                      (data.prescriptions ?? []) as Record<string, unknown>[]
                    }
                  />
                </section>
              </>
            )}
          </>
        )}
      </Status>
    </main>
  );
}
function PatientReportsPage({
  records,
  loading,
  error,
  retry,
}: {
  records: Record<string, unknown>[];
  loading: boolean;
  error: string;
  retry: () => void;
}) {
  const [file, setFile] = useState<File | null>(null),
    [category, setCategory] = useState("Other"),
    [busy, setBusy] = useState(false),
    [uploadError, setUploadError] = useState(""),
    [notice, setNotice] = useState(""),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("All");
  async function upload(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setUploadError("");
    setNotice("");
    try {
      if (file.size > 8 * 1024 * 1024)
        throw new Error("Choose a file up to 8 MB.");
      if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type))
        throw new Error("Choose a PDF, JPG, or PNG file.");
      await api("/portal/records", {
        method: "POST",
        body: file,
        headers: {
          "Content-Type": file.type,
          "X-Upload-Name": encodeURIComponent(file.name),
          "X-Upload-Category": category,
        },
      });
      setFile(null);
      const input = document.getElementById(
        "medical-report-file",
      ) as HTMLInputElement | null;
      if (input) input.value = "";
      setNotice("Report uploaded to your private patient record.");
      retry();
    } catch (err) {
      setUploadError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not upload this report.",
      );
    } finally {
      setBusy(false);
    }
  }
  const visible = records.filter(
    (r) =>
      (filter === "All" || String(r.category ?? "Other") === filter) &&
      `${r.original_filename ?? ""} ${r.category ?? ""}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  return (
    <main className="portal-content">
      <div className="eyebrow">PRIVATE MEDICAL FILES</div>
      <h1>Reports</h1>
      <p className="page-subtitle">
        Keep documents related to your care together. Only you and the practice
        can view these files.
      </p>
      <section className="card card">
        <h2>Upload a report</h2>
        <form className="form-group" onSubmit={upload}>
          <label>
            Report category
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option>Lab report</option>
              <option>Prescription</option>
              <option>Imaging</option>
              <option>Other</option>
            </select>
          </label>
          <label>
            PDF, JPG, or PNG · up to 8 MB
            <input
              id="medical-report-file"
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              required
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          {uploadError && (
            <p className="form-error" role="alert">
              {uploadError}
            </p>
          )}
          {notice && (
            <p className="form-notice" role="status">
              {notice}
            </p>
          )}
          <button className="btn btn-primary " disabled={busy || !file}>
            {busy ? "Uploading…" : "Upload privately"}
          </button>
        </form>
      </section>
      <section className="card">
        <div className="reports-list-heading">
          <div>
            <h2>Your documents</h2>
            <p>Open a file to review it in a new tab.</p>
          </div>
          <div className="reports-controls">
            <label className="list-search">
              <Search size={16} />
              <span className="sr-only">Search documents</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search documents"
              />
            </label>
            <label className="sr-only" htmlFor="record-category-filter">
              Filter document category
            </label>
            <select
              id="record-category-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option>All</option>
              <option>Lab report</option>
              <option>Prescription</option>
              <option>Imaging</option>
              <option>Other</option>
            </select>
          </div>
        </div>
        <Status loading={loading} error={error} onRetry={retry}>
          {visible.length ? (
            <RecordList records={visible} />
          ) : (
            <Empty
              title={
                query || filter !== "All"
                  ? "No matching documents"
                  : "No reports yet"
              }
              text={
                query || filter !== "All"
                  ? "Try a different search or category."
                  : "Your uploads will appear here after you share them."
              }
            />
          )}
        </Status>
      </section>
      <p className="report-storage-note">
        Files are accessible only to the authenticated patient and their
        connected practice.
      </p>
    </main>
  );
}
function RecordList({ records }: { records: Record<string, unknown>[] }) {
  if (!records.length)
    return (
      <Empty
        title="No reports yet"
        text="Reports uploaded to your private chart will be listed here."
      />
    );
  return (
    <div className="card-list">
      {records.map((r) => (
        <article className="card timeline-content" key={String(r.id)}>
          <FileText size={19} />
          <div>
            <strong>{String(r.original_filename)}</strong>
            <p>
              {String(r.category ?? "Medical report")} ·{" "}
              {String(r.content_type)} ·{" "}
              {Math.ceil(Number(r.size_bytes) / 1024)} KB
            </p>
            <small>Added {dateTime(String(r.created_at))}</small>
            <div>
              <a
                href={`${apiBaseUrl}/api/portal/records/${encodeURIComponent(String(r.id))}/download?view=1`}
                target="_blank"
                rel="noreferrer"
              >
                See record
              </a>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
function PrescriptionList({
  prescriptions,
}: {
  prescriptions: Record<string, unknown>[];
}) {
  if (!prescriptions.length)
    return (
      <Empty
        title="No prescriptions yet"
        text="A prescription will appear here after your clinician issues one."
      />
    );
  return (
    <div className="card-list">
      {prescriptions.map((r) => (
        <article className="card timeline-content" key={String(r.id)}>
          <ClipboardList size={19} />
          <div>
            <strong>
              {String(r.doctor_name ?? "Prescription")} ·{" "}
              {dateTime(String(r.issued_at))}
            </strong>
            <ul>
              {(Array.isArray(r.items) ? r.items : []).map((item, index) => {
                const med = item as Record<string, string>;
                return (
                  <li key={index}>
                    {med.medicine} {med.dosage ? `· ${med.dosage}` : ""}{" "}
                    {med.frequency ? `· ${med.frequency}` : ""}{" "}
                    {med.duration ? `· ${med.duration}` : ""}
                  </li>
                );
              })}
            </ul>
            {typeof r.instructions === "string" && <p>{r.instructions}</p>}
          </div>
        </article>
      ))}
    </div>
  );
}
function Empty({ title, text }: { title: string; text: string }) {
  return (
    <section className="empty-state">
      <span className="empty-symbol">
        <FileText size={22} />
      </span>
      <h2>{title}</h2>
      <p>{text}</p>
    </section>
  );
}

function NotificationsPage({
  notifications,
  loading,
  error,
  retry,
}: {
  notifications: Record<string, unknown>[];
  loading: boolean;
  error: string;
  retry: () => void;
}) {
  const path = useLocation().pathname;
  const [actionError, setActionError] = useState("");
  const [busyId, setBusyId] = useState("");
  const labels: Record<string, string> = {
    APPOINTMENT_REQUESTED: "New appointment request",
    APPOINTMENT_ACCEPTED: "Your appointment was accepted",
    APPOINTMENT_DECLINED: "Your appointment request was declined",
    APPOINTMENT_REQUEST_CANCELLED: "A patient cancelled an appointment request",
    PRESCRIPTION_AVAILABLE: "A prescription is available",
  };
  async function markRead(id: string) {
    setActionError("");
    setBusyId(id);
    try {
      await api(`/portal/notifications/${id}/read`, {
        method: "PATCH",
        body: "{}",
      });
      retry();
    } catch (e) {
      setActionError(
        e instanceof ApiError ? e.message : "Could not update notification.",
      );
    } finally {
      setBusyId("");
    }
  }
  return (
    <main className="portal-content">
      <div className="eyebrow">IN-APP UPDATES</div>
      <h1>Notifications</h1>
      <p className="page-subtitle">
        Updates about appointment requests and prescriptions. No email or SMS is
        sent.
      </p>
      {actionError && (
        <p className="form-error" role="alert">
          {actionError}
        </p>
      )}
      <Status loading={loading} error={error} onRetry={retry}>
        {notifications.length ? (
          <div className="card-list">
            {notifications.map((n) => (
              <article
                className={`notification-item ${n.read_at ? "read" : ""}`}
                key={String(n.id)}
              >
                <div>
                  <strong>
                    {labels[String(n.template_key)] ?? "Practice update"}
                  </strong>
                  <small>{dateTime(String(n.created_at))}</small>
                </div>
                <div className="notification-actions">
                  {Boolean(n.appointment_id) && (
                    <Link
                      to={`/${location.pathname.startsWith("/doctor") ? "doctor" : "patient"}/appointments/${n.appointment_id}`}
                    >
                      Open appointment
                    </Link>
                  )}
                  {!Boolean(n.read_at) && (
                    <button disabled={busyId === String(n.id)} onClick={() => void markRead(String(n.id))}>
                      {busyId === String(n.id) ? "Marking read…" : "Mark read"}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <Empty
            title="You're all caught up"
            text="New appointment and prescription updates will appear here."
          />
        )}
      </Status>
    </main>
  );
}
function PaymentsPage({
  payments,
  loading,
  error,
  retry,
  role,
}: {
  payments: Record<string, unknown>[];
  loading: boolean;
  error: string;
  retry: () => void;
  role: Role;
}) {
  return (
    <main className="portal-content">
      <div className="eyebrow">PAYMENT HISTORY</div>
      <h1>Payments</h1>
      <p className="page-subtitle">
        {role === "PATIENT"
          ? "Review payment records associated with your care. This portal does not process online payments."
          : "Review payment records associated with the practice."}
      </p>
      <Status loading={loading} error={error} onRetry={retry}>
        {payments.length ? (
          <div className="payment-list">
            {payments.map((p) => (
              <article className="payment-card" key={String(p.id)}>
                <div>
                  <span className="payment-label">
                    {role === "DOCTOR"
                      ? String(p.other_person ?? "Patient")
                      : "Consultation"}
                  </span>
                  <h2>
                    {String(p.currency)}{" "}
                    {(Number(p.amount_paise) / 100).toFixed(2)}
                  </h2>
                  <p>
                    {dateTime(String(p.created_at))}
                    {role === "DOCTOR" && p.provider_payment_id
                      ? ` · ${String(p.provider_payment_id)}`
                      : ""}
                  </p>
                </div>
                <span
                  className={`status-pill status-${String(p.status).toLowerCase()}`}
                >
                  {String(p.status).replaceAll("_", " ")}
                </span>
              </article>
            ))}
          </div>
        ) : (
          <Empty
            title={role === "PATIENT" ? "No payment history" : "No payment records"}
            text={role === "PATIENT"
              ? "There are no payment records associated with your account. Online payment is not available here."
              : "There are no payment records associated with the practice."}
          />
        )}
      </Status>
    </main>
  );
}

function IntegrationsPage() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState<{
    configured: boolean;
    connected: boolean;
    email: string | null;
    connectedAt: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const callbackMessage: Record<string, string> = {
    connected:
      "Google Calendar is connected. Google Meet links will be created when you accept Meet appointments.",
    not_configured:
      "Calendar connection needs server credentials and an encryption key.",
    state_error:
      "The Google connection expired or could not be verified. Try connecting again.",
    cancelled: "Google Calendar connection was cancelled.",
    consent_error:
      "Google did not grant Calendar event access. Check the OAuth consent screen and Calendar API permissions.",
    account_error: "Google did not return a verified account email.",
    connection_error:
      "Google Calendar could not be connected. Check server logs and OAuth redirect settings.",
  };
  const load = useCallback(() => {
    setLoading(true);
    void api<typeof status>("/integrations/google/status")
      .then((x) => {
        if (x) setStatus(x);
        setError("");
      })
      .catch((e) =>
        setError(
          e instanceof ApiError
            ? e.message
            : "Could not load integration status.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  async function disconnect() {
    setBusy(true);
    setError("");
    try {
      await api("/integrations/google", { method: "DELETE", body: "{}" });
      load();
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : "Could not disconnect Google Calendar.",
      );
    } finally {
      setBusy(false);
    }
  }
  const callbackUrl = `${apiBaseUrl || window.location.origin}/api/integrations/google/callback`;
  return (
    <main className="portal-content">
      <div className="eyebrow">PRACTICE SETTINGS</div>
      <h1>Integrations</h1>
      <p className="page-subtitle">
        Connect the practice calendar to schedule accepted online consultations.
      </p>
      {params.get("calendar") && (
        <p
          className={
            params.get("calendar") === "connected"
              ? "form-notice"
              : "form-error"
          }
          role={params.get("calendar") === "connected" ? "status" : "alert"}
        >
          {callbackMessage[params.get("calendar") ?? ""] ??
            "Calendar connection did not complete."}
        </p>
      )}
      {loading ? (
        <div className="empty-state">Checking integration status…</div>
      ) : (
        <section className="card card">
          <div className="integration-title">
            <CalendarDays size={22} />
            <div>
              <h2>Google Calendar and Meet</h2>
              <p>
                {status?.connected
                  ? `Connected as ${status.email}`
                  : "Not connected"}
              </p>
            </div>
          </div>
          <p>
            When you accept a Google Meet appointment request, Atelier Care
            creates a private calendar event and stores its Meet link. Patients
            receive a calendar invitation from Google. The event does not
            include the patient's symptoms or notes.
          </p>
          {!status?.configured && (
            <div className="integration-setup">
              <strong>Server setup required</strong>
              <p>
                Set Google OAuth client credentials and a random token
                encryption key in <code>server/.env</code>. In Google Cloud, add
                this exact Authorized redirect URI:
              </p>
              <code className="callback-uri">{callbackUrl}</code>
              <p>
                Enable Google Calendar API and include your testing Gmail under
                OAuth consent screen test users if the app is in testing.
              </p>
            </div>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="portal-actions">
            {status?.connected ? (
              <button
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => void disconnect()}
              >
                {busy ? "Disconnecting…" : "Disconnect Google Calendar"}
              </button>
            ) : (
              <a
                className={`btn btn-primary ${status?.configured ? "" : "disabled-link"}`}
                href={
                  status?.configured
                    ? `${apiBaseUrl}/api/integrations/google/connect`
                    : undefined
                }
                aria-disabled={!status?.configured}
                onClick={(e) => {
                  if (!status?.configured) e.preventDefault();
                }}
              >
                Connect Google Calendar
              </a>
            )}
          </div>
        </section>
      )}
    </main>
  );
}

function ProfilePage({ role }: { role: Role }) {
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null),
    [fullName, setFullName] = useState(""),
    [dob, setDob] = useState(""),
    [gender, setGender] = useState(""),
    [error, setError] = useState(""),
    [loadError, setLoadError] = useState(""),
    [message, setMessage] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    setLoading(true);
    setLoadError("");
    void api<{ profile: Record<string, unknown> }>("/portal/profile")
      .then((r) => {
        setProfile(r.profile);
        setFullName(
          String(r.profile?.full_name ?? r.profile?.display_name ?? ""),
        );
        setDob(String(r.profile?.date_of_birth ?? "").slice(0, 10));
        setGender(String(r.profile?.gender ?? ""));
        setError("");
      })
      .catch((e) => {
        const message =
          e instanceof ApiError ? e.message : "Could not load profile.";
        setError(message);
        setLoadError(message);
      })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await api<{ message: string }>("/portal/profile", {
        method: "PATCH",
        body: JSON.stringify({ fullName, dateOfBirth: dob, gender }),
      });
      setMessage(result.message);
      load();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not save profile.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="portal-content">
      <div className="eyebrow">ACCOUNT PROFILE</div>
      <h1>{role === "DOCTOR" ? "Practice profile" : "Your profile"}</h1>
      <p className="page-subtitle">Keep your account details up to date.</p>
      {loading ? (
        <div className="empty-state">Loading profile…</div>
      ) : loadError ? (
        <section className="empty-state empty-state-error">
          <p role="alert">{loadError}</p>
          <button className="btn btn-secondary" onClick={load}>
            Try again
          </button>
        </section>
      ) : (
        <section className="card">
          <form className="form-group" onSubmit={save}>
            <label>
              {role === "DOCTOR" ? "Doctor name" : "Full name"}
              <input
                required
                maxLength={120}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </label>
            {role === "PATIENT" && (
              <>
                <label>
                  Date of birth
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                  />
                </label>
                <label>
                  <span>
                    Gender <span className="required-field">Required</span>
                  </span>
                  <select
                    className="profile-gender-select"
                    required
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                  >
                    <option value="" disabled>Select an option</option>
                    {gender && !["Female", "Male", "Non-binary", "Other", "Prefer not to say"].includes(gender) && (
                      <option value={gender}>{gender}</option>
                    )}
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Non-binary">Non-binary</option>
                    <option value="Other">Other</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </label>
              </>
            )}
            {typeof profile?.email === "string" && (
              <p className="profile-meta">
                Email: {profile.email}
                {typeof profile.phone === "string"
                  ? ` · Phone: ${profile.phone}`
                  : ""}
              </p>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            {message && (
              <p className="form-notice" role="status">
                {message}
              </p>
            )}
            <button className="btn btn-primary " disabled={busy}>
              {busy ? "Saving…" : "Save profile"}
            </button>
          </form>
        </section>
      )}
    </main>
  );
}

function AvailabilityPage() {
  const [rules, setRules] = useState<Rule[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [loadError, setLoadError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const weekdays = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const load = useCallback(() => {
    setLoading(true);
    setLoadError("");
    void api<{ rules: Array<Record<string, unknown>> }>("/portal/availability")
      .then((r) => {
        setRules(
          r.rules.map((x) => ({
            id: String(x.id),
            weekday: Number(x.weekday),
            startsAt: String(x.starts_at).slice(0, 5),
            endsAt: String(x.ends_at).slice(0, 5),
            slotMinutes: Number(x.slot_minutes),
            bufferMinutes: Number(x.buffer_minutes),
          })),
        );
        setError("");
      })
      .catch((e) => {
        const message =
          e instanceof ApiError ? e.message : "Could not load availability.";
        setError(message);
        setLoadError(message);
      })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  function add() {
    setRules((x) => [
      ...x,
      {
        weekday: 1,
        startsAt: "09:00",
        endsAt: "17:00",
        slotMinutes: 30,
        bufferMinutes: 0,
      },
    ]);
  }
  function change(i: number, k: keyof Rule, v: string) {
    setRules((x) =>
      x.map((r, index) =>
        index === i
          ? {
            ...r,
            [k]:
              k === "weekday" || k === "slotMinutes" || k === "bufferMinutes"
                ? Number(v)
                : v,
          }
          : r,
      ),
    );
  }
  async function save() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await api<{ message: string }>("/portal/availability", {
        method: "PUT",
        body: JSON.stringify({ rules }),
      });
      setMessage(r.message);
      load();
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Could not save availability.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="portal-content">
      <div className="eyebrow">PRACTICE SETTINGS</div>
      <h1>Availability</h1>
      <p className="page-subtitle">
        Set the weekly hours used to calculate bookable appointment times.
      </p>
      {loading ? (
        <div className="empty-state">Loading availability…</div>
      ) : loadError ? (
        <section className="empty-state empty-state-error">
          <p role="alert">{loadError}</p>
          <button className="btn btn-secondary" onClick={load}>
            Try again
          </button>
        </section>
      ) : (
        <>
          <div className="availability-list">
            {rules.map((r, i) => (
              <div className="availability-row" key={r.id ?? i}>
                <label>
                  Day
                  <select
                    value={r.weekday}
                    onChange={(e) => change(i, "weekday", e.target.value)}
                  >
                    {weekdays.map((d, n) => (
                      <option key={d} value={n}>
                        {d}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  From
                  <input
                    type="time"
                    value={r.startsAt}
                    onChange={(e) => change(i, "startsAt", e.target.value)}
                  />
                </label>
                <label>
                  To
                  <input
                    type="time"
                    value={r.endsAt}
                    onChange={(e) => change(i, "endsAt", e.target.value)}
                  />
                </label>
                <label>
                  Slot (min)
                  <input
                    type="number"
                    min={10}
                    max={240}
                    step={5}
                    value={r.slotMinutes}
                    onChange={(e) => change(i, "slotMinutes", e.target.value)}
                  />
                </label>
                <label>
                  Buffer (min)
                  <input
                    type="number"
                    min={0}
                    max={120}
                    step={5}
                    value={r.bufferMinutes}
                    onChange={(e) => change(i, "bufferMinutes", e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setRules((x) => x.filter((_, n) => n !== i))}
                >
                  Remove
                </button>
              </div>
            ))}
            {!rules.length && (
              <Empty
                title="No weekly hours set"
                text="Add your clinic hours to record your schedule."
              />
            )}
          </div>
          <div className="portal-actions">
            <button className="btn btn-secondary" onClick={add}>
              Add hours
            </button>
            <button
              className="btn btn-primary"
              onClick={() => void save()}
              disabled={busy}
            >
              {busy ? "Saving…" : "Save availability"}
            </button>
            <Link to="/doctor/services" className="btn btn-secondary">
              Configure services
            </Link>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className="form-notice" role="status">
              {message}
            </p>
          )}
        </>
      )}
    </main>
  );
}

type Service = {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  fee_paise: number;
  currency: string;
  methods: string[];
  active: boolean;
  timezone?: string;
};
function normalizeMethods(value: unknown): string[] {
  if (Array.isArray(value))
    return value.filter(
      (method): method is string => typeof method === "string",
    );
  if (typeof value !== "string") return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed))
      return parsed.filter(
        (method): method is string => typeof method === "string",
      );
  } catch {
    /* PostgreSQL enum-array text format */
  }
  return value
    .replace(/^\{|\}$/g, "")
    .split(",")
    .map((method) => method.trim().replace(/^"|"$/g, ""))
    .filter(Boolean);
}
function normalizeServices(services: Service[]): Service[] {
  return services.map((service) => ({
    ...service,
    methods: normalizeMethods(service.methods),
  }));
}
function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [loadError, setLoadError] = useState(""),
    [notice, setNotice] = useState("");
  const [name, setName] = useState(""),
    [description, setDescription] = useState(""),
    [duration, setDuration] = useState(30),
    [fee, setFee] = useState(""),
    [methods, setMethods] = useState<string[]>(["GOOGLE_MEET"]);
  const load = useCallback(() => {
    setLoading(true);
    setLoadError("");
    void api<{ services: Service[] }>("/portal/services")
      .then((x) => {
        setServices(normalizeServices(x.services));
        setError("");
      })
      .catch((e) => {
        const message =
          e instanceof ApiError ? e.message : "Could not load services.";
        setError(message);
        setLoadError(message);
      })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  function toggleMethod(m: string) {
    setMethods((x) => (x.includes(m) ? x.filter((y) => y !== m) : [...x, m]));
  }
  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api("/portal/services", {
        method: "POST",
        body: JSON.stringify({
          name,
          description,
          durationMinutes: duration,
          feeRupees: Number(fee),
          methods,
        }),
      });
      setName("");
      setDescription("");
      setFee("");
      setNotice("Service created and available to patients.");
      load();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not save service.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function toggle(service: Service) {
    setBusy(true);
    setError("");
    try {
      await api(`/portal/services/${service.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: service.name,
          description: service.description,
          durationMinutes: Number(service.duration_minutes),
          feeRupees: Number(service.fee_paise) / 100,
          methods: service.methods,
          active: !service.active,
        }),
      });
      setNotice("Service updated.");
      load();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not update service.",
      );
    } finally {
      setBusy(false);
    }
  }
  const labels: Record<string, string> = {
    GOOGLE_MEET: "Google Meet",
    WHATSAPP: "WhatsApp",
    IN_PERSON: "In person",
  };
  return (
    <main className="portal-content">
      <div className="eyebrow">BOOKING SETUP</div>
      <h1>Consultation services</h1>
      <p className="page-subtitle">
        Configure what patients can request, including the fee and meeting
        options. Fees are displayed as a quote only; online payments are not
        connected.
      </p>
      {loading ? (
        <div className="empty-state">Loading services…</div>
      ) : loadError ? (
        <section className="empty-state empty-state-error">
          <p role="alert">{loadError}</p>
          <button className="btn btn-secondary" onClick={load}>
            Try again
          </button>
        </section>
      ) : (
        <>
          <div className="card-list">
            {services.map((s) => (
              <article className="service-card" key={s.id}>
                <div>
                  <strong>{s.name}</strong>
                  <p>
                    {s.description || "Consultation"} · {s.duration_minutes}{" "}
                    minutes · ₹{(Number(s.fee_paise) / 100).toFixed(2)}
                  </p>
                  <small>
                    {s.methods.map((m) => labels[m] ?? m).join(" · ")}
                  </small>
                </div>
                <button
                  className="btn btn-secondary"
                  disabled={busy}
                  onClick={() => void toggle(s)}
                >
                  {s.active ? "Pause bookings" : "Enable bookings"}
                </button>
              </article>
            ))}
            {!services.length && (
              <Empty
                title="No services configured"
                text="Add a service with its actual consultation fee and available methods before patients can request a booking."
              />
            )}
          </div>
          <section className="card service-form-card">
            <h2>Add consultation service</h2>
            <form className="form-group" onSubmit={create}>
              <label>
                Service name
                <input
                  required
                  maxLength={120}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Online consultation"
                />
              </label>
              <label>
                Description (optional)
                <textarea
                  maxLength={1000}
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>
              <div className="service-form-grid">
                <label>
                  Duration in minutes
                  <input
                    type="number"
                    min={10}
                    max={240}
                    step={5}
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                  />
                </label>
                <label>
                  Fee in ₹
                  <input
                    type="number"
                    min={0}
                    max={100000}
                    step="0.01"
                    required
                    value={fee}
                    onChange={(e) => setFee(e.target.value)}
                  />
                </label>
              </div>
              <fieldset className="method-fieldset">
                <legend>Consultation methods</legend>
                {Object.entries(labels).map(([key, label]) => (
                  <label className="check-option" key={key}>
                    <input
                      type="checkbox"
                      checked={methods.includes(key)}
                      onChange={() => toggleMethod(key)}
                    />
                    {label}
                  </label>
                ))}
              </fieldset>
              <button className="btn btn-primary " disabled={busy}>
                {busy ? "Saving…" : "Add service"}
              </button>
            </form>
          </section>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="form-notice" role="status">
              {notice}
            </p>
          )}
        </>
      )}
    </main>
  );
}
