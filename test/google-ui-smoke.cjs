const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
 const page=await browser.newPage({viewport:{width:1200,height:820}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  const d=new Date(),key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  let connection={configured:false,connected:false};let data={version:1,notes:{[key]:[{id:'local-note',text:'기존 로컬 메모',done:false,color:'mint'}]},settings:{}};
  let events=[];window.calls=[];
  window.desktop={load:async()=>structuredClone(data),save:async value=>{data=structuredClone(value);},hide:async()=>{},bottom:async()=>{},
   'google-status':async()=>({...connection}),
   'google-configure':async()=>connection={configured:true,connected:false},
   'google-connect':async()=>connection={configured:true,connected:true},
   'google-disconnect':async()=>connection={configured:true,connected:false},
   'google-list':async()=>structuredClone(events),
   'google-upsert':async input=>{
    window.calls.push({action:'save',input});
    const id=input.id||input.requestId;
    let start,end;
    if(input.allDay){const exclusive=new Date(input.endDate+'T12:00:00');exclusive.setDate(exclusive.getDate()+1);start={date:input.startDate};end={date:`${exclusive.getFullYear()}-${String(exclusive.getMonth()+1).padStart(2,'0')}-${String(exclusive.getDate()).padStart(2,'0')}`};}
    else{start={dateTime:new Date(input.startDate+'T'+input.startTime).toISOString()};end={dateTime:new Date(input.endDate+'T'+input.endTime).toISOString()};}
    const event={id,etag:'etag-2',summary:input.summary,description:input.description,start,end};events=events.filter(e=>e.id!==id).concat(event);return event;
   },
   'google-remove':async input=>{window.calls.push({action:'remove',input});events=events.filter(e=>e.id!==input.id);}
  };
 });
 await page.goto('http://127.0.0.1:5173');await page.locator('.note-text').waitFor();
 await page.locator('#settings-button').click();await page.locator('#google-configure').click();await page.locator('#google-connect').click();await page.getByText('Google 계정 연결됨 · 기본 캘린더',{exact:true}).waitFor();await page.getByRole('button',{name:'닫기',exact:true}).click();
 await page.getByRole('button',{name:'Google로 복사',exact:true}).click();await page.locator('#event-editor[open]').waitFor();assert.equal(await page.locator('#event-summary').inputValue(),'기존 로컬 메모');
 await page.locator('#event-submit').click();await page.locator('.google-event').waitFor();assert.equal(await page.locator('.note-text').textContent(),'기존 로컬 메모');assert.equal(await page.locator('.day.selected .day-note.google').count(),1);
 const first=await page.evaluate(()=>window.calls[0].input);assert.equal(first.requestId.length,32);
 await page.getByRole('button',{name:'수정',exact:true}).click();await page.locator('#event-summary').fill('다른 PC와 공유할 회의');await page.locator('#event-all-day').uncheck();await page.locator('#event-start-time').fill('14:00');await page.locator('#event-end-time').fill('15:00');await page.locator('#event-submit').click();await page.getByText('다른 PC와 공유할 회의',{exact:true}).waitFor();
 const edited=await page.evaluate(()=>window.calls[1].input);assert.equal(edited.id,first.requestId);assert.equal(edited.etag,'etag-2');assert.equal(edited.allDay,false);
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'삭제',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.google-event').length===0);assert.equal(await page.locator('.note-text').count(),1);
 await page.locator('#settings-button').click();page.once('dialog',d=>d.accept());await page.locator('#google-disconnect').click();await page.waitForFunction(()=>document.getElementById('google-add').disabled);assert.match(await page.locator('#google-status').textContent(),/로그인/);
 assert.deepEqual(errors,[]);console.log('PASS (mock IPC): OAuth 설정·로그인·해제 UI, 로컬 메모 복사와 원본 보존, Google 일정 표시·시간 수정·삭제');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
