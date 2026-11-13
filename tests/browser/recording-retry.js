'use strict';
const qaSleep=ms=>new Promise(r=>setTimeout(r,ms)),qaReport=text=>parent.document.getElementById('report').textContent+=text+'\n';
async function qaUntil(fn,ms=12000){const end=performance.now()+ms;while(!fn()){if(performance.now()>end)throw Error('Timeout: '+fn.toString());await qaSleep(25);}}
const qaCheck=(v,text)=>{if(!v)throw Error(text);qaReport('PASS '+text);};
window.runRecordingAudit=async()=>{try{
 // Match Start take: prime the soundtrack from this explicit user gesture.
 await dance.referenceAudio.prime();
 const source=await fetch('/__tone.mp4').then(r=>r.blob()),dt=new DataTransfer();dt.items.add(new File([source],'retry-audit.mp4',{type:'video/mp4',lastModified:1}));file.files=dt.files;file.dispatchEvent(new Event('change'));await qaUntil(()=>video.readyState>=3);pausePlayback();
 const rawCanvas=document.createElement('canvas');rawCanvas.width=720;rawCanvas.height=1280;const ctx=rawCanvas.getContext('2d');let frame=0;const paint=()=>{ctx.fillStyle=frame%2?'#8762c0':'#9672d0';ctx.fillRect(0,0,720,1280);ctx.fillStyle='#fff';ctx.font='60px sans-serif';ctx.fillText('CAMERA '+frame++,60,640);requestAnimationFrame(paint);};paint();
 // Optional fault injection for the WebKit-style frozen frame callback case.
 if(new URLSearchParams(parent.location.search).has('faults')){
  const Original=SlowMoCamera.CameraFrames;
  SlowMoCamera.CameraFrames=class extends Original{constructor(source,direction){
   if(source.requestVideoFrameCallback){const request=source.requestVideoFrameCallback.bind(source);source.requestVideoFrameCallback=cb=>request((now,meta)=>cb(now,{...meta,mediaTime:0}));}
   super(source,direction);const draw=this.context.drawImage.bind(this.context);let fail=true;
   this.context.drawImage=(...args)=>{if(fail){fail=false;throw new DOMException('Injected temporary camera pixel loss','InvalidStateError');}return draw(...args);};
  }};qaReport('Fault injection: repeated frame timestamps and one transient draw failure per camera');
 }
 let cameras=0;navigator.mediaDevices.getUserMedia=async()=>{cameras++;return rawCanvas.captureStream(30);};SlowMoCamera.orientation=()=> 'portrait';
 setSpeed(.65);loopA=2;loopB=4.6;loopOn=true;renderLoop();$('prepareSeconds').value='0';$('recordAudio').value='reference';dance.setRecordReference('split');dance.openPractice();await dance.enableCamera();
 const sensor=$('cameraSource'),sensorBox=sensor.getBoundingClientRect();
 qaCheck(sensor.closest('#practiceDialog')&&!sensor.closest('[inert]'),'Camera source is inside active framing, outside inert viewer');
 qaCheck(getComputedStyle(sensor).opacity==='1'&&sensorBox.width>100&&sensorBox.height>100,'Camera source has a visible full-size framing surface');
 qaCheck(dance.cameraFrames.canvas.parentElement===$('cameraPreviewHost')&&$('cameraPreview').paused,'Framing displays normalized canvas without a second video decoder');
 dance.mountCameraSource(false);$('practiceDialog').close();
 const attempts=[];for(let i=0;i<4;i++){
  if(!i)await dance.startMemory(true);else{const pending=dance.retry();if(i===1)dance.retry();await pending;}
  await qaUntil(()=>dance.session?.playing&&dance.isRecording);const active=dance.session,encoder=dance.recorder;
  qaCheck($('cameraPreview').paused,'Attempt '+(i+1)+': hidden setup preview is paused');qaCheck(video.playbackRate===preferred,'Attempt '+(i+1)+': reference keeps selected speed');
  const copied=dance.cameraFrames.framesDrawn;await qaSleep(i===3?800:i===2?6500:1700);qaCheck(dance.cameraFrames.framesDrawn>copied+2,'Attempt '+(i+1)+': camera processing keeps advancing');dance.stopRecording();await qaUntil(()=>dance.lastTake&&dance.session===active&&!dance.locked);const take=dance.lastTake;await qaUntil(()=>take.savedLocally||take.storageStatus?.includes('failed'));
  const data=await take.blob.arrayBuffer(),bytes=data.byteLength,audioCtx=new AudioContext();const decoded=await audioCtx.decodeAudioData(data),samples=decoded.getChannelData(0),windowSize=Math.round(decoded.sampleRate*.01),rms=[];
  for(let n=0;n+windowSize<=samples.length;n+=windowSize){let energy=0;for(let j=0;j<windowSize;j++)energy+=samples[n+j]*samples[n+j];rms.push(Math.sqrt(energy/windowSize));}
  let first=rms.findIndex(n=>n>.01),last=rms.findLastIndex(n=>n>.01),quiet=0,maxQuiet=0;for(let n=first+15;n<last-15;n++){quiet=rms[n]<.005?quiet+1:0;maxQuiet=Math.max(maxQuiet,quiet);}
  qaCheck(first>=0&&last-first>40,'Attempt '+(i+1)+': saved reference music is audible');qaCheck(maxQuiet<=1,'Attempt '+(i+1)+': no internal audio cut longer than 10 ms in tone test');qaCheck(take.mapping.scale===1/take.rate,'Attempt '+(i+1)+': correct fixed-speed time mapping');qaCheck(take.mapping.practiceAnchor>.03,'Attempt '+(i+1)+': encoder lead-in is included in sync');
  attempts.push({rate:take.rate,anchor:take.mapping.practiceAnchor,audioOnset:first*.01,quietGap:maxQuiet*.01,bytes,encodedDuration:decoded.duration});await audioCtx.close();await dance.reviewTake();await qaUntil(()=>dance.isComparing&&!dance.pairBusy);await dance.playPair();await qaSleep(300);pausePlayback();qaCheck(Math.abs(dance.mapping.practiceAtReference(video.currentTime)-$('practiceVideo').currentTime)/dance.mapping.scale<.12,'Attempt '+(i+1)+': post-recording review aligned');qaCheck(player.classList.contains('immersive'),'Attempt '+(i+1)+': immersive view retained');
  if(i===1){dance.lastTake.rate=1;dance.lastTake.loopState={a:2,b:11.4,on:true};}
 }
 qaCheck(cameras===4,'Repeated / double-tapped Retry opens exactly one camera per attempt');const differences=attempts.map(a=>a.audioOnset-a.anchor),spread=Math.max(...differences)-Math.min(...differences);qaCheck(spread<.15,'Encoded audio onset versus sync offset remains stable across retries');qaReport(JSON.stringify({attempts,onsetSpread:spread,cameras},null,2));qaReport('RETRY AUDIT COMPLETE');
 }catch(e){qaReport('FAIL '+e.stack);pausePlayback();}};
