import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import { PageHeader, PrescriptionList, Status } from "../portal/PortalPrimitives";

export default function PatientPrescriptionsPage() {
  const [prescriptions, setPrescriptions] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api<{ prescriptions: Record<string, unknown>[] }>("/portal/prescriptions")
      .then((result) => {
        if (active) setPrescriptions(result.prescriptions ?? []);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(
          reason instanceof ApiError
            ? reason.message
            : "Could not load prescriptions. Check your connection and retry.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reload]);

  return (
    <main className="portal-content patient-prescriptions-page">
      <PageHeader
        eyebrow="YOUR TREATMENT"
        title="Prescriptions"
        description="Prescriptions issued by your clinician appear here after a visit."
      />
      <Status
        loading={loading}
        error={error}
        onRetry={() => setReload((value) => value + 1)}
      >
        <section className="portal-panel prescriptions-workspace">
          <PrescriptionList prescriptions={prescriptions} role="PATIENT" />
        </section>
      </Status>
    </main>
  );
}
