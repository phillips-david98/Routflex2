'use strict';
// Isolated stores only. Never opens a browser or user IndexedDB/localStorage.
const test = require('node:test'), assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const Registry = require('../js/planning-work-registry-v2.js');
const Legacy = require('../js/planning-work-registry.js');
const scope = { tenantId: 'test-tenant', operationSessionId: 'test-operation', planningSessionId: 'test-session',
  sourceSessionId: null, userId: 'test-operator', membershipId: 'test-membership' };
const clone = value => JSON.parse(JSON.stringify(value));
const hash = raw => createHash('sha256').update(raw).digest('hex');
const error = code => Object.assign(new Error(code), { code });
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function localStorage() {
  const values = new Map(), calls = { writes: 0, removes: 0 };
  return { values, calls, keys: () => [...values.keys()], getItem: key => values.get(key) ?? null,
    setItem(key, raw) { calls.writes++; values.set(key, raw); }, removeItem(key) { calls.removes++; values.delete(key); } };
}
function checkpointStore() {
  const values = new Map(), calls = [];
  const store = { values, calls, beforeWrite: null, readFailure: null,
    classify(envelope) {
      if (!envelope) return null;
      const value = clone(envelope), future = value.version > 2;
      const compatible = value.version === 2 && typeof value.raw === 'string' && value.sha256 === hash(value.raw);
      return { ...value, compatible, future, invalid: !future && !compatible,
        reason: future ? 'WORK_REGISTRY_FUTURE_FORMAT' : compatible ? 'WORK_REGISTRY_INSPECTION_ONLY' : 'WORK_REGISTRY_INTEGRITY_FAILED' };
    },
    async read(key, options = {}) {
      if (store.readFailure) throw error(store.readFailure);
      if (options.isCurrent && !options.isCurrent()) throw error('WORK_REGISTRY_CONTEXT_CHANGED');
      return store.classify(values.get(key));
    },
    async list(scopeKey, options = {}) {
      if (store.readFailure) throw error(store.readFailure);
      if (options.isCurrent && !options.isCurrent()) throw error('WORK_REGISTRY_CONTEXT_CHANGED');
      return [...values.values()].filter(value => value.scopeKey === scopeKey).map(store.classify);
    },
    async write(request) {
      calls.push({ ...request });
      if (store.beforeWrite) await store.beforeWrite(request);
      if (!request.isCurrent()) throw error('WORK_REGISTRY_CONTEXT_CHANGED');
      const prior = values.get(request.key);
      if (request.expected === null ? !!prior : !prior || prior.generation !== request.expected.generation || prior.sha256 !== request.expected.sha256)
        throw error('WORK_REGISTRY_DOCUMENT_CONFLICT');
      const envelope = { version: 2, logicalVersion: 1, key: request.key, scopeKey: request.scopeKey,
        documentId: request.documentId, generation: request.generation, raw: request.raw,
        sha256: hash(request.raw), bytes: Buffer.byteLength(request.raw) };
      values.set(request.key, envelope);
      return store.classify(envelope);
    } };
  return store;
}
function fixture({ storage = localStorage(), engine = checkpointStore(), documentId = 'test-tab', context } = {}) {
  let current = context || { scope: { ...scope }, identity: {}, activation: 1, capabilities: 'test-edit' };
  const registry = Registry.create({ storage, checkpointStore: engine, documentId, readContext: () => current,
    now: () => Date.parse('2026-11-08T12:00:00Z') });
  return { registry, storage, engine, ticket: () => registry.capture(), context: () => current,
    change: next => { current = next; }, advance: patch => { current = { ...current, ...patch }; } };
}
function observe(f, payload = { test: 1 }) { const ticket = f.ticket(); f.registry.observe(ticket, 'snapshot', 'applied', payload); return ticket; }

