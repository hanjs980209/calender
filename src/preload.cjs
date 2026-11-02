const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', Object.fromEntries(['load','save','hide','export','import','google-status','google-configure','google-connect','google-disconnect','google-list','google-upsert','google-remove'].map(name=>[name,(...args)=>ipcRenderer.invoke(name,...args)])));
