  // ────────────────────────────────────────────────────────────
  // 1) Firebase 설정 (photobooth-vow-1fe77 프로젝트 연결 완료)
  // ────────────────────────────────────────────────────────────
  const firebaseConfig = {
    apiKey: "AIzaSyDGr9ouFPqCxvGrjZEF7B9oHHz3Qc6VEGg",
    authDomain: "photobooth-vow-1fe77.firebaseapp.com",
    projectId: "photobooth-vow-1fe77",
    storageBucket: "photobooth-vow-1fe77.firebasestorage.app",
    messagingSenderId: "286806450980",
    appId: "1:286806450980:web:e71d9a011eecbc76e889b1"
  };

  import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
  import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendPasswordResetEmail,
    signOut
  } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
  import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    serverTimestamp
  } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
  // Storage(로고 업로드)는 일시 제외 — 필요해질 때 firebase-storage.js를 다시 import하세요.

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  // ────────────────────────────────────────────────────────────
  // 2) 탭 전환
  // ────────────────────────────────────────────────────────────
  const tabLogin = document.getElementById('tab-login');
  const tabSignup = document.getElementById('tab-signup');
  const paneLogin = document.getElementById('pane-login');
  const paneSignup = document.getElementById('pane-signup');

  function showLogin(){
    tabLogin.classList.add('active'); tabLogin.setAttribute('aria-selected','true');
    tabSignup.classList.remove('active'); tabSignup.setAttribute('aria-selected','false');
    paneLogin.classList.add('active'); paneSignup.classList.remove('active');
  }
  function showSignup(){
    tabSignup.classList.add('active'); tabSignup.setAttribute('aria-selected','true');
    tabLogin.classList.remove('active'); tabLogin.setAttribute('aria-selected','false');
    paneSignup.classList.add('active'); paneLogin.classList.remove('active');
  }
  tabLogin.addEventListener('click', showLogin);
  tabSignup.addEventListener('click', showSignup);

  // password visibility toggle
  document.querySelectorAll('.toggle-pw').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const target = document.getElementById(btn.dataset.target);
      target.type = target.type === 'password' ? 'text' : 'password';
    });
  });

  // ────────────────────────────────────────────────────────────
  // 3) 로고 업로드는 일시 제외 (Storage 연동 시 다시 추가)
  // ────────────────────────────────────────────────────────────

  // ────────────────────────────────────────────────────────────
  // 4) 공통 유효성 검사 헬퍼
  // ────────────────────────────────────────────────────────────
  function setHint(id, msg){ document.getElementById(id).textContent = msg || ''; }
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const biznumRe = /^\d{3}-\d{2}-\d{5}$/;

  function setLoading(btn, loading, labelDefault, labelLoading){
    btn.disabled = loading;
    btn.textContent = loading ? labelLoading : labelDefault;
    btn.style.opacity = loading ? '0.7' : '1';
    btn.style.cursor = loading ? 'not-allowed' : 'pointer';
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

  // ────────────────────────────────────────────────────────────
  // 5) 로그인
  // ────────────────────────────────────────────────────────────
  const loginForm = document.getElementById('form-login');
  const loginBtn = loginForm.querySelector('.btn-primary');

  loginForm.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const pw = document.getElementById('login-password').value;

    let ok = true;
    if(!emailRe.test(email)){ setHint('login-email-hint','올바른 이메일 주소를 입력해주세요.'); ok = false; } else setHint('login-email-hint','');
    if(pw.length < 1){ setHint('login-password-hint','비밀번호를 입력해주세요.'); ok = false; } else setHint('login-password-hint','');
    if(!ok) return;

    setLoading(loginBtn, true, '로그인', '로그인 중...');
    try{
      const cred = await signInWithEmailAndPassword(auth, email, pw);

      // 관리자가 Firestore에서 status를 '인증'으로 바꿔준 계정만 로그인 허용
      const partnerSnap = await getDoc(doc(db, 'member', cred.user.uid));
      const status = partnerSnap.exists() ? partnerSnap.data().status : null;

      if(status !== '인증'){
        await signOut(auth);
        setHint('login-password-hint','아직 관리자 승인 대기 중이에요. 승인 완료 후 다시 로그인해주세요.');
        return;
      }

      // TODO: 로그인 성공 후 이동할 페이지로 교체하세요.
      window.location.href = 'dashboard.html';
    }catch(err){
      setHint('login-password-hint', authErrorMessage(err));
    }finally{
      setLoading(loginBtn, false, '로그인', '로그인 중...');
    }
  });

  // 비밀번호 찾기: 입력된 이메일로 재설정 링크 발송
  const forgotLink = document.getElementById('forgot-password-link');
  forgotLink.addEventListener('click', async (e)=>{
    e.preventDefault();
    const emailInput = document.getElementById('login-email');
    const email = emailInput.value.trim();

    if(!emailRe.test(email)){
      setHint('login-email-hint','비밀번호를 재설정할 이메일을 먼저 입력해주세요.');
      emailInput.focus();
      return;
    }
    setHint('login-email-hint','');

    const originalText = forgotLink.textContent;
    forgotLink.textContent = '발송 중...';
    forgotLink.style.pointerEvents = 'none';
    try{
      await sendPasswordResetEmail(auth, email);
      setHint('login-password-hint','');
      forgotLink.textContent = '재설정 메일을 보냈어요';
      setTimeout(()=>{ forgotLink.textContent = originalText; }, 4000);
    }catch(err){
      setHint('login-email-hint', authErrorMessage(err));
      forgotLink.textContent = originalText;
    }finally{
      forgotLink.style.pointerEvents = 'auto';
    }
  });

  // ────────────────────────────────────────────────────────────
  // 6) 회원가입 (Auth → Firestore 업체 정보 저장)
  // ────────────────────────────────────────────────────────────
  const signupForm = document.getElementById('form-signup');
  const signupBtn = signupForm.querySelector('.btn-primary');

  signupForm.addEventListener('submit', async (e)=>{
    e.preventDefault();

    const company = document.getElementById('signup-company').value.trim();
    const biznum = document.getElementById('signup-biznum').value.trim();
    const name = document.getElementById('signup-name').value.trim();
    const phone = document.getElementById('signup-phone').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const pw = document.getElementById('signup-password').value;
    const pw2 = document.getElementById('signup-password2').value;
    const agree = signupForm.querySelector('input[name="agree"]').checked;

    let ok = true;
    if(!biznumRe.test(biznum)){ setHint('signup-biznum-hint','000-00-00000 형식으로 입력해주세요.'); ok = false; } else setHint('signup-biznum-hint','');
    if(!emailRe.test(email)){ setHint('signup-email-hint','올바른 이메일 주소를 입력해주세요.'); ok = false; } else setHint('signup-email-hint','');
    if(pw.length < 8){ setHint('signup-password-hint','비밀번호는 8자 이상이어야 해요.'); ok = false; } else setHint('signup-password-hint','');
    if(pw !== pw2){ setHint('signup-password2-hint','비밀번호가 일치하지 않아요.'); ok = false; } else setHint('signup-password2-hint','');
    if(!company || !name || !phone){ ok = false; }
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
      await setDoc(doc(db, 'member', uid), {
        company,
        bizNumber: biznum,
        contactName: name,
        phone,
        email,
        logoURL: null,
        status: '미인증',      // 관리자가 Firestore 콘솔에서 '인증'으로 바꿔주면 로그인 가능
        createdAt: serverTimestamp()
      });

      // 3) 가입 직후에는 아직 승인 전이므로 로그아웃 상태로 대기 안내
      await signOut(auth);

      signupForm.reset();
      showSignupSuccess(email);
    }catch(err){
      setHint('signup-email-hint', authErrorMessage(err));
    }finally{
      setLoading(signupBtn, false, '가입하기', '가입 처리 중...');
    }
  });

  // 가입 완료 안내: 폼을 관리자 승인 대기 메시지로 교체
  function showSignupSuccess(email){
    const pane = document.getElementById('pane-signup');
    pane.innerHTML = `
      <div class="eyebrow">Pending approval</div>
      <h2 class="heading">가입 신청이 접수됐어요</h2>
      <p class="subheading"><strong>${email}</strong> 계정은 관리자 승인 후 로그인할 수 있어요. 승인이 완료되면 안내해드릴게요.</p>
      <button type="button" class="btn-primary" id="go-to-login-after-signup">로그인 화면으로</button>
    `;
    document.getElementById('go-to-login-after-signup').addEventListener('click', showLogin);
  }
