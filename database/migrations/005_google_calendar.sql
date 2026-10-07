-- Calendar credentials are encrypted by the application before they reach PostgreSQL.
CREATE TABLE doctor_google_calendar_tokens (
  doctor_id uuid PRIMARY KEY REFERENCES doctors(id) ON DELETE CASCADE,
  connected_email text NOT NULL,
  access_token_ciphertext text NOT NULL,
  refresh_token_ciphertext text NOT NULL,
  access_token_expires_at timestamptz NOT NULL,
  granted_scopes text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE appointments ADD COLUMN google_calendar_event_id text;
CREATE UNIQUE INDEX appointments_google_event_unique_idx
  ON appointments(google_calendar_event_id) WHERE google_calendar_event_id IS NOT NULL;
