import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const mapPath = path.resolve(import.meta.dirname, '..', 'map.html');
const html = fs.readFileSync(mapPath, 'utf8');

test('inline scripts in map.html remain syntactically valid', () => {
  const inlineScripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1])
    .filter((source) => source.trim());

  assert.ok(inlineScripts.length > 0);
  inlineScripts.forEach((source, index) => {
    assert.doesNotThrow(
      () => new vm.Script(source, { filename: `map-inline-${index}.js` }),
    );
  });
});

test('INS open/save uses the isolated backend contract', () => {
  assert.match(html, /_fetchClientInsight\(client, scope = captureInsightWriteScope\(\)\)/);
  assert.match(html, /\/planning\/customers\//);
  assert.match(html, /encodeURIComponent\(identity\.externalId\) \+ '\/ins'/);
  assert.match(html, /method:\s*'PATCH'/);
  assert.match(html, /const response = await _patchClientInsight\(client, draft, \{ \.\.\.ticket, base: context\?\.base \}\)/);
  assert.match(html, /const persisted = _insPayloadToState\(response\)/);
  assert.match(html, /faturamento:\s*revenueText === '' \? null/);

  const patchBody = html.slice(
    html.indexOf('async function _patchClientInsight'),
    html.indexOf('function hasClientInsightData'),
  );
  for (const planningField of ['driverId', 'day', 'seq', 'curva', 'territory', 'assignments']) {
    assert.doesNotMatch(patchBody, new RegExp(`\\b${planningField}\\b`));
  }
});

test('FIX-01 keeps Intelligence state derived from viewMode during restore and boot', () => {
  assert.match(html, /function syncInsightModeWithViewMode\(options = \{\}\)/);
  assert.match(html, /_setInsightModeActive\(state\.viewMode === 'analytics', options\)/);

  const restoreBody = html.slice(
    html.indexOf('function restorePlanningSessionViewContext'),
    html.indexOf('function renderPlanningSessionSelector'),
  );
  assert.match(restoreBody, /syncPlanningSessionViewContextUI\(\)/);

  const uiSyncBody = html.slice(
    html.indexOf('function syncPlanningSessionViewContextUI'),
    html.indexOf('function restorePlanningSessionViewContext'),
  );
  assert.match(uiSyncBody, /syncInsightModeWithViewMode\(\{ silent: true \}\)/);

  const switchBody = html.slice(
    html.indexOf('function switchViewMode'),
    html.indexOf('async function optimizeSelectedRoutes'),
  );
  assert.match(switchBody, /syncInsightModeWithViewMode\(\)/);
  assert.doesNotMatch(switchBody, /toggleInsightMode\(true\)/);

  const bootBody = html.slice(
    html.indexOf('async function initializeApp'),
    html.indexOf('const bootstrapApp'),
  );
  assert.match(bootBody, /applyFilters\(\{ skipFitBounds: false \}\)/);
  assert.match(bootBody, /waitForInitialPlanningRender\(\)/);
});

test('ATT08-B validates ownership before any confirmed GET/PATCH promotion', () => {
  const openBody = html.slice(html.indexOf('function openInsightPanel'), html.indexOf('function _renderInsHistList'));
  assert.ok(openBody.indexOf('if (!current()) return false') < openBody.indexOf('_applyInsightForClient(client, confirmed)'));
  const saveBody = html.slice(html.indexOf('async function saveCurrentInsight'), html.indexOf('function _insKeyFor'));
  assert.ok(saveBody.indexOf('if (!ticket.isCurrent()') < saveBody.indexOf('_applyInsightForClient(client, persisted)'));
  assert.match(openBody, /validateConnectedInsightEnvelope/);
  assert.match(saveBody, /validateConnectedInsightEnvelope/);
});

test('FIX-01 incremental INS refresh reuses the existing icon calculation', () => {
  const helperBody = html.slice(
    html.indexOf('function updateInsightMarkersForClient'),
    html.indexOf('function _hasInsightDraft'),
  );
  assert.match(helperBody, /updateMarkerIconsOnly\(_getClientIdsForInsightIdentity\(client\)\)/);
  assert.doesNotMatch(helperBody, /#[0-9a-f]{3,8}|createMarkerIcon|getClientMapColor/i);
  assert.match(html, /function updateMarkerIconsOnly\(clientIds = null, visualOptions = \{\}\)/);
});

test('P0 boot resolves confirmed INS from backend before the first render', () => {
  const bootBody = html.slice(
    html.indexOf('async function initializeApp'),
    html.indexOf('const bootstrapApp'),
  );
  assert.match(bootBody, /await _hydrateConfirmedClientInsightsFromBackend\(bootInsightClients, \{ scope: 'boot', sessionId: bindingBootMeta\.id \}\)/);
  assert.ok(
    bootBody.indexOf("await _hydrateConfirmedClientInsightsFromBackend(bootInsightClients, { scope: 'boot', sessionId: bindingBootMeta.id })")
      < bootBody.indexOf('applyFilters({ skipFitBounds: false })'),
  );
  assert.match(html, /\/planning\/customers\/ins\/bulk/);
});

test('P0 recovery cache uses canonical v3 and discards unsafe v1/v2 without migration', () => {
  assert.match(html, /var INS_STORAGE_KEY = 'ROUTflex:insights:v3'/);
  assert.match(html, /var INS_LEGACY_STORAGE_KEYS = \['ROUTflex:insights:v1', 'ROUTflex:insights:v2'\]/);

  const discardBody = html.slice(
    html.indexOf('function _discardLegacyClientInsightsCache'),
    html.indexOf('function _persistClientInsights'),
  );
  assert.match(discardBody, /planningLocalStorage\.removeItem\(legacyKey\)/);
  assert.doesNotMatch(discardBody, /state\.clientInsights|setItem/);

  const loadBody = html.slice(
    html.indexOf('function _loadClientInsights'),
    html.indexOf('function _insIdentity'),
  );
  assert.ok(
    loadBody.indexOf('_discardLegacyClientInsightsCache()')
      < loadBody.indexOf('planningLocalStorage.getItem(INS_STORAGE_KEY)'),
  );
});

test('ATT08-B rejected PATCH cannot promote a draft as confirmed INS', () => {
  const saveBody = html.slice(html.indexOf('async function saveCurrentInsight'), html.indexOf('function _insKeyFor'));
  const patch = saveBody.indexOf('await _patchClientInsight');
  const confirmed = saveBody.indexOf('_applyInsightForClient(client, persisted)');
  const rejected = saveBody.indexOf('} catch (error)');
  assert.ok(patch >= 0 && confirmed > patch && rejected > confirmed);
  assert.doesNotMatch(saveBody.slice(rejected), /_persistClientInsights\(\)/);
  assert.match(saveBody.slice(rejected), /context.ready = false/);
  assert.match(saveBody, /_insRecoveryStore.stage/);
});

test('P1 incremental and full render share the same marker visual decision', () => {
  assert.match(html, /function getClientMarkerVisual\(client, route, sequenceIndex, isSpecial, options = \{\}\)/);

  const incrementalBody = html.slice(
    html.indexOf('function updateMarkerIconsOnly'),
    html.indexOf('function renderMap'),
  );
  assert.match(incrementalBody, /getClientMarkerVisual\(client, route, index, Boolean\(m\._rfxIsSpecial\), visualOptions\)/);

  const renderBody = html.slice(
    html.indexOf('function renderMap'),
    html.indexOf('function getDistanceMeters'),
  );
  assert.match(renderBody, /getClientMarkerVisual\(client, route, index, false\)/);
  assert.match(renderBody, /getClientMarkerVisual\(client, null, 0, true\)/);
});

test('INS category draft has an explicit visual-preview path without changing confirmed color', () => {
  assert.match(html, /function updateInsightPreviewMarkersForClient\(client\)/);
  assert.match(html, /function _captureInsightDraftFromEditor\(client\)/);
  assert.match(html, /allowDraftPreview/);

  const categoryHandler = html.slice(
    html.indexOf("document.getElementById('ins-categoria').addEventListener"),
    html.indexOf("document.getElementById('ins-save-btn').addEventListener"),
  );
  assert.match(categoryHandler, /_captureInsightDraftFromEditor\(_insClientRef\)/);
  assert.match(categoryHandler, /updateInsightPreviewMarkersForClient\(_insClientRef\)/);

  const confirmedColorBody = html.slice(
    html.indexOf('function _getInsightCategoryColor(client)'),
    html.indexOf('function _getOrCreateInsight(client)'),
  );
  assert.doesNotMatch(confirmedColorBody, /clientInsightDrafts|_getInsightDraft/);
});

test('DDD activation hydrates before switching and supersedes stale requests', () => {
  const activationBody = html.slice(
    html.indexOf('async function activatePlanningSessionScope'),
    html.indexOf('async function handlePlanningSessionRowAction'),
  );
  assert.match(activationBody, /_insHydrationSeq \+= 1/);
  assert.match(activationBody, /await _hydrateConfirmedClientInsightsForDDD\(dddText, targetSessionId/);
  assert.match(activationBody, /if \(!activationIsCurrent\(\)\) return false/);
  assert.ok(
    activationBody.indexOf('await _hydrateConfirmedClientInsightsForDDD')
      < activationBody.indexOf('switchPlanningSession(targetSessionId'),
  );

  const hydrationBody = html.slice(
    html.indexOf('async function _hydrateConfirmedClientInsightsFromBackend'),
    html.indexOf('// Clientes cuja identidade'),
  );
  assert.match(hydrationBody, /var seq = \+\+_insHydrationSeq/);
  assert.match(hydrationBody, /seq !== _insHydrationSeq \|\| !isCurrent\(\)/);
});

test('INS panel discard removes the preview; rejected saves keep local recovery', () => {
  const closeBody = html.slice(html.indexOf('function closeInsightPanel'), html.indexOf('function _insHasUnsavedChanges'));
  assert.match(closeBody, /_clearInsightDraftForClient\(clientToDiscard\)/);
  assert.match(closeBody, /updateInsightMarkersForClient\(clientToDiscard\)/);
  assert.match(closeBody, /options.discard/);
  assert.match(closeBody, /_insRecoveryStore.discardWorking/);
});

test('ESC and programmatic INS exits route dirty panels through close confirmation', () => {
  const handlerStart = html.indexOf("document.addEventListener('keydown', (event) => {", html.indexOf('function endMapToolInteractions'));
  assert.ok(handlerStart >= 0, 'actual map tool keydown handler found');
  const handlerEnd = html.indexOf('\n});', handlerStart);
  assert.ok(handlerEnd > handlerStart, 'actual map tool keydown handler end found');
  const escapeBody = html.slice(handlerStart, handlerEnd + '\n});'.length);
  assert.match(escapeBody, /_isInsightPanelOpen\(\)/);
  assert.match(escapeBody, /requestCloseInsightPanel\(\)/);
  let keydown;
  let panelOpen = true;
  let interfaceOwnsEscape = false;
  const calls = [];
  vm.runInNewContext(escapeBody, {
    document: { addEventListener(type, handler) { assert.equal(type, 'keydown'); keydown = handler; } },
    mapToolEscapeOwnedByInterface: () => interfaceOwnsEscape,
    _isInsightPanelOpen: () => panelOpen,
    requestCloseInsightPanel: () => calls.push('confirm-close'),
    closeRulerModeMenu: () => false,
    endMapToolInteractions: () => { calls.push('end-tools'); return true; },
  });
  const escape = () => keydown({ key: 'Escape', preventDefault() { calls.push('prevent-default'); } });
  escape();
  assert.deepEqual(calls, ['prevent-default', 'confirm-close'], 'open INS panel requests confirmation without ending tools');
  calls.length = 0;
  interfaceOwnsEscape = true;
  escape();
  assert.deepEqual(calls, [], 'an owned Escape cannot close INS or end tools');
  interfaceOwnsEscape = false;
  panelOpen = false;
  escape();
  assert.deepEqual(calls, ['end-tools', 'prevent-default'], 'tools end only when no INS panel needs close confirmation');

  const modeBody = html.slice(
    html.indexOf('function switchViewMode'),
    html.indexOf('async function optimizeSelectedRoutes'),
  );
  assert.match(modeBody, /_insHasUnsavedChanges\(\)/);
  assert.match(modeBody, /requestCloseInsightPanel\(function\(\) \{ switchViewMode\(newMode\); \}\)/);

  const deactivateBody = html.slice(
    html.indexOf('function _setInsightModeActive'),
    html.indexOf('function syncInsightModeWithViewMode'),
  );
  assert.ok(
    deactivateBody.indexOf('requestCloseInsightPanel')
      < deactivateBody.indexOf('closeInsightPanel()'),
  );
});

test('INS serializes saves and prevents opening another editor mid-flight', () => {
  const saveBody = html.slice(html.indexOf('async function saveCurrentInsight'), html.indexOf('function _insKeyFor'));
  assert.match(saveBody, /if \(_insSaveFlight\) return _insSaveFlight/);
  assert.match(saveBody, /_insSaveFlight = task/);
  assert.match(saveBody, /if \(_insSaveFlight === task\) _insSaveFlight = null/);
  const openBody = html.slice(html.indexOf('function openInsightPanel'), html.indexOf('function _renderInsHistList'));
  assert.match(openBody, /if \(_insSaveFlight\)/);
});
