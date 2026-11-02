const fs=require('node:fs');const path=require('node:path');const {spawnSync}=require('node:child_process');
const exe=path.resolve('node_modules/electron/dist/electron.exe');
const report={runtimeExists:fs.existsSync(exe),cases:[]};
for(const [name,source] of [['baseline',path.resolve('baseline')],['corrected',process.cwd()]]){
 const env={...process.env,HARU_STARTUP_SOURCE_ROOT:source};delete env.ELECTRON_RUN_AS_NODE;
 const result=spawnSync(exe,[path.resolve('test/native-startup.cjs')],{env,encoding:'utf8',timeout:45000,windowsHide:false});
 const entry={name,status:result.status,signal:result.signal,error:result.error?.message||null,stdout:result.stdout||'',stderr:result.stderr||''};
 report.cases.push(entry);fs.writeFileSync(`${name}-startup.log`,JSON.stringify(entry,null,2));
}
fs.writeFileSync('native-startup-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(report.cases.find(c=>c.name==='corrected').status!==0)process.exitCode=1;
