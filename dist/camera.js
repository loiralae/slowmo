(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SlowMoCamera=api;})(typeof window!=='undefined'?window:globalThis,function(){
'use strict';
function orientation(scope){
 const type=scope.screen?.orientation?.type;
 if(type?.startsWith('portrait'))return 'portrait';
 if(type?.startsWith('landscape'))return 'landscape';
 if(typeof scope.orientation==='number')return Math.abs(scope.orientation)%180===90?'landscape':'portrait';
 if(scope.matchMedia)return scope.matchMedia('(orientation: portrait)').matches?'portrait':'landscape';
 return scope.innerHeight>scope.innerWidth?'portrait':'landscape';
}
function size(direction){return direction==='portrait'?{width:720,height:1280}:{width:1280,height:720};}
function sensorConstraints(facing){
 // Constraints describe the sensor's primary axes. Swapping width/height for
 // portrait makes affected WebKit versions rotate an already-rotated stream.
 return {facingMode:{ideal:facing},width:{ideal:1280},height:{ideal:720},aspectRatio:{ideal:16/9},frameRate:{ideal:30,max:30}};
}
function crop(sourceWidth,sourceHeight,targetWidth,targetHeight){
 const ratio=targetWidth/targetHeight,sourceRatio=sourceWidth/sourceHeight;
 if(sourceRatio>ratio){const width=sourceHeight*ratio;return {x:(sourceWidth-width)/2,y:0,width,height:sourceHeight};}
 const height=sourceWidth/ratio;return {x:0,y:(sourceHeight-height)/2,width:sourceWidth,height};
}
function pictureReady(video,timeout=4000,expected=null){return new Promise((resolve,reject)=>{
 let timer,frame=0,previous=video.currentTime,count=0;const win=video.ownerDocument.defaultView;
 const finish=(error)=>{win.clearTimeout(timer);win.cancelAnimationFrame(frame);error?reject(error):resolve({width:video.videoWidth,height:video.videoHeight});};
 const check=()=>{if(video.readyState>=2&&video.videoWidth>0&&video.videoHeight>0&&(!expected||(video.videoWidth===expected.width&&video.videoHeight===expected.height))){if(video.currentTime!==previous){count++;previous=video.currentTime;}if(count>=2){finish();return;}}frame=win.requestAnimationFrame(check);};
 timer=win.setTimeout(()=>finish(new Error('The camera has not produced a picture. Enable the camera again.')),timeout);check();
});}
class CameraFrames{
 constructor(source,direction){
  this.source=source;this.win=source.ownerDocument.defaultView;this.canvas=source.ownerDocument.createElement('canvas');this.context=this.canvas.getContext('2d',{alpha:false});
  if(!this.context||!this.canvas.captureStream)throw new Error('This browser cannot record orientation-correct camera frames. Try current Safari or Chrome.');
  this.stopped=false;this.frame=0;this.videoFrame=0;this.last=-Infinity;this.lastMediaTime=null;this.framesDrawn=0;this.waiters=new Set();this.locked=false;this.setOrientation(direction);this.draw();this.stream=this.canvas.captureStream(30);
  // Prefer decoded-frame callbacks. Keep a paced fallback for WebKit versions
  // that throttle callbacks on the tiny, transparent sensor video.
  const paint=now=>{if(this.stopped)return;const time=source.currentTime;if(now-this.last>=1000/30-1){this.last=now;this.lastMediaTime=time;this.draw();}};
  const fallback=now=>{if(this.stopped)return;if(!this.useVideoFrames||now-this.lastDecodedAt>250)paint(now);this.frame=this.win.requestAnimationFrame(fallback);};
  this.useVideoFrames=typeof source.requestVideoFrameCallback==='function';this.lastDecodedAt=-Infinity;
  if(this.useVideoFrames){
   const tick=(now,meta)=>{if(this.stopped)return;this.lastDecodedAt=now;const time=meta?.mediaTime??source.currentTime;
    if(now-this.last>=1000/30-1&&time!==this.lastMediaTime){this.last=now;this.lastMediaTime=time;this.draw();}
    this.videoFrame=source.requestVideoFrameCallback(tick);
   };this.videoFrame=source.requestVideoFrameCallback(tick);
  }
  this.frame=this.win.requestAnimationFrame(fallback);
 }
 setOrientation(direction){if(this.locked||this.orientation===direction)return;this.orientation=direction;const dimensions=size(direction);this.canvas.width=dimensions.width;this.canvas.height=dimensions.height;this.draw();}
 draw(){const v=this.source;if(!this.context||v.readyState<2||!v.videoWidth||!v.videoHeight)return;const c=crop(v.videoWidth,v.videoHeight,this.canvas.width,this.canvas.height);this.context.drawImage(v,c.x,c.y,c.width,c.height,0,0,this.canvas.width,this.canvas.height);this.framesDrawn++;
  for(const waiter of this.waiters)if(this.framesDrawn>=waiter.target){clearTimeout(waiter.timer);this.waiters.delete(waiter);waiter.resolve();}
 }
 freshFrames(count=2,timeout=4000){
  if(this.stopped)return Promise.reject(new Error('The camera stopped before recording was ready.'));
  return new Promise((resolve,reject)=>{const waiter={target:this.framesDrawn+count,resolve,reject};waiter.timer=setTimeout(()=>{this.waiters.delete(waiter);reject(new Error('The camera stopped producing fresh recording frames. Enable it again.'));},timeout);this.waiters.add(waiter);});
 }
 async lock(direction){
  this.setOrientation(direction);this.locked=true;this.draw();this.stream.getVideoTracks()[0]?.requestFrame?.();
  // Give the capture track a fresh frame at the final dimensions before encoding.
  await new Promise(resolve=>this.win.requestAnimationFrame(()=>this.win.requestAnimationFrame(resolve)));
  if(this.stopped)throw new Error('The camera stopped before the take began.');
  return {orientation:this.orientation,...size(this.orientation)};
 }
 stop(){this.stopped=true;for(const waiter of this.waiters){clearTimeout(waiter.timer);waiter.reject(new Error('The camera stopped before recording was ready.'));}this.waiters.clear();this.win.cancelAnimationFrame(this.frame);if(this.videoFrame)this.source.cancelVideoFrameCallback?.(this.videoFrame);this.stream?.getTracks().forEach(t=>t.stop());}
}
return {orientation,size,sensorConstraints,crop,pictureReady,CameraFrames};
});
