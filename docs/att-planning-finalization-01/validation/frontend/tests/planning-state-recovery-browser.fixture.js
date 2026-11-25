/* Controlled browser fixture: production recovery/storage/save modules, synthetic transport. */
(async function bootRecoveryBrowserFixture() {
  globalThis.recoveryBrowserMetrics = {longtasks:[],beats:[],opens:[]};
  new PerformanceObserver(list=>recoveryBrowserMetrics.longtasks.push(...list.getEntries().map(entry=>({start:entry.startTime,duration:entry.duration})))).observe({type:'longtask',buffered:true});
  setInterval(()=>recoveryBrowserMetrics.beats.push(performance.now()),10);
  const copy = value => JSON.parse(JSON.stringify(value));
  const query = new URLSearchParams(location.search), scenario = query.get('scenario') || 'discard';
  const scope = {tenantId:'synthetic-tenant',operationSessionId:'synthetic-operation',planningSessionId:scenario,
    sourceSessionId:null,userId:'synthetic-user',membershipId:'synthetic-member'};
  const identity = {tenantId:scope.tenantId,userId:scope.userId,membershipId:scope.membershipId};
  const ticket = {scope,identity,activation:1,capabilities:'edit'};
  const meta = {id:scenario,ddd:null,tipo_sessao:'REAL',name:'Sessão controlada · 2.500 clientes'};
  const request = async options => {
    const response = await fetch('/api/snapshot?scenario='+encodeURIComponent(scenario),options);
    const value = await response.json(); if (!response.ok) throw Object.assign(Error(value.code),value); return value;
  };
  const remote = await request(), localStorageAdapter = {keys:()=>Object.keys(localStorage),getItem:key=>localStorage.getItem(key),
    setItem:(key,value)=>localStorage.setItem(key,value),removeItem:key=>localStorage.removeItem(key)};
  const key = 'rfx:scenario:buf:'+scenario+':operator:synthetic-user:synthetic-member';
  Object.assign(globalThis, {
    identity, state:{activePlanningSessionId:scenario,selectedDDD:null,hasUnsavedPlanChanges:false,clients:copy(remote.clients),drivers:copy(remote.drivers),
      planningPersistenceBySession:new Map(),planningAutosaveBySession:new Map([[scenario,query.get('autosave')==='on']]),dragClientId:null},
    planningSessionRegistry:new Map([[scenario,meta]]),planningSessionClients:new Map(),planningSessionDrivers:new Map(),connectedSnapshotReady:new Map(),
    connectedPlanningSaveQueues:new Map(),connectedRecoveryInspections:new Set(),connectedRecoveryManualSave:new Set(),
    planningLocalStorage:localStorageAdapter,connectedCustomerCatalogs:new Map(),_planningScopeActivationSeq:1,
    _integrationContextPending:false,_maintenanceBusy:false,_territoryShapesCacheKey:null,driverSequence:0,
    _insClientRef:null,_insEditContext:null,_insRecoveryRecords:[],_insHydrationSeq:0,_insReadSequence:0,_insCacheError:false,
    _insPendingSaveIdentityKeys:new Set(),_insRecoveryStore:{listSession:()=>[],list:()=>[]},
    _insHasUnsavedChanges:()=>false,_fetchClientInsightsBulk:async()=>[],_emptyClientInsight:()=>({}),
    isConnectedCustomerMode:()=>true,planningCan:()=>true,requirePlanningCapability:()=>true,
    hasPendingPdvEditDraft:()=>false,pendingAtomicMaintenance:()=>null,usesPlanningSessionBuffer:()=>true,
    connectedSnapshotScope:()=>scope,connectedCurveScope:()=>scope,connectedSnapshotKey:()=>key,
    connectedCurveDrafts:{pending:()=>[],ownsRecovery:()=>false,stageMany:()=>{throw Error('Unexpected curve mutation');}},
    updateState:value=>Object.assign(state,value),renderOperationalContext:()=>{},refreshDraftButtons:()=>{},
    updatePlannerHint:value=>{document.getElementById('hint').textContent=PlanningI18n.plain(value);},
    _rawSessionClients:()=>state.clients,buildClientCanonicalKey:client=>client.customerKey,
    normalizeCurveCode:value=>value,restorePlanningSessionViewContext:()=>{},applyFilters:()=>{},
    getRealSessionIdForDDD:()=>scenario,getPdvDraftBindingKey:()=>scenario,
    loadConnectedScopedCustomers:async()=>({catalog:copy(remote.clients)}),mergePlanningCurveAttributes:async()=>{},
    ROUTFLEX_PLANNING_AUTH:{getSnapshot:()=>({identity}),isReady:()=>true,can:()=>true,refreshCapabilities:async()=>{},snapshotRead:()=>request()},
    buildConnectedPlanningSnapshot:()=>({version:1,session:copy(remote.session),clients:state.clients.map(client=>({id:client.id,customerKey:client.customerKey,
      week:client.week,day:({SEG:'MON',TER:'TUE',QUA:'WED',QUI:'THU',SEX:'FRI',SAB:'SAT',DOM:'SUN'})[client.day]||client.day,
      driverId:client.driverId,sequence:client.sequence})),drivers:copy(remote.drivers),routes:[]})
  });
  globalThis.connectedPlanningSnapshots=PlanningSnapshotStore.create({storage:localStorageAdapter,onCacheError:error=>{throw error;},
    write:async(id,payload)=>request({method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)})});
  connectedPlanningSnapshots.load(scope,remote,key);
  Object.assign(getPlanningPersistenceEntry(scenario),{status:'saved',lastSavedAt:remote.savedAt,lastSavedBy:remote.savedBy,changeSeq:0,savedSeq:0});
  globalThis.ROUTFLEX_PLANNING_WORK=PlanningWorkRuntime.create({Registry:PlanningWorkRegistryV2,Session:PlanningWorkSession,Adapters:PlanningWorkAdapters,
    storage:localStorageAdapter,checkpointStore:PlanningWorkIndexedDB.create({dbName:'rfx-recovery-controlled-'+scenario}),
    documentId:'browser.'+crypto.randomUUID(),source:{context:()=>ticket,persistence:()=>({...getPlanningPersistenceEntry(scenario),hasUnsaved:state.hasUnsavedPlanChanges}),
      revision:()=>connectedPlanningSnapshots.revision(scope),remote:()=>connectedPlanningSnapshots.remote(scope),working:()=>buildConnectedPlanningSnapshot(meta),
      clients:()=>state.clients,curves:()=>[],pdvEditor:()=>null,insEditor:()=>null,recoveries:()=>[],keyFor:client=>client.customerKey,
      appliedVersion:()=>ROUTFLEX_PLANNING_SAVE?.appliedVersion()||0,insApplied:()=>null,insReviewed:()=>[],
      saveJournal:()=>globalThis.ROUTFLEX_PLANNING_SAVE?.workJournal()||null,resolvedWork:()=>globalThis.ROUTFLEX_PLANNING_SAVE?.resolved()||[]}});
  globalThis.ROUTFLEX_PLANNING_SAVE=installPlanningSaveFlow();
  PlanningI18n.setLanguage(query.get('lang')||'pt-BR',false);
  ROUTFLEX_PLANNING_WORK.signal('all'); await ROUTFLEX_PLANNING_WORK.flushLocal();
  const open = async (reviewDelay = 0) => {
    const started=performance.now();
    connectedRecoveryInspections.add(scenario);
    const options=await ROUTFLEX_PLANNING_SAVE.recoveryOptions(meta,{kind:'snapshot',label:meta.name,list:()=>[],inspect:()=>{throw Error('Unexpected legacy inspection');},
      resolve:()=>{throw Error('Unexpected legacy decision');},export:async()=>{},onClose:()=>connectedRecoveryInspections.delete(scenario)});
    if(reviewDelay){const inspect=options.inspect;options.inspect=async record=>{await new Promise(resolve=>setTimeout(resolve,reviewDelay));return inspect(record);};}
    const offered=performance.now(),dialog=PlanningLocalRecovery.show(document,options);
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    recoveryBrowserMetrics.opens.push({listAndOptionsMs:offered-started,showAndPaintMs:performance.now()-offered,totalMs:performance.now()-started});
    return dialog;
  };
  globalThis.controlled={scope,meta,remote,open,
    async unresolved(){return (await ROUTFLEX_PLANNING_SAVE.unresolvedWork(ticket)).length;},
    async edit(mass=true){
      for(const client of mass?state.clients:[state.clients[0]]){client.week=2;client.day='TER';client.driverId='driver-2';client.sequence=2501-client.sequence;}
      markPlanAsDirty();await ROUTFLEX_PLANNING_SAVE.checkpoint();ROUTFLEX_PLANNING_SAVE.schedule();
      return {count:state.clients.length,status:ROUTFLEX_PLANNING_WORK.status(),recoveries:await this.unresolved()};
    },
    async save(){const result=await ROUTFLEX_PLANNING_SAVE.save();await ROUTFLEX_PLANNING_WORK.flushLocal();return {result,
      journal:ROUTFLEX_PLANNING_SAVE.journal(),entry:{...getPlanningPersistenceEntry(scenario)},count:state.clients.length,recoveries:await this.unresolved()};},
    async status(){return {count:state.clients.length,revision:connectedPlanningSnapshots.revision(scope),first:copy(state.clients[0]),
      persistence:{...getPlanningPersistenceEntry(scenario)},recoveries:await this.unresolved(),work:ROUTFLEX_PLANNING_WORK.status(),autosave:isPlanningAutosaveEnabled(scenario)};}
  };
  if(await controlled.unresolved())await open();
  globalThis.ready=true;
})().catch(error=>{globalThis.bootError=error.stack||String(error);console.error(error);});
