// =========================================================================
// BRANDING, ERROR GUARD & REFERENCE WORKBOOK SELF-CHECKS
// =========================================================================
(function () {
  'use strict';

  const BRAND = { name: 'RSN', product: 'Sight Distance & Turning Lane Analysis' };
  const APP_VERSION = '1.0 · 22 Nov 2026';

  const product = document.getElementById('brand-product');
  if (product) product.textContent = BRAND.product;
  document.title = `${BRAND.name} · ${BRAND.product}`;
  const info = document.getElementById('build-info');
  if (info) info.textContent = `Version ${APP_VERSION}. AASHTO / FDOT FDM 212.11 · NCHRP Report 457. All calculations run locally.`;

  let errorShown = false;
  function showFailure(message) {
    const box = document.getElementById('error-banner');
    if (!box || errorShown) return;
    errorShown = true;
    box.hidden = false;
    box.innerHTML = `<strong>Something went wrong.</strong> Detail: ${String(message).slice(0, 160)} <button type="button" class="btn" id="error-dismiss">Dismiss</button>`;
    document.getElementById('error-dismiss')?.addEventListener('click', () => { box.hidden = true; errorShown = false; });
  }
  window.addEventListener('error', e => showFailure(e.message || 'Script error'));
  window.addEventListener('unhandledrejection', e => showFailure(e.reason?.message || e.reason || 'Unhandled error'));

  function setupNavHighlight() {
    const links = [...document.querySelectorAll('.workspace-nav a')];
    const targets = links.map(l => document.querySelector(l.getAttribute('href'))).filter(Boolean);
    links.forEach(link => {
      link.addEventListener('click', () => {
        links.forEach(l => l.classList.toggle('is-current', l === link));
      });
    });
    if (!('IntersectionObserver' in window) || !targets.length) return;
    const obs = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        links.forEach(l => l.classList.toggle('is-current', l.getAttribute('href') === '#' + entry.target.id));
      }
    }, { rootMargin: '-20% 0px -70% 0px' });
    targets.forEach(t => obs.observe(t));
  }

  function runSelfChecks() {
    const results = [];
    const check = (name, ok, detail = '') => results.push({ name, ok: !!ok, detail });

    // 1. ISD Minor Stop (matches ISD_Minor_Stop.xlsx: V=30, Passenger Car, 2 lanes, <=3% grade)
    const isd = window.SightEngine.computeISD({ speed: 30, vehicle: 'passenger', majorLanes: 2, lanesCrossed: 2, gradePct: 0, setbackFt: 14.5, laneWidthFt: 12, medianWidthFt: 0 });
    check('ISD Minor Stop Case B1/B2 matches Excel (352.8 / 286.65 ft)', isd.valid && Math.abs(isd.isdLeft - 352.8) < 0.05 && Math.abs(isd.isdRight - 286.65) < 0.05, `LT=${isd.isdLeft.toFixed(2)} ft, RT=${isd.isdRight.toFixed(2)} ft`);

    // 2. Decision Sight Distance (matches Decision_Sight_Distance.xlsx: V=40, PRT=3, 20%, decel=7.2)
    const dsd = window.SightEngine.computeDSD({ speed: 40, prt: 3, speedReductionPct: 20, decelRate: 7.2 });
    check('Decision Sight Distance matches Excel (185.56 ft)', dsd.valid && Math.abs(dsd.totalDSD - 185.5556) < 0.1, `DSD=${dsd.totalDSD.toFixed(2)} ft`);

    // 3. NCHRP 457 Left-Turn 2-Lane (matches NCHRP_457_Left_Turn.xlsx: V=30, VA=236, VO=200, share=12.3%)
    const lt2 = window.TurnEngine.evaluateLeftTurn({ lanes: 2, speed: 30, advance: 236, oppose: 200, share: 12.3 });
    check('NCHRP 457 Left-Turn 2-lane matches Excel (~467.4 veh/h, Not Warranted)', lt2.complete && !lt2.warranted && Math.abs(lt2.limit - 467.39) < 1.5, `Limit=${lt2.limit.toFixed(1)} veh/h`);

    // 4. NCHRP 457 Left-Turn 4-Lane (matches NCHRP_457_Left_Turn.xlsx 4-lane sheet: VL=15, VA=390, VO=400)
    const lt4 = window.TurnEngine.evaluateLeftTurn({ lanes: 4, advance: 390, oppose: 400, leftTurns: 15 });
    check('NCHRP 457 Left-Turn 4-lane matches Excel (~18.1 veh/h, Not Warranted)', lt4.complete && !lt4.warranted && Math.abs(lt4.limit - 18.09) < 0.1, `Limit=${lt4.limit.toFixed(2)} veh/h`);

    // 5. NCHRP 457 Right-Turn 2-Lane (matches NCHRP_457_Right_Turn.xlsx: V=30, vol=229, turns=29)
    const rt2 = window.TurnEngine.evaluateRightTurn({ lanes: 2, speed: 30, volume: 229, turns: 29 });
    check('NCHRP 457 Right-Turn 2-lane matches Excel (Not Warranted)', rt2.complete && !rt2.warranted, `Limit=${rt2.limit.toFixed(1)} veh/h`);

    // 6. Sight-triangle obstruction geometry
    const obs = window.SightEngine.checkSightObstruction(20.5, 352.8, 100, 10);
    const clr = window.SightEngine.checkSightObstruction(20.5, 352.8, 100, 20);
    check('Sight-triangle obstruction geometry detects blocked vs clear', obs.obstructed === true && clr.obstructed === false, `y=10 blocked, y=20 clear`);

    // 7. JSON snapshot round-trip
    const snap = window.SightTurnApp.snapshot();
    const rt = JSON.parse(JSON.stringify(snap));
    check('Study snapshot JSON round-trip succeeds', rt.format === 'rsn-sight-turn-study', rt.format);

    return results;
  }

  function setupNavDrawer() {
    const toggle = document.getElementById('nav-toggle');
    const drawer = document.getElementById('nav-drawer');
    const closeBtn = document.getElementById('nav-close');
    const backdrop = document.getElementById('nav-backdrop');
    if (!toggle || !drawer) return;

    function setOpen(open) {
      drawer.classList.toggle('is-open', open);
      drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (backdrop) backdrop.hidden = !open;
      if (open) closeBtn?.focus();
    }

    toggle.addEventListener('click', () => setOpen(!drawer.classList.contains('is-open')));
    closeBtn?.addEventListener('click', () => { setOpen(false); toggle.focus(); });
    backdrop?.addEventListener('click', () => setOpen(false));
    drawer.querySelectorAll('.workspace-nav a').forEach(link => {
      link.addEventListener('click', () => setOpen(false));
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && drawer.classList.contains('is-open')) {
        setOpen(false);
        toggle.focus();
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    setupNavDrawer();
    setupNavHighlight();
    document.getElementById('run-selfcheck')?.addEventListener('click', () => {
      const results = runSelfChecks();
      const passed = results.filter(r => r.ok).length;
      document.getElementById('selfcheck-results').innerHTML =
        `<li class="${passed === results.length ? 'pass' : 'fail'}"><strong>${passed} of ${results.length} checks passed</strong></li>` +
        results.map(r => `<li class="${r.ok ? 'pass' : 'fail'}"><span aria-hidden="true">${r.ok ? '✓' : '✗'}</span> ${r.name} <span class="small muted">${r.detail}</span></li>`).join('');
    });
  });
})();
