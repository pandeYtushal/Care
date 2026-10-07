import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Router, type Response } from 'express';
import { env } from '../config/env';
import { calendarCallbackUri, calendarReady, encryptCalendarToken, revokeCalendarToken } from '../integrations/googleCalendar';
import { pool } from '../db';
import { asyncRoute } from '../http';
import { requireAuth, requireRole } from '../middleware/auth';
import { externalFetch } from '../integrations/http';

const router=Router();
const cookieOpts=`Path=/api/integrations/google; HttpOnly; SameSite=Lax; Max-Age=600${env.nodeEnv==='production'?'; Secure':''}`;
function setCookie(res:Response,name:string,value:string){res.append('Set-Cookie',`${name}=${encodeURIComponent(value)}; ${cookieOpts}`);}
function clearCookies(res:Response){for(const name of ['atelier_calendar_state','atelier_calendar_verifier'])res.append('Set-Cookie',`${name}=; Path=/api/integrations/google; HttpOnly; SameSite=Lax; Max-Age=0${env.nodeEnv==='production'?'; Secure':''}`);}
function integrationUrl(result:string){const origin=env.allowedOrigins[0]??'http://localhost:5173';return `${origin}/doctor/integrations?calendar=${encodeURIComponent(result)}`;}

router.use(requireAuth,requireRole('DOCTOR'));
router.get('/google/status',asyncRoute(async(req,res)=>{
  const result=await pool.query(`SELECT connected_email,created_at,updated_at FROM doctor_google_calendar_tokens WHERE doctor_id=$1`,[req.user!.doctorId]);
  return res.json({configured:calendarReady(),connected:Boolean(result.rowCount),email:result.rows[0]?.connected_email??null,connectedAt:result.rows[0]?.created_at??null});
}));
router.get('/google/connect',(req,res)=>{
  if(!calendarReady())return res.redirect(integrationUrl('not_configured'));
  const state=randomBytes(32).toString('base64url'),verifier=randomBytes(48).toString('base64url');
  const challenge=createHash('sha256').update(verifier).digest('base64url');
  setCookie(res,'atelier_calendar_state',state);setCookie(res,'atelier_calendar_verifier',verifier);
  const params=new URLSearchParams({client_id:env.googleClientId,redirect_uri:calendarCallbackUri(),response_type:'code',scope:'openid email https://www.googleapis.com/auth/calendar.events',access_type:'offline',prompt:'consent',include_granted_scopes:'true',state,code_challenge:challenge,code_challenge_method:'S256'});
  return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});
router.get('/google/callback',asyncRoute(async(req,res)=>{
  const state=req.cookies?.atelier_calendar_state??'',verifier=req.cookies?.atelier_calendar_verifier??'',supplied=typeof req.query.state==='string'?req.query.state:'';
  clearCookies(res);
  if(!state||!verifier||!supplied||state.length!==supplied.length||!timingSafeEqual(Buffer.from(state),Buffer.from(supplied)))return res.redirect(integrationUrl('state_error'));
  if(typeof req.query.error==='string'||typeof req.query.code!=='string')return res.redirect(integrationUrl('cancelled'));
  if(!calendarReady())return res.redirect(integrationUrl('not_configured'));
  try{
    const tokenResponse=await externalFetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code:req.query.code,client_id:env.googleClientId,client_secret:env.googleClientSecret,redirect_uri:calendarCallbackUri(),grant_type:'authorization_code',code_verifier:verifier})});
    const token=await tokenResponse.json().catch(()=>({})) as {access_token?:string;refresh_token?:string;expires_in?:number;scope?:string};
    if(!tokenResponse.ok||!token.access_token||!token.refresh_token||!token.scope?.includes('https://www.googleapis.com/auth/calendar.events'))return res.redirect(integrationUrl('consent_error'));
    const userResponse=await externalFetch('https://www.googleapis.com/oauth2/v2/userinfo',{headers:{Authorization:`Bearer ${token.access_token}`}});
    const googleUser=await userResponse.json().catch(()=>({})) as {email?:string;verified_email?:boolean};
    if(!userResponse.ok||!googleUser.email||googleUser.verified_email!==true)return res.redirect(integrationUrl('account_error'));
    const expires=new Date(Date.now()+Math.max(60,Number(token.expires_in??3600)-60)*1000);
    const client=await pool.connect();
    try{
      await client.query('BEGIN');
      await client.query(`INSERT INTO doctor_google_calendar_tokens(doctor_id,connected_email,access_token_ciphertext,refresh_token_ciphertext,access_token_expires_at,granted_scopes)
        VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(doctor_id) DO UPDATE SET connected_email=EXCLUDED.connected_email,access_token_ciphertext=EXCLUDED.access_token_ciphertext,refresh_token_ciphertext=EXCLUDED.refresh_token_ciphertext,access_token_expires_at=EXCLUDED.access_token_expires_at,granted_scopes=EXCLUDED.granted_scopes,updated_at=now()`,[req.user!.doctorId,googleUser.email,encryptCalendarToken(token.access_token),encryptCalendarToken(token.refresh_token),expires,token.scope]);
      await client.query(`INSERT INTO integration_connections(doctor_id,provider,external_account_ref,connected_at,disconnected_at,metadata) VALUES($1,'GOOGLE_CALENDAR',$2,now(),NULL,'{}')
        ON CONFLICT(doctor_id,provider) DO UPDATE SET external_account_ref=EXCLUDED.external_account_ref,connected_at=now(),disconnected_at=NULL,metadata='{}'`,[req.user!.doctorId,googleUser.email]);
      await client.query(`INSERT INTO audit_logs(actor_user_id,action,resource_type,metadata) VALUES($1,'GOOGLE_CALENDAR_CONNECTED','DOCTOR','{}')`,[req.user!.id]);
      await client.query('COMMIT');
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
    return res.redirect(integrationUrl('connected'));
  }catch(error){console.error('Google Calendar connection failed',{errorType:error instanceof Error?error.name:'UnknownError'});return res.redirect(integrationUrl('connection_error'));}
}));
router.delete('/google',asyncRoute(async(req,res)=>{
  await revokeCalendarToken(req.user!.doctorId!);
  await pool.query(`INSERT INTO audit_logs(actor_user_id,action,resource_type,metadata) VALUES($1,'GOOGLE_CALENDAR_DISCONNECTED','DOCTOR','{}')`,[req.user!.id]);
  return res.json({message:'Google Calendar disconnected.'});
}));
export default router;
