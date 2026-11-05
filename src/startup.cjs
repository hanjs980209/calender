// Per-user Windows login registration through Electron's supported API.
// Use its default registry value name, matching earlier versions of this app.
function createStartupSettings({app,platform=process.platform,executable=process.execPath}) {
  const supported=platform==='win32' && app.isPackaged;
  // Electron parses the query path as a Windows command line. Quote spaces;
  // its setter strips the surrounding quotes before formatting the Run value.
  const loginPath='"'+executable+'"';
  function get() {
    if(!supported)return {supported:false,registered:false,enabled:false,blocked:false};
    try {
      const item=app.getLoginItemSettings({path:loginPath,args:[]});
      const registered=!!item.openAtLogin;
      const enabled=registered && !!item.executableWillLaunchAtLogin;
      return {supported:true,registered,enabled,blocked:registered&&!enabled,path:executable};
    }catch{return {supported:true,registered:false,enabled:false,blocked:false,error:true};}
  }
  function set(enabled) {
    if(typeof enabled!=='boolean')throw new Error('자동 실행 설정값이 올바르지 않습니다.');
    if(!supported)throw new Error('자동 실행은 Windows 배포 앱에서 사용할 수 있습니다.');
    app.setLoginItemSettings({openAtLogin:enabled,enabled,path:loginPath,args:[]});
    const result=get();
    if(result.error || result.registered!==enabled)throw new Error('Windows 자동 실행 설정을 저장하지 못했습니다.');
    return result;
  }
  return {get,set};
}
module.exports={createStartupSettings};
