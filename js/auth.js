import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  deleteField,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { auth, db } from './firebase.js';
// Storage(로고 업로드)는 일시 제외 — 필요해질 때 firebase-storage.js를 다시 import하세요.

// 연락처 입력 시 자동으로 하이픈(-)을 넣어줍니다. 예: 01012345678 → 010-1234-5678
function formatPhoneNumber(value){
  const digits = value.replace(/[^0-9]/g, '').slice(0, 11);
  if(digits.length < 4) return digits;
  if(digits.length < 8) return `${digits.slice(0,3)}-${digits.slice(3)}`;
  return `${digits.slice(0,3)}-${digits.slice(3,7)}-${digits.slice(7)}`;
}

// 계정 찾기용 조회 키: 이름 + 연락처(숫자만)의 SHA-256. 원문은 저장하지 않음
async function accountLookupKey(name, phone){
  const raw = `${name.trim()}:${phone.replace(/\D/g, '')}`;
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
}

// 계정 찾기 기능 추가 전에 가입한 회원은 조회 문서가 없으므로, 로그인 시 없으면 만들어 줌
async function ensureAccountLookup(uid, member){
  if(!member.name || !member.phone || !member.email) return;
  try{
    const lookupRef = doc(db, 'find_user_account', await accountLookupKey(member.name, member.phone));
    const lookupSnap = await getDoc(lookupRef);
    if(lookupSnap.exists() && lookupSnap.data().email) return;
    await setDoc(lookupRef, { uid, email: member.email });
  }catch(err){
    console.error('find_user_account backfill failed:', err);
  }
}

// Firebase Auth 에러 코드를 한국어 메시지로 변환
function authErrorMessage(err){
  const code = err && err.code ? err.code : '';
  switch(code){
    case 'auth/email-already-in-use': return '이미 가입된 이메일이에요.';
    case 'auth/invalid-email': return '이메일 형식이 올바르지 않아요.';
    case 'auth/weak-password': return '비밀번호가 너무 약해요. 8자 이상으로 설정해주세요.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential': return '이메일 또는 비밀번호가 일치하지 않아요.';
    case 'auth/too-many-requests': return '시도 횟수가 많아 잠시 후 다시 시도해주세요.';
    default: return '오류가 발생했어요. 잠시 후 다시 시도해주세요.';
  }
}

// 모달이 열려있는 동안 배경 스크롤 막기 (모달이 여러 개 겹쳐도 안전하도록 카운트로 관리)
let openModalCount = 0;
function lockScroll(){
  openModalCount++;
  document.body.style.overflow = 'hidden';
}
function unlockScroll(){
  openModalCount = Math.max(0, openModalCount - 1);
  if(openModalCount === 0) document.body.style.overflow = '';
}

