-- Initial relational model for a single-doctor clinic with role-ready accounts.
-- Apply only in a local/development database until the server authorization layer exists.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_role AS ENUM ('PATIENT', 'DOCTOR', 'ADMIN');
CREATE TYPE appointment_status AS ENUM ('PENDING', 'PAYMENT_PENDING', 'CONFIRMED', 'UPCOMING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'RESCHEDULED', 'NO_SHOW');
CREATE TYPE consultation_method AS ENUM ('GOOGLE_MEET', 'WHATSAPP', 'IN_PERSON');
CREATE TYPE payment_status AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');
CREATE TYPE record_visibility AS ENUM ('PATIENT_AND_DOCTOR', 'DOCTOR_ONLY');

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  phone text,
  password_hash text NOT NULL,
  role user_role NOT NULL,
  email_verified_at timestamptz,
  disabled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_lower_unique ON users (lower(email));
CREATE UNIQUE INDEX users_phone_unique ON users (phone) WHERE phone IS NOT NULL;

CREATE TABLE patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
  full_name text NOT NULL,
  date_of_birth date,
  gender text,
  emergency_contact jsonb,
  medical_conditions text[] NOT NULL DEFAULT '{}',
  allergies text[] NOT NULL DEFAULT '{}',
  current_medications text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE doctors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
  display_name text NOT NULL,
  qualifications text[] NOT NULL DEFAULT '{}',
  specializations text[] NOT NULL DEFAULT '{}',
  bio text,
  contact_email text,
  contact_phone text,
  whatsapp_number text,
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  branding jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL REFERENCES doctors(id) ON DELETE RESTRICT,
  name text NOT NULL,
  description text,
  duration_minutes integer NOT NULL CHECK (duration_minutes BETWEEN 10 AND 240),
  fee_paise integer NOT NULL CHECK (fee_paise >= 0),
  currency char(3) NOT NULL DEFAULT 'INR',
  methods consultation_method[] NOT NULL DEFAULT '{GOOGLE_MEET,WHATSAPP}',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE availability_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  starts_at time NOT NULL,
  ends_at time NOT NULL CHECK (ends_at > starts_at),
  slot_minutes integer NOT NULL CHECK (slot_minutes BETWEEN 10 AND 240),
  buffer_minutes integer NOT NULL DEFAULT 0 CHECK (buffer_minutes BETWEEN 0 AND 120),
  active boolean NOT NULL DEFAULT true
);
CREATE INDEX availability_rules_doctor_weekday_idx ON availability_rules(doctor_id, weekday) WHERE active;

CREATE TABLE availability_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL CHECK (ends_at > starts_at),
  label text,
  unavailable boolean NOT NULL DEFAULT true
);
CREATE INDEX availability_exceptions_doctor_range_idx ON availability_exceptions(doctor_id, starts_at, ends_at);

CREATE TABLE appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  doctor_id uuid NOT NULL REFERENCES doctors(id) ON DELETE RESTRICT,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL CHECK (ends_at > starts_at),
  status appointment_status NOT NULL DEFAULT 'PENDING',
  method consultation_method NOT NULL,
  meeting_url text,
  problem_description text,
  symptoms text,
  symptoms_started text,
  severity smallint CHECK (severity BETWEEN 1 AND 10),
  medication_notes text,
  condition_notes text,
  allergy_notes text,
  previous_treatments text,
  additional_notes text,
  rescheduled_from uuid REFERENCES appointments(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX appointments_patient_schedule_idx ON appointments(patient_id, starts_at DESC);
CREATE INDEX appointments_doctor_schedule_idx ON appointments(doctor_id, starts_at);
-- Exclusion is the final guard against concurrent bookings for the same doctor.
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE appointments ADD CONSTRAINT appointments_doctor_slot_no_overlap
  EXCLUDE USING gist (doctor_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&)
  WHERE (status IN ('PENDING', 'PAYMENT_PENDING', 'CONFIRMED', 'UPCOMING', 'IN_PROGRESS'));

CREATE TABLE consultations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL UNIQUE REFERENCES appointments(id) ON DELETE RESTRICT,
  notes text,
  assessment text,
  diagnosis_code text,
  follow_up_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE medical_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL,
  uploaded_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  storage_key text NOT NULL UNIQUE,
  original_filename text NOT NULL,
  content_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes > 0),
  visibility record_visibility NOT NULL DEFAULT 'PATIENT_AND_DOCTOR',
  document_date date,
  category text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX medical_records_patient_date_idx ON medical_records(patient_id, created_at DESC);

CREATE TABLE prescriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id uuid NOT NULL REFERENCES consultations(id) ON DELETE RESTRICT,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  doctor_id uuid NOT NULL REFERENCES doctors(id) ON DELETE RESTRICT,
  instructions text,
  issued_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE prescription_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id uuid NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  medicine text NOT NULL,
  dosage text,
  frequency text,
  duration text,
  instructions text,
  position smallint NOT NULL DEFAULT 0
);

CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES appointments(id) ON DELETE RESTRICT,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  provider text NOT NULL DEFAULT 'RAZORPAY',
  provider_order_id text UNIQUE,
  provider_payment_id text UNIQUE,
  amount_paise integer NOT NULL CHECK (amount_paise >= 0),
  currency char(3) NOT NULL DEFAULT 'INR',
  status payment_status NOT NULL DEFAULT 'PENDING',
  verified_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payments_patient_date_idx ON payments(patient_id, created_at DESC);

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL,
  channel text NOT NULL,
  template_key text NOT NULL,
  status text NOT NULL DEFAULT 'QUEUED',
  sent_at timestamptz,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_unread_idx ON notifications(user_id, created_at DESC) WHERE read_at IS NULL;

CREATE TABLE notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email_enabled boolean NOT NULL DEFAULT true,
  whatsapp_enabled boolean NOT NULL DEFAULT false,
  sms_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id bigserial PRIMARY KEY,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  request_id text,
  ip_hash text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_resource_idx ON audit_logs(resource_type, resource_id, created_at DESC);
CREATE INDEX audit_logs_actor_idx ON audit_logs(actor_user_id, created_at DESC);

-- OAuth credentials and provider secrets belong in a secrets manager, never this table.
CREATE TABLE integration_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('GOOGLE_CALENDAR', 'WHATSAPP_BUSINESS')),
  external_account_ref text,
  connected_at timestamptz,
  disconnected_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}',
  UNIQUE (doctor_id, provider)
);
