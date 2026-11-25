'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {fixture,copy,read}=require('./planning-save-flow.fixture.cjs');
const tick=()=>new Promise(setImmediate);
function barrier(){
  let enter,release;
  const started=new Promise(resolve=>{enter=resolve;}),completion=new Promise(resolve=>{release=resolve;});
  return {started,release,run(){enter();return completion;}};
}
function setup({duplicate=true,divergent=false}={}){
  const f=fixture('saved'),scope=f.scope('A'),key='rfx:snapshot:A:operator:'+encodeURIComponent(scope.userId)+':'+encodeURIComponent(scope.membershipId);
  vm.runInContext(read('planning-work-recovery')+'\n'+read('planning-local-recovery'),f.c);
  f.c.connectedSnapshotKey=()=>key;
  const snapshot=copy(f.remote);snapshot.clients[0].driverId='recovered';
  const work={format:'planning-work',version:1,documentId:'previous',scope,storageKey:'previous-work',
    domains:{snapshot:{confirmed:{revision:f.remote.revision,snapshot:copy(f.remote)},applied:{baseRevision:f.remote.revision,snapshot},editors:[]},
      ins:{applied:null,editors:[]},curves:{applied:null,editors:[]}}};
  work.raw=JSON.stringify(work);
  let persisted=[],flush=()=>true;
  f.c.ROUTFLEX_PLANNING_WORK.list=async()=>({records:[work,...persisted],error:null});
  f.c.ROUTFLEX_PLANNING_WORK.inspect=async record=>copy(record);
  f.c.ROUTFLEX_PLANNING_WORK.flushLocal=()=>Promise.resolve(flush()).then(ok=>{
    if(ok)persisted=[{storageKey:'decision',domains:{snapshot:{confirmed:{resolvedWork:copy(f.c.ROUTFLEX_PLANNING_SAVE.resolved())}}}}];
    return ok;
  });
  f.c.window.confirm=()=>true;
  f.c.loadConnectedScopedCustomers=async()=>({catalog:[]});f.c.mergePlanningCurveAttributes=async()=>{};
  f.c.restoreConnectedPlanningSnapshot=(_meta,_catalog,snapshot,options)=>{
    if(options.prepare)return {ready:true};f.state.clients=copy(snapshot.clients);
  };
  f.c.applyFilters=()=>{};
  if(duplicate){const legacy={version:2,scope,baseRevision:f.remote.revision,snapshot:copy(snapshot)};
    if(divergent)legacy.snapshot.clients[0].driverId='other-draft';
    f.cache.set(key+':recovery:previous',JSON.stringify(legacy));}
  const previous={list:()=>f.c.PlanningLocalRecovery.list(f.c.planningLocalStorage,key,scope,'snapshot'),inspect(){throw Error('unexpected legacy detail');},resolve(){throw Error('unexpected legacy action');},export(){}};
  return {f,work,key,previous,setFlush:fn=>{flush=fn;},get persisted(){return persisted;},async options(){return f.c.ROUTFLEX_PLANNING_SAVE.recoveryOptions(f.registry.get('A'),previous);}};
}
test('server decision needs no diff/customer lookup, reconciles only exact duplicate and waits for durable resolution',async()=>{
  const s=setup(),{f,work,key}=s,checkpoint=barrier();let done=false;
  s.setFlush(checkpoint.run);
  f.c.loadConnectedScopedCustomers=()=>assert.fail('discard must not build customer catalog');
  const options=await s.options();assert.deepEqual(Array.from(options.list(),record=>record.storageKey),[work.storageKey]);
  const remoteBefore=JSON.stringify(f.remote);
  const pending=options.resolve(work,null,'server').then(value=>{done=true;return value;});
  await checkpoint.started;
  assert.equal(done,false);assert.equal(f.cache.has(key+':recovery:previous'),true);assert.equal(f.calls.writes.length,0);
  checkpoint.release(true);assert.equal(await pending,true);assert.equal(options.list().length,0);assert.equal(JSON.stringify(f.remote),remoteBefore);
  assert.equal(f.cache.has(key+':recovery:previous'),false);
  const next=fixture('saved');next.c.ROUTFLEX_PLANNING_WORK.list=async()=>({records:[work,...s.persisted],error:null});
  assert.equal((await next.c.ROUTFLEX_PLANNING_SAVE.unresolvedWork(next.c.ROUTFLEX_PLANNING_SAVE.context())).length,0);
});
test('a legacy copy replaced or removed during durable confirmation is preserved independently and cannot trap the resolved Work decision',async()=>{
  for(const action of['server','restore'])for(const changed of[false,true]){
    const s=setup(),{f,work,key}=s,storageKey=key+':recovery:previous',checkpoint=barrier();
    s.setFlush(checkpoint.run);
    const options=await s.options(),decision=options.resolve(work,null,action);
    await checkpoint.started;
    let replacement=null;
    if(changed){const value=JSON.parse(f.cache.get(storageKey));value.snapshot.clients[0].driverId='concurrent draft';replacement=JSON.stringify(value);f.cache.set(storageKey,replacement);}
    else f.cache.delete(storageKey);
    checkpoint.release(true);assert.equal(await decision,true);assert.equal(f.cache.get(storageKey)??null,replacement);
    const reopened=await s.options();assert.equal(reopened.list().length,changed?1:0);
    assert.equal(reopened.list().some(record=>record.storageKey===work.storageKey),false);assert.equal(f.calls.writes.length,0);
  }
});
test('storage read or removal failure still blocks confirmation while the exact original duplicate exists and can retry',async()=>{
  for(const failure of['read','remove','unverified-remove']){
    const s=setup(),{f,work,key}=s,storageKey=key+':recovery:previous',checkpoint=barrier();
    s.setFlush(checkpoint.run);
    const options=await s.options(),decision=options.resolve(work,null,'server');
    await checkpoint.started;
    const get=f.c.planningLocalStorage.getItem,remove=f.c.planningLocalStorage.removeItem;
    if(failure==='read')f.c.planningLocalStorage.getItem=selected=>{if(selected===storageKey)throw Error('storage read failed');return get(selected);};
    else f.c.planningLocalStorage.removeItem=()=>{if(failure==='remove')throw Error('storage remove failed');};
    checkpoint.release(true);await assert.rejects(decision,/storage|RECOVERY_CONTENT_CHANGED/);assert.equal(f.cache.has(storageKey),true);
    f.c.planningLocalStorage.getItem=get;f.c.planningLocalStorage.removeItem=remove;s.setFlush(()=>true);
    const reopened=await s.options();assert.equal(await reopened.resolve(work,null,'server'),true);assert.equal(f.cache.has(storageKey),false);
  }
});
test('restoring one generation reconciles its exact legacy copy and permits authenticated coordinated Save',async()=>{
  const s=setup(),{f,work,key}=s,options=await s.options();
  assert.equal(await options.resolve(work,null,'restore'),true);
  assert.equal(f.state.clients[0].driverId,'recovered');assert.equal(f.state.hasUnsavedPlanChanges,true);
  assert.equal(f.cache.has(key+':recovery:previous'),false);assert.equal(f.calls.writes.length,0);
  const pending=f.c.ROUTFLEX_PLANNING_SAVE.save('manual');await tick();
  assert.equal(f.calls.writes.length,1);assert.equal(f.calls.writes[0].payload.snapshot.clients[0].driverId,'recovered');
  f.acknowledge();assert.equal(await pending,true);assert.equal(f.remote.clients[0].driverId,'recovered');
});
test('divergent legacy draft stays visible and prevents restoration from silently replacing another generation',async()=>{
  const s=setup({divergent:true}),options=await s.options();assert.equal(options.list().length,2);
  await assert.rejects(options.resolve(s.work,null,'restore'),/RECOVERY_LEGACY_REVIEW_REQUIRED/);
  assert.equal(s.f.calls.writes.length,0);assert.equal(s.f.state.hasUnsavedPlanChanges,false);
  assert.equal(await options.resolve(s.work,null,'server'),true);
  assert.equal(options.list().length,1);assert.equal(s.previous.list()[0].snapshot.clients[0].driverId,'other-draft');
});
test('local decision failure never reports durable success and exact evidence remains recoverable',async()=>{
  const s=setup({duplicate:false}),options=await s.options();s.setFlush(()=>false);
  await assert.rejects(options.resolve(s.work,null,'server'),/RECOVERY_LOCAL_CONFIRMATION_FAILED/);
  assert.equal(options.list().length,1);assert.equal(s.persisted.length,0);assert.equal(s.f.calls.writes.length,0);
  s.setFlush(()=>true);assert.equal(await options.resolve(s.work,null,'server'),true);
});
test('failed local confirmation after restore can retry after reopening without reapplying or losing the legacy copy',async()=>{
  const s=setup(),{f,work,key}=s;let applied=0;
  const restore=f.c.restoreConnectedPlanningSnapshot;f.c.restoreConnectedPlanningSnapshot=(...args)=>{if(!args[3].prepare)applied++;return restore(...args);};
  const options=await s.options();s.setFlush(()=>false);
  await assert.rejects(options.resolve(work,null,'restore'),/RECOVERY_LOCAL_CONFIRMATION_FAILED/);
  assert.equal(applied,1);assert.equal(f.state.hasUnsavedPlanChanges,true);assert.equal(f.cache.has(key+':recovery:previous'),true);
  assert.equal((await f.c.ROUTFLEX_PLANNING_SAVE.unresolvedWork(f.c.ROUTFLEX_PLANNING_SAVE.context())).length,1);
  const reopened=await s.options();assert.equal(reopened.list().length,1);s.setFlush(()=>true);
  assert.equal(await reopened.resolve(work,null,'restore'),true);assert.equal(applied,1);assert.equal(f.cache.has(key+':recovery:previous'),false);
});
test('keeping server refuses a newer remote base and a changed local record without overwriting either',async()=>{
  for(const change of[s=>{s.f.remote={...s.f.remote,revision:s.f.remote.revision+1};},s=>{s.f.c.ROUTFLEX_PLANNING_WORK.inspect=async()=>({...s.work,raw:'changed'});}]){
    const s=setup(),options=await s.options();change(s);
    await assert.rejects(options.resolve(s.work,null,'server'),/RECOVERY_(PREVIEW|CONTENT)_CHANGED/);
    assert.equal(s.previous.list().length,1);assert.equal(s.persisted.length,0);assert.equal(s.f.calls.writes.length,0);
  }
});
test('restore preserves configured Autosave and the existing manual confirmation guard, then normal ON/OFF scheduling resumes',async()=>{
  for(const enabled of[false,true]){
    const s=setup(),{f}=s;f.c.autosave=enabled;
    f.c.isPlanningAutosaveEnabled=id=>f.c.autosave&&!f.c.connectedRecoveryManualSave.has(id)&&!f.c.connectedRecoveryInspections.has(id);
    const options=await s.options();assert.equal(await options.resolve(s.work,null,'restore'),true);
    assert.equal(f.c.autosave,enabled);assert.equal(f.c.isPlanningAutosaveEnabled('A'),false);
    f.c.ROUTFLEX_PLANNING_SAVE.schedule();assert.equal([...f.timers.values()].filter(task=>task.ms===5000).length,0);
    const saved=f.c.ROUTFLEX_PLANNING_SAVE.save('manual');await tick();f.acknowledge();assert.equal(await saved,true);
    assert.equal(f.c.isPlanningAutosaveEnabled('A'),enabled);
    f.state.clients[0].driverId='next-edit';f.c.markPlanAsDirty();f.c.ROUTFLEX_PLANNING_SAVE.schedule();
    const autosaves=[...f.timers.values()].filter(task=>task.ms===5000);assert.equal(autosaves.length,enabled?1:0);
    if(enabled){autosaves[0].fn();await tick();assert.equal(f.calls.writes.length,2);f.acknowledge();await tick();}
  }
});
test('scope changes and communication failure during a no-review decision preserve all recoverable copies',async()=>{
  for(const change of[s=>{s.f.state.activePlanningSessionId='B';s.f.c._planningScopeActivationSeq++;},
    s=>{s.f.c.identity={...s.f.c.identity,userId:'different'};},s=>{s.f.c.identity={...s.f.c.identity,tenantId:'different'};},
    s=>{s.f.c.ROUTFLEX_PLANNING_AUTH.snapshotRead=async()=>{throw Error('communication failed');};}]){
    const s=setup(),options=await s.options();change(s);
    await assert.rejects(options.resolve(s.work,null,'server'));
    assert.equal(s.f.cache.has(s.key+':recovery:previous'),true);assert.equal(s.persisted.length,0);assert.equal(s.f.calls.writes.length,0);
  }
});
test('failed Save after restoration retains edits and safe explicit retry confirms exactly the same payload',async()=>{
  const s=setup(),{f}=s,options=await s.options();assert.equal(await options.resolve(s.work,null,'restore'),true);
  const first=f.c.ROUTFLEX_PLANNING_SAVE.save('manual');await tick();
  f.release().reject(Object.assign(Error('rejected'),{code:'SAVE_TEST_REJECTED',status:400}));assert.equal(await first,false);
  assert.equal(f.state.hasUnsavedPlanChanges,true);assert.equal(f.state.clients[0].driverId,'recovered');
  const retry=f.c.ROUTFLEX_PLANNING_SAVE.save('manual');await tick();assert.equal(f.calls.writes.length,2);
  assert.deepEqual(f.calls.writes[1].payload,f.calls.writes[0].payload);f.acknowledge();assert.equal(await retry,true);
});
test('late review of discarded A cannot replace the prepared catalog used to restore B',async()=>{
  const s=setup({duplicate:false}),{f,work}=s,other=copy(work);other.storageKey='other-work';other.documentId='other';
  other.domains.snapshot.applied.snapshot.clients[0].driverId='restore-B';other.raw=JSON.stringify(other);
  f.c.ROUTFLEX_PLANNING_WORK.list=async()=>({records:[work,other,...s.persisted],error:null});
  const catalogA=barrier(),snapshotB=barrier();let lookups=0,reads=0;
  f.c.loadConnectedScopedCustomers=async()=>++lookups===1?catalogA.run():{catalog:[{tag:'B'}]};
  f.c.ROUTFLEX_PLANNING_AUTH.snapshotRead=async()=>++reads===4?snapshotB.run():copy(f.remote);
  f.c.restoreConnectedPlanningSnapshot=(_meta,catalog,snapshot,options)=>{
    if(options.prepare)return {tag:catalog[0].tag};
    assert.equal(catalog[0].tag,'B');assert.equal(options.prepared.tag,'B');f.state.clients=copy(snapshot.clients);
  };
  const options=await s.options(),reviewA=options.inspect(work);
  await catalogA.started;
  assert.equal(await options.resolve(work,null,'server'),true);
  const restoreB=options.resolve(other,null,'restore');
  await snapshotB.started;
  catalogA.release({catalog:[{tag:'A'}]});await reviewA;snapshotB.release(copy(f.remote));assert.equal(await restoreB,true);
  assert.equal(f.state.clients[0].driverId,'restore-B');assert.equal(f.calls.writes.length,0);
});
test('confirmed Save reconciles earlier snapshots owned by this live runtime, preserving foreign or unapplied work',async()=>{
  const s=setup({duplicate:false}),{f,work}=s;
  work.domains.snapshot.applied.changeSeq=0;work.raw=JSON.stringify(work);
  const editor=copy(work);editor.storageKey='editor';editor.documentId='editor-doc';editor.domains.snapshot.editors=[{draft:{week:3}}];editor.raw=JSON.stringify(editor);
  f.c.ROUTFLEX_PLANNING_WORK.ownsDocument=record=>[work.documentId,editor.documentId].includes(record.documentId);
  f.c.ROUTFLEX_PLANNING_WORK.list=async()=>({records:[work,editor,...s.persisted],error:null});
  f.state.clients[0].driverId='final-generation';f.c.markPlanAsDirty();
  const saved=f.c.ROUTFLEX_PLANNING_SAVE.save('manual');await tick();f.acknowledge();assert.equal(await saved,true);
  assert.equal(f.remote.clients[0].driverId,'final-generation');
  const refs=f.c.ROUTFLEX_PLANNING_SAVE.resolved();assert.equal(refs.some(ref=>ref.storageKey===work.storageKey),true);
  assert.equal(refs.some(ref=>ref.storageKey===editor.storageKey),false);
  const next=fixture('saved');next.c.ROUTFLEX_PLANNING_WORK.list=async()=>({records:[work,editor,...s.persisted],error:null});
  const remaining=await next.c.ROUTFLEX_PLANNING_SAVE.unresolvedWork(next.c.ROUTFLEX_PLANNING_SAVE.context());
  assert.deepEqual(Array.from(remaining,row=>row.storageKey),['editor']);
});
