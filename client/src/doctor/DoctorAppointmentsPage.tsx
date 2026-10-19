import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import { AppointmentRows } from "../portal/AppointmentRows";
import { PageHeader, Status } from "../portal/PortalPrimitives";
import type { Appointment } from "../portal/types";

export default function DoctorAppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    api<{ appointments: Appointment[] }>("/portal/appointments")
      .then((result) => { if (alive) setAppointments(result.appointments); })
      .catch((reason: unknown) => {
        if (!alive) return;
        setError(reason instanceof ApiError ? reason.message : "Could not load appointments. Check your connection and retry.");
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reload]);

  return (
    <main className="portal-content doctor-appointments-page">
      <PageHeader
        eyebrow="PRACTICE SCHEDULE"
        title="Appointments"
        description="Review requests, upcoming consultations, and recent visits."
      />
      <Status loading={loading} error={error} onRetry={() => setReload((value) => value + 1)}>
        <section className="doctor-appointments-workspace" aria-label="Appointment management">
          <AppointmentRows items={appointments} doctor onChanged={() => setReload((value) => value + 1)} />
        </section>
      </Status>
    </main>
  );
}
