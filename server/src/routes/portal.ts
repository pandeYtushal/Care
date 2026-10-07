import { Router } from 'express';
import { pool } from '../db';
import { asyncRoute, HttpError, requiredUuid } from '../http';
import { requireAuth, requireRole } from '../middleware/auth';
import { createAppointmentEvent } from '../integrations/googleCalendar';
import { createHash, randomUUID } from 'node:crypto';
import { rateLimit } from '../middleware/rateLimit';

const router = Router();
router.use(requireAuth);
const reportUploadLimit = rateLimit(8, 60 * 60 * 1000, (req) => req.user?.id ?? 'unauthenticated');
const prescriptionIssueLimit = rateLimit(20, 60 * 60 * 1000, (req) => req.user?.id ?? 'unauthenticated');

router.get('/overview', asyncRoute(async (req, res) => {
  if (req.user!.role === 'PATIENT') {
    const [appointments, counts] = await Promise.all([
      pool.query(`SELECT a.id, a.starts_at, a.ends_at, a.status, a.method, s.name AS service_name, d.display_name AS doctor_name
        FROM appointments a JOIN services s ON s.id=a.service_id JOIN doctors d ON d.id=a.doctor_id
        WHERE a.patient_id=$1 AND a.starts_at>=now() AND a.status IN ('PENDING','PAYMENT_PENDING','CONFIRMED','UPCOMING','IN_PROGRESS') ORDER BY a.starts_at LIMIT 5`, [req.user!.patientId]),
      pool.query(`SELECT (SELECT count(*) FROM appointments WHERE patient_id=$1) AS appointments,
        (SELECT count(*) FROM medical_records WHERE patient_id=$1 AND visibility='PATIENT_AND_DOCTOR') AS reports,
        (SELECT count(*) FROM prescriptions WHERE patient_id=$1) AS prescriptions`, [req.user!.patientId]),
    ]);
    return res.json({ appointments: appointments.rows, counts: counts.rows[0] });
  }
  if (req.user!.role === 'DOCTOR') {
    const [appointments, counts] = await Promise.all([
      pool.query(`SELECT a.id,a.starts_at,a.ends_at,a.status,a.method,s.name AS service_name,p.full_name AS patient_name
        FROM appointments a JOIN services s ON s.id=a.service_id JOIN patients p ON p.id=a.patient_id
        WHERE a.doctor_id=$1 AND a.starts_at>=now() AND a.status IN ('PENDING','PAYMENT_PENDING','CONFIRMED','UPCOMING','IN_PROGRESS') ORDER BY CASE WHEN a.status='PENDING' THEN 0 ELSE 1 END,a.starts_at LIMIT 8`, [req.user!.doctorId]),
      pool.query(`SELECT (SELECT count(*) FROM appointments WHERE doctor_id=$1 AND starts_at::date=CURRENT_DATE AND status NOT IN ('CANCELLED','NO_SHOW')) AS today,
        (SELECT count(DISTINCT patient_id) FROM appointments WHERE doctor_id=$1) AS patients,
        (SELECT count(*) FROM appointments WHERE doctor_id=$1 AND status='COMPLETED') AS completed`, [req.user!.doctorId]),
    ]);
    return res.json({ appointments: appointments.rows, counts: counts.rows[0] });
  }
  return res.status(403).json({ error: { message: 'This workspace is not available for this account.' } });
}));

router.get('/appointments', asyncRoute(async (req, res) => {
  if (!['PATIENT','DOCTOR'].includes(req.user!.role)) throw new HttpError(403, 'You do not have access to this resource.');
  const patient = req.user!.role === 'PATIENT';
  const result = await pool.query(`SELECT a.id,a.patient_id,a.starts_at,a.ends_at,a.status,a.method,a.meeting_url,a.problem_description,a.symptoms,
      s.name AS service_name,s.duration_minutes,s.fee_paise,${patient ? 'd.display_name' : 'p.full_name'} AS other_person
    FROM appointments a JOIN services s ON s.id=a.service_id JOIN ${patient ? 'doctors d ON d.id=a.doctor_id' : 'patients p ON p.id=a.patient_id'}
    WHERE a.${patient ? 'patient_id' : 'doctor_id'}=$1 ORDER BY a.starts_at DESC LIMIT 100`, [patient ? req.user!.patientId : req.user!.doctorId]);
  return res.json({ appointments: result.rows });
}));

