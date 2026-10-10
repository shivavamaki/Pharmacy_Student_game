import { AuthError } from './auth.mjs';
import { normalizeRecap, calculateRecapResult } from '../../frontend/recap-model.mjs';
const fail=(code='invalid_request',status=400)=>{throw new AuthError(code,status);};
const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const text=(v,max=4000,required=false)=>{if(v==null&&!required)return '';if(typeof v!=='string'||v.length>max||(required&&!v.trim()))fail();return v.trim();};
const id=v=>text(v,256,true);
const integer=(v,min,max)=>{if(!Number.isInteger(v)||v<min||v>max)fail();return v;};
const oneOf=(v,choices)=>choices.includes(v)?v:fail();
const jsonObject=(v,max=16000)=>{if(!object(v)||JSON.stringify(v).length>max)fail();return JSON.stringify(v);};
const reviewer=p=>['admin','gm','preceptor'].includes(p.role);
const scopeSQL=(alias='p',mode='read')=> mode==='review'
 ? `(${alias}.status='active' AND (?='admin' OR (? IN ('gm','preceptor') AND ${alias}.gm_profile_id=?)))`
 : mode==='write' ? `(${alias}.status='active' AND (?='admin' OR (?='student' AND EXISTS(SELECT 1 FROM party_members m WHERE m.party_id=${alias}.id AND m.profile_id=?))))`
 : `(${alias}.status='active' AND (?='admin' OR (? IN ('gm','preceptor') AND ${alias}.gm_profile_id=?) OR EXISTS(SELECT 1 FROM party_members m WHERE m.party_id=${alias}.id AND m.profile_id=?)))`;
const scopeArgs=(p,mode='read')=>mode==='read'?[p.role,p.role,p.id,p.id]:[p.role,p.role,p.id];
const stmt=(db,sql,...values)=>db.prepare(sql).bind(...values);
const all=async(db,sql,...v)=>(await stmt(db,sql,...v).all()).results;
const first=async(db,sql,...v)=>stmt(db,sql,...v).first();
async function party(db,p,partyId,mode='read'){
 const row=await first(db,`SELECT p.* FROM parties p WHERE p.id=? AND ${scopeSQL('p',mode)}`,id(partyId),...scopeArgs(p,mode));
 if(!row)fail('not_found',404);return row;
}
async function assignment(db,p,assignmentId,mode='read'){
 const row=await first(db,`SELECT a.*,q.name quest_name FROM assignments a JOIN parties p ON p.id=a.party_id JOIN quests q ON q.id=a.quest_id WHERE a.id=? AND a.status!='archived' AND q.status!='archived' AND ${scopeSQL('p',mode)}`,id(assignmentId),...scopeArgs(p,mode));
 if(!row)fail('not_found',404);
 // Reviewing a task additionally requires its assigned GM (admin is the explicit override).
 if(mode==='review'&&p.role!=='admin'&&row.assigned_gm_profile_id!==p.id)fail('not_found',404);
 return row;
}
function assignmentGuard(p,a,mode){return {sql:`EXISTS(SELECT 1 FROM assignments a JOIN parties p ON p.id=a.party_id JOIN quests q ON q.id=a.quest_id WHERE a.id=? AND a.version=? AND a.status=? AND q.status!='archived' AND ${scopeSQL('p',mode)} ${mode==='review'?"AND (?='admin' OR a.assigned_gm_profile_id=?)":''})`,args:[a.id,a.version,a.status,...scopeArgs(p,mode),...(mode==='review'?[p.role,p.id]:[])]};}
function partyGuard(p,partyId,mode){return{sql:`EXISTS(SELECT 1 FROM parties p WHERE p.id=? AND ${scopeSQL('p',mode)})`,args:[partyId,...scopeArgs(p,mode)]};}
async function fingerprint(route,body){const bytes=new TextEncoder().encode(route+'\n'+JSON.stringify(body));return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');}
export async function readBody(request){
 if(!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||''))fail('json_required',415);
 if(Number(request.headers.get('Content-Length')||0)>65536)fail('payload_too_large',413);
 const reader=request.body?.getReader();if(!reader)fail();const chunks=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>65536){await reader.cancel();fail('payload_too_large',413);}chunks.push(value);}
 const bytes=new Uint8Array(size);let pos=0;for(const chunk of chunks){bytes.set(chunk,pos);pos+=chunk.length;}
 let body;try{body=JSON.parse(new TextDecoder().decode(bytes));}catch{fail();}if(!object(body))fail();return body;
}
async function replay(db,p,key,hash){const row=await first(db,'SELECT request_hash,result_json FROM api_operations WHERE actor_profile_id=? AND idempotency_key=?',p.id,key);if(!row)return null;if(row.request_hash!==hash)fail('idempotency_conflict',409);return JSON.parse(row.result_json);}
async function mutate(db,p,key,hash,guard,statements,result,action,entityId){
 const operationId=crypto.randomUUID();
 try{
 await db.batch([
 stmt(db,`INSERT INTO api_operations(id,actor_profile_id,idempotency_key,request_hash,result_json,allowed) VALUES(?,?,?,?,?,(EXISTS(SELECT 1 FROM profiles WHERE id=? AND role=? AND status='active') AND (${guard.sql})))`,operationId,p.id,key,hash,JSON.stringify(result),p.id,p.role,...guard.args),
 ...statements,
 stmt(db,'INSERT INTO audit_events(id,actor_profile_id,action,entity_id) VALUES(?,?,?,?)',crypto.randomUUID(),p.id,action,entityId)
 ]);
 }catch(error){const previous=await replay(db,p,key,hash);if(previous)return previous;if(/CHECK constraint|UNIQUE constraint/.test(String(error.message)))fail('state_changed',409);throw error;}
 return result;
}
const updateAssignment=(db,a,patchSQL,...values)=>stmt(db,`UPDATE assignments SET ${patchSQL},version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?`,...values,a.id);
function safeURL(value){const raw=text(value,2048,true);let u;try{u=new URL(raw);}catch{fail();}if(u.protocol!=='https:'||u.username||u.password)fail('invalid_evidence_url',400);return u.href;}
const page=rows=>({items:rows.slice(0,100),hasMore:rows.length>100});

