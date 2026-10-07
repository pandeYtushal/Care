import { Router } from 'express';
import { pool } from '../db';
import { asyncRoute, HttpError, requiredUuid } from '../http';
import { requireAuth, requireRole } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';

const router = Router();
const appointmentRequestLimit = rateLimit(10, 60 * 60 * 1000, (req) => req.user?.id ?? 'unauthenticated');
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
function validDate(value: string) {
  if (!datePattern.test(value)) return false;
  const d = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10) === value;
}
function dateShift(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate()+days); return d.toISOString().slice(0,10);
}
function zonedToUtc(date: string, time: string, zone: string) {
  const [year,month,day] = date.split('-').map(Number); const [hour,minute] = time.split(':').map(Number);
  const target = Date.UTC(year,month-1,day,hour,minute); let estimate=target;
  const fmt = new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  for(let i=0;i<3;i++){
    const parts=Object.fromEntries(fmt.formatToParts(new Date(estimate)).map(p=>[p.type,p.value]));
    const represented=Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day),Number(parts.hour),Number(parts.minute));
    estimate += target-represented;
  }
  return new Date(estimate);
}
function localDate(at: Date, zone: string) {
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(at).map(x=>[x.type,x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
function timeText(value: unknown) { return String(value).slice(0,5); }
type Slot = {startsAt:Date;endsAt:Date};
async function getSlots(client: {query: typeof pool.query}, doctorId:string, serviceId:string, date:string):Promise<Slot[]> {
  const sr=await client.query(`SELECT s.duration_minutes,s.methods,d.timezone FROM services s JOIN doctors d ON d.id=s.doctor_id WHERE s.id=$1 AND s.doctor_id=$2 AND s.active=true`,[serviceId,doctorId]);
  if(!sr.rowCount) throw new HttpError(404,'That consultation service is not available.');
  const {duration_minutes:duration,methods,timezone}=sr.rows[0] as {duration_minutes:number;methods:string[];timezone:string};
  let weekday=new Date(`${date}T12:00:00Z`).getUTCDay();
  const rules=await client.query(`SELECT starts_at,ends_at,slot_minutes,buffer_minutes FROM availability_rules WHERE doctor_id=$1 AND weekday=$2 AND active=true`,[doctorId,weekday]);
  const dayStart=zonedToUtc(date,'00:00',timezone), dayEnd=zonedToUtc(dateShift(date,1),'00:00',timezone);
  const [booked,exceptions]=await Promise.all([
    client.query(`SELECT starts_at,ends_at FROM appointments WHERE doctor_id=$1 AND starts_at<$3 AND ends_at>$2 AND status IN ('PENDING','PAYMENT_PENDING','CONFIRMED','UPCOMING','IN_PROGRESS')`,[doctorId,dayStart,dayEnd]),
    client.query(`SELECT starts_at,ends_at FROM availability_exceptions WHERE doctor_id=$1 AND unavailable=true AND starts_at<$3 AND ends_at>$2`,[doctorId,dayStart,dayEnd]),
  ]);
  const unavailable=[...booked.rows,...exceptions.rows].map(r=>({start:new Date(r.starts_at as string).getTime(),end:new Date(r.ends_at as string).getTime()}));
  const now=Date.now(),slots:Slot[]=[];
  for(const rule of rules.rows){
    const [sh,sm]=timeText(rule.starts_at).split(':').map(Number);const [eh,em]=timeText(rule.ends_at).split(':').map(Number);
    const begin=sh*60+sm,finish=eh*60+em,slotMinutes=Number(rule.slot_minutes),step=Math.max(slotMinutes,Number(duration))+Number(rule.buffer_minutes);
    for(let minute=begin;minute+slotMinutes<=finish;minute+=step){
      const hh=String(Math.floor(minute/60)).padStart(2,'0'),mm=String(minute%60).padStart(2,'0');
      const startsAt=zonedToUtc(date,`${hh}:${mm}`,timezone),endsAt=new Date(startsAt.getTime()+Number(duration)*60_000);
      if(startsAt.getTime()>now&&!unavailable.some(x=>startsAt.getTime()<x.end&&x.start<endsAt.getTime()))slots.push({startsAt,endsAt});
    }
  }
  return slots.sort((a,b)=>a.startsAt.getTime()-b.startsAt.getTime());
}

router.get('/services', asyncRoute(async (_req,res)=>{
  const result=await pool.query(`SELECT s.id,s.name,s.description,s.duration_minutes,s.fee_paise,s.currency,to_json(s.methods) AS methods,d.id AS doctor_id,d.display_name,d.timezone
    FROM services s JOIN doctors d ON d.id=s.doctor_id WHERE s.active=true ORDER BY s.created_at,s.name`);
  return res.json({services:result.rows});
}));
router.get('/slots', asyncRoute(async (req,res)=>{
  const date=typeof req.query.date==='string'?req.query.date:'';
  if(!validDate(date))throw new HttpError(400,'Choose a valid service and date.');
  const serviceId=requiredUuid(req.query.serviceId,'consultation service id');
  const service=await pool.query('SELECT s.doctor_id,d.timezone FROM services s JOIN doctors d ON d.id=s.doctor_id WHERE s.id=$1 AND s.active=true',[serviceId]);
  if(!service.rowCount)throw new HttpError(404,'That consultation service is not available.');
  const today=localDate(new Date(), service.rows[0].timezone);
  if(date<today||date>dateShift(today,90))throw new HttpError(400,'Choose a date within the next 90 days.');
  const slots=await getSlots(pool,service.rows[0].doctor_id,serviceId,date);
  return res.json({slots:slots.map(s=>({startsAt:s.startsAt.toISOString(),endsAt:s.endsAt.toISOString()}))});
}));

router.post('/appointments',requireAuth,requireRole('PATIENT'),appointmentRequestLimit,asyncRoute(async(req,res)=>{
  const {serviceId,startsAt,method,intake}=req.body??{};
  if(typeof serviceId!=='string'||typeof startsAt!=='string'||!['GOOGLE_MEET','WHATSAPP','IN_PERSON'].includes(method))throw new HttpError(400,'Choose a service, available time, and consultation method.');
  const validServiceId=requiredUuid(serviceId,'consultation service id');
  const start=new Date(startsAt);if(!Number.isFinite(start.getTime())||start.toISOString()!==startsAt)throw new HttpError(400,'Choose a valid appointment time.');
  const fields=['problemDescription','symptoms','symptomsStarted','medicationNotes','conditionNotes','allergyNotes','previousTreatments','additionalNotes'] as const;
  const values:Record<string,string|null>={};for(const f of fields){const v=intake?.[f];if(v!=null&&typeof v!=='string')throw new HttpError(400,'Check the consultation details.');if(typeof v==='string'&&v.length>3000)throw new HttpError(400,'Consultation details must be under 3,000 characters each.');values[f]=typeof v==='string'?v.trim()||null:null;}
  const severity=intake?.severity==null||intake.severity===''?null:Number(intake.severity);if(severity!==null&&(!Number.isInteger(severity)||severity<1||severity>10))throw new HttpError(400,'Severity must be between 1 and 10.');
  if(!values.problemDescription)throw new HttpError(400,'Describe the main reason for your consultation.');
  const svc=await pool.query(`SELECT s.doctor_id,s.duration_minutes,to_json(s.methods) AS methods,d.timezone FROM services s JOIN doctors d ON d.id=s.doctor_id WHERE s.id=$1 AND s.active=true`,[validServiceId]);
  if(!svc.rowCount)throw new HttpError(404,'That consultation service is not available.');
  const doctorId=svc.rows[0].doctor_id as string;const timezone=svc.rows[0].timezone as string;
  if(!(svc.rows[0].methods as string[]).includes(method))throw new HttpError(400,'That consultation method is not offered for this service.');
  const date=localDate(start,timezone);if(!validDate(date))throw new HttpError(400,'Choose a valid appointment date.');
  const today=localDate(new Date(),timezone);if(date<today||date>dateShift(today,90))throw new HttpError(400,'Choose a date within the next 90 days.');
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`booking:${doctorId}:${date}`]);
    const slots=await getSlots(client,doctorId,validServiceId,date);
    const selected=slots.find(s=>s.startsAt.getTime()===start.getTime());if(!selected)throw new HttpError(409,'That time was just taken or is no longer available. Please choose another slot.');
    const result=await client.query(`INSERT INTO appointments(patient_id,doctor_id,service_id,starts_at,ends_at,status,method,problem_description,symptoms,symptoms_started,severity,medication_notes,condition_notes,allergy_notes,previous_treatments,additional_notes)
      VALUES($1,$2,$3,$4,$5,'PENDING',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id,starts_at,ends_at,status,method`,
      [req.user!.patientId,doctorId,validServiceId,selected.startsAt,selected.endsAt,method,values.problemDescription,values.symptoms,values.symptomsStarted,severity,values.medicationNotes,values.conditionNotes,values.allergyNotes,values.previousTreatments,values.additionalNotes]);
    const doctorUser=await client.query('SELECT user_id FROM doctors WHERE id=$1',[doctorId]);
    await client.query(`INSERT INTO notifications(user_id,appointment_id,channel,template_key,status) VALUES($1,$2,'IN_APP','APPOINTMENT_REQUESTED','QUEUED')`,[doctorUser.rows[0].user_id,result.rows[0].id]);
    await client.query(`INSERT INTO audit_logs(actor_user_id,action,resource_type,resource_id,metadata) VALUES($1,'APPOINTMENT_REQUESTED','APPOINTMENT',$2,'{}')`,[req.user!.id,result.rows[0].id]);
    await client.query('COMMIT');return res.status(201).json({appointment:result.rows[0],message:'Your appointment request was sent to the practice. It is not confirmed until the practice responds.'});
  }catch(error){await client.query('ROLLBACK');if(error&&typeof error==='object'&&'code'in error&&error.code==='23P01')throw new HttpError(409,'That time was just taken. Please choose another slot.');throw error;}finally{client.release();}
}));

export default router;