test('fresh runtime hides only the exact durably resolved checkpoint; changed bytes restore the recovery diagnostic',async()=>{
  const Runtime=require('../js/planning-work-runtime.js'),Session=require('../js/planning-work-session.js'),Adapters=require('../js/planning-work-adapters.js');
  const old=fixture({documentId:'prior-tab'});await old.registry.flush(observe(old,{test:'unsaved'}));
  const prior=(await old.registry.list(old.ticket()))[0];
  const decision=fixture({documentId:'decision-tab',storage:old.storage,engine:old.engine,context:old.context()});
  decision.registry.observe(decision.ticket(),'snapshot','confirmed',{resolvedWork:[{storageKey:prior.storageKey,sha256:prior.integrity.sha256}]});
  await decision.registry.flush(decision.ticket());
  const source={context:old.context,persistence:()=>({status:'saved',changeSeq:0,savedSeq:0}),revision:()=>1,remote:()=>null,
    working:()=>null,clients:()=>[],curves:()=>[],pdvEditor:()=>null,insEditor:()=>null,recoveries:()=>[],keyFor:value=>value.customerKey};
  const runtime=Runtime.create({Registry,Session,Adapters,source,storage:old.storage,checkpointStore:old.engine,documentId:'fresh-runtime'});
  runtime.signal('all');await runtime.flushLocal();await runtime.list();runtime.signal('recoveries');await runtime.flushLocal();
  assert.equal(runtime.status().recoveryCount,0);
  const stored=old.engine.values.get(prior.storageKey),logical=JSON.parse(stored.raw);logical.domains.snapshot.applied.test='new unsaved bytes';
  stored.raw=JSON.stringify(logical);stored.sha256=hash(stored.raw);stored.bytes=Buffer.byteLength(stored.raw);
  await new Promise(setImmediate);
  await runtime.list();runtime.signal('recoveries');await runtime.flushLocal();
  await runtime.list();await runtime.flushLocal();
  assert.equal(runtime.status().recoveryCount,1);
});

test('durable resolution verifies legacy raw bytes instead of trusting a storage key',async()=>{
  const f=fixture(),legacy=Legacy.create({storage:f.storage,documentId:'legacy-tab',readContext:f.context});
  const ticket=legacy.capture();legacy.observe(ticket,'snapshot','applied',{test:'preserved'});legacy.flush(ticket);
  const record=legacy.list(ticket)[0],expected=hash(record.raw);
  f.registry.observe(f.ticket(),'snapshot','confirmed',{resolvedWork:[{storageKey:record.storageKey,sha256:expected}]});await f.registry.flush(f.ticket());
  assert.equal((await f.registry.list(f.ticket())).find(item=>item.storageKey===record.storageKey).integrity.sha256,expected);
  const changed=JSON.parse(record.raw);changed.domains.snapshot.applied.test='changed';f.storage.values.set(record.storageKey,JSON.stringify(changed));
  assert.notEqual((await f.registry.list(f.ticket())).find(item=>item.storageKey===record.storageKey).integrity.sha256,expected);
});

test('complete logical channels remain distinct and no new full checkpoint is written to localStorage', async () => {
  const f = fixture(), ticket = f.ticket();
  for (const domain of ['snapshot', 'curves', 'ins']) for (const channel of ['confirmed', 'applied', 'editors', 'recoveries'])
    f.registry.observe(ticket, domain, channel, { domain, channel, base: { revision: 4 }, intention: ['preserve'], inheritance: 'enterprise' });
  assert.equal(f.registry.asynchronous, true);
  const before = f.registry.view(ticket);
  assert.equal(before.version, 1); assert.equal(before.generation, 12);
  assert.equal(f.registry.status(ticket).localConfirmed, false);
  assert.equal(await f.registry.flush(ticket), true);
  const status = f.registry.status(ticket);
  assert.equal(status.state, 'stored'); assert.equal(status.localConfirmed, true); assert.equal(status.storageVersion, 2);
  assert.equal(status.persistedGeneration, 12); assert.match(status.storageKey, /^rfx:planning-work:v2:/);
  assert.deepEqual(JSON.parse(f.engine.values.get(status.storageKey).raw), before);
  assert.equal(f.storage.calls.writes, 0); assert.equal(f.storage.calls.removes, 0); assert.equal(f.storage.values.size, 0);
  await f.registry.flush(ticket); assert.equal(f.engine.calls.length, 1, 'unchanged generations do not write again');
});

