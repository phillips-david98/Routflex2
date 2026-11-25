'use strict';
// Actual adapter/controller over a native-select-shaped DOM fixture. No browser, network or user data.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const Executor=require('../js/planning-resource-executor.js');
const Editors=require('../js/planning-driver-editors.js');
const Contract=require('../js/palm-contract.js');
const source=fs.readFileSync(path.join(__dirname,'../js/planning-resource-executor-ui.js'),'utf8');
const mapHtml=fs.readFileSync(path.join(__dirname,'../map.html'),'utf8');
const bridge=fs.readFileSync(path.join(__dirname,'../js/planning-save-bridge.js'),'utf8');
const beginDriver=/beginDriver\(formId,driverId\)\s*\{([\s\S]*?)\r?\n\s*\},\s*\r?\n\s*closeDriver:/.exec(bridge)?.[1];
assert(beginDriver,'actual ATT09 beginDriver body found');
const uid=n=>String(n).padStart(8,'0')+'-0000-4000-8000-000000000000';
const person=(n,name='Profissional '+n)=>({coreUserId:uid(n),membershipId:uid(n+100),displayName:name});
const ref=p=>({coreUserId:p.coreUserId,membershipId:p.membershipId});
const plain=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
const scope={tenantId:uid(1000),operationSessionId:uid(1001),planningSessionId:'test-session',sourceSessionId:null,userId:uid(1002),membershipId:uid(1003)};
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
class Element {
  constructor(tag,id=''){this.tagName=tag.toUpperCase();this.id=id;this.children=[];this.hidden=false;this.required=false;this.disabled=false;this._value='';this.textContent='';this.onchange=null;this.onclick=null;}
  set innerHTML(_){throw Error('The real adapter must use safe textContent, never HTML');}
  get value(){return this._value;}
  set value(value){const text=String(value??'');this._value=this.tagName==='SELECT'&&!this.children.some(option=>option.value===text)?'':text;}
  replaceChildren(...children){this.children=[];if(this.tagName==='SELECT')this._value='';for(const child of children)this.appendChild(child);}
  appendChild(node){this.children.push(node);if(this.tagName==='SELECT'&&this.children.length===1)this._value=node.value;return node;}
  querySelector(selector){return selector==='[type="submit"]'?this.submit:null;}
}
function fixture(){
  const elements=new Map(),listeners=new Map(),calls={pages:[],checks:[],captures:[],signals:[],forbidden:[]};
  let connected=true,current={scope:{...scope},identity:{},activation:1,capabilities:'edit'};
  for(const form of ['driver-form','driver-edit-form']){
    const prefix=form==='driver-form'?'driver':'driver-edit';const formEl=new Element('form',form);formEl.submit=new Element('button');elements.set(form,formEl);
    for(const [suffix,tag]of [['legacy-manager-field','div'],['palm-executor-field','div'],['manager-input','input'],['name-input','input'],
      ['palm-executor-input','select'],['palm-executor-status','small'],['palm-executor-load','button']])elements.set(prefix+'-'+suffix,new Element(tag,prefix+'-'+suffix));
    elements.get(prefix+'-manager-input').value='Responsável legado preservado';elements.get(prefix+'-manager-input').required=true;
    elements.get(prefix+'-name-input').value='Motorista fictício';elements.get(prefix+'-palm-executor-field').hidden=true;
  }
  const el=(form,suffix)=>elements.get((form==='driver-form'?'driver':'driver-edit')+'-'+suffix);
  const formValues=form=>Object.fromEntries(['manager-input','name-input','palm-executor-input'].map(suffix=>{const item=el(form,suffix);return[item.id,item.value];}));
  const editors=Editors.create({readContext:()=>current,readValues:formValues});
  const page=(items=[],nextCursor=null)=>({version:1,...Object.fromEntries(['tenantId','operationSessionId','planningSessionId'].map(k=>[k,current.scope[k]])),items,nextCursor});
  const readers={page:async()=>page(),check:async()=>null};
  const forbidden=name=>(...args)=>{calls.forbidden.push({name,args});throw Error('Forbidden business operation '+name);};
  const auth={fieldMissionAssignees:(...args)=>{calls.pages.push(args);return readers.page(...args);},
    fieldMissionAssigneeStatus:(...args)=>{calls.checks.push(args);return readers.check(...args);},
    fieldMissionRead:forbidden('mission-read'),fieldMissionWrite:forbidden('mission-write'),fieldMissionArchive:forbidden('mission-archive'),
    snapshotWrite:forbidden('snapshot-write'),publishOpsRoute:forbidden('ops-publish')};
  const context={PlanningResourceExecutor:Executor,PalmPlanningContract:Contract,
    document:{getElementById:id=>elements.get(id)||null,createElement:tag=>new Element(tag)},
    window:{addEventListener:(name,fn)=>{if(!listeners.has(name))listeners.set(name,[]);listeners.get(name).push(fn);}},
    isConnectedCustomerMode:()=>connected,ROUTFLEX_PLANNING_AUTH:auth,
    ROUTFLEX_PLANNING_WORK:{context:()=>current,signal:name=>calls.signals.push(name)},
    ROUTFLEX_PLANNING_SAVE:{drivers:{input(form){calls.captures.push({form,values:formValues(form)});return editors.input(form);}}},
    drivers:editors,context:()=>current,formValues,fetch:forbidden('fetch'),localStorage:{setItem:forbidden('localStorage')},
    sessionStorage:{setItem:forbidden('sessionStorage')},console};
  vm.createContext(context);vm.runInContext(source+'\nglobalThis.testUI=installPlanningResourceExecutorUI();',context);
  vm.runInContext('globalThis.testBeginDriver=function(formId,driverId){'+beginDriver+'};',context);
  const ui=context.testUI;
  function open(form,driver){ui.prepare(form,driver);const draft=context.testBeginDriver(form,driver?.id??null);ui.open(form,driver,draft);return draft;}
  function change(form,value){const select=el(form,'palm-executor-input');select.value=value;
    // Actual document listener captures before select.onchange; adapter captures accepted final state again.
    context.ROUTFLEX_PLANNING_SAVE.drivers.input(form);select.onchange?.({target:select});}
  return{ui,el,elements,calls,editors,readers,page,open,change,formValues,beginDriver:context.testBeginDriver,
    mode:value=>{connected=value;},context:()=>current,advance:patch=>{current={...current,...patch};},
    event:name=>{for(const listener of listeners.get(name)||[])listener();}};
}

