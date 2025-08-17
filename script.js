// Countdown with event name, partner, custom message, background, theme, and share link.
// Default target preset set to October 8, 2025 (UTC midnight).
(() => {
  // Elements
  const root = document.getElementById('app');
  const titleMain = document.getElementById('titleMain');
  const eventNameInput = document.getElementById('eventName');
  const partnerInput = document.getElementById('partnerName');
  const targetInput = document.getElementById('target');
  const doneMessageInput = document.getElementById('doneMessage');
  const bgUrlInput = document.getElementById('bgUrl');
  const bgFileInput = document.getElementById('bgFile');
  const themeSelect = document.getElementById('theme');

  const setBtn = document.getElementById('setBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const resetBtn = document.getElementById('resetBtn');
  const shareBtn = document.getElementById('shareBtn');

  const daysEl = document.getElementById('days');
  const hoursEl = document.getElementById('hours');
  const minutesEl = document.getElementById('minutes');
  const secondsEl = document.getElementById('seconds');
  const targetLabel = document.getElementById('targetLabel');
  const timeUpEl = document.getElementById('time-up');
  const countsEl = document.getElementById('counts');
  const doneTextEl = document.getElementById('doneText');

  const STORAGE_KEY = 'trip_countdown_v1';
  let state = {
    // preset the target to 2025-10-08 (Oct 8, 2025). This is stored as UTC midnight.
    targetIso: '2025-10-08T00:00:00.000Z',
    eventName: '',
    partner: '',
    doneMessage: '',
    bgDataUrl: '', // data URL for uploaded image
    bgUrl: '',     // external URL if provided
    theme: 'default'
  };

  let intervalId = null;
  let paused = false;
  let remainingWhenPaused = null;

  // helpers
  const pad = (n, z = 2) => String(n).padStart(z, '0');
  const now = () => new Date();

  // persist / load
  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
  function loadState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const s = JSON.parse(raw);
      Object.assign(state, s);
    } catch (e) { console.warn('Invalid saved state', e); }
  }

  // parse query params for share links
  function parseQuery() {
    const params = new URLSearchParams(location.search);
    let changed = false;
    if (params.has('t')) {
      const iso = params.get('t');
      const d = new Date(iso);
      if (!isNaN(d)) {
        state.targetIso = d.toISOString();
        changed = true;
      }
    }
    if (params.has('e')) { state.eventName = params.get('e'); changed = true; }
    if (params.has('p')) { state.partner = params.get('p'); changed = true; }
    if (params.has('m')) { state.doneMessage = params.get('m'); changed = true; }
    if (params.has('bg')) { state.bgUrl = params.get('bg'); changed = true; }
    if (params.has('theme')) { state.theme = params.get('theme'); changed = true; }
    if (changed) saveState();
  }

  function applyTheme() {
    // remove previous theme classes on root container
    root.classList.remove('theme-romantic', 'theme-beach', 'theme-party');
    if (state.theme === 'romantic') root.classList.add('theme-romantic');
    if (state.theme === 'beach') root.classList.add('theme-beach');
    if (state.theme === 'party') root.classList.add('theme-party');
  }

  function applyBackground() {
    // prefer uploaded data URL (bgDataUrl), otherwise external bgUrl, otherwise clear
    if (state.bgDataUrl) {
      root.style.backgroundImage = `url('${state.bgDataUrl}')`;
    } else if (state.bgUrl) {
      root.style.backgroundImage = `url('${state.bgUrl}')`;
    } else {
      root.style.backgroundImage = '';
    }
  }

  function toDateTimeLocal(d) {
    const off = d.getTimezoneOffset();
    const local = new Date(d.getTime() - off * 60 * 1000);
    return local.toISOString().slice(0, 16);
  }

  function toLabel(d) {
    return d.toLocaleString();
  }

  function setUIFromState() {
    eventNameInput.value = state.eventName || '';
    partnerInput.value = state.partner || '';
    doneMessageInput.value = state.doneMessage || '';
    bgUrlInput.value = state.bgUrl || '';
    themeSelect.value = state.theme || 'default';
    applyTheme();
    applyBackground();
    if (state.targetIso) {
      const d = new Date(state.targetIso);
      if (!isNaN(d)) {
        targetInput.value = toDateTimeLocal(d);
        targetLabel.textContent = toLabel(d);
        titleMain.textContent = state.eventName ? `${state.eventName} — ${state.partner || ''}` : 'Countdown';
      }
    } else {
      targetInput.value = '';
      targetLabel.textContent = 'not set';
      titleMain.textContent = state.eventName ? `${state.eventName} ${state.partner ? '— ' + state.partner : ''}` : 'Countdown';
    }
  }

  function setStateFromUI() {
    state.eventName = eventNameInput.value.trim();
    state.partner = partnerInput.value.trim();
    state.doneMessage = doneMessageInput.value.trim();
    state.bgUrl = bgUrlInput.value.trim();
    state.theme = themeSelect.value;
    saveState();
    applyTheme();
    applyBackground();
  }

  // Background file upload
  bgFileInput.addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      state.bgDataUrl = reader.result;
      // clear bgUrl (we prefer uploaded)
      state.bgUrl = '';
      bgUrlInput.value = '';
      saveState();
      applyBackground();
    };
    reader.readAsDataURL(f);
  });

  // Update when background URL or theme change
  bgUrlInput.addEventListener('input', () => {
    state.bgUrl = bgUrlInput.value.trim();
    if (state.bgUrl) state.bgDataUrl = '';
    saveState();
    applyBackground();
  });
  themeSelect.addEventListener('change', () => {
    state.theme = themeSelect.value;
    saveState();
    applyTheme();
  });
  eventNameInput.addEventListener('input', setStateFromUI);
  partnerInput.addEventListener('input', setStateFromUI);
  doneMessageInput.addEventListener('input', setStateFromUI);

  // UI update for countdown
  function updateUI(diffMs) {
    if (diffMs <= 0) {
      countsEl.classList.add('hidden');
      timeUpEl.classList.remove('hidden');
      const message = state.doneMessage || "Time's up!";
      doneTextEl.textContent = `${message}${state.partner ? ' — ' + state.partner : ''}`;
    } else {
      countsEl.classList.remove('hidden');
      timeUpEl.classList.add('hidden');

      const totalSeconds = Math.floor(diffMs / 1000);
      const days = Math.floor(totalSeconds / (3600 * 24));
      const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      daysEl.textContent = days;
      hoursEl.textContent = pad(hours);
      minutesEl.textContent = pad(minutes);
      secondsEl.textContent = pad(seconds);
    }
  }

  function tick() {
    if (!state.targetIso) return;
    const target = new Date(state.targetIso);
    const d = now();
    const diff = target - d;
    if (diff <= 0) {
      updateUI(0);
      stopTimer();
      playBeep();
    } else {
      updateUI(diff);
    }
  }

  function startTimer() {
    if (!state.targetIso) return;
    if (intervalId) clearInterval(intervalId);
    paused = false;
    intervalId = setInterval(tick, 250);
    tick();
    pauseBtn.textContent = 'Pause';
  }

  function stopTimer() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    paused = false;
    pauseBtn.textContent = 'Pause';
  }

  function pauseTimer() {
    if (!intervalId) return;
    const t = new Date(state.targetIso);
    remainingWhenPaused = t - now();
    stopTimer();
    paused = true;
    pauseBtn.textContent = 'Resume';
  }

  function resumeTimer() {
    if (!paused || remainingWhenPaused == null) return;
    const newTarget = new Date(Date.now() + remainingWhenPaused);
    state.targetIso = newTarget.toISOString();
    remainingWhenPaused = null;
    saveState();
    startTimer();
  }

  function resetTimer() {
    stopTimer();
    state.targetIso = null;
    saveState();
    targetInput.value = '';
    targetLabel.textContent = 'not set';
    updateUI(0);
    countsEl.classList.remove('hidden');
    timeUpEl.classList.add('hidden');
  }

  // button handlers
  setBtn.addEventListener('click', () => {
    setStateFromUI();
    const v = targetInput.value;
    if (!v) {
      alert('Please pick a valid date & time.');
      return;
    }
    const d = new Date(v);
    if (isNaN(d)) {
      alert('Invalid date/time.');
      return;
    }
    if (d <= now()) {
      const confirmPast = confirm('That time is in the past or now. Do you want to start a timer that immediately ends?');
      if (!confirmPast) return;
    }
    state.targetIso = d.toISOString();
    saveState();
    targetLabel.textContent = toLabel(d);
    titleMain.textContent = state.eventName ? `${state.eventName} — ${state.partner || ''}` : 'Countdown';
    startTimer();
  });

  pauseBtn.addEventListener('click', () => {
    if (!state.targetIso) return;
    if (!paused && intervalId) pauseTimer();
    else if (paused) resumeTimer();
    else if (!intervalId) startTimer();
  });

  resetBtn.addEventListener('click', () => {
    const ok = confirm('Reset and clear the saved target?');
    if (ok) resetTimer();
  });

  // share link: encode event, partner, message, target, bg (only external URL)
  shareBtn.addEventListener('click', async () => {
    setStateFromUI();
    const params = new URLSearchParams();
    if (state.targetIso) params.set('t', state.targetIso);
    if (state.eventName) params.set('e', state.eventName);
    if (state.partner) params.set('p', state.partner);
    if (state.doneMessage) params.set('m', state.doneMessage);
    if (state.bgUrl) params.set('bg', state.bgUrl);
    if (state.theme) params.set('theme', state.theme);
    const url = `${location.origin}${location.pathname}?${params.toString()}`;
    try {
      await navigator.clipboard.writeText(url);
      shareBtn.textContent = 'Link copied!';
      setTimeout(() => (shareBtn.textContent = 'Copy Share Link'), 2000);
    } catch (e) {
      prompt('Copy this link', url);
    }
  });

  // beep
  function playBeep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 880;
      g.gain.value = 0.0001;
      o.connect(g);
      g.connect(ctx.destination);
      const nowt = ctx.currentTime;
      g.gain.linearRampToValueAtTime(0.15, nowt + 0.01);
      o.start(nowt);
      g.gain.exponentialRampToValueAtTime(0.0001, nowt + 1.0);
      o.stop(nowt + 1.05);
    } catch (e) {
      console.warn('Audio unavailable', e);
    }
  }

  // initialize
  loadState();
  parseQuery();
  setUIFromState();
  // if a saved state existed in localStorage, it will override the preset.
  // otherwise the preset targetIso (Oct 8, 2025) will be shown and the timer started.
  if (state.targetIso) startTimer();
  updateUI(0);

  // expose for debugging
  window._tripCountdown = {
    state, startTimer, stopTimer, resetTimer
  };
})();