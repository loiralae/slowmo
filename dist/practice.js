(()=>{
'use strict';
const {TimeMapping,driftAction,recordingMapping}=SlowMoTimeline;
const practice=$('practiceVideo');
const waitEvent=(el,event,ms=6000,signal,action)=>SlowMoMedia.waitForEvent(el,event,{timeout:ms,signal,action});
const seekTo=(el,t,signal)=>SlowMoMedia.seek(el,t,{signal});
const decimals=t=>{const n=Math.max(0,Number.isFinite(t)?t:0);return clock(n)+'.'+String(Math.floor(n%1*100)).padStart(2,'0');};
function message(text){status.textContent=text;}
class DancePractice{
 constructor(){
  this.mode='watch';this.mapping=null;this.aligned=false;this.practiceURL=null;this.practiceDuration=0;this.pairWanted=false;this.pairBusy=false;this.pairBuffering=false;this.pairEpoch=0;this.pairTask=0;this.pairPending=null;this.pairAbort=null;this.internalReferenceTarget=null;this.practiceLoadAbort=null;this.lastCorrection=0;this.loadingId=0;
  this.stream=null;this.cameraRequest=0;this.recorder=null;this.lastTake=null;this.takeSaved=false;this.session=null;this.prepTimer=null;this.prepToken=0;this.internalPause=0;this.ignoreReferencePauses=0;this.sessionEpoch=0;this.stopReason='';this.referenceKey=null;this.savedTakes=[];this.takeRevision=0;this.savedPreviewURL=null;this.audioCapture=null;this.recordingStream=null;this.cameraFrames=null;this.cameraOrientationTimer=null;this.referenceAudio=new SlowMoReferenceAudio(video,()=>{if(this.isRecording)this.stopRecording('Reference audio was interrupted. This partial take can be reviewed; retry to record a continuous attempt.');});
  attachVideoGestures(practice);this.bindComparison();this.bindPractice();
  this.restoreTakes();this.applyComparisonLayout();this.setRecordReference();
  const cameraRotation=()=>{clearTimeout(this.cameraOrientationTimer);this.cameraOrientationTimer=setTimeout(()=>{if(this.stream&&!this.locked){const direction=SlowMoCamera.orientation(window);this.cameraFrames?.setOrientation(direction);this.updateCameraAspect(direction);$('cameraStatus').textContent=(direction==='portrait'?'Portrait':'Landscape')+' camera ready. Position yourself, then Start take.';}},150);};
  window.addEventListener('orientationchange',cameraRotation);window.addEventListener('resize',cameraRotation);window.screen?.orientation?.addEventListener('change',cameraRotation);
  this.frameTick();setInterval(()=>this.correctDrift(),100);
  ['cameraFacing','prepareSeconds','recordAudio'].forEach(id=>{try{const v=localStorage.getItem('slowmo-'+id);if(v!==null){if([...$(id).options].some(o=>o.value===v))$(id).value=v;}}catch{}$(id).addEventListener('change',()=>{try{localStorage.setItem('slowmo-'+id,$(id).value);}catch{}});});
  this.updateCameraMirror();$('cameraSource').addEventListener('resize',()=>this.cameraResized());
  document.addEventListener('visibilitychange',()=>{if(document.hidden){this.cancelPreparation();if(this.isRecording)this.stopRecording('The app was interrupted. This partial take can be reviewed or saved.');this.releaseCamera();}});
  window.addEventListener('pagehide',()=>{this.cancelPreparation();if(this.isRecording)this.stopRecording('Recording stopped when the app left the screen.');this.releaseCamera();});
 }
 get isComparing(){return this.mode==='compare'&&this.aligned;}
 get isRecording(){return !!this.recorder&&this.recorder.state!=='inactive';}
 get locked(){return !!this.exporting||!!this.preparing||this.isRecording||!!this.stopping;}
 get ownsPause(){return this.pairBusy||this.pairBuffering||this.internalPause>0||this.ignoreReferencePauses>0;}
 referenceReady(){ this.updateControls(); }
 beforeReferenceChange(selected){
  if(this.locked){message('Stop this take before choosing a new reference.');return false;}
  this.referenceKey=JSON.stringify([selected.name,selected.size,selected.lastModified]);this.exitCompare();this.leaveMemory();this.releaseCamera();return true;
 }
 comparisonBounds(){if(!this.isComparing)return null;const b=this.mapping.bounds(video.duration,this.practiceDuration);if(this.takeRange){b.start=Math.max(b.start,this.mapping.referenceAtPractice(this.takeRange.start));b.end=Math.min(b.end,this.mapping.referenceAtPractice(this.takeRange.end));b.valid=b.end-b.start>.1;}return b.valid?b:null;}
 bindComparison(){
  $('openCompare').onclick=()=>{if(this.locked)return;if(this.mode==='compare'){this.realign();return;}pausePlayback();this.leaveMemory();$('practiceFile').click();};
  $('practiceFile').onchange=async()=>{const f=$('practiceFile').files[0];if(!f)return;$('practiceFile').value='';const request=this.loadingId+1;try{await this.loadPractice(f);}catch(e){if(e.name==='AbortError'||request!==this.loadingId)return;this.exitCompare();message(e.message);}};
  $('alignRef').oninput=()=>{this.pauseAudition();video.currentTime=Number($('alignRef').value);this.alignmentTimes();};
  $('alignPractice').oninput=()=>{this.pauseAudition();practice.currentTime=Number($('alignPractice').value);this.alignmentTimes();};
  $('auditionRef').onclick=()=>this.audition('reference');$('auditionPractice').onclick=()=>this.audition('practice');
  video.addEventListener('timeupdate',()=>{if(this.mode==='compare'&&!this.aligned){$('alignRef').value=video.currentTime;this.alignmentTimes();}});
  practice.addEventListener('timeupdate',()=>{if(this.mode==='compare'&&!this.aligned){$('alignPractice').value=practice.currentTime;this.alignmentTimes();}});
  $('syncHere').onclick=()=>this.align(new TimeMapping(video.currentTime,practice.currentTime,this.mapping?.scale||1));
  $('fineEarlier').onclick=()=>this.nudge(-.1);$('fineLater').onclick=()=>this.nudge(.1);$('realign').onclick=()=>this.realign();$('exitCompare').onclick=()=>{enterPlayer();this.exitCompare();if(this.lastTake?.savedLocally)message('Recording saved on this device. Open Recordings to Save / Share.');};
  $('mirrorPractice').onclick=()=>{const on=practice.classList.toggle('mirrored');$('mirrorPractice').setAttribute('aria-pressed',String(on));};
  $('compareAudio').onchange=()=>{this.applyAudio();};
  $('compareLayout').onchange=()=>{this.applyComparisonLayout($('compareLayout').value);};
  $('overlayOpacity').oninput=()=>player.style.setProperty('--comparison-opacity',$('overlayOpacity').value);
  $('retryCompare').onclick=()=>this.retry();
  video.addEventListener('seeking',()=>{if(this.isComparing&&!this.exporting&&(this.internalReferenceTarget===null||Math.abs(video.currentTime-this.internalReferenceTarget)>.02))this.synchronize();});
  video.addEventListener('pause',()=>{const ignored=this.ignoreReferencePauses>0;if(ignored)--this.ignoreReferencePauses;if(this.isComparing){practice.pause();if(!ignored&&!this.ownsPause&&!countdownActive&&!video.ended)this.pairWanted=false;}});
  [video,practice].forEach(el=>{
   el.addEventListener('waiting',()=>{if(this.isComparing&&this.pairWanted&&!this.pairBusy){this.pairBuffering=true;this.pauseReference();practice.pause();message('Buffering both videos…');}if(el===video&&this.isRecording&&this.session?.playing)this.stopRecording('Reference playback buffered. The take ended so its timing stays consistent.');});
   el.addEventListener('canplay',()=>{if(this.isComparing&&this.pairBuffering&&video.readyState>=3&&practice.readyState>=3){this.pairBuffering=false;this.playPair();}});
  });
  practice.addEventListener('ended',()=>{if(this.isComparing&&!this.exporting&&this.pairWanted&&!this.pairBusy&&!countdownActive)this.repeatPair();});
  practice.addEventListener('error',()=>{if(this.mode==='compare'){this.pauseCompanion();video.pause();message('The practice video could not play. Choose another compatible MP4/MOV.');}});
 }
 async loadPractice(blob,take=null){
  this.practiceLoadAbort?.abort();this.practiceLoadAbort=new AbortController();const signal=this.practiceLoadAbort.signal;pausePlayback();this.leaveMemory();this.mode='compare';this.aligned=false;this.mapping=null;const id=++this.loadingId;
  practice.pause();practice.removeAttribute('src');practice.load();if(this.practiceURL)URL.revokeObjectURL(this.practiceURL);
  practice.loop=false;this.practiceURL=URL.createObjectURL(blob);practice.src=this.practiceURL;practice.muted=true;practice.defaultPlaybackRate=preferred;practice.playbackRate=preferred;
  this.reviewingTake=!!take;this.takeRange=take?{start:take.mapping.practiceAnchor+(take.start-take.mapping.referenceAnchor)*take.mapping.scale,end:take.mapping.practiceAnchor+(take.end-take.mapping.referenceAnchor)*take.mapping.scale}:null;this.practiceDuration=take?.duration||0;player.classList.add('comparing');this.applyComparisonLayout();practice.classList.toggle('mirrored',!!take?.mirrored);$('mirrorPractice').setAttribute('aria-pressed',String(!!take?.mirrored));$('exitCompare').textContent='Done';$('compareAudio').value='reference';
  $('practiceStage').hidden=false;$('compareTools').hidden=false;$('alignmentTools').hidden=false;$('retryCompare').hidden=!take;this.applyAudio();this.updateControls();
  if(practice.readyState<1)await waitEvent(practice,'loadedmetadata',6000,signal);if(id!==this.loadingId)throw SlowMoMedia.abortError();
  if(Number.isFinite(practice.duration)&&practice.duration>0)this.practiceDuration=practice.duration;
  if(!this.practiceDuration){try{await seekTo(practice,1e7,signal);if(Number.isFinite(practice.duration))this.practiceDuration=practice.duration;await seekTo(practice,0,signal);}catch{}}
  if(signal.aborted||id!==this.loadingId)throw SlowMoMedia.abortError();
  if(!Number.isFinite(this.practiceDuration)||this.practiceDuration<=.1)throw new Error('This browser could not read the practice video duration. Choose a compatible MP4/MOV.');
  $('alignRef').max=video.duration;$('alignPractice').max=this.practiceDuration;$('alignRef').value=video.currentTime;$('alignPractice').value=practice.currentTime;
  this.alignmentTimes();
  if(take){const mapping=new TimeMapping(take.mapping.referenceAnchor,take.mapping.practiceAnchor,take.mapping.scale);await this.align(mapping);}
  else message('Scrub each video to the same beat, then tap Sync here.');
 }
 alignmentTimes(){ $('alignRefTime').textContent=decimals(video.currentTime);$('alignPracticeTime').textContent=decimals(practice.currentTime); }
 pauseReference(){if(!video.paused)++this.ignoreReferencePauses;video.pause();}
 pauseAudition(){this.pauseReference();practice.pause();}
 async audition(which){const el=which==='reference'?video:practice,wasPlaying=!el.paused;this.pauseAudition();if(wasPlaying)return;video.muted=which!=='reference';practice.muted=which!=='practice';try{await el.play();}catch{message('Tap the video Play control again to allow audio playback.');}}
 async align(mapping){
  this.pauseCompanion();this.pauseAudition();const b=mapping.bounds(video.duration,this.practiceDuration);if(this.takeRange){b.start=Math.max(b.start,mapping.referenceAtPractice(this.takeRange.start));b.end=Math.min(b.end,mapping.referenceAtPractice(this.takeRange.end));b.valid=b.end-b.start>.1;}
  if(!b.valid){message('These sync points leave no overlapping video. Choose different points.');return;}
  this.mapping=mapping;this.aligned=true;this.pairWanted=false;$('alignmentTools').hidden=true;
  if(loopA!==null&&(loopA<b.start||loopB!==null&&loopB>b.end))clearLoop();
  video.currentTime=Math.max(b.start,Math.min(b.end-.02,mapping.referenceAnchor));
  this.updateSyncInfo();this.applyAudio();this.updateControls();renderLoop();time();await this.synchronize(false);
  message(this.reviewingTake?'Auto-aligned from session timing. Fine-tune ±0.1s for camera/audio latency.':'Synced. Shared controls move both videos together.');
 }
 updateSyncInfo(){if(this.mapping)$('syncInfo').textContent=`${decimals(this.mapping.referenceAnchor)} ↔ ${decimals(this.mapping.practiceAnchor)}${this.mapping.scale!==1?' · take '+this.mapping.scale.toFixed(2)+'× timeline':''}`;}
 async nudge(n){if(!this.mapping)return;const prior=this.mapping.practiceAnchor;this.mapping.nudgePractice(n);if(!this.comparisonBounds()){this.mapping.practiceAnchor=prior;return;}this.updateSyncInfo();const b=this.comparisonBounds();if(loopA!==null&&(loopA<b.start||loopB!==null&&loopB>b.end))clearLoop();if(video.currentTime<b.start||video.currentTime>=b.end)video.currentTime=b.start;time();await this.synchronize();}
 realign(){if(this.mode!=='compare')return;pausePlayback();this.aligned=false;$('alignmentTools').hidden=false;$('alignRef').value=video.currentTime;$('alignPractice').value=practice.currentTime;this.alignmentTimes();this.updateControls();message('Pause on the corresponding musical beat in each video, then Sync here.');}
 exitCompare(){
  if(this.mode!=='compare')return;this.practiceLoadAbort?.abort();this.pauseCompanion();video.pause();this.mode='watch';this.aligned=false;this.mapping=null;++this.loadingId;practice.removeAttribute('src');practice.load();if(this.practiceURL){URL.revokeObjectURL(this.practiceURL);this.practiceURL=null;}player.classList.remove('comparing','overlay-comparison');$('practiceStage').hidden=true;$('compareTools').hidden=true;video.muted=false;practice.muted=true;this.updateControls();renderLoop();time();message('');
 }
 applyAudio(){const audio=$('compareAudio').value;video.muted=audio!=='reference';practice.muted=audio!=='practice';}
 setPracticeRate(rate){try{practice.playbackRate=rate;return Math.abs(practice.playbackRate-rate)<.02;}catch{return false;}}
 speedChanged(){if(this.isComparing&&!this.setPracticeRate(preferred*this.mapping.scale)){this.pauseCompanion();video.pause();message('This browser cannot play the take at that speed. Choose a lower comparison speed.');}}
 async seekReference(target,signal){this.internalReferenceTarget=target;try{await seekTo(video,target,signal);}finally{this.internalReferenceTarget=null;}}
 completePair(task,epoch,restart){
  if(task!==this.pairTask)return;this.pairBusy=false;this.pairAbort=null;
  if(!this.isComparing||this.exporting){this.pairPending=null;return;}
  const next=this.pairPending;this.pairPending=null;
  if(next&&next.epoch===this.pairEpoch){this.synchronize(next.wanted,next.target);return;}
  playing();if(epoch===this.pairEpoch&&restart&&this.pairWanted&&!countdownActive)this.playPair();else this.handleBoundary();
 }
 async playPair(){
  if(!this.isComparing||this.exporting)return;this.pairWanted=true;
  if(this.pairBusy){this.pairPending={wanted:true,target:video.currentTime,epoch:this.pairEpoch};return;}if(this.pairBuffering)return;
  const epoch=this.pairEpoch,task=++this.pairTask,abort=new AbortController(),signal=abort.signal;this.pairAbort=abort;this.pairBusy=true;
  const valid=()=>this.isComparing&&!this.exporting&&this.pairWanted&&epoch===this.pairEpoch&&!signal.aborted;
  try{
   const b=this.pairRange();if(!b)throw new Error('No shared section remains. Adjust the loop or synchronization.');if(video.currentTime<b.start||video.currentTime>=b.end)await this.seekReference(b.start,signal);const target=this.mapping.practiceAtReference(video.currentTime);if(Math.abs(practice.currentTime-target)>.05)await seekTo(practice,target,signal);
   if(!valid()||this.pairPending)return;
   if(!this.setPracticeRate(preferred*this.mapping.scale))throw new Error('Choose a lower comparison speed; this browser cannot play the mapped take rate.');
   video.playbackRate=preferred;this.applyAudio();await SlowMoMedia.guard(this.resumeAudio(),{signal});if(!valid()||this.pairPending)return;
   await SlowMoMedia.playTogether([video,practice],{signal,isCurrent:valid});if(valid())message('');
  }catch(e){if(e.name!=='AbortError'&&epoch===this.pairEpoch){this.pairWanted=false;playbackIntent=false;video.pause();practice.pause();message(e.name==='NotAllowedError'?'Tap Play again to allow both videos.':e.message);}}
  finally{this.completePair(task,epoch,false);}
 }
 pauseCompanion(){this.pairWanted=false;this.pairBuffering=false;++this.pairEpoch;this.pairPending=null;this.pairAbort?.abort();practice.pause();}
 async synchronize(wanted=this.pairWanted,target=video.currentTime){
  if(!this.isComparing||this.exporting)return;
  if(this.pairBusy){this.pairPending={wanted,target,epoch:this.pairEpoch};return;}
  const epoch=this.pairEpoch,task=++this.pairTask,abort=new AbortController(),signal=abort.signal;this.pairAbort=abort;this.pairBusy=true;this.pairWanted=wanted;this.pauseReference();practice.pause();
  try{await this.seekReference(target,signal);if(epoch!==this.pairEpoch||!this.isComparing)return;if(Math.abs(video.currentTime-target)>.02)this.pairPending={wanted:this.pairWanted,target:video.currentTime,epoch};await seekTo(practice,this.mapping.practiceAtReference(target),signal);}
  catch(e){if(e.name!=='AbortError'&&epoch===this.pairEpoch){this.pairWanted=false;playbackIntent=false;message(e.message);}}
  finally{this.completePair(task,epoch,true);}
 }
 correctDrift(){
  if(this.exporting)return;
  if(!this.isComparing||!this.pairWanted||this.pairBusy||this.pairBuffering||countdownActive||video.paused||practice.paused||video.seeking||practice.seeking)return;
  const error=this.mapping.practiceAtReference(video.currentTime)-practice.currentTime;
  const action=driftAction(error,preferred*this.mapping.scale,performance.now()-this.lastCorrection);
  if(action.seek){this.lastCorrection=performance.now();this.synchronize();}else this.setPracticeRate(action.rate);
 }
 pairRange(){
  const b=this.comparisonBounds();if(!b)return null;
  if(loopOn&&loopA!==null&&loopB!==null){b.start=Math.max(b.start,loopA);b.end=Math.min(b.end,loopB);}
  return b.end-b.start>.1?b:null;
 }
 repeatPair(){
  if(!this.isComparing||this.exporting||!this.pairWanted||this.pairBusy||this.pairBuffering||countdownActive)return;
  const b=this.pairRange();if(!b){pausePlayback();message('No shared section remains. Adjust the loop or synchronization.');return;}
  if(loopOn&&loopDelay){repeatSection();return;}
  // Own both seeks before touching either clock. The single-video loop must not
  // race a companion seek or independently restart only one performance.
  this.synchronize(true,b.start);
 }
 handleBoundary(){
  if(this.exporting)return true;
  if(this.isRecording){if(this.session?.playing&&video.currentTime>=this.session.end-.015)this.stopRecording();return true;}
  if(this.preparing||this.mode==='compare'&&!this.aligned)return true;
  if(this.isComparing){if(this.pairWanted&&!this.pairBusy&&!this.pairBuffering&&!video.seeking&&!countdownActive){const b=this.pairRange();if(b&&(practice.ended||(!video.paused&&(video.currentTime>=b.end-.035||practice.currentTime>=this.mapping.practiceAtReference(b.end)-.035))))this.repeatPair();}return true;}
  return false;
 }
 handleEnded(){
  if(this.exporting)return true;
  if(this.isRecording){this.stopRecording();return true;}
  if(this.preparing||this.mode==='compare'&&!this.aligned)return true;
  if(this.isComparing){this.repeatPair();return true;}return false;
 }
 updateControls(){
  const align=this.mode==='compare'&&!this.aligned;
  $('play').disabled=align||this.locked||video.readyState<1;
  const ids=['seek','loopA','loopB','back','forward','setA','setB','loopToggle','clearLoop','speed','minus','plus','mirror','openPractice','openCompare','openTake','loopDelay'];
  for(const id of ids)$(id).disabled=this.locked||(align&&['seek','loopA','loopB','back','forward','setA','setB','loopToggle','clearLoop'].includes(id))||(['seek','loopA','loopB','back','forward','setA','setB','loopToggle','clearLoop','openPractice','openCompare'].includes(id)&&video.readyState<1);
  document.querySelectorAll('[data-speed]').forEach(b=>b.disabled=this.locked);
  if(!this.locked&&!align){$('loopToggle').disabled=loopA===null||loopB===null;$('clearLoop').disabled=loopA===null;$('minus').disabled=preferred<=.25;$('plus').disabled=preferred>=2;}
  file.disabled=this.locked;$('practiceFile').disabled=this.locked;$('openExport').disabled=this.locked||!this.isComparing;$('openSections').disabled=this.locked||video.readyState<1;$('openTake').disabled=this.locked||(!this.lastTake&&!this.savedTakes.length);
  player.classList.toggle('recording-active',this.isRecording);
  player.dataset.mode=this.mode;player.classList.toggle('recording-locked',this.locked);
 }
 // Phase 2: the media element stays rendered and audible behind an opaque cover.
 bindPractice(){
  $('openPractice').onclick=()=>this.openPractice();
  $('recordReference').onchange=()=>this.setRecordReference($('recordReference').value);
  $('toggleRecordReference').onclick=()=>this.setRecordReference(this.recordReference==='split'?'hidden':'split');
  $('liveMirrorReference').onclick=()=>{const on=video.classList.toggle('mirrored');$('mirror').setAttribute('aria-pressed',String(on));$('mirror').querySelector('span').textContent=on?'Mirrored':'Mirror';$('liveMirrorReference').setAttribute('aria-pressed',String(video.classList.contains('mirrored')));};
  $('liveMirrorCamera').onclick=()=>{$('cameraMirror').click();};
  document.querySelectorAll('[data-close="practiceDialog"]').forEach(b=>b.onclick=()=>{this.releaseCamera();$('practiceDialog').close();});
  $('practiceDialog').addEventListener('cancel',()=>this.releaseCamera());
  $('practiceOnly').onclick=()=>this.startMemory(false);
  $('prepareRecording').onclick=()=>{ $('cameraSetup').hidden=false;this.enableCamera(); };
  $('enableCamera').onclick=()=>this.enableCamera();$('startTake').onclick=()=>{if(!this.stream)return;enterPlayer();const audioReady=$('recordAudio').value==='reference'?this.referenceAudio.prime():this.resumeAudio();Promise.resolve(audioReady).then(()=>this.startMemory(true)).catch(e=>{openPlayerDialog('practiceDialog');$('cameraStatus').textContent=e.message;});};
  $('cameraFacing').addEventListener('change',()=>{this.updateCameraMirror();if(this.stream||this.cameraSetupAbort)this.enableCamera();});$('recordAudio').addEventListener('change',()=>{this.audioNote();if(this.stream||this.cameraSetupAbort)this.enableCamera();});
  $('leaveMemory').onclick=()=>{if(this.isRecording)this.stopRecording();else this.leaveMemory();};
  $('peekReference').onclick=()=>{$('memoryCover').hidden=true;$('sessionInfo').textContent='Reference revealed';$('peekAgain').hidden=false;};
  $('peekAgain').onclick=()=>{$('memoryCover').hidden=false;$('sessionInfo').textContent='Memory practice';$('peekAgain').hidden=true;};
  $('memoryResume').onclick=()=>attemptPlay();
  $('stopTake').onclick=()=>this.stopRecording();$('stopTakeFloating').onclick=()=>this.stopRecording();$('showCamera').onclick=()=>this.setCameraVisible($('recordMonitor').hidden);
  $('recordMonitor').onclick=()=>{if(player.classList.contains('immersive'))toggleControls();};
  $('cameraMirror').onclick=()=>{const mirrored=!$('cameraPreview').classList.contains('mirrored');this.updateCameraMirror(mirrored);try{localStorage.setItem('slowmo-camera-mirror-'+$('cameraFacing').value,String(mirrored));}catch{}};
  $('cancelPrep').onclick=()=>{this.cancelPreparation();this.leaveMemory();};
  $('openTake').onclick=()=>{if(player.classList.contains('immersive'))enterPlayer();pausePlayback();this.openTakeDialog();};$('closeTakeDialog').onclick=()=>$('takeDialog').close();
  $('savedTakes').onchange=()=>this.loadSavedTake($('savedTakes').value);
  $('takeDialog').addEventListener('close',()=>this.clearSavedPreview());
  $('downloadTake').onclick=()=>this.downloadTake();$('reviewTake').onclick=()=>this.reviewTake();$('retryTake').onclick=()=>this.retry();$('shareTake').onclick=()=>this.shareTake();$('discardTake').onclick=()=>{if(confirm('Delete this recording from SlowMo on this device? Copies already exported to Photos or Files are unaffected.'))this.deleteTake();};
  video.addEventListener('playing',()=>{$('memoryResume').hidden=true;if(this.isRecording&&this.session&&!this.session.playing){this.session.playing=true;this.session.firstPlaying=performance.now();this.session.samples.push({reference:video.currentTime,take:(performance.now()-this.session.recordEpoch)/1000});}});
  video.addEventListener('pause',()=>{if(this.isRecording&&this.session?.playing&&!this.stopping)this.stopRecording('Reference playback was interrupted. This partial take can be reviewed or saved.');if(this.mode==='memory'&&!this.locked&&!countdownActive)$('memoryResume').hidden=false;});
 }
 openPractice(){
  if(video.readyState<1||this.locked)return;pausePlayback();this.exitCompare();enterPlayer();$('practiceDialog').classList.remove('camera-framing');$('cameraSetup').hidden=true;$('practiceError').textContent='';$('cameraStatus').textContent='';this.updateSummary();openPlayerDialog('practiceDialog');
 }
 updateSummary(){const start=loopOn&&loopA!==null?loopA:0,end=loopOn&&loopB!==null?loopB:video.duration;$('practiceSummary').textContent=`${loopOn?'Selected section':'Full video'}: ${decimals(start)}–${decimals(end)} · ${preferred.toFixed(2)}× speed`;}
 leaveMemory(){
  if(this.isRecording||this.preparing)return;if(this.mode==='memory')this.mode='watch';this.recordingView=false;player.classList.remove('memory-mode','record-reference-visible');$('memoryCover').hidden=true;$('sessionTools').hidden=true;$('recordMonitor').hidden=true;$('peekAgain').hidden=true;this.updateControls();renderLoop();
 }
 async startMemory(record){
  if(this.locked)return;if(!record)this.releaseCamera();if(record&&!this.stream){$('practiceError').textContent='Enable a camera first.';return;}
  if(record&&this.lastTake&&!this.lastTake.savedLocally&&!this.takeSaved&&!confirm('Replace the unsaved take? Save / Share it first if you want to keep it.'))return;
  this.pauseCompanion();pausePlayback();this.mode='memory';player.classList.add('memory-mode');$('memoryCover').hidden=false;$('sessionTools').hidden=false;$('sessionInfo').textContent=record?'One take · speed locked':'Memory practice';$('stopTake').hidden=!record;$('showCamera').hidden=!record;$('leaveMemory').hidden=record;$('peekReference').hidden=record;$('peekAgain').hidden=true;this.setCameraVisible(record);this.recordingView=record;this.applyRecordingView();video.muted=false;
  const start=loopOn&&loopA!==null?loopA:0,end=loopOn&&loopB!==null?loopB:video.duration;
  const epoch=++this.sessionEpoch;
  this.session={abort:new AbortController(),start,end,loopState:{a:loopA,b:loopB,on:loopOn},rate:preferred,playing:false,samples:[],referenceGeneration:generation,referenceKey:this.referenceKey,mirrored:$('cameraPreview').classList.contains('mirrored'),audioMode:$('recordAudio').value};
  this.mountCameraSource(false);$('practiceDialog').close();this.preparing=true;this.updateControls();renderLoop();
  try{
   await seekTo(video,start,this.session.abort.signal);if(epoch!==this.sessionEpoch)return;
   if(record)await this.warmReference(this.session);if(epoch!==this.sessionEpoch)return;
   const ready=await this.prepare(Number($('prepareSeconds').value));if(!ready||epoch!==this.sessionEpoch)return;
   if(record){await this.beginRecording();if(epoch!==this.sessionEpoch)return;this.preparing=false;this.updateControls();renderLoop();}else{this.preparing=false;this.updateControls();renderLoop();await attemptPlay();if(video.paused)$('memoryResume').hidden=false;}
  }catch(e){if(epoch!==this.sessionEpoch)return;const session=this.session;session.cancelled=true;session.abort.abort();this.preparing=false;if(this.recorder){if(this.isRecording)this.stopRecording();else this.finishRecording(this.recordingChunks||[],this.recorder.mimeType,session,this.recorder);}this.releaseCamera();this.leaveMemory();if(e.name!=='AbortError')message(e.message);this.updateControls();renderLoop();}
 }
 async warmReference(session){
  const signal=session.abort.signal,muted=video.muted;
  const valid=()=>this.session===session&&generation===session.referenceGeneration&&!signal.aborted;
  if(!valid())throw SlowMoMedia.abortError();
  session.warming=true;$('takePrepLabel').textContent='Preparing playback';$('takePrepNumber').textContent='…';$('takePrep').hidden=false;
  try{
   // Retry can leave the reference decoder cold after camera reacquisition or
   // comparison. Warm it silently BEFORE the countdown and recorder clock.
   video.muted=true;video.playbackRate=session.rate;
   // Leave enough reference frames to warm even when A is near the file end.
   const warmStart=Math.max(0,Math.min(session.start,video.duration-.5));
   if(video.currentTime>warmStart+.01)await seekTo(video,warmStart,signal);
   await SlowMoMedia.guard(this.resumeAudio(),{signal});
   await SlowMoMedia.playTogether([video],{signal,isCurrent:valid});
   await SlowMoMedia.guard(SlowMoCamera.pictureReady(video),{signal});
   if(!valid())throw SlowMoMedia.abortError();this.pauseReference();
   await seekTo(video,session.start,signal);
   if(video.readyState<3)await waitEvent(video,'canplay',6000,signal);
   if(!valid())throw SlowMoMedia.abortError();
  }finally{
   session.warming=false;
   if(this.session===session&&generation===session.referenceGeneration){this.pauseReference();playbackIntent=false;playing();video.muted=muted;$('takePrep').hidden=true;$('takePrepLabel').textContent='Get ready';}
  }
 }
 prepare(seconds){
  const token=++this.prepToken;if(!seconds)return Promise.resolve(true);
  $('takePrep').hidden=false;const deadline=performance.now()+seconds*1000;
  return new Promise(resolve=>{this.prepResolve=resolve;const tick=()=>{if(token!==this.prepToken){resolve(false);return;}const n=Math.ceil((deadline-performance.now())/1000);if(n<=0){$('takePrep').hidden=true;this.prepTimer=null;this.prepResolve=null;resolve(true);return;}$('takePrepNumber').textContent=n;this.prepTimer=setTimeout(tick,80);};tick();});
 }
 cancelPreparation(){if(!this.preparing)return;this.session.cancelled=true;this.session.abort.abort();if(this.isRecording)this.stopRecording('Recording preparation cancelled.');++this.sessionEpoch;++this.prepToken;clearTimeout(this.prepTimer);this.prepResolve?.(false);this.prepResolve=null;this.preparing=false;$('takePrep').hidden=true;this.releaseCamera();this.updateControls();renderLoop();}
 updateCameraAspect(direction){const source=$('cameraSource');const ratio=source.videoWidth>0&&source.videoHeight>0?source.videoWidth/source.videoHeight:direction==='portrait'?.5625:16/9;source.style.setProperty('--camera-ratio',String(ratio));}
 cameraResized(){if(!this.stream)return;const v=$('cameraSource'),frame=this.session?.cameraFrame;if(this.isRecording&&frame&&(v.videoWidth!==frame.width||v.videoHeight!==frame.height)){this.stopRecording('Camera orientation changed. This take ended to keep its picture consistent; rotate before starting your next take.');return;}if(!this.locked)this.updateCameraAspect(SlowMoCamera.orientation(window));}
 mountCameraSource(framing){$(framing?'cameraPreviewHost':this.stream&&this.recordingView?'recordMonitor':'cameraSourceHome').append($('cameraSource'));}
 async enableCamera(){
  if(this.locked)return false;
  this.releaseCamera();const request=this.cameraRequest,abort=this.cameraSetupAbort=new AbortController(),signal=abort.signal;
  let stage='camera permission';
  const current=()=>request===this.cameraRequest&&!signal.aborted;
  const check=()=>{if(!current())throw SlowMoMedia.abortError();};
  $('practiceDialog').classList.add('camera-framing');$('cameraSetup').hidden=false;this.audioNote();$('startTake').disabled=true;$('enableCamera').disabled=true;$('cameraStatus').textContent='Requesting camera…';this.mountCameraSource(true);
  try{
   if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw new Error('Camera recording is unavailable here. Try SlowMo in a Safari tab, or use Practice only.');
   // Request hardware directly from the tap. AudioContext.resume() can remain
   // pending in WebKit; reference audio is primed separately by Start take.
   const pending=navigator.mediaDevices.getUserMedia({video:SlowMoCamera.sensorConstraints($('cameraFacing').value),audio:$('recordAudio').value==='microphone'?{echoCancellation:false,noiseSuppression:false}:false});
   const acquired=Promise.resolve(pending).then(stream=>{if(!current()){stream.getTracks().forEach(t=>t.stop());throw SlowMoMedia.abortError();}this.stream=stream;return stream;});
   const stream=await SlowMoMedia.guard(acquired,{signal,timeout:20000});check();this.stream=stream;
   this.updateCameraMirror(undefined,stream.getVideoTracks()[0]?.getSettings?.().facingMode);
   const source=$('cameraSource'),preview=$('cameraPreview');source.muted=true;source.playsInline=true;preview.muted=true;preview.playsInline=true;source.srcObject=stream;
   stage='camera playback';$('cameraStatus').textContent='Starting camera picture…';
   await SlowMoMedia.guard(source.play(),{signal});check();stage='camera frames';await SlowMoMedia.guard(SlowMoCamera.pictureReady(source),{signal});check();
   // Framing is native camera playback only: no canvas copies or extra decoder.
   // The recorder uses this camera track directly as well.
   const direction=SlowMoCamera.orientation(window);this.updateCameraAspect(direction);
   if(stream.getVideoTracks().some(t=>t.readyState==='ended'))throw new Error('The camera stopped. Enable camera again.');
   $('startTake').disabled=false;$('startTake').focus({preventScroll:true});$('cameraStatus').textContent=(direction==='portrait'?'Portrait':'Landscape')+' camera ready. Position yourself, then Start take.';
   for(const track of stream.getTracks())track.addEventListener('ended',()=>{if(this.stream!==stream)return;if(this.preparing){this.cancelPreparation();this.leaveMemory();}else if(this.isRecording)this.stopRecording('The camera or microphone was interrupted. You can review the partial take.');else this.releaseCamera();$('cameraStatus').textContent='Camera or microphone stopped. Enable camera again to record.';});
   return true;
  }catch(e){if(!current())return false;this.releaseCamera();$('cameraStatus').textContent=e.name==='NotAllowedError'?'Camera or microphone permission was denied. Allow camera access, or choose Reference music instead of Microphone and try again. Practice only is always available.':e.name==='NotFoundError'?'No camera was found. Choose another camera or use Practice only.':'Camera setup stopped at '+stage+' (v22): '+e.message+' Tap Enable camera to retry. If it persists, close other camera apps and reopen SlowMo.';return false;
  }finally{if(this.cameraSetupAbort===abort){this.cameraSetupAbort=null;$('enableCamera').disabled=false;}}
 }
 releaseCamera(invalidate=true){this.cameraSetupAbort?.abort();this.cameraSetupAbort=null;$('enableCamera').disabled=false;clearTimeout(this.cameraOrientationTimer);if(this.stream){const stream=this.stream;this.stream=null;stream.getTracks().forEach(t=>t.stop());}this.cameraFrames?.stop();this.cameraFrames?.canvas?.remove();this.cameraFrames=null;$('cameraSource').srcObject=null;this.mountCameraSource(false);this.audioCapture?.release();this.audioCapture=null;this.recordingStream=null;if(invalidate)++this.cameraRequest;$('cameraPreview').srcObject=null;$('recordMonitor').srcObject=null;this.setCameraVisible(false);$('startTake').disabled=true;}
 async beginRecording(){
  const session=this.session,epoch=this.sessionEpoch,signal=session.abort.signal;const check=()=>{if(signal.aborted||epoch!==this.sessionEpoch||document.hidden)throw SlowMoMedia.abortError();};check();
  if(!this.stream)throw new Error('The camera stopped. Open Practice & Record to enable it again.');
  await SlowMoMedia.guard($('cameraSource').play(),{signal});check();
  // Reuse the same native camera video at full display size, without a
  // second canvas-stream decoder or a tiny, throttled sensor element.
  this.mountCameraSource(false);
  await SlowMoMedia.guard(SlowMoCamera.pictureReady($('cameraSource'),4000,null,signal),{signal});check();
  const cameraFrame=SlowMoCamera.nativeFrame($('cameraSource'));if(this.stream.getVideoTracks().some(t=>t.readyState==='ended'))throw new Error('The camera stopped. Enable camera again.');session.cameraFrame=cameraFrame;this.updateCameraAspect(cameraFrame.orientation);
  // Record the original camera track. No JS frame copies, canvas capture,
  // callback pacing or preview visibility can throttle the saved camera track.
  $('cameraPreview').pause();
  this.audioCapture?.release();this.audioCapture=null;
  const audioMode=this.session.audioMode;let audioTracks=[];
  if(audioMode==='reference'){const pending=this.referenceAudio.capture().then(capture=>{if(signal.aborted){capture.release();throw SlowMoMedia.abortError();}return capture;});this.audioCapture=await SlowMoMedia.guard(pending,{signal});check();audioTracks=[this.audioCapture.track];}else if(audioMode==='microphone'){audioTracks=this.stream.getAudioTracks();if(!audioTracks.length)throw new Error('Microphone sound is unavailable. Enable the camera again or choose Reference music.');}
  this.recordingStream=new MediaStream([...this.stream.getVideoTracks(),...audioTracks]);
  const types=['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4','video/webm;codecs=vp8,opus','video/webm'];
  const mime=types.find(t=>MediaRecorder.isTypeSupported?.(t));
  let recorder;try{recorder=new MediaRecorder(this.recordingStream,{...(mime?{mimeType:mime}:{}),videoBitsPerSecond:1800000});}catch{recorder=new MediaRecorder(this.recordingStream);}
  this.recorder=recorder;const chunks=[];this.recordingChunks=chunks;let bytes=0;this.stopReason='';this.session.recordEpoch=performance.now();
  recorder.addEventListener('dataavailable',e=>{if(this.recorder!==recorder||session.finished)return;if(e.data.size){chunks.push(e.data);bytes+=e.data.size;if(bytes>100*1024*1024)this.stopRecording('The take reached the local memory limit. Save it before recording again.');}});
  recorder.addEventListener('error',()=>{if(this.recorder===recorder&&!session.finished)this.stopRecording('Recording was interrupted. Any captured footage is available to save.');});
  recorder.addEventListener('stop',()=>this.finishRecording(chunks,recorder.mimeType,session,recorder));
  const started=waitEvent(recorder,'start',6000,signal,()=>{session.recordEpoch=performance.now();recorder.start(1000);});await started;check();
  // Let fresh camera pictures reach the running encoder before starting music.
  // This short lead-in remains in the take clock and automatic time mapping.
  await SlowMoMedia.guard(SlowMoCamera.pictureReady($('cameraSource'),4000,cameraFrame,signal),{signal});check();
  if(this.recorder!==recorder||recorder.state==='inactive'||this.stopping)return;
  // The encoded stream starts at start(), not the asynchronously delivered event.
  this.session.startedRate=preferred;
  $('recordElapsed').textContent='0:00';$('recordIndicator').hidden=false;$('memoryStatus').textContent='Recording your take · reference music playing';this.updateControls();renderLoop();
  this.recordTimer=setInterval(()=>{$('recordElapsed').textContent=clock((performance.now()-this.session.recordEpoch)/1000);if(performance.now()-this.session.recordEpoch>300000)this.stopRecording('The five-minute take limit was reached.');},200);
  playbackIntent=true;
  try{await SlowMoMedia.guard(this.resumeAudio(),{signal});check();await SlowMoMedia.playTogether([video],{signal,isCurrent:()=>epoch===this.sessionEpoch&&this.recorder===recorder&&!this.stopping});}catch{this.stopRecording('Reference audio could not start automatically. Retry and tap Play when prompted.');}
 }
 externalPause(){if(this.isRecording&&!this.stopping)this.stopRecording('Playback paused. The take ended to preserve its timing.');if(this.preparing)this.cancelPreparation();}
 stopRecording(reason=''){
  if(!this.isRecording||this.stopping)return;this.stopping=true;this.stopReason=reason;this.session.stopWall=performance.now();this.session.endReference=Math.min(this.session.end,video.currentTime);
  this.internalPause++;video.pause();this.internalPause--;playbackIntent=false;clearInterval(this.recordTimer);$('recordIndicator').hidden=true;$('stopTake').disabled=true;
  const session=this.session,recorder=this.recorder;session.stopTimer=setTimeout(()=>{if(this.session===session&&this.recorder===recorder){this.stopReason=this.stopReason||'The camera encoder stopped responding. Review this partial take before saving.';this.finishRecording(this.recordingChunks||[],recorder.mimeType,session,recorder);}},5000);
  try{this.recorder.stop();}catch{this.finishRecording(this.recordingChunks||[],this.recorder.mimeType);}
 }
 finishRecording(chunks,mime,session=this.session,recorder=this.recorder){
  if(!session||session.finished||session!==this.session||recorder!==this.recorder)return;clearTimeout(session.stopTimer);session.finished=true;if(session.cancelled){this.recorder=null;this.stopping=false;clearInterval(this.recordTimer);$('recordIndicator').hidden=true;this.releaseCamera();this.leaveMemory();this.updateControls();renderLoop();return;}
  const blob=new Blob(chunks,{type:chunks.find(b=>b.type)?.type||mime||'video/webm'});
  const duration=Math.max(.01,((session.stopWall||performance.now())-session.recordEpoch)/1000);
  this.lastTake={id:crypto.randomUUID?crypto.randomUUID():String(Date.now())+'-'+Math.random(),created:Date.now(),referenceKey:session.referenceKey,timingVersion:2,mirrored:session.mirrored,audioMode:session.audioMode,cameraFrame:session.cameraFrame,blob,duration,loopState:session.loopState,mapping:recordingMapping(session.start,session.rate,session.samples),start:session.start,end:Math.max(session.start+.1,session.endReference||session.end),rate:session.rate,referenceGeneration:session.referenceGeneration,reason:this.stopReason};this.takeSaved=false;
  this.recorder=null;this.stopping=false;$('openTake').hidden=false;this.releaseCamera();this.mode='watch';this.recordingView=false;player.classList.remove('memory-mode','record-reference-visible');$('memoryCover').hidden=true;$('sessionTools').hidden=true;$('stopTake').disabled=false;
  this.updateControls();renderLoop();$('takeTitle').textContent=blob.size?'Your take is ready':'No recording was captured';$('takeSummary').textContent=`${clock(duration)} recorded · ${session.rate.toFixed(2)}× practice speed · ${(blob.size/1048576).toFixed(1)} MB`;$('takeStatus').textContent=this.stopReason;
  this.lastTake.canCompare=!!session.samples.length;this.openTakeDialog();if(blob.size)this.persistTake(this.lastTake);
 }
 async reviewTake(){
  const take=this.lastTake;if(!take||!this.canReviewTake(take)){message('Choose the original reference again to compare this take.');return;}
  $('takeDialog').close();enterPlayer();pausePlayback();setSpeed(take.rate);const request=this.loadingId+1;
  try{await this.loadPractice(take.blob,take);if(request!==this.loadingId||this.lastTake!==take||!this.isComparing)return;const b=this.comparisonBounds();loopA=Math.max(b.start,take.start);loopB=Math.min(b.end,take.end);loopOn=loopB>loopA+.1;renderLoop();time();}
  catch(e){if(e.name==='AbortError'||request!==this.loadingId)return;this.exitCompare();message(e.message);}
 }
 async retry(){
  if(this.locked||this.retryPending)return;
  const take=this.lastTake;if(!take)return;if(!take.savedLocally&&!this.takeSaved&&!confirm('Retry will replace this unsaved take. Continue?'))return;
  const referenceGeneration=generation;this.retryPending=true;
  try{
   enterPlayer();if($('takeDialog').open)$('takeDialog').close();this.exitCompare();setSpeed(take.rate);loopA=take.loopState.a;loopB=take.loopState.b;loopOn=take.loopState.on;renderLoop();this.discardTake(false);
   this.openPractice();$('cameraSetup').hidden=false;const ready=await this.enableCamera();
   // Closing setup, changing reference, or a newer camera request invalidates
   // this retry. Merely seeing a stream is not proof framing is ready.
   if(ready&&referenceGeneration===generation&&this.stream&&$('practiceDialog').open)await this.startMemory(true);
  }finally{this.retryPending=false;}
 }
 discardTake(close=true){++this.takeRevision;this.lastTake=null;this.takeSaved=false;$('openTake').hidden=!this.savedTakes.length;if(close&&$('takeDialog').open)$('takeDialog').close();$('retryCompare').hidden=true;}
 async shareTake(){
  const take=this.lastTake;if(!take)return;const extension=take.blob.type.includes('mp4')?'mp4':'webm';const file=new File([take.blob],`SlowMo-take-${new Date().toISOString().replace(/[:.]/g,'-')}.${extension}`,{type:extension==='mp4'?'video/mp4':'video/webm'});
  try{if(navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title:'SlowMo practice take'});this.takeSaved=true;$('takeStatus').textContent='Share Sheet closed. Choose Save Video to add to Photos if offered, then check Photos. SlowMo cannot confirm which share action you selected.';}
   else this.downloadTake();}
  catch(e){if(e.name!=='AbortError')$('takeStatus').textContent='The Share Sheet is unavailable. Tap Download instead, then open the file in Files and Share → Save Video if supported.';}
 }

 resumeAudio(){return this.referenceAudio.resume();}
 audioNote(){const mode=$('recordAudio').value;$('recordAudioNote').textContent=mode==='reference'?'Records the reference soundtrack at your selected speed, without microphone access. One pass per take.':mode==='microphone'?'Records room sound. Use speakers to capture the music; headphones will not be recorded. One pass per take.':'Saved video will be silent. Reference music still plays during practice.';}
 applyComparisonLayout(value){
  if(!value){try{value=localStorage.getItem('slowmo-comparison-layout');}catch{}}
  if(!['split','stacked','overlay'].includes(value))value='split';
  $('compareLayout').value=value;player.dataset.comparisonLayout=value;
  player.classList.toggle('overlay-comparison',value==='overlay');$('opacityLabel').hidden=value!=='overlay';
  try{localStorage.setItem('slowmo-comparison-layout',value);}catch{}
 }
 updateCameraMirror(value,facing){
  // Every front-camera session starts as a selfie, including Retry. A legacy
  // saved "off" preference must not override this default. Manual toggles
  // still apply immediately to the current session.
  if(value===undefined){if($('cameraFacing').value==='user'||facing==='user')value=true;else{try{value=localStorage.getItem('slowmo-camera-mirror-environment')==='true';}catch{value=false;}}}
  this.cameraMirrored=!!value;$('cameraSource').classList.toggle('mirrored',this.cameraMirrored);$('cameraPreviewHost').classList.remove('mirrored');$('cameraPreview').classList.toggle('mirrored',this.cameraMirrored);$('recordMonitor').classList.remove('mirrored');$('cameraMirror').setAttribute('aria-pressed',String(value));$('liveMirrorCamera').setAttribute('aria-pressed',String(value));
 }
 setRecordReference(value){
  if(value===undefined){try{value=localStorage.getItem('slowmo-record-reference');}catch{}}
  this.recordReference=value==='split'?'split':'hidden';$('recordReference').value=this.recordReference;
  try{localStorage.setItem('slowmo-record-reference',this.recordReference);}catch{}
  this.applyRecordingView();
 }
 applyRecordingView(){
  const visible=!!this.recordingView&&this.recordReference==='split';
  player.classList.toggle('record-reference-visible',visible);
  $('toggleRecordReference').hidden=!this.recordingView;$('toggleRecordReference').textContent=visible?'Hide reference':'Show reference';$('toggleRecordReference').setAttribute('aria-pressed',String(visible));
  $('liveMirrorReference').hidden=!visible;$('liveMirrorReference').setAttribute('aria-pressed',String(video.classList.contains('mirrored')));$('liveMirrorCamera').hidden=!this.recordingView;
  if(visible){$('memoryCover').hidden=true;this.setCameraVisible(true);}else if(this.recordingView){$('memoryCover').hidden=false;this.setCameraVisible(!$('recordMonitor').hidden);}
 }
 setCameraVisible(visible){if(this.recordingView&&this.recordReference==='split'&&this.stream)visible=true;$('recordMonitor').hidden=!visible;$('showCamera').textContent=visible?'Hide camera':'Show camera';$('showCamera').hidden=!!this.recordingView&&this.recordReference==='split';player.classList.toggle('camera-view',visible);}
 canReviewTake(take){return !!take?.blob.size&&!!take?.canCompare&&video.readyState>=1&&!!this.referenceKey&&take.referenceKey===this.referenceKey;}
 async restoreTakes(){
  const revision=this.takeRevision;
  try{await this.refreshSavedTakes();if(this.savedTakes.length&&!this.lastTake&&revision===this.takeRevision){const take=await SlowMoTakes.load(this.savedTakes[0].id);if(revision!==this.takeRevision||this.lastTake)return;this.lastTake={...take,savedLocally:true};$('openTake').hidden=false;this.updateControls();}}catch{}
 }
 async refreshSavedTakes(){
  const revision=this.takesListRevision=(this.takesListRevision||0)+1,rows=await SlowMoTakes.list();if(revision!==this.takesListRevision)return;this.savedTakes=rows;const select=$('savedTakes');select.replaceChildren();
  for(const take of this.savedTakes){const option=document.createElement('option');option.value=take.id;option.textContent=new Date(take.created).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+' · '+clock(take.duration)+' · '+take.rate.toFixed(2)+'×';select.append(option);}
  if(this.lastTake){if(!this.savedTakes.some(t=>t.id===this.lastTake.id)){const current=document.createElement('option');current.value=this.lastTake.id;current.textContent='Current take · not saved locally';select.prepend(current);}select.value=this.lastTake.id;}
  $('savedTakesLabel').hidden=!this.savedTakes.length;$('openTake').hidden=!this.lastTake&&!this.savedTakes.length;
 }
 async persistTake(take){
  take.storageStatus='Saving automatically on this device…';this.renderTakeDialog();
  try{await SlowMoTakes.save(take);take.savedLocally=true;take.storageStatus='Saved in SlowMo on this device — not in Photos. Use Save to Photos / Share to export.';await this.refreshSavedTakes();}
  catch{take.storageStatus='Automatic local save failed (storage unavailable or full). Keep SlowMo open and Save to Photos / Share or Download this take now.';}
  if(this.lastTake===take)this.renderTakeDialog();
 }
 async loadSavedTake(id){
  if(id===this.lastTake?.id)return;
  if(this.lastTake&&!this.lastTake.savedLocally&&!this.takeSaved&&!confirm('Switch recordings and discard this unsaved take? Save / Share it first to keep it.')){$('savedTakes').value=this.lastTake.id;return;}
  pausePlayback();const revision=++this.takeRevision;
  try{const take=await SlowMoTakes.load(id);if(revision!==this.takeRevision||!take)return;this.lastTake={...take,savedLocally:true};this.takeSaved=false;this.renderTakeDialog();}
  catch{if(revision===this.takeRevision)$('takeStorageStatus').textContent='This saved recording could not be opened.';}
 }
 clearSavedPreview(){const preview=$('savedTakePreview');preview.pause();preview.removeAttribute('src');preview.load();if(this.savedPreviewURL){URL.revokeObjectURL(this.savedPreviewURL);this.savedPreviewURL=null;}}
 renderTakeDialog(){
  const take=this.lastTake;if(!take)return;
  $('takeTitle').textContent=take.blob.size?'Your take is ready':'No recording was captured';$('takeSummary').textContent=clock(take.duration)+' recorded · '+take.rate.toFixed(2)+'× practice speed · '+(take.blob.size/1048576).toFixed(1)+' MB';
  $('takeStatus').textContent=take.reason||'';$('takeStorageStatus').textContent=take.savedLocally?'Saved in SlowMo on this device — not in Photos. Use Save to Photos / Share to export.':(take.storageStatus||'');
  const canReview=this.canReviewTake(take);$('reviewTake').disabled=!canReview;$('retryTake').disabled=!canReview;$('shareTake').disabled=!take.blob.size;$('downloadTake').disabled=!take.blob.size;
  this.clearSavedPreview();$('savedTakePreview').hidden=canReview||!take.blob.size;
  if(!canReview&&take.blob.size){this.savedPreviewURL=URL.createObjectURL(take.blob);$('savedTakePreview').src=this.savedPreviewURL;$('savedTakePreview').classList.remove('mirrored');$('takeSummary').textContent+=' · Original camera orientation. Choose the original reference to compare or retry.';}
 }
 openTakeDialog(){this.renderTakeDialog();if(!$('takeDialog').open)openPlayerDialog('takeDialog');this.refreshSavedTakes().catch(()=>{});}
 async deleteTake(){
  const take=this.lastTake,revision=this.takeRevision;if(!take)return;
  try{await SlowMoTakes.remove(take.id);}catch{if(this.lastTake===take)$('takeStorageStatus').textContent='Could not delete the local copy. Try again.';return;}
  if(this.lastTake!==take||revision!==this.takeRevision){await this.refreshSavedTakes();return;}this.discardTake();await this.refreshSavedTakes();if(this.savedTakes.length){await this.loadSavedTake(this.savedTakes[0].id);}this.updateControls();
 }
 downloadTake(){
  const take=this.lastTake;if(!take?.blob.size)return;const extension=take.blob.type.includes('mp4')?'mp4':'webm';const url=URL.createObjectURL(take.blob),a=document.createElement('a');a.href=url;a.download='SlowMo-take-'+new Date(take.created).toISOString().replace(/[:.]/g,'-')+'.'+extension;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);$('takeStatus').textContent='Download requested. Check Files/Downloads; this does not automatically add to Photos.';
 }
 frameTick(now,meta){
  if(this.isRecording&&this.session?.playing&&Number.isFinite(video.currentTime)){
   const reference=meta?.mediaTime??video.currentTime,take=((meta?.expectedDisplayTime??performance.now())-this.session.recordEpoch)/1000;
   const last=this.session.samples.at(-1);if(!last||reference>last.reference+.08)this.session.samples.push({reference,take});
  }
  if(video.requestVideoFrameCallback)video.requestVideoFrameCallback((n,m)=>this.frameTick(n,m));else requestAnimationFrame(()=>this.frameTick());
 }
}
dance=new DancePractice();
})();
