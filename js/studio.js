import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { auth, db } from './firebase.js';
import { savePhotos } from './photoStore.js';

const preview = document.getElementById('camera_preview');
const canvas = document.getElementById('capture_canvas');
const ctx = canvas.getContext('2d');
const hint = document.getElementById('camera_hint');
const closeBtn = document.getElementById('close_btn');
const shutterBtn = document.getElementById('shutter_btn');
const captureFlash = document.getElementById('capture_flash');

const timerControl = document.querySelector('.timer_control');
const timerBtn = document.getElementById('timer_btn');
const timerLabel = document.getElementById('timer_label');
const timerMenu = document.getElementById('timer_menu');
const timerOptions = Array.from(document.querySelectorAll('.timer_option'));
const pauseBtn = document.getElementById('pause_btn');
const pauseIcon = pauseBtn.querySelector('.icon_pause');
const playIcon = pauseBtn.querySelector('.icon_play');
const countdownOverlay = document.getElementById('countdown_overlay');
const countdownNumber = document.getElementById('countdown_number');
const shotCounter = document.getElementById('shot_counter');

const TOTAL_SHOTS = 6;

let selectedSeconds = 5;
let remainingSeconds = 0;
let countdownIntervalId = null;
let isCountingDown = false;
let isPaused = false;

let shotIndex = 0;
let capturedPhotos = [];

function setHint(msg){ hint.textContent = msg || ''; }

closeBtn.addEventListener('click', ()=>{
  window.location.href = 'register.html';
});

// 로그인 + 관리자 승인 + 예식 정보 등록까지 끝난 계정만 접근 허용
onAuthStateChanged(auth, async (user)=>{
  if(!user){
    window.location.href = '../index.html';
    return;
  }

  const memberSnap = await getDoc(doc(db, 'user_account_list', user.uid));
  const data = memberSnap.exists() ? memberSnap.data() : null;

  if(!data || data.status !== '인증'){
    await signOut(auth);
    window.location.href = '../index.html';
    return;
  }

  if(!data.coupleNames || !data.weddingDate){
    window.location.href = 'register.html';
    return;
  }

  initCamera();
});

// 별도 안내 화면 없이 바로 카메라를 요청 — 브라우저 자체 권한 팝업만 뜨고 나면 곧장 촬영 화면
async function initCamera(){
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
    setHint('이 브라우저에서는 카메라를 사용할 수 없어요.');
    return;
  }

  try{
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
    preview.srcObject = stream;
    shutterBtn.disabled = false;
  }catch(err){
    setHint('카메라 권한이 필요해요. 브라우저 설정에서 카메라 접근을 허용해주세요.');
  }
}

// 크롭 없이 카메라 원본 해상도 그대로 캡처 (실제 카메라 앱과 동일)
function drawVideoFrame(){
  const vw = preview.videoWidth;
  const vh = preview.videoHeight;
  if(!vw || !vh) return false;

  canvas.width = vw;
  canvas.height = vh;

  ctx.save();
  ctx.translate(vw, 0);
  ctx.scale(-1, 1); // 미러링된 프리뷰와 동일하게 좌우 반전
  ctx.drawImage(preview, 0, 0, vw, vh);
  ctx.restore();

  return true;
}

// 셔터가 눌리는 순간 화면이 하얗게 번쩍 — 촬영됐다는 걸 눈으로 바로 인식하도록
function triggerFlash(){
  captureFlash.classList.remove('is_flashing');
  void captureFlash.offsetWidth; // 리플로우를 강제해 연속 촬영에서도 매번 애니메이션이 재생되게 함
  captureFlash.classList.add('is_flashing');
}

// 6장을 다 찍을 때까지 장마다 카운트다운 → 촬영을 반복
function capturePhoto(){
  if(!drawVideoFrame()) return;
  triggerFlash();

  capturedPhotos.push(canvas.toDataURL('image/png'));
  shotIndex++;

  if(shotIndex < TOTAL_SHOTS){
    setTimeout(startCountdown, 600);
  }else{
    finishSequence();
  }
}

// 6장 촬영이 끝나면 사진들을 들고 선택 페이지로 이동
async function finishSequence(){
  shotCounter.hidden = true;
  shutterBtn.disabled = false;
  timerBtn.disabled = false;

  await savePhotos(capturedPhotos);
  window.location.href = 'photo-select-step1.html';
}

function setPauseIcon(paused){
  pauseIcon.classList.toggle('is_hidden', paused);
  playIcon.classList.toggle('is_hidden', !paused);
  pauseBtn.setAttribute('aria-label', paused ? '재생' : '일시정지');
}

function updateCountdownDisplay(){
  countdownNumber.textContent = remainingSeconds;
}

function updateShotCounter(){
  shotCounter.textContent = `${shotIndex + 1} / ${TOTAL_SHOTS}`;
  shotCounter.hidden = false;
}

function countdownTick(){
  remainingSeconds--;
  if(remainingSeconds <= 0){
    clearInterval(countdownIntervalId);
    countdownIntervalId = null;
    stopCountdownUI();
    capturePhoto();
    return;
  }
  updateCountdownDisplay();
}

function startCountdown(){
  if(isCountingDown) return;
  isCountingDown = true;
  isPaused = false;
  remainingSeconds = selectedSeconds;

  shutterBtn.disabled = true;
  timerBtn.disabled = true;
  pauseBtn.disabled = false;
  setPauseIcon(false);

  updateShotCounter();
  countdownOverlay.hidden = false;
  updateCountdownDisplay();
  countdownIntervalId = setInterval(countdownTick, 1000);
}

// 카운트다운 UI만 정리 — 셔터/타이머 버튼은 연속 촬영이 끝날 때까지 계속 잠궈둠
function stopCountdownUI(){
  isCountingDown = false;
  isPaused = false;
  countdownOverlay.hidden = true;
  pauseBtn.disabled = true;
  setPauseIcon(false);
}

shutterBtn.addEventListener('click', startCountdown);

pauseBtn.addEventListener('click', ()=>{
  if(!isCountingDown) return;

  if(isPaused){
    isPaused = false;
    setPauseIcon(false);
    countdownIntervalId = setInterval(countdownTick, 1000);
  }else{
    isPaused = true;
    setPauseIcon(true);
    clearInterval(countdownIntervalId);
    countdownIntervalId = null;
  }
});

timerBtn.addEventListener('click', ()=>{
  const willOpen = timerMenu.hidden;
  timerMenu.hidden = !willOpen;
  timerBtn.setAttribute('aria-expanded', String(willOpen));
});

timerOptions.forEach((option)=>{
  option.addEventListener('click', ()=>{
    selectedSeconds = Number(option.dataset.seconds);
    timerLabel.textContent = `${selectedSeconds}초`;
    timerOptions.forEach((o)=> o.classList.toggle('is_selected', o === option));
    timerMenu.hidden = true;
    timerBtn.setAttribute('aria-expanded', 'false');
  });
});

document.addEventListener('click', (e)=>{
  if(!timerMenu.hidden && !timerControl.contains(e.target)){
    timerMenu.hidden = true;
    timerBtn.setAttribute('aria-expanded', 'false');
  }
});
