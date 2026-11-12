// 촬영 페이지 → 선택 페이지로 넘어갈 때 캡처한 사진(dataURL)들과, 각 사진과 같이 찍힌
// 짧은 영상 클립(Blob)들을 들고 가기 위한 저장소.
// sessionStorage는 용량이 작아 풀 해상도 사진 6장 + 영상 6개를 담기 어려워 IndexedDB를 사용.
const DB_NAME = 'pledgebooth';
const STORE_NAME = 'photos';
const CLIP_STORE_NAME = 'clips';
const RECORD_KEY = 'session';

function openDb(){
  return new Promise((resolve, reject)=>{
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = ()=>{
      const db = req.result;
      if(!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      if(!db.objectStoreNames.contains(CLIP_STORE_NAME)) db.createObjectStore(CLIP_STORE_NAME);
    };
    req.onsuccess = ()=> resolve(req.result);
    req.onerror = ()=> reject(req.error);
  });
}

export async function savePhotos(dataUrls){
  const db = await openDb();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(dataUrls, RECORD_KEY);
    tx.oncomplete = ()=> resolve();
    tx.onerror = ()=> reject(tx.error);
  });
}

export async function loadPhotos(){
  const db = await openDb();
  return new Promise((resolve, reject)=>{
    const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(RECORD_KEY);
    req.onsuccess = ()=> resolve(req.result || []);
    req.onerror = ()=> reject(req.error);
  });
}

// IndexedDB는 Blob을 그대로 저장할 수 있어서(구조화 복제) dataURL로 바꿀 필요가 없다
export async function saveClips(blobs){
  const db = await openDb();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(CLIP_STORE_NAME, 'readwrite');
    tx.objectStore(CLIP_STORE_NAME).put(blobs, RECORD_KEY);
    tx.oncomplete = ()=> resolve();
    tx.onerror = ()=> reject(tx.error);
  });
}

export async function loadClips(){
  const db = await openDb();
  return new Promise((resolve, reject)=>{
    const req = db.transaction(CLIP_STORE_NAME, 'readonly').objectStore(CLIP_STORE_NAME).get(RECORD_KEY);
    req.onsuccess = ()=> resolve(req.result || []);
    req.onerror = ()=> reject(req.error);
  });
}

// 선택 페이지 → 커스텀 페이지로 넘어갈 때 고른 사진 인덱스(순서 포함)를 들고 가기 위한 저장소.
// 숫자 배열이라 용량이 작으므로 sessionStorage로 충분.
const SELECTION_KEY = 'pledgebooth_selection';

export function saveSelection(indices){
  sessionStorage.setItem(SELECTION_KEY, JSON.stringify(indices));
}

export function loadSelection(){
  const raw = sessionStorage.getItem(SELECTION_KEY);
  return raw ? JSON.parse(raw) : [];
}
