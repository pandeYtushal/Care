import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, CheckCircle2 } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { Select } from "../components/ui/select";
import { PageHeader } from "../portal/PortalPrimitives";

type Service = {
  id: string;
  name: string;
  description?: string | null;
  duration_minutes: number;
  fee_paise: number;
  currency?: string;
  timezone?: string;
  display_name?: string;
  methods: string[];
};

function normalizeServices(services: Service[]): Service[] {
  return services.map((service) => ({
    ...service,
    methods: Array.isArray(service.methods)
      ? service.methods
      : typeof service.methods === "string"
        ? (() => { try { const parsed = JSON.parse(service.methods) as unknown; return Array.isArray(parsed) ? parsed.map(String) : []; } catch { return []; } })()
        : [],
  }));
}

function dateTime(value: string, zone?: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Time unavailable" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short", ...(zone ? { timeZone: zone } : {}) }).format(date);
}

function clinicToday(zone?: string | null) {
  // Older/local doctor records may have an empty or invalid timezone. Keep the
  // booking page renderable and let the API surface any corresponding setup issue.
  let safeZone = "Asia/Kolkata";
  if (typeof zone === "string" && zone.trim()) {
    try {
      new Intl.DateTimeFormat("en", { timeZone: zone }).format();
      safeZone = zone;
    } catch {
      /* use the clinic's default timezone */
    }
  }
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: safeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(new Date())
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}`;
}

function clinicDateOffset(zone: string | undefined, offset: number) {
  const value = new Date(`${clinicToday(zone)}T12:00:00`);
  value.setDate(value.getDate() + offset);
  let safeZone = "Asia/Kolkata";
  if (zone?.trim()) {
    try {
      new Intl.DateTimeFormat("en", { timeZone: zone }).format();
      safeZone = zone;
    } catch {
      /* Keep the booking date picker usable if legacy data has a bad zone. */
    }
  }
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: safeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(value).map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export default function BookingPage() {
  const [services, setServices] = useState<Service[]>([]),
    [serviceId, setServiceId] = useState(""),
    [date, setDate] = useState(clinicToday()),
    [slots, setSlots] = useState<Array<{ startsAt: string; endsAt: string }>>(
      [],
    ),
    [selected, setSelected] = useState(""),
    [method, setMethod] = useState(""),
    [problem, setProblem] = useState(""),
    [symptoms, setSymptoms] = useState(""),
    [severity, setSeverity] = useState(""),
    [loading, setLoading] = useState(true),
    [slotsLoading, setSlotsLoading] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [step, setStep] = useState(0),
    [servicesReload, setServicesReload] = useState(0),
    [slotsReload, setSlotsReload] = useState(0),
    [serviceLoadError, setServiceLoadError] = useState("");
  const [slotLoadError, setSlotLoadError] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null),
    [attachmentCategory, setAttachmentCategory] = useState("Prescription"),
    [appointmentId, setAppointmentId] = useState(""),
    [attachmentError, setAttachmentError] = useState("");
  const [submitted, setSubmitted] = useState<{
    id: string;
    status: string;
  } | null>(null);
  const submitLock = useRef(false);
  useEffect(() => {
    let alive = true;
    setServiceLoadError("");
    api<{ services: Service[] }>("/booking/services")
      .then((x) => {
        if (alive) {
          const available = normalizeServices(x.services);
          setServices(available);
          setServiceId("");
          setMethod("");
        }
      })
      .catch((e) => {
        if (alive) {
          const reason =
            e instanceof ApiError
              ? e.message
              : "Could not load consultation services.";
          setError(reason);
          setServiceLoadError(reason);
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [servicesReload]);
  useEffect(() => {
    if (!serviceId || !date) return;
    let alive = true;
    setSlotLoadError("");
    setError("");
    setSlotsLoading(true);
    setSlots([]);
    setSelected("");
    api<{ slots: Array<{ startsAt: string; endsAt: string }> }>(
      `/booking/slots?${new URLSearchParams({ serviceId, date })}`,
    )
      .then((x) => {
        if (alive) setSlots(x.slots);
      })
      .catch((e) => {
        if (alive) {
          const reason = e instanceof ApiError ? e.message : "Could not load available times.";
          setError(reason);
          setSlotLoadError(reason);
        }
      })
      .finally(() => {
        if (alive) setSlotsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [serviceId, date, slotsReload]);
  const service = services.find((s) => s.id === serviceId),
    chosen = slots.find((s) => s.startsAt === selected);
  async function uploadAttachment(forAppointmentId: string) {
    if (!attachment) return;
    if (attachment.size > 8 * 1024 * 1024)
      throw new Error("Choose a file up to 8 MB.");
    if (
      !["application/pdf", "image/jpeg", "image/png"].includes(attachment.type)
    )
      throw new Error("Choose a PDF, JPG, or PNG file.");
    await api("/portal/records", {
      method: "POST",
      body: attachment,
      headers: {
        "Content-Type": attachment.type,
        "X-Upload-Name": encodeURIComponent(attachment.name),
        "X-Upload-Category": attachmentCategory,
        "X-Appointment-Id": forAppointmentId,
      },
    });
    setAttachment(null);
    setAttachmentError("");
    const input = document.getElementById(
      "booking-prescription-file",
    ) as HTMLInputElement | null;
    if (input) input.value = "";
  }
  function nextStep() {
    setError("");
    if (step === 0 && (!service || !method)) {
      setError("Choose a consultation and method to continue.");
      return;
    }
    if (step === 1 && (!date || !chosen)) {
      setError("Choose an available date and time to continue.");
      return;
    }
    if (step === 2 && !problem.trim()) {
      setError("Tell the doctor what you would like help with.");
      return;
    }
    setStep((x) => Math.min(3, x + 1));
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (submitLock.current || busy) return;
    if (!service || !chosen || !problem.trim()) {
      setError("Review the service, time, and reason for your visit.");
      return;
    }
    submitLock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    setAttachmentError("");
    try {
      const result = await api<{
        message: string;
        appointment: { id: string; status: string };
      }>("/booking/appointments", {
        method: "POST",
        body: JSON.stringify({
          serviceId,
          startsAt: selected,
          method,
          intake: {
            problemDescription: problem.trim(),
            symptoms: symptoms.trim(),
            severity: severity ? Number(severity) : null,
          },
        }),
      });
      const newAppointmentId = result.appointment.id;
      setAppointmentId(newAppointmentId);
      setSubmitted({ id: newAppointmentId, status: result.appointment.status });
      setMessage(result.message);
      if (attachment) {
        try {
          await uploadAttachment(newAppointmentId);
          setMessage("Your request was sent and your file was attached.");
        } catch (err) {
          setAttachmentError(
            err instanceof ApiError
              ? err.message
              : err instanceof Error
                ? err.message
                : "The request was sent, but the file could not be attached. Retry below or upload it from Reports.",
          );
        }
      }
      try {
        const refreshed = await api<{
          slots: Array<{ startsAt: string; endsAt: string }>;
        }>(`/booking/slots?${new URLSearchParams({ serviceId, date })}`);
        setSlots(refreshed.slots);
      } catch {
        /* The appointment is already saved. */
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError("That time was just taken or is no longer available. Your consultation details are saved; choose another open time to continue.");
        setSelected("");
        try {
          const refreshed = await api<{ slots: Array<{ startsAt: string; endsAt: string }> }>(
            `/booking/slots?${new URLSearchParams({ serviceId, date })}`,
          );
          setSlots(refreshed.slots);
          setStep(1);
        } catch {
          setError("That time is no longer available. Your consultation details are saved. Try another date or reload available times.");
          setStep(1);
        }
      } else {
        setError(err instanceof ApiError ? err.message : "Could not submit your appointment request.");
      }
    } finally {
      submitLock.current = false;
      setBusy(false);
    }
  }
  async function retryAttachment() {
    if (!appointmentId || !attachment) return;
    setBusy(true);
    setAttachmentError("");
    try {
      await uploadAttachment(appointmentId);
      setMessage("Your file is attached to the appointment request.");
    } catch (err) {
      setAttachmentError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not attach this file. Try again or upload it from Reports.",
      );
    } finally {
      setBusy(false);
    }
  }
  function startAnother() {
    setServiceId("");
    setMethod("");
    setSubmitted(null);
    setAppointmentId("");
    setStep(0);
    setProblem("");
    setSymptoms("");
    setSeverity("");
    setSelected("");
    setMessage("");
    setError("");
    setAttachment(null);
    setAttachmentError("");
  }
  const steps = ["Consultation", "Date & time", "Your concern", "Review"];
  return (
    <main className="portal-content booking-page">
      <PageHeader
        eyebrow="PATIENT BOOKING"
        title={submitted ? "Request received" : "Book a consultation"}
        description={submitted
          ? "Your request is in the practice’s queue. We’ll show updates in Appointments."
          : "Choose a visit and time that work for you. Your details stay with your private care record."}
      />
      {loading ? (
        <div className="empty-state" role="status">
          Loading available consultations…
        </div>
      ) : serviceLoadError ? (
        <section className="empty-state empty-state-error">
          <p role="alert">{serviceLoadError}</p>
          <button
            className="btn btn-secondary"
            onClick={() => {
              setLoading(true);
              setServicesReload((x) => x + 1);
            }}
          >
            Try again
          </button>
        </section>
      ) : !services.length ? (
        <section className="empty-state">
          <span className="empty-symbol">
            <CalendarDays size={22} />
          </span>
          <h2>Online booking is being set up</h2>
          <p>
            The practice has not configured an active consultation service yet.
            Please check back later.
          </p>
        </section>
      ) : submitted ? (
        <section className="booking-success">
          <div className="booking-success-icon">
            <CheckCircle2 size={23} />
          </div>
          <span className="eyebrow">
            REQUEST {submitted.status.replaceAll("_", " ")}
          </span>
          <h2>We’ve sent your appointment request.</h2>
          <p>
            {message ||
              "The practice will review your request. It is not confirmed until the doctor responds."}
          </p>
          <dl className="booking-summary">
            <div>
              <dt>Consultation</dt>
              <dd>
                {service?.name ?? "Consultation"} ·{" "}
                {method.replaceAll("_", " ")}
              </dd>
            </div>
            <div>
              <dt>Requested time</dt>
              <dd>
                {chosen
                  ? dateTime(chosen.startsAt, service?.timezone)
                  : new Intl.DateTimeFormat(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: service?.timezone || "Asia/Kolkata",
                    }).format(new Date(selected))}
              </dd>
            </div>
            <div>
              <dt>Request reference</dt>
              <dd>{submitted.id}</dd>
            </div>
            <div>
              <dt>Payment</dt>
              <dd>No payment collected</dd>
            </div>
          </dl>
          {attachmentError && (
            <div className="form-error" role="alert">
              <p>{attachmentError}</p>
              {attachment && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={busy}
                  onClick={() => void retryAttachment()}
                >
                  Retry attaching file
                </button>
              )}
            </div>
          )}
          <div className="portal-actions">
            <Link
              className="btn btn-primary"
              to={`/patient/appointments/${submitted.id}`}
            >
              View appointment
            </Link>
            <button className="btn btn-secondary" onClick={startAnother}>
              Book another visit
            </button>
          </div>
        </section>
      ) : (
        <>
          <ol className="booking-progress" aria-label="Booking steps">
            {steps.map((label, index) => (
              <li
                key={label}
                aria-current={index === step ? "step" : undefined}
                className={
                  index === step ? "current" : index < step ? "done" : ""
                }
              >
                <span>{index < step ? "✓" : index + 1}</span>
                <strong>{label}</strong>
              </li>
            ))}
          </ol>
          <form
            className="booking-form booking-wizard"
            onSubmit={
              step === 3
                ? submit
                : (e) => {
                  e.preventDefault();
                  nextStep();
                }
            }
          >
            <div className="booking-step-heading">
              <span className="eyebrow">
                STEP {step + 1} OF {steps.length}
              </span>
              <h2>
                {
                  [
                    "Choose your consultation",
                    "Choose a date and time",
                    "What would you like to discuss?",
                    "Review your request",
                  ][step]
                }
              </h2>
              <p>
                {
                  [
                    "Select the visit type that fits your needs. Only services currently offered by the practice are shown.",
                    "Available times are based on the practice schedule and shown in the practice’s timezone.",
                    "A short description helps the doctor prepare. You can add a relevant document if you have one.",
                    "Check the details before sending your request to the practice.",
                  ][step]
                }
              </p>
            </div>
            {step === 0 && (
              <div className="booking-service-options">
                {services.map((s) => (
                  <button
                    type="button"
                    key={s.id}
                    aria-pressed={serviceId === s.id}
                    className={`booking-service-option ${serviceId === s.id ? "selected" : ""}`}
                    onClick={() => {
                      setServiceId(s.id);
                      setMethod("");
                      setDate(clinicToday(s.timezone));
                      setError("");
                    }}
                  >
                    <span>
                      <strong>{s.name}</strong>
                      <small>{s.description ? `${s.description} · ` : ""}{s.duration_minutes} min</small>
                    </span>
                    <span className="booking-price">
                      ₹{(Number(s.fee_paise) / 100).toFixed(2)}
                    </span>
                    {serviceId === s.id && <CheckCircle2 size={18} />}
                  </button>
                ))}
                {!service && <p className="booking-selection-hint">Choose a consultation to see the available ways to meet.</p>}
                {service && (
                  <fieldset className="form-group booking-methods">
                    <legend>How would you like to connect?</legend>
                    {service.methods.map((m) => (
                      <label className="booking-method-option" key={m}>
                        <input
                          type="radio"
                          name="booking-method"
                          checked={method === m}
                          onChange={() => setMethod(m)}
                        />
                        <span>
                          <strong>{m.replaceAll("_", " ")}</strong>
                          <small>
                            {m === "GOOGLE_MEET"
                              ? "Request an online visit. Meeting details appear after the practice confirms the appointment."
                              : m === "WHATSAPP"
                                ? "Request a WhatsApp consultation; the practice will confirm next steps."
                                : "Request an in-person visit with the practice."}
                          </small>
                        </span>
                      </label>
                    ))}
                  </fieldset>
                )}
              </div>
            )}
            {step === 1 && (
              <div className="booking-time-panel">
                <label>
                  Date
                  <input
                    className="booking-date-input"
                    type="date"
                    min={clinicToday(service?.timezone)}
                    max={clinicDateOffset(service?.timezone, 89)}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </label>
                <div className="booking-time-meta">
                  <strong>
                    {date
                      ? new Intl.DateTimeFormat(undefined, {
                        dateStyle: "full",
                      }).format(new Date(`${date}T12:00:00`))
                      : "Choose a date"}
                  </strong>
                  <span>{service?.timezone || "Practice local time"}</span>
                </div>
                <fieldset className="slot-fieldset">
                  <legend>Available times</legend>
                  {slotsLoading ? (
                    <p role="status">Checking open times…</p>
                  ) : slotLoadError ? (
                    <div className="booking-no-slots" role="alert">
                      <p>Available times could not be loaded.</p>
                      <small>{slotLoadError}</small>
                      <button type="button" className="btn btn-secondary" onClick={() => setSlotsReload((value) => value + 1)}>Try again</button>
                    </div>
                  ) : !slots.length ? (
                    <div className="booking-no-slots">
                      <p>No open times on this date.</p>
                      <small>Try another date within the next 90 days.</small>
                    </div>
                  ) : (
                    <div className="slot-grid">
                      {slots.map((slot) => (
                        <button
                          className={`slot-choice ${selected === slot.startsAt ? "selected" : ""}`}
                          type="button"
                          key={slot.startsAt}
                          aria-pressed={selected === slot.startsAt}
                          onClick={() => setSelected(slot.startsAt)}
                        >
                          {new Intl.DateTimeFormat(undefined, {
                            timeStyle: "short",
                            timeZone: service?.timezone || "Asia/Kolkata",
                          }).format(new Date(slot.startsAt))}
                        </button>
                      ))}
                    </div>
                  )}
                </fieldset>
              </div>
            )}
            {step === 2 && (
              <div className="booking-concern-fields">
                <label>
                  What would you like help with?
                  <textarea
                    autoFocus
                    required
                    maxLength={3000}
                    rows={4}
                    value={problem}
                    onChange={(e) => setProblem(e.target.value)}
                    placeholder="For example, what has changed or what would you like to understand?"
                  />
                  <small>
                    Keep it brief. You can share more during your consultation.
                  </small>
                </label>
                <label>
                  Symptoms or questions{" "}
                  <span className="optional-label">Optional</span>
                  <textarea
                    maxLength={3000}
                    rows={3}
                    value={symptoms}
                    onChange={(e) => setSymptoms(e.target.value)}
                  />
                </label>
                <label>
                  How severe does it feel?{" "}
                  <span className="optional-label">Optional</span>
                  <Select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value)}
                  >
                    <option value="">Choose a level</option>
                    {Array.from({ length: 10 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {i + 1} / 10
                      </option>
                    ))}
                  </Select>
                </label>
                <fieldset className="booking-attachment">
                  <legend>
                    Add a supporting document{" "}
                    <span className="optional-label">Optional</span>
                  </legend>
                  <p>
                    PDF, JPG, or PNG up to 8 MB. The file is private to you and
                    the practice connected to your appointment.
                  </p>
                  <label>
                    Document type
                    <Select
                      value={attachmentCategory}
                      onChange={(e) => setAttachmentCategory(e.target.value)}
                    >
                      <option>Prescription</option>
                      <option>Lab report</option>
                      <option>Imaging</option>
                      <option>Other</option>
                    </Select>
                  </label>
                  <label className="file-picker-label">
                    Choose a file
                    <input
                      id="booking-prescription-file"
                      type="file"
                      accept="application/pdf,image/jpeg,image/png"
                      onChange={(e) => {
                        setAttachment(e.target.files?.[0] ?? null);
                        setAppointmentId("");
                        setAttachmentError("");
                      }}
                    />
                  </label>
                  {attachment && (
                    <small className="selected-file">
                      Selected: {attachment.name}
                    </small>
                  )}
                </fieldset>
              </div>
            )}
            {step === 3 && (
              <div className="booking-review">
                <div className="booking-review-main">
                  <dl className="booking-summary">
                    <div>
                      <dt>Consultation</dt>
                      <dd>{service?.name}</dd>
                    </div>
                    <div>
                      <dt>Doctor</dt>
                      <dd>{service?.display_name || "Practice clinician"}</dd>
                    </div>
                    <div>
                      <dt>Date & time</dt>
                      <dd>
                        {chosen ? dateTime(chosen.startsAt, service?.timezone) : "Choose a time"}
                      </dd>
                    </div>
                    <div>
                      <dt>Method</dt>
                      <dd>{method.replaceAll("_", " ")}</dd>
                    </div>
                    <div>
                      <dt>Your concern</dt>
                      <dd>{problem}</dd>
                    </div>
                    <div>
                      <dt>Supporting document</dt>
                      <dd>{attachment?.name ?? "None added"}</dd>
                    </div>
                    <div>
                      <dt>Consultation fee</dt>
                      <dd>
                        ₹
                        {service
                          ? (Number(service.fee_paise) / 100).toFixed(2)
                          : "—"}
                      </dd>
                    </div>
                  </dl>
                </div>
                <aside className="booking-payment-note">
                  <strong>Payment is not collected here</strong>
                  <p>
                    This booking request does not charge you. The practice will
                    respond to the request through your appointments.
                  </p>
                </aside>
              </div>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="booking-wizard-actions">
              {step > 0 && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={busy}
                  onClick={() => {
                    setError("");
                    setStep((x) => x - 1);
                  }}
                >
                  Back
                </button>
              )}
              {step < 3 ? (
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={slotsLoading}
                >
                  {step === 2 ? "Review request" : "Continue"}
                </button>
              ) : (
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={busy || !selected || !problem.trim()}
                >
                  {busy ? "Sending request…" : "Send appointment request"}
                </button>
              )}
            </div>
          </form>
        </>
      )}
    </main>
  );
}
