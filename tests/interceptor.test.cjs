const { test } = require('node:test');
const assert = require('node:assert/strict');
const { conversation, interceptor, runFile } = require('./helpers.cjs');
const endpoint = 'https://chatgpt.com/backend-api/conversation/alpha';

test('trims before the page reads JSON and preserves a valid rooted graph', async () => {
  const { window, original } = interceptor(conversation(1000));
  const response = await window.fetch(endpoint);
  const payload = await response.json();
  assert.equal(Object.keys(payload.mapping).length, 17);
  assert.equal(payload.mapping.m984.parent, 'root');
  assert.deepEqual(payload.mapping.root.children, ['m984']);
  assert.equal(payload.current_node, 'm999');
  assert.equal(response.url, original.url);
  assert.equal(response.headers.get('content-length'), null);
  for (const node of Object.values(payload.mapping)) {
    assert.ok(node.parent === null || payload.mapping[node.parent]);
    for (const child of node.children) assert.equal(payload.mapping[child].parent, node.id);
  }
  assert.equal(JSON.parse(window.sessionStorage['chat-speed-trim:meta:c:alpha']).hiddenCount, 984);
});

test('URL and Request objects work; metadata follows requested chat during navigation', async () => {
  for (const input of [new URL(endpoint), new Request(endpoint)]) {
    const { window } = interceptor();
    window.location.pathname = '/c/beta';
    window.sessionStorage.setItem('chat-speed-trim:reveal:c:alpha', '20');
    const response = await window.fetch(input);
    assert.equal(Object.keys((await response.json()).mapping).length, 37);
    assert.equal(JSON.parse(window.sessionStorage['chat-speed-trim:meta:c:alpha']).hiddenCount, 64);
    assert.equal(window.sessionStorage.getItem('chat-speed-trim:meta:c:beta'), null);
  }
});

test('short chats, disabled settings, malformed graphs and non-conversation requests fail open', async () => {
  for (const [payload, settings, input, init] of [
    [conversation(4), {}, endpoint],
    [conversation(100), { enabled: false }, endpoint],
    [{ mapping: [], current_node: 'missing' }, {}, endpoint],
    [conversation(100), {}, endpoint + '/stream'],
    [conversation(100), {}, endpoint, { method: 'POST' }],
    [conversation(100), {}, 'https://example.com/backend-api/conversation/alpha']
  ]) {
    const { window, original } = interceptor(payload, settings);
    assert.equal(await window.fetch(input, init), original);
  }
  for (const parent of ['missing', 'm99']) {
    const payload = conversation(100);
    payload.mapping.m0.parent = parent;
    const { window, original } = interceptor(payload);
    assert.equal(await window.fetch(endpoint), original);
  }
});

test('new document drops old network metadata, keeps reveal offset, installs once', () => {
  const { window, context } = interceptor(undefined, {}, {
    'chat-speed-trim:meta:c:alpha': '{}',
    'chat-speed-trim:reveal:c:alpha': '20'
  });
  assert.equal(window.sessionStorage.getItem('chat-speed-trim:meta:c:alpha'), null);
  assert.equal(window.sessionStorage.getItem('chat-speed-trim:reveal:c:alpha'), '20');
  const fetch = window.fetch;
  runFile(context, 'src/injected/interceptor.js');
  assert.equal(window.fetch, fetch);
});

test('cloned trimmed responses preserve response properties', async () => {
  const { window } = interceptor();
  const response = await window.fetch(endpoint);
  const clone = response.clone();
  assert.equal(clone.url, response.url);
  assert.equal(Object.keys((await clone.json()).mapping).length, 17);
});

test('streaming and failed responses are returned without reading their bodies', async () => {
  for (const options of [{ headers: { 'content-type': 'text/event-stream' } }, { status: 500 }]) {
    const { window, context } = interceptor();
    // Reset the installation guard and replace the underlying fetch.
    delete window.__chatSpeedTrimInterceptorInstalled;
    const response = new Response('not JSON', options);
    window.fetch = async () => response;
    runFile(context, 'src/injected/interceptor.js');
    assert.equal(await window.fetch(endpoint), response);
    assert.equal(response.bodyUsed, false);
  }
});
