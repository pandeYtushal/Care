-- Keep patient, doctor, service, consultation, and payment relationships consistent.
CREATE UNIQUE INDEX services_doctor_id_id_uq ON services(doctor_id, id);
ALTER TABLE appointments
  ADD CONSTRAINT appointments_id_patient_doctor_uq UNIQUE (id, patient_id, doctor_id),
  ADD CONSTRAINT appointments_id_patient_uq UNIQUE (id, patient_id),
  ADD CONSTRAINT appointments_service_doctor_fk FOREIGN KEY (doctor_id, service_id)
    REFERENCES services(doctor_id, id) ON DELETE RESTRICT;

ALTER TABLE payments
  ADD CONSTRAINT payments_appointment_patient_fk FOREIGN KEY (appointment_id, patient_id)
    REFERENCES appointments(id, patient_id) ON DELETE RESTRICT;

ALTER TABLE consultations ADD COLUMN patient_id uuid;
ALTER TABLE consultations ADD COLUMN doctor_id uuid;
UPDATE consultations c SET patient_id = a.patient_id, doctor_id = a.doctor_id
  FROM appointments a WHERE a.id = c.appointment_id;
ALTER TABLE consultations ALTER COLUMN patient_id SET NOT NULL;
ALTER TABLE consultations ALTER COLUMN doctor_id SET NOT NULL;
ALTER TABLE consultations
  ADD CONSTRAINT consultations_patient_fk FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE RESTRICT,
  ADD CONSTRAINT consultations_doctor_fk FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE RESTRICT,
  ADD CONSTRAINT consultations_appointment_patient_doctor_fk
    FOREIGN KEY (appointment_id, patient_id, doctor_id)
    REFERENCES appointments(id, patient_id, doctor_id) ON DELETE RESTRICT,
  ADD CONSTRAINT consultations_id_patient_doctor_uq UNIQUE (id, patient_id, doctor_id);

ALTER TABLE prescriptions
  ADD CONSTRAINT prescriptions_consultation_patient_doctor_fk
    FOREIGN KEY (consultation_id, patient_id, doctor_id)
    REFERENCES consultations(id, patient_id, doctor_id) ON DELETE RESTRICT;

CREATE INDEX appointments_doctor_status_start_idx ON appointments(doctor_id, status, starts_at);
CREATE INDEX appointments_patient_status_start_idx ON appointments(patient_id, status, starts_at DESC);
CREATE UNIQUE INDEX availability_rules_no_duplicate_idx
  ON availability_rules(doctor_id, weekday, starts_at, ends_at) WHERE active;

-- Provider event IDs make webhook retries safe to recognize before side effects run.
CREATE TABLE webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  provider_event_id text NOT NULL,
  event_type text NOT NULL,
  payload_sha256 char(64) NOT NULL,
  processing_status text NOT NULL DEFAULT 'RECEIVED'
    CHECK (processing_status IN ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED')),
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE (provider, provider_event_id)
);
