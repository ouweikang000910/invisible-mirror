export const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, Number(v) || 0));
export function normalizeBox([x,y,w,h], width, height, pad = 0) {
  const left=clamp(x/width-pad), top=clamp(y/height-pad);
  return {x:left,y:top,w:Math.max(0,clamp((x+w)/width+pad)-left),h:Math.max(0,clamp((y+h)/height+pad)-top)};
}
export function dragBox(a,b){return {x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),w:Math.abs(a.x-b.x),h:Math.abs(a.y-b.y)}}
export function classifyText(text) {
 const clean=text.replace(/\s+/g,' ').trim();
 if (/(?:[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\+?86[-\s]?)?1[3-9]\d{9})/i.test(clean)) return ['联系信息','文字中可能含电话或邮箱，请确认是否需要遮挡'];
 if (/通告|剧本|保密|未公开|CALL\s*SHEET|CONFIDENTIAL|SCRIPT/i.test(clean)) return ['工作资料','可能涉及工作安排或未公开内容，请核对'];
 if (/房号|房间|酒店|ROOM|HOTEL|\b\d{3,5}\b/i.test(clean)) return ['位置或数字线索','文字中含房间、酒店或数字线索，请确认含义'];
 return ['可读文字','请确认这些文字是否可以公开'];
}
export function textFindings(blocks,width,height) {
 const result=[];
 for (const block of blocks??[]) for(const line of (block.paragraphs??[]).flatMap(p=>p.lines??[])) {
  const words=(line.words??[]).filter(w=>w.confidence>=45 && /[\p{L}\p{N}]/u.test(w.text??''));
  if(!words.length)continue;
  const text=words.map(w=>w.text).join(' ').slice(0,400);
  if(!/[A-Za-z]{3,}|[\p{Script=Han}]{2,}|\d{3,}/u.test(text))continue;
  const x=Math.min(...words.map(w=>w.bbox.x0)),y=Math.min(...words.map(w=>w.bbox.y0));
  const right=Math.max(...words.map(w=>w.bbox.x1)),bottom=Math.max(...words.map(w=>w.bbox.y1));
  const [title,detail]=classifyText(text);
  result.push({kind:'text',title,detail,evidence:text,box:normalizeBox([x,y,right-x,bottom-y],width,height,.01),confidence:Math.round(words.reduce((s,w)=>s+w.confidence,0)/words.length)});
 }
 return result.slice(0,40);
}
export function objectFindings(predictions,width,height,includeMain=false) {
 const people=predictions.filter(p=>p.class==='person'&&p.score>=.35).sort((a,b)=>b.bbox[2]*b.bbox[3]-a.bbox[2]*a.bbox[3]);
 const findings=people.slice(includeMain?0:1).map(p=>({kind:'person',title:'其他人物',detail:'确认此人是否方便出镜。镜面中的人物也可能出现在此处',evidence:'检测到人物区域，未识别身份',box:normalizeBox(p.bbox,width,height,.01),confidence:Math.round(p.score*100)}));
 for(const p of predictions.filter(p=>['laptop','tv'].includes(p.class)&&p.score>=.45))findings.push({kind:'screen',title:'屏幕区域',detail:'请检查屏幕是否显示了聊天、文件或其他私人信息',evidence:'设备区域候选，需人工确认屏幕内容',box:normalizeBox(p.bbox,width,height,.005),confidence:Math.round(p.score*100)});
 return {findings,peopleCount:people.length};
}
export function hasLocation(meta){return meta!=null && ['latitude','longitude','GPSLatitude','GPSLongitude','GPSPosition'].some(k=>meta[k]!=null)}
export function associations(items){
 const seen=new Map();
 for(const item of items.filter(i=>i.scanState==='done'||i.scanState==='partial')){
  const text=item.findings.filter(f=>f.kind==='text').map(f=>f.evidence).join(' ');
  const tokens=new Set(text.match(/\b\d{3,5}\b|[\p{Script=Han}]{2,8}(?:酒店|路|街|大厦)|\b(?:hotel|room)\s+[\w-]+/giu)??[]);
  for(const token of tokens){const key=token.toLowerCase();if(!seen.has(key))seen.set(key,[]);seen.get(key).push({id:item.id,name:item.name});}
 }
 return [...seen.entries()].filter(([,files])=>files.length>1).map(([token,files])=>({token,files}));
}
export function exportName(name){return (name.replace(/\.[^.]+$/,'').replace(/[\\/:*?"<>|]/g,'_')||'photo')+'_隐形镜.jpg'}
