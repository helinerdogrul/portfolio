(() => {
  const stage = document.querySelector('.portrait-interaction[data-sound-src]');
  const button = document.querySelector('.portrait-sound-toggle');
  const status = document.querySelector('.portrait-sound-status');
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!stage || !button || !Context) return;

  const FADE_IN = 0.05;
  const FADE_OUT = 0.1;
  const IDLE_DELAY = 85;
  const MAX_VOLUME = 0.55;
  const abortController = new AbortController();
  const listeners = { signal: abortController.signal };
  const passiveListeners = { ...listeners, passive: true };
  let context;
  let output;
  let source;
  let buffer;
  let bytesPromise;
  let decodePromise;
  let viewportObserver;
  let enabled = true;
  let loading = false;
  let destroyed = false;
  let inViewport = false;
  let generation = 0;
  let idleTimer = 0;
  let stopTimer = 0;
  let offset = 0;
  let startedAt = 0;
  let envelope = { from: 0, to: 0, start: 0, end: 0 };

  const renderButton = () => {
    button.textContent = loading && enabled ? 'Loading…' : enabled ? 'Sound on' : 'Sound off';
    button.setAttribute('aria-pressed', String(enabled));
    button.setAttribute('aria-busy', String(loading && enabled));
    button.setAttribute('aria-label', enabled ? 'Disable portrait sound' : 'Enable portrait sound');
  };

  // All amplitude changes use the audio clock, not JavaScript volume intervals.
  // Track the linear envelope ourselves so interrupted fades stay continuous on
  // browsers that do not support AudioParam.cancelAndHoldAtTime().
  const rampVolume = (target, duration) => {
    if (!context || !output) return;
    const now = context.currentTime;
    const progress = envelope.end > envelope.start
      ? Math.min(1, Math.max(0, (now - envelope.start) / (envelope.end - envelope.start)))
      : 1;
    const current = envelope.from + (envelope.to - envelope.from) * progress;
    output.gain.cancelScheduledValues(now);
    output.gain.setValueAtTime(current, now);
    output.gain.linearRampToValueAtTime(target, now + duration);
    envelope = { from: current, to: target, start: now, end: now + duration };
  };

  const stopSource = () => {
    stopTimer = 0;
    if (!source) return;
    offset = (offset + Math.max(0, context.currentTime - startedAt)) % buffer.duration;
    source.stop();
    source.disconnect();
    source = null;
  };

  const silence = () => {
    window.clearTimeout(idleTimer);
    idleTimer = 0;
    if (!source) return;
    if (envelope.to !== 0) rampVolume(0, FADE_OUT);
    // Keep one source alive through the fade. A quick re-entry can cancel this
    // stop and reverse the fade without stacking tracks or restarting the clip.
    if (!stopTimer) stopTimer = window.setTimeout(stopSource, FADE_OUT * 1000 + 16);
  };

  const fetchBytes = () => {
    if (!bytesPromise) {
      bytesPromise = fetch(new URL(stage.dataset.soundSrc, document.baseURI), {
        cache: 'force-cache',
        priority: 'low',
        signal: abortController.signal
      }).then((response) => {
        if (!response.ok) throw new Error('Portrait sound could not be loaded.');
        return response.arrayBuffer();
      }).catch((error) => {
        bytesPromise = null;
        throw error;
      });
    }
    return bytesPromise;
  };

  const makeSeamlessLoop = (decoded) => {
    const overlap = Math.min(Math.round(decoded.sampleRate * 0.16), Math.floor(decoded.length / 4));
    const length = decoded.length - overlap;
    const loop = context.createBuffer(decoded.numberOfChannels, length, decoded.sampleRate);
    for (let channel = 0; channel < decoded.numberOfChannels; channel += 1) {
      const input = decoded.getChannelData(channel);
      const samples = loop.getChannelData(channel);
      samples.set(input.subarray(0, length));
      for (let index = 0; index < overlap; index += 1) {
        const mix = index / Math.max(1, overlap - 1);
        samples[index] = input[length + index] * (1 - mix) + input[index] * mix;
      }
    }
    offset = overlap / decoded.sampleRate;
    return loop;
  };

  const loadBuffer = () => {
    if (buffer) return Promise.resolve(buffer);
    if (!decodePromise) {
      decodePromise = fetchBytes().then((bytes) => context.decodeAudioData(bytes.slice(0)))
        .then((decoded) => {
          if (destroyed) return null;
          buffer = makeSeamlessLoop(decoded);
          return buffer;
        }).catch((error) => {
          decodePromise = null;
          throw error;
        });
    }
    return decodePromise;
  };

  const resumeContext = () => {
    if (!enabled || destroyed) return;
    if (!context || context.state === 'closed') {
      context = new Context({ latencyHint: 'interactive' });
      output = context.createGain();
      output.gain.setValueAtTime(0, context.currentTime);
      output.connect(context.destination);
      envelope = { from: 0, to: 0, start: 0, end: 0 };
    }
    // Some browsers leave this promise pending until a real user gesture.
    // Never make decoding or the mute button wait for autoplay permission.
    if (context.state !== 'running') context.resume().catch(() => {});
  };

  const prepareAudio = async () => {
    if (!enabled || destroyed) return;
    const request = generation;
    loading = !buffer;
    renderButton();
    try {
      resumeContext();
      await loadBuffer();
      if (destroyed || request !== generation || !enabled) return;
      loading = false;
      renderButton();
      // Stay silent until the next actual pointer movement over the portrait.
    } catch (error) {
      if (destroyed || request !== generation) return;
      enabled = false;
      loading = false;
      silence();
      renderButton();
      button.textContent = 'Retry sound';
      button.setAttribute('title', 'Sound could not start. Please try again.');
      if (status) status.textContent = 'Sound could not start. Please try again.';
    }
  };

  const onToggle = () => {
    generation += 1;
    enabled = !enabled;
    button.removeAttribute('title');
    if (status) status.textContent = '';
    if (enabled) return prepareAudio();
    silence();
    renderButton();
  };

  const onGesture = (event) => {
    if (!enabled || destroyed || event.target === button) return;
    // An ordinary click/key anywhere can unlock sound before the visitor
    // reaches the portrait. Movement and idle animation alone stay silent.
    resumeContext();
  };

  const onMotion = (event) => {
    if (!enabled || loading || destroyed || !buffer || !inViewport || document.hidden
      || context?.state !== 'running' || !stage.classList.contains('is-webgl')) return;
    const speed = Number(event.detail?.speed);
    if (!Number.isFinite(speed) || speed < 0.02) {
      silence();
      return;
    }
    window.clearTimeout(idleTimer);
    window.clearTimeout(stopTimer);
    stopTimer = 0;
    if (!source) {
      source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(output);
      startedAt = context.currentTime;
      source.start(startedAt, offset);
    }
    const volume = MAX_VOLUME * (0.4 + 0.6 * Math.min(speed / 1.5, 1));
    rampVolume(volume, FADE_IN);
    idleTimer = window.setTimeout(silence, IDLE_DELAY);
  };

  const onReady = () => {
    button.hidden = false;
    if (enabled) prepareAudio();
  };

  const cleanup = () => {
    if (destroyed) return;
    destroyed = true;
    enabled = false;
    generation += 1;
    window.clearTimeout(idleTimer);
    window.clearTimeout(stopTimer);
    if (context && output) {
      output.gain.cancelScheduledValues(context.currentTime);
      output.gain.setValueAtTime(0, context.currentTime);
      stopSource();
      output.disconnect();
      context.close().catch(() => {});
    }
    abortController.abort();
    viewportObserver?.disconnect();
    button.hidden = true;
  };

  button.addEventListener('click', onToggle, listeners);
  document.addEventListener('pointerdown', onGesture, passiveListeners);
  document.addEventListener('click', onGesture, listeners);
  document.addEventListener('keydown', onGesture, listeners);
  stage.addEventListener('portrait-motion-ready', onReady, listeners);
  stage.addEventListener('portrait-motion', onMotion, listeners);
  stage.addEventListener('pointerleave', silence, passiveListeners);
  stage.addEventListener('pointercancel', silence, passiveListeners);
  stage.addEventListener('pointerup', (event) => {
    if (event.pointerType === 'touch') silence();
  }, passiveListeners);
  window.addEventListener('blur', silence, listeners);
  window.addEventListener('pagehide', cleanup, { ...listeners, once: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) silence();
  }, listeners);
  document.addEventListener('scroll', silence, { ...passiveListeners, capture: true });

  if ('IntersectionObserver' in window) {
    viewportObserver = new IntersectionObserver((entries) => {
      inViewport = entries[0]?.isIntersecting ?? false;
      if (!inViewport) silence();
    }, { threshold: 0.01 });
    viewportObserver.observe(stage);
  } else {
    inViewport = true;
  }

  renderButton();
  if (stage.classList.contains('is-webgl')) onReady();
})();
