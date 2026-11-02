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
    await instance.evaluate(({BrowserWindow})=>{const win=BrowserWindow.getAllWindows()[0];win.hide();win.showInactive();});
    await new Promise(resolve=>setTimeout(resolve,3000));
    assert.deepEqual(errors,[]);
    console.log('PASS: built Windows executable v'+expected+', isolated profile, valid tray image, 42 days, note persistence, hide/show and 3-second survival');
  } finally {
    if(instance)await instance.close();
    fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
