import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowUpRight, CalendarDays, Check, FileText, History, Search, ShieldCheck, Upload } from "lucide-react";
import { api, apiBaseUrl, ApiError } from "../lib/api";
import { Select } from "../components/ui/select";
import { dateTime } from "./format";
import { Empty, PageHeader, RecordList, Status } from "./PortalPrimitives";
import type { Appointment } from "./types";

type Role = "PATIENT" | "DOCTOR";

function useCollection(path: string, field: string) {
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api<Record<string, Record<string, unknown>[]>>(path)
      .then((result) => {
        if (active) setData(result[field] ?? []);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(
          reason instanceof ApiError
            ? reason.message
            : "Could not load this information. Check your connection and retry.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [path, field, reload]);

  return {
    data,
    error,
    loading,
    retry: () => setReload((value) => value + 1),
  };
}

export function CareHistoryPage() {
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
    dateValue: string;
    status?: string;
    link?: string;
  }[] = [];
  if (data) {
    data.appointments.forEach((a) =>
      timeline.push({
        id: `app-${a.id}`,
        date: new Date(a.starts_at).getTime(),
        type: "Consultation",
        title: a.service_name,
        subtitle: dateTime(a.starts_at),
        dateValue: a.starts_at,
        status: a.status,
        link: `/patient/appointments/${a.id}`,
      }),
    );
    data.records.forEach((r) =>
      timeline.push({
        id: `rec-${r.id}`,
        date: new Date(String(r.created_at)).getTime(),
        type: "Report",
        title: String(r.original_filename),
        subtitle: dateTime(String(r.created_at)),
        dateValue: String(r.created_at),
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
        dateValue: String(p.issued_at),
        link: `/patient/prescriptions`,
      }),
    );
    timeline.sort((a, b) => b.date - a.date);
  }

  return (
    <main className="portal-content">
      <PageHeader
        title="Care history"
        description="A timeline of your consultations, reports, and prescriptions."
      />
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
          <section className="card care-history-card" aria-label="Your care timeline">
            <div className="timeline">
              {timeline.map((item) => (
                <article className="timeline-item" key={item.id}>
                  <span className="timeline-marker" aria-hidden="true" />
                  <div className="timeline-content">
                    <div className="timeline-meta">
                      <span className="timeline-type">{item.type}</span>
                      {item.status && <span className={`status-pill status-${item.status.toLowerCase()}`}>{item.status.replaceAll("_", " ")}</span>}
                      <time className="timeline-date" dateTime={item.dateValue}>{item.subtitle}</time>
                    </div>
                    <strong>{item.title}</strong>
                    {item.link &&
                      (item.type === "Report" ? (
                        <a
                          href={item.link}
                          className="timeline-link"
                          target="_blank"
                          rel="noreferrer"
                        >
                          View report <ArrowUpRight size={14} aria-hidden="true" />
                        </a>
                      ) : (
                        <Link to={item.link} className="timeline-link">
                          View details <ArrowUpRight size={14} aria-hidden="true" />
                        </Link>
                      ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
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

export function PatientReportsPage() {
  const { data: records, loading, error, retry } = useCollection(
    "/portal/records",
    "records",
  );
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
      <PageHeader
        eyebrow="PRIVATE MEDICAL FILES"
        title="Reports"
        description="Keep documents related to your care together. Only you and the practice can view these files."
      />
      <section className="card report-upload-card">
        <div className="report-section-heading">
          <span className="report-section-icon" aria-hidden="true"><Upload size={18} /></span>
          <div>
            <h2>Share a report</h2>
            <p>Add a document to your private care record.</p>
          </div>
        </div>
        <form className="report-upload-form" onSubmit={upload}>
          <label className="report-category-field">
            <span>Document type</span>
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option>Lab report</option>
              <option>Prescription</option>
              <option>Imaging</option>
              <option>Other</option>
            </Select>
          </label>
          <label className={`report-file-picker${file ? " has-file" : ""}`}>
            <span className="report-file-icon" aria-hidden="true"><FileText size={19} /></span>
            <span className="report-file-copy">
              <strong>{file ? file.name : "Choose a document"}</strong>
              <small>{file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB · ready to upload` : "PDF, JPG, or PNG · up to 8 MB"}</small>
            </span>
            <span className="report-file-action">Browse</span>
            <input
              id="medical-report-file"
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              required
              aria-label="Choose a PDF, JPG, or PNG report up to 8 MB"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <div className="report-upload-submit">
            <button className="btn btn-primary" disabled={busy || !file}>
              {busy ? "Uploading…" : "Upload report"}
              {!busy && <ArrowUpRight size={15} aria-hidden="true" />}
            </button>
            <span><ShieldCheck size={14} aria-hidden="true" /> Private to you and your practice</span>
          </div>
          {uploadError && (
            <p className="form-error report-feedback" role="alert">
              {uploadError}
            </p>
          )}
          {notice && (
            <p className="form-notice report-feedback" role="status">
              {notice}
            </p>
          )}
        </form>
      </section>
      <section className="card report-documents-card">
        <div className="reports-list-heading">
          <div>
            <h2>Your documents</h2>
            <p>{records.length ? `${records.length} ${records.length === 1 ? "document" : "documents"} in your care record` : "Documents you share with the practice appear here."}</p>
          </div>
          <div className="reports-controls">
            <label className="list-search">
              <Search size={16} />
              <span className="sr-only">Search your documents</span>
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
            <Select
              id="record-category-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option>All</option>
              <option>Lab report</option>
              <option>Prescription</option>
              <option>Imaging</option>
              <option>Other</option>
            </Select>
          </div>
        </div>
        <Status loading={loading} error={error} onRetry={retry}>
          {visible.length ? (
            <RecordList records={visible} variant="reports" />
          ) : (
            <Empty
              className="report-empty-state"
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
        <ShieldCheck size={15} aria-hidden="true" />
        <span>Files are accessible only to you and your connected practice.</span>
      </p>
    </main>
  );
}

export function NotificationsPage() {
  const { data: notifications, loading, error, retry } = useCollection(
    "/portal/notifications",
    "notifications",
  );
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
      window.dispatchEvent(new Event("portal-notifications-updated"));
    } catch (e) {
      setActionError(
        e instanceof ApiError ? e.message : "Could not update notification.",
      );
    } finally {
      setBusyId("");
    }
  }
  return (
    <main className="portal-content notifications-page">
      <PageHeader
        eyebrow={path.startsWith("/doctor") ? "PRACTICE ACTIVITY" : "YOUR CARE UPDATES"}
        title="Notifications"
        description="Updates about appointments and prescriptions, all in one place."
      />
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
                className={`notification-item ${n.read_at ? "read" : "unread"}`}
                key={String(n.id)}
              >
                <span className="notification-icon" aria-hidden="true">
                  {String(n.template_key).includes("PRESCRIPTION") ? <FileText size={18} /> : <CalendarDays size={18} />}
                </span>
                <div className="notification-copy">
                  <div className="notification-title-row">
                    <strong>{labels[String(n.template_key)] ?? "Practice update"}</strong>
                    {!n.read_at && <span className="notification-new-label">New</span>}
                  </div>
                  <small className="notification-date">{dateTime(String(n.created_at))}</small>
                </div>
                <div className="notification-actions">
                  {Boolean(n.appointment_id) && (
                    <Link
                      to={`/${path.startsWith("/doctor") ? "doctor" : "patient"}/appointments/${n.appointment_id}`}
                    >
                      Open appointment <ArrowUpRight size={15} aria-hidden="true" />
                    </Link>
                  )}
                  {!Boolean(n.read_at) && (
                    <button disabled={busyId === String(n.id)} onClick={() => void markRead(String(n.id))}>
                      {busyId === String(n.id) ? "Marking read…" : <><Check size={14} aria-hidden="true" /> Mark read</>}
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

export function PaymentsPage({ role }: { role: Role }) {
  const { data: payments, loading, error, retry } = useCollection(
    "/portal/payments",
    "payments",
  );
  return (
    <main className="portal-content">
      <PageHeader
        eyebrow="PAYMENT HISTORY"
        title="Payments"
        description={role === "PATIENT"
          ? "Review payment records associated with your care. This portal does not process online payments."
          : "Review payment records associated with the practice."}
      />
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

