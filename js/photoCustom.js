import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { auth, db } from './firebase.js';
import { loadPhotos, loadSelection } from './photoStore.js';
import { formatDateDisplay } from './format.js';

const backBtn = document.getElementById('custom_back_btn');
const printBtn = document.getElementById('custom_print_btn');
const customFrame = document.getElementById('custom_frame');
const customBrand = document.getElementById('custom_brand');
const customNames = document.getElementById('custom_names');
const customDate = document.getElementById('custom_date');
const frameSlotImgs = Array.from(document.querySelectorAll('.frame_slot_img'));

const tabs = Array.from(document.querySelectorAll('.custom_tab'));
const panels = Array.from(document.querySelectorAll('.custom_panel'));
const frameStyleRow = document.getElementById('frame_style_row');
const filterRow = document.getElementById('filter_row');

const savePhotoBtn = document.getElementById('save_photo_btn');
const saveVideoBtn = document.getElementById('save_video_btn');
const qrBtn = document.getElementById('qr_btn');
const printOutput = document.getElementById('print_output');

const FRAME_CLASS_MAP = {
  basic: '',
  mono: 'frame_style_mono',
  gold: 'frame_style_gold',
  blush: 'frame_style_blush',
  rose: 'frame_style_rose',
  sage: 'frame_style_sage',
  champagne: 'frame_style_champagne',
  lavender: 'frame_style_lavender',
  navy: 'frame_style_navy',
  terracotta: 'frame_style_terracotta'
};
const FILTER_CLASS_MAP = {
  coolrose: 'filter_coolrose',
  neutral: 'filter_neutral',
  bright: 'filter_bright',
  rosegold: 'filter_rosegold',
  gold: 'filter_gold',
  amber: 'filter_amber',
  vivid: 'filter_vivid',
  natural: 'filter_natural',
  luminous: 'filter_luminous',
  dramatic: 'filter_dramatic',
  serene: 'filter_serene',
  cozy: 'filter_cozy',
  elegant: 'filter_elegant',
  softmono: 'filter_softmono',
  hardmono: 'filter_hardmono'
};
const FRAME_CANVAS_STYLE = {
  basic: { bg: '#ffffff', border: '#999999', slotBorder: '#999999', text: '#333333' },
  mono: { bg: '#000000', border: '#000000', slotBorder: '#000000', text: '#ffffff' },
  gold: { bg: '#C9A227', border: '#C9A227', slotBorder: '#C9A227', text: '#ffffff' },
  blush: { bg: '#E8B9BE', border: '#E8B9BE', slotBorder: '#E8B9BE', text: '#ffffff' },
  rose: { bg: '#B98080', border: '#B98080', slotBorder: '#B98080', text: '#ffffff' },
  sage: { bg: '#7D8F6E', border: '#7D8F6E', slotBorder: '#7D8F6E', text: '#ffffff' },
  champagne: { bg: '#DCC48C', border: '#DCC48C', slotBorder: '#DCC48C', text: '#ffffff' },
  lavender: { bg: '#C2AEDE', border: '#C2AEDE', slotBorder: '#C2AEDE', text: '#ffffff' },
  navy: { bg: '#22304A', border: '#22304A', slotBorder: '#22304A', text: '#ffffff' },
  terracotta: { bg: '#C1704A', border: '#C1704A', slotBorder: '#C1704A', text: '#ffffff' }
};
const FILTER_CANVAS_VALUE = {
  coolrose: 'saturate(1.1) hue-rotate(-8deg) brightness(1.05) contrast(1.03)',
  neutral: 'contrast(1.02) saturate(0.98)',
  bright: 'brightness(1.15) contrast(1.05) saturate(1.05)',
  rosegold: 'sepia(0.25) saturate(1.3) hue-rotate(-15deg) brightness(1.05)',
  gold: 'sepia(0.35) saturate(1.2) brightness(1.05) hue-rotate(-5deg)',
  amber: 'sepia(0.5) saturate(1.3) brightness(0.98) hue-rotate(-8deg)',
  vivid: 'saturate(1.4) brightness(1.08) contrast(1.08)',
  natural: 'contrast(1.03) brightness(1.02)',
  luminous: 'brightness(1.2) contrast(0.95) saturate(1.05)',
  dramatic: 'contrast(1.3) saturate(1.15) brightness(0.95)',
  serene: 'saturate(0.75) brightness(1.03) hue-rotate(5deg) contrast(0.97)',
  cozy: 'sepia(0.2) saturate(1.1) brightness(1.03) contrast(0.98)',
  elegant: 'saturate(0.85) contrast(1.1)',
  softmono: 'grayscale(1) contrast(0.9) brightness(1.05)',
  hardmono: 'grayscale(1) contrast(1.4) brightness(0.95)'
};

