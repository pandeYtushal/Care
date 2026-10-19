import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarDays, Check, ShieldCheck } from "lucide-react";
import { api, apiBaseUrl, ApiError } from "../lib/api";
import { PageHeader } from "../portal/PortalPrimitives";

export default function DoctorIntegrationsPage() {
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
    <main className="portal-content doctor-integrations-page">
      <PageHeader
        eyebrow="PRACTICE SETTINGS"
        title="Integrations"
        description="Connect the practice calendar to schedule accepted online consultations."
      />
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
        <section className="card integration-card">
          <div className="integration-header">
            <div className="integration-title">
              <CalendarDays size={22} aria-hidden="true" />
              <div>
                <h2>Google Calendar and Meet</h2>
                <span className={`integration-status ${status?.connected ? "is-connected" : "is-disconnected"}`}>
                  {status?.connected ? `Connected as ${status.email}` : "Not connected"}
                </span>
              </div>
            </div>
            <div className="portal-actions">
              {status?.connected ? (
                <button
                  className="btn btn-secondary"
                  disabled={busy}
                  onClick={() => void disconnect()}
                >
                  {busy ? "Disconnecting…" : "Disconnect calendar"}
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
          </div>
          <p className="integration-description">
            Accepted Google Meet visits are added to your practice calendar automatically.
          </p>
          <ul className="integration-benefits">
            <li><Check size={15} aria-hidden="true" /> A calendar event is created when you accept a request.</li>
            <li><Check size={15} aria-hidden="true" /> The Meet link is saved with the appointment.</li>
            <li><Check size={15} aria-hidden="true" /> Google sends the patient a calendar invitation.</li>
          </ul>
          <p className="integration-privacy-note">
            <ShieldCheck size={16} aria-hidden="true" /> Patient symptoms and notes are not added to the calendar event.
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
        </section>
      )}
    </main>
  );
}

