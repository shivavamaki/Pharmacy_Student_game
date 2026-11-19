import Phaser from 'phaser';
import { TILE_SIZE,WORLD_HEIGHT,WORLD_WIDTH,PLAYER_START,GUILD_MASTER,TRAINING_PORTAL,tileAt,nextTile,canInteract } from './world.mjs';
import { createHeroTextures, type Direction } from './sprite';

export const WORLD_SIZE = {width: WORLD_WIDTH*TILE_SIZE,height: WORLD_HEIGHT*TILE_SIZE};

function environmentTextures(scene:Phaser.Scene){
 const graphics=scene.add.graphics();
 function texture(key:string,background:number,dots:number){
  graphics.clear();
  graphics.fillStyle(background);
  graphics.fillRect(0,0,TILE_SIZE,TILE_SIZE);
  graphics.fillStyle(dots);
  graphics.fillRect(2,2,2,2);graphics.fillRect(11,10,2,2);
  graphics.generateTexture('tile-'+key,TILE_SIZE,TILE_SIZE);
 }
 texture('grass',0x386b57,0x4d8467);
 texture('flower',0x386b57,0xf1d584);
 texture('path',0xb5a98f,0x8d8c7c);
 texture('wall',0x42556b,0x63778e);
 texture('roof',0x895c61,0xb8796c);
 texture('water',0x2d698d,0x64b6c1);
 graphics.clear();graphics.fillStyle(0x4e3d83);graphics.fillRect(3,1,10,14);
 graphics.fillStyle(0xb0e3f0);graphics.fillRect(6,4,4,8);
 graphics.fillStyle(0xf2df8e);graphics.fillRect(7,2,2,2);
 graphics.generateTexture('portal',16,16);
 graphics.destroy();
}
export class BootScene extends Phaser.Scene {
 constructor(){super({key:'Boot'});}
 create(){
  environmentTextures(this);
  createHeroTextures(this);
  this.scene.start('Guild');
 }
}
export class GuildScene extends Phaser.Scene {
 private pos={...PLAYER_START};
 private hero!:Phaser.GameObjects.Sprite;
 private direction:Direction='down';
 private walking=false;
 private gameMode='explore';
 private keyListener=(event:KeyboardEvent)=>{
   if(this.game.registry.get('mode')!=='explore')return;
   if(event.target instanceof HTMLElement && ['INPUT','SELECT','TEXTAREA','BUTTON'].includes(event.target.tagName))return;
   const k=event.key.toLowerCase();
   if(['arrowup','w','arrowleft','a','arrowdown','s','arrowright','d','e','enter',' '].includes(k))event.preventDefault();
   const dirs:Record<string,[number,number]>={arrowup:[0,-1],w:[0,-1],arrowdown:[0,1],s:[0,1],arrowleft:[-1,0],a:[-1,0],arrowright:[1,0],d:[1,0]};
   if(dirs[k])this.walk(...dirs[k]);
   else if(k==='e'||k==='enter'||k===' ')this.interact();
 };
 private onMove=(dx:number,dy:number)=>{if(this.game.registry.get('mode')==='explore')this.walk(dx,dy);};
 private onInteract=()=>{if(this.game.registry.get('mode')==='explore')this.interact();};
 constructor(){super({key:'Guild'});}
 create(){
  this.pos={...PLAYER_START};
  this.game.registry.set('mode','explore');
  this.cameras.main.setBounds(0,0,WORLD_SIZE.width,WORLD_SIZE.height);
  this.cameras.main.setBackgroundColor('#172d3b');
  for(let y=0;y<WORLD_HEIGHT;y++)for(let x=0;x<WORLD_WIDTH;x++){
    const key=tileAt(x,y);
    this.add.image(x*TILE_SIZE+TILE_SIZE/2,y*TILE_SIZE+TILE_SIZE/2,'tile-'+key).setDepth(0);
  }
  this.add.text(80,40,'GUILD HALL',{fontFamily:'monospace',fontSize:'9px',color:'#ffedb0',backgroundColor:'#16223b'}).setOrigin(0.5).setDepth(1);
  this.add.text(170,40,'TRAINING GROUNDS',{fontFamily:'monospace',fontSize:'8px',color:'#ffedb0',backgroundColor:'#16223b'}).setOrigin(0.5).setDepth(1);
  this.add.sprite(GUILD_MASTER.x*TILE_SIZE+8,GUILD_MASTER.y*TILE_SIZE+8,'guild-master').setDepth(3);
  this.add.text(GUILD_MASTER.x*TILE_SIZE+8,GUILD_MASTER.y*TILE_SIZE-12,'✦',{fontSize:'14px',color:'#ffe69b'}).setOrigin(0.5).setDepth(3);
  this.add.image(TRAINING_PORTAL.x*TILE_SIZE+8,TRAINING_PORTAL.y*TILE_SIZE+8,'portal').setDepth(2);
  this.add.text(TRAINING_PORTAL.x*TILE_SIZE+8,TRAINING_PORTAL.y*TILE_SIZE-10,'⚔',{fontSize:'12px',color:'#ffedb0'}).setOrigin(0.5).setDepth(3);
  this.hero=this.add.sprite(this.pos.x*TILE_SIZE+8,this.pos.y*TILE_SIZE+8,'hero-down-0').setDepth(4);
  this.cameras.main.startFollow(this.hero,false,0.18,0.18);
  this.cameras.main.setRoundPixels(true);
  this.input.keyboard?.on('keydown',this.keyListener);
  this.game.events.on('guild:move',this.onMove);
  this.game.events.on('guild:interact',this.onInteract);
  this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{
    this.input.keyboard?.off('keydown',this.keyListener);
    this.game.events.off('guild:move',this.onMove);
    this.game.events.off('guild:interact',this.onInteract);
  });
  this.announce();
  const won=!!this.game.registry.get('trainingWon');
  this.game.events.emit('guild:status',won?'Training simulation complete · no official XP/Gold awarded':'Explore the Guild: talk to the Guild Master ✦');
 }
 private announce(){
  this.game.events.emit('guild:position',this.pos.x,this.pos.y);
 }
 private walk(dx:number,dy:number){
  if(this.walking||this.game.registry.get('mode')!=='explore')return;
  if(Math.abs(dx)+Math.abs(dy)!==1)return;
  this.direction=dx<0?'left':dx>0?'right':dy<0?'up':'down';
  const target=nextTile(this.pos,dx,dy);
  if(target===this.pos){this.hero.setTexture('hero-'+this.direction+'-0');return;}
  this.pos=target;this.walking=true;
  this.hero.play('hero-walk-'+this.direction,true);
  this.tweens.add({targets:this.hero,x:target.x*TILE_SIZE+8,y:target.y*TILE_SIZE+8,duration:135,ease:'Linear',
   onComplete:()=>{this.hero.stop();this.hero.setTexture('hero-'+this.direction+'-0');this.walking=false;this.announce();}});
 }
 private interact(){
  if(this.walking)return;
  if(canInteract(this.pos,GUILD_MASTER)){
    this.game.registry.set('mode','dialogue');
    this.game.events.emit('guild:dialogue','ยินดีต้อนรับ ผู้ฝึกเภสัชกร! เจ้าจงฟัง ตรวจสอบ วิเคราะห์ และวางแผน หากไม่แน่ใจ จงปรึกษาผู้ควบคุมการฝึก ก่อนลองเผชิญหน้าหมอกแห่งความสับสน');
  }else if(canInteract(this.pos,TRAINING_PORTAL)){
    this.scene.start('Encounter');
  }else{
    this.game.events.emit('guild:status','Approach Guild Master ✦ or the violet training portal ⚔, then press E / Explore');
  }
 }
}
export class EncounterScene extends Phaser.Scene{
 constructor(){super({key:'Encounter'});}
 create(){
  this.game.registry.set('mode','battle');
  this.cameras.main.setBackgroundColor('#0e142b');
  const g=this.add.graphics();
  g.fillStyle(0x233654);g.fillRect(0,0,352,240);
  g.fillStyle(0x372755);g.fillEllipse(180,134,120,130);
  g.fillStyle(0x9472c3);g.fillEllipse(179,124,80,94);
  g.fillStyle(0xe9d1a2);g.fillRect(166,110,9,6);g.fillRect(189,110,9,6);
  g.fillStyle(0x172340);g.fillRect(172,142,22,7);
  this.add.text(176,34,'WHISPERING DOUBT',{fontFamily:'monospace',fontSize:'14px',color:'#ffe5a2'}).setOrigin(0.5);
  this.add.text(176,209,'TRAINING ENCOUNTER • FICTION ONLY',{fontFamily:'monospace',fontSize:'10px',color:'#cfdae6'}).setOrigin(0.5);
  this.game.events.emit('guild:encounter');
 }
}