// ════════════════════════════════════════════════════════════
// 프론트엔드 로직: 탭 전환, 폼 검증, 로그인/회원가입 화면 동작
// ════════════════════════════════════════════════════════════
function initFrontend(){

  // ────────────────────────────────────────────────────────
  // 탭 전환
  // ────────────────────────────────────────────────────────
  const tabLogin = document.getElementById('auth_tab_login');
  const tabSignup = document.getElementById('auth_tab_signup');
  const paneLogin = document.getElementById('pane_login');
  const paneSignup = document.getElementById('pane_signup');
  const signupFormView = document.getElementById('signup_form_view');
  const signupSuccessView = document.getElementById('signup_success_view');
  const signupSuccessMessage = document.getElementById('signup_success_message');
  document.getElementById('go_to_login_after_signup').addEventListener('click', ()=> showLogin());

  const loginHintIds = ['login_email_hint', 'login_password_hint'];
  const signupHintIds = ['signup_company_hint', 'signup_name_hint', 'signup_phone_hint', 'signup_email_hint', 'signup_password_hint', 'signup_password_confirm_hint'];
  function clearHints(hintIds){ hintIds.forEach(id=> setHint(id, '')); }

  function showLogin(){
    tabLogin.classList.add('active'); tabLogin.setAttribute('aria-selected','true');
    tabSignup.classList.remove('active'); tabSignup.setAttribute('aria-selected','false');
    paneLogin.classList.add('active'); paneSignup.classList.remove('active');
    loginForm.reset();
    clearHints(loginHintIds);
  }
  function showSignup(){
    tabSignup.classList.add('active'); tabSignup.setAttribute('aria-selected','true');
    tabLogin.classList.remove('active'); tabLogin.setAttribute('aria-selected','false');
    paneSignup.classList.add('active'); paneLogin.classList.remove('active');
    signupSuccessView.hidden = true;
    signupFormView.hidden = false;
    signupForm.reset();
    clearHints(signupHintIds);
  }
  tabLogin.addEventListener('click', showLogin);
  tabSignup.addEventListener('click', showSignup);

  // password visibility toggle
  document.querySelectorAll('.toggle_pw').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const target = document.getElementById(btn.dataset.target);
      const show = target.type === 'password';
      target.type = show ? 'text' : 'password';
      btn.classList.toggle('is_visible', show);
      btn.setAttribute('aria-label', show ? '비밀번호 숨기기' : '비밀번호 표시');
    });
  });

  // ────────────────────────────────────────────────────────
  // 로고 업로드는 일시 제외 (Storage 연동 시 다시 추가)
  // ────────────────────────────────────────────────────────

  // ────────────────────────────────────────────────────────
  // 공통 유효성 검사 헬퍼
  // ────────────────────────────────────────────────────────
  function setHint(id, msg){ document.getElementById(id).textContent = msg || ''; }
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const signupPhoneInput = document.getElementById('signup_phone');
  signupPhoneInput.addEventListener('input', (e)=>{
    e.target.value = formatPhoneNumber(e.target.value);
  });

  // 이메일 형식을 입력 중/포커스 아웃 시 바로바로 검사해서 보여줍니다.
  function bindLiveEmailValidation(inputId, hintId){
    const input = document.getElementById(inputId);
    input.addEventListener('blur', ()=>{
      const value = input.value.trim();
      if(value.length === 0){ setHint(hintId,''); return; }
      setHint(hintId, emailRe.test(value) ? '' : '올바른 이메일 형식이 아니에요. (예: name@example.com)');
    });
    input.addEventListener('input', ()=>{
      if(document.getElementById(hintId).textContent){
        setHint(hintId, emailRe.test(input.value.trim()) ? '' : '올바른 이메일 형식이 아니에요. (예: name@example.com)');
      }
    });
  }
  bindLiveEmailValidation('login_email', 'login_email_hint');
  bindLiveEmailValidation('signup_email', 'signup_email_hint');

  function setLoading(btn, loading, labelDefault, labelLoading){
    btn.disabled = loading;
    btn.textContent = loading ? labelLoading : labelDefault;
    btn.style.opacity = loading ? '0.7' : '1';
    btn.style.cursor = loading ? 'not-allowed' : 'pointer';
  }

  // ────────────────────────────────────────────────────────
  // 로그인
  // ────────────────────────────────────────────────────────
  const loginForm = document.getElementById('form_login');
  const loginBtn = loginForm.querySelector('.btn_primary');

  loginForm.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const email = document.getElementById('login_email').value.trim();
    const pw = document.getElementById('login_password').value;

    let ok = true;
    if(!emailRe.test(email)){ setHint('login_email_hint','올바른 이메일 주소를 입력해주세요.'); ok = false; } else setHint('login_email_hint','');
    if(pw.length < 1){ setHint('login_password_hint','비밀번호를 입력해주세요.'); ok = false; } else setHint('login_password_hint','');
    if(!ok) return;

    setLoading(loginBtn, true, '로그인', '로그인 중...');
    try{
      const cred = await signInWithEmailAndPassword(auth, email, pw);

      // 관리자가 Firestore에서 status를 '인증'으로 바꿔준 계정만 로그인 허용
      const partnerSnap = await getDoc(doc(db, 'user_account_list', cred.user.uid));
      const status = partnerSnap.exists() ? partnerSnap.data().status : null;
      if(partnerSnap.exists()) await ensureAccountLookup(cred.user.uid, partnerSnap.data());

      if(status !== '인증'){
        await signOut(auth);
        setHint('login_password_hint','아직 관리자 승인 대기 중이에요. 승인 완료 후 다시 로그인해주세요.');
        return;
      }

      // 새 로그인 세션 시작 시 이전에 등록했던 예식 정보는 초기화
      await setDoc(doc(db, 'user_account_list', cred.user.uid), {
        coupleNames: deleteField(),
        weddingDate: deleteField()
      }, { merge: true });

      window.location.href = 'pages/register.html';
    }catch(err){
      setHint('login_password_hint', authErrorMessage(err));
    }finally{
      setLoading(loginBtn, false, '로그인', '로그인 중...');
    }
  });


  // ────────────────────────────────────────────────────────
  // 회원가입 (Auth → Firestore 업체 정보 저장)
  // ────────────────────────────────────────────────────────
  const signupForm = document.getElementById('form_signup');
  const signupBtn = signupForm.querySelector('.btn_primary');

  signupForm.addEventListener('submit', async (e)=>{
    e.preventDefault();

    const company = document.getElementById('signup_company').value.trim();
    const name = document.getElementById('signup_name').value.trim();
    const phone = document.getElementById('signup_phone').value.trim();
    const email = document.getElementById('signup_email').value.trim();
    const pw = document.getElementById('signup_password').value;
    const passwordConfirm = document.getElementById('signup_password_confirm').value;
    const agree = signupForm.querySelector('input[name="agree"]').checked;

    let ok = true;
    if(!company){ setHint('signup_company_hint','업체명을 입력해주세요.'); ok = false; } else setHint('signup_company_hint','');
    if(!name){ setHint('signup_name_hint','이름을 입력해주세요.'); ok = false; } else setHint('signup_name_hint','');
    if(!phone){ setHint('signup_phone_hint','연락처를 입력해주세요.'); ok = false; } else setHint('signup_phone_hint','');
    if(!emailRe.test(email)){ setHint('signup_email_hint','올바른 이메일 주소를 입력해주세요.'); ok = false; } else setHint('signup_email_hint','');
    if(pw.length < 8){ setHint('signup_password_hint','비밀번호는 8자 이상이어야 해요.'); ok = false; } else setHint('signup_password_hint','');
    if(pw !== passwordConfirm){ setHint('signup_password_confirm_hint','비밀번호가 일치하지 않아요.'); ok = false; } else setHint('signup_password_confirm_hint','');
    if(!agree){ ok = false; }
    if(!ok) return;

    setLoading(signupBtn, true, '가입하기', '가입 처리 중...');
    try{
      // 1) 인증 계정 생성
      const cred = await createUserWithEmailAndPassword(auth, email, pw);
      const uid = cred.user.uid;

      // 2) 업체 정보 Firestore에 저장
      //    로고 업로드(Storage)는 일시 제외했습니다. 나중에 Blaze로 업그레이드하면
      //    firebase-storage.js를 다시 import하고 이 자리에 업로드 로직을 추가하세요.
      await setDoc(doc(db, 'user_account_list', uid), {
        company,
        name,
        phone,
        email,
        logoURL: null,
        status: '미인증',      // 관리자가 Firestore 콘솔에서 '인증'으로 바꿔주면 로그인 가능
        createdAt: serverTimestamp()
      });

      // 2-1) 계정 찾기용 조회 문서 저장 (실패해도 가입 자체는 진행)
      try{
        await setDoc(doc(db, 'find_user_account', await accountLookupKey(name, phone)), {
          uid,
          email
        });
      }catch(err){
        console.error('find_user_account write failed:', err);
      }

      // 3) 가입 직후에는 아직 승인 전이므로 로그아웃 상태로 대기 안내
      await signOut(auth);

      signupForm.reset();
      showSignupSuccess(email);
    }catch(err){
      setHint('signup_email_hint', authErrorMessage(err));
    }finally{
      setLoading(signupBtn, false, '가입하기', '가입 처리 중...');
    }
  });

  // 가입 완료 안내: 폼을 숨기고 관리자 승인 대기 메시지를 보여줌
  function showSignupSuccess(email){
    signupFormView.hidden = true;
    signupSuccessView.hidden = false;
    signupSuccessMessage.replaceChildren();
    const strong = document.createElement('strong');
    strong.textContent = email;
    signupSuccessMessage.append(strong, ' 계정은 관리자 승인 후 로그인할 수 있어요. 승인이 완료되면 안내해드릴게요.');
  }
}

