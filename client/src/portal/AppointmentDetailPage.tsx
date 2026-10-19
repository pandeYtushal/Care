import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { dateTime, localDateTimeInput, safeGoogleMeetUrl } from "./format";
import { Empty, PrescriptionList, RecordList, Status } from "./PortalPrimitives";

export default function AppointmentDetailPage({ role }: { role: "PATIENT" | "DOCTOR" }) {
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
  const [savedConsultation, setSavedConsultation] = useState<{
    notes: string;
    assessment: string;
    diagnosisCode: string;
    patientSummary: string;
    followUpAt: string;
  } | null>(null);
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
        const draft = {
          notes: String(x.appointment.notes ?? ""),
          assessment: String(x.appointment.assessment ?? ""),
          diagnosisCode: String(x.appointment.diagnosisCode ?? ""),
          patientSummary: String(x.appointment.patientSummary ?? ""),
          followUpAt: localDateTimeInput(x.appointment.followUpAt),
        };
        setNotes(draft.notes);
        setAssessment(draft.assessment);
        setDiagnosisCode(draft.diagnosisCode);
        setPatientSummary(draft.patientSummary);
        setFollowUpAt(draft.followUpAt);
        setSavedConsultation(draft);
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
  const consultationDirty = role === "DOCTOR" && savedConsultation !== null && (
    notes !== savedConsultation.notes || assessment !== savedConsultation.assessment ||
    diagnosisCode !== savedConsultation.diagnosisCode || patientSummary !== savedConsultation.patientSummary ||
    followUpAt !== savedConsultation.followUpAt
  );
  const consultationComplete = data?.status === "COMPLETED" || Boolean(data?.completedAt);
  useEffect(() => {
    if (!consultationDirty) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const guardInternalNavigation = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const anchor = event.target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin || `${destination.pathname}${destination.search}${destination.hash}` === `${window.location.pathname}${window.location.search}${window.location.hash}`) return;
      if (!window.confirm("Your consultation notes have unsaved changes. Leave this page without saving?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    document.addEventListener("click", guardInternalNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", warnBeforeUnload);
      document.removeEventListener("click", guardInternalNavigation, true);
    };
  }, [consultationDirty]);
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
      className={`portal-content ${role === "DOCTOR" ? "doctor-consultation doctor-appointment-workflow" : "patient-appointment-detail"}`}
    >
      <Link
        to={`/${role === "DOCTOR" ? "doctor" : "patient"}/appointments`}
        className="back-link"
      >
        ← Back to appointments
      </Link>
      {role === "DOCTOR" ? (
        <header className="doctor-consultation-page-heading">
          <span>APPOINTMENT WORKSPACE</span>
          <h1>{data ? String(data.patientName ?? "Patient") : "Appointment"}</h1>
          <p>Review visit details, record the consultation, and manage treatment.</p>
        </header>
      ) : (
        <h1>Appointment details</h1>
      )}
      <Status loading={loading} error={error} onRetry={load}>
        {data && (
          <>
            <section className={`card ${role === "PATIENT" ? "patient-visit-hero" : "doctor-visit-summary"}`}>
              <div className="appointment-detail-grid">
                <div className="patient-visit-heading">
                  {role === "PATIENT" && <span className="patient-visit-kicker">YOUR VISIT</span>}
                  {role === "PATIENT" ? <h2 className="patient-visit-service">{String(data.serviceName ?? "Consultation")}</h2> : <strong>{String(data.serviceName ?? "Consultation")}</strong>}
                  <p className="patient-visit-date">{dateTime(String(data.startsAt))}</p>
                  <div className="patient-visit-meta">
                    <span className={`patient-visit-status status-${String(data.status).toLowerCase()}`}>{String(data.status).replaceAll("_", " ")}</span>
                    <span>{String(data.method ?? "").replaceAll("_", " ") || "Method not specified"}</span>
                    {role === "PATIENT" && <span>Dr. {String(data.doctorName ?? "Your clinician")}</span>}
                  </div>
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
            <section className={`card ${role === "PATIENT" ? "patient-detail-section patient-detail-records" : "doctor-appointment-files"}`}>
              <div className="patient-detail-section-heading"><div>{role === "DOCTOR" && <span>ATTACHED TO THIS VISIT</span>}<h2>{role === "PATIENT" ? "Shared documents" : "Files shared for this appointment"}</h2></div>{role === "PATIENT" && <span>For this visit</span>}</div>
              <RecordList
                records={(data.records ?? []) as Record<string, unknown>[]}
              />
            </section>
            {role === "DOCTOR" ? (
              <>
                <section className="card consultation-form doctor-notes-card">
                  <div className="consultation-heading"><div><span>CLINICAL RECORD</span><h2>Consultation notes</h2></div><span className={`consultation-save-state${consultationDirty ? " is-dirty" : ""}`} role="status">{consultationComplete ? "Completed · read only" : consultationDirty ? "Unsaved changes" : "Saved"}</span></div>
                  {consultationComplete && <p className="consultation-locked-note">This consultation is complete. Its clinical notes are read-only.</p>}
                  {consultationDirty && <p className="consultation-unsaved-note">Save your changes before leaving this consultation.</p>}
                  <div className="form-group consultation-fields">
                    <label>
                      Clinical notes
                      <textarea
                        rows={5}
                        maxLength={10000}
                        value={notes}
                        placeholder={consultationComplete && !notes.trim() ? "No clinical notes recorded." : ""}
                        readOnly={consultationComplete}
                        onChange={(e) => setNotes(e.target.value)}
                      />
                    </label>
                    <label>
                      Assessment
                      <textarea
                        rows={4}
                        maxLength={10000}
                        value={assessment}
                        placeholder={consultationComplete && !assessment.trim() ? "No assessment recorded." : ""}
                        readOnly={consultationComplete}
                        onChange={(e) => setAssessment(e.target.value)}
                      />
                    </label>
                    <label>
                      Diagnosis code (optional)
                      <input
                        maxLength={120}
                        value={diagnosisCode}
                        placeholder={consultationComplete && !diagnosisCode.trim() ? "No diagnosis code recorded." : ""}
                        readOnly={consultationComplete}
                        onChange={(e) => setDiagnosisCode(e.target.value)}
                      />
                    </label>
                    <label>
                      Patient-facing summary
                      <textarea
                        rows={3}
                        maxLength={10000}
                        value={patientSummary}
                        placeholder={consultationComplete && !patientSummary.trim() ? "No patient-facing summary recorded." : ""}
                        readOnly={consultationComplete}
                        onChange={(e) => setPatientSummary(e.target.value)}
                      />
                    </label>
                    <label>
                      Follow-up date and time
                      <input
                        type="datetime-local"
                        value={followUpAt}
                        readOnly={consultationComplete}
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
                        disabled={busy || consultationComplete}
                        onClick={() => void saveConsultation(false)}
                      >
                        Save notes
                      </button>
                      <button
                        className="btn btn-primary"
                        disabled={busy || consultationComplete}
                        onClick={() => void saveConsultation(true)}
                      >
                        Complete consultation
                      </button>
                    </div>
                  </div>
                </section>
                <section className="card consultation-form doctor-prescription-card">
                  <div className="prescription-section-heading"><div><span>TREATMENT</span><h2>Issue prescription</h2></div><p>Add one or more medicines to this patient’s record.</p></div>
                  <form className="form-group doctor-prescription-form" onSubmit={issuePrescription}>
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
                <section className="card patient-detail-section patient-visit-summary">
                  <div className="patient-detail-section-heading"><h2>Visit summary</h2><span>From your clinician</span></div>
                  <p className="patient-summary-copy">
                    {String(
                      data.patientSummary ??
                      "Your clinician has not added a visit summary yet.",
                    )}
                  </p>
                  {typeof data.followUpAt === "string" && (
                    <p>Follow-up: {dateTime(String(data.followUpAt))}</p>
                  )}
                </section>
                <section className="card patient-detail-section patient-detail-prescriptions">
                  <div className="patient-detail-section-heading"><h2>Prescriptions</h2><span>{((data.prescriptions ?? []) as Record<string, unknown>[]).length} issued</span></div>
                  <PrescriptionList
                    prescriptions={
                      (data.prescriptions ?? []) as Record<string, unknown>[]
                    }
                    role="PATIENT"
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