test('a local transaction is not acknowledged until its verified promise completes', async () => {
  const f = fixture(), ticket = observe(f), gate = deferred(); f.engine.beforeWrite = () => gate.promise;
  const pending = f.registry.flush(ticket);
  assert.equal(f.registry.status(ticket).state, 'writing'); assert.equal(f.registry.status(ticket).persistedGeneration, null);
  assert.equal(f.registry.status(ticket).localConfirmed, false); assert.equal(f.engine.values.size, 0);
  gate.resolve(); assert.equal(await pending, true); assert.equal(f.registry.status(ticket).localConfirmed, true);
});

test('edits during an asynchronous write remain pending and retain the separate sent generation', async () => {
  const f = fixture(), ticket = observe(f, { working: 1, journal: { sentGeneration: { value: 'sent' } } }), gate = deferred();
  f.engine.beforeWrite = () => gate.promise;
  const pending = f.registry.flush(ticket);
  f.registry.observe(ticket, 'snapshot', 'applied', { working: 2, journal: { sentGeneration: { value: 'sent' } } });
  f.registry.observe(ticket, 'ins', 'editors', { categoria: 'A', unsent: true });
  gate.resolve(); assert.equal(await pending, true);
  const status = f.registry.status(ticket);
  assert.equal(status.persistedGeneration, 1); assert.equal(status.generation, 3); assert.equal(status.pending, true);
  assert.equal(status.state, 'pending'); assert.equal(status.localConfirmed, false);
  assert.equal(JSON.parse([...f.engine.values.values()][0].raw).domains.snapshot.applied.working, 1);
  assert.equal(f.registry.view(ticket).domains.snapshot.applied.working, 2);
  assert.equal(f.registry.view(ticket).domains.snapshot.applied.journal.sentGeneration.value, 'sent');
  assert.equal(f.registry.view(ticket).domains.ins.editors.unsent, true);
});

test('distinct flushed generations are serialized without out-of-order overwrite', async () => {
  const f = fixture(), ticket = observe(f, { value: 1 }), gate = deferred(); let active = 0, maximum = 0;
  f.engine.beforeWrite = async request => { active++; maximum = Math.max(maximum, active); if (request.generation === 1) await gate.promise; active--; };
  const first = f.registry.flush(ticket);
  f.registry.observe(ticket, 'snapshot', 'applied', { value: 2 }); const second = f.registry.flush(ticket);
  f.registry.observe(ticket, 'snapshot', 'applied', { value: 3 }); const third = f.registry.flush(ticket);
  assert.equal(f.engine.calls.length, 1); gate.resolve();
  assert.deepEqual(await Promise.all([first, second, third]), [true, true, true]);
  assert.deepEqual(f.engine.calls.map(call => call.generation), [1, 2, 3]); assert.equal(maximum, 1);
  assert.equal(f.engine.calls[1].expected.generation, 1); assert.equal(f.registry.status(ticket).persistedGeneration, 3);
  assert.equal(f.engine.calls[2].expected.generation, 2);
  assert.equal(JSON.parse([...f.engine.values.values()][0].raw).domains.snapshot.applied.value, 3);
});

test('an explicitly flushed sent journal is preserved before a later confirmation removes it', async () => {
  const f = fixture(), ticket = observe(f, { working: 1 }), gate = deferred();
  f.engine.beforeWrite = request => request.generation === 1 ? gate.promise : undefined;
  const first = f.registry.flush(ticket);
  const sent = { phase: 'saving', captured: { generation: 11, snapshot: { clients: ['fictional'] }, ins: [], curves: [] } };
  f.registry.observe(ticket, 'snapshot', 'applied', { working: 1, journal: sent }); const sending = f.registry.flush(ticket);
  f.registry.observe(ticket, 'snapshot', 'applied', null); const confirmed = f.registry.flush(ticket);
  gate.resolve(); assert.deepEqual(await Promise.all([first, sending, confirmed]), [true, true, true]);
  assert.deepEqual(f.engine.calls.map(call => call.generation), [1, 2, 3]);
  assert.deepEqual(JSON.parse(f.engine.calls[1].raw).domains.snapshot.applied.journal, sent);
  assert.equal(JSON.parse(f.engine.calls[2].raw).domains.snapshot.applied, null);
});