// ════════════════════════════════════════════════════════════
// 비밀번호 재설정 모달: 프래그먼트를 불러와 삽입하고 동작을 연결
// ════════════════════════════════════════════════════════════
async function initResetPasswordModal(){
  const forgotLink = document.getElementById('forgot_password_link');
  const modalRoot = document.getElementById('modal_root');

  const res = await fetch('modal/reset-password-modal.html');
  modalRoot.insertAdjacentHTML('beforeend', await res.text());

  const overlay = document.getElementById('reset_modal_overlay');
  const closeBtn = document.getElementById('reset_modal_close');
  const form = document.getElementById('form_reset_password');
  const emailInput = document.getElementById('reset_email');
  const emailHint = document.getElementById('reset_email_hint');
  const submitBtn = document.getElementById('reset_submit');
  const successMsg = document.getElementById('reset_success_msg');
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function setHint(msg){ emailHint.textContent = msg || ''; }

  function openModal(){
    form.hidden = false;
    successMsg.hidden = true;
    form.reset();
    setHint('');
    overlay.hidden = false;
    lockScroll();
    emailInput.focus();
  }
  function closeModal(){ overlay.hidden = true; unlockScroll(); }

  forgotLink.addEventListener('click', (e)=>{
    e.preventDefault();
    openModal();
  });
  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', (e)=>{
    if(e.target === overlay) closeModal();
  });
  document.addEventListener('keydown', (e)=>{
    if(e.key === 'Escape' && !overlay.hidden) closeModal();
  });

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const email = emailInput.value.trim();
    successMsg.hidden = true;
    if(!emailRe.test(email)){
      setHint('올바른 이메일 주소를 입력해주세요.');
      return;
    }
    setHint('');

    submitBtn.disabled = true;
    submitBtn.textContent = '찾는 중...';
    try{
      const actionCodeSettings = {
        url: new URL('index.html', window.location.href).toString(),
        handleCodeInApp: true
      };
      await sendPasswordResetEmail(auth, email, actionCodeSettings);
      successMsg.hidden = false;
    }catch(err){
      console.error('sendPasswordResetEmail failed:', err);
      const code = err && err.code ? err.code : '';
      setHint(code === 'auth/user-not-found' ? '가입되지 않은 이메일이에요.' : authErrorMessage(err));
    }finally{
      submitBtn.disabled = false;
      submitBtn.textContent = '비밀번호 찾기';
    }
  });
}

