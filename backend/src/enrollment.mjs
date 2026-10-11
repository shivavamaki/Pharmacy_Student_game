import {trainingDates} from './enrollment-fields.mjs';
import {AuthError} from './auth.mjs';
import {readBody} from './game.mjs';
const fail=(code='invalid_enrollment',status=400)=>{throw new AuthError(code,status);};
const text=(v,max,required=true)=>{if(!required&&(v===undefined||v===null||v===''))return '';if(typeof v!=='string'||v.length>max||(required&&!v.trim()))fail();return v.trim();};

const view=(row,identity)=>({status:row?.status||'not_registered',identity:{email:identity.email,displayName:identity.displayName||''},profile:row?{id:row.id,displayName:row.display_name,university:row.university,rotation:row.rotation,cohort:row.cohort,trainingStart:row.training_start,trainingEnd:row.training_end}:null});
export async function enrollmentAPI(request,env,verifyToken){
 if(!['GET','POST'].includes(request.method))fail('method_not_allowed',405);
 if(!env.FIREBASE_PROJECT_ID||!env.DB)fail('authentication_not_configured',503);
 const match=/^Bearer ([^\s]+)$/i.exec(request.headers.get('Authorization')||'');if(!match)fail('authentication_required',401);
 const identity=await verifyToken(match[1],env.FIREBASE_PROJECT_ID);
 if(!identity||typeof identity.uid!=='string'||!identity.uid||typeof identity.email!=='string'||!identity.email)fail('invalid_token',401);
 const db=env.DB;const columns=(await db.prepare('PRAGMA table_info(profiles)').all()).results;
 if(!['cohort','training_start','training_end'].every(name=>columns.some(c=>c.name===name)))fail('migration_required',503);
 const find=()=>db.prepare('SELECT id,display_name,university,rotation,cohort,training_start,training_end,status FROM profiles WHERE firebase_uid=?').bind(identity.uid).first();
 const existing=await find();if(request.method==='GET')return view(existing,identity);
 const body=await readBody(request);
 const allowed=['displayName','university','rotation','cohort','trainingStart','trainingEnd'];
 if(Object.keys(body).some(k=>!allowed.includes(k)))fail();
 const name=text(body.displayName,200),university=text(body.university,200),rotation=text(body.rotation,200),cohort=text(body.cohort,200);
 const [start,end]=trainingDates(body.trainingStart,body.trainingEnd,true);
 // Existing pending, active or inactive accounts cannot grant themselves access or relink identity.
 if(existing)return view(existing,identity);
 const profileId=crypto.randomUUID();
 try{await db.batch([
 db.prepare("INSERT INTO profiles(id,firebase_uid,email,display_name,university,rotation,role,status,cohort,training_start,training_end) VALUES(?,?,?,?,?,?,'student','pending',?,?,?)").bind(profileId,identity.uid,identity.email,name,university,rotation,cohort,start,end),
 db.prepare("INSERT INTO audit_events(id,actor_profile_id,action,entity_id) VALUES(?,?,'student.register',?)").bind(crypto.randomUUID(),profileId,profileId)
 ]);}catch(error){if(/UNIQUE constraint/.test(String(error.message))){const row=await find();if(row)return view(row,identity);fail('enrollment_conflict',409);}throw error;}
 return view(await find(),identity);
}
