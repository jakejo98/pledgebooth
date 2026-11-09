import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { auth, db } from './firebase.js';
import { loadPhotos, saveSelection } from './photoStore.js';
import { formatDateDisplay } from './format.js';

const backBtn = document.getElementById('selection_back_btn');
const frameSlotImgs = Array.from(document.querySelectorAll('.frame_slot_img'));
const selectionBrand = document.getElementById('selection_brand');
const frameCaptionNames = document.getElementById('frame_caption_names');
const frameCaptionDate = document.getElementById('frame_caption_date');
const selectionLabel = document.getElementById('selection_label');
const selectionStrip = document.getElementById('selection_strip');
const nextBtn = document.getElementById('selection_next_btn');

const PICK_COUNT = 4;

let capturedPhotos = [];
let selectedIndices = [];

backBtn.addEventListener('click', ()=>{
  window.location.href = 'studio.html';
});

nextBtn.addEventListener('click', ()=>{
  saveSelection(selectedIndices);
  window.location.href = 'photo-custom-step2.html';
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

  selectionBrand.textContent = `Pledge x ${data.company}`;
  frameCaptionNames.textContent = data.coupleNames;
  frameCaptionDate.textContent = formatDateDisplay(data.weddingDate);

  capturedPhotos = await loadPhotos();
  if(capturedPhotos.length === 0){
    window.location.href = 'studio.html';
    return;
  }

  renderStrip();
  renderFrame();
  updateLabel();
});

function renderStrip(){
  selectionStrip.replaceChildren();

  capturedPhotos.forEach((src, photoIndex)=>{
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'strip_thumb';

    const img = document.createElement('img');
    img.src = src;
    img.alt = '';
    btn.append(img);

    const orderAt = selectedIndices.indexOf(photoIndex);
    if(orderAt !== -1){
      btn.classList.add('is_selected');
      btn.dataset.order = orderAt + 1;
    }else if(selectedIndices.length >= PICK_COUNT){
      btn.disabled = true;
    }

    btn.addEventListener('click', ()=> toggleSelect(photoIndex));
    selectionStrip.append(btn);
  });
}

function renderFrame(){
  frameSlotImgs.forEach((img, slotIndex)=>{
    const photoIndex = selectedIndices[slotIndex];
    if(photoIndex === undefined){
      img.hidden = true;
      img.src = '';
    }else{
      img.src = capturedPhotos[photoIndex];
      img.hidden = false;
    }
  });
}

function updateLabel(){
  selectionLabel.textContent = `사진 선택 (${selectedIndices.length}/${PICK_COUNT})`;
  nextBtn.disabled = selectedIndices.length !== PICK_COUNT;
}

function toggleSelect(photoIndex){
  const at = selectedIndices.indexOf(photoIndex);
  if(at !== -1){
    selectedIndices.splice(at, 1);
  }else{
    if(selectedIndices.length >= PICK_COUNT) return;
    selectedIndices.push(photoIndex);
  }

  renderStrip();
  renderFrame();
  updateLabel();
}
