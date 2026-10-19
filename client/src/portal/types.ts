export type Appointment = {
  id: string;
  patient_id?: string;
  starts_at: string;
  ends_at: string;
  status: string;
  method: string;
  meeting_url?: string | null;
  service_name: string;
  doctor_name?: string;
  doctorName?: string;
  other_person?: string;
  patient_name?: string;
};
