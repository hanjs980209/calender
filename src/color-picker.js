/* global Color */
const BackgroundPicker=(()=>{
  function mount({value,onInput,onChange}){
    const canvas=document.getElementById('background-wheel'),context=canvas.getContext('2d');
    const brightness=document.getElementById('background-brightness'),hexInput=document.getElementById('background-hex');
    const preview=document.getElementById('background-preview'),error=document.getElementById('background-error');
    let hex=Color.normalize(value),hsv=Color.hexToHsv(hex),dragging=false,frame=0;
    const radius=canvas.width/2-5,cx=canvas.width/2,cy=canvas.height/2;
    const disk=document.createElement('canvas');disk.width=canvas.width;disk.height=canvas.height;
    const diskContext=disk.getContext('2d'),image=diskContext.createImageData(canvas.width,canvas.height);
    for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
      const dx=x-cx,dy=y-cy,distance=Math.hypot(dx,dy);if(distance>radius)continue;
      const h=(Math.atan2(dy,dx)*180/Math.PI+360)%360;
      const color=Color.rgb(Color.hsvToHex(h,distance/radius,1)),i=(y*canvas.width+x)*4;
      image.data[i]=color[0];image.data[i+1]=color[1];image.data[i+2]=color[2];image.data[i+3]=255;
    }
    diskContext.putImageData(image,0,0);
    function render(){
      frame=0;context.clearRect(0,0,canvas.width,canvas.height);context.drawImage(disk,0,0);
      context.save();context.beginPath();context.arc(cx,cy,radius,0,2*Math.PI);context.clip();
      context.fillStyle=`rgba(0,0,0,${1-hsv.v})`;context.fillRect(0,0,canvas.width,canvas.height);context.restore();
      const angle=hsv.h*Math.PI/180,x=cx+Math.cos(angle)*hsv.s*radius,y=cy+Math.sin(angle)*hsv.s*radius;
      context.beginPath();context.arc(x,y,5,0,2*Math.PI);context.strokeStyle='#10201a';context.lineWidth=4;context.stroke();context.strokeStyle='#ffffff';context.lineWidth=2;context.stroke();
    }
    function show(){
      error.textContent='';hexInput.removeAttribute('aria-invalid');
      brightness.value=Math.round(hsv.v*100);document.getElementById('background-brightness-label').textContent=Math.round(hsv.v*100)+'%';
      hexInput.value=hex;preview.style.backgroundColor=hex;
      canvas.setAttribute('aria-valuenow',String(Math.round(hsv.h)%360));canvas.setAttribute('aria-valuetext',`${hex}, 채도 ${Math.round(hsv.s*100)}%, 밝기 ${Math.round(hsv.v*100)}%`);
      if(!frame)frame=requestAnimationFrame(render);
    }
    function update(commit){hex=Color.hsvToHex(hsv.h,hsv.s,hsv.v);show();onInput(hex);if(commit)onChange(hex);}
    function point(event){
      const rect=canvas.getBoundingClientRect();const dx=(event.clientX-rect.left)*canvas.width/rect.width-cx,dy=(event.clientY-rect.top)*canvas.height/rect.height-cy;
      hsv.h=(Math.atan2(dy,dx)*180/Math.PI+360)%360;hsv.s=Math.min(1,Math.hypot(dx,dy)/radius);update(false);
    }
    canvas.onpointerdown=event=>{event.preventDefault();canvas.focus();dragging=true;canvas.setPointerCapture(event.pointerId);point(event);};
    canvas.onpointermove=event=>{if(dragging)point(event);};
    canvas.onpointerup=canvas.onpointercancel=()=>{if(dragging){dragging=false;onChange(hex);}};
    canvas.onkeydown=event=>{
      if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))return;
      event.preventDefault();event.stopPropagation();
      if(event.key==='ArrowLeft')hsv.h=(hsv.h+357)%360;if(event.key==='ArrowRight')hsv.h=(hsv.h+3)%360;
      if(event.key==='ArrowUp')hsv.s=Math.min(1,hsv.s+.05);if(event.key==='ArrowDown')hsv.s=Math.max(0,hsv.s-.05);
      if(event.key==='Home')hsv.s=0;if(event.key==='End')hsv.s=1;update(true);
    };
    brightness.oninput=()=>{hsv.v=Number(brightness.value)/100;update(false);};brightness.onchange=()=>onChange(hex);
    hexInput.onchange=()=>{
      const candidate=hexInput.value.startsWith('#')?hexInput.value:'#'+hexInput.value;
      if(!/^#[0-9a-f]{6}$/i.test(candidate)){error.textContent='HEX 코드를 #123abc 형식으로 입력하세요.';hexInput.setAttribute('aria-invalid','true');return;}
      error.textContent='';hexInput.removeAttribute('aria-invalid');hex=Color.normalize(candidate);hsv=Color.hexToHsv(hex);show();onInput(hex);onChange(hex);
    };
    document.getElementById('background-reset').onclick=()=>{hex='#182625';hsv=Color.hexToHsv(hex);show();onInput(hex);onChange(hex);};
    show();
    return {set(value){const next=Color.normalize(value);if(next===hex)return;hex=next;hsv=Color.hexToHsv(hex);show();}};
  }
  return {mount};
})();
