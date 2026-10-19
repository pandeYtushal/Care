import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import type { Appointment } from "./types";

export type PortalOverview = {
  appointments: Appointment[];
  counts: Record<string, string | number>;
};

/** Shared data contract only; each role owns its own dashboard composition. */
export function usePortalOverview() {
  const [data, setData] = useState<PortalOverview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api<PortalOverview>("/portal/overview")
      .then((result) => {
        if (active) setData(result);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(
          reason instanceof ApiError ? reason.message : "Could not load your overview.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reload]);

  return { data, error, loading, retry: () => setReload((value) => value + 1) };
}

export function nextActiveAppointment(appointments: Appointment[]) {
  return appointments.find(
    (appointment) =>
      new Date(appointment.starts_at).getTime() >= Date.now() &&
      !["CANCELLED", "NO_SHOW", "COMPLETED"].includes(appointment.status),
  );
}