let currentFrameStyle = 'basic';
let currentFilter = 'coolrose';

backBtn.addEventListener('click', ()=>{
  window.location.href = 'photo-select-step1.html';
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

  customBrand.textContent = `Pledge x ${data.company}`;
  customNames.textContent = data.coupleNames;
  customDate.textContent = formatDateDisplay(data.weddingDate);

  const capturedPhotos = await loadPhotos();
  const selectedIndices = loadSelection();

  if(capturedPhotos.length === 0 || selectedIndices.length === 0){
    window.location.href = 'photo-select-step1.html';
    return;
  }

  frameSlotImgs.forEach((img, slotIndex)=>{
    const photoIndex = selectedIndices[slotIndex];
    img.src = photoIndex === undefined ? '' : capturedPhotos[photoIndex];
  });

  await Promise.all(frameSlotImgs.map((img)=> img.src && waitForImageLoad(img)));
  updatePrintPreview();
});

function waitForImageLoad(img){
  if(img.complete) return Promise.resolve();
  return new Promise((resolve)=>{ img.onload = resolve; img.onerror = resolve; });
}

// 탭 전환
tabs.forEach((tab)=>{
  tab.addEventListener('click', ()=>{
    tabs.forEach((t)=>{
      t.classList.toggle('is_active', t === tab);
      t.setAttribute('aria-selected', String(t === tab));
    });
    panels.forEach((panel)=>{
      panel.hidden = panel.dataset.panel !== tab.dataset.tab;
    });
  });
});

// 프레임 스타일 선택
frameStyleRow.addEventListener('click', (e)=>{
  const btn = e.target.closest('.swatch_circle');
  if(!btn) return;

  frameStyleRow.querySelectorAll('.swatch_circle').forEach((el)=> el.classList.remove('is_selected'));
  btn.classList.add('is_selected');

  Object.values(FRAME_CLASS_MAP).forEach((cls)=> cls && customFrame.classList.remove(cls));
  currentFrameStyle = btn.dataset.frame;
  const cls = FRAME_CLASS_MAP[currentFrameStyle];
  if(cls) customFrame.classList.add(cls);
  updatePrintPreview();
});

// 필터 선택
filterRow.addEventListener('click', (e)=>{
  const btn = e.target.closest('.swatch_circle');
  if(!btn) return;

  filterRow.querySelectorAll('.swatch_circle').forEach((el)=> el.classList.remove('is_selected'));
  btn.classList.add('is_selected');

  Object.values(FILTER_CLASS_MAP).forEach((cls)=> cls && frameSlotImgs.forEach((img)=> img.classList.remove(cls)));
  currentFilter = btn.dataset.filter;
  const cls = FILTER_CLASS_MAP[currentFilter];
  if(cls) frameSlotImgs.forEach((img)=> img.classList.add(cls));
  updatePrintPreview();
});

