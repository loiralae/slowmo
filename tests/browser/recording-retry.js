'use strict';
const qaSleep=ms=>new Promise(r=>setTimeout(r,ms)),qaReport=text=>parent.document.getElementById('report').textContent+=text+'\n';
async function qaUntil(fn,ms=12000){const end=performance.now()+ms;while(!fn()){if(performance.now()>end)throw Error('Timeout: '+fn.toString());await qaSleep(25);}}
const qaCheck=(v,text)=>{if(!v)throw Error(text);qaReport('PASS '+text);};
function qaCameraFills(host,label){
 const camera=$('cameraSource'),picture=camera.getBoundingClientRect(),pane=$(host).getBoundingClientRect();
 qaCheck(Math.abs(picture.width-pane.width)<1&&Math.abs(picture.height-pane.height)<1,label+': camera element fills its pane');
 qaCheck(Math.abs(picture.x-pane.x)<1&&Math.abs(picture.y-pane.y)<1,label+': camera is centered without an extra inset');
 qaCheck(getComputedStyle(camera).objectFit==='contain',label+': aspect ratio is preserved with one native fit');
}
async function qaCameraLayout(){
 const frame=parent.document.getElementById('app');let checks=0;
 for(const [width,height] of [[756,1126],[1126,756]]){
  frame.style.width=width+'px';frame.style.height=height+'px';await qaSleep(100);
  for(const ratio of ['0.5625','1','1.777777778']){$('cameraSource').style.setProperty('--camera-ratio',ratio);qaCameraFills('cameraPreviewHost',width+'x'+height+' setup, cached ratio '+ratio);checks++;}
 }
 frame.style.width='756px';frame.style.height='1126px';await qaSleep(100);
 await dance.startMemory(true);await qaUntil(()=>dance.session?.playing&&dance.isRecording);
 const recorder=dance.recorder,session=dance.session,stream=dance.stream;
 for(const [width,height] of [[756,1126],[1126,756]]){
  frame.style.width=width+'px';frame.style.height=height+'px';await qaSleep(100);
  for(const mode of ['split','hidden'])for(const safe of [false,true]){
   document.documentElement.style.setProperty('--safe-top',safe?'32px':'0px');document.documentElement.style.setProperty('--safe-bottom',safe?'20px':'0px');dance.setRecordReference(mode);
   for(const ratio of ['0.5625','1','1.777777778']){$('cameraSource').style.setProperty('--camera-ratio',ratio);qaCameraFills('recordMonitor',width+'x'+height+' '+mode+', safe area '+safe+', cached ratio '+ratio);checks++;
    if(mode==='split')qaCheck(Math.abs($('recordMonitor').getBoundingClientRect().width-$('referenceStage').getBoundingClientRect().width)<1,'Both recording panes have equal width');
    qaCheck(dance.recorder===recorder&&dance.session===session&&dance.stream===stream&&dance.isRecording,'Layout changes preserve the active native recording');
   }
  }
 }
 frame.style.width='756px';frame.style.height='1126px';document.documentElement.style.setProperty('--safe-top','32px');document.documentElement.style.setProperty('--safe-bottom','20px');dance.setRecordReference('split');$('cameraSource').style.setProperty('--camera-ratio','1');
 qaReport('LAYOUT AUDIT COMPLETE: '+checks+' cases');const complete=parent.document.createElement('span');complete.id='layoutDone';complete.textContent='Layout checks passed';parent.document.body.append(complete);
}
async function qaSavedMotion(blob){
 const probe=document.createElement('video'),strip=document.createElement('canvas');strip.width=320;strip.height=1;const pixels=strip.getContext('2d',{willReadFrequently:true});
 probe.muted=true;probe.playsInline=true;probe.style.cssText='position:fixed;top:300px;right:0;width:160px;height:284px;z-index:100;pointer-events:none';document.body.append(probe);
 const url=URL.createObjectURL(blob);probe.src=url;let callback=0,done=false,first=null,last=0,changes=0,previous=null;
 try{return await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('Saved video did not finish decoding')),30000);
  const tick=(now,meta)=>{if(done)return;pixels.drawImage(probe,20,110,320,1,0,0,320,1);const data=pixels.getImageData(0,0,320,1).data;let signature=0;for(let bit=0;bit<8;bit++)if(data[(bit*40+20)*4]>128)signature|=1<<bit;
   if(signature!==previous){changes++;previous=signature;}if(first===null)first=meta.mediaTime;last=meta.mediaTime;callback=probe.requestVideoFrameCallback(tick);
  };
  probe.onended=()=>{clearTimeout(timer);const duration=Math.max(.01,Number.isFinite(probe.duration)&&probe.duration>0?probe.duration:probe.currentTime);resolve({width:probe.videoWidth,height:probe.videoHeight,decodedFrames:probe.getVideoPlaybackQuality().totalVideoFrames,observedPictureChanges:changes,decodedFramesPerSecond:probe.getVideoPlaybackQuality().totalVideoFrames/duration,duration});};
  probe.onerror=()=>{clearTimeout(timer);reject(Error('Saved camera video could not be decoded'));};callback=probe.requestVideoFrameCallback(tick);probe.play().catch(e=>{clearTimeout(timer);reject(e);});
 });}finally{done=true;probe.cancelVideoFrameCallback(callback);probe.pause();probe.removeAttribute('src');probe.load();probe.remove();URL.revokeObjectURL(url);}
}
window.runRecordingAudit=async()=>{try{
 // Match Start take: prime the soundtrack from this explicit user gesture.
 await dance.referenceAudio.prime();
 const source=await fetch('/__tone.mp4').then(r=>r.blob()),dt=new DataTransfer();dt.items.add(new File([source],'retry-audit.mp4',{type:'video/mp4',lastModified:1}));file.files=dt.files;file.dispatchEvent(new Event('change'));await qaUntil(()=>video.readyState>=3);pausePlayback();
 const landscape=new URLSearchParams(parent.location.search).has('landscape');const rawCanvas=document.createElement('canvas');rawCanvas.width=landscape?1280:720;rawCanvas.height=landscape?720:1280;const ctx=rawCanvas.getContext('2d');let frame=0;const paint=()=>{ctx.fillStyle=frame%2?'#8762c0':'#9672d0';ctx.fillRect(0,0,rawCanvas.width,rawCanvas.height);for(let bit=0;bit<8;bit++){ctx.fillStyle=frame&(1<<bit)?'#fff':'#000';ctx.fillRect(20+40*bit,100,40,40);}ctx.fillStyle='#fff';ctx.font='60px sans-serif';ctx.fillText('CAMERA '+frame++,60,rawCanvas.height/2);};paint();
 // Camera capture must no longer depend on the old canvas-copy pipeline.
 SlowMoCamera.CameraFrames=class{constructor(){throw Error('Native recording must never create a canvas camera pipeline');}};
 if(new URLSearchParams(parent.location.search).has('faults'))qaReport('Legacy canvas pipeline disabled: native capture must remain unaffected');
 let cameras=0;navigator.mediaDevices.getUserMedia=async()=>{cameras++;
  // Inject camera frames independently of page/compositor RAF. A canvas
  // capture source would reproduce throttling in the test fixture itself.
  if(!window.MediaStreamTrackGenerator||!window.VideoFrame)throw Error('Native motion QA requires the Chrome track generator');
  const track=new MediaStreamTrackGenerator({kind:'video'}),writer=track.writable.getWriter(),epoch=performance.now();let busy=false;
  const timer=setInterval(async()=>{if(track.readyState==='ended'){clearInterval(timer);writer.close().catch(()=>{});return;}if(busy)return;busy=true;paint();const picture=new VideoFrame(rawCanvas,{timestamp:Math.round((performance.now()-epoch)*1000)});try{await writer.write(picture);}catch{}finally{picture.close();busy=false;}},1000/30);
  return new MediaStream([track]);
 };SlowMoCamera.orientation=()=>landscape?'landscape':'portrait';$('cameraFacing').value='user';localStorage.setItem('slowmo-camera-mirror-user','false');
 setSpeed(.65);loopA=2;loopB=new URLSearchParams(parent.location.search).has('layout')?13.5:4.6;loopOn=true;renderLoop();$('prepareSeconds').value='0';$('recordAudio').value='reference';dance.setRecordReference('split');dance.openPractice();await dance.enableCamera();
 const sensor=$('cameraSource'),sensorBox=sensor.getBoundingClientRect();
 qaCheck(sensor.closest('#practiceDialog')&&!sensor.closest('[inert]'),'Camera source is inside active framing, outside inert viewer');
 qaCheck(getComputedStyle(sensor).opacity==='1'&&sensorBox.width>100&&sensorBox.height>100,'Camera source has a visible full-size framing surface');
 qaCameraFills('cameraPreviewHost','Native framing');
 qaCheck(!dance.cameraFrames&&$('cameraPreview').paused,'Framing uses native camera without a canvas overlay or second decoder');
 qaCheck(getComputedStyle(sensor).transform.startsWith('matrix(-1,'),'Front camera starts mirrored despite a legacy saved off preference');
 qaCheck(getComputedStyle($('cameraPreviewHost')).transform==='none','Framing parent does not mirror a second time');
 if(new URLSearchParams(parent.location.search).has('layout')){await qaCameraLayout();return;}
 if(new URLSearchParams(parent.location.search).has('framing')){qaReport('NATIVE FRAMING READY');return;}
 $('practiceDialog').close();
 const attempts=[];for(let i=0;i<4;i++){
  if(!i)await dance.startMemory(true);else{const pending=dance.retry();if(i===1)dance.retry();await pending;}
  await qaUntil(()=>dance.session?.playing&&dance.isRecording);const active=dance.session,encoder=dance.recorder;
  qaCameraFills('recordMonitor','Attempt '+(i+1));qaCheck($('cameraPreview').paused,'Attempt '+(i+1)+': hidden setup preview is paused');qaCheck(sensor.parentElement===$('recordMonitor')&&sensor.getBoundingClientRect().width>100,'Attempt '+(i+1)+': same native camera remains full size');qaCheck(getComputedStyle(sensor).transform.startsWith('matrix(-1,')&&getComputedStyle($('recordMonitor')).transform==='none','Attempt '+(i+1)+': native camera has exactly one selfie transform');qaCheck(video.playbackRate===preferred,'Attempt '+(i+1)+': reference keeps selected speed');
  qaCheck(dance.recorder.stream.getVideoTracks()[0]===dance.stream.getVideoTracks()[0]&&!dance.cameraFrames,'Attempt '+(i+1)+': encoder uses the original camera track without canvas copies');await qaSleep(i===3?800:i===2?6500:1700);dance.stopRecording();await qaUntil(()=>dance.lastTake&&dance.session===active&&!dance.locked);const take=dance.lastTake;await qaUntil(()=>take.savedLocally||take.storageStatus?.includes('failed'));
  const motion=await qaSavedMotion(take.blob);qaReport('Saved motion: '+JSON.stringify(motion));const savedLink=parent.document.createElement('a');savedLink.textContent='Download attempt '+(i+1);savedLink.download='slowmo-motion-'+(i+1)+'.'+(take.blob.type.includes('mp4')?'mp4':'webm');savedLink.href=URL.createObjectURL(take.blob);parent.document.body.append(savedLink);qaCheck(motion.width===rawCanvas.width&&motion.height===rawCanvas.height,'Attempt '+(i+1)+': saved camera orientation matches preview');qaCheck(motion.decodedFramesPerSecond>=20,'Attempt '+(i+1)+': saved video decodes at least 20 camera frames per second');
  if(i===2){const link=parent.document.createElement('a');link.textContent='Download recorded motion QA';link.download='slowmo-native-recording-qa.'+(take.blob.type.includes('mp4')?'mp4':'webm');link.href=URL.createObjectURL(take.blob);parent.document.body.append(link);}
  const data=await take.blob.arrayBuffer(),bytes=data.byteLength,audioCtx=new AudioContext();const decoded=await audioCtx.decodeAudioData(data),samples=decoded.getChannelData(0),windowSize=Math.round(decoded.sampleRate*.01),rms=[];
  for(let n=0;n+windowSize<=samples.length;n+=windowSize){let energy=0;for(let j=0;j<windowSize;j++)energy+=samples[n+j]*samples[n+j];rms.push(Math.sqrt(energy/windowSize));}
  let first=rms.findIndex(n=>n>.01),last=rms.findLastIndex(n=>n>.01),quiet=0,maxQuiet=0;for(let n=first+15;n<last-15;n++){quiet=rms[n]<.005?quiet+1:0;maxQuiet=Math.max(maxQuiet,quiet);}
  qaCheck(first>=0&&last-first>40,'Attempt '+(i+1)+': saved reference music is audible');qaCheck(maxQuiet<=1,'Attempt '+(i+1)+': no internal audio cut longer than 10 ms in tone test');qaCheck(take.mapping.scale===1/take.rate,'Attempt '+(i+1)+': correct fixed-speed time mapping');qaCheck(take.mapping.practiceAnchor>.03,'Attempt '+(i+1)+': encoder lead-in is included in sync');
  attempts.push({motion,rate:take.rate,anchor:take.mapping.practiceAnchor,audioOnset:first*.01,quietGap:maxQuiet*.01,bytes,encodedDuration:decoded.duration});await audioCtx.close();await dance.reviewTake();await qaUntil(()=>dance.isComparing&&!dance.pairBusy);await dance.playPair();await qaSleep(300);pausePlayback();qaCheck(Math.abs(dance.mapping.practiceAtReference(video.currentTime)-$('practiceVideo').currentTime)/dance.mapping.scale<.12,'Attempt '+(i+1)+': post-recording review aligned');qaCheck(player.classList.contains('immersive'),'Attempt '+(i+1)+': immersive view retained');
  if(i===1){dance.lastTake.rate=1;dance.lastTake.loopState={a:2,b:11.4,on:true};}
 }
 qaCheck(cameras===4,'Repeated / double-tapped Retry opens exactly one camera per attempt');const differences=attempts.map(a=>a.audioOnset-a.anchor),spread=Math.max(...differences)-Math.min(...differences);qaCheck(spread<.15,'Encoded audio onset versus sync offset remains stable across retries');qaReport(JSON.stringify({attempts,onsetSpread:spread,cameras},null,2));qaReport('RETRY AUDIT COMPLETE');
 }catch(e){qaReport('FAIL '+e.stack);pausePlayback();}};