router.get('/appointments/:id', requireRole('PATIENT','DOCTOR'), asyncRoute(async(req,res)=>{
  const appointmentId=requiredUuid(req.params.id,'appointment id');
  const patient=req.user!.role==='PATIENT';
  const result=await pool.query(`SELECT a.id,a.starts_at,a.ends_at,a.status,a.method,a.meeting_url,a.problem_description,a.symptoms,a.symptoms_started,a.severity,
      a.medication_notes,a.condition_notes,a.allergy_notes,a.previous_treatments,a.additional_notes,
      s.name AS service_name,s.duration_minutes,s.fee_paise,d.display_name AS doctor_name,d.timezone,p.full_name AS patient_name,
      ${patient?'NULL::text AS patient_email,NULL::text AS patient_phone':'u.email AS patient_email,u.phone AS patient_phone'},
      c.id AS consultation_id,c.notes,c.assessment,c.diagnosis_code,c.follow_up_at,c.completed_at,c.patient_summary
    FROM appointments a JOIN services s ON s.id=a.service_id JOIN doctors d ON d.id=a.doctor_id JOIN patients p ON p.id=a.patient_id
    JOIN users u ON u.id=p.user_id LEFT JOIN consultations c ON c.appointment_id=a.id
    WHERE a.id=$1 AND a.${patient?'patient_id':'doctor_id'}=$2`,[appointmentId,patient?req.user!.patientId:req.user!.doctorId]);
  if(!result.rowCount)throw new HttpError(404,'Appointment not found.');
  const row=result.rows[0];
  const prescriptions=await pool.query(`SELECT x.id,x.instructions,x.issued_at,
      COALESCE(json_agg(json_build_object('medicine',i.medicine,'dosage',i.dosage,'frequency',i.frequency,'duration',i.duration,'instructions',i.instructions) ORDER BY i.position) FILTER(WHERE i.id IS NOT NULL),'[]') AS items
    FROM prescriptions x LEFT JOIN prescription_items i ON i.prescription_id=x.id WHERE x.consultation_id=(SELECT id FROM consultations WHERE appointment_id=$1) GROUP BY x.id ORDER BY x.issued_at DESC`,[appointmentId]);
  const records=await pool.query(`SELECT id,original_filename,content_type,size_bytes,category,created_at FROM medical_records WHERE appointment_id=$1 AND visibility='PATIENT_AND_DOCTOR' ORDER BY created_at DESC`,[appointmentId]);
  const view={id:row.id,consultationId:row.consultation_id,startsAt:row.starts_at,endsAt:row.ends_at,status:row.status,method:row.method,meetingUrl:row.meeting_url,serviceName:row.service_name,durationMinutes:row.duration_minutes,feePaise:row.fee_paise,doctorName:row.doctor_name,patientName:row.patient_name,patientEmail:row.patient_email,patientPhone:row.patient_phone,problemDescription:row.problem_description,symptoms:row.symptoms,symptomsStarted:row.symptoms_started,severity:row.severity,medicationNotes:row.medication_notes,conditionNotes:row.condition_notes,allergyNotes:row.allergy_notes,previousTreatments:row.previous_treatments,additionalNotes:row.additional_notes,...(!patient?{notes:row.notes,assessment:row.assessment,diagnosisCode:row.diagnosis_code}:{ }),patientSummary:row.patient_summary,followUpAt:row.follow_up_at,completedAt:row.completed_at,prescriptions:prescriptions.rows,records:records.rows};
  return res.json({appointment:view});
}));

router.get('/patients/:id', requireRole('DOCTOR'), asyncRoute(async(req,res)=>{
  const patientId=requiredUuid(req.params.id,'patient id');
  const patient=await pool.query(`SELECT p.id,p.full_name,p.date_of_birth,p.gender,p.medical_conditions,p.allergies,p.current_medications,u.email,u.phone
    FROM patients p JOIN users u ON u.id=p.user_id WHERE p.id=$1 AND EXISTS(SELECT 1 FROM appointments a WHERE a.patient_id=p.id AND a.doctor_id=$2)`,[patientId,req.user!.doctorId]);
  if(!patient.rowCount)throw new HttpError(404,'Patient not found.');
  await pool.query(`INSERT INTO audit_logs(actor_user_id,action,resource_type,resource_id,metadata) VALUES($1,'PATIENT_RECORD_VIEWED','PATIENT',$2,'{}')`,[req.user!.id,patientId]);
  const [appointments,records,prescriptions]=await Promise.all([
    pool.query(`SELECT a.id,a.starts_at,a.status,a.method,s.name AS service_name,c.assessment,c.follow_up_at,c.completed_at FROM appointments a JOIN services s ON s.id=a.service_id LEFT JOIN consultations c ON c.appointment_id=a.id WHERE a.patient_id=$1 AND a.doctor_id=$2 ORDER BY a.starts_at DESC LIMIT 100`,[patientId,req.user!.doctorId]),
    pool.query(`SELECT id,original_filename,content_type,size_bytes,document_date,category,created_at FROM medical_records WHERE patient_id=$1 ORDER BY created_at DESC LIMIT 100`,[patientId]),
    pool.query(`SELECT x.id,x.instructions,x.issued_at,COALESCE(json_agg(json_build_object('medicine',i.medicine,'dosage',i.dosage,'frequency',i.frequency,'duration',i.duration,'instructions',i.instructions) ORDER BY i.position) FILTER(WHERE i.id IS NOT NULL),'[]') AS items FROM prescriptions x LEFT JOIN prescription_items i ON i.prescription_id=x.id WHERE x.patient_id=$1 AND x.doctor_id=$2 GROUP BY x.id ORDER BY x.issued_at DESC LIMIT 100`,[patientId,req.user!.doctorId]),
  ]);
  return res.json({patient:patient.rows[0],appointments:appointments.rows,records:records.rows,prescriptions:prescriptions.rows});
}));