export async function gameAPI(request,db,p,path){
 const parts=path.split('/').slice(2).map(s=>{try{return decodeURIComponent(s);}catch{fail();}});
 const method=request.method;
 if(!['GET','POST'].includes(method))fail('method_not_allowed',405);
 let body,key,hash;
 if(method==='POST'){
 body=await readBody(request);key=request.headers.get('Idempotency-Key');if(typeof key!=='string'||!/^[A-Za-z0-9_-]{8,128}$/.test(key))fail('idempotency_key_required',400);
 hash=await fingerprint(path,body);const previous=await replay(db,p,key,hash);if(previous)return previous;
 }
 const [root,target,action]=parts;
 if(root==='summary'&&parts.length===1&&method==='GET'){
 const profile=await first(db,'SELECT id,display_name displayName,role,university,rotation,character_class characterClass FROM profiles WHERE id=?',p.id);
 const xp=await first(db,'SELECT COALESCE((SELECT SUM(xp) FROM xp_awards WHERE profile_id=?),0)+COALESCE((SELECT SUM(xp) FROM historical_xp WHERE profile_id=?),0) AS total',p.id,p.id);
 const badges=await all(db,'SELECT badge_name,created_at FROM badge_awards WHERE profile_id=? UNION ALL SELECT badge_name,created_at FROM historical_badges WHERE profile_id=? ORDER BY created_at DESC LIMIT 101',p.id,p.id);
 const xpLog=await all(db,"SELECT id,xp,'Quest completed' reason,created_at FROM xp_awards WHERE profile_id=? UNION ALL SELECT id,xp,reason,created_at FROM historical_xp WHERE profile_id=? ORDER BY created_at DESC LIMIT 101",p.id,p.id);
 return {profile,xp:xp.total,level:Math.floor(xp.total/150)+1,badges:page(badges),xpLog:page(xpLog)};
 }
 if(root==='quests'&&parts.length===1&&method==='GET'){
 return page(await all(db,"SELECT id,name,objective,quest_type,xp_reward,metadata_json FROM quests WHERE status='available' ORDER BY name,id LIMIT 101"));
 }
 if(root==='parties'&&target&&action==='dashboard'&&parts.length===3&&method==='GET'){
 const team=await party(db,p,target);const members=await all(db,'SELECT u.id,u.display_name,u.role,u.status FROM party_members m JOIN profiles u ON u.id=m.profile_id WHERE m.party_id=? ORDER BY u.display_name LIMIT 101',target);
 const tasks=await all(db,"SELECT a.*,q.name quest_name,q.objective FROM assignments a JOIN quests q ON q.id=a.quest_id WHERE a.party_id=? AND a.status!='archived' AND q.status!='archived' ORDER BY a.created_at DESC,a.id LIMIT 101",target);
 return {party:team,members:page(members),assignments:page(tasks),canReview:reviewer(p)&&(p.role==='admin'||team.gm_profile_id===p.id),canWrite:p.role==='admin'||p.role==='student'};
 }
 if(root==='parties'&&target&&action==='accept'&&parts.length===3&&method==='POST'){
 const team=await party(db,p,target,'write');const quest=await first(db,"SELECT * FROM quests WHERE id=? AND status='available'",id(body.questId));if(!quest)fail('quest_not_available',409);
 const existing=await first(db,"SELECT id FROM assignments WHERE party_id=? AND quest_id=? AND status NOT IN ('completed','archived')",team.id,quest.id);if(existing)fail('already_assigned',409);
 const members=await all(db,"SELECT m.profile_id FROM party_members m JOIN profiles u ON u.id=m.profile_id WHERE m.party_id=? AND u.status='active' LIMIT 101",team.id);if(!members.length||members.length>100)fail('invalid_party_members',409);
 const roles=body.partyRoles||{};jsonObject(roles,8000);for(const [member,role]of Object.entries(roles)){if(!members.some(m=>m.profile_id===member))fail();text(role,120,true);}
 const metadata=JSON.parse(quest.metadata_json);const days=Number.isInteger(metadata.defaultDeadlineDays)?Math.min(365,Math.max(1,metadata.defaultDeadlineDays)):3;
 const taskId=crypto.randomUUID();const deadline=new Date(Date.now()+days*86400000).toISOString();
 const guard=partyGuard(p,team.id,'write');guard.sql+=` AND EXISTS(SELECT 1 FROM quests WHERE id=? AND status='available' AND xp_reward=?) AND NOT EXISTS(SELECT 1 FROM assignments WHERE party_id=? AND quest_id=? AND status NOT IN ('completed','archived'))`;
 guard.args.push(quest.id,quest.xp_reward,team.id,quest.id);
 return mutate(db,p,key,hash,guard,[
 stmt(db,"INSERT INTO assignments(id,quest_id,party_id,assigned_gm_profile_id,status,deadline,accepted_at,party_roles_json,reward_xp,reward_badge) VALUES(?,?,?,?,'waiting_gm_approval',?,CURRENT_TIMESTAMP,?,?,?)",taskId,quest.id,team.id,team.gm_profile_id,deadline,JSON.stringify(roles),quest.xp_reward,text(metadata.badgeReward,200)||null),
 stmt(db,"INSERT INTO assignment_participants SELECT ?,m.profile_id FROM party_members m JOIN profiles u ON u.id=m.profile_id WHERE m.party_id=? AND u.status='active'",taskId,team.id)
 ],{ok:true,assignmentId:taskId},'quest.accept',taskId);
 }
 if(root==='assignments'&&target&&parts.length===2&&method==='GET'){
 const task=await assignment(db,p,target);return{assignment:task,daily:page(await all(db,'SELECT d.*,u.display_name submitted_name FROM daily_progress d JOIN profiles u ON u.id=d.submitted_by WHERE assignment_id=? ORDER BY d.created_at DESC,d.id LIMIT 101',target)),evidence:page(await all(db,'SELECT e.*,u.display_name submitted_name FROM evidence e JOIN profiles u ON u.id=e.submitted_by WHERE assignment_id=? ORDER BY e.submitted_at DESC,e.id LIMIT 101',target)),participants:await all(db,'SELECT u.id,u.display_name FROM assignment_participants m JOIN profiles u ON u.id=m.profile_id WHERE m.assignment_id=? LIMIT 101',target),canReview:reviewer(p)&&(p.role==='admin'||task.assigned_gm_profile_id===p.id)&& (await party(db,p,task.party_id)).gm_profile_id===p.id||p.role==='admin',canWrite:['student','admin'].includes(p.role)};
 }
 if(root==='assignments'&&target&&parts.length===3&&method==='POST'){
 const review=['approve','complete'].includes(action);const task=await assignment(db,p,target,review?'review':'write');const guard=assignmentGuard(p,task,review?'review':'write');
 if(action==='approve'){
 if(task.status!=='waiting_gm_approval')fail('invalid_transition',409);
 return mutate(db,p,key,hash,guard,[updateAssignment(db,task,"status='in_progress'")],{ok:true},'quest.approve',target);
 }
 if(action==='daily'){
 if(!['in_progress','revision_required'].includes(task.status))fail('invalid_transition',409);
 const progress=integer(body.progressPercent,0,100);const risk=oneOf(body.risk,['green','yellow','red']);const current=text(body.currentTurn,4000,true);const date=text(body.progressDate,10,true);if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)fail();
 const progressId=crypto.randomUUID();
 return mutate(db,p,key,hash,guard,[stmt(db,'INSERT INTO daily_progress(id,assignment_id,submitted_by,progress_date,previous_turn,current_turn,obstacle,need_gm_support,risk,progress_percent) VALUES(?,?,?,?,?,?,?,?,?,?)',progressId,target,p.id,date,text(body.previousTurn),current,text(body.obstacle),text(body.needGMSupport),risk,progress),updateAssignment(db,task,'progress=?,risk=?',progress,risk)],{ok:true,progressId},'progress.submit',target);
 }
 if(action==='evidence'){
 if(!['in_progress','revision_required','waiting_gm_review'].includes(task.status))fail('invalid_transition',409);
 const evidenceId=crypto.randomUUID();const title=text(body.title,300,true),url=safeURL(body.url),type=text(body.evidenceType,100,true),reflection=text(body.reflectionNote);
 return mutate(db,p,key,hash,guard,[stmt(db,"UPDATE evidence SET review_status='superseded' WHERE assignment_id=? AND review_status='revision_required'",target),stmt(db,'INSERT INTO evidence(id,assignment_id,submitted_by,evidence_type,title,url,reflection_note) VALUES(?,?,?,?,?,?,?)',evidenceId,target,p.id,type,title,url,reflection),updateAssignment(db,task,"status='waiting_gm_review',progress=MAX(progress,80)")],{ok:true,evidenceId},'evidence.submit',target);
 }
 if(action==='complete'){
 if(task.status==='completed')return{ok:true,xp:task.reward_xp,alreadyCompleted:true};
 if(task.status!=='waiting_gm_review')fail('invalid_transition',409);
 guard.sql+=" AND EXISTS(SELECT 1 FROM evidence WHERE assignment_id=? AND review_status='approved') AND NOT EXISTS(SELECT 1 FROM evidence WHERE assignment_id=? AND review_status IN ('waiting_review','revision_required'))";guard.args.push(target,target);
 const approval=await first(db,"SELECT COUNT(*) approved FROM evidence WHERE assignment_id=? AND review_status='approved'",target);const outstanding=await first(db,"SELECT COUNT(*) pending FROM evidence WHERE assignment_id=? AND review_status IN ('waiting_review','revision_required')",target);if(!approval.approved||outstanding.pending)fail('evidence_not_approved',409);
 return mutate(db,p,key,hash,guard,[updateAssignment(db,task,"status='completed',progress=100"),stmt(db,"INSERT INTO xp_awards(id,assignment_id,profile_id,xp,approved_by) SELECT ?||':'||m.profile_id,a.id,m.profile_id,a.reward_xp,? FROM assignment_participants m JOIN assignments a ON a.id=m.assignment_id WHERE a.id=?",crypto.randomUUID(),p.id,target),stmt(db,"INSERT INTO badge_awards(id,assignment_id,profile_id,badge_name,approved_by) SELECT ?||':'||m.profile_id,a.id,m.profile_id,a.reward_badge,? FROM assignment_participants m JOIN assignments a ON a.id=m.assignment_id WHERE a.id=? AND a.reward_badge IS NOT NULL AND a.reward_badge!=''",crypto.randomUUID(),p.id,target)],{ok:true,xp:task.reward_xp,badge:task.reward_badge},'quest.complete',target);
 }
 }
 if(['daily','evidence'].includes(root)&&target&&action==='review'&&parts.length===3&&method==='POST'){
 const table=root==='daily'?'daily_progress':'evidence';const row=await first(db,`SELECT * FROM ${table} WHERE id=?`,id(target));if(!row)fail('not_found',404);const task=await assignment(db,p,row.assignment_id,'review');if(task.status==='completed')fail('invalid_transition',409);const guard=assignmentGuard(p,task,'review');
 if(root==='daily')return mutate(db,p,key,hash,guard,[stmt(db,'UPDATE daily_progress SET gm_comment=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=?',text(body.comment,4000,true),p.id,target),updateAssignment(db,task,'gm_comment=?',text(body.comment,4000,true))],{ok:true},'progress.review',target);
 if(!['waiting_review','revision_required'].includes(row.review_status)||task.status!=='waiting_gm_review')fail('invalid_transition',409);
 if(typeof body.approved!=='boolean')fail();const status=body.approved?'approved':'revision_required';
 return mutate(db,p,key,hash,guard,[stmt(db,'UPDATE evidence SET review_status=?,gm_feedback=?,competency_result=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=?',status,text(body.feedback),text(body.competencyResult,1000),p.id,target),updateAssignment(db,task,body.approved?'gm_comment=?':"status='revision_required',gm_comment=?",text(body.feedback))],{ok:true,status},'evidence.review',target);
 }
 if(root==='gm-queue'&&parts.length===1&&method==='GET'){
 if(!reviewer(p))fail('forbidden',403);
 return page(await all(db,`SELECT a.id,a.status,a.progress,q.name quest_name,p.name party_name FROM assignments a JOIN parties p ON p.id=a.party_id JOIN quests q ON q.id=a.quest_id WHERE a.status IN ('waiting_gm_approval','in_progress','waiting_gm_review','revision_required') AND q.status!='archived' AND ${scopeSQL('p','review')} AND (?='admin' OR a.assigned_gm_profile_id=?) ORDER BY a.created_at,a.id LIMIT 101`,...scopeArgs(p,'review'),p.role,p.id));
 }
 if(root==='assessments'&&parts.length===1){
 if(method==='GET')return page(await all(db,`SELECT a.*,u.display_name assessor_name FROM assessments a JOIN profiles u ON u.id=a.preceptor_profile_id JOIN parties p ON p.id=a.party_id WHERE a.profile_id=? OR ${scopeSQL('p','review')} ORDER BY a.created_at DESC,a.id LIMIT 101`,p.id,...scopeArgs(p,'review')));
 const team=await party(db,p,id(body.partyId),'review');const student=await first(db,"SELECT u.id FROM profiles u JOIN party_members m ON m.profile_id=u.id WHERE m.party_id=? AND u.id=? AND u.role='student' AND u.status='active'",team.id,id(body.profileId));if(!student)fail('not_found',404);
 if(typeof body.score!=='number'||typeof body.maxScore!=='number'||!Number.isFinite(body.score)||!Number.isFinite(body.maxScore)||body.maxScore<=0||body.maxScore>10000||body.score<0||body.score>body.maxScore)fail();
 const assessmentId=crypto.randomUUID();const guard=partyGuard(p,team.id,'review');guard.sql+=" AND EXISTS(SELECT 1 FROM party_members m JOIN profiles u ON u.id=m.profile_id WHERE m.party_id=? AND u.id=? AND u.role='student' AND u.status='active')";guard.args.push(team.id,student.id);
 return mutate(db,p,key,hash,guard,[stmt(db,'INSERT INTO assessments(id,profile_id,party_id,rotation,assessment_type,score,max_score,rubric_json,feedback,preceptor_profile_id) VALUES(?,?,?,?,?,?,?,?,?,?)',assessmentId,student.id,team.id,text(body.rotation,200),text(body.assessmentType,100,true),body.score,body.maxScore,jsonObject(body.rubric||{}),text(body.feedback),p.id)],{ok:true,assessmentId},'assessment.save',assessmentId);
 }
 if(root==='recap'&&parts.length<=2){
 if(!target&&method==='GET')return{draft:await first(db,'SELECT answers_json,updated_at FROM recap_drafts WHERE profile_id=?',p.id),responses:page(await all(db,'SELECT id,answers_json,submitted_at FROM recap_responses WHERE profile_id=? ORDER BY submitted_at DESC,id LIMIT 101',p.id))};
 if(target==='analytics'&&method==='GET'){if(p.role!=='admin')fail('forbidden',403);return {
 responseCount:(await first(db,'SELECT COUNT(*) count FROM recap_responses')).count,
 averages:await first(db,"SELECT AVG(json_extract(answers_json,'$.answers.treasure.overallScore')) overallScore,AVG(json_extract(answers_json,'$.results.questScore')) questScore FROM recap_responses"),
 characters:await all(db,"SELECT json_extract(answers_json,'$.profile.character') label,COUNT(*) count FROM recap_responses GROUP BY label ORDER BY count DESC"),
 skills:await all(db,"SELECT j.value label,COUNT(*) count FROM recap_responses r,json_each(r.answers_json,'$.answers.skill.unlockedSkills') j GROUP BY j.value ORDER BY count DESC LIMIT 100"),
 patches:await all(db,"SELECT j.value label,COUNT(*) count FROM recap_responses r,json_each(r.answers_json,'$.answers.patch.patchRequests') j GROUP BY j.value ORDER BY count DESC LIMIT 100")
 };}
 if(['draft','submit'].includes(target)&&method==='POST'){
 let recap;try{recap=normalizeRecap(body.response);}catch{fail('invalid_recap',400);}const results=calculateRecapResult(recap);const data=JSON.stringify({...recap,results});
 const guard={sql:'1',args:[]};
 if(target==='draft')return mutate(db,p,key,hash,guard,[stmt(db,'INSERT INTO recap_drafts(profile_id,answers_json) VALUES(?,?) ON CONFLICT(profile_id) DO UPDATE SET answers_json=excluded.answers_json,updated_at=CURRENT_TIMESTAMP',p.id,data)],{ok:true,results},'recap.draft',p.id);
 if(!recap.profile.character)fail('recap_incomplete',400);
 const responseId=crypto.randomUUID();return mutate(db,p,key,hash,guard,[stmt(db,'INSERT INTO recap_responses(id,profile_id,idempotency_key,answers_json) VALUES(?,?,?,?)',responseId,p.id,key,data),stmt(db,'DELETE FROM recap_drafts WHERE profile_id=?',p.id)],{ok:true,responseId,results},'recap.submit',responseId);
 }
 }
 if(root==='admin')return adminAPI(db,p,parts,method,body,key,hash);
 fail('not_found',404);
}

