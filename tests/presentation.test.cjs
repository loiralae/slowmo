const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const {readFileSync}=require('node:fs');
const source=readFileSync(new URL('../dist/app.js',`file://${__filename}`),'utf8');const fn=source.slice(source.indexOf('function fullscreenNotice('),source.indexOf('\nasync function enterPlayer('));
function notice({active=false,available=true,failed=false,automatic=true}={}){const els={fsRetry:{},fsNotice:{}},player=available?{requestFullscreen(){}}:{};vm.runInNewContext(fn+'\nfullscreenNotice(failed,automatic);',{$:id=>els[id],player,fullscreenElement:()=>active?player:null,standalone:()=>true,failed,automatic});return els;}
test('Home Screen view does not silently imply native fullscreen is active',()=>{const el=notice();assert.equal(el.fsNotice.hidden,false);assert.match(el.fsNotice.textContent,/Tap Full screen/);assert.equal(el.fsRetry.hidden,false);});
test('active container fullscreen hides the request button and notice',()=>{const el=notice({active:true});assert.equal(el.fsNotice.hidden,true);assert.equal(el.fsRetry.hidden,true);});
test('unsupported fullscreen explains the fallback and hides the unavailable action',()=>{const el=notice({available:false});assert.match(el.fsNotice.textContent,/unavailable/);assert.equal(el.fsRetry.hidden,true);});
test('a rejected manual request explains the remaining status bar',()=>{const el=notice({failed:true,automatic:false});assert.match(el.fsNotice.textContent,/whole video fits below/);assert.equal(el.fsNotice.hidden,false);});

const change=source.slice(source.indexOf('function onFullscreenChange(){'),source.indexOf("\n$('enterFullscreen').onclick"));
function fullscreenChange({active=false,immersive=true,had=true}={}){const calls=[],player={classList:{contains:()=>immersive}};vm.runInNewContext('let hadFullscreen='+had+';\n'+change+'\nonFullscreenChange();',{player,fullscreenElement:()=>active?player:null,setImmersive:value=>calls.push(value),fullscreenNotice:()=>calls.push('notice')});return calls;}
test('camera/system fullscreen loss preserves the immersive player rather than restoring page headers',()=>{assert.deepEqual(fullscreenChange(),[true,'notice']);});
test('an explicit player close is not reversed by the fullscreenchange event',()=>{assert.deepEqual(fullscreenChange({immersive:false}),[]);});
test('entering native fullscreen retains the immersive presentation',()=>{assert.deepEqual(fullscreenChange({active:true,had:false}),[true,'notice']);});

const openOverlay=source.slice(source.indexOf('function openPlayerDialog(id){'),source.indexOf("\ndocument.querySelectorAll('.mode-dialog')"));
function overlay(initiallyOpen=false){let shows=0,updates=0,focus;const attributes={};const dialog={open:initiallyOpen,show(){shows++;this.open=true;},showModal(){throw new Error('Native modal top layer must not be used in the player');},setAttribute:(k,v)=>attributes[k]=v,querySelector:()=>({focus:options=>focus=options})};vm.runInNewContext(openOverlay+"\nopenPlayerDialog('practiceDialog');",{$:()=>dialog,updatePlayerDialogState:()=>updates++});return {dialog,shows,updates,attributes,focus};}
test('practice and results overlays avoid native modal top-layer transitions',()=>{const r=overlay();assert.equal(r.dialog.open,true);assert.equal(r.shows,1);assert.equal(r.updates,1);assert.equal(r.attributes['aria-modal'],'true');assert.equal(r.focus.preventScroll,true);});
test('reopening an existing player overlay does not duplicate its presentation',()=>{const r=overlay(true);assert.equal(r.shows,0);assert.equal(r.updates,1);});