for(const form of ['driver-form','driver-edit-form'])test(form+': real select handler captures accepted local pair and explicit clearing in ATT09',async()=>{
  const f=fixture(),one=person(1),two=person(2);f.readers.page=async()=>f.page([one,two]);f.open(form,{id:'driver-1'});await tick();
  const select=f.el(form,'palm-executor-input');assert.equal(select.disabled,false);assert.equal(select.value,'');
  assert.deepEqual(select.children.map(item=>item.value),['',Executor.encode(ref(one)),Executor.encode(ref(two))]);
  f.change(form,Executor.encode(ref(two)));assert.deepEqual(plain(f.ui.read(form,{id:'driver-1'})),ref(two));
  let pending=f.editors.pending();assert.equal(pending.length,1);assert.equal(pending[0].draft[select.id],Executor.encode(ref(two)));
  assert.equal(f.calls.captures.at(-1).values[select.id],Executor.encode(ref(two)));assert(f.calls.signals.includes('editors'));
  f.change(form,'null');assert.equal(f.ui.read(form,{id:'driver-1'}),null);pending=f.editors.pending();assert.equal(pending[0].draft[select.id],'null');
  assert.equal(f.elements.get(form).submit.textContent,'Aplicar alterações');assert.deepEqual(f.calls.forbidden,[]);
});

test('prepare before real beginDriver restores a draft even when the value is absent from initial native options',async()=>{
  const f=fixture(),form='driver-edit-form',one=person(1),two=person(2),driver={id:'driver-1',palmExecutor:ref(one)};
  f.readers.page=async()=>f.page([one,two]);f.readers.check=async(session,membership)=>membership===two.membershipId?two:one;
  f.open(form,driver);await tick();f.change(form,Executor.encode(ref(two)));f.ui.close(form);
  f.ui.prepare(form,driver);const select=f.el(form,'palm-executor-input');assert.equal(select.value,Executor.encode(ref(one)));
  const draftValues=f.beginDriver(form,driver.id);
  assert.equal(select.value,'','native select cannot hold an option not yet inserted');
  f.ui.open(form,driver,draftValues);assert.equal(select.value,Executor.encode(ref(two)),'open inserts and selects the exact preserved draft');
  await tick();assert.deepEqual(plain(f.ui.read(form,driver)),ref(two));assert.equal(f.editors.pending()[0].original[select.id],Executor.encode(ref(one)));
  assert.equal(f.editors.pending()[0].draft[select.id],Executor.encode(ref(two)));assert.deepEqual(driver.palmExecutor,ref(one));
});