async function adminAPI(db,p,parts,method,body,key,hash){
 if(p.role!=='admin')fail('forbidden',403);const [,resource,target]=parts;if(parts.length>3)fail('not_found',404);
 const guard={sql:'1',args:[]};
 if(method==='GET'){
 if(resource==='profiles')return page(await all(db,'SELECT id,firebase_uid,email,display_name,university,rotation,character_class,role,status FROM profiles ORDER BY display_name,id LIMIT 101'));
 if(resource==='quests')return page(await all(db,'SELECT * FROM quests ORDER BY name,id LIMIT 101'));
 if(resource==='parties')return page(await all(db,'SELECT p.*,(SELECT json_group_array(profile_id) FROM party_members WHERE party_id=p.id) member_ids_json FROM parties p ORDER BY p.name,p.id LIMIT 101'));
 if(resource==='settings')return page(await all(db,'SELECT * FROM settings ORDER BY key LIMIT 101'));
 if(resource==='audit')return page(await all(db,'SELECT id,actor_profile_id,action,entity_id,created_at FROM audit_events ORDER BY created_at DESC,id LIMIT 101'));
 if(resource==='recaps')return page(await all(db,'SELECT id,profile_id,answers_json,submitted_at FROM recap_responses ORDER BY submitted_at DESC,id LIMIT 101'));
 }
 if(resource==='profiles'&&method==='POST'){
 const profileId=id(body.id),uid=body.firebaseUid==null?null:text(body.firebaseUid,128,true),email=body.email==null?null:text(body.email,320,true),role=oneOf(body.role,['student','gm','preceptor','admin']),status=oneOf(body.status,['pending','active','inactive']);if(profileId===p.id&&(role!=='admin'||status!=='active'))fail('cannot_disable_self',409);
 const old=await first(db,'SELECT role,status FROM profiles WHERE id=?',profileId);if(old?.role==='admin'&&(role!=='admin'||status!=='active')){guard.sql="(SELECT COUNT(*) FROM profiles WHERE role='admin' AND status='active')>1";}
 return mutate(db,p,key,hash,guard,[stmt(db,'INSERT INTO profiles(id,firebase_uid,email,display_name,university,rotation,character_class,role,status) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET firebase_uid=excluded.firebase_uid,email=excluded.email,display_name=excluded.display_name,university=excluded.university,rotation=excluded.rotation,character_class=excluded.character_class,role=excluded.role,status=excluded.status,updated_at=CURRENT_TIMESTAMP',profileId,uid,email,text(body.displayName,200,true),text(body.university,200),text(body.rotation,200),text(body.characterClass,200),role,status)],{ok:true},'profile.save',profileId);
 }
 if(resource==='quests'&&method==='POST'){
 const questId=id(body.id);const metadata={chapter:integer(body.chapter??1,1,100),category:text(body.category,200),competencies:body.competencies||[],requiredEvidence:body.requiredEvidence||[],badgeReward:text(body.badgeReward,200),defaultDeadlineDays:integer(body.defaultDeadlineDays??3,1,365)};
 for(const arr of [metadata.competencies,metadata.requiredEvidence]){if(!Array.isArray(arr)||arr.length>50)fail();arr.forEach(v=>text(v,200,true));}
 return mutate(db,p,key,hash,guard,[stmt(db,'INSERT INTO quests(id,name,objective,quest_type,xp_reward,status,metadata_json) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,objective=excluded.objective,quest_type=excluded.quest_type,xp_reward=excluded.xp_reward,status=excluded.status,metadata_json=excluded.metadata_json',questId,text(body.name,300,true),text(body.objective),text(body.questType,100,true),integer(body.xpReward,0,100000),oneOf(body.status,['available','locked','archived']),JSON.stringify(metadata))],{ok:true},'quest.save',questId);
 }
 if(resource==='parties'&&method==='POST'){
 const partyId=id(body.id);const gm=body.gmProfileId?id(body.gmProfileId):null;if(gm&&!await first(db,"SELECT id FROM profiles WHERE id=? AND role IN ('gm','preceptor','admin') AND status='active'",gm))fail('invalid_gm',400);
 if(!Array.isArray(body.memberIds)||!body.memberIds.length||body.memberIds.length>100||new Set(body.memberIds).size!==body.memberIds.length)fail();
 body.memberIds.forEach(id);const memberJSON=JSON.stringify(body.memberIds);
 const memberCount=await first(db,'SELECT COUNT(*) count FROM profiles WHERE id IN (SELECT value FROM json_each(?))',memberJSON);
 if(memberCount.count!==body.memberIds.length)fail('invalid_member',400);
 guard.sql="(SELECT COUNT(*) FROM profiles WHERE id IN (SELECT value FROM json_each(?)))=? AND (? IS NULL OR EXISTS(SELECT 1 FROM profiles WHERE id=? AND role IN ('gm','preceptor','admin') AND status='active'))";
 guard.args=[memberJSON,body.memberIds.length,gm,gm];
 // Reassignment revokes the old GM's pending queue; completed assignments keep their historical approver.
 const statements=[stmt(db,'INSERT INTO parties(id,name,rotation,gm_profile_id,status) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,rotation=excluded.rotation,gm_profile_id=excluded.gm_profile_id,status=excluded.status',partyId,text(body.name,200,true),text(body.rotation,200),gm,oneOf(body.status,['active','archived'])),stmt(db,'DELETE FROM party_members WHERE party_id=?',partyId),stmt(db,'INSERT INTO party_members(party_id,profile_id) SELECT ?,value FROM json_each(?)',partyId,memberJSON),stmt(db,"UPDATE assignments SET assigned_gm_profile_id=?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE party_id=? AND status NOT IN ('completed','archived')",gm,partyId)];
 return mutate(db,p,key,hash,guard,statements,{ok:true},'party.save',partyId);
 }
 if(resource==='settings'&&method==='POST')return mutate(db,p,key,hash,guard,[stmt(db,'INSERT INTO settings(key,value_json) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=CURRENT_TIMESTAMP',id(body.key),jsonObject(body.value))],{ok:true},'settings.save',body.key);
 fail('not_found',404);
}
