// Runs the real unpacked extension in a fresh Chromium profile. All site traffic
// is fulfilled with synthetic data; no account or personal conversations are used.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');
const { conversation } = require('./helpers.cjs');

const root = path.resolve(__dirname, '..');
const html = `<!doctype html><main></main><script nonce="fixture">
window.hookAtStart = Boolean(window.fetch.__chatSpeedTrimPatched);
window.render = async function(id) {
  const response = await fetch(new URL('/backend-api/conversation/' + id, location.origin));
  const text = await response.text();
  window.payloadBytes = text.length;
  window.payload = JSON.parse(text);
  const main = document.createElement('main');
  const container = document.createElement('section');
  for (const node of Object.values(payload.mapping)) {
    if (!node.message) continue;
    const turn = document.createElement('article');
    turn.dataset.testid = 'conversation-turn-' + node.id;
    turn.textContent = node.message.content.parts[0];
    container.append(turn);
  }
  main.append(container);
  document.querySelector('main').replaceWith(main);
  window.loaded = true;
};
render(location.pathname.split('/').pop());
</script>`;

async function main() {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'gptlagfixer-browser-'));
  let context;
  try {
    context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium', headless: true,
    executablePath: process.env.GPTLAGFIXER_BROWSER || undefined,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [`--disable-extensions-except=${root}`, `--load-extension=${root}`]
    });
    context.setDefaultTimeout(15000);
    const errors = [];
    await context.route(/https:\/\/(chatgpt\.com|chat\.openai\.com)\//, async route => {
      const url = new URL(route.request().url());
      if (url.pathname.startsWith('/backend-api/')) {
        const id = url.pathname.split('/').pop();
        const body = id === 'unsupported' ? JSON.stringify({ messages: [] }) : JSON.stringify(conversation(id === 'beta' ? 40 : 1000, id));
        await route.fulfill({ status: 200, contentType: 'application/json', body });
      } else {
        await route.fulfill({ status: 200, contentType: 'text/html', body: html,
          headers: { 'content-security-policy': "script-src 'nonce-fixture'; connect-src 'self'; require-trusted-types-for 'script'" } });
      }
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('https://chatgpt.com/c/alpha');
    await page.waitForFunction(() => window.loaded);
    assert.equal(await page.evaluate(() => window.hookAtStart), true);
    assert.equal(await page.evaluate(() => Object.keys(window.payload.mapping).length), 17);
    const bytes = await page.evaluate(() => window.payloadBytes);
    const originalBytes = JSON.stringify(conversation(1000)).length;
    assert.ok(bytes < originalBytes * 0.03);
    await page.getByText('984 earlier messages hidden to keep this chat fast.').waitFor();
    console.log(`PASS early MAIN hook under strict CSP/Trusted Types; 1000 -> 16 messages; ${originalBytes} -> ${bytes} JSON characters`);

    await Promise.all([
      page.waitForEvent('load'),
      page.getByRole('button', { name: 'Load 20 more messages' }).click()
    ]);
    await page.waitForFunction(() => window.loaded && Object.keys(window.payload.mapping).length === 37);
    await page.getByText('964 earlier messages hidden to keep this chat fast.').waitFor();
    console.log('PASS load more reloads with 36 visible messages');

    // Discover the actual isolated extension world, then inspect its ID/settings.
    const cdp = await context.newCDPSession(page);
    const worlds = [];
    cdp.on('Runtime.executionContextCreated', event => worlds.push(event.context));
    await cdp.send('Runtime.enable');
    const isolated = worlds.find(world => world.origin.startsWith('chrome-extension://'));
    assert.ok(isolated, JSON.stringify(worlds));
    const result = await cdp.send('Runtime.evaluate', { expression: 'chrome.runtime.id', contextId: isolated.id });
    const extensionId = result.result.value;
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/src/popup/popup.html`);
    await popup.locator('#keepCount').fill('12');
    await popup.locator('#keepCount').press('Tab');
    await page.waitForFunction(() => window.loaded && Object.keys(window.payload.mapping).length === 33);
    await page.getByText('968 earlier messages hidden to keep this chat fast.').waitFor();
    console.log('PASS reducing keep count reloads and shrinks network payload (12 + 20 revealed)');

    const status = await popup.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ url: 'https://chatgpt.com/*' });
      const status = await chrome.tabs.sendMessage(tab.id, { type: 'chat-speed-trim:status' });
      await chrome.tabs.sendMessage(tab.id, { type: 'chat-speed-trim:reset-current-chat' });
      return status;
    });
    assert.equal(status.networkHiddenCount, 968);
    await page.waitForFunction(() => window.loaded && Object.keys(window.payload.mapping).length === 13);
    console.log('PASS popup runtime status and reset-current-chat message');

    await popup.locator('.toggle-row').click();
    await page.waitForFunction(() => window.loaded && Object.keys(window.payload.mapping).length === 1001);
    await page.waitForTimeout(900);
    assert.equal(await page.locator('[data-chat-speed-trim-ui]').count(), 0);
    await popup.locator('.toggle-row').click();
    await page.waitForFunction(() => window.loaded && Object.keys(window.payload.mapping).length === 13);
    await page.getByText('988 earlier messages hidden to keep this chat fast.').waitFor();
    console.log('PASS disable restores full response; enable reapplies pre-render trim');

    await popup.close();
    await page.evaluate(async () => {
      history.pushState({}, '', '/c/beta');
      await window.render('beta');
    });
    await page.getByText('28 earlier messages hidden to keep this chat fast.').waitFor();
    assert.equal(await page.locator('[data-testid^="conversation-turn-"]').count(), 12);
    console.log('PASS SPA navigation replacing main retains pruning and correct per-chat counts');

    // An unsupported response format leaves network data untouched and uses DOM fallback.
    await page.evaluate(async () => {
      history.pushState({}, '', '/c/unsupported');
      await fetch('/backend-api/conversation/unsupported');
      const main = document.createElement('main');
      for (let i = 0; i < 100; i++) {
        const article = document.createElement('article');
        article.dataset.testid = 'conversation-turn-' + i;
        article.textContent = 'Fallback message ' + i;
        main.append(article);
      }
      document.querySelector('main').replaceWith(main);
    });
    await page.getByText('88 earlier messages hidden to keep this chat fast.').waitFor();
    assert.equal(await page.locator('article').count(), 12);
    await page.evaluate(() => {
      for (let i = 0; i < 2; i++) {
        const article = document.createElement('article');
        article.dataset.testid = 'conversation-turn-new-' + i;
        article.textContent = 'New message ' + i;
        document.querySelector('main').append(article);
      }
    });
    await page.getByText('90 earlier messages hidden to keep this chat fast.').waitFor();
    console.log('PASS DOM fallback after SPA replacement and incoming messages');

    // Readystatechange registered before open must see transformed text; XHR reuse
    // and json responseType must not leak the previous response or bypass trimming.
    const xhrCounts = await page.evaluate(async () => {
      const xhr = new XMLHttpRequest();
      const read = (id, type) => new Promise((resolve, reject) => {
        xhr.onreadystatechange = () => {
          if (xhr.readyState === 4) {
            try {
              const value = type === 'json' ? xhr.response : JSON.parse(xhr.responseText);
              resolve(Object.keys(value.mapping).length);
            } catch (error) { reject(error); }
          }
        };
        xhr.open('GET', '/backend-api/conversation/' + id);
        xhr.responseType = type;
        xhr.send();
      });
      return [await read('alpha', 'text'), await read('beta', 'json')];
    });
    assert.deepEqual(xhrCounts, [13, 13]);
    console.log('PASS XHR early handlers, text/json and reuse');

    await page.goto('https://chat.openai.com/c/alpha');
    await page.waitForFunction(() => window.loaded && Object.keys(window.payload.mapping).length === 13);
    await page.getByText('988 earlier messages hidden to keep this chat fast.').waitFor();
    assert.deepEqual(errors, []);
    console.log('PASS legacy supported host; no page JavaScript errors');
  } finally {
    if (context) await context.close();
    // Only remove the exact temporary directory created by mkdtemp above.
    await fs.rm(profile, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
