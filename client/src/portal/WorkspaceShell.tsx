import { useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowUpRight, Bell, CalendarDays, ClipboardList, CreditCard, History,
  LayoutDashboard, LogOut, Menu, Settings, UserRound, Users, Clock3, X,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import BrandMark from "../components/BrandMark";
import { api } from "../lib/api";

type Role = "PATIENT" | "DOCTOR";
type PortalNavLink = { to: string; title: string; icon: LucideIcon; exact?: boolean };
const patientLinkGroups: Array<{ title: string; links: PortalNavLink[] }> = [
  { title: "Your care", links: [
    { to: "/patient", title: "Overview", icon: LayoutDashboard, exact: true },
    { to: "/patient/book", title: "Book a consultation", icon: CalendarDays },
    { to: "/patient/appointments", title: "Appointments", icon: CalendarDays },
    { to: "/patient/history", title: "Care history", icon: History },
  ] },
  { title: "Health records", links: [
    { to: "/patient/reports", title: "Reports & documents", icon: ClipboardList },
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

export default function WorkspaceShell({ role }: { role: Role }) {
  const { user, signOut } = useAuth();
  const path = useLocation().pathname;
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [logoutError, setLogoutError] = useState("");
  const [logoutBusy, setLogoutBusy] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const doctor = role === "DOCTOR";
  useEffect(() => {
    let active = true;
    const refreshUnreadCount = () => {
      void api<{ unreadCount?: number }>("/portal/notifications")
        .then((result) => {
          if (active) setUnreadCount(Math.max(0, Number(result.unreadCount) || 0));
        })
        .catch(() => {
          // Keep the last known count when notifications are temporarily unavailable.
        });
    };
    const onNotificationsUpdated = () => refreshUnreadCount();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshUnreadCount();
    };
    refreshUnreadCount();
    const interval = window.setInterval(refreshUnreadCount, 60_000);
    window.addEventListener("portal-notifications-updated", onNotificationsUpdated);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("portal-notifications-updated", onNotificationsUpdated);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [doctor, user?.email]);
  const renderNavLink = (link: PortalNavLink) => {
    const active = link.exact ? path === link.to : path === link.to || path.startsWith(`${link.to}/`);
    const primaryAction = !doctor && link.to === "/patient/book";
    const notificationsLink = link.to.endsWith("/notifications");
    const notificationLabel = notificationsLink && unreadCount > 0 ? `${link.title}, ${unreadCount} unread` : link.title;
    return <Link key={link.to} to={link.to} onClick={() => setMenuOpen(false)} className={`nav-item${active ? " active" : ""}${primaryAction ? " nav-item-primary" : ""}`} aria-current={active ? "page" : undefined} aria-label={notificationLabel}>
      <link.icon size={17} aria-hidden="true" /><span>{link.title}</span>
      {primaryAction && <ArrowUpRight className="nav-action-arrow" size={15} aria-hidden="true" />}
      {notificationsLink && unreadCount > 0 && <span className="nav-unread-count" aria-hidden="true">{unreadCount > 99 ? "99+" : unreadCount}</span>}
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
    setLogoutBusy(true);
    try { await signOut(); navigate("/login", { replace: true }); }
    catch { setLogoutError("Could not sign out. Please try again."); }
    finally { setLogoutBusy(false); }
  }

  return (
    <div className={`portal-layout ${doctor ? "doctor-workspace" : "patient-portal"}`}>
      <button className={`portal-sidebar-backdrop${menuOpen ? " is-visible" : ""}`} type="button" aria-label="Close navigation" tabIndex={menuOpen ? 0 : -1} onClick={() => setMenuOpen(false)} />
      <aside ref={sidebarRef} id="portal-navigation" className={`portal-sidebar${menuOpen ? " portal-sidebar-open" : ""}`} aria-label={`${doctor ? "Clinician" : "Patient"} navigation`}>
        <div className="sidebar-header">
          <Link to={doctor ? "/doctor" : "/patient"} className="portal-brand" onClick={() => setMenuOpen(false)}>
            <span className="portal-brand-mark"><BrandMark /></span>
            <span><strong>{doctor ? user?.fullName ?? "Clinical workspace" : "Dr. Kiran"}</strong><small>{doctor ? "Clinical workspace" : "Patient care"}</small></span>
          </Link>
          <button className="portal-close-button" type="button" aria-label="Close navigation" onClick={() => setMenuOpen(false)}><X size={18} /></button>
        </div>
        <nav className="sidebar-nav" aria-label="Workspace">
          {doctor ? doctorLinkGroups.map((group) => <div className="doctor-nav-group" key={group.title}><p className="doctor-nav-group-title">{group.title}</p>{group.links.map(renderNavLink)}</div>) : patientLinkGroups.map((group) => <div className="patient-nav-group" key={group.title}><p className="nav-group-label">{group.title}</p>{group.links.map(renderNavLink)}</div>)}
        </nav>
        <div className="sidebar-footer">
          <Link to={`/${doctor ? "doctor" : "patient"}/profile`} onClick={() => setMenuOpen(false)} className="user-profile-button">
            <span className="user-avatar">{(user?.fullName ?? user?.email ?? "U").slice(0, 1).toUpperCase()}</span>
            <span className="user-info"><strong>{user?.fullName ?? user?.email}</strong><span>{doctor ? "Clinician" : "Patient"}</span></span>
          </Link>
        </div>
      </aside>
      <main className="portal-main">
        <header className="portal-topbar">
          <div className="portal-topbar__identity"><button ref={menuButtonRef} className="portal-menu-button" type="button" aria-label="Open navigation" aria-expanded={menuOpen} aria-controls="portal-navigation" onClick={() => setMenuOpen(true)}><Menu size={20} /></button><span>{doctor ? "Clinical workspace" : "Patient portal"}</span></div>
          {logoutError && <p className="portal-topbar-feedback" role="alert">{logoutError}</p>}
          <div className="portal-topbar-actions">
            <Link to={`/${doctor ? "doctor" : "patient"}/notifications`} className="portal-notifications" aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}>
              <Bell size={18} aria-hidden="true" />
              {unreadCount > 0 && <span className="portal-notification-count" aria-hidden="true">{unreadCount > 99 ? "99+" : unreadCount}</span>}
            </Link>
            <button className="portal-signout-button" type="button" aria-label="Sign out" title="Sign out" disabled={logoutBusy} aria-busy={logoutBusy} onClick={() => void logout()}>
              <LogOut size={17} aria-hidden="true" />
              <span className="portal-signout-label">{logoutBusy ? "Signing out…" : "Sign out"}</span>
            </button>
          </div>
        </header>
        <div className="portal-scroll-area"><Outlet /></div>
      </main>
    </div>
  );
}
