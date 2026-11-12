(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SlowMoTimeline=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 class TimeMapping{
  constructor(referenceAnchor=0,practiceAnchor=0,scale=1){if(![referenceAnchor,practiceAnchor,scale].every(Number.isFinite)||scale<=0)throw new RangeError('Invalid time mapping');this.referenceAnchor=referenceAnchor;this.practiceAnchor=practiceAnchor;this.scale=scale;}
  practiceAtReference(reference){return this.practiceAnchor+(reference-this.referenceAnchor)*this.scale;}
  referenceAtPractice(practice){return this.referenceAnchor+(practice-this.practiceAnchor)/this.scale;}
  logicalAtReference(reference){return reference-this.referenceAnchor;}
  referenceAtLogical(logical){return logical+this.referenceAnchor;}
  bounds(referenceDuration,practiceDuration){const start=Math.max(0,this.referenceAtPractice(0)),end=Math.min(referenceDuration,this.referenceAtPractice(practiceDuration));return {start,end,valid:Number.isFinite(start)&&Number.isFinite(end)&&end-start>.1};}
  nudgePractice(seconds){this.practiceAnchor+=seconds;return this;}
 }
 function driftAction(error,baseRate,elapsedSinceSeek){const distance=Math.abs(error);if(distance>.35&&elapsedSinceSeek>1500)return {seek:true,rate:baseRate};return {seek:false,rate:baseRate*(distance>.04?1+Math.max(-.03,Math.min(.03,error*.25)):1)};}
 function recordingMapping(referenceStart,rate,samples){
  if(!(rate>0))throw new RangeError('Invalid recording speed');
  // A fixed-speed take has a linear time mapping. Presentation samples estimate its
  // intercept; median rejects a late frame callback without introducing rate jitter.
  const offsets=samples.filter(p=>Number.isFinite(p.reference)&&Number.isFinite(p.take)).map(p=>p.take-(p.reference-referenceStart)/rate).sort((a,b)=>a-b);
  const anchor=offsets.length?offsets[Math.floor(offsets.length/2)]:0;
  return new TimeMapping(referenceStart,Math.max(0,anchor),1/rate);
 }
 return {TimeMapping,driftAction,recordingMapping};
});
