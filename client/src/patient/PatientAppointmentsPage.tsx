import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import { AppointmentRows } from "../portal/AppointmentRows";
import { PageHeader, Status } from "../portal/PortalPrimitives";
import type { Appointment } from "../portal/types";

export default function PatientAppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api<{ appointments: Appointment[] }>("/portal/appointments")
      .then((result) => {
        if (active) setAppointments(result.appointments ?? []);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(
          reason instanceof ApiError
            ? reason.message
            : "Could not load appointments. Check your connection and retry.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reload]);

  const retry = () => setReload((value) => value + 1);

  return (
    <main className="portal-content patient-appointments-page">
      <PageHeader
        eyebrow="YOUR VISITS"
        title="Appointments"
        description="Review requests, confirmed consultations, and previous visits."
      />
      <Status loading={loading} error={error} onRetry={retry}>
        <section className="portal-panel appointments-workspace">
          <AppointmentRows items={appointments} onChanged={retry} />
        </section>
      </Status>
    </main>
  );
}
