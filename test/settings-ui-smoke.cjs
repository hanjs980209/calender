const {chromium}=require('playwright-core');const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1200,height:850}});const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:5173');await page.locator('.day').first().waitFor();await page.locator('#settings-button').click();
  assert(await page.locator('#startup-enabled').isDisabled());
  await page.locator('#background-hex').fill('#3377AA');await page.locator('#background-hex').press('Tab');
  assert.equal(await page.evaluate(()=>document.documentElement.style.getPropertyValue('--surface')),'rgba(51,119,170,0.9)');
  await page.reload();await page.locator('.day').first().waitFor();await page.locator('#settings-button').click();assert.equal(await page.locator('#background-hex').inputValue(),'#3377aa');
  await page.locator('#background-hex').fill('wrong');await page.locator('#background-hex').press('Tab');assert.equal(await page.locator('#background-hex').getAttribute('aria-invalid'),'true');
  await page.locator('#background-hex').fill('#ffffff');await page.locator('#background-hex').press('Tab');assert(await page.locator('.widget').evaluate(node=>node.classList.contains('light-surface')));
  await page.locator('#background-reset').click();assert.equal(await page.locator('#background-hex').inputValue(),'#182625');assert.equal(await page.locator('#background-error').textContent(),'');
  await page.locator('#background-brightness').evaluate(node=>{node.value='100';node.dispatchEvent(new Event('input',{bubbles:true}));node.dispatchEvent(new Event('change',{bubbles:true}));});
  await page.locator('#background-wheel').click({position:{x:215,y:110}});assert.equal(await page.locator('#background-hex').inputValue(),'#ff0000');
  await page.locator('#background-wheel').press('ArrowRight');assert.notEqual(await page.locator('#background-hex').inputValue(),'#ff0000');
  assert.deepEqual(errors,[]);console.log('PASS: 색상환·키보드·밝기·HEX·기본색상 복원·재로드 저장·브라우저 자동 실행 비활성');
  const desktop=await browser.newPage({viewport:{width:1200,height:850}});
  await desktop.addInitScript(()=>{
   let startup={supported:true,enabled:false,registered:false};window.startupFailure=false;
   window.desktop={'startup-get':async()=>({...startup}),'startup-set':async enabled=>{if(window.startupFailure)throw new Error('denied');startup={supported:true,enabled,registered:enabled};return {...startup};},load:async()=>({version:1,notes:{},settings:{}}),save:async()=>{},'google-status':async()=>({configured:false,connected:false})};
  });
  await desktop.goto('http://127.0.0.1:5173');await desktop.locator('.day').first().waitFor();await desktop.locator('#settings-button').click();
  await desktop.locator('#startup-enabled').check();await desktop.getByText('다음 Windows 로그인부터 달력이 자동으로 열립니다.',{exact:true}).waitFor();
  await desktop.reload();await desktop.locator('.day').first().waitFor();await desktop.locator('#settings-button').click(); // mock resets as a new OS fixture
  await desktop.evaluate(()=>window.startupFailure=true);await desktop.locator('#startup-enabled').click();
  await desktop.getByText('자동 실행 설정을 저장하지 못했습니다. Windows 시작 프로그램 설정을 확인하세요.',{exact:true}).waitFor();assert(!(await desktop.locator('#startup-enabled').isChecked()));
  console.log('PASS (mock IPC): 자동 실행 설정 UI와 저장 실패 시 실제 상태 복원');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
