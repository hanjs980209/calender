const {hsvToHex}=require('./color.js');
const PERSONAL_COLOR='#a9dbc6';
const SHARED_COLORS=['#9fc2e8','#e6b783','#c4b0ec','#e3a5bd','#85cfc4','#c9cf83','#efaaa0','#9eb0e9','#c8b49c','#8fc5a1','#d2a1d9','#d6c28e'];
const validColor=value=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value);
function calendarColors(items,overrides={}){
  const colors=new Map();let index=0;
  for(const item of [...items].sort((a,b)=>Number(!!b.primary)-Number(!!a.primary)||a.id.localeCompare(b.id))){
    const color=item.primary?PERSONAL_COLOR:SHARED_COLORS[index]||hsvToHex((index*137.508)%360,.4,.88);
    if(!item.primary)index++;
    colors.set(item.id,validColor(overrides[item.id])?overrides[item.id].toLowerCase():color);
  }
  return items.map(item=>({...item,color:colors.get(item.id)}));
}
module.exports={calendarColors,validColor,PERSONAL_COLOR};
