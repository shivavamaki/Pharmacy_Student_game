// Offline converter. Never connects to Google/Cloudflare and never imports credentials.
import { readFileSync,writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { normalizeRecap } from '../../frontend/recap-model.mjs';
const str=v=>v==null?'':String(v);
const nullable=v=>v==null||v===''?null:String(v);
const parse=(v,fallback)=>{if(v==null||v==='')return fallback;return typeof v==='string'?JSON.parse(v):v;};
const date=v=>{if(!v)return new Date(0).toISOString();const input=typeof v==='string'&&/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(v)?v.replace(' ','T')+'+07:00':v;const d=new Date(input);if(Number.isNaN(d.valueOf()))throw Error('Invalid source date');return d.toISOString();};
const number=(v,min=0)=>{const n=Number(v||0);if(!Number.isFinite(n)||n<min)throw Error('Invalid numeric value');return n;};
const quote=v=>v===null?'NULL':typeof v==='number'?String(v):"'"+String(v).replace(/'/g,"''")+"'";
// The deployed recap-only application uses spaced Users headers.
export function normalizeLegacySource(source){
 if(!source||typeof source!=='object'||Array.isArray(source))throw Error('Expected object of sheet-name arrays');
 const output={...source};
 if(source.Users!==undefined){
  if(!Array.isArray(source.Users))throw Error('Invalid sheet Users');
  output.Users=source.Users.map(row=>{
   if(!row||typeof row!=='object'||Array.isArray(row))throw Error('Invalid Users row');
   const user={...row};
   for(const [alias,key]of [['User ID','UserID'],['Display Name','DisplayName'],['Created At','CreatedAt']]){
    if(Object.hasOwn(row,alias)){
     if(Object.hasOwn(row,key)&&str(row[key])!==str(row[alias]))throw Error('Conflicting Users column aliases: '+key);
     user[key]=row[alias];delete user[alias];
    }
   }
   if(Object.hasOwn(row,'Active')){
    const active=row.Active;
    if(![true,false,'TRUE','FALSE','true','false',1,0,'1','0'].includes(active))throw Error('Invalid Users Active value');
    const status=[true,'TRUE','true',1,'1'].includes(active)?'active':'inactive';
    if(user.Status!==undefined&&str(user.Status).toLowerCase()!==status)throw Error('Conflicting Users status columns');
    user.Status=status;
   }
   return user;
  });
 }
 return output;
}
export function convertLegacy(source){
 if(!source||typeof source!=='object'||Array.isArray(source))throw Error('Expected object of sheet-name arrays');
 source=normalizeLegacySource(source);
 const statements=[],counts={},warnings=[];
 const rows=name=>{const rows=source[name]||[];if(!Array.isArray(rows)||rows.some(r=>!r||typeof r!=='object'||Array.isArray(r)))throw Error('Invalid sheet '+name);return rows;};
 const insert=(table,row)=>{for(const [key,value]of Object.entries(row))if(value===undefined)throw Error('Missing '+table+'.'+key);statements.push(`INSERT INTO ${table} (${Object.keys(row).join(',')}) VALUES (${Object.values(row).map(quote).join(',')});`);counts[table]=(counts[table]||0)+1;};
 const users=new Map(rows('Users').map(u=>[str(u.UserID),u]));const parties=new Map(rows('Parties').map(p=>[str(p.PartyID),p]));const quests=new Map(rows('Quests').map(q=>[str(q.QuestID),q]));const assignments=new Map(rows('QuestAssignments').map(a=>[str(a.AssignmentID),a]));
 for(const [name,array,idKey]of [['Users',rows('Users'),'UserID'],['Parties',rows('Parties'),'PartyID'],['Quests',rows('Quests'),'QuestID'],['QuestAssignments',rows('QuestAssignments'),'AssignmentID']]){const ids=array.map(r=>str(r[idKey]));if(ids.some(v=>!v)||new Set(ids).size!==ids.length)throw Error('Missing or duplicate source ID in '+name);}
 const requireRef=(map,key,label)=>{if(!map.has(str(key)))throw Error('Missing '+label+' reference');return str(key);};
 const actor=v=>v?requireRef(users,v,'user'):null;
 for(const u of users.values()){
 const role=str(u.Role).toLowerCase();if(!['student','gm','preceptor','admin'].includes(role))throw Error('Invalid role');
 // Identity and activation always require explicit administrator enrollment after import.
 insert('profiles',{id:str(u.UserID),firebase_uid:null,email:null,display_name:str(u.DisplayName||u.Username),university:nullable(u.University),rotation:nullable(u.Rotation),character_class:nullable(u.CharacterClass),role,status:'pending',created_at:date(u.CreatedAt),updated_at:date(u.UpdatedAt||u.CreatedAt)});
 const logged=rows('XPLog').filter(x=>str(x.UserID)===str(u.UserID)).reduce((sum,x)=>sum+number(x.XP),0);if(u.XP!==undefined&&number(u.XP)!==logged)warnings.push({profileId:str(u.UserID),sourceProfileXP:number(u.XP),sourceXPLogTotal:logged,action:'Reconcile balance before cutover; import uses XPLog only.'});
 }
 for(const p of parties.values())insert('parties',{id:str(p.PartyID),name:str(p.PartyName),rotation:nullable(p.Rotation),gm_profile_id:actor(p.GMUserID),status:str(p.Status||'active').toLowerCase()});
 for(const q of quests.values())insert('quests',{id:str(q.QuestID),name:str(q.QuestName),objective:nullable(q.Objective),quest_type:nullable(q.QuestType),xp_reward:number(q.XPReward),status:str(q.Status||'locked').toLowerCase(),metadata_json:JSON.stringify({chapter:number(q.Chapter),category:str(q.Category),competencies:parse(q.Competencies,[]),requiredEvidence:parse(q.RequiredEvidence,[]),badgeReward:str(q.BadgeReward),defaultDeadlineDays:number(q.DefaultDeadlineDays||3),createdBy:actor(q.CreatedBy),createdAt:date(q.CreatedAt)})});
 const members=new Set();for(const p of parties.values()){const ids=parse(p.MemberUserIDs,[]);if(!Array.isArray(ids))throw Error('Invalid party members');for(const uid of ids)members.add(JSON.stringify([str(p.PartyID),requireRef(users,uid,'member')]));}
 for(const u of users.values())if(u.PartyID)members.add(JSON.stringify([requireRef(parties,u.PartyID,'party'),str(u.UserID)]));
 for(const pair of members){const [party_id,profile_id]=JSON.parse(pair);insert('party_members',{party_id,profile_id});}
 for(const a of assignments.values()){
 const q=quests.get(requireRef(quests,a.QuestID,'quest'));
 insert('assignments',{id:str(a.AssignmentID),quest_id:str(a.QuestID),party_id:requireRef(parties,a.PartyID,'party'),assigned_gm_profile_id:actor(a.AssignedGMUserID),status:str(a.Status),progress:number(a.Progress),risk:str(a.Risk||'green'),deadline:a.Deadline?date(a.Deadline):null,accepted_at:a.AcceptedAt?date(a.AcceptedAt):null,gm_comment:str(a.GMComment),party_roles_json:JSON.stringify(parse(a.PartyRolesJSON,{})),reward_xp:number(q.XPReward),reward_badge:nullable(q.BadgeReward),created_at:date(a.CreatedAt),updated_at:date(a.UpdatedAt)});
 for(const pair of members){const [partyId,profileId]=JSON.parse(pair);if(partyId===str(a.PartyID))insert('assignment_participants',{assignment_id:str(a.AssignmentID),profile_id:profileId});}
 }
 for(const d of rows('DailyProgress'))insert('daily_progress',{id:str(d.ProgressID),assignment_id:requireRef(assignments,d.AssignmentID,'assignment'),submitted_by:requireRef(users,d.SubmittedBy,'submitter'),progress_date:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(date(d.ProgressDate))),previous_turn:str(d.PreviousTurn),current_turn:str(d.CurrentTurn),obstacle:str(d.Obstacle),need_gm_support:str(d.NeedGMSupport),risk:str(d.Risk||'green'),progress_percent:number(d.ProgressPercent),gm_comment:str(d.GMComment),reviewed_by:null,reviewed_at:d.GMReviewedAt?date(d.GMReviewedAt):null,created_at:date(d.CreatedAt)});
 for(const e of rows('Evidence')){
 const url=str(e.URL);if(url){let parsed;try{parsed=new URL(url);}catch{throw Error('Invalid evidence URL');}if(parsed.protocol!=='https:'||parsed.username||parsed.password)throw Error('Unsafe evidence URL');}
 insert('evidence',{id:str(e.EvidenceID),assignment_id:requireRef(assignments,e.AssignmentID,'assignment'),submitted_by:requireRef(users,e.SubmittedBy,'submitter'),evidence_type:str(e.EvidenceType),title:str(e.Title),url,reflection_note:str(e.ReflectionNote),review_status:str(e.ReviewStatus||'waiting_review'),gm_feedback:str(e.GMFeedback),competency_result:str(e.CompetencyResult),reviewed_by:actor(e.ReviewedBy),submitted_at:date(e.SubmittedAt),reviewed_at:e.ReviewedAt?date(e.ReviewedAt):null});
 }
 for(const x of rows('XPLog'))insert('historical_xp',{id:str(x.XPLogID),profile_id:requireRef(users,x.UserID,'profile'),party_id:x.PartyID?requireRef(parties,x.PartyID,'party'):null,quest_id:x.QuestID?requireRef(quests,x.QuestID,'quest'):null,xp:number(x.XP),reason:nullable(x.Reason),approved_by:actor(x.ApprovedBy),created_at:date(x.CreatedAt)});
 for(const b of rows('Badges'))insert('historical_badges',{id:str(b.BadgeLogID),profile_id:requireRef(users,b.UserID,'profile'),party_id:b.PartyID?requireRef(parties,b.PartyID,'party'):null,quest_id:b.QuestID?requireRef(quests,b.QuestID,'quest'):null,badge_name:str(b.BadgeName),approved_by:actor(b.ApprovedBy),created_at:date(b.CreatedAt)});
 for(const a of rows('AcademicAssessment')){const u=users.get(requireRef(users,a.UserID,'student'));if(!u.PartyID)throw Error('Assessment needs explicit source party mapping');insert('assessments',{id:str(a.AssessmentID),profile_id:str(a.UserID),party_id:requireRef(parties,u.PartyID,'party'),rotation:nullable(a.Rotation),assessment_type:str(a.AssessmentType),score:number(a.Score),max_score:number(a.MaxScore),rubric_json:JSON.stringify(parse(a.RubricJSON,{})),feedback:str(a.Feedback),preceptor_profile_id:requireRef(users,a.PreceptorUserID,'assessor'),created_at:date(a.CreatedAt)});}
 for(const s of rows('Settings')){const key=str(s.Key);if(!key||/password|token|secret|credential|private.?key|api.?key/i.test(key)){warnings.push({setting:'excluded_sensitive_or_empty_key'});continue;}statements.push(`INSERT INTO settings(key,value_json,updated_at) VALUES(${quote(key)},${quote(JSON.stringify(s.Value??''))},${quote(date(s.UpdatedAt))}) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at;`);counts.settings=(counts.settings||0)+1;}
 for(const r of rows('AdventureRecapResponses')){
 const payload=parse(r['Raw JSON'],{});const response=normalizeRecap(payload.response||r.response||{});const uid=requireRef(users,r['User ID']||r.profileId,'recap profile');const responseId=str(r['Response ID']||r.id);if(!responseId)throw Error('Missing recap ID');insert('recap_responses',{id:responseId,profile_id:uid,idempotency_key:'legacy:'+responseId,answers_json:JSON.stringify(response),submitted_at:date(r['Client Timestamp']||payload.submittedAtClient||r['Submitted At (Bangkok)'])});
 }
 const preserved={
 Users:['UserID','DisplayName','University','Rotation','Role','CharacterClass','PartyID','Level','XP','Status','Active','CreatedAt','UpdatedAt'],
 Parties:['PartyID','PartyName','Rotation','GMUserID','MemberUserIDs','CurrentQuestID','PartyXP','Risk','Status','CreatedAt','UpdatedAt'],
 Quests:['QuestID','QuestName','QuestType','Chapter','Category','Objective','Competencies','RequiredEvidence','XPReward','BadgeReward','DefaultDeadlineDays','Status','CreatedBy','CreatedAt','UpdatedAt'],
 QuestAssignments:['AssignmentID','QuestID','PartyID','AssignedGMUserID','AcceptedAt','MemberConfirmations','PartyRolesJSON','Progress','Risk','Status','Deadline','GMComment','CreatedAt','UpdatedAt'],
 DailyProgress:['ProgressID','AssignmentID','PartyID','ProgressDate','PreviousTurn','CurrentTurn','Obstacle','NeedGMSupport','Risk','ProgressPercent','SubmittedBy','GMComment','GMReviewedAt','CreatedAt'],
 Evidence:['EvidenceID','AssignmentID','QuestID','PartyID','SubmittedBy','EvidenceType','Title','URL','ReflectionNote','ReviewStatus','GMFeedback','CompetencyResult','ReviewedBy','SubmittedAt','ReviewedAt'],
 XPLog:['XPLogID','UserID','PartyID','QuestID','XP','Reason','ApprovedBy','CreatedAt'],
 Badges:['BadgeLogID','UserID','PartyID','QuestID','BadgeName','EvidenceID','ApprovedBy','CreatedAt'],
 AcademicAssessment:['AssessmentID','UserID','Rotation','AssessmentType','Score','MaxScore','RubricJSON','Feedback','PreceptorUserID','CreatedAt','UpdatedAt']
 };
 for(const [name,columns]of Object.entries(preserved))for(const row of rows(name)){
  const data=Object.fromEntries(columns.filter(c=>row[c]!==undefined).map(c=>[c,row[c]]));
  insert('legacy_records',{source_table:name,source_id:str(row[columns[0]]),data_json:JSON.stringify(data)});
 }
 return{sql:'PRAGMA foreign_keys = ON;\n'+statements.join('\n')+'\n',report:{counts,warnings,identityEnrollment:'All imported profiles pending, no Firebase UIDs/passwords/tokens imported.'}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [input,output]=process.argv.slice(2);if(!input||!output)throw Error('Usage: node backend/scripts/import-legacy.mjs sanitized-export.json import.sql');
 const {sql,report}=convertLegacy(JSON.parse(readFileSync(input,'utf8')));writeFileSync(output,sql,{mode:0o600});writeFileSync(output+'.report.json',JSON.stringify(report,null,2),{mode:0o600});console.log(JSON.stringify({output,counts:report.counts,warnings:report.warnings.length}));
}
