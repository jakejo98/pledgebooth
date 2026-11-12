import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { auth, db } from './firebase.js';
import { loadPhotos, loadClips, loadSelection } from './photoStore.js';
import { formatDateDisplay } from './format.js';
import {
  Input, ALL_FORMATS, BlobSource, VideoSampleSink,
  Output, Mp4OutputFormat, BufferTarget, CanvasSource, QUALITY_MEDIUM,
} from 'https://cdn.jsdelivr.net/npm/mediabunny@1.65.2/dist/bundles/mediabunny.min.mjs';

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
const frameUploadBtn = document.getElementById('frame_upload_btn');
const frameUploadInput = document.getElementById('frame_upload_input');

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
let selectedClips = []; // 선택된 4컷과 같은 순서의 영상 클립 — "영상 저장" 때만 쓰인다

// 직접 업로드한 커스텀 프레임 배경 — id별로 원본(dataURL)과, 캔버스에 그릴 때 쓸
// 로드된 Image 엘리먼트를 따로 들고 있는다
let customFrameCounter = 0;
const customFrameImages = {};
const customFrameImageEls = {};
// 커스텀 프레임별 글자색 — 배경이 밝아서 흰 글자가 안 보일 것 같으면 #333
const customFrameTextColors = {};

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

  customBrand.textContent = 'Pledge';
  customNames.textContent = data.coupleNames;
  customDate.textContent = formatDateDisplay(data.weddingDate);

  const capturedPhotos = await loadPhotos();
  const capturedClips = await loadClips();
  const selectedIndices = loadSelection();

  if(capturedPhotos.length === 0 || selectedIndices.length === 0){
    window.location.href = 'photo-select-step1.html';
    return;
  }

  // 화면/사진 저장은 기본적으로 정지 사진만 사용 — 영상은 "영상 저장"을 눌렀을 때만 쓴다
  frameSlotImgs.forEach((img, slotIndex)=>{
    const photoIndex = selectedIndices[slotIndex];
    img.src = photoIndex === undefined ? '' : capturedPhotos[photoIndex];
  });
  selectedClips = selectedIndices.map((photoIndex)=> capturedClips[photoIndex]);

  await Promise.all(frameSlotImgs.map((img)=> img.src && waitForImageLoad(img)));
  updatePrintPreview();
});

function waitForImageLoad(img){
  if(img.complete) return Promise.resolve();
  return new Promise((resolve)=>{ img.onload = resolve; img.onerror = resolve; });
}

