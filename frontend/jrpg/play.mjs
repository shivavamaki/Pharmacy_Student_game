import {chapters,jobs} from './data.mjs';
import {ACTIONS,startBattle,applyAction} from './engine.mjs';
const $=id=>document.getElementById(id);
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
const state={chapter:0,unlocked:0,cleared:new Set(),battle:null,job:jobs[0].id,ending:false,endingMessage:''};
for(const item of jobs){const o=el('option',item.id+' — '+item.thai);o.value=item.id;$('job').add(o);}
$('job').addEventListener('change',()=>{state.job=$('job').value;render();});
function selectChapter(i){
 if(i<0||i>state.unlocked||i>=chapters.length)return;
 state.chapter=i;state.battle=null;state.ending=false;state.endingMessage='';render();
}
function complete(){state.cleared.add(state.chapter);state.unlocked=Math.min(chapters.length-1,Math.max(state.unlocked,state.chapter+1));}
function btn(text,cls,handler){const b=el('button',text,cls);b.type='button';b.addEventListener('click',handler);return b;}
function renderNav(){
 const nav=$('chapters');nav.replaceChildren();
 chapters.forEach((c,i)=>{
  const locked=i>state.unlocked;
  const b=btn(locked?'🔒 ???':(state.cleared.has(i)?'✓ ':'► ')+c.name,'chapter'+(state.cleared.has(i)?' done':''),()=>selectChapter(i));
  b.disabled=locked;
  if(i===state.chapter)b.setAttribute('aria-current','step');
  b.append(el('small','WEEK '+c.week+' · '+(locked?'SEALED':c.subtitle)));
  nav.append(b);
 });
}
function meter(label,value,max,cls){
 const box=el('div'),head=el('div',undefined,'meter-label'),track=el('div',undefined,'meter '+(cls||'')),fill=el('span');
 head.append(el('span',label),el('strong',value+' / '+max));
 fill.style.width=(100*Math.max(0,Math.min(max,value))/max)+'%';
 track.append(fill);box.append(head,track);return box;
}
function move(action){
 const chapter=chapters[state.chapter];
 if(state.battle?.status!=='active')return;
 state.battle=applyAction(state.battle,chapter,action);
 if(state.battle.status==='won')complete();
 render();
}
function answer(i){
 const ch=chapters[state.chapter],correct=i===ch.correct;
 if(ch.epilogue){if(correct){state.ending=true;state.endingMessage=ch.rationale;complete();}else state.endingMessage='ลองทบทวนข้อเสนอแนะและตอบอีกครั้ง';}
 else if(state.battle?.status==='active')state.battle=applyAction(state.battle,ch,correct?'case-right':'case-wrong');
 render();
}
function renderCase(ch){
 const box=$('case');box.replaceChildren();
 if(ch.epilogue&&state.ending){
  const fin=el('div',undefined,'finished');fin.append(el('h3','✦ THE END'),el('p',state.endingMessage+' · จบเกมทดลอง ไม่มีบันทึกคะแนนจริง'));
  box.append(fin);return;
 }
 if(!ch.epilogue&&(!state.battle||state.battle.status!=='active'||!state.battle.seals.includes('O')||state.battle.caseResolved))return;
 const card=el('div',undefined,'question');card.append(el('h3','CASE DECISION · โจทย์ประจำบท'),el('p',ch.casePrompt));
 const list=el('div',undefined,'choices');
 ch.choices.forEach((choice,i)=>list.append(btn(String.fromCharCode(65+i)+'. '+choice,'choice',()=>answer(i))));
 card.append(list);
 if(ch.epilogue&&state.endingMessage)card.append(el('p',state.endingMessage));
 box.append(card);
}
function renderBattle(ch){
 const root=$('battle');root.replaceChildren();
 $('phase').textContent=ch.epilogue?'EPILOGUE':state.battle?.status.toUpperCase()||'READY';
 const wrap=el('div',undefined,'battle-inner');
 if(ch.epilogue){wrap.append(el('p','ทบทวนการเรียนรู้ในบทส่งท้าย จากนั้นตอบคำถามด้านล่าง'));root.append(wrap);return;}
 if(!state.battle){
  wrap.append(el('p',ch.foe+' · หมอกแห่งปัญหา '+ch.fog+' · '+ch.lesson));
  wrap.append(btn('▶ เริ่มการต่อสู้แบบเทิร์นเบส','primary',()=>{state.battle=startBattle(ch);render();}));
  root.append(wrap);return;
 }
 const s=state.battle;
 const title=el('div',undefined,'enemy');
 title.append(el('span','⚔ '+ch.foe),el('span','TURN '+s.turn));wrap.append(title);
 const stats=el('div',undefined,'meters');
 stats.append(meter('MORALE (HP)',s.playerHp,20),meter('FOG',s.foeHp,s.foeMax,'fog'),meter('FOCUS (MP)',s.focus,6,'focus'));
 stats.append(el('p','JOB: '+state.job+' · TRUST '+s.trust));
 wrap.append(stats);
 const seals=el('div',undefined,'seals');seals.append(el('strong','SEALS:'));
 for(const seal of ['S','O','A','P'])seals.append(el('span',seal,'seal'+(s.seals.includes(seal)?' on':'')));
 wrap.append(seals);
 if(s.status==='active'){
  const actions=el('div',undefined,'actions');
  ACTIONS.forEach(a=>{const b=btn(a.name,'action'+(a.id==='seal'?' special':''),()=>move(a.id));b.append(el('small',a.hint));b.disabled=a.id==='seal'&&!ch.boss;actions.append(b);});
  wrap.append(actions);
 }else{
  const end=el('div',undefined,'finished');
  end.append(el('h3',s.status==='won'?'✦ VICTORY — หมอกคลี่คลาย':'GAME OVER — พักที่ค่าย'),el('p',s.status==='won'?'สำเร็จในเกมทดลอง! ภารกิจจริงยังต้องตรวจหลักฐานโดย GM':'ลองใหม่ได้เสมอ ไม่เสียรางวัลจริง'));
  end.append(btn('↺ ลองบทนี้ใหม่','primary',()=>{state.battle=startBattle(ch);render();}));
  if(s.status==='won'&&state.chapter<chapters.length-1)end.append(btn('→ บทถัดไป','primary',()=>selectChapter(state.chapter+1)));
  wrap.append(end);
 }
 root.append(wrap);
}
function render(){
 const ch=chapters[state.chapter];
 $('chapter-index').textContent='CHAPTER '+String(state.chapter+1).padStart(2,'0');
 $('week').textContent='WEEK '+ch.week;
 $('scene-art').src='/assets/campaign/'+ch.image;
 $('scene-art').alt=ch.name+' — original pixel art';
 $('scene-label').textContent=ch.subtitle;
 $('speaker').textContent=ch.boss?'THE FOUR SEALS':ch.epilogue?'THE GUILD MASTER':'YOUR GUILD GUIDE';
 $('chapter-name').textContent=ch.name;$('story').textContent=ch.intro;
 $('curriculum').textContent='TRAINING: '+ch.lesson+' · '+ch.questId;
 renderNav();renderBattle(ch);renderCase(ch);
 const log=$('log');log.replaceChildren();
 for(const line of state.battle?.log||['สำรวจฉาก แล้วกดเริ่มการต่อสู้ หรือเลือกบทที่ปลดล็อกแล้ว'])log.append(el('li',line));
}
document.addEventListener('keydown',event=>{
 if(event.ctrlKey||event.metaKey||event.altKey||event.repeat)return;
 if(['INPUT','BUTTON','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;
 const i=Number(event.key)-1;
 if(i>=0&&i<ACTIONS.length&&state.battle?.status==='active'){event.preventDefault();move(ACTIONS[i].id);}
});
render();
