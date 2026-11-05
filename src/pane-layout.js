(function(root){
  const DEFAULT_WIDTH=235;
  function validRatio(value){return typeof value==='number'&&Number.isFinite(value)&&value>0&&value<1;}
  function measure(available,ratio){
    available=Math.max(0,Number.isFinite(available)?available:0);
    const minLeft=Math.min(350,available*.6),minRight=Math.min(190,available*.4);
    const maxRight=Math.max(minRight,Math.min(600,available-minLeft));
    const requested=validRatio(ratio)?available*ratio:DEFAULT_WIDTH;
    const right=Math.max(minRight,Math.min(maxRight,requested));
    return {right,left:available-right,minRight,maxRight,scale:Math.max(1,Math.min(2,right/DEFAULT_WIDTH))};
  }
  const api={DEFAULT_WIDTH,validRatio,measure};
  if(typeof module!=='undefined')module.exports=api;else root.PaneLayout=api;
})(globalThis);
