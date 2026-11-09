// 재사용 가능한 날짜 선택 캘린더.
// 네이티브 <input type="date">는 브라우저마다(특히 Safari) 생김새가 완전히 달라서
// 대신 직접 그린 캘린더를 absolute 팝업으로 띄운다.
//
// 사용법:
//   const picker = await createDatePicker({
//     container: dateFieldEl,      // position:relative인 감싸는 요소
//     triggerEl: displayInputEl,   // 클릭하면 캘린더가 열리는 요소
//     hiddenInput: hiddenInputEl,  // 선택된 날짜(yyyy-mm-dd)가 채워질 input
//     onSelect: (isoDate) => {...}
//   });
//   picker.setDate('2026-05-10'); // 기존 값 반영 (선택 사항)

function toISODate(date){
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseISODate(isoDate){
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export async function createDatePicker({ container, triggerEl, hiddenInput, onSelect }){
  const res = await fetch('../modal/calendar.html');
  container.insertAdjacentHTML('beforeend', await res.text());

  const popup = container.querySelector('.calendar_popup');
  const titleEl = popup.querySelector('.calendar_title');
  const daysEl = popup.querySelector('.calendar_days');
  const prevBtn = popup.querySelector('.calendar_prev');
  const nextBtn = popup.querySelector('.calendar_next');

  let selectedDate = null;
  let viewYear;
  let viewMonth;

  function open(){
    const base = selectedDate || new Date();
    viewYear = base.getFullYear();
    viewMonth = base.getMonth();
    render();
    popup.hidden = false;
  }

  function close(){
    popup.hidden = true;
  }

  function render(){
    titleEl.textContent = `${viewYear}년 ${viewMonth + 1}월`;

    const startOffset = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    daysEl.replaceChildren();

    for(let i = 0; i < 42; i++){
      const dayNum = i - startOffset + 1;
      let cellDate;
      let muted = false;

      if(dayNum < 1){
        cellDate = new Date(viewYear, viewMonth - 1, daysInPrevMonth + dayNum);
        muted = true;
      }else if(dayNum > daysInMonth){
        cellDate = new Date(viewYear, viewMonth + 1, dayNum - daysInMonth);
        muted = true;
      }else{
        cellDate = new Date(viewYear, viewMonth, dayNum);
      }

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'calendar_day';
      btn.textContent = cellDate.getDate();

      if(muted) btn.classList.add('is_muted');
      if(cellDate.getTime() === today.getTime()) btn.classList.add('is_today');
      if(selectedDate && cellDate.getTime() === selectedDate.getTime()) btn.classList.add('is_selected');

      btn.addEventListener('click', ()=>{
        selectedDate = cellDate;
        const iso = toISODate(cellDate);
        hiddenInput.value = iso;
        onSelect(iso);
        close();
      });

      daysEl.append(btn);
    }
  }

  triggerEl.addEventListener('click', ()=>{
    popup.hidden ? open() : close();
  });

  prevBtn.addEventListener('click', ()=>{
    viewMonth--;
    if(viewMonth < 0){ viewMonth = 11; viewYear--; }
    render();
  });

  nextBtn.addEventListener('click', ()=>{
    viewMonth++;
    if(viewMonth > 11){ viewMonth = 0; viewYear++; }
    render();
  });

  document.addEventListener('click', (e)=>{
    if(!popup.hidden && !container.contains(e.target)) close();
  });

  return {
    setDate(isoDate){
      selectedDate = isoDate ? parseISODate(isoDate) : null;
    }
  };
}
