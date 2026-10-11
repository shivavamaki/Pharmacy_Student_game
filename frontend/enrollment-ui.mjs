import {gameRequest} from './game-client.mjs';
const node=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=String(text);return el;};
export async function mountEnrollment(user,container,signal,onRegistered){
 const data=await gameRequest(user,'/enrollment',{signal});if(signal.aborted)return;
 container.replaceChildren();container.append(node('h3','ลงทะเบียนนักศึกษา'),node('p','บัญชี Google: '+data.identity.email));
 if(data.status!=='not_registered'){
  const text=data.status==='pending'?'ส่งคำขอแล้ว รอ Madeaw ตรวจและอนุมัติ':data.status==='inactive'?'บัญชีสิ้นสุดการฝึกหรือถูกพักการใช้งาน กรุณาติดต่อ Madeaw':'บัญชีอนุมัติแล้ว กดตรวจสิทธิ์อีกครั้ง';
  container.append(node('p',text));if(data.profile)container.append(node('p',[data.profile.displayName,data.profile.cohort,data.profile.trainingStart,data.profile.trainingEnd].filter(Boolean).join(' · ')));return;
 }
 const form=node('form');form.className='game-form';const fields=[['displayName','ชื่อ–นามสกุล','text'],['university','มหาวิทยาลัย','text'],['cohort','รุ่น / รอบฝึก','text'],['rotation','แหล่งฝึก / Rotation','text'],['trainingStart','วันที่เริ่มฝึก','date'],['trainingEnd','วันที่จบฝึก','date']];
 for(const [name,label,type]of fields){const wrapper=node('label',label);wrapper.className='field';const input=node('input');input.name=name;input.type=type;input.required=true;input.maxLength=200;if(name==='displayName')input.value=data.identity.displayName||'';wrapper.append(input);form.append(wrapper);}
 const submit=node('button','ส่งคำขอลงทะเบียน');submit.type='submit';const status=node('p');status.setAttribute('role','status');form.append(submit,status);container.append(form,node('p','การลงทะเบียนยังไม่เปิดสิทธิ์เล่น ต้องรอผู้ดูแลอนุมัติและจัดทีมก่อน'));
 const messages={invalid_enrollment:'กรุณาตรวจข้อมูลและวันที่เริ่ม–จบฝึก',enrollment_conflict:'บัญชีนี้มีข้อมูลอยู่แล้ว กรุณาติดต่อผู้ดูแล',migration_required:'ระบบลงทะเบียนยังไม่พร้อม กรุณาติดต่อผู้ดูแล'};
 form.addEventListener('submit',async event=>{event.preventDefault();if(submit.disabled||signal.aborted)return;submit.disabled=true;status.textContent='กำลังส่งคำขอ…';try{await gameRequest(user,'/enrollment',{body:Object.fromEntries(new FormData(form)),signal});if(!signal.aborted)await onRegistered();}catch(error){if(!signal.aborted){status.textContent=messages[error.code]||'ส่งคำขอไม่สำเร็จ กรุณาลองใหม่';submit.disabled=false;}}});
}
