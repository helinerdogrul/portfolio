const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const code = fs.readFileSync(path.join(__dirname, '../portrait-sound.js'), 'utf8');

function harness({ pendingDecode = null, blockAutoplay = false } = {}) {
  const clock = { now: 0, sequence: 0, timers: new Map() };
  const events = () => ({
    handlers: new Map(), attributes: new Map(), hidden: true, textContent: '',
    addEventListener(type, callback, options = {}) {
      const handlers = this.handlers.get(type) || [];
      handlers.push({ callback, signal: options.signal });
      this.handlers.set(type, handlers);
    },
    emit(type, event = {}) {
      return (this.handlers.get(type) || []).filter(({ signal }) => !signal?.aborted)
        .map(({ callback }) => callback(event));
    },
    setAttribute(key, value) { this.attributes.set(key, value); },
    removeAttribute(key) { this.attributes.delete(key); }
  });
  const stage = events();
  stage.dataset = { soundSrc: 'portrait-sound.m4a' };
  stage.webgl = false;
  stage.classList = { contains: () => stage.webgl };
  const button = events();
  const status = events();
  const document = events();
  document.hidden = false;
  document.baseURI = 'http://localhost:8765/';
  document.querySelector = (selector) => selector.includes('interaction') ? stage
    : selector.includes('toggle') ? button : status;
  const window = events();
  window.setTimeout = (callback, delay) => {
    const id = ++clock.sequence;
    clock.timers.set(id, { callback, due: clock.now + delay });
    return id;
  };
  window.clearTimeout = (id) => clock.timers.delete(id);
  const contexts = [];
  const observers = [];
  class Observer {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe() {}
    disconnect() { this.disconnected = true; }
  }
  window.IntersectionObserver = Observer;
  const makeBuffer = (channels, length, sampleRate) => {
    const samples = Array.from({ length: channels }, () => new Float32Array(length));
    return { numberOfChannels: channels, length, sampleRate, duration: length / sampleRate,
      getChannelData: (channel) => samples[channel] };
  };
  const decoded = makeBuffer(2, 2000, 1000);
  for (let channel = 0; channel < 2; channel++) {
    decoded.getChannelData(channel).forEach((_, index, samples) => {
      samples[index] = Math.sin(index * 0.015 + channel) * 0.6;
    });
  }
  class Context {
    constructor(options) {
      this.options = options;
      this.state = 'suspended';
      this.destination = {};
      this.sources = [];
      this.gainCalls = [];
      contexts.push(this);
    }
    get currentTime() { return clock.now / 1000; }
    createGain() {
      const calls = this.gainCalls;
      return { connect() {}, disconnect() {}, gain: {
        cancelScheduledValues: (time) => calls.push({ type: 'cancel', time }),
        setValueAtTime: (value, time) => calls.push({ type: 'set', value, time }),
        linearRampToValueAtTime: (value, time) => calls.push({ type: 'ramp', value, time })
      } };
    }
    createBufferSource() {
      const source = { connect() {}, disconnect() {}, stopped: false,
        start(time, offset) { this.started = { time, offset }; },
        stop() { this.stopped = true; } };
      this.sources.push(source);
      return source;
    }
    createBuffer(...args) { return makeBuffer(...args); }
    decodeAudioData() { return pendingDecode || Promise.resolve(decoded); }
    resume() {
      if (blockAutoplay && !window.userActivated) return new Promise(() => {});
      this.state = 'running'; return Promise.resolve();
    }
    close() { this.state = 'closed'; return Promise.resolve(); }
  }
  window.AudioContext = Context;
  const network = { calls: 0, failed: false };
  const fetch = async (url) => {
    network.calls++;
    network.url = String(url);
    if (network.failed) throw new Error('Network offline');
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(16) };
  };
  vm.runInNewContext(code, { window, document, fetch, URL, AbortController,
    IntersectionObserver: Observer, console });
  const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
  return {
    stage, button, status, document, window, network, contexts, observers, decoded, clock, flush,
    ready() { stage.webgl = true; stage.emit('portrait-motion-ready'); observers[0].callback([{ isIntersecting: true }]); },
    click: () => Promise.all(button.emit('click')),
    gesture() { window.userActivated = true; document.emit('pointerdown', { target: stage }); },
    motion: (speed = 1) => stage.emit('portrait-motion', { detail: { speed } }),
    advance(milliseconds) {
      const end = clock.now + milliseconds;
      while (true) {
        const next = [...clock.timers].filter(([, timer]) => timer.due <= end)
          .sort((a, b) => a[1].due - b[1].due)[0];
        if (!next) break;
        clock.now = next[1].due;
        clock.timers.delete(next[0]);
        next[1].callback();
      }
      clock.now = end;
    }
  };
}

test('sound is enabled by default but actual portrait motion is required to play', async () => {
  const h = harness();
  assert.equal(h.contexts.length, 0);
  assert.equal(h.network.calls, 0);
  assert.equal(h.button.hidden, true);
  assert.equal(h.button.textContent, 'Sound on');
  h.ready();
  await h.flush();
  assert.equal(h.button.hidden, false);
  assert.equal(h.network.url, 'http://localhost:8765/portrait-sound.m4a');
  const context = h.contexts[0];
  assert.equal(context.sources.length, 0);
  assert.equal(h.button.attributes.get('aria-pressed'), 'true');
  h.motion();
  assert.equal(context.sources.length, 1);
  assert.equal(context.sources[0].loop, true);
  assert.equal(context.gainCalls.at(-1).time, 0.05);
  assert.ok(context.gainCalls.at(-1).value > 0);
});