// ════════════════════════════════════════════════════════════
// 이용약관 및 개인정보 처리방침 모달: 프래그먼트를 불러와 삽입하고 동작을 연결
// ════════════════════════════════════════════════════════════
async function initPrivacyModal(){
  const termsLink = document.querySelector('.terms_link');
  const modalRoot = document.getElementById('modal_root');

  const res = await fetch('modal/privacy-modal.html');
  modalRoot.insertAdjacentHTML('beforeend', await res.text());

  const overlay = document.getElementById('privacy_modal_overlay');
  const closeBtn = document.getElementById('privacy_modal_close');
  const confirmBtn = document.getElementById('privacy_modal_confirm');

  function openModal(){ overlay.hidden = false; lockScroll(); }
  function closeModal(){ overlay.hidden = true; unlockScroll(); }

  termsLink.addEventListener('click', (e)=>{
    e.preventDefault();
    openModal();
  });
  closeBtn.addEventListener('click', closeModal);
  confirmBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', (e)=>{
    if(e.target === overlay) closeModal();
  });
  document.addEventListener('keydown', (e)=>{
    if(e.key === 'Escape' && !overlay.hidden) closeModal();
  });
}

// ════════════════════════════════════════════════════════════
// 계정 찾기 모달: 이름 + 연락처로 가입된 이메일을 조회
// ════════════════════════════════════════════════════════════
async function initFindAccountModal(){
  const findLink = document.getElementById('find_account_link');
  const modalRoot = document.getElementById('modal_root');

  const res = await fetch('modal/find-account-modal.html');
  modalRoot.insertAdjacentHTML('beforeend', await res.text());

  const overlay = document.getElementById('find_modal_overlay');
  const closeBtn = document.getElementById('find_modal_close');
  const form = document.getElementById('form_find_account');
  const nameInput = document.getElementById('find_name');
  const phoneInput = document.getElementById('find_phone');
  const nameHint = document.getElementById('find_name_hint');
  const phoneHint = document.getElementById('find_phone_hint');
  const submitBtn = document.getElementById('find_submit');
  const successMsg = document.getElementById('find_success_msg');

  function openModal(){
    form.hidden = false;
    successMsg.hidden = true;
    form.reset();
    nameHint.textContent = '';
    phoneHint.textContent = '';
    overlay.hidden = false;
    lockScroll();
    nameInput.focus();
  }
  function closeModal(){ overlay.hidden = true; unlockScroll(); }

  findLink.addEventListener('click', (e)=>{
    e.preventDefault();
    openModal();
  });
  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', (e)=>{
    if(e.target === overlay) closeModal();
  });
  document.addEventListener('keydown', (e)=>{
    if(e.key === 'Escape' && !overlay.hidden) closeModal();
  });

  phoneInput.addEventListener('input', (e)=>{
    e.target.value = formatPhoneNumber(e.target.value);
  });

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const name = nameInput.value.trim();
    const phone = phoneInput.value.trim();

    let ok = true;
    if(!name){ nameHint.textContent = '이름을 입력해주세요.'; ok = false; } else nameHint.textContent = '';
    if(phone.replace(/\D/g, '').length < 9){ phoneHint.textContent = '올바른 연락처를 입력해주세요.'; ok = false; } else phoneHint.textContent = '';
    successMsg.hidden = true;
    if(!ok) return;

    submitBtn.disabled = true;
    submitBtn.textContent = '찾는 중...';
    try{
      const snap = await getDoc(doc(db, 'find_user_account', await accountLookupKey(name, phone)));
      if(!snap.exists()){
        phoneHint.textContent = '일치하는 계정이 없어요. 이름과 연락처를 확인해주세요.';
        return;
      }
      successMsg.replaceChildren();
      const strong = document.createElement('strong');
      // 아직 새 형식으로 바뀌지 않은 문서는 예전에 저장한 maskedEmail로 표시
      strong.textContent = snap.data().email || snap.data().maskedEmail;
      successMsg.append('가입된 이메일은 ', strong, ' 이에요.');
      successMsg.hidden = false;
    }catch(err){
      console.error('find account failed:', err);
      phoneHint.textContent = '오류가 발생했어요. 잠시 후 다시 시도해주세요.';
    }finally{
      submitBtn.disabled = false;
      submitBtn.textContent = '계정 찾기';
    }
  });
}

initFrontend();
initResetPasswordModal();
initPrivacyModal();
initFindAccountModal();