import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import * as z from "zod/mini";
import { Button } from "../components/ui/button";
import { Select } from "../components/ui/select";
import { api, ApiError } from "../lib/api";
import { PageHeader } from "./PortalPrimitives";

type ProfileFormValues = { fullName: string; dateOfBirth: string; gender: string };
const genderOptions = ["Female", "Male", "Non-binary", "Other", "Prefer not to say"];

export default function ProfilePage({ role }: { role: "PATIENT" | "DOCTOR" }) {
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const schema = useMemo(() => z.object({
    // Zod Mini keeps this lazy route small while preserving the same validation rules.
    fullName: z.string().check(z.trim(), z.minLength(1, "Enter your name."), z.maxLength(120, "Use 120 characters or fewer.")),
    dateOfBirth: z.string().check(z.refine(
      (value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)),
      "Enter a valid date of birth.",
    )),
    gender: z.string().check(
      z.maxLength(40, "Use 40 characters or fewer."),
      z.refine((value) => role !== "PATIENT" || value.trim().length > 0, "Select a gender option to continue."),
    ),
  }), [role]);
  const resolver = useCallback<Resolver<ProfileFormValues>>(async (values) => {
    const result = schema.safeParse(values);
    if (result.success) return { values: result.data, errors: {} };

    const errors: Record<string, { type: string; message: string }> = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0];
      if (typeof field === "string" && !errors[field]) errors[field] = { type: "validation", message: issue.message };
    }
    return { values: {}, errors };
  }, [schema]);
  const { register, handleSubmit, reset, formState: { errors, isDirty, isSubmitting } } = useForm<ProfileFormValues>({
    resolver,
    defaultValues: { fullName: "", dateOfBirth: "", gender: "" },
  });

  const load = useCallback(() => {
    setLoading(true);
    setLoadError("");
    void api<{ profile: Record<string, unknown> }>("/portal/profile")
      .then((result) => {
        setProfile(result.profile);
        reset({
          fullName: String(result.profile?.full_name ?? result.profile?.display_name ?? ""),
          dateOfBirth: String(result.profile?.date_of_birth ?? "").slice(0, 10),
          gender: String(result.profile?.gender ?? ""),
        });
        setError("");
      })
      .catch((reason: unknown) => {
        const details = reason instanceof ApiError ? reason.message : "Could not load profile.";
        setError(details);
        setLoadError(details);
      })
      .finally(() => setLoading(false));
  }, [reset]);

  useEffect(() => { load(); }, [load]);

  async function save(values: ProfileFormValues) {
    setError("");
    setMessage("");
    try {
      const result = await api<{ message: string }>("/portal/profile", {
        method: "PATCH",
        body: JSON.stringify(values),
      });
      setMessage(result.message);
      load();
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Could not save profile.");
    }
  }

  return (
    <main className={`portal-content profile-page ${role === "PATIENT" ? "patient-profile-page" : "doctor-profile-page"}`}>
      <PageHeader eyebrow="ACCOUNT PROFILE" title={role === "DOCTOR" ? "Practice profile" : "Your profile"} description="Keep your account details up to date." />
      {loading ? <div className="empty-state" role="status">Loading profile…</div>
        : loadError ? <section className="empty-state empty-state-error" role="alert"><p>{loadError}</p><button className="btn btn-secondary" onClick={load}>Try again</button></section>
          : <section className="card profile-editor-card">
            <form className="form-group profile-form" onSubmit={handleSubmit(save)} noValidate>
              <label className="profile-field profile-field-name">
                {role === "DOCTOR" ? "Doctor name" : "Full name"}
                <input autoComplete="name" maxLength={120} aria-invalid={Boolean(errors.fullName)} {...register("fullName")} />
                {errors.fullName && <small className="field-error" role="alert">{errors.fullName.message}</small>}
              </label>
              {role === "PATIENT" && <>
                <label className="profile-field profile-field-birth">
                  Date of birth
                  <input type="date" autoComplete="bday" aria-invalid={Boolean(errors.dateOfBirth)} {...register("dateOfBirth")} />
                  {errors.dateOfBirth && <small className="field-error" role="alert">{errors.dateOfBirth.message}</small>}
                </label>
                <label className="profile-field profile-field-gender">
                  <span>Gender <span className="required-field">Required</span></span>
                  <Select className="profile-gender-select" aria-invalid={Boolean(errors.gender)} {...register("gender")}>
                    <option value="" disabled>Select an option</option>
                    {genderOptions.map((option) => <option value={option} key={option}>{option}</option>)}
                  </Select>
                  {errors.gender && <small className="field-error" role="alert">{errors.gender.message}</small>}
                </label>
              </>}
              {typeof profile?.email === "string" && <p className="profile-meta profile-contact">Email <strong>{profile.email}</strong>{typeof profile.phone === "string" && <> <span aria-hidden="true">·</span> Phone <strong>{profile.phone}</strong></>}</p>}
              {error && <p className="form-error" role="alert">{error}</p>}
              {message && <p className="form-notice" role="status">{message}</p>}
              {isDirty || isSubmitting ? <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving…" : "Save changes"}</Button> : <span className="profile-save-state" role="status">Profile is up to date</span>}
            </form>
          </section>}
    </main>
  );
}
