/* global Calendar, GoogleView */
const $ = id => document.getElementById(id);
const native = window.desktop;
if (native) document.body.classList.add('desktop');
let state, selected = new Date(), view = new Date(selected.getFullYear(), selected.getMonth(), 1), color = 'mint';
let writable = true, saveQueue = Promise.resolve();
const colors = {mint:'#a9dbc6',blue:'#9fc2e8',rose:'#e1a9ae',amber:'#e2ca98'};
const labels = {mint:'초록',blue:'파랑',rose:'분홍',amber:'노랑'};
function status(text) { $('save-status').textContent = text; }
async function persist() {
  if (!writable) return;
  const snapshot = JSON.parse(JSON.stringify(state));
  status('저장 중…');
  saveQueue = saveQueue.catch(()=>{}).then(async()=>{
    if (native) await native.save(snapshot);
    else localStorage.setItem('haru-calendar',JSON.stringify(snapshot));
  });
  try { await saveQueue; status('모든 변경사항이 저장되었습니다'); }
  catch { status('저장 실패 · 백업을 내보내고 저장 공간을 확인하세요'); }
}
function applySettings() {
  const opacity = Math.max(30,Math.min(100, Number(state.settings.opacity)||90));
  document.documentElement.style.setProperty('--surface',`rgba(24,38,37,${opacity/100})`);
  $('opacity').value=opacity; $('opacity-label').textContent=opacity+'%';
  $('monday').checked=!!state.settings.monday;
}
function render() {
  $('note-input').disabled=!writable;
  document.querySelector('.add-button').disabled=!writable;
  $('month-title').textContent=`${view.getFullYear()}년 ${view.getMonth()+1}월`;
  $('month-en').textContent=view.toLocaleDateString('en-US',{month:'long'}).toUpperCase();
  const week = state.settings.monday ? ['월','화','수','목','금','토','일'] : ['일','월','화','수','목','금','토'];
  $('weekdays').replaceChildren(...week.map(day=>{const span=document.createElement('span');span.textContent=day;span.className=day==='일'?'sunday':day==='토'?'saturday':'';return span;}));
  const today=Calendar.dateKey(new Date());
  $('days').replaceChildren(...Calendar.monthDays(view.getFullYear(),view.getMonth(),state.settings.monday).map(date=>{
    const key=Calendar.dateKey(date), notes=state.notes[key]||[];
    const button=document.createElement('button');
    button.className=['day',date.getMonth()!==view.getMonth()?'other':'',key===today?'today':'',key===Calendar.dateKey(selected)?'selected':'',date.getDay()===0?'sunday':date.getDay()===6?'saturday':''].join(' ');
    button.dataset.date=key; button.setAttribute('aria-label',`${date.getMonth()+1}월 ${date.getDate()}일, 메모 ${notes.length}개`);
    button.setAttribute('aria-pressed',String(key===Calendar.dateKey(selected)));
    const num=document.createElement('span');num.className='day-number';num.textContent=date.getDate();button.append(num);
    notes.slice(0,2).forEach(note=>{const el=document.createElement('span');el.className=`day-note ${note.color} ${note.done?'done':''}`;el.textContent=note.text;button.append(el);});
    if(notes.length>2){const more=document.createElement('span');more.className='more';more.textContent=`+${notes.length-2}개의 메모`;button.append(more);}
    button.onclick=()=>{selected=date;render();};
    button.ondblclick=()=>$('note-input').focus();
    return button;
  }));
  $('selected-title').textContent=selected.toLocaleDateString('ko-KR',{month:'long',day:'numeric',weekday:'long'});
  $('selected-subtitle').textContent=Calendar.dateKey(selected)===today?'오늘도 당신의 속도로, 좋은 하루 보내세요.':`${selected.getFullYear()}년, 기억하고 싶은 하루`;
  const notes=state.notes[Calendar.dateKey(selected)]||[];
  $('note-count').textContent=notes.length;
  $('note-list').replaceChildren();
  if(!notes.length){const p=document.createElement('div');p.className='empty';p.textContent='아직 메모가 없어요.\n오늘의 작은 계획을 남겨보세요.';$('note-list').append(p);}
  notes.forEach(note=>{
    const row=document.createElement('div');row.className=`note-item ${note.done?'done':''}`;
    const check=document.createElement('input');check.type='checkbox';check.checked=note.done;check.setAttribute('aria-label',`${note.text} 완료`);
    check.onchange=()=>{note.done=check.checked;persist();render();};
    const text=document.createElement('span');text.className='note-text';text.textContent=note.text;text.style.color=note.done?'':colors[note.color];
    const del=document.createElement('button');del.className='delete-note';del.textContent='×';del.setAttribute('aria-label',`${note.text} 삭제`);
    del.onclick=()=>{if(!confirm('이 메모를 삭제할까요?'))return;state.notes[Calendar.dateKey(selected)]=notes.filter(n=>n.id!==note.id);persist();render();};
    const content=document.createElement('div');content.className='note-content';content.append(text);
    if(native){const copy=document.createElement('button');copy.className='note-copy';copy.textContent='Google로 복사';copy.onclick=()=>GoogleView.copy(note,Calendar.dateKey(selected));content.append(copy);}
    row.append(check,content,del);$('note-list').append(row);
  });
  GoogleView.render(selected,view);
}
function moveMonth(delta){view=new Date(view.getFullYear(),view.getMonth()+delta,1);render();}
$('prev').onclick=()=>moveMonth(-1);$('next').onclick=()=>moveMonth(1);
$('today').onclick=()=>{selected=new Date();view=new Date(selected.getFullYear(),selected.getMonth(),1);render();};
$('note-form').onsubmit=event=>{
  event.preventDefault();if(!writable)return;
  const text=$('note-input').value.trim();if(!text)return;
  const key=Calendar.dateKey(selected);const notes=state.notes[key]||[];
  if(notes.length>=1000){status('날짜별 메모는 1,000개까지 저장할 수 있습니다');return;}
  state.notes[key]=[...notes,{id:crypto.randomUUID(),text,color,done:false}];
  $('note-input').value='';persist();render();
};
Object.entries(colors).forEach(([key,value])=>{
  const button=document.createElement('button');button.type='button';button.className='color-button'+(key===color?' active':'');button.style.setProperty('--color',value);button.setAttribute('aria-label',labels[key]);button.setAttribute('aria-pressed',String(key===color));
  button.onclick=()=>{color=key;document.querySelectorAll('.color-button').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});};
  document.querySelector('.colors').append(button);
});
$('settings-button').onclick=()=>$('settings').showModal();
$('opacity').oninput=()=>{state.settings.opacity=Number($('opacity').value);applySettings();};
$('opacity').onchange=()=>persist();
$('monday').onchange=()=>{state.settings.monday=$('monday').checked;persist();render();};
$('hide').onclick=()=>{if(native)native.hide();else status('트레이 기능은 Windows 앱에서 사용할 수 있습니다');};
$('bottom').onclick=()=>{if(native)native.bottom();else status('창 배치 기능은 Windows 앱에서 사용할 수 있습니다');};
$('export').onclick=async()=>{
  try{
    if(native){await saveQueue;await native.export();return;}
    const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='calendar-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch{status('백업 내보내기에 실패했습니다');}
};
$('import').onclick=async()=>{
  try{
    await saveQueue;
    if(native){const data=await native.import();if(data){state=data;state.settings||={};writable=true;applySettings();render();}return;}
    const input=document.createElement('input');input.type='file';input.accept='.json';
    input.onchange=async()=>{try{const data=JSON.parse(await input.files[0].text());if(!Calendar.validData(data))throw new Error();if(!confirm('현재 메모를 백업 내용으로 덮어쓸까요?'))return;state=data;state.settings||={};writable=true;applySettings();render();await persist();}catch{status('올바른 백업 파일이 아닙니다');}};input.click();
  }catch{status('백업 가져오기에 실패했습니다');}
};
document.addEventListener('keydown',event=>{
  if(['TEXTAREA','INPUT'].includes(event.target.tagName)||$('settings').open)return;
  if(event.key==='ArrowLeft')moveMonth(-1);if(event.key==='ArrowRight')moveMonth(1);
});
(async()=>{
  try{state=native?await native.load():JSON.parse(localStorage.getItem('haru-calendar')||'null');if(state&&!Calendar.validData(state))throw new Error();}
  catch{state=null;writable=false;status('저장 데이터를 읽지 못했습니다 · 원본을 보존하고 백업을 확인하세요');}
  state||={version:1,notes:{},settings:{opacity:90,monday:false}};
  state.settings||={};applySettings();render();await GoogleView.init();
  if(!writable){$('note-input').disabled=true;document.querySelector('.add-button').disabled=true;}
})();
