const {chromium}=require('playwright-core');const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1200,height:850}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:5173');await page.locator('.day').first().waitFor();
  const metrics=()=>page.evaluate(()=>({right:document.querySelector('.sidebar').getBoundingClientRect().width,left:document.querySelector('.calendar').getBoundingClientRect().width,font:parseFloat(getComputedStyle(document.getElementById('selected-title')).fontSize),month:document.getElementById('month-title').textContent,ratio:JSON.parse(localStorage.getItem('haru-calendar')||'null')?.settings?.myDayRatio}));
  const initial=await metrics();assert(Math.abs(initial.right-235)<1);assert.equal(initial.font,22);
  const grip=page.locator('#day-splitter');const box=await grip.boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+100);await page.mouse.down();await page.mouse.move(box.x+box.width/2-200,box.y+100,{steps:12});await page.mouse.up();
  await page.getByText('모든 변경사항이 저장되었습니다',{exact:true}).waitFor();
  const wider=await metrics();assert(wider.right>initial.right+190);assert(wider.left<initial.left-190);assert(wider.font>initial.font);assert(wider.ratio>0);
  await page.reload();await page.locator('.day').first().waitFor();await page.waitForFunction(()=>document.querySelector('.sidebar').getBoundingClientRect().width>400);assert(Math.abs((await metrics()).right-wider.right)<1);
  const month=(await metrics()).month;await grip.focus();await grip.press('ArrowRight');await page.getByText('모든 변경사항이 저장되었습니다',{exact:true}).waitFor();
  await page.waitForFunction(()=>document.querySelector('.sidebar').getBoundingClientRect().width<430);assert.equal((await metrics()).month,month);
  // Resize the whole application: saved proportions and font size adapt to the new width.
  const beforeWindowResize=await metrics();await page.setViewportSize({width:950,height:700});await page.waitForFunction(()=>document.querySelector('.sidebar').getBoundingClientRect().width<400);
  const narrower=await metrics();assert(narrower.right<beforeWindowResize.right);assert(narrower.font<beforeWindowResize.font);
  // Both extremes must clamp without overlap or horizontal scrolling.
  await grip.press('End');await grip.press('ArrowLeft');await page.waitForTimeout(50);const max=await metrics();assert(max.left>=349);
  await grip.press('Home');await grip.press('ArrowRight');await page.waitForTimeout(50);assert(Math.abs((await metrics()).right-190)<1);assert.equal((await metrics()).font,22);
  await grip.dblclick();await page.waitForFunction(()=>Math.abs(document.querySelector('.sidebar').getBoundingClientRect().width-235)<1);assert.equal((await metrics()).font,22);
  for(const width of [760,1000,1600]){
    await page.setViewportSize({width,height:650});await page.waitForTimeout(75);
    assert(await page.locator('.calendar-layout').evaluate(node=>node.scrollWidth<=node.clientWidth+1));
    assert(await page.locator('.sidebar').evaluate(node=>node.scrollWidth<=node.clientWidth+1));
    assert(await page.locator('.days').evaluate(node=>node.getBoundingClientRect().bottom<=document.querySelector('footer').getBoundingClientRect().top+1));
  }
  assert.deepEqual(errors,[]);await page.screenshot({path:'/tmp/haru-resizable-panes.png'});
  console.log('PASS: 기본 글꼴·드래그·달력 폭 연동·오른쪽 글자 자동 확대/축소·저장 복원·키보드·최소/최대 제한·더블클릭 복원·창 크기 대응·줄맞춤');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