router.put('/appointments/:id/consultation', requireRole('DOCTOR'), asyncRoute(async(req,res)=>{
  const appointmentId=requiredUuid(req.params.id,'appointment id');
  const fields=['notes','assessment','diagnosisCode','patientSummary'] as const;const values:Record<string,string|null>={};
  for(const field of fields){const value=req.body?.[field];if(value!=null&&typeof value!=='string')throw new HttpError(400,'Check the consultation fields.');if(typeof value==='string'&&value.length>10000)throw new HttpError(400,'Consultation text must be under 10,000 characters.');values[field]=typeof value==='string'?value.trim()||null:null;}
  const complete=req.body?.complete===true;const followUp=req.body?.followUpAt==null||req.body.followUpAt===''?null:req.body.followUpAt;
  if(followUp!==null&&(typeof followUp!=='string'||!Number.isFinite(Date.parse(followUp))))throw new HttpError(400,'Enter a valid follow-up date and time.');
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const appointment=await client.query(`SELECT id,patient_id,status FROM appointments WHERE id=$1 AND doctor_id=$2 FOR UPDATE`,[appointmentId,req.user!.doctorId]);
    if(!appointment.rowCount)throw new HttpError(404,'Appointment not found.');
    if(!['CONFIRMED','UPCOMING','IN_PROGRESS','COMPLETED'].includes(appointment.rows[0].status))throw new HttpError(409,'Accept the appointment request before documenting a consultation.');
    const saved=await client.query(`INSERT INTO consultations(appointment_id,patient_id,doctor_id,notes,assessment,diagnosis_code,follow_up_at,patient_summary,started_at,completed_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,now(),CASE WHEN $9 THEN now() ELSE NULL END)
      ON CONFLICT(appointment_id) DO UPDATE SET notes=EXCLUDED.notes,assessment=EXCLUDED.assessment,diagnosis_code=EXCLUDED.diagnosis_code,follow_up_at=EXCLUDED.follow_up_at,patient_summary=EXCLUDED.patient_summary,started_at=COALESCE(consultations.started_at,now()),completed_at=CASE WHEN $9 THEN COALESCE(consultations.completed_at,now()) ELSE consultations.completed_at END
      RETURNING id,appointment_id,notes,assessment,diagnosis_code,follow_up_at,patient_summary,started_at,completed_at`,[appointmentId,appointment.rows[0].patient_id,req.user!.doctorId,values.notes,values.assessment,values.diagnosisCode,followUp,values.patientSummary,complete]);
    await client.query(`UPDATE appointments SET status=CASE WHEN $1 THEN 'COMPLETED'::appointment_status WHEN status='CONFIRMED' OR status='UPCOMING' THEN 'IN_PROGRESS'::appointment_status ELSE status END,updated_at=now() WHERE id=$2`,[complete,appointmentId]);
    await client.query(`INSERT INTO audit_logs(actor_user_id,action,resource_type,resource_id,metadata) VALUES($1,$2,'CONSULTATION',$3,'{}')`,[req.user!.id,complete?'CONSULTATION_COMPLETED':'CONSULTATION_SAVED',saved.rows[0].id]);
    await client.query('COMMIT');return res.json({consultation:saved.rows[0]});
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}));

