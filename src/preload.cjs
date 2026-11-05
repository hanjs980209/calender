const { contextBridge, ipcRenderer } = require('electron');
const api=Object.fromEntries(['load','save','hide','export','import','startup-get','startup-set','google-status','google-configure','google-connect','google-disconnect','google-list','google-upsert','google-remove'].map(name=>[name,(...args)=>ipcRenderer.invoke(name,...args)]));
api.onStartupChanged=callback=>{
  const listener=()=>callback();ipcRenderer.on('startup-changed',listener);
  return ()=>ipcRenderer.removeListener('startup-changed',listener);
};
contextBridge.exposeInMainWorld('desktop',api);
