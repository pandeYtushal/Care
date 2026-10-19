import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { Select } from "../components/ui/select";
import { api, ApiError } from "../lib/api";
import { PageHeader } from "../portal/PortalPrimitives";

type Rule = {
  id?: string;
  weekday: number;
  startsAt: string;
  endsAt: string;
  slotMinutes: number;
  bufferMinutes: number;
};
function Empty({ title, text }: { title: string; text: string }) {
  return <div className="empty-state"><h2>{title}</h2><p>{text}</p></div>;
}

export default function DoctorAvailabilityPage() {
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
      <PageHeader
        eyebrow="PRACTICE SETTINGS"
        title="Availability"
        description="Set the weekly hours used to calculate bookable appointment times."
      />
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
          <section className="availability-workspace" aria-label="Weekly availability editor">
          <div className="availability-toolbar">
            <div><h2>Weekly hours</h2><p>{rules.length ? `${rules.length} time ${rules.length === 1 ? "block" : "blocks"} in your schedule` : "No bookable hours are set yet"}</p></div>
            <button className="btn btn-secondary availability-add" onClick={add}><Plus size={16} aria-hidden="true" />Add hours</button>
          </div>
          <div className="availability-list availability-card-grid">
            {rules.map((r, i) => (
              <div className="availability-row" key={r.id ?? i}>
                <div className="availability-row-heading">
                  <label>
                    Day
                    <Select value={r.weekday} onChange={(e) => change(i, "weekday", e.target.value)}>
                      {weekdays.map((d, n) => <option key={d} value={n}>{d}</option>)}
                    </Select>
                  </label>
                  <button type="button" className="availability-remove" aria-label={`Remove ${weekdays[r.weekday]} hours`} onClick={() => setRules((x) => x.filter((_, n) => n !== i))}>
                    <Trash2 size={15} aria-hidden="true" /><span>Remove</span>
                  </button>
                </div>
                <div className="availability-time-range">
                  <label>From<input type="time" value={r.startsAt} onChange={(e) => change(i, "startsAt", e.target.value)} /></label>
                  <span className="availability-range-separator" aria-hidden="true">to</span>
                  <label>To<input type="time" value={r.endsAt} onChange={(e) => change(i, "endsAt", e.target.value)} /></label>
                </div>
                <div className="availability-visit-settings">
                  <label>Appointment length<input aria-label="Appointment length in minutes" type="number" min={10} max={240} step={5} value={r.slotMinutes} onChange={(e) => change(i, "slotMinutes", e.target.value)} /></label>
                  <label>Buffer between visits<input aria-label="Buffer between visits in minutes" type="number" min={0} max={120} step={5} value={r.bufferMinutes} onChange={(e) => change(i, "bufferMinutes", e.target.value)} /></label>
                </div>
              </div>
            ))}
            {!rules.length && (
              <Empty
                title="No weekly hours set"
                text="Add your clinic hours to record your schedule."
              />
            )}
          </div>
          <div className="availability-footer">
            <div className="availability-feedback">
              {error && <p className="form-error" role="alert">{error}</p>}
              {message && <p className="form-notice" role="status">{message}</p>}
            </div>
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
          </section>
        </>
      )}
    </main>
  );
}

