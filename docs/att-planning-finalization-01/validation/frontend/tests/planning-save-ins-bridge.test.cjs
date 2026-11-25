'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Stage=require('../js/planning-ins-stage.js'),Drafts=require('../js/planning-insight-drafts.js'),Import=require('../js/planning-ins-import.js');
const copy=value=>JSON.parse(JSON.stringify(value));
const version=n=>'v1:'+String(n).padStart(64,'0');
const scope={tenantId:'tenant',operationSessionId:'operation',planningSessionId:'session',sourceSessionId:null,userId:'user',membershipId:'member'};
function fixture(options={}){
  const ctx={scope:copy(scope),identity:{user:'user'},activation:1,capabilities:'edit/import'},meta={id:'session'};
  const base={source_system:'IMPORT',company_id:'',external_customer_id:'001',storageScope:'session',scope:{tenantId:scope.tenantId,operationSessionId:scope.operationSessionId,planningSessionId:scope.planningSessionId},planningRevision:1,entityVersion:version(1),categoria:'B',status:'normal',moeda:'BRL',faturamento:100,operador:'Equipe',mix_produto:'Mix',concorrente:'nao',observacoes:['preservar'],overrideFields:[],enterpriseValues:{categoria:'B',status:'normal',moeda:'BRL',faturamento:100,operador:'Equipe',mix_produto:'Mix',concorrente:'nao',observacoes:['preservar']}};
  const frontend=value=>({...copy(value),mixProduto:value.mix_produto,restoreFields:[]});
  const client={id:'client',...base},key=Import.key(base),snapshot={version:2,revision:1,tenantId:scope.tenantId,operationSessionId:scope.operationSessionId,session:{sessionId:scope.planningSessionId,planningProfile:'VISITS'},clients:[{customerKey:key}],drivers:[],routes:[],routingConstraints:{}};
  let flow,hooks,confirmed=frontend(base),editorDraft=null,writes=0,reads=0,populates=0,importAllowed=true,dirtyGeneration=0,saved=0,failed=0;
  const io={write:null,read:null},hints=[],localCheckpoints=[];
  const fields={};for(const [field,value]of Object.entries({categoria:'B',status:'normal',moeda:'BRL',faturamento:100,operador:'Equipe','mix-produto':'Mix',concorrente:'nao','obs-input':''}))fields['ins-'+field]={value:String(value)};
  function rawDraft(){return {...copy(editorDraft||confirmed),categoria:fields['ins-categoria'].value,status:fields['ins-status'].value,moeda:fields['ins-moeda'].value,faturamento:fields['ins-faturamento'].value===''?null:Number(fields['ins-faturamento'].value),operador:fields['ins-operador'].value,mixProduto:fields['ins-mix-produto'].value,concorrente:fields['ins-concorrente'].value};}
  const readContext=()=>ctx;
  const sandbox={console,Map,Set,WeakMap,Event,TextEncoder,crypto:require('node:crypto').webcrypto,setTimeout,clearTimeout,
    PlanningInsStage:Stage,PlanningInsightDrafts:Drafts,PlanningDriverEditors:{create:()=>({pending:()=>[],input(){}})},
    PlanningSaveCoordinator:{create:value=>{hooks=value;return options.realCoordinator?require('../js/planning-save-coordinator.js').create(value):{view:()=>null};}},
    PlanningSaveBases:{sameSnapshotContent:()=>true,equalSnapshot:()=>true,verifyBaseMembership:()=>true,compareCurve:()=>true},
    PlanningLocalRecovery:{list:()=>[]},PlanningSnapshotStore:{validate(){}},PlanningWorkRecovery:require('../js/planning-work-recovery.js'),
    ROUTFLEX_PLANNING_WORK:{context:readContext,signal(){},flushLocal(){localCheckpoints.push(copy(flow?.resolved()||[]));return Promise.resolve(true);},view:()=>({documentId:'current'}),list:()=>({records:[],error:null})},
    ROUTFLEX_PLANNING_AUTH:{refreshCapabilities:async()=>{},snapshotRead:async()=>{reads++;return copy(snapshot);},insightWrite:async(session,kind,payload,current)=>{writes++;return io.write?io.write(payload,current):{items:[]};}},
    window:{addEventListener(){},dispatchEvent(){},confirm:()=>false},document:{getElementById:id=>fields[id]||null,addEventListener(){}},
    state:{activePlanningSessionId:'session',hasUnsavedPlanChanges:false,dragClientId:null},
    connectedPlanningSaveQueues:new Map(),connectedRecoveryInspections:new Map(),connectedRecoveryManualSave:new Set(),
    connectedPlanningSnapshots:{remote:()=>copy(snapshot),revision:()=>1,ownsRecovery:()=>false},
    connectedCurveDrafts:{pending:()=>[],ownsRecovery:()=>false,stageMany(){}},
    planningLocalStorage:{},planningSessionRegistry:new Map([['session',meta]]),
    isPlanningAutosaveEnabled:()=>false,isConnectedCustomerMode:()=>true,connectedCurveScope:()=>scope,connectedSnapshotKey:()=> 'snapshot-key',
    getPlanningPersistenceEntry:()=>({changeSeq:dirtyGeneration,savedSeq:0}),buildConnectedPlanningSnapshot:()=>copy(snapshot),
    markPlanAsDirty(){dirtyGeneration++;},markPlanAsSaved(){saved++;},markPlanSaveError(){failed++;},beginPlanningPersistence(){},hasPendingPdvEditDraft:()=>false,
    _insClientRef:client,_insEditContext:{ready:true,ticket:{isCurrent:()=>true},scope:{...scope,customerKey:key},base:copy(base)},_insRecoveryRecords:[],_insEditorReadyToken:1,_insLoadToken:1,
    _insRecoveryStore:{list:()=>[],listSession:()=>[],acknowledge(){}},_insCacheError:false,_insHydrationSeq:0,_insReadSequence:0,_insPendingSaveIdentityKeys:new Set(),
    _captureInsightDraftFromEditor:()=>rawDraft(),_getInsightDraft:()=>editorDraft,
    _clearInsightDraftForClient(){editorDraft=null;},getConfirmedClientInsight:()=>confirmed,_emptyClientInsight:()=>frontend(base),
    _insPayloadToState:frontend,
    _insHasUnsavedChanges(){const actual=rawDraft(),expected=flow?flow.effective(client,confirmed):confirmed;return Stage.fields.some(field=>JSON.stringify(actual[field==='mix_produto'?'mixProduto':field])!==JSON.stringify(expected[field==='mix_produto'?'mixProduto':field]));},
    _populateInsightPanel(c,value){populates++;for(const field of Stage.fields.filter(f=>f!=='observacoes')){const id='ins-'+(field==='mix_produto'?'mix-produto':field);fields[id].value=String(value[field==='mix_produto'?'mixProduto':field]??'');}},
    _refreshInsDraftUX(){},_setInsEditorDisabled(){},_applyConfirmedInsightBulk(clients,items){confirmed=frontend(items[0]);},_rawSessionClients:()=>[client],applyFilters(){},
    _fetchClientInsightsBulk:async()=>{reads++;return io.read?io.read():[copy(base)];},
    buildClientCanonicalKey:()=>key,buildClientIdentityKey:value=>Import.key(value),_insIdentityKey:value=>Import.key(value),identityFromBackendRecord:value=>value,identityToBackendRecord:value=>value,
    planningCan:cap=>cap!=='import'||importAllowed,updatePlannerHint:value=>hints.push(value),renderOperationalContext(){},normalizeCurveCode:value=>value,
  };
  const code=fs.readFileSync(require('node:path').join(__dirname,'../js/planning-save-bridge.js'),'utf8');vm.createContext(sandbox);vm.runInContext(code+'\nglobalThis.flow=installPlanningSaveFlow();',sandbox);flow=sandbox.flow;
  return {flow,sandbox,ctx,base,fields,key,client,io,hints,snapshot,localCheckpoints,get hooks(){return hooks;},writes:()=>writes,reads:()=>reads,populates:()=>populates,saved:()=>saved,failed:()=>failed,
    set(field,value){fields['ins-'+field].value=String(value);},denyImport(){importAllowed=false;ctx.capabilities='edit';},
    response(capture){return capture.entries.map(entry=>({...copy(entry.base),...copy(entry.patch),entityVersion:version(2),overrideFields:Object.keys(entry.intents).filter(field=>!entry.intents[field].restore)}));}};
}
function useRealInsightEditor(f){
  const source=fs.readFileSync(require('node:path').join(__dirname,'../map.html'),'utf8');
  const names=['_getOrCreateInsight','_cloneClientInsight','_getInsightDraft','_getOrCreateInsightDraft','_populateInsightPanel','_captureInsightDraftFromEditor','_insHasUnsavedChanges'];
  const bodies=names.map(name=>{const start=source.indexOf('function '+name+'(');assert.ok(start>=0);const rest=source.slice(start),end=/\n(?:async )?function [A-Za-z_$]/.exec(rest);assert.ok(end);return rest.slice(0,end.index);});
  Object.assign(f.sandbox,{ROUTFLEX_PLANNING_SAVE:f.flow,LogisticsUI:{readProfile:()=>null,populateProfile(){},profileIsDirty:()=>false},
    _insKeyFor:()=>f.key,insightDraftKey:()=>f.key,_applyInsightDraftForClient:(client,value)=>{f.sandbox.state.clientInsightDrafts[f.key]=value;},
    _clearInsightDraftForClient:()=>{delete f.sandbox.state.clientInsightDrafts[f.key];},_renderInsObsList(){},_renderInsHistList(){},_updateFaturamentoLabel(){},sanitizeText:value=>value,_insSnapshot:null});
  f.sandbox.state.clientInsights={[f.key]:f.sandbox.getConfirmedClientInsight()};f.sandbox.state.clientInsightDrafts={};
  for(const id of ['ins-scope-status','ins-panel-title','ins-panel-subtitle','ins-ultima-atualizacao','ins-close-confirm'])f.fields[id]={value:'',textContent:'',hidden:false};
  for(const field of Object.values(f.fields)){let text=String(field.value??'');Object.defineProperty(field,'value',{get:()=>text,set:value=>{text=String(value??'');},enumerable:true,configurable:true});}
  vm.runInContext(bodies.join('\n'),f.sandbox);
}
test('real INS bridge Apply stages complete fields with zero business writes/read requests and uses effective local values',()=>{const f=fixture();f.set('categoria','A');assert.equal(f.flow.applyIns(),true);assert.equal(f.writes(),0);assert.equal(f.reads(),0);assert.equal(f.flow.pendingIns()[0].patch.categoria,'A');assert.equal(f.sandbox._insHasUnsavedChanges(),false);assert.deepEqual(f.flow.pendingIns()[0].patch.observacoes,['preservar']);assert.equal(f.sandbox.getConfirmedClientInsight().categoria,'B');});
test('real bridge blocks unapplied editor and never applies it during capture',()=>{const f=fixture();f.set('categoria','A');const batch=f.hooks.capture({origin:'manual'});assert.ok(batch.blockers.some(value=>value.includes('Ficha INS')));assert.equal(batch.ins.entries.length,0);assert.equal(f.flow.pendingIns().length,0);assert.equal(f.writes(),0);});
test('real bridge compares only changed editor fields for import overlap',()=>{const f=fixture();f.set('categoria','A');const editor=f.flow.importEditors()[0];assert.deepEqual(copy(editor.values),{categoria:'A'});assert.equal(editor.customerKey,f.key);const row={identity:f.base,base:f.base,values:{status:'alerta'},line:2};assert.equal(f.flow.stage.previewImport([row],{keyFor:()=>f.key,editors:f.flow.importEditors()}).valid,true);row.values={categoria:'C'};assert.equal(f.flow.stage.previewImport([row],{keyFor:()=>f.key,editors:f.flow.importEditors()}).valid,false);});
test('real bridge ACK advances editor base while preserving unapplied edits made during Save',()=>{const f=fixture();f.set('categoria','A');f.flow.applyIns();const batch=f.hooks.capture({origin:'manual'});batch.confirmedRevision=1;const step=f.hooks.steps(batch).find(item=>item.id==='ins');const oldPopulates=f.populates();f.set('categoria','C');step.ack(batch,{items:f.response(batch.ins)},null,batch);assert.equal(f.fields['ins-categoria'].value,'C');assert.equal(f.populates(),oldPopulates);assert.equal(f.sandbox._insEditContext.base.entityVersion,version(2));assert.equal(f.flow.applyIns(),true);assert.equal(f.flow.pendingIns()[0].base.entityVersion,version(2));assert.equal(f.flow.pendingIns()[0].patch.categoria,'C');});
test('real bridge ACK preserves later applied generation and advances its verified base',()=>{const f=fixture();f.set('categoria','A');f.flow.applyIns();const batch=f.hooks.capture({origin:'manual'});batch.confirmedRevision=1;f.set('categoria','C');f.flow.applyIns();const step=f.hooks.steps(batch).find(item=>item.id==='ins');step.ack(batch,{items:f.response(batch.ins)},null,batch);assert.equal(f.flow.pendingIns()[0].patch.categoria,'C');assert.equal(f.flow.pendingIns()[0].base.entityVersion,version(2));assert.equal(f.fields['ins-categoria'].value,'C');});
test('real bridge validation rejects staged import after import permission is removed before Save',async()=>{const f=fixture();f.flow.stage.applyImport([{identity:f.base,base:f.base,values:{categoria:'A'},line:2}],{keyFor:()=>f.key});f.denyImport();const batch=f.hooks.capture({origin:'manual'});await assert.rejects(f.hooks.validate(batch),error=>/IMPORT|PERMISSION|capacidade|autoriz/i.test(error.code||error.message));assert.equal(f.writes(),0);assert.equal(f.flow.pendingIns().length,1);});
test('real Phase 1 registry keeps INS applied intentions when accepted confirmed envelopes refresh without another local edit',()=>{
  const f=fixture();f.set('categoria','A');f.flow.applyIns();
  const Registry=require('../js/planning-work-registry.js'),Session=require('../js/planning-work-session.js'),Adapters=require('../js/planning-work-adapters.js'),Runtime=require('../js/planning-work-runtime.js');
  const values=new Map(),storage={keys:()=>[...values.keys()],getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
  const source={context:()=>f.ctx,acceptedContext:()=>f.ctx,persistence:()=>({status:'saved',changeSeq:0,savedSeq:0}),revision:()=>1,
    remote:()=>({revision:1,clients:[]}),working:()=>({revision:1,clients:[]}),clients:()=>[],curves:()=>[],keyFor:()=>f.key,insKey:()=>f.key,insSaving:()=>false,
    pdvEditor:()=>null,insEditor:()=>null,recoveries:()=>[],insApplied:()=>({items:f.flow.pendingIns()}),appliedVersion:()=>f.flow.appliedVersion()};
  const runtime=Runtime.create({Registry,Session,Adapters,source,storage,documentId:'test-ins-applied',timers:{setTimeout:()=>1,clearTimeout(){}}});
  runtime.signal('all');runtime.flushLocal();assert.equal(runtime.view().domains.ins.applied.items[0].patch.categoria,'A');
  runtime.acceptIns('session',[f.client],[copy(f.base)]);runtime.flushLocal();
  assert.equal(runtime.view().domains.ins.confirmed.items[0].base.categoria,'B');
  assert.equal(runtime.view().domains.ins.applied.items[0].patch.categoria,'A');
});
test('real bridge and coordinator keep a lost INS response unknown and never replay on Save or Autosave',async()=>{
  const f=fixture({realCoordinator:true});let server=copy(f.base);f.io.read=async()=>[copy(server)];
  f.io.write=async payload=>{server={...server,...payload.customers[0],entityVersion:version(2),overrideFields:['categoria']};throw Object.assign(new Error('lost response'),{code:'NETWORK_ERROR'});};
  f.set('categoria','A');f.flow.applyIns();assert.equal(await f.flow.save('manual'),false);
  assert.equal(f.writes(),1);assert.equal(f.flow.journal().phase,'unknown');assert.equal(f.flow.journal().steps[0].reconciliation.match,'matched');
  assert.equal(f.flow.pendingIns().length,1);assert.equal(f.saved(),0);assert.equal(f.sandbox.getConfirmedClientInsight().categoria,'B');
  assert.equal(await f.flow.save('manual'),false);assert.equal(await f.flow.save('autosave'),false);assert.equal(f.writes(),1);assert.equal(f.flow.pendingIns().length,1);
});
test('real bridge explicit unknown acceptance rechecks server, updates confirmed and leaves later applied work pending',async()=>{
  const f=fixture({realCoordinator:true});let server=copy(f.base);f.io.read=async()=>[copy(server)];
  f.io.write=async payload=>{server={...server,...payload.customers[0],entityVersion:version(2),overrideFields:['categoria']};throw Object.assign(new Error('timeout'),{code:'REQUEST_TIMEOUT'});};
  f.set('categoria','A');f.flow.applyIns();await f.flow.save('manual');f.set('categoria','C');f.flow.applyIns();
  const outcome=await f.flow.coordinator.resolveUnknown('ins','accept-confirmed');
  assert.equal(outcome.phase,'confirmed');assert.equal(f.writes(),1);assert.equal(f.sandbox.getConfirmedClientInsight().categoria,'A');
  assert.equal(f.flow.pendingIns()[0].patch.categoria,'C');assert.equal(f.flow.pendingIns()[0].base.entityVersion,version(2));
});
test('real bridge keeps INS intentions after CAS and refuses another write when fresh validation finds the competing base',async()=>{
  const f=fixture({realCoordinator:true});let server=copy(f.base);f.io.read=async()=>[copy(server)];
  f.io.write=async()=>{server={...server,entityVersion:version(9),categoria:'C'};throw Object.assign(new Error('CAS'),{status:409,code:'INSIGHT_VERSION_CONFLICT'});};
  f.set('categoria','A');f.flow.applyIns();assert.equal(await f.flow.save('manual'),false);assert.equal(f.flow.journal().phase,'conflict');
  assert.equal(f.flow.pendingIns().length,1);assert.equal(f.saved(),0);await f.flow.save('manual');assert.equal(f.writes(),1);
});
test('real bridge preserves applied INS in memory when local checkpoint reports quota failure and performs no business write',()=>{
  const f=fixture();let flushes=0;f.sandbox.ROUTFLEX_PLANNING_WORK.flushLocal=()=>{flushes++;return {state:'error',error:{code:'WORK_STORAGE_QUOTA'}};};
  f.sandbox.ROUTFLEX_PLANNING_WORK.status=()=>({state:'error',error:{code:'WORK_STORAGE_QUOTA'}});
  f.set('categoria','A');assert.equal(f.flow.applyIns(),true);assert.ok(flushes>0);assert.equal(f.flow.pendingIns()[0].patch.categoria,'A');
  assert.equal(f.sandbox.ROUTFLEX_PLANNING_WORK.status().error.code,'WORK_STORAGE_QUOTA');assert.equal(f.writes(),0);assert.equal(f.saved(),0);
});
test('real recovery bridge preserves imported field provenance and original record bytes after explicit restoration',async()=>{
  const f=fixture();const detached=Stage.create({readContext:()=>f.ctx,validateBase:Import.validateBase});
  detached.stageManual({customerKey:f.key,base:f.base,draft:{...copy(f.base),mixProduto:f.base.mix_produto,categoria:'A'},origin:'import'});
  const record={format:'planning-work',version:1,scope:copy(scope),storageKey:'rfx:planning-work:v1:prior',documentId:'prior',origin:'previous-document',raw:'preserved INS work',
    domains:{snapshot:{confirmed:{revision:1,snapshot:copy(f.snapshot)},applied:null,editors:[]},curves:{applied:null,editors:[]},ins:{applied:{items:detached.pending()},editors:[]}}};
  const original=JSON.stringify(record);f.sandbox.ROUTFLEX_PLANNING_WORK.list=()=>({records:[record],error:null});f.sandbox.ROUTFLEX_PLANNING_WORK.inspect=value=>copy(value);f.sandbox.window.confirm=()=>true;
  const options=await f.flow.recoveryOptions({id:'session'},{list:()=>[],inspect(){},resolve(){},export:async()=>{}});
  const preview=await options.inspect(record);assert.equal(preview.comparison.compatible,true);assert.equal(await options.resolve(record,preview,'restore'),true);
  assert.ok(f.localCheckpoints.some(refs=>refs.some(ref=>ref.storageKey===record.storageKey&&/^[a-f0-9]{64}$/.test(ref.sha256))));
  assert.equal(f.flow.pendingIns()[0].intents.categoria.origin,'import');assert.equal(JSON.stringify(record),original);assert.equal(f.writes(),0);
  f.denyImport();await assert.rejects(f.hooks.validate(f.hooks.capture({origin:'manual'})),error=>error.code==='SAVE_IMPORT_PERMISSION_REQUIRED');
});
test('real recovery bridge can restore curves-only work without requiring a nonempty INS batch',async()=>{
  const f=fixture();const curve={source_system:f.base.source_system,company_id:f.base.company_id,external_customer_id:f.base.external_customer_id,
    curve_code:'Z',scope:copy(f.base.scope),storageScope:'session',entityVersion:version(1),planningRevision:1,overrideFields:[],enterpriseValues:{curve_code:'Z'}};
  const entry={customerKey:f.key,client:f.client,curveCode:'A',baseCode:'Z',expectedVersion:version(1),expectedPlanningRevision:1,baseEnvelope:curve};
  f.sandbox.requireClientCanonicalIdentity=value=>value;f.sandbox.validateConnectedInsightEnvelope=()=>{};
  f.sandbox.connectedCustomerRead=async()=>({items:[copy(curve)]});let staged=0;f.sandbox.connectedCurveDrafts.stageMany=()=>{staged++;};
  const record={format:'planning-work',version:1,scope:copy(scope),storageKey:'rfx:planning-work:v1:curve-prior',documentId:'prior',origin:'previous-document',raw:'preserved curve work',
    domains:{snapshot:{confirmed:{revision:1,snapshot:copy(f.snapshot)},applied:null,editors:[]},curves:{applied:{items:[entry]},editors:[]},ins:{applied:null,editors:[]}}};
  f.sandbox.ROUTFLEX_PLANNING_WORK.list=()=>({records:[record],error:null});f.sandbox.ROUTFLEX_PLANNING_WORK.inspect=value=>copy(value);f.sandbox.window.confirm=()=>true;
  const options=await f.flow.recoveryOptions({id:'session'},{list:()=>[],inspect(){},resolve(){},export:async()=>{}});
  const preview=await options.inspect(record);assert.equal(preview.comparison.compatible,true);assert.equal(await options.resolve(record,preview,'restore'),true);
  assert.ok(f.localCheckpoints.some(refs=>refs.some(ref=>ref.storageKey===record.storageKey&&/^[a-f0-9]{64}$/.test(ref.sha256))));
  assert.equal(staged,1);assert.equal(f.flow.pendingIns().length,0);assert.equal(f.writes(),0);
});
test('real map editor retains applied observations and inheritance restoration when another field is edited',()=>{
  const f=fixture();useRealInsightEditor(f);
  const base={...copy(f.base),categoria:'A',overrideFields:['categoria']};f.sandbox._insEditContext.base=base;
  f.sandbox.state.clientInsights[f.key]={...copy(base),mixProduto:base.mix_produto,restoreFields:[]};
  const applied={...copy(base),mixProduto:base.mix_produto,categoria:'B',observacoes:['preservar','local'],restoreFields:['categoria']};
  f.flow.stage.stageManual({customerKey:f.key,base,draft:applied});
  f.sandbox._populateInsightPanel(f.client,f.flow.effective(f.client,f.sandbox.state.clientInsights[f.key]));
  assert.equal(f.sandbox._insHasUnsavedChanges(),false,'An already applied restoration must not remain an unapplied editor');
  f.set('status','alerta');const captured=f.sandbox._captureInsightDraftFromEditor(f.client);
  assert.deepEqual(copy(captured.observacoes),['preservar','local']);assert.deepEqual(copy(captured.restoreFields),['categoria']);
  f.sandbox._clearInsightDraftForClient(f.client);const observationDraft=f.sandbox._getOrCreateInsightDraft(f.client);
  assert.deepEqual(copy(observationDraft.observacoes),['preservar','local']);assert.deepEqual(copy(observationDraft.restoreFields),['categoria']);
});
test('real map editor displays and recaptures zero estimated revenue without converting it to empty/null',()=>{
  const f=fixture();useRealInsightEditor(f);f.flow.stage.stageManual({customerKey:f.key,base:f.base,draft:{...copy(f.base),mixProduto:f.base.mix_produto,faturamento:0}});
  f.sandbox._populateInsightPanel(f.client,f.flow.effective(f.client,f.sandbox.getConfirmedClientInsight()));
  assert.equal(String(f.fields['ins-faturamento'].value),'0');assert.equal(f.sandbox._insHasUnsavedChanges(),false);
  f.set('status','alerta');assert.equal(f.sandbox._captureInsightDraftFromEditor(f.client).faturamento,0);
});

test('real import bridge merges disjoint editor fields and retains pending observations without reverting imported fields on later Apply',()=>{
  const f=fixture();useRealInsightEditor(f);
  const editor=f.sandbox._getOrCreateInsightDraft(f.client);editor.observacoes.push('observação adicionada localmente');
  f.set('categoria','A');f.set('obs-input','texto ainda não adicionado');
  const row={line:2,identity:copy(f.base),base:copy(f.base),values:{status:'alerta'}};
  f.flow.applyImport([row]);
  assert.equal(f.writes(),0);assert.equal(f.reads(),0);assert.equal(f.fields['ins-categoria'].value,'A');
  assert.equal(f.fields['ins-status'].value,'alerta');assert.equal(f.fields['ins-obs-input'].value,'texto ainda não adicionado');
  assert.deepEqual(copy(f.sandbox._getInsightDraft(f.client).observacoes),['preservar','observação adicionada localmente']);
  assert.equal(f.sandbox._getInsightDraft(f.client).status,'alerta');
  assert.equal(f.flow.applyIns(),false,'An unadded observation remains a blocking editor condition');
  f.set('obs-input','');assert.equal(f.flow.applyIns(),true);
  const applied=f.flow.pendingIns()[0];assert.equal(applied.patch.status,'alerta');assert.equal(applied.patch.categoria,'A');
  assert.equal(applied.intents.status.origin,'import');assert.equal(applied.intents.categoria.origin,'manual');
  assert.deepEqual(applied.patch.observacoes,['preservar','observação adicionada localmente']);assert.equal(f.writes(),0);
});

test('real import bridge rejects overlapping editor fields without changing the editor, stage or confirmed base',()=>{
  const f=fixture();useRealInsightEditor(f);f.set('categoria','A');
  const before=JSON.stringify(f.sandbox.getConfirmedClientInsight());
  assert.throws(()=>f.flow.applyImport([{line:2,identity:copy(f.base),base:copy(f.base),values:{categoria:'C'}}]),error=>error.code==='INS_STAGE_OVERLAP');
  assert.equal(f.fields['ins-categoria'].value,'A');assert.equal(f.flow.pendingIns().length,0);
  assert.equal(JSON.stringify(f.sandbox.getConfirmedClientInsight()),before);assert.equal(f.writes(),0);
});