router.post('/appointments/:id/prescriptions', requireRole('DOCTOR'), prescriptionIssueLimit, asyncRoute(async(req,res)=>{
  const appointmentId=requiredUuid(req.params.id,'appointment id');
  const instructions=req.body?.instructions==null?'':req.body.instructions;
  const items=req.body?.items;
  if(typeof instructions!=='string'||instructions.length>5000||!Array.isArray(items)||items.length<1||items.length>30)throw new HttpError(400,'Add at least one medicine and check the prescription instructions.');
  for(const item of items){if(!item||typeof item.medicine!=='string'||!item.medicine.trim()||item.medicine.trim().length>200)throw new HttpError(400,'Each medicine needs a name of up to 200 characters.');for(const key of ['dosage','frequency','duration','instructions'])if(item[key]!=null&&(typeof item[key]!=='string'||item[key].length>500))throw new HttpError(400,'Check the medicine dosage and instructions.');}
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const consult=await client.query(`SELECT c.id,c.patient_id FROM consultations c JOIN appointments a ON a.id=c.appointment_id WHERE a.id=$1 AND a.doctor_id=$2 FOR UPDATE OF c`,[appointmentId,req.user!.doctorId]);
    if(!consult.rowCount)throw new HttpError(409,'Save the consultation before issuing a prescription.');
    const created=await client.query(`INSERT INTO prescriptions(consultation_id,patient_id,doctor_id,instructions) VALUES($1,$2,$3,$4) RETURNING id,issued_at`,[consult.rows[0].id,consult.rows[0].patient_id,req.user!.doctorId,instructions.trim()||null]);
    for(const [position,item] of items.entries())await client.query(`INSERT INTO prescription_items(prescription_id,medicine,dosage,frequency,duration,instructions,position) VALUES($1,$2,$3,$4,$5,$6,$7)`,[created.rows[0].id,item.medicine.trim(),item.dosage?.trim()||null,item.frequency?.trim()||null,item.duration?.trim()||null,item.instructions?.trim()||null,position]);
    const patientUser=await client.query('SELECT user_id FROM patients WHERE id=$1',[consult.rows[0].patient_id]);
    await client.query(`INSERT INTO notifications(user_id,appointment_id,channel,template_key,status) VALUES($1,$2,'IN_APP','PRESCRIPTION_AVAILABLE','QUEUED')`,[patientUser.rows[0].user_id,appointmentId]);
    await client.query(`INSERT INTO audit_logs(actor_user_id,action,resource_type,resource_id,metadata) VALUES($1,'PRESCRIPTION_ISSUED','PRESCRIPTION',$2,'{}')`,[req.user!.id,created.rows[0].id]);
    await client.query('COMMIT');return res.status(201).json({prescription:{id:created.rows[0].id,issuedAt:created.rows[0].issued_at}});
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}));

router.patch('/appointments/:id/status', requireRole('DOCTOR'), asyncRoute(async(req,res)=>{
  const appointmentId=requiredUuid(req.params.id,'appointment id');
  const status=req.body?.status;
  if(status!=='CONFIRMED'&&status!=='CANCELLED')throw new HttpError(400,'Choose accept or decline for this appointment request.');
  const current=await pool.query(`SELECT method FROM appointments WHERE id=$1 AND doctor_id=$2 AND status='PENDING'`,[appointmentId,req.user!.doctorId]);
  if(!current.rowCount)throw new HttpError(409,'This appointment request has already changed or is not yours to manage.');
  const calendarEvent=status==='CONFIRMED'?await createAppointmentEvent(req.user!.doctorId!,appointmentId):{eventId:null,meetingUrl:null};
  const result=await pool.query(`UPDATE appointments SET status=$1,google_calendar_event_id=COALESCE($2,google_calendar_event_id),meeting_url=COALESCE($3,meeting_url),updated_at=now() WHERE id=$4 AND doctor_id=$5 AND status='PENDING' RETURNING id,status,meeting_url`,[status,calendarEvent.eventId,calendarEvent.meetingUrl,appointmentId,req.user!.doctorId]);
  if(!result.rowCount)throw new HttpError(409,'This appointment request has already changed or is not yours to manage.');
  await pool.query(`INSERT INTO audit_logs(actor_user_id,action,resource_type,resource_id,metadata) VALUES($1,$2,'APPOINTMENT',$3,'{}')`,[req.user!.id,status==='CONFIRMED'?'APPOINTMENT_REQUEST_ACCEPTED':'APPOINTMENT_REQUEST_DECLINED',appointmentId]);
  const patientAccount=await pool.query(`SELECT p.user_id FROM appointments a JOIN patients p ON p.id=a.patient_id WHERE a.id=$1`,[appointmentId]);
  if(patientAccount.rowCount)await pool.query(`INSERT INTO notifications(user_id,appointment_id,channel,template_key,status) VALUES($1,$2,'IN_APP',$3,'QUEUED')`,[patientAccount.rows[0].user_id,appointmentId,status==='CONFIRMED'?'APPOINTMENT_ACCEPTED':'APPOINTMENT_DECLINED']);
  return res.json({appointment:result.rows[0],calendarSynced:Boolean(calendarEvent.eventId)});
}));

