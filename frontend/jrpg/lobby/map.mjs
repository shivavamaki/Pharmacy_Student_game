// Visual only. Durable Object validates routes and collisions independently.
export const SIZE={width:24,height:16};
export const landmarks=Object.freeze({master:{x:9,y:7},portal:{x:17,y:10},center:{x:9,y:9}});
export function terrain(x,y){
 if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=SIZE.width||y>=SIZE.height)return 'void';
 if(x===0||y===0||x===SIZE.width-1||y===SIZE.height-1)return 'wall';
 if(x>=3&&x<=6&&y>=3&&y<=5)return 'roof';
 if(x>=16&&x<=20&&y>=3&&y<=6)return 'water';
 if(x===12&&y>=3&&y<=5)return 'wall';
 if(y>=8&&y<=11&&x>=4&&x<=20)return 'path';
 if(x>=8&&x<=10&&y>=5&&y<=12)return 'path';
 if((x*7+y*11)%31===0)return 'flower';
 return 'grass';
}
export const pointFromMapEvent=(clientX,clientY,bounds)=>({
 x:Math.floor((clientX-bounds.left)*SIZE.width/bounds.width),
 y:Math.floor((clientY-bounds.top)*SIZE.height/bounds.height)
});