test('original unavailable association remains represented, readable and unchanged',async()=>{
  const f=fixture(),form='driver-edit-form',one=person(1),driver={id:'driver-1',palmExecutor:ref(one)};
  f.readers.check=async()=>{throw{code:'FIELD_ASSIGNEE_NOT_ELIGIBLE'};};f.open(form,driver);await tick();
  const select=f.el(form,'palm-executor-input');assert.equal(select.value,Executor.encode(ref(one)));
  assert(select.children.some(option=>option.value===Executor.encode(ref(one))&&option.textContent.includes(one.membershipId)));
  assert.match(f.el(form,'palm-executor-status').textContent,/inelegível.*referência foi mantida/);
  assert.deepEqual(plain(f.ui.read(form,driver)),ref(one));assert.deepEqual(f.editors.pending(),[]);assert.deepEqual(f.calls.forbidden,[]);
});

test('new unapplied association is preserved but Apply stays blocked after eligibility lookup fails',async()=>{
  const f=fixture(),form='driver-form',one=person(1),driver={id:'driver-1'};f.readers.page=async()=>f.page([one]);
  f.open(form,driver);await tick();f.change(form,Executor.encode(ref(one)));f.ui.close(form);
  f.readers.page=async()=>f.page([]);f.readers.check=async()=>{throw{code:'CORE_UNAVAILABLE'};};f.open(form,driver);await tick();
  const select=f.el(form,'palm-executor-input');assert.equal(select.value,Executor.encode(ref(one)));
  assert.throws(()=>f.ui.read(form,driver),/Atualize a consulta.*editor foi preservado/);
  assert.equal(f.editors.pending()[0].draft[select.id],Executor.encode(ref(one)));assert.deepEqual(f.calls.forbidden,[]);
});

test('legacy free-text field is hidden but byte-preserved and is not a PALM default',async()=>{
  const f=fixture(),form='driver-form',old=f.el(form,'manager-input').value;
  f.open(form,{id:'driver-1',responsavel:'Empresa diferente'});await tick();
  assert.equal(f.el(form,'legacy-manager-field').hidden,true);assert.equal(f.el(form,'palm-executor-field').hidden,false);
  assert.equal(f.el(form,'manager-input').required,false);assert.equal(f.el(form,'manager-input').value,old);
  assert.equal(f.el(form,'palm-executor-input').value,'');assert.equal(f.ui.read(form,{id:'driver-1'}),undefined);
  assert.deepEqual(f.calls.forbidden,[]);
});

test('returning to Legacy restores its required free-text field without directory reads',async()=>{
  const f=fixture(),form='driver-form';f.open(form,{id:'driver-1'});await tick();const pageCount=f.calls.pages.length;
  f.mode(false);f.ui.prepare(form,{id:'driver-1'});f.ui.open(form,{id:'driver-1'});
  assert.equal(f.el(form,'legacy-manager-field').hidden,false);assert.equal(f.el(form,'palm-executor-field').hidden,true);
  assert.equal(f.el(form,'manager-input').required,true,'legacy form validation must retain its pre-Connected requirement');
  assert.equal(f.calls.pages.length,pageCount);assert.equal(f.ui.read(form,{id:'driver-1'}),undefined);
});

for(const form of ['driver-form','driver-edit-form'])test(form+': Legacy literal sentinels retain optional validation and exact existing text',()=>{
  const f=fixture();
  for(const value of ['null','undefined','none','NULL',' None ','\tUndefined\n']){
    const driver={id:'driver-sentinel',responsavel:value};f.el(form,'manager-input').value=value;
    f.mode(true);f.ui.prepare(form,driver);assert.equal(f.el(form,'manager-input').required,false);
    f.mode(false);f.ui.prepare(form,driver);
    assert.equal(f.el(form,'manager-input').required,false,'legacy sentinel '+JSON.stringify(value)+' remains optional');
    assert.equal(f.el(form,'manager-input').value,value,'sentinel bytes remain unchanged');
    assert.equal(driver.responsavel,value);assert.equal(f.el(form,'palm-executor-field').hidden,true);
  }
  assert.equal(f.calls.pages.length,0);assert.equal(f.calls.checks.length,0);assert.deepEqual(f.calls.forbidden,[]);
});

