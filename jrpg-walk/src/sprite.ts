import Phaser from 'phaser';
// Original code-native 16x16 sprite. Each pixel is drawn to a Phaser texture;
// no third-party character artwork, text or music is used.
const rows=[
'................',
'.....HHHHHH.....',
'....HHHHHHHH....',
'....HSSSSSSH....',
'....HSSSSSSH....',
'.....SSSSSS.....',
'......TTTT......',
'....TTTGGTTT....',
'....TTTGGTTT....',
'.....TTTTTT.....',
'......PPPP......',
'.....PP..PP.....',
'.....PP..PP.....',
'.....BB..BB.....',
'....BBB..BBB....',
'................'
] as const;
const colorCodes:Record<string,number>={H:0x3e2f46,S:0xe8b983,T:0x438b87,G:0xf6d477,P:0x3e5775,B:0x202b48,C:0x8b4d6b};
const dirs=['down','up','left','right'] as const;
export type Direction=typeof dirs[number];
function drawPixels(g:Phaser.GameObjects.Graphics,lines:string[],colors:Record<string,number>){
 for(let y=0;y<16;y++)for(let x=0;x<16;x++){
  const ch=lines[y]?.[x];const color=ch?colors[ch]:undefined;
  if(color!==undefined){g.fillStyle(color);g.fillRect(x,y,1,1);}
 }
}
export function createHeroTextures(scene:Phaser.Scene){
 const g=scene.add.graphics();g.setVisible(false);
 for(const dir of dirs){for(let frame=0;frame<3;frame++){
   const lines=rows.map((r,y)=>{
     let pattern=r;
     if(y>=11&&y<=14&&frame!==0){
       const a=[...pattern];if(frame===1){a[5]='.';a[6]='P';a[9]='.';a[10]='B';}
       else {a[5]='B';a[6]='.';a[9]='P';a[10]='.';}pattern=a.join('');
     }
     if(dir==='up')pattern=pattern.replaceAll('S','H');
     if(dir==='left'||dir==='right')pattern=pattern.replaceAll('G','C');
     if(dir==='left')pattern=[...pattern].reverse().join('');
     return pattern;
   });
   g.clear();drawPixels(g,lines,colorCodes);g.generateTexture('hero-'+dir+'-'+frame,16,16);
 }
  scene.anims.create({key:'hero-walk-'+dir,frames:[0,1,0,2].map(frame=>({key:'hero-'+dir+'-'+frame})),frameRate:8,repeat:-1});
 }
 const npc={...colorCodes,H:0xd7d8bc,S:0xd8a56d,T:0x535c9c,G:0xf4d58e};
 g.clear();drawPixels(g,[...rows],npc);g.generateTexture('guild-master',16,16);
 g.destroy();
}
