import { firebaseConfig } from './firebase-config.mjs';
import { getMyProfile, getMyParties } from './api-client.mjs';
const $ = id => document.getElementById(id);
const login = $('login'), logout = $('logout'), retry = $('retry');
const message = $('message'), welcome = $('welcome');
const labels = { admin: 'ผู้ดูแลระบบ', gm: 'Game Master', preceptor: 'อาจารย์ประจำแหล่งฝึก', student: 'นักศึกษา' };
const messages = {
  enrollment_required: 'บัญชีนี้ยังไม่ได้ลงทะเบียน กรุณาติดต่อผู้ดูแลเพื่อขอเข้าใช้งาน',
  account_not_active: 'บัญชีนี้ยังไม่ได้รับอนุมัติ หรือถูกพักการใช้งาน กรุณาติดต่อผู้ดูแล',
  account_not_authorized: 'บัญชีนี้ยังไม่มีสิทธิ์เข้าใช้งาน กรุณาติดต่อผู้ดูแล',
  invalid_token: 'ยืนยันการเข้าสู่ระบบไม่สำเร็จ กรุณาออกจากระบบแล้วเข้าสู่ระบบใหม่',
  'auth/popup-blocked': 'กรุณาอนุญาตหน้าต่าง popup แล้วลองเข้าสู่ระบบอีกครั้ง',
  'auth/popup-closed-by-user': 'ปิดหน้าต่างเข้าสู่ระบบแล้ว สามารถกดเข้าสู่ระบบเพื่อลองใหม่',
  'auth/cancelled-popup-request': 'กรุณาใช้หน้าต่างเข้าสู่ระบบที่เปิดอยู่',
  'auth/unauthorized-domain': 'ยังตั้งค่าหน้าเข้าสู่ระบบไม่ครบ กรุณาแจ้งผู้ดูแล',
  origin_not_allowed: 'ยังเชื่อมต่อระบบไม่ได้ กรุณาแจ้งผู้ดูแล',
  'auth/network-request-failed': 'เชื่อมต่อ Google ไม่สำเร็จ กรุณาตรวจสอบเครือข่ายแล้วลองใหม่'
};
function errorMessage(error) {
  message.textContent = messages[error.code] || 'เชื่อมต่อระบบไม่สำเร็จ กรุณาลองใหม่';
}
function renderParties(data) {
  const list = $('party-list');
  list.replaceChildren();
  for (const party of data.parties) {
    const item = document.createElement('li');
    const title = document.createElement('h4');
    title.textContent = party.name;
    const detail = document.createElement('p');
    detail.textContent = [party.rotation, party.gmName ? 'GM: ' + party.gmName : null].filter(Boolean).join(' · ') || 'ยังไม่ได้ระบุรายละเอียด';
    item.append(title, detail);
    list.append(item);
  }
  $('party-status').textContent = data.parties.length
    ? (data.hasMore ? 'แสดง 100 ปาร์ตี้แรก' : data.parties.length + ' ปาร์ตี้')
    : 'ยังไม่มีปาร์ตี้ที่เข้าถึงได้';
}
try {
  const [appSDK, sdk] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js')
  ]);
  const auth = sdk.getAuth(appSDK.initializeApp(firebaseConfig));
  await sdk.setPersistence(auth, sdk.inMemoryPersistence);
  const provider = new sdk.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  let generation = 0;
  let controller;
  async function loadProfile(user) {
    const current = ++generation;
    controller?.abort();
    const requestController = new AbortController();
    controller = requestController;
    const timeout = setTimeout(() => requestController.abort(), 15000);
    retry.disabled = true;
    welcome.hidden = true;
    $('party-list').replaceChildren();
    $('party-status').textContent = '';
    message.textContent = 'กำลังตรวจสิทธิ์เข้าใช้งาน…';
    try {
      const profile = await getMyProfile(user, { signal: requestController.signal });
      if (current !== generation || auth.currentUser !== user) return;
      $('name').textContent = profile.displayName;
      $('role').textContent = labels[profile.role];
      welcome.hidden = false;
      message.textContent = 'เข้าสู่ระบบเรียบร้อย';
      $('party-title').textContent = profile.role === 'admin' ? 'ปาร์ตี้ทั้งหมด' : 'ปาร์ตี้ของฉัน';
      $('party-status').textContent = 'กำลังโหลดปาร์ตี้…';
      try {
        const data = await getMyParties(user, { signal: requestController.signal });
        if (current !== generation || auth.currentUser !== user) return;
        renderParties(data);
      } catch {
        if (current === generation && auth.currentUser === user)
          $('party-status').textContent = 'โหลดปาร์ตี้ไม่สำเร็จ กดตรวจสิทธิ์อีกครั้งเพื่อลองใหม่';
      }
    } catch (error) {
      if (current === generation && auth.currentUser === user) errorMessage(error);
    } finally {
      clearTimeout(timeout);
      if (current === generation) retry.disabled = !auth.currentUser;
    }
  }
  sdk.onAuthStateChanged(auth, user => {
    ++generation;
    controller?.abort();
    welcome.hidden = true;
    $('party-list').replaceChildren();
    $('party-status').textContent = '';
    login.hidden = Boolean(user);
    logout.hidden = !user;
    retry.hidden = !user;
    login.disabled = false;
    $('session-note').hidden = Boolean(user);
    if (user) void loadProfile(user);
    else message.textContent = 'พร้อมเริ่มการเรียนรู้';
  });
  login.addEventListener('click', async () => {
    login.disabled = true;
    message.textContent = 'กำลังเปิด Google sign-in…';
    try { await sdk.signInWithPopup(auth, provider); }
    catch (error) { errorMessage(error); }
    finally { login.disabled = false; }
  });
  logout.addEventListener('click', async () => {
    logout.disabled = true;
    try { await sdk.signOut(auth); }
    catch (error) { errorMessage(error); }
    finally { logout.disabled = false; }
  });
  retry.addEventListener('click', () => {
    if (auth.currentUser) void loadProfile(auth.currentUser);
  });
} catch {
  message.textContent = 'โหลดหน้าเข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบเครือข่ายแล้วโหลดหน้าใหม่';
}
