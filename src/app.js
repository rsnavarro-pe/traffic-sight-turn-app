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
      accessType: 'full',
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

  const FOUR_LANE_EXAMPLE = {
    project: {
      title: '4-Lane Divided Suburban Arterial — Commercial Driveway',
      location: 'US-27 & Commercial Access, Polk County, FL',
      jurisdiction: 'FDOT FDM 212.11 / NCHRP 457',
      analyst: 'RSN',
      date: '2026-11-23'
    },
    isd: {
      speed: '45', vehicle: 'single_unit', majorLanes: '4', lanesCrossed: '3',
      gradePct: '2', majorGradePct: '3', setbackFt: '14.5', laneWidthFt: '12', medianWidthFt: '22',
      obsLeftX: '220', obsLeftY: '18', obsRightX: '260', obsRightY: '24'
    },
    dsd: { speed: '45', area: 'suburban', prt: '6.0', activity: 'right_in', speedReductionPct: '20', decelRate: '9.9' },
    turnLeft: { approach: 'NB US-27 Left Turn', lanes: '4', speed: '45', share: '9.2', advance: '650', oppose: '720', leftTurns: '60', turnTime: '4.0', gap: '6.0', clear: '1.9' },
    turnRight: { approach: 'SB US-27 Right Turn', lanes: '4', speed: '45', volume: '720', turns: '85' },
    geom: { speed: '45', turnVolume: '85', controlType: 'unsignalized', cycleSec: '90', vehLengthFt: '40', bayWidthFt: '12', taperFt: '50' }
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
          <div><span>Stopping SD (Controlling)</span><strong>${fmt(isd.ssd, 1)} ft</strong><small>${Math.abs(isd.ssdDowngrade - isd.ssdUpgrade) > 0.5 ? `Down ${fmt(isd.ssdDowngrade, 0)} / Up ${fmt(isd.ssdUpgrade, 0)} ft` : 't = 2.5 s, a = 11.2 ft/s²'}</small></div>
        </div>
        <p class="small muted">Triangle minor-road vertices: Left-looking <strong>a = ${fmt(isd.aLeftLook, 1)} ft</strong> (b = ${fmt(isd.bLeftLook, 0)} ft)${isd.bRightLook > 0 ? ` · Right-looking <strong>a = ${fmt(isd.aRightLook, 1)} ft</strong> (b = ${fmt(isd.bRightLook, 0)} ft)` : ' · Right-in/right-out (Case B2 only)'}.</p>
        ${isd.twoStageEligible ? `<p class="small muted"><strong>Two-stage crossing eligible</strong> (median ${fmt(isd.medianWidthFt, 0)} ft &ge; ${isd.medianStoreReqFt} ft ${esc(isd.vehicleLabel)}): Stage 1 (to median) = <strong>${fmt(isd.isdStage1, 1)} ft</strong> · Stage 2 (from median) = <strong>${fmt(isd.isdStage2, 1)} ft</strong>.</p>` : ''}
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
    $('turn-svg-left').innerHTML = window.SightTurnDiagrams.turnWarrantSvg('left', leftTurn, appState.turnLeft);

    const rtBox = $('turn-result-right');
    rtBox.textContent = [rightTurn.status, Number.isFinite(rightTurn.limit) ? `${rightTurn.metricLabel}: ${fmt(rightTurn.limit, 1)} veh/h` : '', rightTurn.note].filter(Boolean).join(' · ');
    rtBox.classList.toggle('met', !!rightTurn.warranted);
    $('turn-svg-right').innerHTML = window.SightTurnDiagrams.turnWarrantSvg('right', rightTurn, appState.turnRight);

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
      if (bind === 'turnLeft.lanes') {
        const is4 = e.target.value === '4';
        appState.turnLeft.turnTime = is4 ? '4.0' : '3.0';
        appState.turnLeft.gap = is4 ? '6.0' : '5.0';
        syncInputsFromState();
      }
      if (bind === 'turnLeft.share' || bind === 'turnLeft.advance') {
        const adv = Number(appState.turnLeft.advance);
        const pct = Number(appState.turnLeft.share);
        if (Number.isFinite(adv) && adv > 0 && Number.isFinite(pct) && pct >= 0) {
          appState.turnLeft.leftTurns = String(Math.round(adv * pct / 100 * 10) / 10);
          syncInputsFromState();
        }
      }
      if (bind === 'turnLeft.leftTurns') {
        const adv = Number(appState.turnLeft.advance);
        const vl = Number(appState.turnLeft.leftTurns);
        if (Number.isFinite(adv) && adv > 0 && Number.isFinite(vl) && vl >= 0 && vl < adv) {
          appState.turnLeft.share = String((vl / adv * 100).toFixed(2));
          syncInputsFromState();
        }
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

    $('load-4lane-example')?.addEventListener('click', () => {
      appState = structuredClone(FOUR_LANE_EXAMPLE);
      syncInputsFromState();
      renderResults();
      saveState();
    });

    $('sync-geom-left')?.addEventListener('click', () => {
      appState.geom.speed = appState.turnLeft.speed || appState.isd.speed;
      const vl = Number(appState.turnLeft.leftTurns);
      const adv = Number(appState.turnLeft.advance);
      const pct = Number(appState.turnLeft.share);
      appState.geom.turnVolume = Number.isFinite(vl) && vl > 0 ? String(Math.round(vl)) : (Number.isFinite(adv) && Number.isFinite(pct) ? String(Math.round(adv * pct / 100)) : appState.geom.turnVolume);
      syncInputsFromState();
      renderResults();
      saveState();
    });

    $('sync-geom-right')?.addEventListener('click', () => {
      appState.geom.speed = appState.turnRight.speed || appState.isd.speed;
      appState.geom.turnVolume = appState.turnRight.turns || appState.geom.turnVolume;
      syncInputsFromState();
      renderResults();
      saveState();
    });

    $('tmc-csv-btn')?.addEventListener('click', () => $('tmc-csv-file').click());
    $('tmc-csv-file')?.addEventListener('change', async e => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const lines = (await file.text()).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        const hdr = lines[0].split(',').map(h => h.trim().toUpperCase());
        const idx = name => hdr.findIndex(h => h === name || h.endsWith(name));
        const cols = ['EBL','EBT','EBR','WBL','WBT','WBR','NBL','NBT','NBR','SBL','SBT','SBR'];
        const totals = Object.fromEntries(cols.map(c => [c, 0]));
        const rows = lines.slice(1).map(l => l.split(',').map(v => v.trim()));
        // Find peak 4 consecutive rows if >= 4 rows, else sum all rows
        const win = rows.length >= 4 ? 4 : rows.length;
        let bestSum = -1, bestStart = 0;
        for (let i = 0; i <= rows.length - win; i++) {
          let s = 0;
          for (let j = 0; j < win; j++) cols.forEach(c => { const k = idx(c); if (k >= 0) s += Number(rows[i + j][k]) || 0; });
          if (s > bestSum) { bestSum = s; bestStart = i; }
        }
        for (let j = 0; j < win; j++) cols.forEach(c => { const k = idx(c); if (k >= 0) totals[c] += Number(rows[bestStart + j][k]) || 0; });
        const dir = $('tmc-major-dir')?.value || 'EB';
        const adv = dir === 'EB' ? totals.EBL + totals.EBT + totals.EBR : dir === 'WB' ? totals.WBL + totals.WBT + totals.WBR : dir === 'NB' ? totals.NBL + totals.NBT + totals.NBR : totals.SBL + totals.SBT + totals.SBR;
        const opp = dir === 'EB' ? totals.WBL + totals.WBT + totals.WBR : dir === 'WB' ? totals.EBL + totals.EBT + totals.EBR : dir === 'NB' ? totals.SBL + totals.SBT + totals.SBR : totals.NBL + totals.NBT + totals.NBR;
        const lt = totals[dir + 'L'] || 0;
        const rt = totals[dir + 'R'] || 0;
        appState.turnLeft.advance = String(adv);
        appState.turnLeft.oppose = String(opp);
        appState.turnLeft.leftTurns = String(lt);
        if (adv > 0) appState.turnLeft.share = String((lt / adv * 100).toFixed(2));
        appState.turnRight.volume = String(adv);
        appState.turnRight.turns = String(rt);
        syncInputsFromState();
        renderResults();
        saveState();
        $('tmc-csv-status').textContent = `Imported peak-hour ${dir} approach: Advancing ${adv} veh/h (LT ${lt}, RT ${rt}), Opposing ${opp} veh/h.`;
      } catch (err) {
        $('tmc-csv-status').textContent = 'Could not parse CSV: ' + err.message;
      }
      e.target.value = '';
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
      $('summary-status').textContent = 'Markdown summary copied to clipboard.';
    });
    $('summary-copy-html')?.addEventListener('click', async () => {
      const html = $('summary-body').innerHTML;
      if (navigator.clipboard?.write && window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([$('summary-body').innerText], { type: 'text/plain' }) })]);
      } else {
        await navigator.clipboard?.writeText(html);
      }
      $('summary-status').textContent = 'Formatted summary table copied for Word / Docs.';
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
