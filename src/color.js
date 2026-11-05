(function(root){
  function normalize(value){return typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)?value.toLowerCase():'#182625';}
  function rgb(hex){hex=normalize(hex);return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));}
  function hsvToHex(h,s,v){
    const c=v*s,x=c*(1-Math.abs((h/60)%2-1)),m=v-c;
    const parts=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];
    return '#'+parts.map(p=>Math.round((p+m)*255).toString(16).padStart(2,'0')).join('');
  }
  function hexToHsv(hex){
    const [r,g,b]=rgb(hex).map(x=>x/255),max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
    let h=0;if(d)h=max===r?60*(((g-b)/d)%6):max===g?60*((b-r)/d+2):60*((r-g)/d+4);
    return {h:(h+360)%360,s:max===0?0:d/max,v:max};
  }
  const api={normalize,rgb,hsvToHex,hexToHsv};
  if(typeof module!=='undefined')module.exports=api;else root.Color=api;
})(globalThis);