test('repeated flushes of the same in-flight generation share the transaction', async () => {
  const f = fixture(), ticket = observe(f), gate = deferred(); f.engine.beforeWrite = () => gate.promise;
  const a = f.registry.flush(ticket), b = f.registry.flush(ticket); gate.resolve();
  assert.deepEqual(await Promise.all([a, b]), [true, true]); assert.equal(f.engine.calls.length, 1);
});

for (const code of ['WORK_REGISTRY_QUOTA_EXCEEDED', 'WORK_REGISTRY_TRANSACTION_ABORTED', 'WORK_REGISTRY_STORAGE_UNAVAILABLE'])
  test(code + ' preserves the prior checkpoint and newer memory; queued generations are not replayed', async () => {
    const f = fixture(), ticket = observe(f); await f.registry.flush(ticket);
    const valid = clone([...f.engine.values.values()][0]);
    f.registry.observe(ticket, 'snapshot', 'applied', { value: 2 });
    const gate = deferred(); f.engine.beforeWrite = async () => { await gate.promise; throw error(code); };
    const failed = f.registry.flush(ticket);
    f.registry.observe(ticket, 'ins', 'editors', { value: 3 }); const queued = f.registry.flush(ticket);
    gate.resolve(); assert.deepEqual(await Promise.all([failed, queued]), [false, false]);
    assert.equal(f.engine.calls.length, 2); assert.deepEqual([...f.engine.values.values()][0], valid);
    assert.equal(f.registry.status(ticket).state, 'error'); assert.equal(f.registry.status(ticket).error.code, code);
    assert.equal(f.registry.status(ticket).persistedGeneration, 1); assert.equal(f.registry.status(ticket).pending, true);
    assert.equal(f.registry.view(ticket).domains.ins.editors.value, 3);
    f.engine.beforeWrite = null; assert.equal(await f.registry.flush(ticket), true);
    assert.equal(f.registry.status(ticket).localConfirmed, true);
  });

test('an unverified adapter response never reports a local checkpoint as confirmed', async () => {
  const f = fixture(), ticket = observe(f); f.engine.write = async () => ({ compatible: true, generation: 1, raw: 'wrong' });
  assert.equal(await f.registry.flush(ticket), false);
  assert.equal(f.registry.status(ticket).error.code, 'WORK_REGISTRY_WRITE_UNVERIFIED');
  assert.equal(f.registry.status(ticket).persistedGeneration, null); assert.equal(f.registry.status(ticket).pending, true);
});

test('v1 records remain byte-identical and inspectable without adoption or copying to v2', async () => {
  const f = fixture(), legacy = Legacy.create({ storage: f.storage, documentId: 'previous-tab', readContext: f.context });
  const oldTicket = legacy.capture(); legacy.observe(oldTicket, 'curves', 'applied', { code: 'Z' }); legacy.flush(oldTicket);
  const before = [...f.storage.values.entries()], writes = f.storage.calls.writes;
  const ticket = observe(f, { value: 2 });
  const priorList = await f.registry.list(ticket); assert.equal(priorList.length, 1); assert.equal(priorList[0].namespaceVersion, 1);
  assert.equal((await f.registry.inspect(ticket, priorList[0])).domains.curves.applied.code, 'Z');
  assert.equal(f.engine.values.size, 0, 'reading legacy evidence never migrates it');
  await f.registry.flush(ticket);
  const combined = await f.registry.list(ticket); assert.equal(combined.length, 2);
  const current = combined.find(record => record.namespaceVersion === 2);
  assert.equal(current.compatible, true); assert.equal(current.version, 1); assert.equal(current.envelopeVersion, 2);
  assert.equal((await f.registry.inspect(ticket, current)).domains.snapshot.applied.value, 2);
  assert.deepEqual([...f.storage.values.entries()], before); assert.equal(f.storage.calls.writes, writes); assert.equal(f.storage.calls.removes, 0);
});