function waitForVideoReady(video){
  if(video.readyState >= 2) return Promise.resolve();
  return new Promise((resolve)=>{
    video.addEventListener('loadeddata', resolve, { once: true });
    video.addEventListener('error', resolve, { once: true });
  });
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

// 프레임 스타일 선택 ("+" 업로드 버튼은 별도 핸들러에서 처리하므로 여기선 건너뜀)
frameStyleRow.addEventListener('click', (e)=>{
  const btn = e.target.closest('.swatch_circle');
  if(!btn || btn === frameUploadBtn) return;

  frameStyleRow.querySelectorAll('.swatch_circle').forEach((el)=> el.classList.remove('is_selected'));
  btn.classList.add('is_selected');

  Object.values(FRAME_CLASS_MAP).forEach((cls)=> cls && customFrame.classList.remove(cls));
  customFrame.classList.remove('frame_style_custom', 'frame_text_dark');
  customFrame.style.backgroundImage = '';
  currentFrameStyle = btn.dataset.frame;

  if(currentFrameStyle.startsWith('custom-')){
    customFrame.classList.add('frame_style_custom');
    customFrame.classList.toggle('frame_text_dark', customFrameTextColors[currentFrameStyle] === '#333333');
    customFrame.style.backgroundImage = `url(${customFrameImages[currentFrameStyle]})`;
  }else{
    const cls = FRAME_CLASS_MAP[currentFrameStyle];
    if(cls) customFrame.classList.add(cls);
  }
  updatePrintPreview();
});

// "+" 버튼 → 파일 선택창 열기
frameUploadBtn.addEventListener('click', ()=>{
  frameUploadInput.click();
});

// 이미지를 작게 그려서 픽셀 평균을 내는 방식으로 대표(메인) 색상을 뽑는다
function getAverageColor(img){
  const SAMPLE = 32;
  const c = document.createElement('canvas');
  c.width = SAMPLE;
  c.height = SAMPLE;
  const cctx = c.getContext('2d');
  cctx.drawImage(img, 0, 0, SAMPLE, SAMPLE);

  const { data } = cctx.getImageData(0, 0, SAMPLE, SAMPLE);
  let r = 0, g = 0, b = 0, count = 0;
  for(let i = 0; i < data.length; i += 4){
    r += data[i]; g += data[i + 1]; b += data[i + 2];
    count++;
  }
  r = Math.round(r / count); g = Math.round(g / count); b = Math.round(b / count);
  return `rgb(${r}, ${g}, ${b})`;
}

// 글자가 놓이는 영역(브랜드 줄, 이름/날짜 줄)만 프레임과 같은 방식(cover)으로 잘라서 밝기를 재고,
// 밝은 배경이면 흰 글자가 묻히므로 #333을 쓴다. 기준 좌표는 저장 캔버스(320 x 536)와 동일
function getFrameTextColor(img){
  const W = 320, H = 536;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const cctx = c.getContext('2d', { willReadFrequently: true });
  // 투명 PNG는 투명 픽셀이 검정(0,0,0)으로 읽혀서 어둡다고 오판한다 —
  // 실제 화면/저장본처럼 흰 바탕 위에 깔고 잰다
  cctx.fillStyle = '#ffffff';
  cctx.fillRect(0, 0, W, H);
  drawCoverImage(cctx, img, 0, 0, W, H);

  // [y, height] — 브랜드(28~48), 이름+날짜(454~520)
  const regions = [[28, 20], [454, 66]];
  let lumSum = 0, count = 0;
  regions.forEach(([y, h])=>{
    const { data } = cctx.getImageData(40, y, W - 80, h);
    for(let i = 0; i < data.length; i += 4){
      lumSum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      count++;
    }
  });
  const avgLum = lumSum / count / 255;
  return avgLum > 0.6 ? '#333333' : '#ffffff';
}

// 사진을 고르면 새 스와치로 추가하고 바로 프레임에 적용.
// 스와치 자체는 사진 썸네일이 아니라, 다른 스와치들처럼 이미지의 메인 색상으로 꽉 채운 단색 원으로 보여준다
frameUploadInput.addEventListener('change', ()=>{
  const file = frameUploadInput.files[0];
  frameUploadInput.value = '';
  if(!file) return;

  const reader = new FileReader();
  reader.onload = ()=>{
    const dataUrl = reader.result;
    const customNumber = ++customFrameCounter;
    const id = `custom-${customNumber}`;
    customFrameImages[id] = dataUrl;

    const img = new Image();
    img.onload = ()=>{
      customFrameImageEls[id] = img;
      const mainColor = getAverageColor(img);
      customFrameTextColors[id] = getFrameTextColor(img);

      const item = document.createElement('div');
      item.className = 'swatch_item';
      item.innerHTML = `
        <button type="button" class="swatch_circle swatch_custom" data-frame="${id}" aria-label="커스텀${customNumber}" style="background-color:${mainColor}"></button>
        <span class="swatch_item_label">커스텀${customNumber}</span>
      `;
      frameUploadBtn.closest('.swatch_item').before(item);

      frameStyleRow.querySelectorAll('.swatch_circle').forEach((el)=> el.classList.remove('is_selected'));
      item.querySelector('.swatch_circle').classList.add('is_selected');

      Object.values(FRAME_CLASS_MAP).forEach((cls)=> cls && customFrame.classList.remove(cls));
      currentFrameStyle = id;
      customFrame.classList.add('frame_style_custom');
      customFrame.classList.toggle('frame_text_dark', customFrameTextColors[id] === '#333333');
      customFrame.style.backgroundImage = `url(${dataUrl})`;
      updatePrintPreview();
    };
    img.src = dataUrl;
  };
  reader.readAsDataURL(file);
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

// object-fit:cover와 동일하게, 이미지 비율을 유지한 채 대상 영역을 가득 채워서 그린다
function drawCoverImage(ctx, img, dx, dy, dWidth, dHeight){
  const scale = Math.max(dWidth / img.width, dHeight / img.height);
  const sw = dWidth / scale;
  const sh = dHeight / scale;
  const sx = (img.width - sw) / 2;
  const sy = (img.height - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dWidth, dHeight);
}

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
  const SLOT_H = Math.round(SLOT_W * 4 / 3); // 3:4 비율 유지하되 소수점 없는 정수로 반올림
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

  const isCustom = currentFrameStyle.startsWith('custom-');
  const style = isCustom
    ? { border: null, slotBorder: null, text: customFrameTextColors[currentFrameStyle] || '#ffffff' }
    : FRAME_CANVAS_STYLE[currentFrameStyle];

  if(isCustom && customFrameImageEls[currentFrameStyle]){
    ctx.fillStyle = '#ffffff'; // 투명 PNG 프레임은 미리보기처럼 흰 바탕 위에 보이도록
    ctx.fillRect(0, 0, FRAME_W, frameH);
    drawCoverImage(ctx, customFrameImageEls[currentFrameStyle], 0, 0, FRAME_W, frameH);
  }else{
    ctx.fillStyle = isCustom ? '#ffffff' : style.bg;
    ctx.fillRect(0, 0, FRAME_W, frameH);
  }
  if(style.border){
    ctx.strokeStyle = style.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, FRAME_W - 1, frameH - 1);
  }

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
    if(style.slotBorder){
      ctx.strokeStyle = style.slotBorder;
      ctx.strokeRect(x + 0.5, y + 0.5, SLOT_W - 1, SLOT_H - 1);
    }
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

// 이 브라우저가 캔버스 애니메이션을 녹화할 수 있는지 (iOS Safari는 14.1+에서 지원)
function supportsVideoRecording(){
  return !!(window.MediaRecorder && HTMLCanvasElement.prototype.captureStream);
}

// WebCodecs(VideoEncoder/VideoDecoder)가 있으면 클립을 실제 재생 없이 프레임 단위로 바로
// 디코딩·인코딩할 수 있어서 훨씬 빠르다. 없는 구형 브라우저에서는 실시간 재생 녹화로 대체한다
function supportsFastEncoding(){
  return !!(window.VideoEncoder && window.VideoDecoder);
}

// MediaRecorder가 받아줄 수 있는 포맷 중 가장 호환성 좋은 걸 고른다.
// Safari는 webm을 못 받고 mp4(h264)만 받으므로 mp4를 먼저 시도하는데, 코덱 지정 없이 그냥
// 'video/mp4'만 쓰면 브라우저가 그 안에 VP9을 넣어버릴 수도 있어서 반드시 avc1로 명시한다
function pickVideoMimeType(){
  const candidates = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  for(const type of candidates){
    if(MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

// "영상 저장"을 누르면 먼저 WebCodecs 기반의 빠른 방식(recordFrameVideoFast)을 시도하고,
// 지원하지 않거나 중간에 실패하면 항상 되는 실시간 재생 녹화(recordFrameVideoRealtime)로 대체한다
async function recordFrameVideo(){
  if(supportsFastEncoding()){
    try{
      return await recordFrameVideoFast();
    }catch(err){
      // 코덱/디코딩 문제 등으로 빠른 경로가 실패해도 조용히 실시간 녹화로 넘어간다
    }
  }
  return recordFrameVideoRealtime();
}

// 선택된 4개 클립을 mediabunny(WebCodecs)로 열어서 실시간 재생 없이 프레임을 순서대로 바로
// 디코딩하고, 합성한 프레임을 바로 인코딩한다 — 영상 길이만큼 실제 시간이 걸리지 않는다
async function recordFrameVideoFast(){
  await document.fonts.ready;

  const SCALE = 3;
  const FRAME_W = 320;
  const PAD_TOP = 28, PAD_X = 16, PAD_BOTTOM = 16;
  const GAP = 8;
  const SLOT_W = (FRAME_W - PAD_X * 2 - GAP) / 2;
  const SLOT_H = Math.round(SLOT_W * 4 / 3);
  const BRAND_H = 20;
  const CAPTION_MARGIN_TOP = 16;
  const NAMES_LINE_HEIGHT = 42;
  const DATE_LINE_HEIGHT = 24;
  const frameH = PAD_TOP + BRAND_H + GAP + SLOT_H + GAP + SLOT_H + CAPTION_MARGIN_TOP + NAMES_LINE_HEIGHT + DATE_LINE_HEIGHT + PAD_BOTTOM;

  const canvas = document.createElement('canvas');
  canvas.width = FRAME_W * SCALE;
  canvas.height = frameH * SCALE;
  const ctx = canvas.getContext('2d');

  const isCustom = currentFrameStyle.startsWith('custom-');
  const style = isCustom
    ? { border: null, slotBorder: null, text: customFrameTextColors[currentFrameStyle] || '#ffffff' }
    : FRAME_CANVAS_STYLE[currentFrameStyle];

  const photoTop = PAD_TOP + BRAND_H + GAP;
  const positions = [
    [PAD_X, photoTop],
    [PAD_X + SLOT_W + GAP, photoTop],
    [PAD_X, photoTop + SLOT_H + GAP],
    [PAD_X + SLOT_W + GAP, photoTop + SLOT_H + GAP]
  ];
  const captionTop = photoTop + SLOT_H + GAP + SLOT_H + CAPTION_MARGIN_TOP;

  // 클립을 하나씩 열어서(디코딩 가능 여부까지 확인) 길이를 얻어둔다.
  // 브라우저/기기에 따라 녹화된 코덱(특히 VP9)을 WebCodecs로 디코딩 못 하는 경우가 있는데,
  // 그걸 조용히 빈 슬롯으로 넘기면 그 클립 길이가 통째로 빠져서 영상이 짧아지거나 비게 된다.
  // 그래서 하나라도 디코딩에 실패하면 이 빠른 경로 자체를 실패시켜서 실시간 녹화로 통째로 넘긴다
  const openResults = await Promise.all(selectedClips.map(async (clip)=>{
    if(!clip) return { ok: true, data: null };
    try{
      const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(clip) });
      const track = await input.getPrimaryVideoTrack();
      if(!track || !(await track.canDecode())){ input.dispose(); return { ok: false }; }
      const duration = await track.computeDuration();
      const sink = new VideoSampleSink(track);
      return { ok: true, data: { input, sink, duration } };
    }catch(err){
      return { ok: false };
    }
  }));

  if(openResults.some((r)=> !r.ok)){
    openResults.forEach((r)=>{ if(r.ok && r.data) r.data.input.dispose(); });
    throw new Error('clip not decodable via WebCodecs');
  }

  const openClips = openResults.map((r)=> r.data);

  try{
    const durations = openClips.map((c)=> c ? c.duration : 0);
    const totalSeconds = Math.max(...durations, 1);
    const FPS = 30;
    const frameCount = Math.max(1, Math.round(totalSeconds * FPS));

    // 클립마다 "지금 시점에 보여줄 샘플"을 되감지 않고 순서대로만 따라가는 커서.
    // 매 프레임 getSample(t)로 매번 새로 찾기보다 훨씬 빠르다(순차 디코딩).
    // 샘플을 바로 캔버스에 그리는 대신 ImageBitmap으로 한 번 변환해두고 그걸 그리는 게
    // (WebCodecs VideoFrame을 매 프레임 직접 drawImage하는 것보다) 훨씬 빠르다
    const cursors = await Promise.all(openClips.map(async (c)=>{
      if(!c) return null;
      const iterator = c.sink.samples(0, c.duration)[Symbol.asyncIterator]();
      let current = null;
      let currentBitmap = null;
      let next = await iterator.next();
      return {
        duration: c.duration,
        async advanceTo(t){
          let changed = false;
          while(!next.done && next.value.timestamp <= t){
            if(current) current.close();
            current = next.value;
            next = await iterator.next();
            changed = true;
          }
          if(changed && current){
            if(currentBitmap) currentBitmap.close();
            currentBitmap = await createImageBitmap(current.toCanvasImageSource());
          }
          return currentBitmap;
        },
        close(){
          if(current) current.close();
          if(currentBitmap) currentBitmap.close();
          if(next && !next.done) next.value.close();
          if(iterator.return) iterator.return();
        }
      };
    }));

    const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() });
    const videoSource = new CanvasSource(canvas, { codec: 'avc', quality: QUALITY_MEDIUM });
    output.addVideoTrack(videoSource);
    await output.start();

    function drawFrame(bitmaps){
      ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
      ctx.clearRect(0, 0, FRAME_W, frameH);

      if(isCustom && customFrameImageEls[currentFrameStyle]){
        ctx.fillStyle = '#ffffff'; // 투명 PNG 프레임은 미리보기처럼 흰 바탕 위에 보이도록
        ctx.fillRect(0, 0, FRAME_W, frameH);
        drawCoverImage(ctx, customFrameImageEls[currentFrameStyle], 0, 0, FRAME_W, frameH);
      }else{
        ctx.fillStyle = isCustom ? '#ffffff' : style.bg;
        ctx.fillRect(0, 0, FRAME_W, frameH);
      }
      if(style.border){
        ctx.strokeStyle = style.border;
        ctx.lineWidth = 1;
        ctx.strokeRect(0.5, 0.5, FRAME_W - 1, frameH - 1);
      }

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = style.text;
      ctx.font = "700 14px 'Montserrat'";
      ctx.fillText(customBrand.textContent || '', FRAME_W / 2, PAD_TOP + BRAND_H / 2);

      bitmaps.forEach((bitmap, i)=>{
        const [x, y] = positions[i];
        if(bitmap){
          ctx.save();
          ctx.filter = FILTER_CANVAS_VALUE[currentFilter];
          ctx.drawImage(bitmap, x, y, SLOT_W, SLOT_H);
          ctx.restore();
        }
        if(style.slotBorder){
          ctx.strokeStyle = style.slotBorder;
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 0.5, y + 0.5, SLOT_W - 1, SLOT_H - 1);
        }
      });

      ctx.fillStyle = style.text;
      ctx.font = "300 28px 'Great Vibes'";
      ctx.fillText(customNames.textContent || '', FRAME_W / 2, captionTop + NAMES_LINE_HEIGHT / 2);

      ctx.font = "500 16px 'Playfair Display'";
      ctx.fillText(customDate.textContent || '', FRAME_W / 2, captionTop + NAMES_LINE_HEIGHT + DATE_LINE_HEIGHT / 2);
    }

    for(let i = 0; i < frameCount; i++){
      const t = i / FPS;
      const bitmaps = await Promise.all(cursors.map((cur)=> cur ? cur.advanceTo(Math.min(t, cur.duration)) : null));
      drawFrame(bitmaps);
      await videoSource.add(t, 1 / FPS);
    }

    cursors.forEach((cur)=> cur && cur.close());

    await output.finalize();
    return new Blob([output.target.buffer], { type: 'video/mp4' });
  } finally {
    openClips.forEach((c)=> c && c.input.dispose());
  }
}

