import Phaser from 'phaser';
import './style.css';
import {BootScene,GuildScene,EncounterScene} from './scenes';
import {chapters} from '../../frontend/jrpg/data.mjs';
import {startBattle,applyAction,ACTIONS} from '../../frontend/jrpg/engine.mjs';

type ActiveBattle=Omit<ReturnType<typeof startBattle>,'seals'> & {seals:string[]};
const $=(id:string)=>{const element=document.getElementById(id);if(!element)throw new Error('Missing UI: '+id);return element;};
const make=(tag:string,text:string,cls?:string)=>{const element=document.createElement(tag);element.textContent=text;if(cls)element.className=cls;return element;};
const training=chapters.find(ch=>ch.id==='training')!;
if(!training)throw new Error('Training chapter missing');
let battle:ActiveBattle|null=null;
const dialogue=$('dialogue'),battleWindow=$('battle-overlay');
function closeDialogue(){
 dialogue.hidden=true;game.registry.set('mode','explore');$('interact').focus();
}
function beginEncounter(){
 dialogue.hidden=true;game.scene.start('Encounter');
}
function actionButton(label:string,onClick:()=>void,cls=''){
 const b=document.createElement('button');b.type='button';b.textContent=label;
 if(cls)b.className=cls;b.addEventListener('click',onClick);return b;
}
function action(actionId:string){
 if(!battle||battle.status!=='active')return;
 battle=applyAction(battle as unknown as ReturnType<typeof startBattle>,training,actionId) as ActiveBattle;
 if(battle?.status==='won'){
  game.registry.set('trainingWon',true);
  $('journal').textContent='✦ ฝึกจำลองสำเร็จ · โปรดให้ GM ตรวจภารกิจจริงแยกต่างหาก';
 }
 renderBattle();
}
function stat(label:string,value:number,max:number){
 const e=make('div','','stat'),text=make('div',label+': '+value+' / '+max,'stat-label');
 const bar=make('div','','progress');const fill=make('span','');
 fill.style.width=(Math.min(100,Math.max(0,value/max*100)))+'%';
 bar.append(fill);e.append(text,bar);return e;
}
function renderBattle(){
 const stats=$('battle-stats'),seals=$('battle-seals'),quiz=$('battle-case'),actions=$('battle-actions'),log=$('battle-log');
 for(const root of [stats,seals,quiz,actions,log])root.replaceChildren();
 const back=$('battle-return');back.hidden=true;
 if(!battle)return;
 stats.append(stat('MORALE',battle.playerHp,20),stat('FOG',battle.foeHp,battle.foeMax),stat('FOCUS',battle.focus,6));
 for(const mark of ['S','O','A','P'])seals.append(make('span',mark,'seal'+(battle.seals.includes(mark)?' collected':'')));
 if(battle.status==='active'){
  if(battle.seals.includes('O')&&!battle.caseResolved){
   quiz.append(make('h3','CASE DECISION · โจทย์สถานการณ์จำลอง'));
   quiz.append(make('p',training.casePrompt));
   training.choices.forEach((choice:string,index:number)=>{
     quiz.append(actionButton(String.fromCharCode(65+index)+'. '+choice,()=>action(index===training.correct?'case-right':'case-wrong'),'answer'));
   });
  }
  for(const cmd of ACTIONS){
   const control=actionButton(cmd.name,()=>action(cmd.id));
   control.title=cmd.hint;if(cmd.id==='seal')control.disabled=true;
   actions.append(control);
  }
 }else{
  quiz.append(make('h3',battle.status==='won'?'VICTORY! Training complete':'GAME OVER · Try again'));
  quiz.append(make('p',battle.status==='won'?'Demo cleared, no real XP, grades or Gold.':'No progress lost. Return to the Guild and retry.'));
  back.hidden=false;back.textContent=battle.status==='won'?'↵ กลับกิลด์ (Demo cleared)':'↵ กลับกิลด์ (Try again)';
 }
 for(const message of battle.log.slice(-7))log.append(make('li',message));
}
function openBattle(){
 battle=startBattle(training);
 battleWindow.hidden=false;
 renderBattle();
 (document.querySelector<HTMLButtonElement>('#battle-actions button')||$('battle-return')).focus();
}
const game=new Phaser.Game({
 type:Phaser.AUTO,parent:'game',width:352,height:240,
 backgroundColor:'#192c39',pixelArt:true,roundPixels:true,
 scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH,width:352,height:240},
 scene:[BootScene,GuildScene,EncounterScene],
 render:{antialias:false,pixelArt:true}
});
game.events.on('guild:status',(message:string)=>{$('status').textContent=message;});
game.events.on('guild:position',(x:number,y:number)=>{$('coords').textContent='X:'+x+' Y:'+y;});
game.events.on('guild:dialogue',(copy:string)=>{
 $('dialogue-text').textContent=copy;
 dialogue.hidden=false;$('dialogue-battle').focus();
});
game.events.on('guild:encounter',openBattle);
$('interact').addEventListener('click',()=>game.events.emit('guild:interact'));
$('dialogue-close').addEventListener('click',closeDialogue);
$('dialogue-battle').addEventListener('click',beginEncounter);
$('battle-return').addEventListener('click',()=>{
 battleWindow.hidden=true;battle=null;game.scene.start('Guild');$('interact').focus();
});
document.addEventListener('keydown',event=>{
 if(event.key!=='Escape')return;
 if(!dialogue.hidden){event.preventDefault();closeDialogue();}
 else if(!battleWindow.hidden){
  event.preventDefault();battleWindow.hidden=true;battle=null;game.scene.start('Guild');$('interact').focus();
 }
});
for(const [id,dx,dy] of [['move-up',0,-1],['move-down',0,1],['move-left',-1,0],['move-right',1,0]] as const){
 const element=$(id);
 let interval:number|undefined;
 const move=()=>game.events.emit('guild:move',dx,dy);
 const stop=()=>{if(interval!==undefined){window.clearInterval(interval);interval=undefined;}};
 element.addEventListener('pointerdown',event=>{
  event.preventDefault();stop();move();interval=window.setInterval(move,190);
 });
 for(const name of ['pointerup','pointercancel','pointerleave','lostpointercapture'])element.addEventListener(name,stop);
 element.addEventListener('click',event=>{if((event as PointerEvent).detail===0)move();});
 window.addEventListener('blur',stop);
}
