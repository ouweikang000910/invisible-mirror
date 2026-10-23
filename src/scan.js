import {assetUrl} from './asset-url.js';
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';
import '@tensorflow/tfjs-backend-cpu';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import {createWorker} from 'tesseract.js';
import * as exifr from 'exifr';
import {objectFindings,textFindings,hasLocation} from './privacy.mjs';
let detectorPromise,ocrPromise;
let notify=()=>{};let ocrStart=.48,ocrSpan=.45;
async function detector(){
 if(!detectorPromise)detectorPromise=(async()=>{try{await tf.setBackend('webgl');await tf.ready();}catch{await tf.setBackend('cpu');await tf.ready();}return cocoSsd.load({base:'lite_mobilenet_v2',modelUrl:assetUrl('ai/coco/model.json')});})().catch(e=>{detectorPromise=null;throw e});
 return detectorPromise;
}
async function ocr(){
 if(!ocrPromise)ocrPromise=createWorker(['eng','chi_sim'],1,{workerPath:assetUrl('ai/tesseract/worker.min.js'),langPath:assetUrl('ai/tesseract/lang'),corePath:assetUrl('ai/tesseract/core'),workerBlobURL:false,logger:m=>{if(m.status==='recognizing text')notify('读取照片中的文字',ocrStart+(m.progress||0)*ocrSpan);}}).catch(e=>{ocrPromise=null;throw e});
 return ocrPromise;
}
export async function scanPhoto(item,{onProgress,includeMain=false}){
 notify=onProgress;const results={findings:[],engines:{},peopleCount:0};
 const c=document.createElement('canvas'),scale=Math.min(1,2000/item.canvas.width,2000/item.canvas.height);c.width=Math.round(item.canvas.width*scale);c.height=Math.round(item.canvas.height*scale);c.getContext('2d').drawImage(item.canvas,0,0,c.width,c.height);
 onProgress('读取原文件的元数据',.05);
 try{const meta=await exifr.parse(item.file,{gps:true,exif:true,tiff:true,xmp:true,icc:false,iptc:false});results.metadata={hasGPS:hasLocation(meta),hasCamera:!!(meta?.Make||meta?.Model),hasDate:!!(meta?.DateTimeOriginal||meta?.CreateDate)};results.engines.metadata='done';if(results.metadata.hasGPS)results.findings.push({kind:'gps',title:'文件包含定位信息',detail:'导出会重建照片文件，去除原始 GPS 与其他元数据',evidence:'发现 GPS 字段，未对拍摄地点进行推断'});}catch{results.engines.metadata='error';results.metadata={hasGPS:null};}
 onProgress('加载本地人物识别模型',.14);
 try{const model=await detector();onProgress('检查人物与屏幕区域',.3);const predictions=await model.detect(c,30,.35);const r=objectFindings(predictions,c.width,c.height,includeMain);results.findings.push(...r.findings);results.peopleCount=r.peopleCount;results.engines.objects='done';}catch(e){console.warn('Local object engine unavailable',e.message);results.engines.objects='error';}
 onProgress('加载本地中英文文字识别',.45);
 try{const worker=await ocr();const textCanvas=document.createElement('canvas');const textScale=Math.min(2,3000/item.canvas.width,3000/item.canvas.height);textCanvas.width=Math.round(item.canvas.width*textScale);textCanvas.height=Math.round(item.canvas.height*textScale);textCanvas.getContext('2d').drawImage(item.canvas,0,0,textCanvas.width,textCanvas.height);
  ocrStart=.48;ocrSpan=.22;await worker.setParameters({tessedit_pageseg_mode:'11'});const sparse=await worker.recognize(textCanvas,{}, {blocks:true});const candidates=textFindings(sparse.data.blocks,textCanvas.width,textCanvas.height);
  ocrStart=.72;ocrSpan=.23;await worker.setParameters({tessedit_pageseg_mode:'6'});const dense=await worker.recognize(textCanvas,{}, {blocks:true});
  for(const f of textFindings(dense.data.blocks,textCanvas.width,textCanvas.height).filter(f=>f.title!=='可读文字')){const overlaps=candidates.some(g=>{const a=f.box,b=g.box;const ix=Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)),iy=Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));return ix*iy/Math.min(a.w*a.h,b.w*b.h)>.5;});if(!overlaps)candidates.push(f);}
  results.findings.push(...candidates);results.engines.text='done';}catch(e){console.warn('Local OCR engine unavailable',e.message);results.engines.text='error';}
 results.findings=results.findings.map((f,i)=>({...f,id:item.id+'-f'+i,status:'pending'}));onProgress('检查完成',1);notify=()=>{};return results;
}
