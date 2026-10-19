import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, CalendarDays, UserRound } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { dateTime } from "../portal/format";
import { Empty, PrescriptionList, RecordList, Status } from "../portal/PortalPrimitives";

export default function DoctorPatientDetailPage() {
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
  const patientName = typeof data?.patient.full_name === "string" && data.patient.full_name.trim()
    ? data.patient.full_name.trim()
    : "Patient record";
  return (
    <main className="portal-content patient-chart patient-record-page">
      <Link to="/doctor/patients" className="patient-record-back">
        <ArrowLeft size={15} aria-hidden="true" /> Back to patients
      </Link>
      <header className="patient-record-header">
        <div className="patient-record-identity">
          <span className="patient-record-avatar" aria-hidden="true"><UserRound size={22} /></span>
          <div>
            <span className="patient-chart-kicker">PATIENT CHART</span>
            <h1>{patientName}</h1>
            <p>Appointments, shared reports, and prescriptions for this patient.</p>
          </div>
        </div>
        {data && <div className="patient-record-counts" aria-label="Patient record totals">
          <div><strong>{data.appointments.length}</strong><span>Visits</span></div>
          <div><strong>{data.records.length}</strong><span>Documents</span></div>
          <div><strong>{data.prescriptions.length}</strong><span>Prescriptions</span></div>
        </div>}
      </header>
      <Status
        loading={loading}
        error={error}
        onRetry={() => setReload((x) => x + 1)}
      >
        {data && (
          <>
            <section className="card patient-chart-section patient-record-overview">
              <div className="patient-chart-section-head">
                <div>
                  <span className="patient-chart-kicker">PATIENT DETAILS</span>
                  <h2>At a glance</h2>
                </div>
              </div>
              <dl className="patient-facts">
                <div>
                  <dt>Contact</dt>
                  <dd>
                    {data.patient.email
                      ? String(data.patient.email)
                      : "No email"}
                    {data.patient.phone
                      ? ` · ${String(data.patient.phone)}`
                      : " · No phone"}
                  </dd>
                </div>
                <div>
                  <dt>Date of birth</dt>
                  <dd>
                    {data.patient.date_of_birth
                      ? String(data.patient.date_of_birth).slice(0, 10)
                      : "Not provided"}
                  </dd>
                </div>
                <div>
                  <dt>Conditions</dt>
                  <dd>
                    {Array.isArray(data.patient.medical_conditions)
                      ? data.patient.medical_conditions.join(", ") ||
                      "None recorded"
                      : "None recorded"}
                  </dd>
                </div>
                <div>
                  <dt>Allergies</dt>
                  <dd>
                    {Array.isArray(data.patient.allergies)
                      ? data.patient.allergies.join(", ") || "None recorded"
                      : "None recorded"}
                  </dd>
                </div>
                <div>
                  <dt>Current medications</dt>
                  <dd>
                    {Array.isArray(data.patient.current_medications)
                      ? data.patient.current_medications.join(", ") ||
                      "None recorded"
                      : "None recorded"}
                  </dd>
                </div>
              </dl>
            </section>
            <section className="card patient-chart-section patient-chart-visits">
              <div className="patient-chart-section-head">
                <div>
                  <span className="patient-chart-kicker">VISIT HISTORY</span>
                  <h2>Appointments</h2>
                </div>
                <span className="chart-count">{data.appointments.length} {data.appointments.length === 1 ? "visit" : "visits"}</span>
              </div>
              {data.appointments.length ? (
                <ol className="patient-visit-list">
                  {data.appointments.map((a) => {
                    const status = String(a.status);
                    return <li className="patient-visit-row" key={String(a.id)}>
                      <span className="patient-visit-icon" aria-hidden="true"><CalendarDays size={18} /></span>
                      <div className="patient-visit-content">
                        <div className="patient-visit-title-row">
                          <h3>{String(a.service_name)}</h3>
                          <span className={`status-pill status-${status.toLowerCase()}`}>{status.replaceAll("_", " ")}</span>
                        </div>
                        <p>{dateTime(String(a.starts_at))} <span aria-hidden="true">·</span> {String(a.method).replaceAll("_", " ")}</p>
                        {typeof a.assessment === "string" && a.assessment.trim() && <small>Assessment: {a.assessment}</small>}
                      </div>
                      <Link className="patient-visit-link" to={`/doctor/appointments/${a.id}`}>Open visit <ArrowUpRight size={15} aria-hidden="true" /></Link>
                    </li>;
                  })}
                </ol>
              ) : (
                <Empty
                  title="No appointments yet"
                  text="Visits associated with this patient will appear here."
                />
              )}
            </section>
            <div className="patient-record-resources">
            <section className="card patient-chart-section patient-chart-reports">
              <div className="patient-chart-section-head">
                <div>
                  <span className="patient-chart-kicker">PATIENT-SHARED FILES</span>
                  <h2>Reports and documents</h2>
                  <p>Files uploaded by this patient.</p>
                </div>
                <span className="chart-count">{data.records.length}</span>
              </div>
              <RecordList records={data.records} variant="reports" />
            </section>
            <section className="card patient-chart-section patient-chart-prescriptions">
              <div className="patient-chart-section-head">
                <div>
                  <span className="patient-chart-kicker">TREATMENT</span>
                  <h2>Prescriptions</h2>
                </div>
                <span className="chart-count">{data.prescriptions.length}</span>
              </div>
              <PrescriptionList prescriptions={data.prescriptions} role="DOCTOR" />
            </section>
            </div>
          </>
        )}
      </Status>
    </main>
  );
}
