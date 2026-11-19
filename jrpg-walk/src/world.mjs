// Pure world/collision data for deterministic Node and browser tests.
// No student data, fetches, or persistent state.
export const TILE_SIZE = 16;
export const WORLD_WIDTH = 24;
export const WORLD_HEIGHT = 16;
export const PLAYER_START = Object.freeze({x:9,y:9});
export const GUILD_MASTER = Object.freeze({x:9,y:7});
export const TRAINING_PORTAL = Object.freeze({x:17,y:10});
export const canInteract = (a,b) => Number.isInteger(a?.x)&&Number.isInteger(a?.y)&&
  Number.isInteger(b?.x)&&Number.isInteger(b?.y)&&Math.abs(a.x-b.x)+Math.abs(a.y-b.y)<=1;
export function tileAt(x,y){
 if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=WORLD_WIDTH||y>=WORLD_HEIGHT)return 'void';
 if(x===0||y===0||x===WORLD_WIDTH-1||y===WORLD_HEIGHT-1)return 'wall';
 if(x>=3&&x<=6&&y>=3&&y<=5)return 'roof';
 if(x>=16&&x<=20&&y>=3&&y<=6)return 'water';
 if(x===12&&y>=3&&y<=5)return 'wall';
 if(y>=8&&y<=11&&x>=4&&x<=20)return 'path';
 if(x>=8&&x<=10&&y>=5&&y<=12)return 'path';
 if((x*7+y*11)%31===0)return 'flower';
 return 'grass';
}
export function isWalkable(x,y){const tile=tileAt(x,y);return ['path','grass','flower'].includes(tile);}
export function canEnter(x,y){return isWalkable(x,y)&&!(x===GUILD_MASTER.x&&y===GUILD_MASTER.y)&&
  !(x===TRAINING_PORTAL.x&&y===TRAINING_PORTAL.y);}
export function nextTile(position,dx,dy){
 if(!Number.isInteger(dx)||!Number.isInteger(dy)||Math.abs(dx)+Math.abs(dy)!==1)return position;
 const x=position.x+dx,y=position.y+dy;
 return canEnter(x,y)?{x,y}:position;
}
export function isReachable(from,to){
 const seen=new Set([from.x+','+from.y]);let todo=[from];
 while(todo.length){const p=todo.shift();if(canInteract(p,to))return true;
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const t=nextTile(p,dx,dy),key=t.x+','+t.y;
   if(!seen.has(key)){seen.add(key);todo.push(t);}
  }
 }
 return false;
}
