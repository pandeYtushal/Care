CREATE TABLE appointment_reschedule_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  doctor_id uuid NOT NULL REFERENCES doctors(id) ON DELETE RESTRICT,
  proposed_starts_at timestamptz NOT NULL,
  proposed_ends_at timestamptz NOT NULL CHECK (proposed_ends_at > proposed_starts_at),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','ACCEPTED','DECLINED','CANCELLED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE appointment_reschedule_requests
  ADD CONSTRAINT reschedule_request_appointment_party_fk
  FOREIGN KEY (appointment_id,patient_id,doctor_id)
  REFERENCES appointments(id,patient_id,doctor_id) ON DELETE CASCADE;
CREATE UNIQUE INDEX appointment_reschedule_one_pending_idx
  ON appointment_reschedule_requests(appointment_id) WHERE status='PENDING';
CREATE INDEX appointment_reschedule_doctor_slot_idx
  ON appointment_reschedule_requests(doctor_id,proposed_starts_at,proposed_ends_at) WHERE status='PENDING';
