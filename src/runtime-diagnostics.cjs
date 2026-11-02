const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
// Only fixed event names and technical reason/exit codes are recorded.
// Do not record OAuth arguments, token values, note contents or error messages.
function installDiagnostics({app,dialog}) {
  const filename=()=>path.join(app.getPath('userData'),'diagnostics.jsonl');
  function record(event,details={}) {
    try {
      const file=filename();fs.mkdirSync(path.dirname(file),{recursive:true});
      if(fs.existsSync(file)&&fs.statSync(file).size>256*1024)fs.renameSync(file,file+'.previous');
      fs.appendFileSync(file,JSON.stringify({time:new Date().toISOString(),event,...details})+'\n');
    }catch{/* Diagnostics must not create another startup failure. */}
  }
  let failing=false;
  function fatal() {
    if(failing)return;failing=true;record('fatal-app-error');
    try {dialog.showErrorBox('하루 달력 오류','앱 오류가 발생하여 달력을 종료합니다. 컴퓨터를 재시작하지 않고 앱만 종료합니다.\n진단 파일: '+filename());}catch{}
    app.exit(1);
  }
  process.on('uncaughtException',fatal);
  process.on('unhandledRejection',fatal);
  app.on('child-process-gone',(_,details)=>record('child-process-gone',{type:details.type,reason:details.reason,exitCode:details.exitCode}));
  app.on('browser-window-created',(_,window)=>{
    window.webContents.on('render-process-gone',(_,details)=>{record('renderer-gone',{reason:details.reason,exitCode:details.exitCode});if(details.reason!=='clean-exit')fatal();});
    window.webContents.on('did-fail-load',(_,code,description,url,isMainFrame)=>{if(isMainFrame&&code!==-3){record('page-load-failed',{code});fatal();}});
  });
  record('starting',{version:app.getVersion(),electron:process.versions.electron,chrome:process.versions.chrome,platform:process.platform,osRelease:os.release()});
  return {record,fatal};
}
module.exports={installDiagnostics};
