const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function storage(initial = {}) {
  const result = { ...initial };
  Object.defineProperties(result, {
    getItem: { value: key => result[key] ?? null },
    setItem: { value: (key, value) => { result[key] = String(value); } },
    removeItem: { value: key => { delete result[key]; } }
  });
  return result;
}

function conversation(count, id = 'alpha') {
  const mapping = { root: { id: 'root', parent: null, children: ['m0'], message: null } };
  for (let i = 0; i < count; i++) {
    mapping[`m${i}`] = {
      id: `m${i}`, parent: i ? `m${i - 1}` : 'root',
      children: i + 1 < count ? [`m${i + 1}`] : [],
      message: { author: { role: i % 2 ? 'assistant' : 'user' }, content: { parts: [`message ${i} ${'x'.repeat(1000)}`] } }
    };
  }
  return { conversation_id: id, mapping, current_node: `m${count - 1}` };
}

function runFile(context, file) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context, { filename: file });
}

function interceptor(payload = conversation(100), settings = {}, session = {}) {
  const original = new Response(JSON.stringify(payload), { headers: { 'content-type': 'application/json', 'content-length': '999999' } });
  Object.defineProperty(original, 'url', { value: 'https://chatgpt.com/backend-api/conversation/alpha' });
  const window = {
    location: { href: 'https://chatgpt.com/c/alpha', pathname: '/c/alpha' },
    localStorage: storage({ 'chat-speed-trim:page-settings': JSON.stringify({ enabled: true, keepCount: 16, ...settings }) }),
    sessionStorage: storage(session),
    fetch: async () => original
  };
  const context = vm.createContext({ window, URL, Response, Headers, console });
  runFile(context, 'src/injected/interceptor.js');
  return { window, context, original };
}

module.exports = { storage, conversation, runFile, interceptor };
