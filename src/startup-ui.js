const StartupView=(()=>{
  const checkbox=document.getElementById('startup-enabled'),message=document.getElementById('startup-status');
  const native=window.desktop;let current={supported:false,enabled:false},busy=false,revision=0;
  function render(){
    checkbox.disabled=busy||!current.supported||!!current.error;checkbox.checked=!!current.enabled;
    message.textContent=current.error?'Windows 시작 설정을 읽지 못했습니다. 설정을 다시 열어 확인하세요.':!current.supported?'자동 실행은 Windows 배포 앱에서 사용할 수 있습니다.':current.blocked?'Windows 시작 프로그램에서 사용 중지되어 있습니다. 이 옵션을 켜면 다시 등록합니다.':current.enabled?'다음 Windows 로그인부터 달력이 자동으로 열립니다.':'자동 실행이 꺼져 있습니다.';
  }
  async function refresh(){
    if(busy)return;
    if(!native){render();return;}
    const request=++revision;
    try{const result=await native['startup-get']();if(busy||request!==revision)return;current=result;}catch{if(busy||request!==revision)return;current={supported:true,enabled:false,error:true};}render();
  }
  checkbox.onchange=async()=>{
    const desired=checkbox.checked;busy=true;++revision;checkbox.disabled=true;message.textContent='자동 실행 설정 저장 중…';
    let failed=false;
    try{current=await native['startup-set'](desired);}catch{failed=true;try{current=await native['startup-get']();}catch{current={supported:true,enabled:false,error:true};}}
    finally{busy=false;render();if(failed)message.textContent='자동 실행 설정을 저장하지 못했습니다. Windows 시작 프로그램 설정을 확인하세요.';}
  };
  native?.onStartupChanged?.(()=>refresh());
  window.addEventListener('focus',()=>refresh());
  refresh();
  return {refresh};
})();