test('Legacy non-sentinels keep required validation, including missing or null-valued data',()=>{
  const f=fixture(),form='driver-edit-form';f.mode(false);
  for(const value of [undefined,null,'','Maria Silva','None da Silva','undefined value','nulla']){
    const driver={id:'driver-legacy',responsavel:value},original='Texto local intocado';f.el(form,'manager-input').value=original;
    f.ui.prepare(form,driver);assert.equal(f.el(form,'manager-input').required,true,JSON.stringify(value));
    assert.equal(f.el(form,'manager-input').value,original);assert.equal(driver.responsavel,value);
  }
  assert.equal(f.calls.pages.length,0);assert.equal(f.calls.checks.length,0);
});

test('empty directory, authorization failure and retry have concrete status and preserve original identity',async()=>{
  const f=fixture(),form='driver-form',one=person(1),driver={id:'driver-1',palmExecutor:ref(one)};
  f.readers.page=async()=>{throw{code:'ACCESS_DENIED'};};f.readers.check=async()=>one;f.open(form,driver);await tick();
  assert.equal(f.el(form,'palm-executor-input').disabled,true);assert.match(f.el(form,'palm-executor-status').textContent,/Consulta não autorizada/);
  assert.match(f.el(form,'palm-executor-load').textContent,/Tentar consulta novamente/);assert.deepEqual(plain(f.ui.read(form,driver)),ref(one));
  f.readers.page=async()=>f.page([]);f.el(form,'palm-executor-load').onclick();await tick();
  assert.match(f.el(form,'palm-executor-status').textContent,/Nenhum profissional PALM elegível/);
  assert.equal(f.el(form,'palm-executor-input').value,Executor.encode(ref(one)));assert.deepEqual(f.calls.forbidden,[]);
});

test('pagination button invokes only the existing authorized directory reader',async()=>{
  const f=fixture(),form='driver-form',one=person(1,'Nome igual'),two=person(2,'Nome igual');
  f.readers.page=async(session,cursor)=>cursor===null?f.page([one],'cursor-2'):f.page([two],null);
  f.open(form,{id:'driver-1'});await tick();assert.equal(f.el(form,'palm-executor-load').textContent,'Mais profissionais');
  f.el(form,'palm-executor-load').onclick();await tick();assert.equal(f.calls.pages.length,2);assert.equal(f.calls.pages[1][1],'cursor-2');
  const select=f.el(form,'palm-executor-input');assert.equal(select.children.length,3);assert.notEqual(select.children[1].textContent,select.children[2].textContent);
  assert.equal(select.value,'');assert.deepEqual(f.calls.forbidden,[]);
});

test('normal options render names safely with textContent, without interpreting HTML',async()=>{
  const f=fixture(),form='driver-form',one=person(1,'<svg onload="businessWrite()">');f.readers.page=async()=>f.page([one]);
  f.open(form,{id:'driver-1'});await tick();const option=f.el(form,'palm-executor-input').children[1];
  assert(option.textContent.startsWith(one.displayName));assert.equal(option.children.length,0);assert.deepEqual(f.calls.forbidden,[]);
});

test('captured DOM choice rejected by the controller is corrected before ATT09 final capture',async()=>{
  const f=fixture(),form='driver-form',one=person(1);f.readers.page=async()=>f.page([one]);f.open(form,{id:'driver-1'});await tick();
  const select=f.el(form,'palm-executor-input'),forged=new Element('option');forged.value=Executor.encode(ref(person(9)));forged.textContent='Injected unauthorized option';select.appendChild(forged);
  f.change(form,forged.value);assert.equal(select.value,'');assert.equal(f.calls.captures.at(-1).values[select.id],'');
  assert.deepEqual(f.editors.pending(),[]);assert.equal(f.ui.read(form,{id:'driver-1'}),undefined);assert.deepEqual(f.calls.forbidden,[]);
});

