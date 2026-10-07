-- Small local/private uploads remain within PostgreSQL's authenticated boundary.
ALTER TABLE medical_records ADD COLUMN file_bytes bytea;
ALTER TABLE medical_records ADD COLUMN sha256 char(64);
