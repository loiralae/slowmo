// Route the reference's decoded soundtrack to speakers and, only during a take,
// to a local MediaRecorder audio track. No decoding of the complete video file.
(()=>{
'use strict';
class ReferenceAudio{
 constructor(element,onInterrupt=()=>{}){this.element=element;this.context=null;this.source=null;this.onInterrupt=onInterrupt;this.pending=null;}
 async resume(create=false){
  if(!create&&!this.source)return;
  if(!this.context){const Context=window.AudioContext||window.webkitAudioContext;if(!Context)throw new Error('Reference audio recording is unavailable. Choose Microphone instead.');try{this.context=new Context({latencyHint:'playback'});}catch{this.context=new Context();}this.context.addEventListener('statechange',()=>{if(this.source&&(this.context.state==='interrupted'||this.context.state==='suspended'||this.context.state==='closed'))this.onInterrupt();});}
  const context=this.context;
  if(context.state!=='running')await context.resume();
  if(context.state!=='running')throw new Error('Tap Start take again to enable reference sound, or choose Microphone.');
  // Resume before re-routing so a refused autoplay request leaves native sound intact.
  if(!this.source){const source=context.createMediaElementSource(this.element);source.connect(context.destination);this.source=source;}
 }
 prime(){if(!this.pending)this.pending=this.resume(true).finally(()=>{this.pending=null;});return this.pending;}
 async capture(){
  await this.prime();let destination;
  try{destination=this.context.createMediaStreamDestination();this.source.connect(destination);const track=destination.stream.getAudioTracks()[0];if(!track||track.readyState!=='live')throw new Error('No reference audio track was created.');
   let released=false;return {track,release:()=>{if(released)return;released=true;try{this.source.disconnect(destination);}catch{}destination.stream.getTracks().forEach(t=>t.stop());}};
  }catch(e){if(destination){try{this.source.disconnect(destination);}catch{}destination.stream.getTracks().forEach(t=>t.stop());}throw new Error('Reference sound could not be recorded. Choose Microphone and enable the camera again.');}
 }
}
window.SlowMoReferenceAudio=ReferenceAudio;
})();
