// =========================================================================
// APP STATE, PERSISTENCE, RENDERING & SUMMARY EXPORT
// =========================================================================
(function () {
  'use strict';

  const STORAGE_KEY = 'rsn-sight-turn-v1';
  const $ = id => document.getElementById(id);

  const DEFAULT_STATE = {
    project: {
      title: '',
      location: '',
      jurisdiction: 'FDOT / Florida Greenbook',
      analyst: '',
      date: new Date().toISOString().slice(0, 10)
    },
    isd: {
      speed: '30',
      vehicle: 'passenger',
      majorLanes: '2',
      lanesCrossed: '2',
      gradePct: '0',
      majorGradePct: '0',
      setbackFt: '14.5',
      laneWidthFt: '12',
      medianWidthFt: '0',
      obsLeftX: '',
      obsLeftY: '',
      obsRightX: '',
      obsRightY: ''
    },
    dsd: {
      speed: '40',
      area: 'rural',
      prt: '3.0',
      activity: 'right_in',
      speedReductionPct: '20',
      decelRate: '7.2'
    },
    turnLeft: {
      approach: '',
      lanes: '2',
      speed: '30',
      share: '12.3',
      advance: '236',
      oppose: '200',
      leftTurns: '29',
      turnTime: '3.0',
      gap: '5.0',
      clear: '1.9'
    },
    turnRight: {
      approach: '',
      lanes: '2',
      speed: '30',
      volume: '229',
      turns: '29'
    },
    geom: {
      speed: '30',
      turnVolume: '29',
      controlType: 'unsignalized',
      cycleSec: '90',
      vehLengthFt: '25',
      bayWidthFt: '12',
      taperFt: '50'
    }
  };

  const HAINES_CITY_EXAMPLE = {
    project: {
      title: 'Haines City Kingdom Hall — Driveway Sight & Turn-Lane Study',
      location: 'Baker Ave E & Project Driveway, Haines City, FL',
      jurisdiction: 'FDOT FDM 212.11 / Polk TPO / Haines City',
      analyst: 'RSN',
      date: '2026-09-04'
    },
    isd: {
      speed: '30', vehicle: 'passenger', majorLanes: '2', lanesCrossed: '2',
      gradePct: '0', majorGradePct: '0', setbackFt: '14.5', laneWidthFt: '12', medianWidthFt: '0',
      obsLeftX: '120', obsLeftY: '16', obsRightX: '140', obsRightY: '18'
    },
    dsd: { speed: '30', area: 'suburban', prt: '6.0', activity: 'right_in', speedReductionPct: '20', decelRate: '7.2' },
    turnLeft: { approach: 'EB Baker Ave E (2027 Total)', lanes: '2', speed: '30', share: '12.3', advance: '236', oppose: '200', leftTurns: '29', turnTime: '3.0', gap: '5.0', clear: '1.9' },
    turnRight: { approach: 'WB Baker Ave E (2027 Total)', lanes: '2', speed: '30', volume: '229', turns: '29' },
    geom: { speed: '30', turnVolume: '29', controlType: 'unsignalized', cycleSec: '90', vehLengthFt: '25', bayWidthFt: '12', taperFt: '50' }
  };

  let appState = structuredClone(DEFAULT_STATE);

  function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function fmt(n, d = 1) {
    return Number.isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d }) : '—';
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
      const el = $('storage-status');
      if (el) el.textContent = 'Saved in this browser.';
    } catch (_) { /* ignore storage quota errors */ }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) restoreSnapshot(JSON.parse(raw));
    } catch (_) { /* ignore */ }
  }

  function snapshot() {
    return { format: 'rsn-sight-turn-study', version: 1, savedAt: new Date().toISOString(), data: structuredClone(appState) };
  }

  function restoreSnapshot(snap) {
    const src = snap?.data || snap;
    if (!src || typeof src !== 'object') return;
    for (const sec of Object.keys(DEFAULT_STATE)) {
      if (src[sec] && typeof src[sec] === 'object') {
        appState[sec] = { ...DEFAULT_STATE[sec], ...src[sec] };
      }
    }
  }

  function syncInputsFromState() {
    document.querySelectorAll('[data-bind]').forEach(el => {
      const [sec, key] = el.dataset.bind.split('.');
      if (appState[sec] && key in appState[sec]) {
        el.value = appState[sec][key];
      }
    });
  }

  function computeAll() {
    const isd = window.SightEngine.computeISD(appState.isd);
    const obsLeft = isd.valid ? window.SightEngine.checkSightObstruction(isd.aLeftLook, isd.bLeftLook, appState.isd.obsLeftX, appState.isd.obsLeftY) : { applicable: false };
    const obsRight = isd.valid ? window.SightEngine.checkSightObstruction(isd.aRightLook, isd.bRightLook, appState.isd.obsRightX, appState.isd.obsRightY) : { applicable: false };
    const dsd = window.SightEngine.computeDSD(appState.dsd);
    const leftTurn = window.TurnEngine.evaluateLeftTurn(appState.turnLeft);
    const rightTurn = window.TurnEngine.evaluateRightTurn(appState.turnRight);
    const geom = window.TurnEngine.computeTurnGeometry(appState.geom);
    return { isd, obsLeft, obsRight, dsd, leftTurn, rightTurn, geom };
  }

  function renderResults() {
    const res = computeAll();
    const { isd, obsLeft, obsRight, dsd, leftTurn, rightTurn, geom } = res;

    // Hero metrics
    $('hero-project').textContent = appState.project.title || 'Untitled study';
    $('hero-isd').textContent = isd.valid ? `${fmt(isd.isdLeft, 0)} / ${fmt(isd.isdRight, 0)} ft` : '—';
    const turnBadge = [
      leftTurn.complete ? (leftTurn.warranted ? 'LT Req' : 'LT No') : 'LT —',
      rightTurn.complete ? (rightTurn.warranted ? 'RT Req' : 'RT No') : 'RT —'
    ].join(' · ');
    $('hero-turns').textContent = turnBadge;

    // ISD outputs
    if (isd.valid) {
      $('isd-results').innerHTML = `
        <div class="metric-strip">
          <div><span>Left-Turn ISD (Case B1)</span><strong>${fmt(isd.isdLeft, 1)} ft</strong><small>t<sub>g</sub> = ${fmt(isd.tgLeft, 2)} s</small></div>
          <div><span>Right-Turn ISD (Case B2)</span><strong>${fmt(isd.isdRight, 1)} ft</strong><small>t<sub>g</sub> = ${fmt(isd.tgRight, 2)} s</small></div>
          <div><span>Crossing ISD (Case B3)</span><strong>${fmt(isd.isdCross, 1)} ft</strong><small>t<sub>g</sub> = ${fmt(isd.tgCross, 2)} s</small></div>
          <div><span>Stopping SD (SSD ref)</span><strong>${fmt(isd.ssd, 1)} ft</strong><small>t = 2.5 s, a = 11.2 ft/s²</small></div>
        </div>
        <p class="small muted">Triangle minor-road vertices: Left-looking <strong>a = ${fmt(isd.aLeftLook, 1)} ft</strong> (b = ${fmt(isd.bLeftLook, 0)} ft) · Right-looking <strong>a = ${fmt(isd.aRightLook, 1)} ft</strong> (b = ${fmt(isd.bRightLook, 0)} ft).</p>
      `;
    } else {
      $('isd-results').innerHTML = `<p class="screen-result">${esc(isd.error)}</p>`;
    }

    // Obstruction status
    const obsMsgs = [];
    if (obsLeft.applicable) {
      obsMsgs.push(`Left-looking: ${obsLeft.obstructed ? `OBSTRUCTED (avail ≈ ${fmt(obsLeft.availableMajorDist, 0)} ft vs ${fmt(isd.bLeftLook, 0)} ft req; need y ≥ ${fmt(isd.aLeftLook * (1 - Number(appState.isd.obsLeftX) / isd.bLeftLook), 1)} ft)` : `CLEAR (+${fmt(obsLeft.clearanceFt, 1)} ft margin)`}`);
    }
    if (obsRight.applicable) {
      obsMsgs.push(`Right-looking: ${obsRight.obstructed ? `OBSTRUCTED (avail ≈ ${fmt(obsRight.availableMajorDist, 0)} ft vs ${fmt(isd.bRightLook, 0)} ft req; need y ≥ ${fmt(isd.aRightLook * (1 - Number(appState.isd.obsRightX) / isd.bRightLook), 1)} ft)` : `CLEAR (+${fmt(obsRight.clearanceFt, 1)} ft margin)`}`);
    }
    const obsEl = $('isd-obstruction-status');
    obsEl.textContent = obsMsgs.length ? obsMsgs.join(' · ') : 'Enter optional obstruction offsets (x, y) to test sight-triangle clearance.';
    obsEl.classList.toggle('met', obsLeft.obstructed || obsRight.obstructed);

    // Sight triangle SVG
    $('diag-sight').innerHTML = window.SightTurnDiagrams.sightTriangleSvg(
      isd,
      obsLeft.applicable ? { ...obsLeft, x: appState.isd.obsLeftX, y: appState.isd.obsLeftY } : null,
      obsRight.applicable ? { ...obsRight, x: appState.isd.obsRightX, y: appState.isd.obsRightY } : null
    );

    // DSD outputs
    if (dsd.valid) {
      $('dsd-results').innerHTML = `
        <div class="metric-strip">
          <div><span>Perception-Reaction (d<sub>PRT</sub>)</span><strong>${fmt(dsd.dPRT, 1)} ft</strong><small>PRT = ${fmt(dsd.prt, 1)} s</small></div>
          <div><span>Slowing Distance (d<sub>Slow</sub>)</span><strong>${fmt(dsd.dSlow, 1)} ft</strong><small>${fmt(dsd.speedReductionPct, 0)}% drop @ ${fmt(dsd.decelRate, 1)} ft/s²</small></div>
          <div><span>Total Decision SD (DSD)</span><strong>${fmt(dsd.totalDSD, 1)} ft</strong><small>TRB Access Mgmt Eq. 3-5</small></div>
        </div>
      `;
    } else {
      $('dsd-results').innerHTML = `<p class="screen-result">${esc(dsd.error)}</p>`;
    }

    // Turn-lane 2-lane vs 4-lane input visibility
    const ltIs4 = appState.turnLeft.lanes === '4';
    document.querySelectorAll('.lt-2lane-only').forEach(el => { el.hidden = ltIs4; });
    document.querySelectorAll('.lt-4lane-only').forEach(el => { el.hidden = !ltIs4; });

    // Turn-lane results + SVGs
    const ltBox = $('turn-result-left');
    ltBox.textContent = [leftTurn.status, Number.isFinite(leftTurn.limit) ? `${leftTurn.metricLabel}: ${fmt(leftTurn.limit, 1)} veh/h` : '', leftTurn.note].filter(Boolean).join(' · ');
    ltBox.classList.toggle('met', !!leftTurn.warranted);
    $('turn-svg-left').innerHTML = window.SightTurnDiagrams.turnWarrantSvg('left', leftTurn);

    const rtBox = $('turn-result-right');
    rtBox.textContent = [rightTurn.status, Number.isFinite(rightTurn.limit) ? `${rightTurn.metricLabel}: ${fmt(rightTurn.limit, 1)} veh/h` : '', rightTurn.note].filter(Boolean).join(' · ');
    rtBox.classList.toggle('met', !!rightTurn.warranted);
    $('turn-svg-right').innerHTML = window.SightTurnDiagrams.turnWarrantSvg('right', rightTurn);

    // Turn-lane geometry
    $('geom-cycle-wrap').hidden = appState.geom.controlType !== 'signal';
    $('geom-results').innerHTML = `
      <div class="metric-strip">
        <div><span>Approach Taper</span><strong>${fmt(geom.taperFt, 0)} ft</strong><small>Width ${fmt(geom.bayWidthFt, 0)} ft</small></div>
        <div><span>Deceleration</span><strong>${fmt(geom.decelOnlyFt, 0)} ft</strong><small>${geom.speed} mph (FDOT FDM 212)</small></div>
        <div><span>Queue Storage</span><strong>${fmt(geom.storageFt, 0)} ft</strong><small>${geom.designQueueVeh} veh @ ${geom.vehLengthFt} ft</small></div>
        <div><span>Total Bay Length</span><strong>${fmt(geom.totalLengthFt, 0)} ft</strong><small>Taper + Decel + Storage</small></div>
      </div>
    `;
    $('diag-geom').innerHTML = window.SightTurnDiagrams.turnGeometrySvg(geom);

    renderSummary(res);
  }

  function buildSummaryMarkdown(res) {
    const p = appState.project;
    const { isd, obsLeft, obsRight, dsd, leftTurn, rightTurn, geom } = res;
    const lines = [
      `# Sight Distance & Turning Lane Analysis Summary`,
      `- **Project:** ${p.title || 'Untitled study'}`,
      `- **Location:** ${p.location || '—'}`,
      `- **Jurisdiction / Basis:** ${p.jurisdiction || '—'}`,
      `- **Analyst / Date:** ${p.analyst || '—'} · ${p.date || '—'}`,
      ``,
      `## 1. Intersection Sight Distance (AASHTO / FDOT FDM 212.11)`,
      isd.valid
        ? `- **Design Speed:** ${isd.speed} mph · **Design Vehicle:** ${isd.vehicleLabel} · **Lanes Crossed:** ${isd.lanesCrossed} · **Grade:** ${isd.gradePct}%`
        : `- ${isd.error}`,
      isd.valid ? `- **Left-Turn ISD (Case B1):** ${fmt(isd.isdLeft, 1)} ft (t_g = ${fmt(isd.tgLeft, 2)} s)` : '',
      isd.valid ? `- **Right-Turn ISD (Case B2):** ${fmt(isd.isdRight, 1)} ft (t_g = ${fmt(isd.tgRight, 2)} s)` : '',
      isd.valid ? `- **Crossing ISD (Case B3):** ${fmt(isd.isdCross, 1)} ft (t_g = ${fmt(isd.tgCross, 2)} s)` : '',
      isd.valid ? `- **Stopping Sight Distance (SSD ref):** ${fmt(isd.ssd, 1)} ft` : '',
      obsLeft.applicable ? `- **Left-Looking Obstruction Check:** ${obsLeft.obstructed ? 'OBSTRUCTED' : 'CLEAR'} (avail ≈ ${fmt(obsLeft.availableMajorDist, 0)} ft)` : '',
      obsRight.applicable ? `- **Right-Looking Obstruction Check:** ${obsRight.obstructed ? 'OBSTRUCTED' : 'CLEAR'} (avail ≈ ${fmt(obsRight.availableMajorDist, 0)} ft)` : '',
      ``,
      `## 2. Decision Sight Distance (TRB Access Management)`,
      dsd.valid ? `- **Total DSD:** ${fmt(dsd.totalDSD, 1)} ft (d_PRT = ${fmt(dsd.dPRT, 1)} ft + d_Slow = ${fmt(dsd.dSlow, 1)} ft)` : `- ${dsd.error}`,
      ``,
      `## 3. Turn-Lane Warrant Screening (NCHRP Report 457)`,
      `- **Left-Turn Bay (${leftTurn.lanes || appState.turnLeft.lanes}-Lane):** ${leftTurn.status}${Number.isFinite(leftTurn.limit) ? ` (Observed ${fmt(leftTurn.actual, 1)} vs Limit ${fmt(leftTurn.limit, 1)} veh/h)` : ''}`,
      `- **Right-Turn Bay (${rightTurn.lanes || appState.turnRight.lanes}-Lane):** ${rightTurn.status}${Number.isFinite(rightTurn.limit) ? ` (Observed ${fmt(rightTurn.actual, 1)} vs Limit ${fmt(rightTurn.limit, 1)} veh/h)` : ''}`,
      ``,
      `## 4. Turn-Lane Geometry Sizing (FDOT FDM 212 / AASHTO)`,
      `- **Recommended Bay Length:** ${fmt(geom.totalLengthFt, 0)} ft total (${fmt(geom.taperFt, 0)} ft taper + ${fmt(geom.decelOnlyFt, 0)} ft decel + ${fmt(geom.storageFt, 0)} ft storage for ${geom.designQueueVeh} veh)`
    ];
    return lines.filter(l => l !== '').join('\n');
  }

  function renderSummary(res) {
    const { isd, dsd, leftTurn, rightTurn, geom } = res;
    $('summary-body').innerHTML = `
      <table class="summary-table">
        <thead><tr><th>Analysis Module</th><th>Key Inputs</th><th>Result / Threshold</th></tr></thead>
        <tbody>
          <tr><td><strong>Intersection Sight Distance</strong></td><td>${isd.valid ? `${isd.speed} mph · ${esc(isd.vehicleLabel)} · ${isd.lanesCrossed} lanes` : '—'}</td><td>${isd.valid ? `LT ${fmt(isd.isdLeft, 1)} ft · RT ${fmt(isd.isdRight, 1)} ft · SSD ${fmt(isd.ssd, 1)} ft` : 'Pending'}</td></tr>
          <tr><td><strong>Decision Sight Distance</strong></td><td>${dsd.valid ? `${dsd.speed} mph · PRT ${fmt(dsd.prt, 1)} s · ${dsd.speedReductionPct}% drop` : '—'}</td><td>${dsd.valid ? `${fmt(dsd.totalDSD, 1)} ft (${fmt(dsd.dPRT, 1)} + ${fmt(dsd.dSlow, 1)})` : 'Pending'}</td></tr>
          <tr><td><strong>Left-Turn Warrant (NCHRP 457)</strong></td><td>${appState.turnLeft.lanes}-lane · VA ${appState.turnLeft.advance} · VO ${appState.turnLeft.oppose}</td><td><strong>${esc(leftTurn.status)}</strong>${Number.isFinite(leftTurn.limit) ? ` (limit ${fmt(leftTurn.limit, 1)})` : ''}</td></tr>
          <tr><td><strong>Right-Turn Warrant (NCHRP 457)</strong></td><td>${appState.turnRight.lanes}-lane · V ${appState.turnRight.volume} · RT ${appState.turnRight.turns}</td><td><strong>${esc(rightTurn.status)}</strong>${Number.isFinite(rightTurn.limit) ? ` (limit ${fmt(rightTurn.limit, 1)})` : ''}</td></tr>
          <tr><td><strong>Turn-Lane Bay Sizing</strong></td><td>${geom.speed} mph · ${geom.turnVolume} veh/h · ${geom.controlType}</td><td><strong>${fmt(geom.totalLengthFt, 0)} ft</strong> (${geom.taperFt} + ${geom.decelOnlyFt} + ${geom.storageFt} ft)</td></tr>
        </tbody>
      </table>
    `;
  }

  function downloadFile(content, mime, filename) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function wireEvents() {
    document.addEventListener('input', e => {
      const bind = e.target?.dataset?.bind;
      if (!bind) return;
      const [sec, key] = bind.split('.');
      if (!appState[sec]) return;
      appState[sec][key] = e.target.value;

      if (bind === 'dsd.area' && window.SightEngine.DSD_PRT_PRESETS[e.target.value]) {
        appState.dsd.prt = String(window.SightEngine.DSD_PRT_PRESETS[e.target.value].prt);
        syncInputsFromState();
      }
      if (bind === 'dsd.activity' && window.SightEngine.DSD_ACTIVITY_PRESETS[e.target.value]) {
        appState.dsd.speedReductionPct = String(window.SightEngine.DSD_ACTIVITY_PRESETS[e.target.value].pct);
        syncInputsFromState();
      }
      if (bind === 'dsd.speed') {
        appState.dsd.decelRate = String(window.SightEngine.recommendedDecelRate(Number(e.target.value) || 40));
        syncInputsFromState();
      }
      renderResults();
      saveState();
    });

    $('load-haines-example')?.addEventListener('click', () => {
      appState = structuredClone(HAINES_CITY_EXAMPLE);
      syncInputsFromState();
      renderResults();
      saveState();
    });

    $('new-study')?.addEventListener('click', () => {
      appState = structuredClone(DEFAULT_STATE);
      syncInputsFromState();
      renderResults();
      saveState();
    });

    $('save-project')?.addEventListener('click', () => {
      const slug = (appState.project.title || 'sight-turn-study').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      downloadFile(JSON.stringify(snapshot(), null, 2), 'application/json', `${slug}.sight-turn.json`);
    });

    $('open-project')?.addEventListener('click', () => $('project-file').click());
    $('project-file')?.addEventListener('change', async e => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        restoreSnapshot(JSON.parse(await file.text()));
        syncInputsFromState();
        renderResults();
        saveState();
      } catch (err) {
        alert('Could not read study file: ' + err.message);
      }
      e.target.value = '';
    });

    document.querySelectorAll('[data-download-svg]').forEach(btn => {
      btn.addEventListener('click', () => {
        const svg = document.getElementById(btn.dataset.downloadSvg)?.querySelector('svg');
        if (svg) downloadFile(svg.outerHTML, 'image/svg+xml', `${btn.dataset.downloadSvg}.svg`);
      });
    });

    $('summary-copy')?.addEventListener('click', async () => {
      const md = buildSummaryMarkdown(computeAll());
      await navigator.clipboard?.writeText(md);
      $('summary-status').textContent = 'Summary copied to clipboard.';
    });
    $('summary-download')?.addEventListener('click', () => {
      downloadFile(buildSummaryMarkdown(computeAll()), 'text/markdown', 'sight-turn-summary.md');
    });
    $('summary-print')?.addEventListener('click', () => window.print());
  }

  window.SightTurnApp = {
    snapshot,
    restoreSnapshot,
    syncInputsFromState,
    renderResults,
    computeAll,
    getState: () => appState
  };

  document.addEventListener('DOMContentLoaded', () => {
    loadState();
    syncInputsFromState();
    wireEvents();
    renderResults();
  });
})();
