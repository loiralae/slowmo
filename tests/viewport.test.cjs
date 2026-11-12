const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const source=readFileSync(new URL('../dist/app.js',`file://${__filename}`),'utf8');
const measurement=source.slice(source.indexOf('function measureViewport(){'),source.indexOf('\nfunction refreshViewport(){'));
function measure(window,initial={}){
 const values=new Map(Object.entries(initial)),classes=new Set();
 const root={style:{getPropertyValue:k=>values.get(k)||'',setProperty:(k,v)=>values.set(k,v)},classList:{add:k=>classes.add(k)}};
 vm.runInNewContext(measurement+'\nmeasureViewport();',{window,document:{documentElement:root}});
 return {values:Object.fromEntries(values),measured:classes.has('viewport-measured')};
}
test('uses the exposed webview rectangle, not a larger tab or physical screen',()=>{
 const r=measure({innerWidth:744,innerHeight:1133,screen:{height:1133},visualViewport:{width:744,height:1109,offsetTop:0,offsetLeft:0,scale:1}});
 assert.equal(r.values['--app-height'],'1109px');assert.equal(r.values['--app-top'],'0px');assert.ok(r.measured);
});
test('preserves reported fractional viewport dimensions and offsets without guessed insets',()=>{
 const r=measure({visualViewport:{width:743.5,height:1108.75,offsetTop:1.25,offsetLeft:.5,scale:1}});
 assert.deepEqual(r.values,{'--app-width':'743.5px','--app-height':'1108.75px','--app-left':'0.5px','--app-top':'1.25px'});
});
test('falls back to inner dimensions when VisualViewport is unavailable',()=>{
 const r=measure({innerWidth:1133,innerHeight:744});assert.equal(r.values['--app-width'],'1133px');assert.equal(r.values['--app-height'],'744px');assert.equal(r.values['--app-left'],'0px');
});
test('does not resize the layout to a pinch-zoomed rectangle',()=>{
 const r=measure({visualViewport:{width:372,height:554,offsetTop:50,offsetLeft:20,scale:2}},{'--app-height':'1109px'});
 assert.deepEqual(r.values,{'--app-height':'1109px'});assert.equal(r.measured,false);
});
test('ignores an unavailable viewport while a webview is being restored',()=>{
 const r=measure({innerWidth:0,innerHeight:0,visualViewport:{width:0,height:0,scale:1}},{'--app-height':'1109px'});
 assert.deepEqual(r.values,{'--app-height':'1109px'});assert.equal(r.measured,false);
});
