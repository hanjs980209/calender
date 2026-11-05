/* global PaneLayout */
const DaySplitter=(()=>{
  function mount({value,onInput,onChange}){
    const layout=document.querySelector('.calendar-layout'),handle=document.getElementById('day-splitter'),sidebar=document.getElementById('my-day-pane');
    let ratio=PaneLayout.validRatio(value)?value:null,frame=0,drag=null,keyboardDirty=false,metrics;
    function available(){const style=getComputedStyle(layout);return layout.getBoundingClientRect().width-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight)-handle.getBoundingClientRect().width;}
    function draw(){
      frame=0;const width=available();if(width<=0)return;
      metrics=PaneLayout.measure(width,ratio);
      if(ratio===null){ratio=metrics.right/width;onInput(ratio);}
      layout.style.setProperty('--my-day-width',metrics.right+'px');sidebar.style.setProperty('--my-day-scale',String(metrics.scale));
      handle.setAttribute('aria-valuemin',String(Math.round(metrics.minRight)));handle.setAttribute('aria-valuemax',String(Math.round(metrics.maxRight)));handle.setAttribute('aria-valuenow',String(Math.round(metrics.right)));
      handle.setAttribute('aria-valuetext',`MY DAY ${Math.round(metrics.right)}px, 달력 ${Math.round(metrics.left)}px`);
    }
    function schedule(){if(!frame)frame=requestAnimationFrame(draw);}
    function resize(right){const width=available();if(width<=0)return;const bounds=PaneLayout.measure(width,ratio);const clamped=Math.max(bounds.minRight,Math.min(bounds.maxRight,right));
      metrics=PaneLayout.measure(width,clamped/width);ratio=metrics.right/width;onInput(ratio);schedule();}
    function commit(){onChange(ratio);}
    handle.onpointerdown=event=>{
      if(event.button!==0||!event.isPrimary)return;
      event.preventDefault();handle.focus();draw();drag={x:event.clientX,right:metrics.right};
      layout.classList.add('resizing-panes');handle.setPointerCapture(event.pointerId);
    };
    handle.onpointermove=event=>{if(drag)resize(drag.right+drag.x-event.clientX);};
    function end(){if(!drag)return;drag=null;layout.classList.remove('resizing-panes');commit();}
    handle.onpointerup=handle.onpointercancel=handle.onlostpointercapture=end;
    const keys=['ArrowLeft','ArrowRight','Home','End','Enter'];
    handle.onkeydown=event=>{
      if(!keys.includes(event.key))return;
      event.preventDefault();event.stopPropagation();draw();const step=event.shiftKey?32:16;
      resize(event.key==='ArrowLeft'?metrics.right+step:event.key==='ArrowRight'?metrics.right-step:event.key==='Home'?metrics.minRight:event.key==='End'?metrics.maxRight:PaneLayout.DEFAULT_WIDTH);
      keyboardDirty=true;
    };
    handle.onkeyup=event=>{if(keys.includes(event.key)&&keyboardDirty){keyboardDirty=false;commit();}};
    handle.onblur=()=>{end();if(keyboardDirty){keyboardDirty=false;commit();}};
    handle.ondblclick=()=>{resize(PaneLayout.DEFAULT_WIDTH);commit();};
    const observer=new ResizeObserver(schedule);observer.observe(layout);draw();
    return {set(value){const next=PaneLayout.validRatio(value)?value:null;if(next===ratio)return;ratio=next;draw();}};
  }
  return {mount};
})();
