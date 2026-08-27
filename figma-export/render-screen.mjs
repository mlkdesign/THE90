// Headless Chrome renderer for THE90 prototype screens.
// Uses raw CDP over WebSocket (Node 22+ has native WebSocket).
// Usage: node render-screen.mjs <screen-name> <out-path>
import { spawn } from 'node:child_process';
import { rm, mkdir } from 'node:fs/promises';
import { writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

const [, , screenName, outPath] = process.argv;
if (!screenName || !outPath) {
  console.error('usage: node render-screen.mjs <screen> <out.png>');
  process.exit(2);
}

const USER_DIR = '/tmp/the90-cdp';
const PORT = 9333;
const ORIGIN = 'http://localhost:4173';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

await rm(USER_DIR, { recursive: true, force: true });
await mkdir(USER_DIR, { recursive: true });

const chrome = spawn(CHROME, [
  `--headless=new`,
  `--disable-gpu`,
  `--hide-scrollbars`,
  `--no-first-run`,
  `--no-default-browser-check`,
  `--user-data-dir=${USER_DIR}`,
  `--window-size=390,900`,
  `--remote-debugging-port=${PORT}`,
  `about:blank`
], { stdio: ['ignore', 'ignore', 'pipe'] });

async function waitForChrome() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (r.ok) return await r.json();
    } catch {}
    await delay(150);
  }
  throw new Error('chrome did not open debug port');
}

async function newTab() {
  const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' });
  return await r.json();
}

async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let seq = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id != null && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(`${msg.error.message} (${msg.error.code}): ${JSON.stringify(msg.error.data || {})}`));
      else resolve(msg.result);
    }
  };
  const send = (method, params) => new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
  return { ws, send };
}

try {
  await waitForChrome();
  const tab = await newTab();
  const cdp = await connect(tab.webSocketDebuggerUrl);

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  // set localStorage.the90.currentScreen via a same-origin bootstrap page
  await cdp.send('Page.navigate', { url: `${ORIGIN}/figma-export/render-shim.html?screen=${encodeURIComponent(screenName)}` });

  // wait until app is loaded — poll for #app + [data-screen] existing and active
  let ready = false;
  for (let i = 0; i < 80; i++) {
    await delay(150);
    const r = await cdp.send('Runtime.evaluate', {
      expression: `(function(){
        var a = document.querySelector('.screen.is-active');
        return a ? a.getAttribute('data-screen') : null;
      })()`,
      returnByValue: true
    });
    if (r.result.value) { ready = true; break; }
  }
  if (!ready) throw new Error('prototype never became ready');

  // navigate to the requested screen if it isn't already active,
  // then close any modal (welcome reward), stop timers, and unclip scroll containers
  await cdp.send('Runtime.evaluate', {
    expression: `(function(){
      try {
        if (window.THE90 && typeof window.THE90.go === 'function') {
          var cur = document.querySelector('.screen.is-active');
          if (!cur || cur.getAttribute('data-screen') !== ${JSON.stringify(screenName)}) {
            window.THE90.go(${JSON.stringify(screenName)});
          }
        }
      } catch (e) {}
      return true;
    })()`,
    returnByValue: true
  });

  await delay(600);

  await cdp.send('Runtime.evaluate', {
    expression: `(function(){
      // close all modals / bottom sheets
      document.querySelectorAll('.modal, .sheet, [data-modal], [data-sheet]').forEach(function(el){
        el.classList.remove('is-open','is-active','is-visible','open');
        el.style.display = 'none';
      });
      document.querySelectorAll('.modal-backdrop, .sheet-backdrop, .overlay').forEach(function(el){ el.style.display='none'; });

      // stop all timers so animation frames stop mutating DOM
      var topId = window.setInterval(function(){}, 1e9);
      for (var i = 1; i <= topId; i++) window.clearInterval(i);
      var topT = window.setTimeout(function(){}, 1e9);
      for (var j = 1; j <= topT; j++) window.clearTimeout(j);

      // unclip every scroll container
      var s = document.createElement('style');
      s.textContent =
        '*,*::before,*::after{animation:none !important;transition:none !important}\\n' +
        'html,body{overflow:visible !important;height:auto !important;min-height:0 !important;max-height:none !important}\\n' +
        '.app,.screen,.screen.is-active,section.screen{overflow:visible !important;height:auto !important;min-height:0 !important;max-height:none !important;position:static !important}\\n' +
        '.screen:not(.is-active){display:none !important}\\n' +
        '[style*="overflow"]{overflow:visible !important}\\n' +
        '*::-webkit-scrollbar{display:none !important}';
      document.head.appendChild(s);
      Array.prototype.forEach.call(document.querySelectorAll('*'), function(el){
        var cs = getComputedStyle(el);
        if (/(auto|scroll|hidden)/.test(cs.overflowY) || /(auto|scroll|hidden)/.test(cs.overflowX)) {
          el.style.overflow = 'visible';
          el.style.maxHeight = 'none';
          if (cs.height !== 'auto' && parseFloat(cs.height) < 200) return; // don't blow up tiny wrappers
          el.style.height = 'auto';
        }
      });
      return {
        activeScreen: (document.querySelector('.screen.is-active')||{getAttribute:function(){return null}}).getAttribute('data-screen'),
        scrollHeight: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)
      };
    })()`,
    returnByValue: true
  });

  await delay(700);

  // measure real content size — after unclipping the active screen fully
  const measure = await cdp.send('Runtime.evaluate', {
    expression: `(function(){
      var active = document.querySelector('.screen.is-active');
      var h = 900;
      if (active) {
        var r = active.getBoundingClientRect();
        h = Math.max(h, Math.ceil(r.bottom + window.scrollY));
      }
      h = Math.max(h, document.documentElement.scrollHeight, document.body.scrollHeight);
      return { w: 390, h: h };
    })()`,
    returnByValue: true
  });
  const { w, h } = measure.result.value;
  console.error('measured', w, 'x', h);

  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: w, height: h, deviceScaleFactor: 1, mobile: false
  });
  await delay(300);

  const shot = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
    fromSurface: true,
    clip: { x: 0, y: 0, width: w, height: h, scale: 1 }
  });
  await writeFile(outPath, Buffer.from(shot.data, 'base64'));
  console.log(`ok ${screenName} → ${outPath} (${w}x${h})`);
} catch (e) {
  console.error('render failed:', e.message);
  process.exitCode = 1;
} finally {
  chrome.kill('SIGTERM');
}
