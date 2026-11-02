import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { doc, getDoc, setDoc, deleteField, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { auth, db } from './firebase.js';
import { formatDateDisplay } from './format.js';

const form = document.getElementById('form_register');
const submitBtn = document.getElementById('register_submit');
const logoutBtn = document.getElementById('logout_btn');
const coupleNamesInput = document.getElementById('couple_names');
const weddingDateInput = document.getElementById('wedding_date');
const weddingDateDisplay = document.getElementById('wedding_date_display');

function setHint(id, msg){ document.getElementById(id).textContent = msg || ''; }

weddingDateInput.addEventListener('change', ()=>{
  weddingDateDisplay.value = formatDateDisplay(weddingDateInput.value);
});

// 표시용 필드는 클릭만 받고, 실제 달력은 숨겨진 네이티브 date input이 띄움
weddingDateDisplay.addEventListener('click', ()=>{
  try{
    weddingDateInput.showPicker();
  }catch(err){
    weddingDateInput.focus();
  }
});

function setLoading(btn, loading, labelDefault, labelLoading){
  btn.disabled = loading;
  btn.textContent = loading ? labelLoading : labelDefault;
  btn.style.opacity = loading ? '0.7' : '1';
  btn.style.cursor = loading ? 'not-allowed' : 'pointer';
}

let currentUid = null;

// 로그인 + 관리자 승인된 계정만 접근 허용, 아니면 로그인 화면으로 되돌림
onAuthStateChanged(auth, async (user)=>{
  if(!user){
    window.location.href = '../index.html';
    return;
  }

  const memberSnap = await getDoc(doc(db, 'user_account_list', user.uid));
  const status = memberSnap.exists() ? memberSnap.data().status : null;

  if(status !== '인증'){
    await signOut(auth);
    window.location.href = '../index.html';
    return;
  }

  currentUid = user.uid;

  const data = memberSnap.data();
  if(data.coupleNames) coupleNamesInput.value = data.coupleNames;
  if(data.weddingDate){
    weddingDateInput.value = data.weddingDate;
    weddingDateDisplay.value = formatDateDisplay(data.weddingDate);
  }
});

// 로그아웃 = 등록된 예식 정보 초기화 후 로그인 화면으로 이동. 다음 예식을 위해 이전 정보를 남기지 않음
logoutBtn.addEventListener('click', async ()=>{
  logoutBtn.disabled = true;
  try{
    if(currentUid){
      await setDoc(doc(db, 'user_account_list', currentUid), {
        coupleNames: deleteField(),
        weddingDate: deleteField()
      }, { merge: true });
    }
    await signOut(auth);
  }finally{
    window.location.href = '../index.html';
  }
});

form.addEventListener('submit', async (e)=>{
  e.preventDefault();
  if(!currentUid) return;

  const coupleNames = coupleNamesInput.value.trim();
  const weddingDate = weddingDateInput.value;

  let ok = true;
  if(!coupleNames){ setHint('couple_names_hint','신랑 & 신부 성함을 입력해주세요.'); ok = false; } else setHint('couple_names_hint','');
  if(!weddingDate){ setHint('wedding_date_hint','예식 일자를 선택해주세요.'); ok = false; } else setHint('wedding_date_hint','');
  if(!ok) return;

  setLoading(submitBtn, true, '포토 스튜디오 입장하기', '저장 중...');
  try{
    await setDoc(doc(db, 'user_account_list', currentUid), {
      coupleNames,
      weddingDate,
      updatedAt: serverTimestamp()
    }, { merge: true });

    window.location.href = 'studio.html';
  }catch(err){
    setHint('wedding_date_hint','저장 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.');
  }finally{
    setLoading(submitBtn, false, '포토 스튜디오 입장하기', '저장 중...');
  }
});
