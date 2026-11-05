const {chromium}=require('playwright-core');const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1200,height:850}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
    const d=new Date(),key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const nextDay=value=>{const date=new Date(value+'T12:00:00');date.setDate(date.getDate()+1);return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;};
    const items=[{id:'p',name:'내 일정',primary:true,readOnly:false},{id:'r',name:'읽기 공유',readOnly:true},{id:'w',name:'팀 공유',readOnly:false}];
    const saved=()=>JSON.parse(localStorage.getItem('mock-selection')||'{"visibleIds":["p"],"writeCalendarId":"p"}');
    let events=items.map(c=>({id:'same',calendarId:c.id,calendarName:c.name,summary:c.name+' 회의',etag:'etag',readOnly:c.readOnly,start:{date:key},end:{date:nextDay(key)}}));
    window.calls=[];
    window.desktop={load:async()=>({version:1,notes:{[key]:[{id:'local',text:'로컬 메모',done:false,color:'mint'}]},settings:{}}),save:async()=>{},'startup-get':async()=>({supported:false,enabled:false}),'google-status':async()=>({configured:true,connected:true,needsReconnect:false}),'google-calendars':async()=>({items,...saved()}),'google-selection':async input=>{localStorage.setItem('mock-selection',JSON.stringify(input));return {items,...input};},'google-list':async({calendarIds})=>events.filter(e=>calendarIds.includes(e.calendarId)),'google-upsert':async input=>{window.calls.push(input);const c=items.find(c=>c.id===input.calendarId);const event={id:input.id||input.requestId,calendarId:c.id,calendarName:c.name,summary:input.summary,etag:'new',start:{date:input.startDate},end:{date:nextDay(input.endDate)}};events=events.filter(e=>!(e.id===event.id&&e.calendarId===event.calendarId)).concat(event);return event;},'google-remove':async input=>{window.calls.push(input);events=events.filter(e=>!(e.id===input.id&&e.calendarId===input.calendarId));}};
  });
  await page.goto('http://127.0.0.1:5173');await page.getByText('내 일정 회의',{exact:true}).waitFor();
  await page.locator('#settings-button').click();
  await page.locator('#google-calendar-list input[data-calendar-id="r"]').check();await page.getByText('읽기 공유 회의',{exact:true}).waitFor({state:'attached'});
  await page.locator('#google-calendar-list input[data-calendar-id="w"]').check();await page.getByText('팀 공유 회의',{exact:true}).waitFor({state:'attached'});
  await page.locator('#google-write-calendar').selectOption('w');await page.waitForFunction(()=>!document.getElementById('google-write-calendar').disabled);
  await page.getByRole('button',{name:'닫기',exact:true}).click();
  assert.equal(await page.locator('.google-event').count(),3);
  const readOnly=page.locator('.google-event').filter({hasText:'읽기 공유 회의'});assert(await readOnly.getByRole('button',{name:'수정',exact:true}).isDisabled());assert(await readOnly.getByRole('button',{name:'삭제',exact:true}).isDisabled());
  for(const [selector,size] of [['#selected-title',44],['.note-text',24],['.google-event-title',24],['.google-event-time',20]])assert.equal(await page.locator(selector).first().evaluate(n=>parseFloat(getComputedStyle(n).fontSize)),size);
  await page.locator('#google-add').click();assert.equal(await page.locator('#event-calendar').inputValue(),'w');await page.locator('#event-summary').fill('팀 새 일정');await page.locator('#event-submit').click();await page.getByText('팀 새 일정',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.calls[0].calendarId),'w');
  const writable=page.locator('.google-event').filter({hasText:'팀 공유 회의'});await writable.getByRole('button',{name:'수정',exact:true}).click();assert(await page.locator('#event-calendar').isDisabled());assert.equal(await page.locator('#event-calendar').inputValue(),'w');await page.locator('#event-summary').fill('팀 수정 일정');await page.locator('#event-submit').click();await page.getByText('팀 수정 일정',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.calls[1].calendarId),'w');
  page.once('dialog',d=>d.accept());await page.locator('.google-event').filter({hasText:'팀 수정 일정'}).getByRole('button',{name:'삭제',exact:true}).click();await page.waitForFunction(()=>!Array.from(document.querySelectorAll('.google-event-title')).some(n=>n.textContent==='팀 수정 일정'));
  assert.equal(await page.getByText('읽기 공유 회의',{exact:true}).count(),1);assert.equal(await page.getByText('내 일정 회의',{exact:true}).count(),1);
  await page.reload();await page.getByText('읽기 공유 회의',{exact:true}).waitFor();await page.locator('#settings-button').click();assert(await page.locator('#google-calendar-list input[data-calendar-id="r"]').isChecked());assert.equal(await page.locator('#google-write-calendar').inputValue(),'w');
  await page.getByRole('button',{name:'닫기',exact:true}).click();await page.screenshot({path:'/tmp/haru-shared-calendar.png'});
  await page.setViewportSize({width:760,height:580});assert(await page.locator('.sidebar').evaluate(n=>n.scrollWidth<=n.clientWidth+2));
  assert(await page.locator('.days').evaluate(n=>n.getBoundingClientRect().bottom<=document.querySelector('footer').getBoundingClientRect().top+1));
  assert.deepEqual(errors,[]);console.log('PASS (mock IPC): 공유 캘린더 다중 선택·권한·출처·같은 ID 구분·저장 대상·생성/수정/삭제·선택 복원·2배 글꼴·작은 창 줄바꿈');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
