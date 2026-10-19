import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../lib/api";
import { Checkbox } from "../components/ui/checkbox";
import { PageHeader } from "../portal/PortalPrimitives";

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
function Empty({ title, text }: { title: string; text: string }) {
  return <div className="empty-state"><h2>{title}</h2><p>{text}</p></div>;
}

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
export default function DoctorServicesPage() {
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
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
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
  function resetForm() {
    setEditingServiceId(null);
    setName("");
    setDescription("");
    setDuration(30);
    setFee("");
    setMethods(["GOOGLE_MEET"]);
  }
  function edit(service: Service) {
    setEditingServiceId(service.id);
    setName(service.name);
    setDescription(service.description ?? "");
    setDuration(Number(service.duration_minutes));
    setFee((Number(service.fee_paise) / 100).toFixed(2));
    setMethods(service.methods);
    setError("");
    setNotice("");
    document.querySelector(".service-form-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api(editingServiceId ? `/portal/services/${editingServiceId}` : "/portal/services", {
        method: editingServiceId ? "PATCH" : "POST",
        body: JSON.stringify({
          name,
          description,
          durationMinutes: duration,
          feeRupees: Number(fee),
          methods,
          ...(editingServiceId ? { active: services.find((service) => service.id === editingServiceId)?.active ?? true } : {}),
        }),
      });
      const wasEditing = Boolean(editingServiceId);
      resetForm();
      setNotice(wasEditing ? "Service changes saved." : "Service created and available to patients.");
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
    <main className="portal-content doctor-services-page">
      <PageHeader
        eyebrow="BOOKING SETUP"
        title="Consultation services"
        description="Configure what patients can request, including the fee and meeting options. Fees are displayed as a quote only; online payments are not connected."
      />
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
                <div className="service-card-info">
                  <div className="service-card-heading">
                    <strong>{s.name}</strong>
                    <span className={`service-state ${s.active ? "is-active" : "is-paused"}`}>
                      {s.active ? "Bookings open" : "Bookings paused"}
                    </span>
                  </div>
                  <p>
                    {s.description || "Consultation"} · {s.duration_minutes}{" "}
                    minutes · ₹{(Number(s.fee_paise) / 100).toFixed(2)}
                  </p>
                  <small>
                    {s.methods.map((m) => labels[m] ?? m).join(" · ")}
                  </small>
                </div>
                <div className="service-card-actions">
                  <button className="btn btn-secondary" disabled={busy} onClick={() => edit(s)}>Edit</button>
                  <button
                    className="btn btn-secondary"
                    disabled={busy}
                    onClick={() => void toggle(s)}
                  >
                    {s.active ? "Pause bookings" : "Enable bookings"}
                  </button>
                </div>
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
            <h2>{editingServiceId ? "Edit consultation service" : "Add consultation service"}</h2>
            <p className="service-form-intro">Set the details patients will see when they choose a consultation.</p>
            <form className="form-group" onSubmit={save}>
              <label className="service-field-name">
                Service name
                <input
                  required
                  maxLength={120}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Online consultation"
                />
              </label>
              <label className="service-field-description">
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
                    <Checkbox
                      checked={methods.includes(key)}
                      onChange={() => toggleMethod(key)}
                    />
                    {label}
                  </label>
                ))}
              </fieldset>
              <div className="service-form-actions">
                <button className="btn btn-primary" disabled={busy || methods.length === 0}>
                  {busy ? "Saving…" : editingServiceId ? "Save changes" : "Add service"}
                </button>
                {editingServiceId && <button type="button" className="btn btn-secondary" disabled={busy} onClick={resetForm}>Cancel edit</button>}
              </div>
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
