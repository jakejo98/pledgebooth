import { verifyPasswordResetCode, confirmPasswordReset } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { auth } from './firebase.js';

const subheading = document.getElementById('reset_subheading');
const form = document.getElementById('form_new_password');
const newPasswordInput = document.getElementById('new_password');
const newPasswordConfirmInput = document.getElementById('new_password_confirm');
const newPasswordHint = document.getElementById('new_password_hint');
const newPasswordConfirmHint = document.getElementById('new_password_confirm_hint');
const submitBtn = document.getElementById('reset_password_submit');
const resultBox = document.getElementById('reset_password_result');
const resultMsg = document.getElementById('reset_password_result_msg');
const goToLoginBtn = document.getElementById('go_to_login');

function setHint(el, msg){ el.textContent = msg || ''; }

function showResult(msg){
  form.hidden = true;
  subheading.hidden = true;
  resultMsg.textContent = msg;
  resultBox.hidden = false;
}

goToLoginBtn.addEventListener('click', ()=>{
  window.location.href = '../index.html';
});

const params = new URLSearchParams(window.location.search);
const mode = params.get('mode');
const oobCode = params.get('oobCode');

// Firebase가 이메일 링크에 붙여준 oobCode(1회용 인증 코드)의 유효성을 먼저 확인
(async ()=>{
  if(mode !== 'resetPassword' || !oobCode){
    subheading.textContent = '잘못된 접근이에요. 재설정 링크를 다시 요청해주세요.';
    return;
  }

  try{
    await verifyPasswordResetCode(auth, oobCode);
    subheading.textContent = '새로 사용할 비밀번호를 입력해주세요.';
    form.hidden = false;
  }catch(err){
    subheading.textContent = '링크가 만료됐거나 이미 사용됐어요. 재설정을 다시 요청해주세요.';
  }
})();

form.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const pw = newPasswordInput.value;
  const pwConfirm = newPasswordConfirmInput.value;

  let ok = true;
  if(pw.length < 8){ setHint(newPasswordHint, '비밀번호는 8자 이상이어야 해요.'); ok = false; } else setHint(newPasswordHint, '');
  if(pw !== pwConfirm){ setHint(newPasswordConfirmHint, '비밀번호가 일치하지 않아요.'); ok = false; } else setHint(newPasswordConfirmHint, '');
  if(!ok) return;

  submitBtn.disabled = true;
  submitBtn.textContent = '변경 중...';
  try{
    await confirmPasswordReset(auth, oobCode, pw);
    showResult('비밀번호가 변경됐어요. 새 비밀번호로 로그인해주세요.');
  }catch(err){
    setHint(newPasswordHint, '비밀번호 변경에 실패했어요. 링크를 다시 요청해주세요.');
    submitBtn.disabled = false;
    submitBtn.textContent = '비밀번호 변경하기';
  }
});
