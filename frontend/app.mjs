import { firebaseConfig } from './firebase-config.mjs';
import { getMyProfile } from './api-client.mjs';
import { mountGame } from './game-ui.mjs';
const $=id=>document.getElementById(id);
const login=$('login'),logout=$('logout'),retry=$('retry'),welcome=$('welcome'),message=$('message');
const roles={student:'นักศึกษา',gm:'Game Master',preceptor:'อาจารย์ประจำแหล่งฝึก',admin:'ผู้ดูแลระบบ'};
const errors={enrollment_required:'บัญชียังไม่ได้ลงทะเบียน กรุณาติดต่อผู้ดูแล',account_not_active:'บัญชียังไม่อนุมัติหรือถูกพักการใช้งาน',invalid_token:'กรุณาออกจากระบบแล้วเข้าสู่ระบบใหม่','auth/popup-blocked':'กรุณาอนุญาต Popup แล้วลองใหม่','auth/popup-closed-by-user':'ปิดหน้าต่างเข้าสู่ระบบแล้ว สามารถลองใหม่','auth/unauthorized-domain':'ยังตั้งค่าโดเมนเข้าสู่ระบบไม่ครบ','auth/network-request-failed':'เชื่อมต่อ Google ไม่สำเร็จ กรุณาตรวจเครือข่าย'};
try{
 const [appSDK,sdk]=await Promise.all([import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js')]);
 const auth=sdk.getAuth(appSDK.initializeApp(firebaseConfig));await sdk.setPersistence(auth,sdk.inMemoryPersistence);
 const provider=new sdk.GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});
 let generation=0,controller;
 function clear(){++generation;controller?.abort();welcome.hidden=true;$('game').replaceChildren();}
 async function load(user){clear();const current=generation;const requestController=new AbortController();controller=requestController;retry.disabled=true;message.textContent='กำลังตรวจสิทธิ์…';const timeout=setTimeout(()=>requestController.abort(),15000);
 try{const profile=await getMyProfile(user,{signal:requestController.signal});clearTimeout(timeout);if(current!==generation||auth.currentUser!==user)return;$('name').textContent=profile.displayName;$('role').textContent=roles[profile.role];welcome.hidden=false;message.textContent='เข้าสู่ระบบเรียบร้อย';await mountGame(user,profile,$('game'),requestController.signal);}
 catch(error){if(current===generation&&auth.currentUser===user)message.textContent=errors[error.code]||'เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่';}
 finally{clearTimeout(timeout);if(current===generation)retry.disabled=false;}}
 sdk.onAuthStateChanged(auth,user=>{clear();login.hidden=!!user;logout.hidden=!user;retry.hidden=!user;login.disabled=false;$('session-note').hidden=!!user;if(user)void load(user);else message.textContent='พร้อมเริ่มการเรียนรู้';});
 login.addEventListener('click',async()=>{login.disabled=true;try{await sdk.signInWithPopup(auth,provider);}catch(error){message.textContent=errors[error.code]||'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่';}finally{login.disabled=false;}});
 logout.addEventListener('click',async()=>{logout.disabled=true;clear();try{await sdk.signOut(auth);}catch{message.textContent='ออกจากระบบไม่สำเร็จ กรุณาลองใหม่';}finally{logout.disabled=false;}});
 retry.addEventListener('click',()=>{if(auth.currentUser)void load(auth.currentUser);});
}catch{message.textContent='โหลดหน้าเข้าสู่ระบบไม่สำเร็จ กรุณาตรวจเครือข่ายแล้วโหลดหน้าใหม่';}
