'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Recovery=require('../js/planning-work-recovery.js');
const copy=value=>JSON.parse(JSON.stringify(value));
const token='v1:'+'a'.repeat(64),key='IMPORT||0001';
function fixture(){
  let context={scope:{tenantId:'tenant',operationSessionId:'operation',planningSessionId:'session',sourceSessionId:null,userId:'user',membershipId:'membership'},identity:{},activation:1};
  const scope={tenantId:'tenant',operationSessionId:'operation',planningSessionId:'session'};
  let remote={revision:3,tenantId:'tenant',operationSessionId:'operation',savedAt:'2026-11-08T01:00:00Z',savedBy:'user',
    session:{sessionId:'session',planningProfile:'VISITS'},clients:[{customerKey:key,id:'visit-1',driverId:'driver-1'}],drivers:[{id:'driver-1',name:'Motorista'}],routes:[]};
  const base={source_system:'IMPORT',company_id:'',external_customer_id:'0001',entityVersion:token,planningRevision:3,scope,storageScope:'session',
    categoria:'B',status:'normal',moeda:'BRL',faturamento:100,operador:'',mix_produto:'',concorrente:'',observacoes:[],historico:[],enterpriseHistory:[],logistics_profile:null,
    overrideFields:[],enterpriseValues:{categoria:'B',status:'normal',moeda:'BRL',faturamento:100,operador:'',mix_produto:'',concorrente:'',observacoes:[]}};
  let ins=copy(base),curve={source_system:'IMPORT',company_id:'',external_customer_id:'0001',entityVersion:token,planningRevision:3,scope,storageScope:'session',curve_code:'Z',overrideFields:[],enterpriseValues:{curve_code:'Z'}};
  const working=copy(remote);working.drivers[0].name='Aplicado localmente';
  const record={format:'planning-work',version:1,scope:copy(context.scope),generation:8,storageKey:'work-key',raw:'exact original bytes',
    domains:{snapshot:{confirmed:{revision:3,snapshot:copy(remote)},applied:{baseRevision:3,snapshot:working},editors:[],recoveries:[]},
      ins:{confirmed:null,applied:{items:[{customerKey:key,base:copy(base),patch:{...copy(base),categoria:'A'},intents:{categoria:{value:'A',restore:false,generation:1}}}]},editors:[],recoveries:[]},
      curves:{confirmed:{items:[{customerKey:key,curveCode:'Z',entityVersion:token,planningRevision:3,curveOverride:false,curveEnterpriseCode:'Z'}]},
        applied:{items:[{customerKey:key,baseCode:'Z',curveCode:'Y',expectedVersion:token,expectedPlanningRevision:3,baseEnvelope:copy(curve),client:{sourceSystem:'IMPORT',companyId:'',externalCustomerId:'0001'}}]},editors:[],recoveries:[]}}};
  const effects=[],reads={snapshot:0,ins:0,curves:0,exact:0};let exactRecord=()=>copy(record),onSnapshot=null,allow=true;
  const hooks={context:()=>context,current:ticket=>context.identity===ticket.identity&&context.activation===ticket.activation&&JSON.stringify(context.scope)===JSON.stringify(ticket.scope),
    list:()=>[record],inspectRecord:()=>{reads.exact++;return exactRecord();},readSnapshot:()=>{reads.snapshot++;if(onSnapshot)onSnapshot();return copy(remote);},
    readIns:entries=>{reads.ins++;assert.equal(entries.length,1);return [copy(ins)];},readCurves:entries=>{reads.curves++;assert.equal(entries.length,1);return new Map([[key,copy(curve)]]);},
    restore:(record,preview)=>{effects.push(['restore',record.storageKey,preview.revision]);},acceptServer:record=>{effects.push(['server',record.storageKey]);},
    exportReport:report=>{effects.push(['export',report]);return true;},confirm:()=>allow};
  const options=Recovery.create(hooks);
  return{options,hooks,record,base,effects,reads,get context(){return context;},set context(v){context=v;},get remote(){return remote;},set remote(v){remote=v;},
    get ins(){return ins;},set ins(v){ins=v;},get curve(){return curve;},set curve(v){curve=v;},set allow(v){allow=v;},exact(fn){exactRecord=fn;},snapshot(fn){onSnapshot=fn;}};
}
test('all domains compare against fresh bases; restore is explicit and only invokes local hook',async()=>{
  const f=fixture(),before=copy(f.record);const listed=f.options.list();assert.equal(listed[0],f.record);
  const preview=await f.options.inspect(f.record);assert.equal(preview.comparison.compatible,true);assert.deepEqual(preview.allowedActions,['server','restore']);
  assert.ok(preview.comparison.rows.some(row=>row.path.includes('snapshot')));assert.ok(preview.comparison.rows.some(row=>row.path.includes('ins.')));assert.ok(preview.comparison.rows.some(row=>row.path.includes('curvas.')));
  assert.deepEqual(f.effects,[]);assert.deepEqual(f.record,before);assert.equal(await f.options.resolve(f.record,preview,'restore'),true);
  assert.deepEqual(f.effects,[['restore','work-key',3]]);assert.equal(f.reads.snapshot,4);assert.deepEqual(f.record,before);
});
test('snapshot full-base divergence or revision change blocks restoration without replacing tokens',async()=>{
  for(const change of[f=>{f.remote.drivers[0].name='Other';},f=>{f.remote.revision=4;},f=>{f.record.domains.snapshot.applied.baseRevision=2;}]){
    const f=fixture();change(f);if(f.remote.revision===4){f.ins.planningRevision=4;f.curve.planningRevision=4;}
    const preview=await f.options.inspect(f.record);assert.equal(preview.comparison.compatible,false);assert.match(preview.comparison.reason,/snapshot/);
    await assert.rejects(f.options.resolve(f.record,preview,'restore'),/RECOVERY_CONFLICT/);assert.deepEqual(f.effects,[]);
  }
});
test('INS business data, entity version and inherited data must all match',async()=>{
  for(const change of[base=>{base.entityVersion='v1:'+'b'.repeat(64);},base=>{base.faturamento=200;},base=>{base.enterpriseValues.categoria='C';},base=>{base.overrideFields=['categoria'];}]){
    const f=fixture();change(f.ins);const preview=await f.options.inspect(f.record);
    assert.equal(preview.comparison.compatible,false);assert.match(preview.comparison.reason,/INS/);assert.deepEqual(f.effects,[]);
  }
});
test('curve base, versions and inheritance are separate from commercial category',async()=>{
  const f=fixture();f.ins.categoria='B';f.curve.curve_code='X';const preview=await f.options.inspect(f.record);
  assert.equal(preview.comparison.compatible,false);assert.match(preview.comparison.reason,/A–Z/);assert.equal(f.record.domains.ins.applied.items[0].patch.categoria,'A');
  const inheritance=fixture();inheritance.curve.enterpriseValues.curve_code='A';assert.equal((await inheritance.options.inspect(inheritance.record)).comparison.compatible,false);
  const envelope=fixture();envelope.record.domains.curves.applied.items[0].baseEnvelope={...copy(envelope.curve),overrideFields:['curve_code']};
  assert.equal((await envelope.options.inspect(envelope.record)).comparison.compatible,false);
});
test('nullable company remains the same canonical external identity; inheritance envelope flags still require equality',async()=>{
  const f=fixture();f.ins.company_id=null;f.curve.company_id=null;
  const preview=await f.options.inspect(f.record);assert.equal(preview.comparison.compatible,true);
  for(const domain of ['ins','curves']){
    const changed=fixture();(domain==='ins'?changed.ins:changed.curve).inherited=false;
    assert.equal((await changed.options.inspect(changed.record)).comparison.compatible,false);
  }
});
test('duplicate identities inside a captured journal cannot hide behind pending-entry deduplication',async()=>{
  const f=fixture(),entry=copy(f.record.domains.ins.applied.items[0]);
  f.record.domains.snapshot.applied.journal={phase:'unknown',steps:[],captured:{ins:[entry,copy(entry)]}};
  await assert.rejects(f.options.inspect(f.record),/WORK_RECOVERY_RECORD_INVALID/);assert.deepEqual(f.effects,[]);
});
test('an unapplied editor is displayed but never silently converted to applied work',async()=>{
  for(const domain of['snapshot','ins','curves']){
    const f=fixture();f.record.domains[domain].editors=[{draft:{name:'Typed only'}}];const preview=await f.options.inspect(f.record);
    assert.equal(preview.comparison.compatible,false);assert.match(preview.comparison.reason,/editores não aplicados/);assert.deepEqual(preview.allowedActions,['server']);
    assert.ok(preview.comparison.rows.some(row=>row.path.includes('editores')));assert.deepEqual(f.effects,[]);
  }
});
test('unknown, in-flight and unacknowledged journal outcomes prohibit replay',async()=>{
  for(const journal of[{phase:'unknown',steps:[]},{phase:'saving',steps:[]},{phase:'partial',steps:[{status:'unknown'}]},
    {phase:'partial',steps:[{status:'confirmed',ackPending:true}]},{phase:'pending',steps:[{status:'pending',inFlight:true}]}]){
    const f=fixture();f.record.domains.snapshot.applied.journal=journal;const before=copy(f.record),preview=await f.options.inspect(f.record);
    assert.equal(preview.comparison.compatible,false);assert.match(preview.comparison.reason,/resultado desconhecido/);
    assert.equal(await f.options.resolve(f.record,preview,'server'),true);assert.deepEqual(f.effects,[['server','work-key']]);assert.deepEqual(f.record,before);
  }
});
test('accept server acknowledges an explicit decision without deleting bytes; discard is unsupported',async()=>{
  const f=fixture(),preview=await f.options.inspect(f.record);f.allow=false;
  assert.equal(await f.options.resolve(f.record,preview,'server'),false);assert.deepEqual(f.effects,[]);
  f.allow=true;assert.equal(await f.options.resolve(f.record,preview,'server'),true);assert.equal(f.record.raw,'exact original bytes');
  await assert.rejects(f.options.resolve(f.record,preview,'discard'),/RECOVERY_ACTION_INVALID/);
});
test('changed context or exact local bytes stops both resolution paths',async()=>{
  for(const action of['server','restore']){
    const f=fixture(),preview=await f.options.inspect(f.record);f.exact(()=>({...copy(f.record),raw:'changed'}));
    await assert.rejects(f.options.resolve(f.record,preview,action),/RECOVERY_CONTENT_CHANGED/);assert.deepEqual(f.effects,[]);
    const moved=fixture(),prior=await moved.options.inspect(moved.record);moved.context={...moved.context,identity:{}};
    await assert.rejects(moved.options.resolve(moved.record,prior,action),/RECOVERY_SCOPE_CHANGED/);assert.deepEqual(moved.effects,[]);
  }
});
test('server change while comparing or after confirmation forces a new preview',async()=>{
  const f=fixture();f.snapshot(()=>{if(f.reads.snapshot===2)f.remote.drivers[0].name='Concurrent';});
  await assert.rejects(f.options.inspect(f.record),/RECOVERY_PREVIEW_CHANGED/);assert.deepEqual(f.effects,[]);
  const later=fixture(),preview=await later.options.inspect(later.record);later.remote.revision++;
  await assert.rejects(later.options.resolve(later.record,preview,'server'),/RECOVERY_PREVIEW_CHANGED/);assert.deepEqual(later.effects,[]);
});
test('keeping server after review does not reread customer details or require an INS comparison',async()=>{
  const f=fixture(),preview=await f.options.inspect(f.record);f.ins.status='alerta';
  f.hooks.readIns=()=>assert.fail('server decision must not rebuild INS comparisons');
  f.hooks.readCurves=()=>assert.fail('server decision must not rebuild curve comparisons');
  assert.equal(await f.options.resolve(f.record,preview,'server'),true);
  assert.deepEqual(f.effects,[['server','work-key']]);
});
test('invalid identity, duplicate or missing reads never become a compatible recovery',async()=>{
  for(const change of[f=>{f.ins.external_customer_id='1';},f=>{f.ins.scope.tenantId='other';},f=>{f.hooks.readIns=()=>[];},f=>{f.hooks.readIns=()=>[f.ins,f.ins];}]){
    const f=fixture();change(f);await assert.rejects(f.options.inspect(f.record),/WORK_RECOVERY_RESPONSE_INVALID/);assert.deepEqual(f.effects,[]);
  }
  const absent=fixture();absent.remote.clients=[];assert.match((await absent.options.inspect(absent.record)).comparison.reason,/ausente do snapshot/);
});
test('INS-only journal records do not require or restore a snapshot payload',async()=>{
  const f=fixture();f.record.domains.snapshot.applied={snapshot:null,baseRevision:3,journal:{phase:'blocked',steps:[]}};
  f.record.domains.curves.applied=null;const preview=await f.options.inspect(f.record);assert.equal(preview.comparison.compatible,true);
  assert.equal(f.reads.curves,0);assert.equal(await f.options.resolve(f.record,preview,'restore'),true);
});
test('future records remain inspection evidence; export preserves exact original content',async()=>{
  const f=fixture();f.record.version=2;f.record.future=true;const preview=await f.options.inspect(f.record);
  assert.equal(preview.comparison.compatible,false);assert.match(preview.comparison.reason,/Formato/);
  assert.equal(await f.options.export(),true);const report=f.effects[0][1];assert.equal(report.readOnly,true);assert.equal(report.records[0].raw,f.record.raw);
});
test('compact export preserves complete raw domains, exact UTF-8 bytes and every evidence metadata field',async()=>{
  const f=fixture(),hash=value=>require('node:crypto').createHash('sha256').update(value).digest('hex');
  f.record.domains.snapshot.applied.snapshot.drivers[0].name='A\u00e7\u00e3o preservada';
  const document={format:f.record.format,version:f.record.version,scope:copy(f.record.scope),
    generation:f.record.generation,domains:copy(f.record.domains)};
  const raw=JSON.stringify(document,null,2)+'\r\n',bytes=Buffer.from(raw,'utf8');
  Object.assign(f.record,{raw,storageBackend:'indexeddb',documentId:'original-document.1',
    updatedAt:'2026-11-23T01:00:00Z',integrity:{sha256:hash(bytes),bytes:bytes.length},sha256:hash(bytes)});
  const before=copy(f.record),metadata={...before};delete metadata.domains;
  assert.equal(await f.options.export(),true);
  const report=f.effects[0][1],exported=report.records[0];
  assert.equal(report.recordEncoding,'raw-complete-with-metadata');assert.equal(report.readOnly,true);
  assert.deepEqual(report.scope,f.context.scope);assert.deepEqual(exported,metadata);
  assert.equal(Object.hasOwn(exported,'domains'),false);assert.deepEqual(JSON.parse(exported.raw),document);
  assert.deepEqual(Buffer.from(exported.raw,'utf8'),bytes);assert.equal(hash(exported.raw),before.integrity.sha256);
  assert.deepEqual(f.record,before);assert.equal(f.effects.length,1);
  assert.ok(Buffer.byteLength(JSON.stringify(report))<Buffer.byteLength(JSON.stringify({...report,records:[before]})));
  assert.equal(f.reads.snapshot+f.reads.ins+f.reads.curves,0);
});

