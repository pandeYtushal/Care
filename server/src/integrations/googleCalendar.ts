import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { env } from '../config/env';
import { pool } from '../db';
import { HttpError } from '../http';
import { externalFetch } from './http';

function callbackUri(){
  if(env.googleCalendarRedirectUri)return env.googleCalendarRedirectUri;
  if(!env.googleRedirectUri)return '';
  return `${new URL(env.googleRedirectUri).origin}/api/integrations/google/callback`;
}
function encryptionKey(){
  if(!env.googleTokenEncryptionKey)throw new HttpError(503,'Calendar token encryption is not configured on the server.');
  return createHash('sha256').update(env.googleTokenEncryptionKey).digest();
}
function seal(value:string){
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',encryptionKey(),iv);
  const ciphertext=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);
  return [iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),ciphertext.toString('base64url')].join('.');
}
function unseal(value:string){
  try{const [iv,tag,data]=value.split('.');const decipher=createDecipheriv('aes-256-gcm',encryptionKey(),Buffer.from(iv,'base64url'));decipher.setAuthTag(Buffer.from(tag,'base64url'));return Buffer.concat([decipher.update(Buffer.from(data,'base64url')),decipher.final()]).toString('utf8');}
  catch{throw new HttpError(503,'The saved Google Calendar connection cannot be decrypted. Reconnect Calendar or check the server encryption key.');}
}
export function calendarReady(){return Boolean(env.googleClientId&&env.googleClientSecret&&callbackUri()&&env.googleTokenEncryptionKey);}
export function calendarCallbackUri(){return callbackUri();}
export function encryptCalendarToken(token:string){return seal(token);}