// 화면에는 항상 정지 사진만 보여주다가, "영상 저장"을 누른 이 순간에만 화면 밖에 임시
// video 엘리먼트 4개를 띄워 재생시키고, 그걸 프레임(테두리/필터/문구)과 함께 캔버스에
// 그려서 하나의 영상으로 녹화한다. 녹화 길이는 촬영 당시 타이머로 찍힌 클립 길이 그대로.
// (WebCodecs를 못 쓰는 구형 브라우저를 위한 대체 경로)
async function recordFrameVideoRealtime(){
  await document.fonts.ready;

  const SCALE = 3;
  const FRAME_W = 320;
  const PAD_TOP = 28, PAD_X = 16, PAD_BOTTOM = 16;
  const GAP = 8;
  const SLOT_W = (FRAME_W - PAD_X * 2 - GAP) / 2;
  const SLOT_H = Math.round(SLOT_W * 4 / 3);
  const BRAND_H = 20;
  const CAPTION_MARGIN_TOP = 16;
  const NAMES_LINE_HEIGHT = 42;
  const DATE_LINE_HEIGHT = 24;
  const frameH = PAD_TOP + BRAND_H + GAP + SLOT_H + GAP + SLOT_H + CAPTION_MARGIN_TOP + NAMES_LINE_HEIGHT + DATE_LINE_HEIGHT + PAD_BOTTOM;

  const canvas = document.createElement('canvas');
  canvas.width = FRAME_W * SCALE;
  canvas.height = frameH * SCALE;
  const ctx = canvas.getContext('2d');

  const isCustom = currentFrameStyle.startsWith('custom-');
  const style = isCustom
    ? { border: null, slotBorder: null, text: customFrameTextColors[currentFrameStyle] || '#ffffff' }
    : FRAME_CANVAS_STYLE[currentFrameStyle];

  const photoTop = PAD_TOP + BRAND_H + GAP;
  const positions = [
    [PAD_X, photoTop],
    [PAD_X + SLOT_W + GAP, photoTop],
    [PAD_X, photoTop + SLOT_H + GAP],
    [PAD_X + SLOT_W + GAP, photoTop + SLOT_H + GAP]
  ];
  const captionTop = photoTop + SLOT_H + GAP + SLOT_H + CAPTION_MARGIN_TOP;

  // 화면 밖(안 보이는 곳)에서 재생되는 임시 video 엘리먼트 — 평소 화면에는 등장하지 않는다
  const tempVideos = selectedClips.map((clip)=>{
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.style.position = 'fixed';
    video.style.left = '-9999px';
    video.style.width = '1px';
    video.style.height = '1px';
    if(clip) video.src = URL.createObjectURL(clip);
    document.body.append(video);
    return video;
  });

  await Promise.all(tempVideos.map((video)=> video.src && waitForVideoReady(video)));
  await Promise.all(tempVideos.map((video)=> video.src ? video.play().catch(()=>{}) : null));

  function drawFrame(){
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.clearRect(0, 0, FRAME_W, frameH);

    if(isCustom && customFrameImageEls[currentFrameStyle]){
      ctx.fillStyle = '#ffffff'; // 투명 PNG 프레임은 미리보기처럼 흰 바탕 위에 보이도록
      ctx.fillRect(0, 0, FRAME_W, frameH);
      drawCoverImage(ctx, customFrameImageEls[currentFrameStyle], 0, 0, FRAME_W, frameH);
    }else{
      ctx.fillStyle = isCustom ? '#ffffff' : style.bg;
      ctx.fillRect(0, 0, FRAME_W, frameH);
    }
    if(style.border){
      ctx.strokeStyle = style.border;
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, FRAME_W - 1, frameH - 1);
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = style.text;
    ctx.font = "700 14px 'Montserrat'";
    ctx.fillText(customBrand.textContent || '', FRAME_W / 2, PAD_TOP + BRAND_H / 2);

    tempVideos.forEach((video, i)=>{
      const [x, y] = positions[i];
      if(video.src && video.readyState >= 2){
        ctx.save();
        ctx.filter = FILTER_CANVAS_VALUE[currentFilter];
        ctx.drawImage(video, x, y, SLOT_W, SLOT_H);
        ctx.restore();
      }
      if(style.slotBorder){
        ctx.strokeStyle = style.slotBorder;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, SLOT_W - 1, SLOT_H - 1);
      }
    });

    ctx.fillStyle = style.text;
    ctx.font = "300 28px 'Great Vibes'";
    ctx.fillText(customNames.textContent || '', FRAME_W / 2, captionTop + NAMES_LINE_HEIGHT / 2);

    ctx.font = "500 16px 'Playfair Display'";
    ctx.fillText(customDate.textContent || '', FRAME_W / 2, captionTop + NAMES_LINE_HEIGHT + DATE_LINE_HEIGHT / 2);
  }

  // 녹화 길이는 촬영 당시 타이머로 찍힌 실제 클립 길이에 맞춘다 (고정값 아님)
  const durations = tempVideos.map((v)=> (v.src && isFinite(v.duration)) ? v.duration : 0);
  const RECORD_MS = Math.max(...durations, 1) * 1000;

  const mimeType = pickVideoMimeType();
  const stream = canvas.captureStream(30);
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks = [];
  recorder.ondataavailable = (e)=>{ if(e.data.size > 0) chunks.push(e.data); };

  const stopped = new Promise((resolve)=>{
    recorder.onstop = ()=> resolve(new Blob(chunks, { type: mimeType || 'video/webm' }));
  });

  recorder.start();

  await new Promise((resolve)=>{
    const startTime = performance.now();
    function frame(now){
      drawFrame();
      if(now - startTime < RECORD_MS){
        requestAnimationFrame(frame);
      }else{
        resolve();
      }
    }
    requestAnimationFrame(frame);
  });

  recorder.stop();

  // 정리 — 임시 video 엘리먼트와 objectURL은 다 쓰고 나면 바로 해제
  tempVideos.forEach((video)=>{
    video.pause();
    if(video.src) URL.revokeObjectURL(video.src);
    video.remove();
  });

  return stopped;
}

saveVideoBtn.addEventListener('click', async ()=>{
  if(!supportsVideoRecording()){
    alert('이 브라우저에서는 영상 저장을 지원하지 않아요.');
    return;
  }

  saveVideoBtn.disabled = true;
  try{
    const blob = await recordFrameVideo();
    const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pledgebooth.${ext}`;
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }catch(err){
    alert('영상 저장에 실패했어요. 다시 시도해주세요.');
  } finally {
    saveVideoBtn.disabled = false;
  }
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
