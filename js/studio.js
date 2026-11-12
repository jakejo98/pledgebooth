import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { auth, db } from './firebase.js';
import { savePhotos, saveClips } from './photoStore.js';

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
const CLIP_MAX_DIMENSION = 960; // 영상은 사진보다 무거워서 적당히 해상도 제한

let selectedSeconds = 5;
let remainingSeconds = 0;
let countdownIntervalId = null;
let isCountingDown = false;
let isPaused = false;

let shotIndex = 0;
let capturedPhotos = [];
let capturedClips = [];
let clipPromises = [];
let currentClipSession = null;

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

    // videoWidth/videoHeight(=메타데이터)가 준비돼야 사진/영상 캡처가 가능하므로,
    // 스트림이 붙었다고 바로 셔터를 켜면 첫 촬영에서만 폭/높이가 0이라 녹화가 비어버릴 수 있다
    if(preview.readyState < 1){
      await new Promise((resolve)=> preview.addEventListener('loadedmetadata', resolve, { once: true }));
    }

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

// 'video/mp4'를 코덱 지정 없이 쓰면 브라우저가 그 안에 VP9 같은 걸 넣어버릴 수도 있어서
// (Safari는 못 열고, WebCodecs 디코딩도 불안정함) mp4는 반드시 H.264(avc1)로 명시한다
function pickVideoMimeType(){
  const candidates = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  for(const type of candidates){
    if(window.MediaRecorder && MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

// 프리뷰 화면과 똑같이(좌우 반전) 보이는 영상을 녹화한다.
// MediaRecorder로 카메라 스트림을 그대로 녹화하면 미리보기와 달리 반전이 안 된 원본이 찍히므로,
// 사진 캡처와 동일하게 매 프레임을 좌우 반전해서 그린 캔버스를 녹화 소스로 쓴다.
//
// 녹화는 "사진을 찍은 다음"이 아니라 그 샷의 카운트다운이 시작되는 순간 바로 시작해서,
// 셔터가 눌리는 순간(카운트다운이 끝나는 순간) 바로 멈춘다. 이렇게 하면:
// - 클립 길이가 항상 카운트다운 길이(=타이머로 고른 초)와 정확히 같아지고
// - 일시정지(pauseBtn)해도 recorder.pause()/resume()로 같이 멈춰서 길이가 안 틀어지고
// - 셔터를 누른 뒤에 영상이 끝나길 기다리는 시간이 전혀 없어진다(바로 다음 샷/다음 페이지로 진행 가능)
function beginClipRecording(){
  try{
    const vw = preview.videoWidth;
    const vh = preview.videoHeight;
    const mimeType = pickVideoMimeType();
    if(!vw || !vh || !mimeType || !HTMLCanvasElement.prototype.captureStream){
      return null;
    }

    const scale = Math.min(1, CLIP_MAX_DIMENSION / Math.max(vw, vh));
    const cw = Math.round(vw * scale);
    const ch = Math.round(vh * scale);

    const recordCanvas = document.createElement('canvas');
    recordCanvas.width = cw;
    recordCanvas.height = ch;
    const rctx = recordCanvas.getContext('2d');

    const stream = recordCanvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks = [];
    recorder.ondataavailable = (e)=>{ if(e.data.size > 0) chunks.push(e.data); };

    const session = { recorder, chunks, mimeType, rafId: null };

    function drawMirroredFrame(){
      rctx.save();
      rctx.translate(cw, 0);
      rctx.scale(-1, 1);
      rctx.drawImage(preview, 0, 0, cw, ch);
      rctx.restore();
      session.rafId = requestAnimationFrame(drawMirroredFrame);
    }

    recorder.start();
    drawMirroredFrame();

    return session;
  }catch(err){
    return null;
  }
}

function pauseClipRecording(session){
  try{
    if(session && session.recorder.state === 'recording') session.recorder.pause();
  }catch(err){ /* 일시정지만 못 되는 거라 치명적이지 않음 */ }
}

function resumeClipRecording(session){
  try{
    if(session && session.recorder.state === 'paused') session.recorder.resume();
  }catch(err){ /* 녹화 재개만 못 되는 거라 치명적이지 않음 */ }
}

// 여기서 뭔가 하나라도 터지면(동기 에러든, stop()이 늦게 불려서 생기는 에러든) 이 Promise가
// 영영 안 끝나버리고, 그걸 기다리는 쪽이 멈춰서 결과적으로 촬영 전체가 중간에 먹통이 되는 걸
// 겪었다. 그래서 절대로 reject/행(hang)하지 않고 항상(실패하면 null로) resolve로 끝나도록
// 방어적으로 감싼다.
function endClipRecording(session){
  return new Promise((resolve)=>{
    if(!session){ resolve(null); return; }

    let settled = false;
    let safetyTimeoutId = null;
    function finish(result){
      if(settled) return;
      settled = true;
      if(safetyTimeoutId) clearTimeout(safetyTimeoutId);
      if(session.rafId) cancelAnimationFrame(session.rafId);
      resolve(result);
    }

    // 혹시라도 onstop/onerror가 영영 안 불리는 경우를 대비한 최후의 안전장치
    safetyTimeoutId = setTimeout(()=> finish(null), 3000);

    try{
      session.recorder.onstop = ()=> finish(new Blob(session.chunks, { type: session.mimeType }));
      session.recorder.onerror = ()=> finish(null);

      if(session.recorder.state !== 'inactive') session.recorder.stop();
      else finish(new Blob(session.chunks, { type: session.mimeType }));
    }catch(err){
      finish(null);
    }
  });
}

// 6장을 다 찍을 때까지 장마다 카운트다운 → 촬영(사진 + 짧은 영상)을 반복.
// 영상 녹화는 카운트다운이 시작될 때 이미 시작돼 있으므로(startCountdown 참고), 여기서는
// 그 녹화를 멈추고 결과를 받아오기만 하면 된다 — 셔터를 누른 뒤에 영상 때문에 기다리는 시간이 없다.
function capturePhoto(){
  if(!drawVideoFrame()) return;
  triggerFlash();

  capturedPhotos.push(canvas.toDataURL('image/png'));
  const clipIndex = capturedPhotos.length - 1;

  const session = currentClipSession;
  currentClipSession = null;

  // endClipRecording은 항상 resolve로 끝나게 만들어뒀지만, 혹시 모를 다른 에러로 여기서
  // 멈추면 촬영 전체가 먹통이 되므로 한 번 더 감싸서 무조건 null로라도 끝나게 한다
  const clipPromise = endClipRecording(session)
    .catch(()=> null)
    .then((clip)=>{ capturedClips[clipIndex] = clip; });
  clipPromises.push(clipPromise);

  shotIndex++;

  if(shotIndex < TOTAL_SHOTS){
    setTimeout(startCountdown, 300);
  }else{
    finishSequence();
  }
}

// 6장 촬영이 끝나면 사진/영상들을 들고 선택 페이지로 이동.
// 녹화가 셔터 타이밍에 이미 끝나있어서 보통은 거의 바로 넘어가지만, 만약을 위해
// 클립들이 실제로 다 정리됐는지 한 번 더 확인하고 저장한다. 곧바로 페이지를 떠나므로
// 셔터/타이머 버튼은 다시 켜지 않는다
async function finishSequence(){
  shotCounter.hidden = true;

  await Promise.all(clipPromises);

  await savePhotos(capturedPhotos);
  await saveClips(capturedClips);
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

  // 이 샷의 영상 녹화를 카운트다운과 같이 시작 — 셔터가 눌리는 순간(카운트다운 종료)에 멈춘다
  currentClipSession = beginClipRecording();
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
    resumeClipRecording(currentClipSession);
  }else{
    isPaused = true;
    setPauseIcon(true);
    clearInterval(countdownIntervalId);
    countdownIntervalId = null;
    pauseClipRecording(currentClipSession);
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