// 지금 화면에 보이는 프레임(사진 4장 + 문구 + 테두리/필터)을 그대로 캔버스에 그려서 이미지 파일로 저장
// Safari는 document.fonts.load()가 실제로 폰트를 받아오지 않고도 완료된 것처럼 구는 버그가 있어서
// 쓰지 않는다 — 대신 화면에 이미 같은 폰트로 글자가 렌더링돼 있으므로(브랜드/이름/날짜) 그걸로
// 이미 로드가 시작돼 있다고 보고 document.fonts.ready만 기다린다
async function renderFrameToCanvas(){
  await document.fonts.ready;

  const SCALE = 3;
  const FRAME_W = 320;
  const PAD_TOP = 28, PAD_X = 16, PAD_BOTTOM = 16;
  const GAP = 8;
  const SLOT_W = (FRAME_W - PAD_X * 2 - GAP) / 2;
  const SLOT_H = SLOT_W * 4 / 3;
  const BRAND_H = 20;
  const CAPTION_MARGIN_TOP = 16;
  const NAMES_LINE_HEIGHT = 42;
  const DATE_LINE_HEIGHT = 24;

  const frameH = PAD_TOP + BRAND_H + GAP + SLOT_H + GAP + SLOT_H + CAPTION_MARGIN_TOP + NAMES_LINE_HEIGHT + DATE_LINE_HEIGHT + PAD_BOTTOM;

  const canvas = document.createElement('canvas');
  canvas.width = FRAME_W * SCALE;
  canvas.height = frameH * SCALE;
  const ctx = canvas.getContext('2d');
  ctx.scale(SCALE, SCALE);

  const style = FRAME_CANVAS_STYLE[currentFrameStyle];

  ctx.fillStyle = style.bg;
  ctx.fillRect(0, 0, FRAME_W, frameH);
  ctx.strokeStyle = style.border;
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, FRAME_W - 1, frameH - 1);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = style.text;
  ctx.font = "700 14px 'Montserrat'";
  ctx.fillText(customBrand.textContent || '', FRAME_W / 2, PAD_TOP + BRAND_H / 2);

  const photoTop = PAD_TOP + BRAND_H + GAP;
  const positions = [
    [PAD_X, photoTop],
    [PAD_X + SLOT_W + GAP, photoTop],
    [PAD_X, photoTop + SLOT_H + GAP],
    [PAD_X + SLOT_W + GAP, photoTop + SLOT_H + GAP]
  ];

  frameSlotImgs.forEach((img, i)=>{
    const [x, y] = positions[i];
    if(img.src){
      ctx.save();
      ctx.filter = FILTER_CANVAS_VALUE[currentFilter];
      ctx.drawImage(img, x, y, SLOT_W, SLOT_H);
      ctx.restore();
    }
    ctx.strokeStyle = style.slotBorder;
    ctx.strokeRect(x + 0.5, y + 0.5, SLOT_W - 1, SLOT_H - 1);
  });

  const captionTop = photoTop + SLOT_H + GAP + SLOT_H + CAPTION_MARGIN_TOP;
  ctx.fillStyle = style.text;
  ctx.font = "300 28px 'Great Vibes'";
  ctx.fillText(customNames.textContent || '', FRAME_W / 2, captionTop + NAMES_LINE_HEIGHT / 2);

  ctx.font = "500 16px 'Playfair Display'";
  ctx.fillText(customDate.textContent || '', FRAME_W / 2, captionTop + NAMES_LINE_HEIGHT + DATE_LINE_HEIGHT / 2);

  return canvas;
}

savePhotoBtn.addEventListener('click', async ()=>{
  savePhotoBtn.disabled = true;
  try{
    const canvas = await renderFrameToCanvas();
    canvas.toBlob((blob)=>{
      if(!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'pledgebooth.png';
      document.body.append(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }, 'image/png');
  } finally {
    savePhotoBtn.disabled = false;
  }
});

saveVideoBtn.addEventListener('click', ()=>{
  alert('영상 저장 기능은 준비 중이에요.');
});

// 프레임/필터가 바뀔 때마다 인쇄용 이미지를 미리 만들어 #print_output에 심어둔다.
// 클릭 시점에 await를 거치면 Safari가 window.print()를 "사용자가 직접 요청한 동작"으로
// 인정하지 않고 막아버리는 경우가 있어서, 미리 준비해두고 클릭하면 바로 print()만 부른다
async function updatePrintPreview(){
  const canvas = await renderFrameToCanvas();
  printOutput.src = canvas.toDataURL('image/png');
}

printBtn.addEventListener('click', ()=>{
  window.print();
});

qrBtn.addEventListener('click', ()=>{
  alert('QR 코드 기능은 준비 중이에요.');
});
