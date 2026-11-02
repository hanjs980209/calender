const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, screen, dialog, safeStorage, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { validData } = require('./calendar.js');
const { GoogleCalendar } = require('./google-calendar.cjs');
let google;
function googleVault() { return path.join(app.getPath('userData'), 'google-account.enc'); }
function readGoogle() {
  if (!fs.existsSync(googleVault())) return {};
  try { return JSON.parse(safeStorage.decryptString(fs.readFileSync(googleVault()))); }
  catch { throw new Error('Google 인증 저장소를 읽지 못했습니다. 이 PC의 로그인 설정을 확인하세요.'); }
}
function writeGoogle(data) {
  if (!safeStorage.isEncryptionAvailable() || (process.platform==='linux' && safeStorage.getSelectedStorageBackend()==='basic_text')) throw new Error('운영체제의 안전한 인증 저장소를 사용할 수 없습니다.');
  const encrypted=safeStorage.encryptString(JSON.stringify(data));
  fs.mkdirSync(app.getPath('userData'),{recursive:true});
  fs.writeFileSync(googleVault()+'.tmp',encrypted,{mode:0o600});
  fs.renameSync(googleVault()+'.tmp',googleVault());
}
let win, tray, quitting = false;
const file = () => path.join(app.getPath('userData'), 'calendar.json');
function load() {
  try { return JSON.parse(fs.readFileSync(file(), 'utf8')); }
  catch (error) {
    if (error.code !== 'ENOENT') throw new Error('저장 파일을 읽지 못했습니다. 원본 파일을 확인해주세요.');
    return {version:1, notes:{}, settings:{opacity:90, monday:false}};
  }
}
function save(data) {
  if (!validData(data)) throw new Error('잘못된 달력 데이터입니다.');
  fs.mkdirSync(app.getPath('userData'), {recursive:true});
  fs.writeFileSync(file()+'.tmp', JSON.stringify(data), 'utf8');
  fs.renameSync(file()+'.tmp', file());
}
function createWindow() {
  const area = screen.getPrimaryDisplay().workArea;
  win = new BrowserWindow({width:Math.min(1200,area.width),height:Math.min(810,area.height),show:false,frame:false,transparent:true,backgroundColor:'#00000000',skipTaskbar:true,minWidth:760,minHeight:580,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  win.loadFile(path.join(__dirname,'index.html'));
  win.on('close', event => {if (!quitting) {event.preventDefault();win.hide();}});
  win.webContents.setWindowOpenHandler(() => ({action:'deny'}));
  win.webContents.on('will-navigate',event => event.preventDefault());
  win.once('ready-to-show', () => win.showInactive());
  const icon = nativeImage.createFromPath(path.join(__dirname,'tray-icon.png'));
  if(icon.isEmpty()) throw new Error('트레이 아이콘을 불러오지 못했습니다.');
  tray = new Tray(icon);
  tray.setToolTip('하루 달력');
  tray.setContextMenu(Menu.buildFromTemplate([
    {label:'달력 열기',click:()=>{win.show();win.focus();}},
    {label:'로그인 시 시작',type:'checkbox',checked:app.getLoginItemSettings().openAtLogin,enabled:app.isPackaged && process.platform==='win32',click:item=>app.setLoginItemSettings({openAtLogin:item.checked})},
    {type:'separator'}, {label:'종료',click:()=>{quitting=true;app.quit();}}
  ]));
  tray.on('double-click',()=>{win.show();win.focus();});
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  const diagnostics=require('./runtime-diagnostics.cjs').installDiagnostics({app,dialog});
  app.on('second-instance',()=>{if(win){win.show();win.focus();}});
  app.whenReady().then(()=>{
    google=new GoogleCalendar({read:readGoogle,write:writeGoogle,openBrowser:url=>shell.openExternal(url)});
    ipcMain.handle('google-status',()=>google.status());
    ipcMain.handle('google-configure',async()=>{
      const result=await dialog.showOpenDialog(win,{title:'Google 데스크톱 OAuth 클라이언트 JSON 선택',properties:['openFile'],filters:[{name:'JSON',extensions:['json']}]});
      if(result.canceled)return google.status();
      if(fs.statSync(result.filePaths[0]).size>65536)throw new Error('OAuth 설정 파일이 너무 큽니다.');
      let config;
      try { config=JSON.parse(fs.readFileSync(result.filePaths[0],'utf8')); }
      catch { throw new Error('OAuth JSON 파일을 읽지 못했습니다. 다운로드한 원본 파일을 선택하세요.'); }
      return google.configure(config);
    });
    ipcMain.handle('google-connect',()=>google.connect());
    ipcMain.handle('google-disconnect',()=>google.disconnect());
    ipcMain.handle('google-list',(_,range)=>google.list(range));
    ipcMain.handle('google-upsert',(_,input)=>google.upsert(input));
    ipcMain.handle('google-remove',(_,input)=>google.remove(input));
    ipcMain.handle('load',()=>load());
    ipcMain.handle('save',(_,data)=>save(data));
    ipcMain.handle('hide',()=>win.hide());
    ipcMain.handle('export',async()=>{
      const result=await dialog.showSaveDialog(win,{defaultPath:'calendar-backup.json',filters:[{name:'JSON',extensions:['json']}]});
      if(!result.canceled) fs.writeFileSync(result.filePath,JSON.stringify(load(),null,2),'utf8');
    });
    ipcMain.handle('import',async()=>{
      const result=await dialog.showOpenDialog(win,{properties:['openFile'],filters:[{name:'JSON',extensions:['json']}]});
      if(result.canceled) return null;
      const data=JSON.parse(fs.readFileSync(result.filePaths[0],'utf8'));
      if(!validData(data)) throw new Error('올바른 백업 파일이 아닙니다.');
      const confirmation=await dialog.showMessageBox(win,{type:'question',buttons:['취소','덮어쓰기'],defaultId:0,cancelId:0,message:'현재 메모를 백업 내용으로 덮어쓸까요?'});
      if(confirmation.response!==1) return null;
      save(data); return data;
    });
    createWindow();
    diagnostics.record('window-created');
  }).catch(diagnostics.fatal);
  app.on('before-quit',()=>{quitting=true;google?.cancel();});
}