test('blocked autoplay stays enabled and an ordinary page gesture unlocks portrait sound', async () => {
  const h = harness({ blockAutoplay: true }); h.ready(); await h.flush();
  assert.equal(h.button.textContent, 'Sound on');
  assert.equal(h.button.attributes.get('aria-busy'), 'false');
  h.motion();
  assert.equal(h.contexts[0].sources.length, 0);
  h.gesture(); h.motion();
  assert.equal(h.contexts[0].sources.length, 1);
  await h.click(); h.advance(116); h.gesture(); h.motion();
  assert.equal(h.button.textContent, 'Sound off');
  assert.equal(h.contexts[0].sources.filter(source => !source.stopped).length, 0);
});

test('interrupted fades remain continuous; repeated stop events do not prolong the fade', async () => {
  const h = harness(); h.ready(); await h.flush(); h.motion();
  const context = h.contexts[0];
  const target = context.gainCalls.at(-1).value;
  h.advance(20);
  h.stage.emit('pointerleave');
  assert.ok(Math.abs(context.gainCalls.at(-2).value - target * 0.4) < 1e-10);
  assert.equal(context.gainCalls.at(-1).value, 0);
  assert.ok(Math.abs(context.gainCalls.at(-1).time - 0.12) < 1e-10);
  const count = context.gainCalls.length;
  h.advance(70);
  h.document.emit('scroll');
  h.stage.emit('pointerleave');
  assert.equal(context.gainCalls.length, count);
  h.advance(46);
  assert.equal(context.sources[0].stopped, true);
});

test('quick re-entry reuses one track; stationary input fades and later resumes its position', async () => {
  const h = harness(); h.ready(); await h.flush(); h.motion();
  const context = h.contexts[0];
  const initialOffset = context.sources[0].started.offset;
  h.advance(20); h.stage.emit('pointerleave'); h.advance(30); h.motion();
  assert.equal(context.sources.length, 1);
  assert.equal(context.sources[0].stopped, false);
  h.advance(85);
  assert.equal(context.gainCalls.at(-1).value, 0);
  h.advance(116);
  assert.equal(context.sources[0].stopped, true);
  h.motion();
  assert.equal(context.sources.length, 2);
  assert.ok(context.sources[1].started.offset > initialOffset);
  assert.equal(context.sources.filter(source => !source.stopped).length, 1);
});

test('tab hiding, window blur, scrolling and leaving the viewport silence sound', async () => {
  const h = harness(); h.ready(); await h.flush();
  const context = h.contexts[0];
  for (const stop of [
    () => h.window.emit('blur'),
    () => h.document.emit('scroll'),
    () => { h.document.hidden = true; h.document.emit('visibilitychange'); },
    () => h.observers[0].callback([{ isIntersecting: false }])
  ]) {
    h.document.hidden = false;
    h.observers[0].callback([{ isIntersecting: true }]);
    h.motion(); h.advance(15); stop();
    assert.equal(context.gainCalls.at(-1).value, 0);
    h.advance(116);
    assert.equal(context.sources.at(-1).stopped, true);
  }
  h.motion();
  assert.equal(context.sources.filter(source => !source.stopped).length, 0);
});

test('turning sound off while decoding cannot start audio when loading finishes', async () => {
  let resolve;
  const pendingDecode = new Promise(done => { resolve = done; });
  const h = harness({ pendingDecode }); h.ready();
  assert.equal(h.button.attributes.get('aria-busy'), 'true');
  await h.click();
  resolve(h.decoded);
  await h.flush();
  h.motion();
  assert.equal(h.button.attributes.get('aria-pressed'), 'false');
  assert.equal(h.contexts[0].sources.length, 0);
});

test('loading failures are recoverable without breaking portrait interaction', async () => {
  const h = harness(); h.network.failed = true; h.ready(); await h.flush();
  assert.equal(h.button.textContent, 'Retry sound');
  assert.equal(h.button.attributes.get('aria-pressed'), 'false');
  h.network.failed = false;
  await h.click(); h.motion();
  assert.equal(h.contexts.length, 1);
  assert.equal(h.contexts[0].sources.length, 1);
});

test('long interactions get a feathered loop and page exit releases audio resources', async () => {
  const h = harness(); h.ready(); await h.flush(); h.motion();
  const context = h.contexts[0];
  const loop = context.sources[0].buffer;
  assert.equal(loop.length, 1840);
  assert.equal(loop.getChannelData(0)[0], h.decoded.getChannelData(0)[1840]);
  assert.equal(loop.getChannelData(0)[159], h.decoded.getChannelData(0)[159]);
  h.window.emit('pagehide');
  assert.equal(context.state, 'closed');
  assert.equal(context.sources[0].stopped, true);
  assert.equal(h.button.hidden, true);
  assert.equal(h.observers[0].disconnected, true);
  h.motion();
  assert.equal(context.sources.length, 1);
});
