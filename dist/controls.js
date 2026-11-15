(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SlowMoControls=api;})(typeof window!=='undefined'?window:globalThis,function(){
'use strict';
// Presentation only: never changes playback, camera streams or loop timing.
class AutoHide{
 constructor({canHide,isVisible,hide,delay=3000,schedule=(fn,ms)=>setTimeout(fn,ms),cancel=id=>clearTimeout(id)}){Object.assign(this,{canHide,isVisible,hide,delay,schedule,cancel});this.timer=null;this.epoch=0;this.holds=new Set();}
 stop(){++this.epoch;this.cancel(this.timer);this.timer=null;}
 refresh(){this.stop();if(this.holds.size||!this.isVisible()||!this.canHide())return;const epoch=this.epoch;this.timer=this.schedule(()=>{this.timer=null;if(epoch!==this.epoch||this.holds.size||!this.isVisible()||!this.canHide())return;this.hide();},this.delay);}
 hold(reason){this.holds.add(reason);this.stop();}
 release(reason){this.holds.delete(reason);this.refresh();}
 reset(){this.holds.clear();this.refresh();}
}
return {AutoHide};
});
