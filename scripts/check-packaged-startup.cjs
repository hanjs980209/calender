// Execute the built Windows application with a new, empty profile in CI.
const { _electron: electron } = require('playwright-core');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
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
    await window.locator('#settings-button').click();
    await window.locator('#background-hex').fill('#2f6b91');await window.locator('#background-hex').press('Tab');
    await window.getByText('모든 변경사항이 저장되었습니다',{exact:true}).waitFor();
    // Simulate a previous portable executable registered with Electron's same default name.
    const oldPath=profile+'\\old-version\\하루 달력.exe';
    await instance.evaluate(({app},old)=>app.setLoginItemSettings({openAtLogin:true,enabled:true,path:old,args:[]}),oldPath);
    assert.equal(await instance.evaluate(({app},old)=>app.getLoginItemSettings({path:old,args:[]}).openAtLogin,oldPath),true);
    await window.locator('#startup-enabled').check();
    await window.getByText('다음 Windows 로그인부터 달력이 자동으로 열립니다.',{exact:true}).waitFor();
    const registered=await instance.evaluate(({app})=>app.getLoginItemSettings({path:process.execPath,args:[]}));
    assert.equal(registered.openAtLogin,true);assert.equal(registered.executableWillLaunchAtLogin,true);
    assert.equal(await instance.evaluate(({app},old)=>app.getLoginItemSettings({path:old,args:[]}).openAtLogin,oldPath),false);
    await window.reload();await window.locator('.day').first().waitFor();await window.locator('#settings-button').click();
    await window.waitForFunction(()=>document.getElementById('startup-enabled').checked);
    assert.equal(await window.locator('#background-hex').inputValue(),'#2f6b91');
    assert.equal(await window.evaluate(()=>document.documentElement.style.getPropertyValue('--surface')),'rgba(47,107,145,0.9)');
    await window.locator('#startup-enabled').uncheck();await window.getByText('자동 실행이 꺼져 있습니다.',{exact:true}).waitFor();
    assert.equal(await instance.evaluate(({app})=>app.getLoginItemSettings({path:process.execPath,args:[]}).openAtLogin),false);
    await window.getByRole('button',{name:'닫기',exact:true}).click();
    await instance.evaluate(({BrowserWindow})=>{const win=BrowserWindow.getAllWindows()[0];win.hide();win.showInactive();});
    await new Promise(resolve=>setTimeout(resolve,3000));
    assert.deepEqual(errors,[]);
    console.log('PASS: built Windows executable v'+expected+', isolated profile, valid tray image, 42 days, note/theme persistence, Windows login registration/remove/path refresh, hide/show and 3-second survival');
  } finally {
    if(instance){
      try{await instance.evaluate(({app})=>app.setLoginItemSettings({openAtLogin:false,enabled:false,path:process.execPath,args:[]}));}catch{}
      await instance.close();
    }
    fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