test('corrupt payloads and future envelopes/logical formats remain raw read-only, nonrecoverable evidence', async () => {
  const f = fixture(), ticket = observe(f); await f.registry.flush(ticket);
  const original = clone([...f.engine.values.values()][0]);
  for (const [name, mutate] of [
    ['corrupt', value => { value.raw = '{broken'; }],
    ['future-envelope', value => { value.version = 3; }],
    ['future-logical', value => { const raw = JSON.parse(value.raw); raw.version = 9; value.raw = JSON.stringify(raw); value.sha256 = hash(value.raw); }],
    ['invalid-logical', value => { const raw = JSON.parse(value.raw); raw.domains.ins.version = 99; value.raw = JSON.stringify(raw); value.sha256 = hash(value.raw); }],
  ]) {
    const item = clone(original); item.documentId = name; item.key = original.key.replace(/test-tab$/, name);
    const raw = JSON.parse(item.raw); raw.documentId = name; item.raw = JSON.stringify(raw); item.sha256 = hash(item.raw);
    mutate(item); f.engine.values.set(item.key, item);
  }
  const records = await f.registry.list(ticket);
  for (const record of records.filter(item => item.documentId !== 'test-tab')) {
    assert.equal(record.readOnly, true); assert.equal(record.compatible, false); assert(record.invalid || record.future);
    assert.deepEqual(record.scope, scope); assert.equal(record.storageScopeVerified, true);
    const inspected = await f.registry.inspect(ticket, record); assert.equal(inspected.raw, record.raw); assert.equal(inspected.compatible, false);
  }
  assert.equal(f.engine.values.size, 5); assert.equal(f.storage.calls.writes, 0);
});

test('inspection rejects evidence changed after listing', async () => {
  const f = fixture(), ticket = observe(f); await f.registry.flush(ticket);
  const [record] = await f.registry.list(ticket); f.engine.values.get(record.storageKey).raw += ' ';
  await assert.rejects(f.registry.inspect(ticket, record), /CONTENT_CHANGED/);
});

for (const condition of ['corrupt', 'future', 'missing', 'changed']) test('catalog detects ' + condition + ' acknowledged checkpoint without claiming local confirmation', async () => {
  const f = fixture(), ticket = observe(f); await f.registry.flush(ticket);
  const key = f.registry.status(ticket).storageKey, item = f.engine.values.get(key);
  if (condition === 'corrupt') item.raw += ' ';
  else if (condition === 'future') item.version = 3;
  else if (condition === 'missing') f.engine.values.delete(key);
  else item.generation++;
  const records = await f.registry.list(ticket);
  assert.equal(records.readErrors.length, 1); assert.equal(f.registry.status(ticket).localConfirmed, false);
  assert.equal(f.registry.status(ticket).available, false); assert.equal(f.registry.status(ticket).state, 'error');
  assert.equal(f.registry.status(ticket).persistedGeneration, 1, 'previous acknowledgment metadata remains available');
  assert.equal(f.registry.view(ticket).domains.snapshot.applied.test, 1);
  if (condition !== 'missing') assert.equal(records.length, 1, 'corrupt or future evidence remains inspectable');
});

test('a catalog captured before a newer write acknowledgment cannot falsely invalidate the newer checkpoint', async () => {
  const f = fixture(), ticket = observe(f); await f.registry.flush(ticket);
  const read = f.engine.list, gate = deferred();
  f.engine.list = async (...args) => { const previous = await read(...args); await gate.promise; return previous; };
  const catalog = f.registry.list(ticket);
  f.registry.observe(ticket, 'snapshot', 'applied', { value: 'newer' }); assert.equal(await f.registry.flush(ticket), true);
  gate.resolve(); const records = await catalog;
  assert.equal(records.readErrors.length, 0); assert.equal(f.registry.status(ticket).localConfirmed, true);
  assert.equal(f.registry.status(ticket).persistedGeneration, 2);
});

