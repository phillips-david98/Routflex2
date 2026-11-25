'use strict';
// ATT09 phase 1 integration: actual local modules with synthetic storage/time/state.
// No browser, HTTP, business storage, services or user session is used.
const test = require('node:test');
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const Registry = require('../js/planning-work-registry.js');
const Session = require('../js/planning-work-session.js');
const Adapters = require('../js/planning-work-adapters.js');
const Runtime = require('../js/planning-work-runtime.js');
const version = 'v1:' + 'b'.repeat(64);
function fakeClock() {
  let time = 0, sequence = 0;
  const tasks = new Map();
  return {
    setTimeout(fn, delay) { const id = ++sequence; tasks.set(id, { at: time + delay, fn }); return id; },
    clearTimeout(id) { tasks.delete(id); },
    advance(delta = 0) {
      const target = time + delta;
      for (let iteration = 0; iteration < 1000; iteration++) {
        const next = [...tasks].filter(([, task]) => task.at <= target)
          .sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
        if (!next) { time = target; return; }
        tasks.delete(next[0]); time = next[1].at; next[1].fn();
      }
      throw new Error('Unexpected timer loop');
    },
    pending: () => tasks.size
  };
}
function fixture(count = 2) {
  const clock = fakeClock(), identity = { userId: 'operator', membershipId: 'member', tenantId: 'tenant' };
  const ticket = id => ({ scope: { tenantId: 'tenant', operationSessionId: 'operation', planningSessionId: id,
    sourceSessionId: null, userId: 'operator', membershipId: 'member' }, identity, activation: 1, capabilities: 'edit,export' });
  const states = new Map(), acceptedContexts = new Map(), values = new Map(), writes = [];
  const calls = { remote: 0, working: 0, clients: 0, recoveries: 0, business: 0, notify: 0 };
  const f = { clock, calls, states, acceptedContexts, values, writes, context: ticket('a'), failWrite: false, recoveryFailure: false };
  function addSession(id) {
    const owner = ticket(id);
    const clients = Array.from({ length: count }, (_, index) => ({
      customerKey: 'SRC|COMP|' + String(index).padStart(7, '0'), id: id + '-client-' + index,
      name: 'Synthetic client ' + index, week: 1, day: 'SEG', driverId: 'driver-1', sequence: index + 1,
      curveCode: 'Z', curveEntityVersion: version, curvePlanningRevision: 8, curveOverride: false, curveEnterpriseCode: 'Z'
    }));
    const remote = { version: 2, revision: 8, tenantId: 'tenant', operationSessionId: 'operation',
      session: { sessionId: id, planningProfile: 'VISITS', cycleLength: 4, currentWeek: 1 },
      savedAt: '2026-11-08T12:00:00.000Z', savedBy: 'operator', clients,
      drivers: [{ id: 'driver-1', name: 'Synthetic driver' }], routes: [], routingConstraints: { overnights: [] } };
    const envelopes = clients.map(client => ({ customerKey: client.customerKey, scope: { ...owner.scope },
      entityVersion: version, planningRevision: 8, planningInsightsRevision: 3,
      categoria: 'A', status: 'normal', moeda: 'BRL', faturamento: 1000,
      operador: 'Synthetic operator', mix_produto: 'Products', concorrente: '',
      overrideFields: ['categoria'], enterpriseValues: { categoria: 'B' }, observacoes: [], historico: [] }));
    const state = { clients, remote, working: structuredClone(remote), envelopes, revision: 8,
      persistence: { status: 'saved', changeSeq: 0, savedSeq: 0, hasUnsaved: false },
      curves: [], pdv: null, insEditor: null, recoveries: { snapshot: [], curves: [], ins: [] } };
    states.set(id, state); acceptedContexts.set(id, owner); return state;
  }
  addSession('a');
  const data = captured => states.get(captured.scope.planningSessionId);
  const storage = {
    keys: () => [...values.keys()], getItem: key => values.get(key) ?? null,
    setItem(key, raw) {
      if (f.failWrite) throw new Error('Synthetic quota failure');
      writes.push({ key, raw }); values.set(key, raw);
    },
    removeItem() { throw new Error('Registry must not remove any existing data'); }
  };
  const source = {
    context: () => f.context,
    acceptedContext: id => acceptedContexts.get(id) || null,
    persistence: captured => ({ ...data(captured).persistence }),
    revision: captured => data(captured).revision,
    remote: captured => { calls.remote++; return data(captured).remote; },
    working: captured => { calls.working++; return data(captured).working; },
    clients: captured => { calls.clients++; return data(captured).clients; },
    curves: captured => data(captured).curves,
    keyFor: client => client.customerKey, insKey: item => item.customerKey, insSaving: () => false,
    pdvEditor: captured => data(captured).pdv,
    insEditor: captured => data(captured).insEditor,
    recoveries(captured, domain) {
      calls.recoveries++;
      if (f.recoveryFailure && domain === 'ins') throw new Error('Synthetic recovery read failure');
      return data(captured).recoveries[domain];
    },
    businessWrite() { calls.business++; throw new Error('Business writes are forbidden'); }
  };
  f.source = source; f.storage = storage; f.addSession = addSession; f.ticket = ticket;
  f.work = Runtime.create({ Registry, Session, Adapters, source, storage, documentId: 'synthetic-tab',
    timers: { setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, delay: 20, maxDelay: 100 },
    notify: () => { calls.notify++; } });
  f.boot = () => { const state = data(f.context); f.work.acceptIns(f.context.scope.planningSessionId, state.clients, state.envelopes);
    f.work.signal('all'); clock.advance(); return f.work.view(); };
  return f;
}
test('boot captures all three confirmed domains and flushes only the new local namespace', () => {
  const f = fixture(), view = f.boot();
  assert.equal(view.domains.snapshot.confirmed.revision, 8);
  assert.equal(view.domains.curves.confirmed.items[0].curveCode, 'Z');
  assert.equal(view.domains.ins.confirmed.items[0].base.categoria, 'A');
  assert.equal(view.domains.snapshot.applied, null); assert.equal(view.domains.ins.applied, null);
  assert.deepEqual(view.domains.ins.editors, []);
  f.clock.advance(20);
  assert.equal(f.work.status().state, 'stored'); assert.equal(f.writes.length, 1);
  assert.ok(f.writes.every(write => write.key.startsWith('rfx:planning-work:v1:')));
  assert.equal(f.calls.business, 0);
});
test('all alone initializes snapshot and curves without an INS editor or incidental click', () => {
  const f = fixture(); f.work.signal('all'); f.clock.advance();
  const view = f.work.view();
  assert.equal(view.domains.snapshot.confirmed.revision, 8);
  assert.equal(view.domains.curves.confirmed.items.length, 2);
  assert.deepEqual(view.domains.snapshot.editors, []);
});
test('A/B/A keeps same-runtime applied work live without presenting its prior activation as recovery', () => {
  const f=fixture(),a=f.states.get('a');f.boot();
  a.persistence={status:'pending',changeSeq:1,savedSeq:0,hasUnsaved:true};a.working.clients[0].week=3;
  f.work.signal('snapshot');f.clock.advance();f.clock.advance(20);
  const original=f.work.list().records[0],raw=original.raw,key=original.storageKey;
  assert.equal(f.work.ownsDocument(original),true);
  f.addSession('b');f.context=f.ticket('b');f.work.signal('all');f.clock.advance();f.clock.advance(20);
  assert.equal(f.work.ownsDocument(original),false);
  f.context={...f.ticket('a'),activation:3};f.work.signal('all');f.clock.advance();
  const prior=f.work.list().records.find(record=>record.storageKey===key);
  assert.equal(prior.origin,'other-document');assert.equal(f.work.ownsDocument(prior),true);
  assert.equal(f.work.status().recoveryCount,0);assert.equal(f.work.view().domains.snapshot.applied.snapshot.clients[0].week,3);
  assert.equal(f.values.get(key),raw);assert.equal(f.calls.business,0);
});
test('runtime document ownership does not cross identity, scope, new runtime or invalid evidence', () => {
  const f=fixture();f.states.get('a').persistence={status:'pending',changeSeq:1,savedSeq:0,hasUnsaved:true};
  f.boot();f.clock.advance(20);const record=f.work.list().records[0],current=f.context;
  assert.equal(f.work.ownsDocument(record),true);
  for(const field of ['tenantId','operationSessionId','planningSessionId','sourceSessionId','userId','membershipId']){
    f.context={...current,scope:{...current.scope,[field]:'other'}};assert.equal(f.work.ownsDocument(record),false);
  }
  f.context={...current,identity:{...current.identity}};assert.equal(f.work.ownsDocument(record),false);
  f.context=null;assert.equal(f.work.ownsDocument(record),false);f.context=current;
  for(const patch of [{invalid:true},{future:true},{version:2},{scope:{...record.scope,userId:'other'}},{documentId:'other-tab'}])
    assert.equal(f.work.ownsDocument({...record,...patch}),false);
  const fresh=Runtime.create({Registry,Session,Adapters,source:f.source,storage:f.storage,documentId:'fresh-tab',
    timers:{setTimeout:f.clock.setTimeout,clearTimeout:f.clock.clearTimeout}});
  fresh.signal('all');f.clock.advance();
  assert.equal(fresh.ownsDocument(record),false);assert.equal(fresh.status().recoveryCount,1);assert.equal(f.calls.business,0);
});
test('historical recovery references alone do not offer an empty Work recovery after reload',()=>{
  const f=fixture(),state=f.states.get('a');state.recoveries.snapshot=[{storageKey:'legacy-evidence',raw:'preserved legacy bytes'}];
  f.boot();f.clock.advance(20);const old=f.work.list().records[0],raw=f.values.get(old.storageKey);
  assert.equal(old.domains.snapshot.applied,null);assert.equal(old.domains.snapshot.recoveries.length,1);
  const fresh=Runtime.create({Registry,Session,Adapters,source:f.source,storage:f.storage,documentId:'fresh-tab',
    timers:{setTimeout:f.clock.setTimeout,clearTimeout:f.clock.clearTimeout}});
  fresh.signal('all');f.clock.advance();assert.equal(fresh.status().recoveryCount,0);
  assert.equal(f.values.get(old.storageKey),raw);assert.equal(state.recoveries.snapshot.length,1);
});
test('working generation, confirmed revision and unapplied editors remain separated; typing does not rebuild snapshot', () => {
  const f = fixture(), state = f.states.get('a'); f.boot();
  state.persistence = { status: 'pending', changeSeq: 1, savedSeq: 0, hasUnsaved: true };
  state.working.clients[0].week = 3;
  state.pdv = { planning: { customerKey: state.clients[0].customerKey, clientId: 'a-client-0',
    original: { week: 1 }, draft: { week: 2 } }, curves: null };
  f.work.signal(['snapshot', 'editors']); f.clock.advance();
  const initial = f.work.view();
  assert.equal(initial.domains.snapshot.confirmed.snapshot.clients[0].week, 1);
  assert.equal(initial.domains.snapshot.applied.snapshot.clients[0].week, 3);
  assert.equal(initial.domains.snapshot.editors[0].draft.week, 2);
  assert.equal(initial.domains.snapshot.applied.baseRevision, 8);
  const builds = f.calls.working, remoteReads = f.calls.remote, clientReads = f.calls.clients;
  for (let index = 0; index < 12; index++) {
    state.insEditor = { customerKey: state.clients[0].customerKey, base: state.envelopes[0], dirty: true,
      draft: { fields: { categoria: 'C', faturamentoText: String(index) } }, pendingObservation: '' };
    f.work.signal(['editors', 'ins']); f.clock.advance();
  }
  assert.equal(f.calls.working, builds); assert.equal(f.calls.remote, remoteReads); assert.equal(f.calls.clients, clientReads);
  assert.equal(f.work.view().domains.ins.applied, null);
  state.revision = 9; state.remote = { ...state.remote, revision: 9 };
  state.persistence.changeSeq = 2; state.persistence.savedSeq = 1;
  f.work.signal('snapshot'); f.clock.advance();
  assert.equal(f.work.view().domains.snapshot.confirmed.revision, 9);
  assert.equal(f.work.view().domains.snapshot.applied.baseRevision, 8);
  assert.equal(f.calls.business, 0);
});
test('failed recovery read retries the complete collection without losing cached snapshot or INS bases', () => {
  const f = fixture(); f.recoveryFailure = true; f.boot();
  assert.ok(f.work.status().error); assert.equal(f.writes.length, 0);
  f.recoveryFailure = false; f.work.signal('all'); f.clock.advance();
  const view = f.work.view();
  assert.equal(view.domains.snapshot.confirmed.revision, 8);
  assert.equal(view.domains.curves.confirmed.items.length, 2);
  assert.equal(view.domains.ins.confirmed.items.length, 2);
  f.clock.advance(20); assert.equal(f.work.status().error, null);
  assert.equal(f.work.status().state, 'stored');
});
test('quota failure preserves memory and clears after explicit local retry', () => {
  const f = fixture(); f.failWrite = true; const original = f.boot(); f.clock.advance(20);
  assert.ok(f.work.status().error); assert.equal(f.work.status().pending, true);
  assert.deepEqual(f.work.view().domains, original.domains); assert.equal(f.writes.length, 0);
  f.failWrite = false; assert.equal(f.work.flushLocal(), true);
  assert.equal(f.work.status().error, null); assert.equal(f.work.status().pending, false);
  assert.equal(f.writes.length, 1); assert.equal(f.calls.business, 0);
});
test('storage and reader retries never rebase an existing working generation to a newer confirmed revision', () => {
  for (const failure of ['quota', 'recovery']) {
    const f = fixture(), state = f.states.get('a'); f.boot(); f.clock.advance(20);
    state.persistence = { status: 'pending', changeSeq: 1, savedSeq: 0, hasUnsaved: true };
    f.work.signal('snapshot'); f.clock.advance();
    state.revision = 9; state.remote = { ...state.remote, revision: 9 };
    state.persistence.changeSeq = 2; state.persistence.savedSeq = 1;
    f.work.signal('snapshot'); f.clock.advance();
    assert.equal(f.work.view().domains.snapshot.applied.baseRevision, 8);
    if (failure === 'quota') { f.failWrite = true; f.clock.advance(20); f.failWrite = false; }
    else {
      f.recoveryFailure = true; f.work.signal('ins'); f.clock.advance();
      f.recoveryFailure = false;
    }
    assert.ok(f.work.status().error);
    f.work.signal('all'); f.clock.advance();
    assert.equal(f.work.view().domains.snapshot.confirmed.revision, 9);
    assert.equal(f.work.view().domains.snapshot.applied.baseRevision, 8, failure + ' must preserve first working baseline');
    f.clock.advance(20); assert.equal(f.work.status().error, null);
  }
});
test('only a scoped accepted snapshot ACK advances the working base and preserves a later generation', () => {
  const f=fixture(),state=f.states.get('a');f.boot();
  state.persistence={status:'pending',changeSeq:1,savedSeq:0,hasUnsaved:true};state.working.clients[0].week=3;
  f.work.signal('snapshot');f.clock.advance();const sent=structuredClone(state.working);
  state.persistence.changeSeq=2;state.working=structuredClone(state.working);state.working.clients[1].week=4;
  f.work.signal('snapshot');f.clock.advance();const builds=f.calls.working;
  state.remote={...sent,revision:9};state.revision=9;state.persistence.savedSeq=1;
  // An accepted response can also update server-owned fields in live working
  // state without another user edit. The memo must not retain the old object.
  state.working=structuredClone(state.working);state.working.clients[0].serverAcceptedField='confirmed';
  assert.equal(f.work.acceptSnapshot('a',state.remote),true);f.clock.advance();
  const view=f.work.view();assert.equal(view.domains.snapshot.confirmed.revision,9);assert.equal(view.domains.snapshot.applied.baseRevision,9);
  assert.equal(view.domains.snapshot.applied.changeSeq,2);assert.equal(view.domains.snapshot.applied.snapshot.clients[1].week,4);
  assert.equal(view.domains.snapshot.applied.snapshot.clients[0].serverAcceptedField,'confirmed');assert.equal(f.calls.working,builds+1);assert.equal(f.calls.business,0);
});
test('snapshot ACK observer rejects stale sessions, revisions, authenticated context and foreign scope', () => {
  for(const change of [saved=>saved.tenantId='foreign',saved=>saved.operationSessionId='foreign',saved=>saved.session.sessionId='foreign',saved=>saved.revision=10]){
    const f=fixture(),state=f.states.get('a');f.boot();state.persistence={status:'pending',changeSeq:1,savedSeq:0,hasUnsaved:true};f.work.signal('snapshot');f.clock.advance();
    const saved=structuredClone(state.remote);saved.revision=9;state.revision=9;change(saved);
    assert.equal(f.work.acceptSnapshot('a',saved),false);f.work.signal('snapshot');f.clock.advance();assert.equal(f.work.view().domains.snapshot.applied.baseRevision,8);
  }
  const f=fixture(),state=f.states.get('a');f.boot();assert.equal(f.work.acceptSnapshot('other',state.remote),false);
  f.context={...f.context,activation:2};assert.equal(f.work.acceptSnapshot('a',state.remote),false);
  f.context=null;assert.equal(f.work.acceptSnapshot('a',state.remote),false);assert.equal(f.calls.business,0);
});
test('snapshot ACK observation failures are reported without throwing into the business ACK', () => {
  const f=fixture(),state=f.states.get('a');f.boot();const notify=f.calls.notify;
  f.source.revision=()=>{throw Error('Synthetic revision reader failure');};
  assert.doesNotThrow(()=>assert.equal(f.work.acceptSnapshot('a',state.remote),false));assert.ok(f.calls.notify>notify);assert.ok(f.work.status().error);
  f.source.context=()=>{throw Error('Synthetic owner reader failure');};
  assert.doesNotThrow(()=>assert.equal(f.work.acceptSnapshot('a',state.remote),false));assert.equal(f.calls.business,0);
});
test('unknown Save journal preserves captured payload separately from later applied edits and quota failure', () => {
  const f=fixture(),state=f.states.get('a');f.boot();f.clock.advance(20);const diskKey=f.writes.at(-1).key,diskBefore=f.values.get(diskKey);
  const sent=structuredClone(state.working);sent.clients[0].week=3;
  const journal={format:'planning-save',version:1,phase:'unknown',generation:1,confirmedRevision:8,
    steps:[{id:'snapshot',domain:'snapshot',status:'unknown'}],captured:{generation:1,baseSnapshot:structuredClone(state.remote),sentSnapshot:sent,ins:[],curves:[]}};
  f.source.saveJournal=()=>journal;state.persistence={status:'pending',changeSeq:2,savedSeq:0,hasUnsaved:true};state.working=structuredClone(sent);state.working.clients[0].week=4;
  f.failWrite=true;f.work.signal('snapshot');f.clock.advance();f.clock.advance(20);
  const memory=f.work.view();assert.equal(memory.domains.snapshot.applied.snapshot.clients[0].week,4);
  assert.equal(memory.domains.snapshot.applied.journal.captured.sentSnapshot.clients[0].week,3);
  assert.equal(memory.domains.snapshot.applied.journal.captured.baseSnapshot.clients[0].week,1);
  assert.ok(f.work.status().error);assert.equal(f.work.status().pending,true);assert.equal(f.values.get(diskKey),diskBefore);
  f.failWrite=false;assert.equal(f.work.flushLocal(),true);const stored=JSON.parse(f.values.get(diskKey));
  assert.equal(stored.domains.snapshot.applied.journal.phase,'unknown');assert.equal(stored.domains.snapshot.applied.snapshot.clients[0].week,4);assert.equal(f.calls.business,0);
});
test('removing a fully confirmed journal does not clear unrelated later applied edits', () => {
  const f=fixture(),state=f.states.get('a');f.boot();let journal={phase:'saving',generation:1,steps:[{id:'snapshot',status:'unknown'}],captured:{generation:1}};
  f.source.saveJournal=()=>journal;state.persistence={status:'pending',changeSeq:2,savedSeq:1,hasUnsaved:true};state.working.clients[1].week=4;
  f.work.signal('snapshot');f.clock.advance();assert.ok(f.work.view().domains.snapshot.applied.journal);
  journal=null;f.work.signal('snapshot');f.clock.advance();const pending=f.work.view().domains.snapshot.applied;
  assert.equal(Object.hasOwn(pending,'journal'),false);assert.equal(pending.changeSeq,2);assert.equal(pending.snapshot.clients[1].week,4);
  state.persistence={status:'saved',changeSeq:2,savedSeq:2,hasUnsaved:false};f.work.signal('snapshot');f.clock.advance();assert.equal(f.work.view().domains.snapshot.applied,null);
});
test('reviewed or currently owned work records leave the recovery count without deleting stored evidence', () => {
  const f=fixture(),state=f.states.get('a');f.boot();state.persistence={status:'pending',changeSeq:1,savedSeq:0,hasUnsaved:true};f.work.signal('snapshot');f.clock.advance();f.clock.advance(20);
  const own=f.writes.at(-1),record=JSON.parse(own.raw),key=own.key.slice(0,own.key.lastIndexOf(':')+1)+'older-tab';record.documentId='older-tab';const raw=JSON.stringify(record);f.values.set(key,raw);
  f.work.signal('recoveries');f.clock.advance();assert.equal(f.work.status().recoveryCount,1);
  f.source.excludeRecovery=row=>row.storageKey===key;f.work.signal('recoveries');f.clock.advance();assert.equal(f.work.status().recoveryCount,0);assert.equal(f.values.get(key),raw);
  f.source.excludeRecovery=()=>{throw Error('Synthetic review evidence failure');};f.work.signal('recoveries');f.clock.advance();assert.ok(f.work.status().error);assert.equal(f.values.get(key),raw);assert.equal(f.calls.business,0);
});
test('legacy INS evidence is refreshed in the same tab, preserved byte-for-byte and never adopted', () => {
  const f = fixture(), state = f.states.get('a'); f.boot();
  const raw = '{ "version": 1, "draft": { "categoria": "C" }, "arbitrary": "00" }';
  f.values.set('legacy:ins:other-document', raw);
  state.recoveries.ins = [{ storageKey: 'legacy:ins:other-document', raw, version: 1, baseVersion: version, basePlanningRevision: 8 }];
  f.work.signal('ins'); f.clock.advance();
  let view = f.work.view();
  assert.equal(view.domains.ins.recoveries[0].raw, raw);
  assert.equal(view.domains.ins.confirmed.items[0].base.categoria, 'A');
  assert.equal(view.domains.ins.applied, null); assert.deepEqual(view.domains.ins.editors, []);
  f.clock.advance(20); assert.equal(f.values.get('legacy:ins:other-document'), raw);
  state.recoveries.ins = []; f.work.signal('ins'); f.clock.advance();
  view = f.work.view(); assert.deepEqual(view.domains.ins.recoveries, []);
  assert.equal(f.values.get('legacy:ins:other-document'), raw);
});
test('accepted INS rejects a foreign scope and revocation never exposes previously accepted data', () => {
  const f = fixture(), state = f.states.get('a'); f.boot();
  f.work.acceptIns('a', state.clients, [{ ...state.envelopes[0], categoria: 'C', scope: { ...f.context.scope, tenantId: 'foreign' } }]);
  f.clock.advance(); assert.equal(f.work.view().domains.ins.confirmed.items[0].base.categoria, 'A');
  f.context = null; f.acceptedContexts.clear();
  assert.equal(f.work.acceptIns('a', state.clients, state.envelopes), false);
  f.work.signal('all'); f.clock.advance();
  assert.equal(f.work.view(), null); assert.equal(f.work.status().active, false);
  assert.equal(f.calls.business, 0);
});
test('preparing session INS cannot overwrite active bases and is accepted only for its exact context', () => {
  const f = fixture(), a = f.states.get('a'), b = f.addSession('b');
  b.envelopes.forEach(item => { item.categoria = 'C'; }); f.boot();
  f.work.acceptIns('b', b.clients, b.envelopes);
  f.work.signal('ins'); f.clock.advance();
  assert.equal(f.work.view().scope.planningSessionId, 'a');
  assert.equal(f.work.view().domains.ins.confirmed.items.length, a.clients.length);
  assert.equal(f.work.view().domains.ins.confirmed.items[0].base.categoria, 'A');
  f.context = f.acceptedContexts.get('b'); f.work.signal('all'); f.clock.advance();
  assert.equal(f.work.view().scope.planningSessionId, 'b');
  assert.equal(f.work.view().domains.ins.confirmed.items[0].base.categoria, 'C');
  // A new authenticated identity cannot reuse the previous object's accepted envelopes.
  f.context = { ...f.context, identity: { ...f.context.identity }, activation: 2 };
  f.work.signal('all'); f.clock.advance();
  assert.equal(f.work.view().domains.ins.confirmed, null);
});
test('delayed observations from the previous context are cancelled without writing into the new session', () => {
  const f = fixture(), a = f.states.get('a'); f.addSession('b'); f.boot(); f.clock.advance(20);
  const before = f.writes.length;
  a.pdv = { planning: { customerKey: a.clients[0].customerKey, original: { week: 1 }, draft: { week: 4 } }, curves: null };
  f.work.signal('editors');
  f.context = f.acceptedContexts.get('b'); f.work.signal('all'); f.clock.advance(); f.clock.advance(20);
  const current = f.work.view();
  assert.equal(current.scope.planningSessionId, 'b'); assert.deepEqual(current.domains.snapshot.editors, []);
  assert.ok(f.writes.slice(before).every(write => JSON.parse(write.raw).scope.planningSessionId === 'b'));
  assert.equal(f.calls.business, 0);
});
test('200/1000/2000 clients: complete collection and serialized local flush benchmark', t => {
  for (const count of [200, 1000, 2000]) {
    const samples = []; let bytes = 0;
    for (let iteration = 0; iteration < 5; iteration++) {
      const f = fixture(count), state = f.states.get('a');
      state.persistence = { status: 'pending', changeSeq: 1, savedSeq: 0, hasUnsaved: true };
      const start = performance.now(); f.boot(); f.clock.advance(20);
      samples.push(performance.now() - start);
      assert.equal(f.work.status().state, 'stored'); assert.equal(f.calls.business, 0);
      const saved = JSON.parse(f.writes.at(-1).raw);
      assert.equal(saved.domains.snapshot.applied.snapshot.clients.length, count);
      assert.equal(saved.domains.ins.confirmed.items.length, count);
      bytes = Buffer.byteLength(f.writes.at(-1).raw, 'utf8');
    }
    samples.sort((a, b) => a - b);
    t.diagnostic(JSON.stringify({ clients: count, iterations: samples.length,
      p95_ms: Number(samples.at(-1).toFixed(3)), utf8_bytes: bytes }));
  }
});
