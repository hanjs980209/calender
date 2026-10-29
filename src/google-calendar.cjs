const http = require('node:http');
const { randomBytes, createHash } = require('node:crypto');
const SCOPE = 'https://www.googleapis.com/auth/calendar.events';
function credentials(json) {
  const c=json?.installed;
  if(!c || typeof c.client_id!=='string' || !c.client_id.endsWith('.apps.googleusercontent.com') || typeof c.client_secret!=='string') throw new Error('Google Cloud에서 발급한 데스크톱 앱 OAuth JSON을 선택하세요.');
  return {client_id:c.client_id,client_secret:c.client_secret};
}
async function responseJSON(response) {
  if(!response.ok){
    const messages={401:'Google 로그인이 만료되었습니다. 다시 연결하세요.',403:'캘린더 접근 권한 또는 Calendar API 활성화 상태를 확인하세요.',404:'일정을 찾을 수 없습니다. 새로고침하세요.',409:'이미 등록된 일정입니다. 새로고침하세요.',410:'이미 삭제된 일정입니다. 새로고침하세요.',412:'다른 PC에서 변경한 일정입니다. 새로고침한 뒤 다시 수정하세요.',429:'요청이 많습니다. 잠시 후 다시 시도하세요.'};
    const error=new Error(messages[response.status]||`Google 요청에 실패했습니다 (${response.status}).`);error.status=response.status;throw error;
  }
  return response.status===204?null:response.json();
}
function beginAuthorization(openBrowser, client, {timeout=180000,exchange}={}) {
  const state=randomBytes(32).toString('hex'), verifier=randomBytes(32).toString('base64url');
  let settle,fail,timer,finished=false;
  const result=new Promise((resolve,reject)=>{settle=resolve;fail=reject;});
  // Attach a handler immediately: callers can wait until the browser has opened.
  result.catch(()=>{});
  const server=http.createServer(async(req,res)=>{
    const url=new URL(req.url,'http://127.0.0.1');
    if(url.pathname!=='/callback'){res.writeHead(404).end();return;}
    if(url.searchParams.get('state')!==state){res.writeHead(400).end('Invalid OAuth state');return;}
    if(finished){res.writeHead(409).end();return;}
    finished=true;
    if(url.searchParams.has('error')||!url.searchParams.get('code')){
      res.writeHead(400,{'Content-Type':'text/plain; charset=utf-8'}).end('로그인이 취소되었습니다. 앱으로 돌아가세요.');
      cleanup();fail(new Error('Google 로그인이 취소되었습니다.'));return;
    }
    res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}).end('로그인 요청을 받았습니다. 하루 달력 앱으로 돌아가세요.');
    cleanup();
    try{settle(await exchange({code:url.searchParams.get('code'),code_verifier:verifier,redirect_uri:redirectURI}));}catch(error){fail(error);}
  });
  function cleanup(){clearTimeout(timer);server.close();setTimeout(()=>server.closeAllConnections(),1000).unref();}
  let redirectURI;
  const ready=new Promise((resolve,reject)=>{
    server.once('error',error=>{cleanup();fail(error);reject(error);});
    server.listen(0,'127.0.0.1',async()=>{
      redirectURI=`http://127.0.0.1:${server.address().port}/callback`;
      const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
      url.search=new URLSearchParams({client_id:client.client_id,redirect_uri:redirectURI,response_type:'code',scope:SCOPE,access_type:'offline',prompt:'consent',state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'});
      timer=setTimeout(()=>{finished=true;cleanup();fail(new Error('로그인 시간이 초과되었습니다. 다시 연결하세요.'));},timeout);
      try{await openBrowser(url.toString());resolve();}catch{cleanup();const error=new Error('기본 브라우저를 열지 못했습니다.');fail(error);reject(error);}
    });
  });
  return {ready,result,cancel:()=>{finished=true;cleanup();fail(new Error('로그인이 취소되었습니다.'));}};
}
function validDate(value) {return typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value;}
function eventBody(input) {
  if(!input || typeof input.summary!=='string' || !input.summary.trim() || input.summary.length>1024 || typeof input.description!=='string' || input.description.length>10000)throw new Error('일정 제목과 내용을 확인하세요.');
  if(!validDate(input.startDate)||!validDate(input.endDate)||input.endDate<input.startDate)throw new Error('일정 날짜를 확인하세요.');
  let start,end;
  if(input.allDay){
    const exclusive=new Date(`${input.endDate}T12:00:00Z`);exclusive.setUTCDate(exclusive.getUTCDate()+1);
    start={date:input.startDate};end={date:exclusive.toISOString().slice(0,10)};
  }else{
    if(!/^\d{2}:\d{2}$/.test(input.startTime)||!/^\d{2}:\d{2}$/.test(input.endTime))throw new Error('일정 시간을 확인하세요.');
    const a=new Date(`${input.startDate}T${input.startTime}:00`),b=new Date(`${input.endDate}T${input.endTime}:00`);
    if(!Number.isFinite(a.getTime())||!Number.isFinite(b.getTime())||b<=a)throw new Error('종료 시간은 시작 시간 이후여야 합니다.');
    const timeZone=Intl.DateTimeFormat().resolvedOptions().timeZone;
    start={dateTime:a.toISOString(),timeZone};end={dateTime:b.toISOString(),timeZone};
  }
  return {summary:input.summary.trim(),description:input.description,start,end};
}
class GoogleCalendar {
  constructor({read,write,openBrowser,fetchImpl=fetch}) {Object.assign(this,{read,write,openBrowser,fetch:fetchImpl});this.auth=null;this.refreshing=null;this.generation=0;}
  status(){const saved=this.read();return {configured:!!saved.client,connected:!!saved.tokens};}
  configure(json){const client=credentials(json);this.cancel();this.generation++;this.write({client});return this.status();}
  cancel(){this.auth?.cancel();this.auth=null;}
  async tokenRequest(body){
    const client=this.read().client;if(!client)throw new Error('먼저 OAuth 설정 JSON을 가져오세요.');
    const response=await this.fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({...client,...body}),signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw new Error('Google 인증에 실패했습니다. OAuth 설정을 확인하거나 다시 로그인하세요.');
    const tokens=await response.json();if(!tokens.access_token)throw new Error('Google 인증 응답이 올바르지 않습니다.');
    return {...tokens,expires_at:Date.now()+Number(tokens.expires_in||3600)*1000};
  }
  async connect(){
    if(this.auth)throw new Error('로그인이 이미 진행 중입니다. 브라우저를 확인하세요.');
    const saved=this.read();if(!saved.client)throw new Error('먼저 OAuth 설정 JSON을 가져오세요.');
    const generation=this.generation;
    const auth=beginAuthorization(this.openBrowser,saved.client,{exchange:body=>this.tokenRequest({grant_type:'authorization_code',...body})});this.auth=auth;
    try{
      await auth.ready;const tokens=await auth.result;
      if(generation!==this.generation)throw new Error('로그인이 취소되었습니다.');
      if(tokens.scope && !tokens.scope.split(' ').includes(SCOPE))throw new Error('일정 접근 권한을 허용해야 연결할 수 있습니다.');
      this.write({...saved,tokens});return this.status();
    }finally{if(this.auth===auth)this.auth=null;}
  }
  disconnect(){this.cancel();this.generation++;const {client}=this.read();this.write(client?{client}:{});return this.status();}
  async accessToken(){
    const saved=this.read();if(!saved.tokens)throw new Error('먼저 Google 계정을 연결하세요.');
    if(saved.tokens.expires_at>Date.now()+60000)return saved.tokens.access_token;
    if(!saved.tokens.refresh_token)throw new Error('Google에 다시 로그인해야 합니다.');
    if(!this.refreshing){
      const generation=this.generation;
      this.refreshing=this.tokenRequest({grant_type:'refresh_token',refresh_token:saved.tokens.refresh_token}).then(tokens=>{
        if(generation!==this.generation)throw new Error('연결이 해제되었습니다.');
        const merged={...saved.tokens,...tokens};this.write({...saved,tokens:merged});return merged.access_token;
      }).finally(()=>{this.refreshing=null;});
    }
    return this.refreshing;
  }
  async request(suffix,{method='GET',body,etag}={}){
    const token=await this.accessToken();
    return responseJSON(await this.fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events${suffix}`,{method,headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{}),...(etag?{'If-Match':etag}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)}));
  }
  async list({start,end}){
    if(!validDate(start)||!validDate(end)||end<=start||(new Date(end)-new Date(start))>100*86400000)throw new Error('조회 날짜 범위가 올바르지 않습니다.');
    const params=new URLSearchParams({timeMin:new Date(`${start}T00:00:00`).toISOString(),timeMax:new Date(`${end}T00:00:00`).toISOString(),singleEvents:'true',orderBy:'startTime',maxResults:'2500'});
    const items=[];
    do{const page=await this.request(`?${params}`);items.push(...(page.items||[]));if(!page.nextPageToken)break;params.set('pageToken',page.nextPageToken);}while(true);
    return items.filter(e=>e.status!=='cancelled').map(e=>({id:e.id,etag:e.etag,summary:e.summary||'(제목 없음)',description:e.description||'',start:e.start,end:e.end,recurring:!!e.recurringEventId,readOnly:e.locked===true || e.eventType && e.eventType!=='default'}));
  }
  async upsert(input){
    const body=eventBody(input);
    if(input.id){this.checkId(input.id);if(typeof input.etag!=='string'||!input.etag)throw new Error('최신 일정을 새로고침하세요.');return this.request(`/${encodeURIComponent(input.id)}`,{method:'PATCH',body,etag:input.etag});}
    if(!/^[a-v0-9]{5,1024}$/.test(input.requestId||''))throw new Error('일정 요청 ID가 올바르지 않습니다.');
    // An ID retained by the editor makes retrying a timed-out insert idempotent.
    return this.request('',{method:'POST',body:{...body,id:input.requestId}});
  }
  checkId(id){if(typeof id!=='string'||!id||id.length>1024||!/^[-_a-zA-Z0-9]+$/.test(id))throw new Error('일정 ID가 올바르지 않습니다.');}
  async remove({id,etag}){this.checkId(id);if(typeof etag!=='string'||!etag)throw new Error('최신 일정을 새로고침하세요.');return this.request(`/${encodeURIComponent(id)}`,{method:'DELETE',etag});}
}
module.exports={GoogleCalendar,credentials,eventBody,beginAuthorization};