test('context event disables the selector; delayed old response cannot paint the new session',async()=>{
  const f=fixture(),form='driver-form',gate=deferred(),page=f.page([person(1)]);f.readers.page=()=>gate.promise;
  f.open(form,{id:'driver-1'});f.advance({scope:{...scope,planningSessionId:'other-session'},activation:2});f.event('routflex:integration-context-changed');
  assert.equal(f.el(form,'palm-executor-input').disabled,true);assert.match(f.el(form,'palm-executor-status').textContent,/Contexto alterado/);
  gate.resolve(page);await tick();assert.equal(f.el(form,'palm-executor-input').children.length,1);
  assert.match(f.el(form,'palm-executor-status').textContent,/Contexto alterado/);assert.throws(()=>f.ui.read(form,{id:'driver-1'}),/contexto autorizado/);
});

test('prepare closes the prior resource owner before a new resource is opened in the same form',async()=>{
  const f=fixture(),form='driver-edit-form',gate=deferred(),oldPage=f.page([person(1)]),two=person(2);
  f.readers.page=()=>gate.promise;f.open(form,{id:'driver-1'});
  f.readers.page=async()=>f.page([two]);f.open(form,{id:'driver-2'});await tick();
  const select=f.el(form,'palm-executor-input'),values=select.children.map(value=>value.value);gate.resolve(oldPage);await tick();
  assert.deepEqual(select.children.map(value=>value.value),values);assert(select.children.some(value=>value.value===Executor.encode(ref(two))));
  assert.throws(()=>f.ui.read(form,{id:'driver-1'}),/contexto autorizado/);assert.equal(f.ui.read(form,{id:'driver-2'}),undefined);
});

test('read rejects a native select value changed without the real handler',async()=>{
  const f=fixture(),form='driver-form',one=person(1);f.readers.page=async()=>f.page([one]);f.open(form,{id:'driver-1'});await tick();
  f.el(form,'palm-executor-input').value=Executor.encode(ref(one));assert.throws(()=>f.ui.read(form,{id:'driver-1'}),/Revise a seleção/);
});

const hiddenFields=['driver-legacy-manager-field','driver-palm-executor-field','driver-edit-legacy-manager-field','driver-edit-palm-executor-field'];
const inlineStyles=html=>[...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(match=>match[1]).join('\n');
const withoutComments=css=>css.replace(/\/\*[\s\S]*?\*\//g,'');
function hiddenRules(css){return[...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .filter(match=>hiddenFields.some(id=>match[1].includes('#'+id))&&match[1].includes('[hidden]'));}

test('hidden PALM/Legacy wrappers have a scoped author-level override against .field display:flex',()=>{
  const css=withoutComments(inlineStyles(mapHtml)),rules=hiddenRules(css);
  assert.match(css,/\.field\s*\{[^}]*display\s*:\s*flex\s*;/,'existing author display overrides the browser hidden default');
  const seen=new Set();
  for(const rule of rules){
    assert.match(rule[2],/(?:^|;)\s*display\s*:\s*none\s*!important\s*;?\s*$/,'explicit important hide beats the field layout');
    const ids=[...rule[1].matchAll(/#([\w-]+)/g)].map(match=>match[1]);
    for(const id of ids){assert(hiddenFields.includes(id),'hide rule cannot affect another control');seen.add(id);}
    const scopeOnly=rule[1].replace(/#[\w-]+/g,'').replace(/\[hidden\]/g,'').replace(/:is/g,'').replace(/[\s,()]/g,'');
    assert.equal(scopeOnly,'','rule contains only the four field IDs and their hidden condition');
  }
  assert.deepEqual([...seen].sort(),hiddenFields.slice().sort(),'all four wrappers must be covered');
  for(const id of hiddenFields)assert.match(mapHtml,new RegExp('<div\\s+class="field"\\s+id="'+id+'"(?:\\s+hidden)?\\s*>'));
});

test('the new hidden-wrapper override preserves all other inline Planning CSS from the pre-change checkpoint',()=>{
  const checkpoint=fs.readFileSync(path.join(__dirname,'../../docs/planning-palm-executor-20261109/checkpoint/frontend/map.html'),'utf8');
  let current=withoutComments(inlineStyles(mapHtml));
  for(const rule of hiddenRules(current))current=current.replace(rule[0],'');
  const normalize=css=>css.replace(/\s+/g,' ').trim();
  assert.equal(normalize(current),normalize(withoutComments(inlineStyles(checkpoint))),
    'header, map, INS, other forms and breakpoints retain their previous CSS');
});
