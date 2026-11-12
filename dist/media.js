(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SlowMoMedia=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const owners=new WeakMap();
function abortError(){const e=new Error('Operation cancelled.');e.name='AbortError';return e;}
function waitForEvent(target,name,{timeout=6000,signal,action}={}){return new Promise((resolve,reject)=>{
 let timer;const clean=()=>{clearTimeout(timer);target.removeEventListener(name,done);target.removeEventListener('error',bad);signal?.removeEventListener('abort',abort);};
 const finish=(error)=>{clean();error?reject(error):resolve();},done=()=>finish(),bad=()=>finish(new Error('The video or encoder could not respond. Try a compatible video or a shorter section.')),abort=()=>finish(abortError());
 if(signal?.aborted){reject(abortError());return;}target.addEventListener(name,done);target.addEventListener('error',bad);signal?.addEventListener('abort',abort,{once:true});timer=setTimeout(()=>finish(new Error('Media did not respond in time. Please try again.')),timeout);try{action?.();}catch(e){finish(e);}
 });}
function guard(promise,{signal,timeout=8000}={}){return new Promise((resolve,reject)=>{let timer,settled=false;const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);error?reject(error):resolve(value);},abort=()=>finish(abortError());Promise.resolve(promise).then(v=>finish(null,v),e=>finish(e));if(signal?.aborted){abort();return;}signal?.addEventListener('abort',abort,{once:true});timer=setTimeout(()=>finish(new Error('Media did not respond in time. Please try again.')),timeout);});}
async function seek(media,time,options={}){if(options.signal?.aborted)throw abortError();if(!Number.isFinite(time)||time<0)throw new Error('Invalid video position.');if(Math.abs(media.currentTime-time)<.01&&!media.seeking&&media.readyState>=1)return;await waitForEvent(media,'seeked',{...options,action:()=>{media.currentTime=time;}});}
async function playTogether(elements,{signal,isCurrent=()=>true,timeout=8000}={}){
 let failed=false;const token={},valid=()=>!failed&&!signal?.aborted&&isCurrent(),stop=()=>elements.forEach(el=>{if(owners.get(el)===token)el.pause();});
 if(!valid())throw abortError();elements.forEach(el=>owners.set(el,token));signal?.addEventListener('abort',stop,{once:true});
 try{await guard(Promise.all(elements.map(async el=>{if(!valid())throw abortError();await el.play();if(!valid()){if(owners.get(el)===token)el.pause();throw abortError();}})),{signal,timeout});if(!valid())throw abortError();}
 catch(e){failed=true;stop();throw e;}finally{signal?.removeEventListener('abort',stop);}
}
return {abortError,waitForEvent,guard,seek,playTogether};
});
