// Execute the built Windows application with a new, empty profile in CI.
const { _electron: electron } = require('playwright-core');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
let checkpoint='launch';
(async()=>{
  const expected=require('../package.json').version;
  const executablePath=path.resolve('dist/win-unpacked/하루 달력.exe');
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'haru-packaged-smoke-'));
  const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
  let instance;
  try {
    instance=await electron.launch({executablePath,args:['--user-data-dir='+profile],env,timeout:45000});
    const window=await instance.firstWindow({timeout:30000});
    const errors=[];window.on('pageerror',error=>errors.push(error.message));
    await window.locator('.day').first().waitFor();
    assert.equal(await window.locator('.day').count(),42);
    const info=await instance.evaluate(({app,nativeImage})=>({version:app.getVersion(),profile:app.getPath('userData'),iconValid:!nativeImage.createFromPath(app.getAppPath()+'/src/tray-icon.png').isEmpty()}));
    assert.equal(info.version,expected);assert.equal(info.iconValid,true);
    assert.equal(path.resolve(info.profile).toLowerCase(),path.resolve(profile).toLowerCase());
    await window.locator('#note-input').fill('CI 시작 확인');
    await window.locator('#note-form .add-button').click();
    await window.getByText('모든 변경사항이 저장되었습니다',{exact:true}).waitFor();
    await window.reload();await window.locator('.note-text').waitFor();
    assert.equal(await window.locator('.note-text').textContent(),'CI 시작 확인');
    assert.equal(await window.locator('.note-text').evaluate(node=>parseFloat(getComputedStyle(node).fontSize)),12);
    assert.equal(await window.locator('#selected-title').evaluate(node=>parseFloat(getComputedStyle(node).fontSize)),22);
    checkpoint='resizable pane layout';
    const initialRight=await window.locator('.sidebar').evaluate(node=>node.getBoundingClientRect().width);
    const initialLeft=await window.locator('.calendar').evaluate(node=>node.getBoundingClientRect().width);
    const grip=window.locator('#day-splitter'),box=await grip.boundingBox();
    await window.mouse.move(box.x+box.width/2,box.y+100);await window.mouse.down();
    await window.mouse.move(box.x+box.width/2-180,box.y+100,{steps:10});await window.mouse.up();
    await window.waitForFunction(initial=>document.querySelector('.sidebar').getBoundingClientRect().width>initial+70,initialRight);
    await window.getByText('모든 변경사항이 저장되었습니다',{exact:true}).waitFor();
    assert(await window.locator('.calendar').evaluate(node=>node.getBoundingClientRect().width)<initialLeft-70);
    assert(await window.locator('.note-text').evaluate(node=>parseFloat(getComputedStyle(node).fontSize))>12);
    const expandedRight=await window.locator('.sidebar').evaluate(node=>node.getBoundingClientRect().width);
    await window.reload();await window.locator('.note-text').waitFor();
    await window.waitForFunction(expected=>Math.abs(document.querySelector('.sidebar').getBoundingClientRect().width-expected)<1,expandedRight);
    const bounds=await instance.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getBounds());
    await instance.evaluate(({BrowserWindow},b)=>BrowserWindow.getAllWindows()[0].setSize(b.width>800?Math.max(760,b.width-200):b.width+200,b.height),bounds);
    await window.waitForFunction(previous=>Math.abs(document.querySelector('.sidebar').getBoundingClientRect().width-previous)>10,expandedRight);
    await instance.evaluate(({BrowserWindow},b)=>BrowserWindow.getAllWindows()[0].setBounds(b),bounds);
    await window.waitForFunction(expected=>Math.abs(document.querySelector('.sidebar').getBoundingClientRect().width-expected)<1,expandedRight);
    await grip.dblclick();await window.waitForFunction(()=>Math.abs(document.querySelector('.sidebar').getBoundingClientRect().width-235)<1);
    await window.getByText('모든 변경사항이 저장되었습니다',{exact:true}).waitFor();
    checkpoint='theme settings';
    await window.locator('#settings-button').click();
    await window.locator('#background-hex').fill('#2f6b91');await window.locator('#background-hex').press('Tab');
    await window.getByText('모든 변경사항이 저장되었습니다',{exact:true}).waitFor();
    // Simulate a previous portable executable registered with Electron's same default name.
    checkpoint='legacy startup registration';
    const oldPath=profile+'\\old-version\\하루 달력.exe';
    await instance.evaluate(({app},old)=>app.setLoginItemSettings({openAtLogin:true,enabled:true,path:'"'+old+'"',args:[]}),oldPath);
    assert.equal(await instance.evaluate(({app},old)=>app.getLoginItemSettings({path:'"'+old+'"',args:[]}).openAtLogin,oldPath),true);
    checkpoint='enable startup through settings';
    await window.locator('#startup-enabled').click();
    await window.waitForFunction(()=>document.getElementById('startup-status').textContent!=='자동 실행 설정 저장 중…');
    checkpoint='verify current startup registration';
    const registered=await instance.evaluate(({app})=>app.getLoginItemSettings({path:'"'+process.execPath+'"',args:[]}));
    const startupUI=await window.locator('#startup-status').textContent();
    const startupDetail=JSON.stringify({registered,ui:startupUI,checked:await window.locator('#startup-enabled').isChecked()});
    assert.equal(registered.openAtLogin,true,startupDetail);assert.equal(registered.executableWillLaunchAtLogin,true,startupDetail);
    assert.equal(await window.locator('#startup-enabled').isChecked(),true,startupDetail);
    assert.equal(await instance.evaluate(({app},old)=>app.getLoginItemSettings({path:'"'+old+'"',args:[]}).openAtLogin,oldPath),false);
    checkpoint='verify restored theme and startup state';
    await window.reload();await window.locator('.day').first().waitFor();await window.locator('#settings-button').click();
    await window.waitForFunction(()=>document.getElementById('startup-enabled').checked);
    assert.equal(await window.locator('#background-hex').inputValue(),'#2f6b91');
    assert.equal(await window.evaluate(()=>document.documentElement.style.getPropertyValue('--surface')),'rgba(47,107,145,0.9)');
    checkpoint='disable startup through settings';
    await window.locator('#startup-enabled').uncheck();await window.getByText('자동 실행이 꺼져 있습니다.',{exact:true}).waitFor();
    assert.equal(await instance.evaluate(({app})=>app.getLoginItemSettings({path:'"'+process.execPath+'"',args:[]}).openAtLogin),false);
    await window.getByRole('button',{name:'닫기',exact:true}).click();
    await instance.evaluate(({BrowserWindow})=>{const win=BrowserWindow.getAllWindows()[0];win.hide();win.showInactive();});
    await new Promise(resolve=>setTimeout(resolve,3000));
    assert.deepEqual(errors,[]);
    console.log('PASS: built Windows executable v'+expected+', isolated profile, valid tray image, 42 days, note/theme/split-pane persistence and responsive fonts, Windows login registration/remove/path refresh, hide/show and 3-second survival');
  } finally {
    if(instance){
      try{await instance.evaluate(({app})=>app.setLoginItemSettings({openAtLogin:false,enabled:false,path:'"'+process.execPath+'"',args:[]}));}catch{}
      await instance.close();
    }
    fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});
  }
})().catch(error=>{
  const report=('Stage: '+checkpoint+'\n'+(error.stack||String(error))).replaceAll('%','%25').replaceAll('\r','%0D').replaceAll('\n','%0A');
  console.error('::error title=Packaged settings verification::'+report);console.error(error);process.exitCode=1;
});