test('one unavailable reader leaves the other source inspectable and an explicit diagnostic', async () => {
  const f = fixture(), ticket = observe(f); await f.registry.flush(ticket);
  f.storage.keys = () => { throw new Error('legacy read denied'); };
  const records = await f.registry.list(ticket);
  assert.equal(records.length, 1); assert.equal(records[0].namespaceVersion, 2);
  assert.equal(records.readErrors.length, 1); assert.equal(f.registry.status(ticket).available, false);
  f.storage.keys = () => []; f.engine.readFailure = 'WORK_REGISTRY_STORAGE_UNAVAILABLE';
  const next = await f.registry.list(ticket); assert.equal(next.readErrors[0].code, 'WORK_REGISTRY_STORAGE_UNAVAILABLE');
  assert.equal(f.registry.view(ticket).domains.snapshot.applied.test, 1);
});

test('inspecting one backend cannot erase a catalog failure from the other backend', async () => {
  const f = fixture(), legacy = Legacy.create({ storage: f.storage, documentId: 'old-tab', readContext: f.context });
  const old = legacy.capture(); legacy.observe(old, 'ins', 'editors', { categoria: 'A' }); legacy.flush(old);
  const ticket = observe(f); await f.registry.flush(ticket);
  f.engine.readFailure = 'WORK_REGISTRY_STORAGE_UNAVAILABLE';
  const legacyRecords = await f.registry.list(ticket);
  assert.equal((await f.registry.inspect(ticket, legacyRecords[0])).compatible, true);
  assert.equal(f.registry.status(ticket).error.code, 'WORK_REGISTRY_STORAGE_UNAVAILABLE');
  f.engine.readFailure = null; f.storage.keys = () => { throw new Error('read denied'); };
  const modernRecords = await f.registry.list(ticket);
  assert.equal((await f.registry.inspect(ticket, modernRecords[0])).compatible, true);
  assert.equal(f.registry.status(ticket).error.code, 'WORK_REGISTRY_STORAGE_READ_FAILED');
  f.storage.keys = () => [...f.storage.values.keys()]; await f.registry.list(ticket);
  assert.equal(f.registry.status(ticket).error, null);
});

test('real IndexedDB engine contract completes and verifies before registry acknowledgment in isolated fixture', async () => {
  const { createIndexedDBFixture } = require('./fixtures/planning-work-idb-fixture.cjs');
  const { webcrypto } = require('node:crypto');
  const Engine = require('../js/planning-work-indexeddb.js'), indexed = createIndexedDBFixture();
  const engine = Engine.create({ indexedDB: indexed.indexedDB, crypto: webcrypto });
  const f = fixture({ engine }), ticket = observe(f, { value: 'first' });
  assert.equal(await f.registry.flush(ticket), true); assert.equal(indexed.stats.commits, 1);
  f.registry.observe(ticket, 'ins', 'applied', { items: [{ categoria: 'A', curve: 'Z', expectedVersion: 'synthetic' }] });
  assert.equal(await f.registry.flush(ticket), true); assert.equal(indexed.stats.commits, 2);
  const records = await f.registry.list(ticket); assert.equal(records.length, 1); assert.equal(records[0].compatible, true);
  const inspected = await f.registry.inspect(ticket, records[0]);
  assert.equal(inspected.domains.ins.applied.items[0].categoria, 'A'); assert.equal(inspected.domains.ins.applied.items[0].curve, 'Z');
  assert.equal(f.registry.status(ticket).persistedGeneration, 2); assert.equal(f.storage.calls.writes, 0);
});