router.post('/appointments/:id/cancel-request', requireRole('PATIENT'), asyncRoute(async(req,res)=>{
  const appointmentId=requiredUuid(req.params.id,'appointment id');
  const result=await pool.query(`UPDATE appointments SET status='CANCELLED',updated_at=now() WHERE id=$1 AND patient_id=$2 AND status='PENDING' RETURNING id,status`,[appointmentId,req.user!.patientId]);
  if(!result.rowCount)throw new HttpError(409,'Only a pending request can be cancelled here. Contact the practice to change an accepted appointment.');
  await pool.query(`INSERT INTO audit_logs(actor_user_id,action,resource_type,resource_id,metadata) VALUES($1,'APPOINTMENT_REQUEST_CANCELLED_BY_PATIENT','APPOINTMENT',$2,'{}')`,[req.user!.id,appointmentId]);
  const doctorAccount=await pool.query(`SELECT d.user_id FROM appointments a JOIN doctors d ON d.id=a.doctor_id WHERE a.id=$1`,[appointmentId]);
  if(doctorAccount.rowCount)await pool.query(`INSERT INTO notifications(user_id,appointment_id,channel,template_key,status) VALUES($1,$2,'IN_APP','APPOINTMENT_REQUEST_CANCELLED','QUEUED')`,[doctorAccount.rows[0].user_id,appointmentId]);
  return res.json({appointment:result.rows[0]});
}));

router.get('/notifications',asyncRoute(async(req,res)=>{
  const result=await pool.query(`SELECT n.id,n.appointment_id,n.template_key,n.status,n.read_at,n.created_at
    FROM notifications n WHERE n.user_id=$1 ORDER BY n.created_at DESC LIMIT 100`,[req.user!.id]);
  return res.json({notifications:result.rows});
}));
router.patch('/notifications/:id/read',asyncRoute(async(req,res)=>{
  const id=requiredUuid(req.params.id,'notification id');
  const result=await pool.query(`UPDATE notifications SET read_at=COALESCE(read_at,now()) WHERE id=$1 AND user_id=$2 RETURNING id,read_at`,[id,req.user!.id]);
  if(!result.rowCount)throw new HttpError(404,'Notification not found.');return res.json({notification:result.rows[0]});
}));
router.get('/payments',requireRole('PATIENT','DOCTOR'),asyncRoute(async(req,res)=>{
  const patient=req.user!.role==='PATIENT';
  const result=await pool.query(`SELECT x.id,x.appointment_id,x.amount_paise,x.currency,x.status,x.provider_order_id,x.provider_payment_id,x.verified_at,x.created_at,${patient?'d.display_name':'p.full_name'} AS other_person
    FROM payments x JOIN appointments a ON a.id=x.appointment_id JOIN ${patient?'doctors d ON d.id=a.doctor_id':'patients p ON p.id=a.patient_id'}
    WHERE ${patient?'x.patient_id':'a.doctor_id'}=$1 ORDER BY x.created_at DESC LIMIT 100`,[patient?req.user!.patientId:req.user!.doctorId]);
  return res.json({payments:result.rows});
}));

router.get('/records', requireRole('PATIENT','DOCTOR'), asyncRoute(async (req, res) => {
  const isPatient = req.user!.role === 'PATIENT';
  const result = await pool.query(`SELECT r.id,r.original_filename,r.content_type,r.size_bytes,r.document_date,r.category,r.created_at,
      p.full_name AS patient_name
    FROM medical_records r JOIN patients p ON p.id=r.patient_id
    WHERE ${isPatient ? "r.patient_id=$1 AND r.visibility='PATIENT_AND_DOCTOR'" : "r.patient_id IN (SELECT patient_id FROM appointments WHERE doctor_id=$1)"}
    ORDER BY r.created_at DESC LIMIT 100`, [isPatient ? req.user!.patientId : req.user!.doctorId]);
  return res.json({ records: result.rows });
}));

router.post('/records',requireRole('PATIENT'),reportUploadLimit,asyncRoute(async(req,res)=>{
  const bytes=req.body as unknown;
  if(!Buffer.isBuffer(bytes)||bytes.length<8||bytes.length>8*1024*1024)throw new HttpError(400,'Choose a PDF, JPG, or PNG file up to 8 MB.');
  const contentType=req.get('content-type')?.split(';')[0].trim().toLowerCase();
  const signature=bytes.subarray(0,8);
  const detected=bytes.subarray(0,5).toString('ascii')==='%PDF-'?'application/pdf':signature.equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))?'image/png':signature[0]===0xff&&signature[1]===0xd8&&signature[2]===0xff?'image/jpeg':'';
  if(!detected||detected!==contentType)throw new HttpError(400,'The file content does not match a supported PDF, JPG, or PNG type.');
  const encodedName=req.get('X-Upload-Name')??'medical-report';let originalName='medical-report';
  try{originalName=decodeURIComponent(encodedName)}catch{throw new HttpError(400,'The file name is invalid.');}
  originalName=originalName.replace(/[\\/\u0000-\u001f\u007f]/g,'_').trim().slice(0,180)||'medical-report';
  const allowedCategories=new Set(['Lab report','Prescription','Imaging','Other']);const requestedCategory=req.get('X-Upload-Category')??'Other';
  if(!allowedCategories.has(requestedCategory))throw new HttpError(400,'Choose a valid report category.');
  const appointmentId=req.get('X-Appointment-Id')?.trim()||null;
  if(appointmentId&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(appointmentId))throw new HttpError(400,'Appointment id is invalid.');
  const storageKey=randomUUID();const hash=createHash('sha256').update(bytes).digest('hex');
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    if(appointmentId){const appointment=await client.query(`SELECT id FROM appointments WHERE id=$1 AND patient_id=$2 FOR UPDATE`,[appointmentId,req.user!.patientId]);if(!appointment.rowCount)throw new HttpError(404,'Appointment not found.');}
    const saved=await client.query(`INSERT INTO medical_records(patient_id,appointment_id,uploaded_by,storage_key,original_filename,content_type,size_bytes,visibility,category,file_bytes,sha256)
      VALUES($1,$2,$3,$4,$5,$6,$7,'PATIENT_AND_DOCTOR',$8,$9,$10) RETURNING id,original_filename,content_type,size_bytes,category,created_at`,[req.user!.patientId,appointmentId,req.user!.id,storageKey,originalName,detected,bytes.length,requestedCategory,bytes,hash]);
    await client.query(`INSERT INTO audit_logs(actor_user_id,action,resource_type,resource_id,metadata) VALUES($1,'MEDICAL_REPORT_UPLOADED','MEDICAL_RECORD',$2,'{}')`,[req.user!.id,saved.rows[0].id]);
    await client.query('COMMIT');return res.status(201).json({record:saved.rows[0]});
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}));

