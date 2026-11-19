import Phaser from 'phaser';
import { TILE_SIZE,WORLD_HEIGHT,WORLD_WIDTH,PLAYER_START,GUILD_MASTER,TRAINING_PORTAL,tileAt,routeToDestination,canInteract } from './world.mjs';
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
type Tile={x:number;y:number};
type TravelPlan={path:Tile[];target:Tile;destination:Tile;interaction:'guild-master'|'training-portal'|null};

export class GuildScene extends Phaser.Scene {
 private pos:Tile={...PLAYER_START};
 private hero!:Phaser.GameObjects.Sprite;
 private followers:Phaser.GameObjects.Sprite[]=[];
 private routeHistory:Tile[]=[];
 private direction:Direction='down';
 private walking=false;
 private pendingDestination:Tile|null=null;
 private plan:TravelPlan|null=null;
 private path:Tile[]=[];
 private travelMarks!:Phaser.GameObjects.Graphics;

 // Movement is intentionally destination-based: no directional stepping controls.
 private onMapPointer=(pointer:Phaser.Input.Pointer)=>{
  if(this.game.registry.get('mode')!=='explore')return;
  const point=this.cameras.main.getWorldPoint(pointer.x,pointer.y);
  this.chooseDestination(Math.floor(point.x/TILE_SIZE),Math.floor(point.y/TILE_SIZE));
 };
 private onChooseDestination=(x:number,y:number)=>this.chooseDestination(x,y);
 private onInteract=()=>{if(this.game.registry.get('mode')==='explore')this.interact();};
 private onKeyboard=(event:KeyboardEvent)=>{
  if(this.game.registry.get('mode')!=='explore')return;
  if(event.target instanceof HTMLElement&&['INPUT','SELECT','TEXTAREA','BUTTON'].includes(event.target.tagName))return;
  if(['e','enter',' '].includes(event.key.toLowerCase())){
    event.preventDefault();this.interact();
  }
 };
 constructor(){super({key:'Guild'});}
 create(){
  this.pos={...PLAYER_START};this.pendingDestination=null;this.plan=null;this.path=[];this.walking=false;
  this.followers=[];this.routeHistory=[{...PLAYER_START}];
  this.game.registry.set('mode','explore');
  this.cameras.main.setBounds(0,0,WORLD_SIZE.width,WORLD_SIZE.height);
  this.cameras.main.setBackgroundColor('#172d3b');
  for(let y=0;y<WORLD_HEIGHT;y++)for(let x=0;x<WORLD_WIDTH;x++){
   this.add.image(x*TILE_SIZE+8,y*TILE_SIZE+8,'tile-'+tileAt(x,y)).setDepth(0);
  }
  this.add.text(80,40,'GUILD HALL',{fontFamily:'monospace',fontSize:'9px',color:'#ffedb0',backgroundColor:'#16223b'}).setOrigin(0.5).setDepth(1);
  this.add.text(170,40,'TRAINING GROUNDS',{fontFamily:'monospace',fontSize:'8px',color:'#ffedb0',backgroundColor:'#16223b'}).setOrigin(0.5).setDepth(1);
  this.travelMarks=this.add.graphics().setDepth(2);
  this.add.sprite(GUILD_MASTER.x*TILE_SIZE+8,GUILD_MASTER.y*TILE_SIZE+8,'guild-master').setDepth(3);
  this.add.text(GUILD_MASTER.x*TILE_SIZE+8,GUILD_MASTER.y*TILE_SIZE-12,'✦',{fontSize:'14px',color:'#ffe69b'}).setOrigin(0.5).setDepth(3);
  this.add.image(TRAINING_PORTAL.x*TILE_SIZE+8,TRAINING_PORTAL.y*TILE_SIZE+8,'portal').setDepth(3);
  this.add.text(TRAINING_PORTAL.x*TILE_SIZE+8,TRAINING_PORTAL.y*TILE_SIZE-10,'⚔',{fontSize:'12px',color:'#ffedb0'}).setOrigin(0.5).setDepth(3);
  // Formation preview: one leader and five NPC stand-ins. NOT six connected users.
  // In online mode the Durable Object will publish one authoritative party path.
  const followerColors=[0x99cbff,0xf5b5ab,0xc6a9fa,0xa7e4a0,0xf7df8e];
  this.followers=followerColors.map((tint,i)=>
    this.add.sprite(this.pos.x*TILE_SIZE+8+(i%3-1)*2,
      this.pos.y*TILE_SIZE+8+Math.floor(i/3)*2,'hero-down-0')
      .setTint(tint).setAlpha(0.86).setDepth(3+i*0.02));
  this.hero=this.add.sprite(this.pos.x*TILE_SIZE+8,this.pos.y*TILE_SIZE+8,'hero-down-0').setDepth(4);
  this.add.text(8,8,'PARTY LEADER • 5 DEMO FOLLOWERS',{
    fontFamily:'monospace',fontSize:'9px',color:'#fff0b1',backgroundColor:'#172e42'
  }).setScrollFactor(0).setDepth(7);
  this.cameras.main.startFollow(this.hero,false,0.18,0.18);
  this.cameras.main.setRoundPixels(true);

  this.input.on('pointerdown',this.onMapPointer);
  this.input.keyboard?.on('keydown',this.onKeyboard);
  this.game.events.on('guild:select-destination',this.onChooseDestination);
  this.game.events.on('guild:interact',this.onInteract);
  this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{
    this.input.off('pointerdown',this.onMapPointer);
    this.input.keyboard?.off('keydown',this.onKeyboard);
    this.game.events.off('guild:select-destination',this.onChooseDestination);
    this.game.events.off('guild:interact',this.onInteract);
  });
  this.announce();
  const won=!!this.game.registry.get('trainingWon');
  this.game.events.emit('guild:status',won?'Training simulation complete · no official XP/Gold awarded':'Demo leader controls the whole party — tap a map destination ✦');
 }
 private announce(){this.game.events.emit('guild:position',this.pos.x,this.pos.y);}
 private drawTravelPlan(plan:TravelPlan){
  this.travelMarks.clear();
  this.travelMarks.fillStyle(0xf5dea2,0.55);
  for(const step of plan.path)this.travelMarks.fillCircle(step.x*TILE_SIZE+8,step.y*TILE_SIZE+8,2);
  this.travelMarks.lineStyle(2,0xffe48e,1);
  this.travelMarks.strokeCircle(plan.target.x*TILE_SIZE+8,plan.target.y*TILE_SIZE+8,6);
 }
 private chooseDestination(x:number,y:number){
  if(this.game.registry.get('mode')!=='explore')return;
  const destination={x,y};
  const route=routeToDestination(this.pos,destination) as TravelPlan|null;
  if(!route){
   this.game.events.emit('guild:status','Destination blocked or unreachable — select a free tile');
   return;
  }
  if(this.walking){
   // Recompute from the *arrived* tile after the current animation step; never teleport.
   this.pendingDestination=destination;
   this.drawTravelPlan(route);
   this.game.events.emit('guild:status','New destination selected — rerouting after this step');
   return;
  }
  this.pendingDestination=null;
  this.plan=route;this.path=[...route.path];
  this.drawTravelPlan(route);
  this.game.events.emit('guild:status','Walking to selected map tile X:'+x+' Y:'+y);
  this.nextStep();
 }
 private nextStep(){
  if(this.walking||this.game.registry.get('mode')!=='explore')return;
  const next=this.path.shift();
  if(!next){
   const completed=this.plan;this.plan=null;this.travelMarks.clear();
   if(completed?.interaction)this.interact();
   else this.game.events.emit('guild:status','Arrived — tap another destination on the map');
   return;
  }
  const dx=next.x-this.pos.x,dy=next.y-this.pos.y;
  this.direction=dx<0?'left':dx>0?'right':dy<0?'up':'down';
  this.walking=true;this.hero.play('hero-walk-'+this.direction,true);
  this.tweens.add({targets:this.hero,x:next.x*TILE_SIZE+8,y:next.y*TILE_SIZE+8,
   duration:140,ease:'Linear',onComplete:()=>{
    this.pos=next;this.walking=false;
    this.routeHistory.push({...next});
    const history=this.routeHistory;
    this.followers.forEach((follower,i)=>{
      // Each stand-in trails on a previously traversed walkable tile (not through walls).
      const followTile=history[Math.max(0,history.length-2-i)];
      this.tweens.add({targets:follower,
        x:followTile.x*TILE_SIZE+8,y:followTile.y*TILE_SIZE+8,
        duration:125,ease:'Linear'});
      follower.setTexture('hero-'+this.direction+'-0');
    });
    this.hero.stop();this.hero.setTexture('hero-'+this.direction+'-0');
    this.announce();
    if(this.pendingDestination){
      const target=this.pendingDestination;this.pendingDestination=null;
      this.chooseDestination(target.x,target.y);
    }else this.nextStep();
   }});
 }
 private interact(){
  if(this.walking)return;
  if(canInteract(this.pos,GUILD_MASTER)){
   this.plan=null;this.path=[];this.travelMarks.clear();
   this.game.registry.set('mode','dialogue');
   this.game.events.emit('guild:dialogue','ยินดีต้อนรับ ผู้ฝึกเภสัชกร! เจ้าจงฟัง ตรวจสอบ วิเคราะห์ และวางแผน หากไม่แน่ใจ จงปรึกษาผู้ควบคุมการฝึก ก่อนลองเผชิญหน้าหมอกแห่งความสับสน');
  }else if(canInteract(this.pos,TRAINING_PORTAL)){
   this.plan=null;this.path=[];this.travelMarks.clear();
   this.scene.start('Encounter');
  }else{
   this.game.events.emit('guild:status','Tap Guild Master ✦ or Training Portal ⚔ on the map to walk there');
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
