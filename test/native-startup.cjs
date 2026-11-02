// Run with Electron, not node --test. Uses an isolated temporary userData folder.
const {app,dialog,nativeImage}=require('electron');
const fs=require('node:fs');const path=require('node:path');const os=require('node:os');
const root=process.env.HARU_STARTUP_SOURCE_ROOT||path.join(__dirname,'..');
app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'haru-native-startup-')));
dialog.showErrorBox=(title)=>{console.error('APP_ERROR_DIALOG:',title);};
const timer=setTimeout(()=>{console.error('FAIL: application startup timeout');app.exit(1);},30000);
function fail(error){console.error('FAIL: native application startup:',error?.message||String(error));clearTimeout(timer);app.exit(1);}
process.on('uncaughtException',fail);process.on('unhandledRejection',fail);
app.on('browser-window-created',(_,window)=>{
 window.webContents.on('render-process-gone',(_,details)=>fail(new Error('Renderer exited: '+details.reason)));
 window.webContents.once('did-finish-load',async()=>{
  try{
   for(let attempt=0;attempt<50;attempt++){
    const count=await window.webContents.executeJavaScript("document.querySelectorAll('.day').length");
    if(count===42){
     await new Promise(resolve=>setTimeout(resolve,3000));
     console.log('PASS: native window, preload IPC, local data initialization and 42 calendar cells; 3-second survival');clearTimeout(timer);app.exit(0);return;
    }
    await new Promise(resolve=>setTimeout(resolve,100));
   }
   fail(new Error('Calendar did not initialize'));
  }catch(error){fail(error);}
 });
});
app.whenReady().then(()=>{
 const source=fs.readFileSync(path.join(root,'src/main.cjs'),'utf8');
 const legacy=source.match(/nativeImage\.createFromDataURL\('([^']+)'\)/);
 const image=legacy?nativeImage.createFromDataURL(legacy[1]):nativeImage.createFromPath(path.join(root,'src/tray-icon.png'));
 console.log('TRAY_ICON_EMPTY='+image.isEmpty());
});
require(path.join(root,'src/main.cjs'));
