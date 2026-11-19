// Isolated JRPG multiplayer Worker. Not mounted on the existing Guild API.
// Every ticket comes from Firebase Auth + an ACTIVE student / ACTIVE D1 party.
import {authenticate, AuthError, createTokenVerifier} from '../backend/src/auth.mjs';
export {JrpgRoom} from './room.mjs';

const PARTY_PATH=/^\/api\/jrpg\/parties\/([A-Za-z0-9_-]{1,90})\/(ticket|connect)$/;
const json=(value,status=200,headers={})=>new Response(JSON.stringify(value),{
 status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',
  'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',...headers}
});
export async function isAuthorizedPartyMember(db,partyId,profileId){
 if(!db)throw new AuthError('multiplayer_not_configured',503);
 try{
  const row=await db.prepare(
   "SELECT m.profile_id FROM party_members m JOIN parties p ON p.id=m.party_id "+
   "JOIN profiles pr ON pr.id=m.profile_id "+
   "WHERE m.party_id=? AND m.profile_id=? AND p.status='active' "+
   "AND pr.status='active' AND pr.role='student'"
  ).bind(partyId,profileId).first();
  return Boolean(row);
 }catch(error){if(error instanceof AuthError)throw error;
  throw new AuthError('membership_check_unavailable',503);}
}
const ticketToken=()=>{
 const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);
 return Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
};
export function createJrpgOnlineWorker(verifyToken=createTokenVerifier()){
 return {
  async fetch(request,env={}){
   const url=new URL(request.url),origin=request.headers.get('Origin');
   const allowed=env.ALLOWED_ORIGIN;
   const cors=origin&&origin===allowed?{
    'Access-Control-Allow-Origin':origin,'Vary':'Origin'
   }:{};
   // Fail closed, including WebSocket upgrades. No wildcard CORS.
   if(origin&&origin!==allowed)return json({error:'origin_not_allowed'},403);
   if(request.method==='OPTIONS'){
    if(!origin||origin!==allowed)return json({error:'origin_required'},403);
    return new Response(null,{status:204,headers:{...cors,
     'Access-Control-Allow-Methods':'POST, OPTIONS',
     'Access-Control-Allow-Headers':'Authorization',
     'Access-Control-Max-Age':'600','Cache-Control':'no-store'}});
   }
   if(url.pathname==='/health'&&request.method==='GET'){
    return json({ok:true,service:'jrpg-online',ready:Boolean(env.DB&&env.JRPG_ROOMS&&env.BRIDGE_SECRET&&env.FIREBASE_PROJECT_ID)},200,cors);
   }
   const match=PARTY_PATH.exec(url.pathname);
   if(!match)return json({error:'not_found'},404,cors);
   const [,partyId,action]=match;
   if(!env.DB||!env.JRPG_ROOMS||!env.BRIDGE_SECRET||!env.FIREBASE_PROJECT_ID)
    return json({error:'multiplayer_not_configured'},503,cors);
   const room=env.JRPG_ROOMS.get(env.JRPG_ROOMS.idFromName('party:'+partyId));
   if(action==='connect'){
    if(request.method!=='GET'||request.headers.get('Upgrade')?.toLowerCase()!=='websocket')
     return json({error:'websocket_upgrade_required'},426,cors);
    // The browser cannot send Authorization on WebSocket connections. Only an
    // opaque single-use ticket goes in the subprotocol; never a Firebase token.
    const protocols=(request.headers.get('Sec-WebSocket-Protocol')||'')
      .split(',').map(v=>v.trim());
    if(!protocols.includes('guild-jrpg-v1')||
      !protocols.some(v=>/^ticket\.[a-f0-9]{64}$/.test(v)))
      return json({error:'connection_ticket_required'},401,cors);
    return room.fetch(new Request('https://room.internal/connect',{
      method:'GET',headers:{
       Upgrade:'websocket',
       'Sec-WebSocket-Protocol':protocols.join(', '),
       'X-JRPG-Bridge-Secret':env.BRIDGE_SECRET
      }
    }));
   }
   if(request.method!=='POST')return json({error:'method_not_allowed'},405,{...cors,Allow:'POST'});
   try{
    const profile=await authenticate(request,env,verifyToken);
    if(profile.role!=='student')throw new AuthError('student_only',403);
    if(!await isAuthorizedPartyMember(env.DB,partyId,profile.id))
      throw new AuthError('party_access_denied',403);
    const token=ticketToken();
    const response=await room.fetch('https://room.internal/mint',{
      method:'POST',
      headers:{'X-JRPG-Bridge-Secret':env.BRIDGE_SECRET,'Content-Type':'application/json'},
      body:JSON.stringify({ticket:token,partyId,profileId:profile.id,
       displayName:profile.displayName.slice(0,100),expiresAt:Date.now()+60_000})
    });
    if(!response.ok)return json({error:response.status===429?'room_busy':'ticket_unavailable'},
     response.status===429?429:503,cors);
    const websocketUrl='wss://'+url.host+'/api/jrpg/parties/'+partyId+'/connect';
    return json({ticket:token,websocketUrl,expiresInSeconds:60,protocol:'guild-jrpg-v1'},200,cors);
   }catch(error){
    if(error instanceof AuthError)return json({error:error.code},error.status,cors);
    return json({error:'multiplayer_unavailable'},503,cors);
   }
  }
 };
}
export default createJrpgOnlineWorker();
