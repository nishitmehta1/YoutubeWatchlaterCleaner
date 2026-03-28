// ==UserScript==
// @name         YouTube Watch Later – Remove Fully Watched
// @namespace    https://github.com/nishit/yt-wl-cleaner
// @version      1.1.0
// @description  Removes only FULLY watched videos from your Watch Later playlist, leaving partially-watched ones untouched.
// @author       Nishit
// @match        https://www.youtube.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // ─── Config ──────────────────────────────────────────────────────────────
  // A video is considered "fully watched" when its progress bar width >= this.
  // YouTube stops updating the bar at 100%, but some videos end at 95-99%.
  const WATCHED_THRESHOLD_PCT = 95;

  // Delay between removing consecutive videos (ms). Keeps things stable.
  const REMOVAL_DELAY_MS = 800;

  // How long to wait for the context menu to appear after clicking (ms).
  const MENU_OPEN_TIMEOUT_MS = 2000;
  // ─────────────────────────────────────────────────────────────────────────

  function isWatchLaterPage() {
    return location.pathname === '/playlist' && location.search.includes('list=WL');
  }

  // ── UI ───────────────────────────────────────────────────────────────────
  const panel = document.createElement('div');
  panel.id = 'wl-cleaner-panel';
  Object.assign(panel.style, {
    position:     'fixed',
    bottom:       '80px',
    right:        '24px',
    zIndex:       '99999',
    background:   '#0f0f0f',
    color:        '#fff',
    border:       '1px solid #3f3f3f',
    borderRadius: '12px',
    padding:      '14px 18px',
    fontFamily:   'Roboto, sans-serif',
    fontSize:     '13px',
    boxShadow:    '0 4px 20px rgba(0,0,0,.6)',
    minWidth:     '220px',
    userSelect:   'none',
    display:      'none', // hidden until on WL page
  });

  const titleRow = document.createElement('div');
  Object.assign(titleRow.style, { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' });

  const title = document.createElement('div');
  title.textContent = '🧹 WL Cleaner';
  Object.assign(title.style, { fontWeight: '700', fontSize: '14px' });

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  Object.assign(closeBtn.style, {
    background:  'none',
    border:      'none',
    color:       '#aaa',
    fontSize:    '14px',
    cursor:      'pointer',
    padding:     '0 0 0 8px',
    lineHeight:  '1',
  });
  closeBtn.addEventListener('mouseenter', () => closeBtn.style.color = '#fff');
  closeBtn.addEventListener('mouseleave', () => closeBtn.style.color = '#aaa');
  closeBtn.addEventListener('click', () => { panel.style.display = 'none'; });

  titleRow.append(title, closeBtn);

  const statusEl = document.createElement('div');
  statusEl.id = 'wl-cleaner-status';
  statusEl.textContent = 'Ready – click Scan to start.';
  Object.assign(statusEl.style, { color: '#aaa', marginBottom: '10px', lineHeight: '1.4' });

  const btnRow = document.createElement('div');
  Object.assign(btnRow.style, { display: 'flex', gap: '8px' });

  const makeBtn = (label, bg) => {
    const b = document.createElement('button');
    b.textContent = label;
    Object.assign(b.style, {
      flex:         '1',
      padding:      '7px 0',
      borderRadius: '6px',
      border:       'none',
      background:   bg,
      color:        '#fff',
      fontWeight:   '600',
      fontSize:     '12px',
      cursor:       'pointer',
    });
    return b;
  };

  const scanBtn   = makeBtn('Scan',   '#065fd4');
  const removeBtn = makeBtn('Remove', '#cc0000');
  removeBtn.disabled = true;
  removeBtn.style.opacity = '0.4';

  btnRow.append(scanBtn, removeBtn);
  panel.append(titleRow, statusEl, btnRow);
  document.body.appendChild(panel);

  function syncPanelVisibility() {
    panel.style.display = isWatchLaterPage() ? 'block' : 'none';
  }

  // YouTube fires this event on every SPA navigation
  window.addEventListener('yt-navigate-finish', syncPanelVisibility);
  // Also check immediately in case the script loads directly on the WL page
  syncPanelVisibility();
  // ─────────────────────────────────────────────────────────────────────────

  function setStatus(msg, color = '#aaa') {
    statusEl.textContent = msg;
    statusEl.style.color = color;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function getProgressPct(videoRenderer) {
    const bar = videoRenderer.querySelector(
      'ytd-thumbnail-overlay-resume-playback-renderer #progress'
    );
    if (!bar) return 0;
    const w = bar.style.width; // e.g. "87%"
    return parseFloat(w) || 0;
  }

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  function waitFor(selector, root = document, timeout = MENU_OPEN_TIMEOUT_MS) {
    return new Promise((resolve, reject) => {
      const el = root.querySelector(selector);
      if (el) return resolve(el);

      const observer = new MutationObserver(() => {
        const found = root.querySelector(selector);
        if (found) { observer.disconnect(); resolve(found); }
      });
      observer.observe(root, { childList: true, subtree: true });
      setTimeout(() => { observer.disconnect(); reject(new Error(`Timeout waiting for ${selector}`)); }, timeout);
    });
  }

  // ── Scroll to load all videos ─────────────────────────────────────────────

  async function scrollToBottom() {
    setStatus('Scrolling to load all videos…', '#aaa');
    let lastCount = 0;
    while (true) {
      const items = document.querySelectorAll('ytd-playlist-video-renderer');
      window.scrollTo(0, document.documentElement.scrollHeight);
      await sleep(1200);
      const newCount = document.querySelectorAll('ytd-playlist-video-renderer').length;
      if (newCount === lastCount) break; // no new items loaded
      lastCount = newCount;
    }
    window.scrollTo(0, 0);
    await sleep(400);
  }

  // ── Scan ──────────────────────────────────────────────────────────────────

  let fullyWatched = []; // holds { renderer, title } objects

  scanBtn.addEventListener('click', async () => {
    scanBtn.disabled = true;
    removeBtn.disabled = true;
    removeBtn.style.opacity = '0.4';
    fullyWatched = [];

    await scrollToBottom();

    const all = [...document.querySelectorAll('ytd-playlist-video-renderer')];
    setStatus(`Scanning ${all.length} video(s)…`, '#aaa');

    for (const renderer of all) {
      const pct = getProgressPct(renderer);
      if (pct >= WATCHED_THRESHOLD_PCT) {
        const titleEl = renderer.querySelector('#video-title');
        fullyWatched.push({
          renderer,
          title: titleEl ? titleEl.textContent.trim() : '(unknown)',
          pct,
        });
      }
    }

    if (fullyWatched.length === 0) {
      setStatus('No fully-watched videos found.', '#4caf50');
    } else {
      setStatus(`Found ${fullyWatched.length} fully-watched video(s).\nClick Remove to delete them.`, '#ffaa00');
      removeBtn.disabled = false;
      removeBtn.style.opacity = '1';
      console.log('[WL Cleaner] Fully watched videos:', fullyWatched.map(v => `${v.pct}% – ${v.title}`));
    }

    scanBtn.disabled = false;
  });

  // ── Remove ────────────────────────────────────────────────────────────────

  removeBtn.addEventListener('click', async () => {
    if (fullyWatched.length === 0) return;

    scanBtn.disabled = true;
    removeBtn.disabled = true;
    removeBtn.style.opacity = '0.4';

    let removed = 0;
    let failed  = 0;

    for (const { renderer, title } of fullyWatched) {
      setStatus(`Removing ${removed + 1}/${fullyWatched.length}:\n"${title.substring(0, 40)}…"`, '#aaa');

      try {
        // 1. Open the three-dot menu on this video row
        const menuBtn = renderer.querySelector('ytd-menu-renderer button#button');
        if (!menuBtn) throw new Error('Menu button not found');
        menuBtn.click();

        // 2. Wait for the popup menu
        const popup = await waitFor('ytd-menu-popup-renderer tp-yt-paper-listbox');

        // 3. Find the "Remove from Watch Later" item (text-based match)
        const items = [...popup.querySelectorAll('ytd-menu-service-item-renderer, tp-yt-paper-item')];
        const removeItem = items.find(el => {
          const text = el.textContent.trim().toLowerCase();
          return text.includes('remove from') || text.includes('watch later');
        });

        if (!removeItem) {
          // Close menu and skip
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
          await sleep(300);
          throw new Error('Remove menu item not found');
        }

        removeItem.click();
        removed++;
        await sleep(REMOVAL_DELAY_MS);
      } catch (err) {
        console.warn(`[WL Cleaner] Failed to remove "${title}":`, err.message);
        // Dismiss any open menu
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await sleep(500);
        failed++;
      }
    }

    const msg = failed > 0
      ? `Done. Removed ${removed}, failed ${failed}. Check console for details.`
      : `Done! Removed ${removed} fully-watched video(s).`;
    setStatus(msg, failed > 0 ? '#ffaa00' : '#4caf50');

    fullyWatched = [];
    scanBtn.disabled = false;
  });

})();
