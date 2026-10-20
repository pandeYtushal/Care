import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { dateTime, localDateTimeInput, safeGoogleMeetUrl } from "./format";
import { Empty, PrescriptionList, RecordList, Status } from "./PortalPrimitives";

function localDateValue(timezone: string, date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
function dateOffset(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export default function AppointmentDetailPage({ role }: { role: "PATIENT" | "DOCTOR" }) {
  const { id = "" } = useParams();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [reload, setReload] = useState(0),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleSlots, setRescheduleSlots] = useState<Array<{ startsAt: string; endsAt: string }>>([]);
  const [rescheduleSlotsLoading, setRescheduleSlotsLoading] = useState(false);
  const [selectedRescheduleSlot, setSelectedRescheduleSlot] = useState("");
  const [rescheduleError, setRescheduleError] = useState("");
  const [rescheduleMessage, setRescheduleMessage] = useState("");
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
  useEffect(() => {
    if (role !== "PATIENT" || !rescheduleDate || typeof data?.serviceId !== "string") {
      setRescheduleSlots([]);
      setSelectedRescheduleSlot("");
      return;
    }
    let active = true;
    setRescheduleSlotsLoading(true);
    setRescheduleError("");
    const query = new URLSearchParams({ serviceId: data.serviceId, date: rescheduleDate });
    void api<{ slots: Array<{ startsAt: string; endsAt: string }> }>(`/booking/slots?${query}`)
      .then((result) => { if (active) setRescheduleSlots(result.slots ?? []); })
      .catch((reason: unknown) => { if (active) setRescheduleError(reason instanceof ApiError ? reason.message : "Could not load available times."); })
      .finally(() => { if (active) setRescheduleSlotsLoading(false); });
    return () => { active = false; };
  }, [data?.serviceId, rescheduleDate, role]);
  const consultationDirty = role === "DOCTOR" && savedConsultation !== null && (
    notes !== savedConsultation.notes || assessment !== savedConsultation.assessment ||
    diagnosisCode !== savedConsultation.diagnosisCode || patientSummary !== savedConsultation.patientSummary ||
    followUpAt !== savedConsultation.followUpAt
  );
  const consultationComplete = data?.status === "COMPLETED" || Boolean(data?.completedAt);
  const visitNextStep = (() => {
    switch (String(data?.status ?? "").toUpperCase()) {
      case "PENDING":
      case "REQUESTED":
        return "The practice will review your request and update its status here.";
      case "ACCEPTED":
      case "CONFIRMED":
        return "Your visit is confirmed. Check this appointment for meeting details.";
      case "COMPLETED":
        return "Your visit is complete. Any notes and prescriptions appear below.";
      case "CANCELLED":
        return "This visit was cancelled. Contact the practice if you need help.";
      default:
        return "Updates from the practice will appear here.";
    }
  })();
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
  async function respondToRequest(status: "CONFIRMED" | "CANCELLED") {
    if (status === "CANCELLED" && !window.confirm("Decline this appointment request? The patient will be notified.")) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api(`/portal/appointments/${encodeURIComponent(id)}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setNotice(status === "CONFIRMED" ? "Request accepted. You can now prepare the consultation." : "Request declined. The patient has been notified.");
      setReload((value) => value + 1);
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Could not update this appointment request.");
    } finally {
      setBusy(false);
    }
  }
  async function requestReschedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRescheduleSlot) return;
    setBusy(true);setRescheduleError("");setRescheduleMessage("");
    try {
      await api(`/portal/appointments/${encodeURIComponent(id)}/reschedule-request`, { method: "POST", body: JSON.stringify({ startsAt: selectedRescheduleSlot }) });
      setRescheduleMessage("Your new time request was sent to the practice.");
      setReload((value) => value + 1);
    } catch (reason) {
      setRescheduleError(reason instanceof ApiError ? reason.message : "Could not request a new time.");
    } finally { setBusy(false); }
  }
  async function cancelRescheduleRequest() {
    setBusy(true);setRescheduleError("");setRescheduleMessage("");
    try {
      await api(`/portal/appointments/${encodeURIComponent(id)}/reschedule-request/cancel`, { method: "POST", body: "{}" });
      setRescheduleMessage("Your pending time request was cancelled.");
      setReload((value) => value + 1);
    } catch (reason) {
      setRescheduleError(reason instanceof ApiError ? reason.message : "Could not cancel the time request.");
    } finally { setBusy(false); }
  }
  async function decideReschedule(decision: "ACCEPTED" | "DECLINED") {
    const request = data?.rescheduleRequest as { id?: string } | null;
    if (!request?.id) return;
    setBusy(true);setRescheduleError("");setRescheduleMessage("");
    try {
      await api(`/portal/reschedule-requests/${encodeURIComponent(request.id)}`, { method: "PATCH", body: JSON.stringify({ decision }) });
      setRescheduleMessage(decision === "ACCEPTED" ? "The appointment time was changed and the patient was notified." : "The time change was declined and the patient was notified.");
      setReload((value) => value + 1);
    } catch (reason) {
      setRescheduleError(reason instanceof ApiError ? reason.message : "Could not update the time request.");
    } finally { setBusy(false); }
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
          <span>CLINICIAN WORKSPACE · APPOINTMENT</span>
          <h1>{data ? String(data.patientName ?? "Patient") : "Appointment"}</h1>
          <p>Review this patient’s request, records, and consultation.</p>
          {typeof data?.patientId === "string" && data.patientId && <Link className="doctor-patient-record-link" to={`/doctor/patients/${encodeURIComponent(data.patientId)}`}>Open patient record <span aria-hidden="true">↗</span></Link>}
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
                {role === "PATIENT" ? (
                  <aside className="patient-visit-next-step">
                    <span>WHAT HAPPENS NEXT</span>
                    <p>{visitNextStep}</p>
                    {safeGoogleMeetUrl(data.meetingUrl) &&
                      !["COMPLETED", "CANCELLED", "NO_SHOW"].includes(String(data.status)) && (
                        <a className="btn btn-primary" href={safeGoogleMeetUrl(data.meetingUrl)!} target="_blank" rel="noreferrer">Join Google Meet <span aria-hidden="true">↗</span></a>
                      )}
                  </aside>
                ) : safeGoogleMeetUrl(data.meetingUrl) &&
                  !["COMPLETED", "CANCELLED", "NO_SHOW"].includes(
                    String(data.status),
                  ) && (
                    <a
                      className="btn btn-primary"
                      href={safeGoogleMeetUrl(data.meetingUrl)!}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Start Google Meet
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
            {role === "PATIENT" && ["CONFIRMED", "UPCOMING"].includes(String(data.status)) && new Date(String(data.startsAt)).getTime() > Date.now() && (
              <section className="patient-reschedule-panel" aria-labelledby="patient-reschedule-title">
                <div className="patient-reschedule-heading"><h2 id="patient-reschedule-title">Need a different time?</h2><p>Your current appointment stays booked until the practice approves a change.</p></div>
                {data.rescheduleRequest ? (
                  <div className="patient-reschedule-pending" role="status">
                    <p>Waiting for the practice to review <strong>{dateTime(String((data.rescheduleRequest as Record<string, unknown>).startsAt), String(data.timezone ?? "Asia/Kolkata"))}</strong>.</p>
                    <button className="btn btn-secondary" type="button" disabled={busy} onClick={() => void cancelRescheduleRequest()}>{busy ? "Updating…" : "Cancel time request"}</button>
                  </div>
                ) : (
                  <form onSubmit={(event) => void requestReschedule(event)}>
                    <label><span>Choose a new date · {String(data.timezone ?? "Practice time")}</span><input required type="date" min={localDateValue(String(data.timezone ?? "Asia/Kolkata"))} max={dateOffset(localDateValue(String(data.timezone ?? "Asia/Kolkata")), 90)} value={rescheduleDate} onChange={(event) => { setRescheduleDate(event.target.value);setSelectedRescheduleSlot(""); }} /></label>
                    {rescheduleDate && <div className="patient-reschedule-slots" aria-live="polite">
                      <span>Available times</span>
                      {rescheduleSlotsLoading ? <p>Checking availability…</p> : rescheduleSlots.length ? rescheduleSlots.map((slot) => <button type="button" key={slot.startsAt} aria-pressed={selectedRescheduleSlot === slot.startsAt} className={selectedRescheduleSlot === slot.startsAt ? "is-selected" : ""} onClick={() => setSelectedRescheduleSlot(slot.startsAt)}>{dateTime(slot.startsAt, String(data.timezone ?? "Asia/Kolkata"))}</button>) : !rescheduleError && <p>No times are available on this date. Try another day.</p>}
                    </div>}
                    {rescheduleError && <p className="form-error" role="alert">{rescheduleError}</p>}
                    {rescheduleMessage && <p className="form-notice" role="status">{rescheduleMessage}</p>}
                    <button className="btn btn-secondary" type="submit" disabled={busy || rescheduleSlotsLoading || !selectedRescheduleSlot}>{busy ? "Sending…" : "Request this time"}</button>
                  </form>
                )}
                {rescheduleMessage && !data.rescheduleRequest && <p className="form-notice" role="status">{rescheduleMessage}</p>}
                {rescheduleError && Boolean(data.rescheduleRequest) && <p className="form-error" role="alert">{rescheduleError}</p>}
              </section>
            )}
            {role === "DOCTOR" && data.rescheduleRequest && (
              <section className="doctor-reschedule-review" aria-labelledby="doctor-reschedule-title">
                <div><span>TIME CHANGE REQUEST</span><h2 id="doctor-reschedule-title">Review the proposed time</h2><p>{dateTime(String((data.rescheduleRequest as Record<string, unknown>).startsAt), String(data.timezone ?? "Asia/Kolkata"))}</p></div>
                {rescheduleError && <p className="form-error" role="alert">{rescheduleError}</p>}
                {rescheduleMessage && <p className="form-notice" role="status">{rescheduleMessage}</p>}
                <div><button type="button" className="btn btn-primary" disabled={busy} onClick={() => void decideReschedule("ACCEPTED")}>{busy ? "Updating…" : "Approve new time"}</button><button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void decideReschedule("DECLINED")}>Decline request</button></div>
              </section>
            )}
            <section className={`card ${role === "PATIENT" ? "patient-detail-section patient-detail-records" : "doctor-appointment-files"}`}>
              <div className="patient-detail-section-heading"><div>{role === "DOCTOR" && <span>ATTACHED TO THIS VISIT</span>}<h2>{role === "PATIENT" ? "Shared documents" : "Files shared for this appointment"}</h2></div>{role === "PATIENT" && <span>For this visit</span>}</div>
              <RecordList
                records={(data.records ?? []) as Record<string, unknown>[]}
              />
            </section>
            {role === "DOCTOR" ? (
              data.status === "PENDING" ? (
                <section className="card doctor-request-decision" aria-labelledby="doctor-request-decision-title">
                  <div><span>REQUEST DECISION</span><h2 id="doctor-request-decision-title">Review booking request</h2><p>Check the patient’s information and shared files above, then respond to the request.</p></div>
                  {notice && <p className="form-notice" role="status">{notice}</p>}
                  <div className="doctor-request-decision-actions">
                    <button className="btn btn-primary" type="button" disabled={busy} onClick={() => void respondToRequest("CONFIRMED")}>{busy ? "Updating…" : "Accept appointment"}</button>
                    <button className="btn btn-secondary" type="button" disabled={busy} onClick={() => void respondToRequest("CANCELLED")}>Decline request</button>
                  </div>
                </section>
              ) : ["CANCELLED", "NO_SHOW"].includes(String(data.status)) ? (
                <section className="doctor-request-closed" role="status">
                  <strong>{data.status === "CANCELLED" ? "This appointment is cancelled." : "This appointment was marked as a no-show."}</strong>
                  <p>Consultation notes and prescription actions are unavailable for this visit.</p>
                </section>
              ) : (
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
              )
            ) : (
              <div className="patient-appointment-record-grid">
                <section className="card patient-detail-section patient-visit-summary">
                  <div className="patient-detail-section-heading"><h2>Visit summary</h2><span>From your clinician</span></div>
                  {typeof data.patientSummary === "string" && data.patientSummary.trim() ? (
                    <p className="patient-summary-copy">{data.patientSummary}</p>
                  ) : (
                    <Empty
                      title="No visit summary yet"
                      text="Your clinician has not added a summary for this visit."
                    />
                  )}
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
              </div>
            )}
          </>
        )}
      </Status>
    </main>
  );
}