async function refreshAccessToken(doctorId:string){
  const stored=await pool.query(`SELECT refresh_token_ciphertext FROM doctor_google_calendar_tokens WHERE doctor_id=$1`,[doctorId]);
  if(!stored.rowCount)throw new HttpError(409,'Connect Google Calendar in practice integrations first.');
  const response=await externalFetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.googleClientId,client_secret:env.googleClientSecret,refresh_token:unseal(stored.rows[0].refresh_token_ciphertext),grant_type:'refresh_token'})});
  const payload=await response.json().catch(()=>({})) as {access_token?:string;expires_in?:number;refresh_token?:string};
  if(!response.ok||!payload.access_token){if(response.status===400){await pool.query('DELETE FROM doctor_google_calendar_tokens WHERE doctor_id=$1',[doctorId]);await pool.query(`UPDATE integration_connections SET disconnected_at=now() WHERE doctor_id=$1 AND provider='GOOGLE_CALENDAR'`,[doctorId]);}throw new HttpError(503,'Google Calendar authorization expired or was revoked. Reconnect the calendar.');}
  const expiresAt=new Date(Date.now()+Math.max(60,Number(payload.expires_in??3600)-60)*1000);
  await pool.query(`UPDATE doctor_google_calendar_tokens SET access_token_ciphertext=$1,access_token_expires_at=$2,refresh_token_ciphertext=COALESCE($3,refresh_token_ciphertext),updated_at=now() WHERE doctor_id=$4`,[seal(payload.access_token),expiresAt,payload.refresh_token?seal(payload.refresh_token):null,doctorId]);
  return payload.access_token;
}
async function accessToken(doctorId:string){
  const result=await pool.query(`SELECT access_token_ciphertext,access_token_expires_at FROM doctor_google_calendar_tokens WHERE doctor_id=$1`,[doctorId]);
  if(!result.rowCount)throw new HttpError(409,'Connect Google Calendar in practice integrations first.');
  if(new Date(result.rows[0].access_token_expires_at).getTime()>Date.now()+60_000)return unseal(result.rows[0].access_token_ciphertext);
  return refreshAccessToken(doctorId);
}
async function googleFetch(doctorId:string,url:string,init:RequestInit={}):Promise<Response>{
  for(let attempt=0;attempt<2;attempt++){
    const token=await accessToken(doctorId);
    const response=await externalFetch(url,{...init,headers:{...(init.headers??{}),Authorization:`Bearer ${token}`}});
    if(response.status===401&&attempt===0){await pool.query(`UPDATE doctor_google_calendar_tokens SET access_token_expires_at=now() WHERE doctor_id=$1`,[doctorId]);continue;}
    return response;
  }
  throw new HttpError(503,'Google Calendar is temporarily unavailable.');
}
function stableEventId(appointmentId:string){
  const bytes=createHash('sha256').update(appointmentId).digest().subarray(0,16);let value=BigInt(`0x${bytes.toString('hex')}`);const alphabet='0123456789abcdefghijklmnopqrstuv';let out='';
  for(let i=0;i<26;i++){out=alphabet[Number(value&31n)]+out;value>>=5n;}return `ac${out}`;
}
export async function createAppointmentEvent(doctorId:string,appointmentId:string){
  const appointment=await pool.query(`SELECT a.starts_at,a.ends_at,a.method,a.google_calendar_event_id,d.display_name,d.timezone,p.full_name,u.email
    FROM appointments a JOIN doctors d ON d.id=a.doctor_id JOIN patients p ON p.id=a.patient_id JOIN users u ON u.id=p.user_id
    WHERE a.id=$1 AND a.doctor_id=$2`,[appointmentId,doctorId]);
  if(!appointment.rowCount)throw new HttpError(404,'Appointment not found.');
  const data=appointment.rows[0];if(data.method!=='GOOGLE_MEET')return {eventId:null as string|null,meetingUrl:null as string|null};
  const connection=await pool.query('SELECT 1 FROM doctor_google_calendar_tokens WHERE doctor_id=$1',[doctorId]);
  if(!connection.rowCount)throw new HttpError(409,'Connect Google Calendar before accepting a Google Meet request.');
  const eventId=(data.google_calendar_event_id as string|null)||stableEventId(appointmentId);
  const eventBody={id:eventId,summary:'Atelier Care consultation',description:'Private consultation scheduled through Atelier Care. Please use the Google Meet link to join.',start:{dateTime:new Date(data.starts_at).toISOString(),timeZone:data.timezone},end:{dateTime:new Date(data.ends_at).toISOString(),timeZone:data.timezone},attendees:[{email:data.email}],conferenceData:{createRequest:{requestId:stableEventId(`${appointmentId}:conference`),conferenceSolutionKey:{type:'hangoutsMeet'}}}};
  let response=await googleFetch(doctorId,`https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(eventBody)});
  if(response.status===409)response=await googleFetch(doctorId,`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`);
  const result=await response.json().catch(()=>({})) as {id?:string;hangoutLink?:string;conferenceData?:{entryPoints?:Array<{entryPointType?:string;uri?:string}>}};
  if(!response.ok||!result.id)throw new HttpError(503,'Google Calendar could not create the event. The request remains pending; try again after checking Calendar access.');
  const meetingUrl=result.hangoutLink??result.conferenceData?.entryPoints?.find(x=>x.entryPointType==='video')?.uri??null;
  if(data.method==='GOOGLE_MEET'&&!meetingUrl)throw new HttpError(503,'Google Calendar created an event but did not return a Meet link. The request remains pending; retry to sync it.');
  return {eventId:result.id,meetingUrl};
}
export async function revokeCalendarToken(doctorId:string){
  const result=await pool.query('SELECT refresh_token_ciphertext FROM doctor_google_calendar_tokens WHERE doctor_id=$1',[doctorId]);
  if(result.rowCount){const token=unseal(result.rows[0].refresh_token_ciphertext);await externalFetch('https://oauth2.googleapis.com/revoke',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token})}).catch(()=>undefined);}
  await pool.query('DELETE FROM doctor_google_calendar_tokens WHERE doctor_id=$1',[doctorId]);
  await pool.query(`UPDATE integration_connections SET disconnected_at=now() WHERE doctor_id=$1 AND provider='GOOGLE_CALENDAR'`,[doctorId]);
}
