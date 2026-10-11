import { API_ORIGIN } from './api-client.mjs';
const pendingKeys=new Map();
export async function gameRequest(user,path,{body,signal,fetcher=fetch}={}){
 if(!user)throw Object.assign(Error('authentication_required'),{code:'authentication_required'});
 if(!/^\/[A-Za-z0-9%._~/-]+$/.test(path))throw Error('invalid path');
 const token=await user.getIdToken();const headers={Authorization:'Bearer '+token};let serialized;
 if(body!==undefined){serialized=JSON.stringify(body);headers['Content-Type']='application/json';const cacheKey=user.uid+'\n'+path+'\n'+serialized;if(!pendingKeys.has(cacheKey))pendingKeys.set(cacheKey,crypto.randomUUID());headers['Idempotency-Key']=pendingKeys.get(cacheKey);if(pendingKeys.size>100)pendingKeys.delete(pendingKeys.keys().next().value);}
 const response=await fetcher(API_ORIGIN+'/api'+path,{method:body===undefined?'GET':'POST',headers,body:serialized,signal,credentials:'omit',cache:'no-store',redirect:'error'});
 let data;try{data=await response.json();}catch{throw Object.assign(Error('invalid_response'),{code:'invalid_response'});}
 if(!response.ok)throw Object.assign(Error(data.error||'request_failed'),{code:data.error||'request_failed',status:response.status});
 if(!data||typeof data!=='object'||Array.isArray(data))throw Object.assign(Error('invalid_response'),{code:'invalid_response'});
 if(body!==undefined)pendingKeys.delete(user.uid+'\n'+path+'\n'+serialized);
 return data;
}
