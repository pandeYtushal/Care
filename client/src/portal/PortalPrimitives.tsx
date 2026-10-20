import type { ReactNode } from "react";
import { ArrowUpRight, ClipboardList, FileText, RefreshCw, Trash2 } from "lucide-react";
import { apiBaseUrl } from "../lib/api";
import { dateTime } from "./format";

/** A consistent landmark and heading hierarchy for portal routes. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  );
}

export function Status({
  loading,
  error,
  onRetry,
  children,
}: {
  loading: boolean;
  error: string;
  onRetry: () => void;
  children: ReactNode;
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
export function RecordList({ records, variant = "default", onDelete, deletingId = "" }: { records: Record<string, unknown>[]; variant?: "default" | "reports"; onDelete?: (id: string) => void; deletingId?: string }) {
  if (!records.length)
    return (
      <Empty
        title="No reports yet"
        text="Reports uploaded to your private chart will be listed here."
      />
    );
  return (
    <div className={`card-list${variant === "reports" ? " report-record-list" : ""}`}>
      {records.map((r) => (
        <article className={`card timeline-content${variant === "reports" ? " report-record-item" : ""}`} key={String(r.id)}>
          {variant === "reports" ? (
            <>
              <span className="report-record-icon" aria-hidden="true"><FileText size={19} /></span>
              <div className="report-record-body">
                <div className="report-record-title">
                  <strong>{String(r.original_filename)}</strong>
                  <span className="report-category-badge">{String(r.category ?? "Medical report")}</span>
                </div>
                <p>{String(r.content_type)} · {Math.ceil(Number(r.size_bytes) / 1024)} KB · Added {dateTime(String(r.created_at))}</p>
              </div>
              <div className="report-record-actions">
                <a
                  className="report-view-link"
                  href={`${apiBaseUrl}/api/portal/records/${encodeURIComponent(String(r.id))}/download?view=1`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View record <ArrowUpRight size={15} aria-hidden="true" />
                </a>
                {onDelete && <button type="button" className="report-delete-button" disabled={deletingId === String(r.id)} onClick={() => onDelete(String(r.id))} aria-label={`Delete ${String(r.original_filename)}`}>
                  <Trash2 size={15} aria-hidden="true" />{deletingId === String(r.id) ? "Deleting…" : "Delete"}
                </button>}
              </div>
            </>
          ) : (
            <>
              <FileText size={19} />
              <div>
                <strong>{String(r.original_filename)}</strong>
                <p>{String(r.category ?? "Medical report")} · {String(r.content_type)} · {Math.ceil(Number(r.size_bytes) / 1024)} KB</p>
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
            </>
          )}
        </article>
      ))}
    </div>
  );
}
export function PrescriptionList({
  prescriptions,
  role = "PATIENT",
}: {
  prescriptions: Record<string, unknown>[];
  role?: "PATIENT" | "DOCTOR";
}) {
  if (!prescriptions.length)
    return (
      <Empty
        title="No prescriptions yet"
        text="A prescription will appear here after your clinician issues one."
      />
    );
  return (
    <div className={`card-list${role === "PATIENT" ? " patient-prescription-list" : " doctor-prescription-list"}`}>
      {prescriptions.map((r) => {
        const clean = (value: unknown) => {
          const text = String(value ?? "").trim();
          return text && !["na", "n/a", "null", "undefined"].includes(text.toLowerCase()) ? text : "";
        };
        const items = (Array.isArray(r.items) ? r.items : []).map((item) => {
          const med = item as Record<string, unknown>;
          return [med.medicine, med.dosage, med.frequency, med.duration].map(clean).filter(Boolean).join(" · ");
        }).filter(Boolean);
        const instructions = clean(r.instructions);
        const prescriber = clean(role === "DOCTOR" ? r.patient_name : r.doctor_name) || "Prescription";
        return (
          <article className="card timeline-content" key={String(r.id)}>
            <ClipboardList size={19} />
            <div>
              <div className="prescription-entry-heading">
                <strong>{prescriber}</strong>
                <time dateTime={String(r.issued_at)}>{dateTime(String(r.issued_at))}</time>
              </div>
              {items.length > 0 ? <ul>{items.map((item, index) => <li key={index}>{item}</li>)}</ul> : <p className="prescription-detail-unavailable">Medicine details unavailable</p>}
              {instructions && <p>{instructions}</p>}
            </div>
          </article>
        );
      })}
    </div>
  );
}
export function Empty({ title, text, className }: { title: string; text: string; className?: string }) {
  return (
      <section className={`empty-state${className ? ` ${className}` : ""}`}>
      <span className="empty-symbol">
        <FileText size={22} />
      </span>
      <h2>{title}</h2>
      <p>{text}</p>
    </section>
  );
}

