// Pure demo-only combat engine. No official rewards or remote calls.
export const ACTIONS = Object.freeze([
 {id:'listen',name:'1 · ฟังเสียง (S)',hint:'รวบรวมข้อมูลและฟื้น Focus'},
 {id:'verify',name:'2 · ตรวจสอบ (O)',hint:'ใช้ 1 Focus เพื่อยืนยันข้อมูล'},
 {id:'assess',name:'3 · วิเคราะห์ (A)',hint:'ใช้ 1 Focus; ต้องผ่านโจทย์สถานการณ์'},
 {id:'plan',name:'4 · วางแผน (P)',hint:'ใช้ 2 Focus; ต้องมี A'},
 {id:'counsel',name:'5 · สื่อสาร',hint:'เติมกำลังใจหลังรับฟัง'},
 {id:'guard',name:'6 · ปรึกษา/ป้องกัน',hint:'เติม Focus, ลดความสับสน'},
 {id:'seal',name:'7 · ผนึก SOAP',hint:'ใช้เฉพาะ Final Boss หลังรวม S/O/A/P'}
]);
export function startBattle(chapter){
 if(!chapter || chapter.epilogue || !Number.isInteger(chapter.fog) || chapter.fog<=0)throw Error('invalid battle');
 return {id:chapter.id,playerHp:20,focus:4,foeHp:chapter.fog,foeMax:chapter.fog,
  seals:[],caseResolved:false,trust:0,turn:1,status:'active',log:['พบ '+chapter.foe+' — ฟังข้อมูลก่อนลงมือ']};
}
function log(s,message){s.log=[...s.log,message].slice(-7);return s;}
export function applyAction(previous,chapter,action){
 if(!previous || previous.id!==chapter?.id || previous.status!=='active')return previous;
 const s={...previous,seals:[...previous.seals],log:[...previous.log]};
 const owns=key=>s.seals.includes(key);
 if(action==='case-right'){
  if(s.caseResolved)return log(s,'ตรวจสอบสถานการณ์นี้แล้ว');
  s.caseResolved=true;s.focus=Math.min(6,s.focus+1);return log(s,'ตอบถูก: '+chapter.rationale+' (+1 Focus)');
 }
 if(action==='case-wrong'){
  s.playerHp=Math.max(0,s.playerHp-2);
  log(s,'ยังไม่ถูก: ตรวจสอบข้อมูลอีกครั้ง (-2 Morale)');
  if(s.playerHp===0)s.status='lost';
  return s;
 }
 let damage=0,shield=0,note='';
 switch(action){
  case 'listen':
   if(!owns('S'))s.seals.push('S');s.focus=Math.min(6,s.focus+1);
   note='รับฟังและเก็บข้อมูล Subjective';break;
  case 'verify':
   if(!owns('S'))return log(s,'ต้องรับฟังข้อมูล (S) ก่อน');
   if(s.focus<1)return log(s,'Focus ไม่พอ ใช้การ์ด/ปรึกษา');
   s.focus--;if(!owns('O'))s.seals.push('O');
   damage=2;note='ยืนยันข้อมูล Objective';break;
  case 'assess':
   if(!owns('O'))return log(s,'ต้องตรวจสอบข้อมูล (O) ก่อน');
   if(!s.caseResolved)return log(s,'ตอบโจทย์สถานการณ์ให้ถูกก่อนวิเคราะห์');
   if(s.focus<1)return log(s,'Focus ไม่พอ ใช้การ์ด/ปรึกษา');
   s.focus--;if(!owns('A'))s.seals.push('A');
   damage=3;note='วิเคราะห์ข้อมูลอย่างมีเหตุผล';break;
  case 'plan':
   if(!owns('A'))return log(s,'ต้องวิเคราะห์ (A) ก่อนวางแผน');
   if(s.focus<2)return log(s,'Focus ไม่พอ ใช้การ์ด/ปรึกษา');
   s.focus-=2;if(!owns('P'))s.seals.push('P');
   damage=5;note='วางแผนและติดตามอย่างปลอดภัย';break;
  case 'counsel':
   if(!owns('S'))return log(s,'รับฟังก่อนสื่อสาร');
   if(s.focus<1)return log(s,'Focus ไม่พอ');
   s.focus--;s.trust++;s.playerHp=Math.min(20,s.playerHp+2);damage=1;
   note='สื่อสารชัดเจน และตรวจความเข้าใจ';break;
  case 'guard':
   s.focus=Math.min(6,s.focus+2);shield=2;
   note='หยุดเพื่อปรึกษาพี่เลี้ยงและป้องกันความผิดพลาด';break;
  case 'seal':
   if(!chapter.boss)return log(s,'ท่านี้ใช้ใน Final Boss เท่านั้น');
   if(!['S','O','A','P'].every(owns))return log(s,'ต้องรวมผนึก S/O/A/P ให้ครบ');
   if(s.focus<2)return log(s,'Focus ไม่พอ');
   s.focus-=2;damage=12;note='FOUR SEALS — เรียบเรียงข้อมูลครบวงจร!';break;
  default:return log(s,'ไม่รู้จักคำสั่ง');
 }
 if(damage)s.foeHp=Math.max(0,s.foeHp-damage);
 log(s,note+(damage?' (ลดหมอก '+damage+')':''));
 if(s.foeHp===0 && ['S','O','A','P'].every(owns)){
   s.status='won';return log(s,'หมอกสลาย! ชนะการฝึกจำลอง (ไม่มี XP/Gold จริง)');
 }
 if(s.foeHp===0){s.foeHp=1;log(s,'หมอกยังคงอยู่: ต้องรวบรวมผนึกครบ S/O/A/P');}
 const impact=Math.max(0,chapter.danger-shield);
 s.playerHp=Math.max(0,s.playerHp-impact);
 if(impact)log(s,chapter.foe+' ทำให้ทีมสับสน (-'+impact+' Morale)');
 s.turn++;
 if(s.playerHp===0){s.status='lost';log(s,'พลังใจหมด: กลับค่ายและทดลองใหม่ได้');}
 return s;
}
