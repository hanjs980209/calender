/* global Calendar */
const GoogleView = (()=>{
  const el=id=>document.getElementById(id), native=window.desktop;
  let connection={configured:false,connected:false},events=[],selected=new Date(),view=new Date(),rangeKey='',generation=0,busy=false,editing=null,refreshTimer;
  const dateKey=Calendar.dateKey;
  const message=error=>String(error?.message||'Google 요청에 실패했습니다.').replace(/^Error invoking remote method '[^']+': (Error: )?/,'');
  function settings(){
    el('google-status').textContent=!native?'Google 연결은 Windows 앱에서 사용할 수 있습니다.':connection.connected?'Google 계정 연결됨 · 기본 캘린더':connection.configured?'OAuth 설정 완료 · Google 로그인이 필요합니다.':'Google Cloud의 데스크톱 OAuth 설정 JSON이 필요합니다.';
    el('google-configure').disabled=!native||busy;
    el('google-connect').disabled=!native||!connection.configured||busy||connection.connected;
    el('google-disconnect').disabled=!native||!connection.connected||busy;
    el('google-refresh').disabled=!native||!connection.connected||busy;
    el('google-add').disabled=!native||!connection.connected||busy;
    document.querySelector('.local-badge').textContent=connection.connected?'● 로컬 메모 + Google 일정':'● 내 컴퓨터에 저장';
  }
  function eventDates(event){
    if(event.start.date){const end=new Date(`${event.end.date}T12:00:00`);end.setDate(end.getDate()-1);return [event.start.date,dateKey(end)];}
    return [dateKey(new Date(event.start.dateTime)),dateKey(new Date(new Date(event.end.dateTime).getTime()-1))];
  }
  function onDate(event,key){const [a,b]=eventDates(event);return key>=a&&key<=b;}
  function timeLabel(event){return event.start.date?'종일':new Date(event.start.dateTime).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})+' – '+new Date(event.end.dateTime).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});}
  function draw(){
    document.querySelectorAll('.day-note.google').forEach(n=>n.remove());
    for(const cell of document.querySelectorAll('.day')){
      const matches=events.filter(event=>onDate(event,cell.dataset.date));
      for(const event of matches.slice(0,2)){
        const note=document.createElement('span');note.className='day-note google';note.textContent='G · '+event.summary;note.title=event.summary;cell.append(note);
      }
    }
    const list=el('google-day-events');list.replaceChildren();
    for(const event of events.filter(event=>onDate(event,dateKey(selected)))){
      const row=document.createElement('div');row.className='google-event';
      const title=document.createElement('div');title.className='google-event-title';title.textContent=event.summary;
      const time=document.createElement('div');time.className='google-event-time';time.textContent=timeLabel(event)+(event.recurring?' · 반복 일정의 이번 회차':'');
      const actions=document.createElement('div');actions.className='google-event-actions';
      const edit=document.createElement('button');edit.textContent='수정';edit.disabled=event.readOnly||busy;edit.onclick=()=>openEditor(event);
      const remove=document.createElement('button');remove.textContent='삭제';remove.disabled=event.readOnly||busy;
      remove.onclick=async()=>{
        if(!confirm(`Google 일정 ‘${event.summary}’${event.recurring?'의 이번 회차':''}을 삭제할까요? 다른 PC에도 반영됩니다.`))return;
        busy=true;settings();draw();
        try{await native['google-remove']({id:event.id,etag:event.etag});await refresh(true);}
        catch(error){el('google-agenda-status').textContent=message(error);}
        finally{busy=false;settings();draw();}
      };
      actions.append(edit,remove);row.append(title,time,actions);list.append(row);
    }
  }
  async function refresh(force=false){
    if(!native||!connection.connected)return;
    const days=Calendar.monthDays(view.getFullYear(),view.getMonth(),true);
    // Cover both possible week starts and all visible spillover days.
    const start=new Date(days[0]);start.setDate(start.getDate()-1);
    const end=new Date(days[41]);end.setDate(end.getDate()+2);
    const key=dateKey(start)+'/'+dateKey(end);
    if(!force && rangeKey===key)return;
    rangeKey=key;const request=++generation;
    el('google-agenda-status').textContent='Google 일정 불러오는 중…';
    try{
      const next=await native['google-list']({start:dateKey(start),end:dateKey(end)});
      if(request!==generation)return;events=next;draw();el('google-agenda-status').textContent='Google에서 확인 · '+new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});
    }catch(error){if(request!==generation)return;rangeKey='';el('google-agenda-status').textContent=message(error)+' · 이전 조회 내용이 표시될 수 있습니다.';}
  }
  function render(date,month){selected=new Date(date);view=new Date(month);draw();refresh();}
  function openEditor(event=null,seed=null){
    editing=event;el('event-form').reset();
    el('event-heading').textContent=event?'Google 일정 수정':'Google 일정 추가';
    el('event-summary').value=event?.summary||seed?.text?.split('\n')[0].slice(0,1024)||'';
    el('event-description').value=event?.description||seed?.text||'';
    const allDay=event?!!event.start.date:true;el('event-all-day').checked=allDay;
    let start=dateKey(selected),end=start;
    if(event){[start,end]=eventDates(event);if(!allDay){end=dateKey(new Date(event.end.dateTime));for(const [name,time] of [['start',event.start.dateTime],['end',event.end.dateTime]]){const d=new Date(time);el(`event-${name}-time`).value=`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;}}}
    if(seed?.date)start=end=seed.date;
    el('event-start-date').value=start;el('event-end-date').value=end;
    el('event-times').hidden=allDay;el('event-timezone').textContent='시간대: '+Intl.DateTimeFormat().resolvedOptions().timeZone+(event?.recurring?' · 반복 일정의 이번 회차만 수정합니다.':'');
    el('event-error').textContent='';el('event-submit').disabled=false;el('event-close').disabled=false;
    el('event-form').dataset.requestId=seed?.requestId||crypto.randomUUID().replaceAll('-','');
    el('event-editor').showModal();el('event-summary').focus();
  }
  el('event-all-day').onchange=()=>{el('event-times').hidden=el('event-all-day').checked;};
  el('event-start-date').onchange=()=>{if(el('event-end-date').value<el('event-start-date').value)el('event-end-date').value=el('event-start-date').value;};
  el('event-close').onclick=()=>el('event-editor').close();
  el('event-editor').addEventListener('cancel',e=>{if(busy)e.preventDefault();});
  el('event-form').onsubmit=async e=>{
    e.preventDefault();if(busy)return;
    const input={id:editing?.id,etag:editing?.etag,requestId:el('event-form').dataset.requestId,summary:el('event-summary').value,description:el('event-description').value,allDay:el('event-all-day').checked,startDate:el('event-start-date').value,endDate:el('event-end-date').value,startTime:el('event-start-time').value,endTime:el('event-end-time').value};
    busy=true;el('event-submit').disabled=true;el('event-close').disabled=true;el('event-error').textContent='Google에 저장 중…';settings();
    try{await native['google-upsert'](input);el('event-editor').close();await refresh(true);}
    catch(error){el('event-error').textContent=message(error);}
    finally{busy=false;el('event-submit').disabled=false;el('event-close').disabled=false;settings();draw();}
  };
  el('google-add').onclick=()=>openEditor();
  el('google-configure').onclick=async()=>{
    if(connection.connected&&!confirm('OAuth 설정을 바꾸면 이 PC의 Google 연결이 해제됩니다. 계속할까요?'))return;
    await accountAction('google-configure');
  };
  el('google-connect').onclick=()=>accountAction('google-connect');
  el('google-disconnect').onclick=async()=>{
    if(confirm('이 PC에서 Google 연결을 해제할까요? Google에 저장된 일정은 유지됩니다.'))await accountAction('google-disconnect');
  };
  el('google-refresh').onclick=()=>refresh(true);
  async function accountAction(action){
    busy=true;settings();let errorText='';el('google-status').textContent=action==='google-connect'?'브라우저에서 Google 로그인을 완료하세요. (최대 3분)':'처리 중…';
    try{
      connection=await native[action]();++generation;rangeKey='';events=[];settings();draw();
      if(connection.connected)await refresh(true);
      else el('google-agenda-status').textContent='설정에서 Google 계정을 연결하세요.';
    }catch(error){errorText=message(error);}
    finally{busy=false;settings();if(errorText)el('google-status').textContent=errorText;draw();}
  }
  async function init(){
    if(native)try{connection=await native['google-status']();}catch{el('google-agenda-status').textContent='Google 인증 저장소를 읽지 못했습니다.';}
    settings();if(connection.connected)await refresh(true);
    refreshTimer=setInterval(()=>{if(!busy && !document.hidden)refresh(true);},60000);
    window.addEventListener('beforeunload',()=>clearInterval(refreshTimer));
  }
  async function copy(note,date){
    if(!connection.connected){el('settings').showModal();return;}
    openEditor(null,{text:note.text,date});
  }
  return {init,render,copy,connected:()=>connection.connected};
})();
