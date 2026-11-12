// Private, origin-local recording backups. Only recorded takes are stored, never
// selected reference/practice files. Summaries avoid loading every video Blob.
(()=>{
'use strict';
let queue=Promise.resolve();
function open(){return new Promise((resolve,reject)=>{
 if(!window.indexedDB){reject(new Error('Local recording storage is unavailable.'));return;}
 const r=indexedDB.open('slowmo-recordings',1);let cancelled=false;const timer=setTimeout(()=>{cancelled=true;reject(new Error('Local recording storage is busy.'));},6000);
 r.onupgradeneeded=()=>{r.result.createObjectStore('takes',{keyPath:'id'});r.result.createObjectStore('summaries',{keyPath:'id'});};
 r.onsuccess=()=>{clearTimeout(timer);if(cancelled){r.result.close();return;}resolve(r.result);};r.onerror=()=>{clearTimeout(timer);reject(r.error);};r.onblocked=()=>{cancelled=true;clearTimeout(timer);reject(new Error('Close other SlowMo windows and try saving again.'));};
});}
function run(mode,action){const result=queue.then(async()=>{const db=await open();return new Promise((resolve,reject)=>{let value;const tx=db.transaction(['takes','summaries'],mode);try{action(tx,v=>value=v);}catch(e){try{tx.abort();}catch{}db.close();reject(e);return;}tx.oncomplete=()=>{db.close();resolve(value);};tx.onabort=tx.onerror=()=>{db.close();reject(tx.error||new Error('Local save failed.'));};});});queue=result.catch(()=>{});return result;}
window.SlowMoTakes={
 save(take){return run('readwrite',tx=>{tx.objectStore('takes').put(take);tx.objectStore('summaries').put({id:take.id,created:take.created,duration:take.duration,rate:take.rate});});},
 load(id){return run('readonly',(tx,set)=>{tx.objectStore('takes').get(id).onsuccess=e=>set(e.target.result);});},
 list(){return run('readonly',(tx,set)=>{tx.objectStore('summaries').getAll().onsuccess=e=>set(e.target.result.sort((a,b)=>b.created-a.created));});},
 remove(id){return run('readwrite',tx=>{tx.objectStore('takes').delete(id);tx.objectStore('summaries').delete(id);});}
};
})();
