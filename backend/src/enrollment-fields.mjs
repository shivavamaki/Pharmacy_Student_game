import {AuthError} from './auth.mjs';
const fail=()=>{throw new AuthError('invalid_enrollment',400);};
const text=(v,max,required)=>{if(!required&&(v===undefined||v===null||v===''))return '';if(typeof v!=='string'||v.length>max||(required&&!v.trim()))fail();return v.trim();};
export function trainingDates(start,end,required=false){
 const date=v=>{const raw=text(v,10,required);if(!raw)return null;if(!/^\d{4}-\d{2}-\d{2}$/.test(raw)||!Number.isFinite(Date.parse(raw+'T00:00:00Z'))||new Date(raw+'T00:00:00Z').toISOString().slice(0,10)!==raw)fail();return raw;};
 const a=date(start),b=date(end);if(Boolean(a)!==Boolean(b)||(a&&a>b))fail();return[a,b];
}
