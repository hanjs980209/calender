const {test}=require('node:test');
const assert=require('node:assert/strict');
const {dateKey,monthDays,validData}=require('../src/calendar.js');
test('월간 달력은 윤년 2월 29일을 포함하며 일요일부터 42일을 표시한다',()=>{
 const days=monthDays(2024,1);assert.equal(days.length,42);assert.equal(days[0].getDay(),0);assert(days.some(d=>dateKey(d)==='2024-02-29'));
 for(let i=1;i<days.length;i++){const next=new Date(days[i-1]);next.setDate(next.getDate()+1);assert.equal(dateKey(days[i]),dateKey(next));}
});
test('월요일 시작과 연도 경계를 처리한다',()=>{
 const days=monthDays(2026,0,true);assert.equal(dateKey(days[0]),'2025-12-29');assert.equal(days[0].getDay(),1);
});
test('메모 백업 구조를 검증하고 잘못된 입력을 거부한다',()=>{
 const data={version:1,notes:{'2026-10-29':[{id:'one',text:'일정',done:false,color:'mint'}]}};
 assert(validData(data));assert(!validData({...data,version:2}));assert(!validData({version:1,notes:[]}));assert(!validData({version:1,notes:{bad:[]}}));
 data.notes['2026-10-29'][0].color='unexpected';assert(!validData(data));
});
