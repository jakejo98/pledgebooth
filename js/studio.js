import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { auth, db } from './firebase.js';
import { formatDateDisplay } from './format.js';

const preview = document.getElementById('camera_preview');
const capturedPhoto = document.getElementById('captured_photo');
const cameraCaption = document.getElementById('camera_caption');
const canvas = document.getElementById('capture_canvas');
const ctx = canvas.getContext('2d');
const hint = document.getElementById('camera_hint');
const closeBtn = document.getElementById('close_btn');
const shutterControls = document.getElementById('camera_controls');
const shutterBtn = document.getElementById('shutter_btn');
const afterControls = document.getElementById('camera_controls_after');
const retakeBtn = document.getElementById('retake_btn');
const downloadBtn = document.getElementById('download_btn');

let coupleNames = '';
let weddingDate = '';

function setHint(msg){ hint.textContent = msg || ''; }

function setCaption(){
  cameraCaption.replaceChildren();
  const line1 = document.createElement('div');
  line1.textContent = coupleNames;
  const line2 = document.createElement('div');
  line2.textContent = formatDateDisplay(weddingDate);
  cameraCaption.append(line1, line2);
}

closeBtn.addEventListener('click', ()=>{
  window.location.href = 'register.html';
});

// 로그인 + 관리자 승인 + 예식 정보 등록까지 끝난 계정만 접근 허용
onAuthStateChanged(auth, async (user)=>{
  if(!user){
    window.location.href = '../index.html';
    return;
  }

  const memberSnap = await getDoc(doc(db, 'member', user.uid));
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

  coupleNames = data.coupleNames;
  weddingDate = data.weddingDate;
  setCaption();

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

function drawCaption(){
  const w = canvas.width;
  const h = canvas.height;
  const barHeight = h * 0.16;

  const gradient = ctx.createLinearGradient(0, h - barHeight, 0, h);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, h - barHeight, w, barHeight);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFDF9';

  const nameSize = Math.round(w * 0.045);
  const dateSize = Math.round(w * 0.028);

  ctx.font = `700 ${nameSize}px Pretendard, sans-serif`;
  ctx.fillText(coupleNames, w / 2, h - barHeight * 0.45);

  ctx.font = `600 ${dateSize}px Pretendard, sans-serif`;
  ctx.fillText(formatDateDisplay(weddingDate), w / 2, h - barHeight * 0.18);
}

shutterBtn.addEventListener('click', ()=>{
  if(!drawVideoFrame()) return;
  drawCaption();

  const dataUrl = canvas.toDataURL('image/png');
  capturedPhoto.src = dataUrl;
  downloadBtn.href = dataUrl;

  preview.hidden = true;
  cameraCaption.hidden = true;
  capturedPhoto.hidden = false;

  shutterControls.hidden = true;
  afterControls.hidden = false;
});

retakeBtn.addEventListener('click', ()=>{
  capturedPhoto.hidden = true;
  preview.hidden = false;
  cameraCaption.hidden = false;

  shutterControls.hidden = false;
  afterControls.hidden = true;
});
