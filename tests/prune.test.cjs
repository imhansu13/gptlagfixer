const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { storage, runFile } = require('./helpers.cjs');

function setup({ networkHidden = 84, visible = 16 } = {}) {
  let turns = [];
  const container = {};
  let reloads = 0;
  let id = 0;
  const add = count => {
    while (count--) {
      const node = { id: ++id, parentElement: container, remove() { turns = turns.filter(t => t !== node); } };
      turns.push(node);
    }
  };
  add(visible);
  const app = {
    constants: { defaultLoadMoreCount: 20, revealStoragePrefix: 'reveal:', conversationMetaPrefix: 'meta:' },
    dom: { isSupportedPage: () => true, getConversationKey: () => 'c:alpha', collectMessageBlocks: () => turns,
      getTurnContainer: () => container, buildTurnFingerprint: nodes => nodes.map(n => n.id).join(',') },
    ui: { createPlaceholder: () => ({ isConnected: true }), updatePlaceholder: () => {},
      mountPlaceholder: p => { p.isConnected = true; }, removePlaceholder: p => { p.isConnected = false; } }
  };
  const sessionStorage = storage(networkHidden ? { 'meta:c:alpha': JSON.stringify({ source: 'network', hiddenCount: networkHidden, totalVisibleCount: 100, effectiveKeepCount: 16 }) } : {});
  const context = vm.createContext({ window: { ChatSpeedTrim: app, sessionStorage, location: { reload() { reloads++; } } }, console });
  runFile(context, 'src/content/prune.js');
  return { app, add, turns: () => turns, reloads: () => reloads };
}
const settings = { enabled: true, keepCount: 16, loadMoreCount: 20 };

test('new messages after network trim are pruned and added to the hidden count', async () => {
  const env = setup();
  await env.app.prune.apply(settings);
  assert.equal(env.app.prune.state.hiddenCount, 84);
  env.add(2);
  await env.app.prune.apply(settings);
  assert.equal(env.turns().length, 16);
  assert.equal(env.app.prune.state.hiddenCount, 86);
  env.add(2);
  await env.app.prune.apply(settings);
  assert.equal(env.turns().length, 16);
  assert.equal(env.app.prune.state.hiddenCount, 88);
  assert.equal(env.reloads(), 0);
});

test('DOM fallback keeps pruning new turns and increasing keep count reloads', async () => {
  const env = setup({ networkHidden: 0, visible: 100 });
  await env.app.prune.apply(settings);
  env.add(2);
  await env.app.prune.apply(settings);
  assert.equal(env.turns().length, 16);
  assert.equal(env.app.prune.state.hiddenCount, 86);
  await env.app.prune.apply({ ...settings, keepCount: 36 }, { forceReset: true });
  assert.equal(env.reloads(), 1);
});

test('disabling after trimming reloads and a detached placeholder is remounted', async () => {
  const env = setup();
  await env.app.prune.apply(settings);
  env.app.prune.state.placeholderEl.isConnected = false;
  await env.app.prune.apply(settings);
  assert.equal(env.app.prune.state.placeholderEl.isConnected, true);
  await env.app.prune.apply({ ...settings, enabled: false });
  assert.equal(env.reloads(), 1);
});

test('disabling before the first DOM pass restores an already network-trimmed response', async () => {
  const env = setup();
  await env.app.prune.apply({ ...settings, enabled: false });
  assert.equal(env.reloads(), 1);
});
