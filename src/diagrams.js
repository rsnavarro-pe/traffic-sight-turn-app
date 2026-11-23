// =========================================================================
// SVG DIAGRAM GENERATORS — Sight Triangles, Turn-Lane Warrants & Geometry
// =========================================================================
(function (root) {
  'use strict';

  function esc(v) {
    return String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function fmt(n, d = 0) {
    return Number.isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d }) : '—';
  }

  /**
   * Plan-view Intersection Sight Distance Triangle SVG (AASHTO / FDOT FDM 212.11).
   */
  function sightTriangleSvg(isd, obsLeft, obsRight) {
    const W = 760, H = 360;
    if (!isd || !isd.valid) {
      return `<svg viewBox="0 0 ${W} ${H}" class="diagram-svg" role="img" aria-label="Sight distance triangle placeholder">
        <rect width="${W}" height="${H}" fill="#faf9f5" rx="6"/>
        <text x="${W / 2}" y="${H / 2}" text-anchor="middle" fill="#56585c" font-size="14">Enter valid design speed and geometry to draw the sight triangles.</text>
      </svg>`;
    }

    const cx = W / 2;
    const roadTop = 108;
    const lanes = Math.max(2, isd.majorLanes || 2);
    const lanePx = 18;
    const medianPx = isd.medianWidthFt > 0 ? Math.min(28, Math.max(10, isd.medianWidthFt * 0.9)) : 0;
    const roadH = lanes * lanePx + medianPx;
    const roadBot = roadTop + roadH;
    const minorW = 46;

    // Horizontal scale: fit max(bLeftLook, bRightLook) into ~320 px on each side
    const maxB = Math.max(isd.bLeftLook, isd.bRightLook, 200);
    const scaleX = 315 / maxB;
    // Vertical scale: exaggerate minor-road setback slightly so triangle is readable
    const scaleY = 2.1;

    const eyeX = cx - 8;
    const eyeY = roadBot + Math.min(72, Math.max(24, isd.setbackFt * scaleY));

    // Near-side approaching lane center (from left, traveling eastbound in bottom half)
    const nearLaneY = roadBot - lanePx * 0.5;
    // Far-side approaching lane center (from right, traveling westbound in top half)
    const farLaneY = roadTop + lanePx * 0.5;

    const leftTargetX = Math.max(22, eyeX - isd.bLeftLook * scaleX);
    const hasRight = isd.bRightLook > 0;
    const rightTargetX = hasRight ? Math.min(W - 22, eyeX + isd.bRightLook * scaleX) : eyeX;

    const leftColor = obsLeft?.obstructed ? '#b42318' : '#1f4e5f';
    const rightColor = obsRight?.obstructed ? '#b42318' : '#b36b00';

    let s = `<svg viewBox="0 0 ${W} ${H}" class="diagram-svg" role="img" aria-label="Intersection sight distance triangles for ${isd.speed} mph">`;
    s += `<defs>
      <marker id="sd-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,1 L9,5 L0,9 z" fill="#17181a"/>
      </marker>
    </defs>`;
    s += `<rect width="${W}" height="${H}" fill="#faf9f5" rx="6"/>`;

    // Major road & minor road pavement
    s += `<rect x="16" y="${roadTop}" width="${W - 32}" height="${roadH}" fill="#e6e2d6" stroke="#c8c4b8" stroke-width="1"/>`;
    s += `<rect x="${cx - minorW / 2}" y="${roadBot}" width="${minorW}" height="${H - roadBot - 16}" fill="#e6e2d6" stroke="#c8c4b8" stroke-width="1"/>`;

    // Centerline / median
    if (medianPx > 0) {
      const my = roadTop + (lanes / 2) * lanePx;
      s += `<rect x="16" y="${my}" width="${W - 32}" height="${medianPx}" fill="#d8d2c3" stroke="#b5ae9d" stroke-width="1"/>`;
      if (isd.twoStageEligible) {
        s += `<rect x="${cx - 14}" y="${my + 2}" width="28" height="${medianPx - 4}" rx="3" fill="#2b6e52" fill-opacity="0.22" stroke="#2b6e52" stroke-width="1.2" stroke-dasharray="3 2"/>`;
      }
    } else {
      const cyRoad = roadTop + roadH / 2;
      s += `<line x1="16" y1="${cyRoad}" x2="${W - 16}" y2="${cyRoad}" stroke="#b36b00" stroke-width="1.5" stroke-dasharray="10 6"/>`;
    }

    // Stop bar on minor road
    s += `<line x1="${cx - minorW / 2 + 2}" y1="${roadBot + 10}" x2="${cx}" y2="${roadBot + 10}" stroke="#17181a" stroke-width="3"/>`;

    // Left-looking sight triangle (shaded)
    s += `<polygon points="${eyeX},${eyeY} ${leftTargetX},${nearLaneY} ${eyeX},${nearLaneY}" fill="${leftColor}" fill-opacity="0.16" stroke="${leftColor}" stroke-width="2"/>`;
    // Right-looking sight triangle (shaded)
    if (hasRight) {
      s += `<polygon points="${eyeX},${eyeY} ${rightTargetX},${farLaneY} ${eyeX},${farLaneY}" fill="${rightColor}" fill-opacity="0.14" stroke="${rightColor}" stroke-width="2"/>`;
    }

    // Driver eye decision point
    s += `<circle cx="${eyeX}" cy="${eyeY}" r="5" fill="#17181a"/>`;
    s += `<text x="${eyeX + 10}" y="${eyeY + 4}" font-size="11" font-weight="600" fill="#17181a">Decision pt (${fmt(isd.setbackFt, 1)} ft setback)</text>`;

    // Approaching vehicle targets
    s += `<circle cx="${leftTargetX}" cy="${nearLaneY}" r="4.5" fill="${leftColor}"/>`;
    if (hasRight) s += `<circle cx="${rightTargetX}" cy="${farLaneY}" r="4.5" fill="${rightColor}"/>`;

    // Dimension callouts along top
    s += `<line x1="${leftTargetX}" y1="68" x2="${eyeX}" y2="68" stroke="${leftColor}" stroke-width="1.5" marker-start="url(#sd-arrow)" marker-end="url(#sd-arrow)"/>`;
    s += `<rect x="${(leftTargetX + eyeX) / 2 - 58}" y="52" width="116" height="20" rx="3" fill="#ffffff" stroke="${leftColor}" stroke-width="1"/>`;
    s += `<text x="${(leftTargetX + eyeX) / 2}" y="66" text-anchor="middle" font-size="11" font-weight="600" fill="${leftColor}">Left ISD: ${fmt(isd.bLeftLook, 0)} ft</text>`;

    if (hasRight) {
      s += `<line x1="${eyeX}" y1="38" x2="${rightTargetX}" y2="38" stroke="${rightColor}" stroke-width="1.5" marker-start="url(#sd-arrow)" marker-end="url(#sd-arrow)"/>`;
      s += `<rect x="${(eyeX + rightTargetX) / 2 - 60}" y="22" width="120" height="20" rx="3" fill="#ffffff" stroke="${rightColor}" stroke-width="1"/>`;
      s += `<text x="${(eyeX + rightTargetX) / 2}" y="36" text-anchor="middle" font-size="11" font-weight="600" fill="${rightColor}">Right ISD: ${fmt(isd.bRightLook, 0)} ft</text>`;
    }

    // Obstruction markers if provided
    if (obsLeft?.applicable) {
      const ox = Math.max(20, eyeX - Number(obsLeft.x) * scaleX);
      const oy = nearLaneY + Math.min(90, Number(obsLeft.y) * scaleY);
      const col = obsLeft.obstructed ? '#b42318' : '#2b6e52';
      s += `<rect x="${ox - 5}" y="${oy - 5}" width="10" height="10" fill="${col}" stroke="#fff" stroke-width="1.5"/>`;
      s += `<text x="${ox}" y="${oy + 16}" text-anchor="middle" font-size="10" font-weight="600" fill="${col}">Obs L (${obsLeft.obstructed ? 'BLOCKED' : 'CLEAR'})</text>`;
    }
    if (obsRight?.applicable) {
      const ox = Math.min(W - 20, eyeX + Number(obsRight.x) * scaleX);
      const oy = farLaneY + Math.min(110, Number(obsRight.y) * scaleY);
      const col = obsRight.obstructed ? '#b42318' : '#2b6e52';
      s += `<rect x="${ox - 5}" y="${oy - 5}" width="10" height="10" fill="${col}" stroke="#fff" stroke-width="1.5"/>`;
      s += `<text x="${ox}" y="${oy + 16}" text-anchor="middle" font-size="10" font-weight="600" fill="${col}">Obs R (${obsRight.obstructed ? 'BLOCKED' : 'CLEAR'})</text>`;
    }

    // Legend & SSD note
    s += `<text x="20" y="${H - 18}" font-size="11" fill="#56585c">Major road: ${lanes} lanes (${isd.speed} mph) · Design vehicle: ${esc(isd.vehicleLabel)} · SSD ref: ${fmt(isd.ssd, 0)} ft</text>`;
    // North arrow
    s += `<g transform="translate(${W - 34} ${H - 34})"><circle r="15" fill="#ffffff" stroke="#c8c4b8"/><path d="M0 -10 L4 5 L0 2 L-4 5 z" fill="#17181a"/><text y="13" text-anchor="middle" font-size="8" font-weight="600" fill="#56585c">N</text></g>`;
    s += `</svg>`;
    return s;
  }

  /**
   * Turn-lane warrant NCHRP 457 curve plot for Left or Right turn bay.
   */
  function turnWarrantSvg(side, res, inputs) {
    const W = 520, H = 220;
    const isLeft = side === 'left';
    if (!res || !res.complete) {
      return `<svg viewBox="0 0 ${W} ${H}" class="diagram-svg" role="img" aria-label="Turn lane warrant diagram">
        <rect width="${W}" height="${H}" fill="#faf9f5" rx="6"/>
        <text x="${W / 2}" y="${H / 2}" text-anchor="middle" fill="#56585c" font-size="13">${esc(res?.status || 'Enter volumes to evaluate warrant.')}</text>
      </svg>`;
    }

    const TE = typeof window !== 'undefined' ? window.TurnEngine : require('./turn-engine.js');
    const padL = 56, padR = 20, padT = 38, padB = 38;
    const pW = W - padL - padR, pH = H - padT - padB;
    const ptCol = res.warranted ? '#b42318' : '#2b6e52';

    let xLabel = '', yLabel = '', xMax = 1000, yMax = 100, ptX = 0, ptY = 0;
    const curvePts = [];

    if (isLeft && res.lanes === 2 && TE && inputs) {
      const sp = Number(inputs.speed) || 30, sh = (Number(inputs.share) || 10) / 100;
      const t1 = Number(inputs.turnTime) || 3, gc = Number(inputs.gap) || 5, te = Number(inputs.clear) || 1.9;
      ptX = Number(inputs.oppose) || 0;
      ptY = Number(inputs.advance) || 0;
      xMax = Math.max(800, Math.ceil(ptX / 200) * 200 + 200);
      for (let x = 0; x <= xMax; x += xMax / 40) {
        const y = TE.leftLimit2Lane(sp, sh, x, t1, gc, te);
        if (Number.isFinite(y)) curvePts.push([x, y]);
      }
      yMax = Math.max(800, Math.ceil(Math.max(ptY, res.limit || 0) * 1.2 / 200) * 200);
      xLabel = 'Opposing Volume V_O (veh/h)';
      yLabel = 'Advancing V_A';
    } else if (isLeft && res.lanes === 4 && TE && inputs) {
      const t1 = Number(inputs.turnTime) || 4, gc = Number(inputs.gap) || 6;
      ptX = Number(inputs.oppose) || 0;
      ptY = res.actual || 0;
      xMax = Math.max(1000, Math.ceil(ptX / 200) * 200 + 200);
      for (let x = 50; x <= xMax; x += xMax / 40) {
        const y = TE.leftLimit4Lane(x, t1, gc).limitVL;
        if (Number.isFinite(y)) curvePts.push([x, y]);
      }
      yMax = Math.max(80, Math.ceil(Math.max(ptY, res.limit || 0) * 1.25 / 20) * 20);
      xLabel = 'Opposing Volume V_O (veh/h)';
      yLabel = 'Left Turns V_L';
    } else if (!isLeft && TE && inputs) {
      const sp = Number(inputs.speed) || 30, lanes = res.lanes || 2;
      ptX = Number(inputs.volume) || 0;
      ptY = Number(inputs.turns) || 0;
      xMax = Math.max(1200, Math.ceil(ptX / 200) * 200 + 200);
      for (let x = 120; x <= xMax; x += xMax / 40) {
        const y = TE.rightLimit(sp, lanes, x);
        if (Number.isFinite(y) && y < 2000) curvePts.push([x, y]);
      }
      yMax = Math.max(100, Math.ceil(Math.max(ptY, Math.min(res.limit || 0, 500)) * 1.3 / 20) * 20);
      xLabel = 'Approach Volume (veh/h)';
      yLabel = 'Right Turns V_R';
    }

    const sx = x => padL + Math.min(1, Math.max(0, x / xMax)) * pW;
    const sy = y => padT + pH - Math.min(1, Math.max(0, y / yMax)) * pH;

    let s = `<svg viewBox="0 0 ${W} ${H}" class="diagram-svg" role="img" aria-label="${isLeft ? 'Left' : 'Right'}-turn NCHRP 457 warrant curve">`;
    s += `<rect width="${W}" height="${H}" fill="#faf9f5" rx="6"/>`;
    s += `<text x="${padL}" y="22" font-size="12.5" font-weight="600" fill="#17181a">${isLeft ? 'Left-Turn' : 'Right-Turn'} Warrant Curve (${res.lanes}-Lane) — ${esc(res.status)}</text>`;

    // Grid & axes
    for (let i = 0; i <= 4; i++) {
      const gx = padL + (pW * i) / 4, gy = padT + (pH * i) / 4;
      s += `<line x1="${gx}" y1="${padT}" x2="${gx}" y2="${padT + pH}" stroke="#e6e2d6" stroke-width="1"/>`;
      s += `<line x1="${padL}" y1="${gy}" x2="${padL + pW}" y2="${gy}" stroke="#e6e2d6" stroke-width="1"/>`;
      s += `<text x="${gx}" y="${padT + pH + 14}" text-anchor="middle" font-size="10" fill="#56585c">${Math.round((xMax * i) / 4)}</text>`;
      s += `<text x="${padL - 6}" y="${gy + 3}" text-anchor="end" font-size="10" fill="#56585c">${Math.round(yMax * (1 - i / 4))}</text>`;
    }
    s += `<rect x="${padL}" y="${padT}" width="${pW}" height="${pH}" fill="none" stroke="#c8c4b8" stroke-width="1"/>`;

    // Warrant curve
    if (curvePts.length > 1) {
      const d = curvePts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${sx(x).toFixed(1)},${sy(Math.min(y, yMax)).toFixed(1)}`).join(' ');
      s += `<path d="${d}" fill="none" stroke="#1f4e5f" stroke-width="2.2"/>`;
    }

    // Operating point
    const cx = sx(ptX), cy = sy(ptY);
    s += `<circle cx="${cx}" cy="${cy}" r="5.5" fill="${ptCol}" stroke="#ffffff" stroke-width="1.5"/>`;
    s += `<text x="${Math.min(cx + 8, W - 120)}" y="${Math.max(cy - 8, padT + 12)}" font-size="10.5" font-weight="600" fill="${ptCol}">Site (${fmt(ptX, 0)}, ${fmt(ptY, 0)})</text>`;

    s += `<text x="${padL + pW / 2}" y="${H - 6}" text-anchor="middle" font-size="10.5" fill="#56585c">${xLabel}</text>`;
    s += `<text x="14" y="${padT + pH / 2}" text-anchor="middle" font-size="10.5" fill="#56585c" transform="rotate(-90 14 ${padT + pH / 2})">${yLabel}</text>`;
    s += `</svg>`;
    return s;
  }

  /**
   * Scaled Turn-Lane Bay Geometry SVG (Taper + Deceleration + Storage).
   */
  function turnGeometrySvg(geom) {
    const W = 760, H = 200;
    if (!geom) return '';
    const total = Math.max(1, geom.totalLengthFt);
    const drawW = W - 80;
    const x0 = 40;
    const taperPx = (geom.taperFt / total) * drawW;
    const decelPx = (geom.decelOnlyFt / total) * drawW;
    const storePx = (geom.storageFt / total) * drawW;

    const mainTop = 44, mainH = 34, bayH = 26;
    const bayTop = mainTop + mainH;

    let s = `<svg viewBox="0 0 ${W} ${H}" class="diagram-svg" role="img" aria-label="Turn lane bay geometry schematic">`;
    s += `<rect width="${W}" height="${H}" fill="#faf9f5" rx="6"/>`;
    // Major through lane
    s += `<rect x="${x0}" y="${mainTop}" width="${drawW}" height="${mainH}" fill="#e6e2d6" stroke="#c8c4b8"/>`;
    s += `<text x="${x0 + 12}" y="${mainTop + 21}" font-size="11" fill="#56585c">Through Travel Lane (${geom.speed} mph)</text>`;

    // Taper polygon
    s += `<polygon points="${x0},${bayTop} ${x0 + taperPx},${bayTop} ${x0 + taperPx},${bayTop + bayH}" fill="#1f4e5f" fill-opacity="0.22" stroke="#1f4e5f" stroke-width="1.5"/>`;
    // Decel rect
    s += `<rect x="${x0 + taperPx}" y="${bayTop}" width="${decelPx}" height="${bayH}" fill="#b36b00" fill-opacity="0.20" stroke="#b36b00" stroke-width="1.5"/>`;
    // Storage rect
    s += `<rect x="${x0 + taperPx + decelPx}" y="${bayTop}" width="${storePx}" height="${bayH}" fill="#2b6e52" fill-opacity="0.22" stroke="#2b6e52" stroke-width="1.5"/>`;

    // Labels
    const labelY = bayTop + bayH + 22;
    s += `<text x="${x0 + taperPx / 2}" y="${labelY}" text-anchor="middle" font-size="11" font-weight="600" fill="#1f4e5f">Taper ${fmt(geom.taperFt)} ft</text>`;
    s += `<text x="${x0 + taperPx + decelPx / 2}" y="${labelY}" text-anchor="middle" font-size="11" font-weight="600" fill="#b36b00">Decel ${fmt(geom.decelOnlyFt)} ft</text>`;
    s += `<text x="${x0 + taperPx + decelPx + storePx / 2}" y="${labelY}" text-anchor="middle" font-size="11" font-weight="600" fill="#2b6e52">Storage ${fmt(geom.storageFt)} ft (${geom.designQueueVeh} veh)</text>`;

    // Total dimension line
    const totY = labelY + 26;
    s += `<line x1="${x0}" y1="${totY}" x2="${x0 + drawW}" y2="${totY}" stroke="#17181a" stroke-width="1.5"/>`;
    s += `<rect x="${W / 2 - 90}" y="${totY - 11}" width="180" height="20" rx="3" fill="#ffffff" stroke="#17181a"/>`;
    s += `<text x="${W / 2}" y="${totY + 3}" text-anchor="middle" font-size="11" font-weight="600" fill="#17181a">Total Bay Length: ${fmt(geom.totalLengthFt)} ft</text>`;
    s += `</svg>`;
    return s;
  }

  const api = { sightTriangleSvg, turnWarrantSvg, turnGeometrySvg };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.SightTurnDiagrams = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