test('compact export still rejects changed scope or exact record before emitting any evidence',async()=>{
  const foreign=fixture();foreign.context={...foreign.context,scope:{...foreign.context.scope,userId:'another'}};
  await assert.rejects(foreign.options.export(),/RECOVERY_SCOPE_CHANGED/);assert.deepEqual(foreign.effects,[]);
  const during=fixture();during.exact(()=>{during.context={...during.context,identity:{}};return copy(during.record);});
  await assert.rejects(during.options.export(),/RECOVERY_SCOPE_CHANGED/);assert.deepEqual(during.effects,[]);
  const changed=fixture();changed.exact(()=>({...copy(changed.record),raw:'different bytes'}));
  await assert.rejects(changed.options.export(),/RECOVERY_CONTENT_CHANGED/);assert.deepEqual(changed.effects,[]);
});

test('read errors retain work and do not invoke any resolution callback',async()=>{
  const f=fixture();f.hooks.readCurves=()=>{throw Error('read failed');};
  await assert.rejects(f.options.inspect(f.record),/read failed/);assert.deepEqual(f.effects,[]);assert.equal(f.record.raw,'exact original bytes');
});
test('unknown captured generation remains fully inspectable after live applied entries disappear',async()=>{
  const f=fixture(),old=copy(f.record.domains),sent=copy(f.remote);sent.drivers[0].name='Enviado antes da perda';
  f.record.domains.snapshot.applied={snapshot:null,baseRevision:3,journal:{phase:'unknown',steps:[{id:'snapshot',domain:'snapshot',status:'confirmed'},{id:'ins',domain:'ins',status:'unknown'}],
    captured:{generation:1,baseRevision:3,baseSnapshot:copy(f.remote),sentSnapshot:sent,ins:old.ins.applied.items,curves:old.curves.applied.items}}};
  f.record.domains.ins.applied=null;f.record.domains.curves.applied=null;
  const preview=await f.options.inspect(f.record);assert.equal(preview.comparison.compatible,false);assert.equal(preview.prepared,null);
  assert.equal(f.reads.ins,1);assert.equal(f.reads.curves,1);
  assert.ok(preview.comparison.rows.some(row=>row.path==='geração enviada.snapshot.drivers[0].name'));
  assert.ok(preview.comparison.rows.some(row=>row.path==='geração enviada.ins.'+key+'.categoria'));
  assert.ok(preview.comparison.rows.some(row=>row.path==='geração enviada.curvas.'+key));
  assert.ok(preview.comparison.rows.some(row=>row.path==='Histórico da confirmação.ins'&&row.local.status==='unknown'));
  assert.equal(await f.options.resolve(f.record,preview,'server'),true);assert.deepEqual(f.effects,[['server','work-key']]);
});
function confirmedSnapshotAdvance(f){
  const before=copy(f.remote),sent=copy(f.record.domains.snapshot.applied.snapshot);
  const captured={generation:1,baseRevision:3,baseSnapshot:before,sentSnapshot:sent,ins:copy(f.record.domains.ins.applied.items),curves:copy(f.record.domains.curves.applied.items)};
  f.remote={...sent,revision:4,savedAt:'2026-11-08T02:00:00Z'};f.ins.planningRevision=4;f.curve.planningRevision=4;
  f.record.domains.snapshot.confirmed={revision:4,snapshot:copy(f.remote)};
  f.record.domains.snapshot.applied.journal={phase:'partial',steps:[{id:'snapshot',domain:'snapshot',status:'confirmed'},{id:'ins',domain:'ins',status:'failed'}],captured};
}
test('partial known snapshot ACK permits verified INS and curve base advance with original bytes untouched',async()=>{
  const f=fixture();confirmedSnapshotAdvance(f);const before=copy(f.record),preview=await f.options.inspect(f.record);
  assert.equal(preview.comparison.compatible,true);assert.equal(preview.prepared.baseRevision,4);
  assert.equal(preview.prepared.ins[0].base.planningRevision,4);assert.equal(preview.prepared.ins[0].patch.expectedPlanningRevision,4);
  assert.equal(preview.prepared.curves[0].expectedPlanningRevision,4);assert.equal(preview.prepared.curves[0].baseEnvelope.planningRevision,4);
  assert.equal(preview.prepared.curves[0].expectedVersion,token);assert.deepEqual(f.record,before);
});
test('unknown ACK, changed confirmed snapshot, changed entity or inheritance cannot authorize token advancement',async()=>{
  for(const change of[f=>{f.record.domains.snapshot.applied.journal.steps[0].status='unknown';},f=>{f.record.domains.snapshot.confirmed.snapshot.drivers[0].name='Divergence';},
    f=>{f.curve.entityVersion='v1:'+'c'.repeat(64);},f=>{f.curve.enterpriseValues.curve_code='W';},f=>{f.ins.enterpriseValues.categoria='C';},
    f=>{f.remote.revision=5;f.ins.planningRevision=5;f.curve.planningRevision=5;f.record.domains.snapshot.confirmed={revision:5,snapshot:copy(f.remote)};}]){
    const f=fixture();confirmedSnapshotAdvance(f);change(f);const preview=await f.options.inspect(f.record);
    assert.equal(preview.comparison.compatible,false);assert.equal(preview.prepared,null);assert.deepEqual(f.effects,[]);
  }
});
test('legacy curve evidence without a full envelope stays inspectable and cannot become current staged work',async()=>{
  const f=fixture();delete f.record.domains.curves.applied.items[0].baseEnvelope;
  const preview=await f.options.inspect(f.record);assert.equal(preview.comparison.compatible,false);assert.match(preview.comparison.reason,/A–Z/);
  assert.ok(preview.comparison.rows.some(row=>row.path==='curvas.'+key));assert.equal(await f.options.resolve(f.record,preview,'server'),true);
});
test('captured-only response identity is validated before any business values can be shown',async()=>{
  const f=fixture();const captured=copy(f.record.domains.ins.applied.items);f.record.domains.ins.applied=null;
  f.record.domains.snapshot.applied.journal={phase:'unknown',steps:[],captured:{ins:captured,curves:[]}};f.ins.scope.tenantId='other';
  await assert.rejects(f.options.inspect(f.record),/WORK_RECOVERY_RESPONSE_INVALID/);assert.deepEqual(f.effects,[]);
});
test('200, 1000 and 2000 commercial recovery rows use one bulk read and preserve source bytes',async t=>{
  for(const size of[200,1000,2000]){
    const f=fixture(),items=[];
    f.record.domains.snapshot.applied={snapshot:null,baseRevision:3};f.record.domains.curves.applied=null;
    f.remote.clients=[];
    for(let index=0;index<size;index++){
      const external=String(index).padStart(6,'0'),customerKey='IMPORT||'+external;
      const base={...copy(f.base),external_customer_id:external};items.push(base);f.remote.clients.push({id:'visit-'+index,customerKey});
    }
    f.record.domains.ins.applied={items:items.map(base=>({customerKey:'IMPORT||'+base.external_customer_id,base,
      patch:{...copy(base),categoria:'A'},intents:{categoria:{value:'A',restore:false,generation:1}}}))};
    f.hooks.readIns=()=>{f.reads.ins++;return copy(items);};
    const before=JSON.stringify(f.record),started=performance.now(),preview=await f.options.inspect(f.record);
    t.diagnostic(size+' clients: '+(performance.now()-started).toFixed(3)+' ms, '+preview.comparison.rows.length+' comparison rows');
    assert.equal(preview.comparison.compatible,true);assert.equal(preview.comparison.rows.length,size);
    assert.equal(f.reads.ins,1);assert.equal(f.reads.curves,0);assert.equal(JSON.stringify(f.record),before);assert.deepEqual(f.effects,[]);
  }
});