router.get('/records/:id/download',requireRole('PATIENT','DOCTOR'),asyncRoute(async(req,res)=>{
  const recordId=requiredUuid(req.params.id,'report id');
  const patient=req.user!.role==='PATIENT';
  const result=await pool.query(`SELECT r.id,r.original_filename,r.content_type,r.file_bytes FROM medical_records r
    WHERE r.id=$1 AND ${patient?"r.patient_id=$2 AND r.visibility='PATIENT_AND_DOCTOR'":"EXISTS(SELECT 1 FROM appointments a WHERE a.patient_id=r.patient_id AND a.doctor_id=$2)"}`,[recordId,patient?req.user!.patientId:req.user!.doctorId]);
  if(!result.rowCount||!Buffer.isBuffer(result.rows[0].file_bytes))throw new HttpError(404,'Report not found.');
  const inline=req.query.view==='1';
  await pool.query(`INSERT INTO audit_logs(actor_user_id,action,resource_type,resource_id,metadata) VALUES($1,$2,'MEDICAL_RECORD',$3,'{}')`,[req.user!.id,inline?'MEDICAL_REPORT_VIEWED':'MEDICAL_REPORT_DOWNLOADED',recordId]);
  const name=String(result.rows[0].original_filename).replace(/[\r\n"\\]/g,'_');
  res.setHeader('Content-Type',result.rows[0].content_type);res.setHeader('Content-Disposition',`${inline?'inline':'attachment'}; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`);res.setHeader('Content-Length',result.rows[0].file_bytes.length);res.setHeader('X-Content-Type-Options','nosniff');return res.end(result.rows[0].file_bytes);
}));

router.delete('/records/:id',requireRole('PATIENT'),asyncRoute(async(req,res)=>{
  const id=requiredUuid(req.params.id,'report id');
  const client=await pool.connect();try{await client.query('BEGIN');const removed=await client.query(`DELETE FROM medical_records WHERE id=$1 AND patient_id=$2 AND visibility='PATIENT_AND_DOCTOR' RETURNING id`,[id,req.user!.patientId]);if(!removed.rowCount)throw new HttpError(404,'Report not found.');await client.query(`INSERT INTO audit_logs(actor_user_id,action,resource_type,resource_id,metadata) VALUES($1,'MEDICAL_REPORT_DELETED','MEDICAL_RECORD',$2,'{}')`,[req.user!.id,id]);await client.query('COMMIT');return res.json({message:'Report deleted.'});}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}));

router.get('/prescriptions', requireRole('PATIENT','DOCTOR'), asyncRoute(async (req, res) => {
  const isPatient = req.user!.role === 'PATIENT';
  const result = await pool.query(`SELECT x.id,x.instructions,x.issued_at,p.full_name AS patient_name,d.display_name AS doctor_name,
      COALESCE(json_agg(json_build_object('medicine',i.medicine,'dosage',i.dosage,'frequency',i.frequency,'duration',i.duration,'instructions',i.instructions) ORDER BY i.position) FILTER (WHERE i.id IS NOT NULL),'[]') AS items
    FROM prescriptions x JOIN patients p ON p.id=x.patient_id JOIN doctors d ON d.id=x.doctor_id LEFT JOIN prescription_items i ON i.prescription_id=x.id
    WHERE ${isPatient ? 'x.patient_id=$1' : 'x.doctor_id=$1'} GROUP BY x.id,p.full_name,d.display_name ORDER BY x.issued_at DESC LIMIT 100`, [isPatient ? req.user!.patientId : req.user!.doctorId]);
  return res.json({ prescriptions: result.rows });
}));

router.get('/patients', requireRole('DOCTOR'), asyncRoute(async (req, res) => {
  const result = await pool.query(`SELECT p.id,p.full_name,u.email,u.phone, max(a.starts_at) AS last_appointment,
      count(a.id)::int AS appointment_count
    FROM appointments a JOIN patients p ON p.id=a.patient_id JOIN users u ON u.id=p.user_id
    WHERE a.doctor_id=$1 GROUP BY p.id,u.email,u.phone ORDER BY max(a.starts_at) DESC LIMIT 200`, [req.user!.doctorId]);
  return res.json({ patients: result.rows });
}));

router.get('/availability', requireRole('DOCTOR'), asyncRoute(async (req, res) => {
  const result = await pool.query(`SELECT id,weekday,starts_at,ends_at,slot_minutes,buffer_minutes FROM availability_rules WHERE doctor_id=$1 AND active ORDER BY weekday,starts_at`, [req.user!.doctorId]);
  return res.json({ rules: result.rows });
}));

router.get('/services', requireRole('DOCTOR'), asyncRoute(async(req,res)=>{
  const result=await pool.query(`SELECT id,name,description,duration_minutes,fee_paise,currency,to_json(methods) AS methods,active FROM services WHERE doctor_id=$1 ORDER BY created_at DESC`,[req.user!.doctorId]);
  return res.json({services:result.rows});
}));

router.post('/services', requireRole('DOCTOR'), asyncRoute(async(req,res)=>{
  const {name,description,durationMinutes,feeRupees,methods}=req.body??{};
  if(typeof name!=='string'||!name.trim()||name.trim().length>120||!Number.isInteger(durationMinutes)||durationMinutes<10||durationMinutes>240
    ||typeof feeRupees!=='number'||!Number.isFinite(feeRupees)||feeRupees<0||feeRupees>100000||Math.round(feeRupees*100)!==feeRupees*100
    ||!Array.isArray(methods)||methods.length===0||methods.some((m:unknown)=>!['GOOGLE_MEET','WHATSAPP','IN_PERSON'].includes(String(m))))throw new HttpError(400,'Enter a service name, duration, fee, and at least one consultation method.');
  if(description!=null&&(typeof description!=='string'||description.length>1000))throw new HttpError(400,'Description must be 1,000 characters or fewer.');
  const result=await pool.query(`INSERT INTO services(doctor_id,name,description,duration_minutes,fee_paise,methods) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,name,description,duration_minutes,fee_paise,currency,methods,active`,[req.user!.doctorId,name.trim(),description?.trim()||null,durationMinutes,Math.round(feeRupees*100),[...new Set(methods)]]);
  await pool.query(`INSERT INTO audit_logs(actor_user_id,action,resource_type,resource_id,metadata) VALUES($1,'SERVICE_CREATED','SERVICE',$2,'{}')`,[req.user!.id,result.rows[0].id]);
  return res.status(201).json({service:result.rows[0]});
}));

router.patch('/services/:id', requireRole('DOCTOR'), asyncRoute(async(req,res)=>{
  const serviceId=requiredUuid(req.params.id,'service id');
  const {name,description,durationMinutes,feeRupees,methods,active}=req.body??{};
  if(typeof name!=='string'||!name.trim()||name.trim().length>120||!Number.isInteger(durationMinutes)||durationMinutes<10||durationMinutes>240
    ||typeof feeRupees!=='number'||!Number.isFinite(feeRupees)||feeRupees<0||feeRupees>100000||Math.round(feeRupees*100)!==feeRupees*100
    ||!Array.isArray(methods)||methods.length===0||methods.some((m:unknown)=>!['GOOGLE_MEET','WHATSAPP','IN_PERSON'].includes(String(m)))||typeof active!=='boolean')throw new HttpError(400,'Check the service name, duration, fee, methods, and active status.');
  if(description!=null&&(typeof description!=='string'||description.length>1000))throw new HttpError(400,'Description must be 1,000 characters or fewer.');
  const result=await pool.query(`UPDATE services SET name=$1,description=$2,duration_minutes=$3,fee_paise=$4,methods=$5,active=$6 WHERE id=$7 AND doctor_id=$8 RETURNING id,name,description,duration_minutes,fee_paise,currency,methods,active`,[name.trim(),description?.trim()||null,durationMinutes,Math.round(feeRupees*100),[...new Set(methods)],active,serviceId,req.user!.doctorId]);
  if(!result.rowCount)throw new HttpError(404,'Service not found.');
  await pool.query(`INSERT INTO audit_logs(actor_user_id,action,resource_type,resource_id,metadata) VALUES($1,'SERVICE_UPDATED','SERVICE',$2,'{}')`,[req.user!.id,result.rows[0].id]);
  return res.json({service:result.rows[0]});
}));

router.put('/availability', requireRole('DOCTOR'), asyncRoute(async (req, res) => {
  const rules = req.body?.rules;
  if (!Array.isArray(rules) || rules.length > 42) throw new HttpError(400, 'Provide up to 42 weekly availability periods.');
  for (const rule of rules) {
    if (!Number.isInteger(rule?.weekday) || rule.weekday < 0 || rule.weekday > 6
      || typeof rule.startsAt !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(rule.startsAt)
      || typeof rule.endsAt !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(rule.endsAt)
      || rule.endsAt <= rule.startsAt || !Number.isInteger(rule.slotMinutes) || rule.slotMinutes < 10 || rule.slotMinutes > 240
      || !Number.isInteger(rule.bufferMinutes) || rule.bufferMinutes < 0 || rule.bufferMinutes > 120) throw new HttpError(400, 'Check each weekday, time range, slot length, and buffer.');
  }
  const periods = new Map<number, Array<[number,number]>>();
  for (const rule of rules) {
    const start = Number(rule.startsAt.slice(0,2))*60 + Number(rule.startsAt.slice(3));
    const end = Number(rule.endsAt.slice(0,2))*60 + Number(rule.endsAt.slice(3));
    const day = periods.get(rule.weekday) ?? [];
    if (day.some(([a,b]) => start < b && a < end)) throw new HttpError(400, 'Availability periods on the same day cannot overlap.');
    day.push([start,end]); periods.set(rule.weekday,day);
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE availability_rules SET active=false WHERE doctor_id=$1 AND active', [req.user!.doctorId]);
    for (const rule of rules) await client.query(`INSERT INTO availability_rules(doctor_id,weekday,starts_at,ends_at,slot_minutes,buffer_minutes,active)
      VALUES($1,$2,$3::time,$4::time,$5,$6,true)`, [req.user!.doctorId,rule.weekday,rule.startsAt,rule.endsAt,rule.slotMinutes,rule.bufferMinutes]);
    await client.query(`INSERT INTO audit_logs(actor_user_id,action,resource_type,metadata) VALUES($1,'AVAILABILITY_UPDATED','DOCTOR','{}')`, [req.user!.id]);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
  return res.json({ message: 'Availability saved.' });
}));

router.get('/profile', asyncRoute(async (req, res) => {
  if (req.user!.role === 'PATIENT') {
    const result = await pool.query(`SELECT p.full_name,p.date_of_birth,p.gender,p.medical_conditions,p.allergies,p.current_medications,u.email,u.phone
      FROM patients p JOIN users u ON u.id=p.user_id WHERE p.user_id=$1`, [req.user!.id]);
    return res.json({ profile: result.rows[0] ?? null });
  }
  if (req.user!.role === 'DOCTOR') {
    const result = await pool.query(`SELECT d.display_name,d.qualifications,d.specializations,d.bio,d.contact_email,d.contact_phone,d.whatsapp_number,d.timezone,u.email
      FROM doctors d JOIN users u ON u.id=d.user_id WHERE d.user_id=$1`, [req.user!.id]);
    return res.json({ profile: result.rows[0] ?? null });
  }
  throw new HttpError(403, 'This workspace is not available for this account.');
}));

router.patch('/profile', asyncRoute(async (req, res) => {
  const name = typeof req.body?.fullName === 'string' ? req.body.fullName.trim() : '';
  if (!name || name.length > 120) throw new HttpError(400, 'Enter a name of up to 120 characters.');
  if (req.user!.role === 'PATIENT') {
    const dob = req.body?.dateOfBirth === '' || req.body?.dateOfBirth == null ? null : req.body.dateOfBirth;
    if (dob !== null && (typeof dob !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dob) || Number.isNaN(Date.parse(`${dob}T00:00:00Z`)))) throw new HttpError(400, 'Enter a valid date of birth.');
    const gender = typeof req.body?.gender === 'string' ? req.body.gender.trim().slice(0,40) : null;
    await pool.query('UPDATE patients SET full_name=$1,date_of_birth=$2,gender=$3,updated_at=now() WHERE user_id=$4', [name,dob,gender,req.user!.id]);
    await pool.query(`INSERT INTO audit_logs(actor_user_id,action,resource_type,metadata) VALUES ($1,'PATIENT_PROFILE_UPDATED','USER','{}')`, [req.user!.id]);
  } else if (req.user!.role === 'DOCTOR') {
    await pool.query('UPDATE doctors SET display_name=$1,updated_at=now() WHERE user_id=$2', [name,req.user!.id]);
    await pool.query(`INSERT INTO audit_logs(actor_user_id,action,resource_type,metadata) VALUES ($1,'DOCTOR_PROFILE_UPDATED','USER','{}')`, [req.user!.id]);
  } else throw new HttpError(403, 'This workspace is not available for this account.');
  return res.json({ message: 'Profile saved.' });
}));

export default router;
