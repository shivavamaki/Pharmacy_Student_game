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

// Destination selection is independent of input device (mouse/touch/accessible location button).
// No teleporting through walls, roof tiles, water, NPCs or the training portal.
const CARDINAL_DIRECTIONS=[[0,-1],[-1,0],[1,0],[0,1]];
const tileKey=({x,y})=>x+','+y;
const sameTile=(a,b)=>a.x===b.x&&a.y===b.y;
export function shortestPath(from,to){
 if(!from||!to||!canEnter(from.x,from.y)||!canEnter(to.x,to.y))return null;
 if(sameTile(from,to))return [];
 const queue=[{x:from.x,y:from.y}],parent=new Map([[tileKey(from),null]]);
 for(let i=0;i<queue.length;i++){
  const current=queue[i];
  for(const [dx,dy] of CARDINAL_DIRECTIONS){
   const next={x:current.x+dx,y:current.y+dy},key=tileKey(next);
   if(parent.has(key)||!canEnter(next.x,next.y))continue;
   parent.set(key,current);
   if(sameTile(next,to)){
    const path=[next];
    let cursor=current;
    while(!sameTile(cursor,from)){path.push(cursor);cursor=parent.get(tileKey(cursor));}
    return path.reverse();
   }
   queue.push(next);
  }
 }
 return null;
}
export function routeToDestination(from,selected){
 if(!selected||!Number.isInteger(selected.x)||!Number.isInteger(selected.y))return null;
 const interaction=sameTile(selected,GUILD_MASTER)?'guild-master':
   sameTile(selected,TRAINING_PORTAL)?'training-portal':null;
 const candidateTiles=interaction
  ?CARDINAL_DIRECTIONS.map(([dx,dy])=>({x:selected.x+dx,y:selected.y+dy}))
    .filter(tile=>canEnter(tile.x,tile.y))
  :[selected];
 let best=null;
 for(const destination of candidateTiles){
  const path=shortestPath(from,destination);
  if(path!==null&&(!best||path.length<best.path.length)){
   best={path,target:{x:selected.x,y:selected.y},destination,interaction};
  }
 }
 return best;
}
