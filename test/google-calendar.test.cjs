const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {GoogleCalendar,credentials,eventBody,beginAuthorization}=require('../src/google-calendar.cjs');
const client={client_id:'test.apps.googleusercontent.com',client_secret:'test-only'};
const input={summary:'회의',description:'준비물',allDay:true,startDate:'2026-10-29',endDate:'2026-10-30',requestId:'a1234'};
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
function fixture(fetchImpl){let saved={client,tokens:{access_token:'test-token',refresh_token:'test-refresh',expires_at:Date.now()+3600000}};return {api:new GoogleCalendar({read:()=>structuredClone(saved),write:value=>{saved=structuredClone(value);},openBrowser:async()=>{},fetchImpl}),get:()=>saved,set:value=>{saved=value;}};}
test('데스크톱 OAuth JSON만 받고 임의 인증 URL은 사용하지 않는다',()=>{
 assert.throws(()=>credentials({web:client}));assert.throws(()=>credentials({installed:{client_id:'bad'}}));
 assert.deepEqual(credentials({installed:{...client,token_uri:'https://invalid.example'}}),client);
});
test('종일 일정 종료일을 Google의 배타적 종료일로 변환한다',()=>{
 const body=eventBody({...input,startDate:'2024-02-29',endDate:'2024-02-29'});assert.deepEqual(body.start,{date:'2024-02-29'});assert.deepEqual(body.end,{date:'2024-03-01'});
 assert.throws(()=>eventBody({...input,startDate:'2026-02-30'}));assert.throws(()=>eventBody({...input,endDate:'2026-10-28'}));
});
test('자정에 끝나는 시간 일정과 시간대 변환 및 역전 검증',()=>{
 const body=eventBody({...input,allDay:false,startTime:'23:00',endTime:'00:00'});assert(new Date(body.end.dateTime)>new Date(body.start.dateTime));assert(body.start.timeZone);
 assert.throws(()=>eventBody({...input,allDay:false,endDate:input.startDate,startTime:'12:00',endTime:'11:00'}));
});
test('OAuth는 PKCE, 무작위 state, loopback을 사용하고 잘못된 state는 거부한다',async()=>{
 let authorize;let exchangeBody;
 const auth=beginAuthorization(async url=>{authorize=new URL(url);},client,{timeout:5000,exchange:async body=>{exchangeBody=body;return {access_token:'test'};}});
 try{
 await auth.ready;const callback=authorize.searchParams.get('redirect_uri');assert(callback.startsWith('http://127.0.0.1:'));assert.equal(authorize.searchParams.get('code_challenge_method'),'S256');
 assert.equal((await fetch(callback+'?state=wrong&code=test')).status,400);
 const url=new URL(callback);url.search=new URLSearchParams({state:authorize.searchParams.get('state'),code:'test-code'});
 assert.equal((await fetch(url)).status,200);assert.equal((await auth.result).access_token,'test');
 assert.equal(exchangeBody.code,'test-code');assert.equal(createHash('sha256').update(exchangeBody.code_verifier).digest('base64url'),authorize.searchParams.get('code_challenge'));
 }finally{auth.cancel();}
});
test('OAuth 취소와 시간 초과는 대기 중인 로그인 요청을 종료한다',async()=>{
 const a=beginAuthorization(async()=>{},client,{exchange:async()=>{},timeout:5000});await a.ready;a.cancel();await assert.rejects(a.result,/취소/);
 const b=beginAuthorization(async()=>{},client,{exchange:async()=>{},timeout:20});await b.ready;await assert.rejects(b.result,/초과/);
});
test('토큰 갱신은 병렬 호출에도 한 번만 실행하고 refresh token을 유지한다',async()=>{
 let calls=0;const f=fixture(async(url,options)=>{calls++;assert.equal(url,'https://oauth2.googleapis.com/token');assert.equal(options.body.get('grant_type'),'refresh_token');await new Promise(resolve=>setTimeout(resolve,5));return json({access_token:'new',expires_in:3600});});
 f.set({...f.get(),tokens:{...f.get().tokens,expires_at:0}});
 assert.deepEqual(await Promise.all([f.api.accessToken(),f.api.accessToken()]),['new','new']);assert.equal(calls,1);assert.equal(f.get().tokens.refresh_token,'test-refresh');
});
test('연결 해제 중 완료된 토큰 갱신이 인증을 되살리지 않는다',async()=>{
 let release;const f=fixture(async()=>new Promise(resolve=>{release=()=>resolve(json({access_token:'late'}));}));f.set({...f.get(),tokens:{...f.get().tokens,expires_at:0}});
 const pending=f.api.accessToken();f.api.disconnect();release();await assert.rejects(pending,/해제/);assert.equal(f.get().tokens,undefined);
});
test('일정 조회는 페이지를 모두 읽고 반복 일정의 회차를 요청한다',async()=>{
 let calls=0;const f=fixture(async(url,options)=>{const u=new URL(url);assert.equal(options.headers.Authorization,'Bearer test-token');assert.equal(u.searchParams.get('singleEvents'),'true');calls++;return calls===1?json({items:[{id:'first',summary:'회의',start:{date:'2026-10-29'},end:{date:'2026-10-30'}}],nextPageToken:'next'}):json({items:[{id:'cancelled',status:'cancelled'},{id:'second',summary:'다음 일정',start:{date:'2026-10-30'},end:{date:'2026-10-31'}}]});});
 const events=await f.api.list({start:'2026-10-01',end:'2026-11-10'});assert.equal(calls,2);assert.deepEqual(events.map(e=>e.id),['first','second']);
 await assert.rejects(f.api.list({start:'bad',end:'bad'}));
});
test('등록에는 재시도용 고정 ID, 수정과 삭제에는 etag를 보낸다',async()=>{
 const calls=[];const f=fixture(async(url,options)=>{calls.push({url,...options});return options.method==='DELETE'?new Response(null,{status:204}):json({id:'event'});});
 await f.api.upsert(input);await f.api.upsert({...input,id:'event',etag:'etag-1'});await f.api.remove({id:'event',etag:'etag-1'});
 assert.equal(JSON.parse(calls[0].body).id,input.requestId);assert.equal(calls[1].headers['If-Match'],'etag-1');assert.equal(calls[2].method,'DELETE');assert.equal(calls[2].headers['If-Match'],'etag-1');
 await assert.rejects(f.api.upsert({...input,id:'event'}));await assert.rejects(f.api.remove({id:'../bad',etag:'etag'}));
});
test('충돌/권한 오류는 안전한 안내를 반환하고 Google 응답 본문은 노출하지 않는다',async()=>{
 const f=fixture(async()=>json({error:'sensitive remote body'},412));await assert.rejects(f.api.upsert({...input,id:'event',etag:'old'}),/다른 PC/);
 const g=fixture(async()=>json({error:'sensitive remote body'},403));await assert.rejects(g.api.list({start:'2026-10-01',end:'2026-11-01'}),/권한/);
});
