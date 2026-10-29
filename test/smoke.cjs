const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
 const page=await browser.newPage({viewport:{width:1200,height:820}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5173');
 await page.locator('.day').first().waitFor();assert.equal(await page.locator('.day').count(),42);
 const key=await page.locator('.day.selected').getAttribute('data-date');
 await page.locator('#note-input').fill('달력 기능 검증 <script>');await page.locator('#note-form .add-button').click();
 await page.getByRole('checkbox',{name:'달력 기능 검증 <script> 완료',exact:true}).check();
 await page.reload();await page.locator('.note-item.done').waitFor();assert.equal(await page.locator('.note-text').textContent(),'달력 기능 검증 <script>');
 await page.locator('#settings-button').click();await page.locator('#monday').check();
 assert.equal(await page.locator('#weekdays span').first().textContent(),'월');
 await page.getByRole('button',{name:'닫기',exact:true}).click();
 await page.locator('#next').click();assert.notEqual(await page.locator('#days').textContent(),'');await page.locator('#today').click();
 await page.locator('.color-button[aria-label="파랑"]').click();await page.locator('#note-input').fill('두 번째 메모');await page.locator('#note-form .add-button').click();assert.equal(await page.locator('.day.selected .day-note.blue').count(),1);
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'두 번째 메모 삭제',exact:true}).click();assert.equal(await page.locator('.note-item').count(),1);
 await page.screenshot({path:'/tmp/calender-ui.png'});
 assert.deepEqual(errors,[]);console.log('PASS: 42일 표시, 메모 작성, 완료, 재로드 복원, 월요일 설정, 월 이동, 색상, 삭제, 안전한 텍스트 렌더링');
 // 손상된 저장 데이터가 자동으로 덮어써지지 않아야 한다.
 await page.evaluate(()=>localStorage.setItem('haru-calendar','{"version":2,"notes":[]}'));await page.reload();await page.locator('#note-input:disabled').waitFor();assert.equal(await page.evaluate(()=>localStorage.getItem('haru-calendar')),'{"version":2,"notes":[]}');
 console.log('PASS: 잘못된 저장 데이터 보존');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