test('two tabs use distinct keys; a reused document id cannot overwrite existing checkpoint evidence', async () => {
  const engine = checkpointStore(), storage = localStorage(), a = fixture({ engine, storage, documentId: 'tab-a' }), b = fixture({ engine, storage, documentId: 'tab-b' });
  const ta = observe(a, { value: 'a' }), tb = observe(b, { value: 'b' });
  await Promise.all([a.registry.flush(ta), b.registry.flush(tb)]); assert.equal(engine.values.size, 2);
  assert.equal((await a.registry.list(ta)).length, 2);
  const collision = fixture({ engine, storage, documentId: 'tab-a' }), tc = observe(collision, { value: 'collision' });
  assert.equal(await collision.registry.flush(tc), false);
  assert.equal(collision.registry.status(tc).error.code, 'WORK_REGISTRY_DOCUMENT_CONFLICT');
  assert.equal(JSON.parse([...engine.values.values()].find(item => item.documentId === 'tab-a').raw).domains.snapshot.applied.value, 'a');
});

for (const field of Object.keys(scope)) test('asynchronous records are isolated by ' + field, async () => {
  const f = fixture(), ticket = observe(f); await f.registry.flush(ticket);
  f.advance({ scope: { ...scope, [field]: 'different' }, activation: 2 });
  const next = f.ticket(); assert.equal((await f.registry.list(next)).length, 0);
  assert.equal(f.registry.view(next).generation, 0); assert.equal(f.registry.isCurrent(ticket), false);
  assert.throws(() => f.registry.flush(ticket), /CONTEXT_CHANGED/);
});

for (const change of ['session', 'identity', 'activation', 'capabilities', 'unavailable'])
  test('loss of ' + change + ' rejects a late completion without publishing into the new context', async () => {
    const f = fixture(), ticket = observe(f), gate = deferred(); f.engine.beforeWrite = () => gate.promise;
    const pending = f.registry.flush(ticket);
    if (change === 'session') f.advance({ scope: { ...scope, planningSessionId: 'other-session' } });
    else if (change === 'identity') f.advance({ identity: {} });
    else if (change === 'activation') f.advance({ activation: 3 });
    else if (change === 'capabilities') f.advance({ capabilities: 'none' });
    else f.change(null);
    const assertion = assert.rejects(pending, /CONTEXT_CHANGED/); gate.resolve(); await assertion;
    assert.equal(f.engine.values.size, 0); assert.equal(f.registry.isCurrent(ticket), false);
    if (change === 'session') assert.equal(f.registry.status(f.ticket()).state, 'empty');
  });

test('a late catalog read cannot disclose records after context changes', async () => {
  const f = fixture(), ticket = observe(f); await f.registry.flush(ticket);
  const list = f.engine.list, gate = deferred(); f.engine.list = async (...args) => { const result = await list(...args); await gate.promise; return result; };
  const pending = f.registry.list(ticket); f.advance({ scope: { ...scope, planningSessionId: 'other-session' } });
  const assertion = assert.rejects(pending, /CONTEXT_CHANGED/); gate.resolve(); await assertion;
});

for (const count of [200, 1000, 2000]) test('full checkpoint round trip with ' + count + ' fictitious clients preserves every channel', async () => {
  const f = fixture(), ticket = f.ticket();
  const clients = Array.from({ length: count }, (_, index) => ({ id: 'test-' + index, externalId: String(index).padStart(6, '0'),
    categoria: ['A', 'B', 'C'][index % 3], curve: 'Z', revision: index + 1, inheritance: { source: 'enterprise', revision: 5 } }));
  for (const domain of ['snapshot', 'curves', 'ins']) for (const channel of ['confirmed', 'applied', 'editors', 'recoveries'])
    f.registry.observe(ticket, domain, channel, { clients, intention: 'preserve', sentGeneration: { clients, generation: 7 } });
  const expected = f.registry.view(ticket); assert.equal(await f.registry.flush(ticket), true);
  const [record] = await f.registry.list(ticket), inspected = await f.registry.inspect(ticket, record);
  for (const domain of ['snapshot', 'curves', 'ins']) for (const channel of ['confirmed', 'applied', 'editors', 'recoveries'])
    assert.deepEqual(inspected.domains[domain][channel], expected.domains[domain][channel]);
  assert.equal(f.storage.calls.writes, 0); assert.equal(f.registry.status(ticket).localConfirmed, true);
});
