import {characterFor} from './characters.mjs';
import {normalizeRecap,recapOptions} from '../../frontend/recap-model.mjs';
const all=async(db,sql,...args)=>(await db.prepare(sql).bind(...args).all()).results;
const first=async(db,sql,...args)=>db.prepare(sql).bind(...args).first();
const page=rows=>({items:rows.slice(0,100),hasMore:rows.length>100});
export async function characterJourney(db,p){
 const character=await characterFor(db,p.id);
 const xp=(await first(db,'SELECT COALESCE((SELECT SUM(xp) FROM xp_awards WHERE profile_id=?),0)+COALESCE((SELECT SUM(xp) FROM historical_xp WHERE profile_id=?),0) total',p.id,p.id)).total;
 const badges=await all(db,'SELECT badge_name,COUNT(*) award_count,MIN(created_at) first_awarded,MAX(created_at) last_awarded FROM (SELECT badge_name,created_at FROM badge_awards WHERE profile_id=? UNION ALL SELECT badge_name,created_at FROM historical_badges WHERE profile_id=?) GROUP BY badge_name ORDER BY last_awarded DESC,badge_name LIMIT 101',p.id,p.id);
 const badgeStats=await first(db,'SELECT COUNT(*) awards,COUNT(DISTINCT badge_name) unique_badges FROM (SELECT badge_name FROM badge_awards WHERE profile_id=? UNION ALL SELECT badge_name FROM historical_badges WHERE profile_id=?)',p.id,p.id);
 const assessmentStats=await first(db,'SELECT COUNT(*) count,COALESCE(SUM(score),0) score,COALESCE(SUM(max_score),0) max_score FROM assessments WHERE profile_id=?',p.id);
 const assessments=await all(db,'SELECT a.id,a.assessment_type,a.score,a.max_score,a.feedback,a.created_at,u.display_name assessor_name FROM assessments a JOIN profiles u ON u.id=a.preceptor_profile_id WHERE a.profile_id=? ORDER BY a.created_at DESC,a.id LIMIT 101',p.id);
 const recapStats=await first(db,'SELECT COUNT(*) count FROM recap_responses WHERE profile_id=?',p.id);
 const rows=await all(db,'SELECT id,answers_json,submitted_at FROM recap_responses WHERE profile_id=? ORDER BY submitted_at DESC,id DESC LIMIT 101',p.id);
 const reflections=rows.map(row=>{let recap;try{recap=normalizeRecap(JSON.parse(row.answers_json));}catch{return{id:row.id,submittedAt:row.submitted_at,score:null,legacy:true};}return{id:row.id,submittedAt:row.submitted_at,score:recap.results.questScore,rank:recap.results.rank,title:recap.results.endingTitle,experienceScore:recap.answers.treasure.overallScore,skills:recap.answers.skill.unlockedSkills,characterKey:recap.profile.character};});
 const completed=await all(db,"SELECT DISTINCT a.quest_id FROM xp_awards x JOIN assignments a ON a.id=x.assignment_id WHERE x.profile_id=? AND a.status='completed' UNION SELECT DISTINCT quest_id FROM historical_xp WHERE profile_id=? AND quest_id IS NOT NULL",p.id,p.id);const keys=new Set(completed.map(x=>x.quest_id));
 const missionStats=await first(db,"SELECT (SELECT COUNT(DISTINCT x.assignment_id) FROM xp_awards x JOIN assignments a ON a.id=x.assignment_id WHERE x.profile_id=? AND a.status='completed') completed, (SELECT COUNT(*) FROM historical_xp WHERE profile_id=?) historical_awards",p.id,p.id);
 const achievements=[];const add=(key,title,description,category='quest')=>achievements.push({key,title,description,category});
 if(character)add('guild-adventurer','Guild Adventurer','สร้างตัวละครและพร้อมเริ่มการผจญภัย','character');
 for(const [key,title]of [['main-week-01','Training Ground Graduate'],['main-week-02','Outpost Explorer'],['main-week-03','Portal Pathfinder'],['main-week-04','Sanctuary Practitioner'],['boss-mini-projects','Forgekeeper Victor'],['boss-mini-academic','Knowledge Keeper Victor'],['boss-soap-presentation','Sovereign Slayer'],['main-week-05','Guild Homecoming']])if(keys.has(key))add(key,title,'ผ่านเควสต์และได้รับรางวัลที่บันทึกแล้ว');
 if(keys.has('side-project-department')&&keys.has('side-project-clinical'))add('two-projects','Double Project Artisan','ผ่านโครงงานประจำผลัดทั้งสองชิ้น');
 for(const [threshold,title]of [[150,'Rising Adventurer'],[450,'Seasoned Adventurer'],[900,'Guild Veteran']])if(xp>=threshold)add('xp-'+threshold,title,'สะสม '+threshold+' XP','xp');
 if(recapStats.count)add('reflection','Journey Chronicler','ส่งบันทึกสะท้อนการเรียนรู้แล้ว','reflection');
 const latest=reflections[0]||null;const skills=(latest?.skills||[]).filter(skill=>recapOptions.skills.includes(skill));
 return{character,xp,level:Math.floor(xp/150)+1,nextLevelXp:(Math.floor(xp/150)+1)*150,xpWithinLevel:xp%150,badges:page(badges),badgeStats,achievements,missionStats,assessmentStats:{...assessmentStats,percentage:assessmentStats.max_score?Math.round(1000*assessmentStats.score/assessmentStats.max_score)/10:null},assessments:page(assessments),reflectionStats:{count:recapStats.count,latest},reflections:page(reflections),selfReportedSkills:skills};
}
