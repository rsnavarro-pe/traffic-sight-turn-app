// =========================================================================
// SIGHT DISTANCE ENGINE — AASHTO / FDOT FDM 212.11 / Florida Greenbook
// & TRB Access Management Decision Sight Distance (DSD)
// =========================================================================
(function (root) {
  'use strict';

  const ISD_BASE_GAP = {
    passenger: { left: 7.5, right: 6.5, cross: 6.5, label: 'Passenger Car' },
    single_unit: { left: 9.5, right: 8.5, cross: 8.5, label: 'Single-Unit Truck' },
    combination: { left: 11.5, right: 10.5, cross: 10.5, label: 'Combination Truck' }
  };

  /**
   * Compute Intersection Sight Distance (Case B1 Left Turn, Case B2 Right Turn,
   * Case B3 Crossing) for a stop-controlled minor road per FDOT FDM 212.11 /
   * Florida Greenbook Ch. 3 / AASHTO Green Book.
   */
  function computeISD(params) {
    const speed = Number(params.speed);
    const vehicle = ISD_BASE_GAP[params.vehicle] ? params.vehicle : 'passenger';
    const lanesCrossed = Math.max(1, Number(params.lanesCrossed) || 1);
    const gradePct = Number(params.gradePct) || 0;
    const setbackFt = Number(params.setbackFt) || 14.5;
    const laneWidthFt = Number(params.laneWidthFt) || 12;
    const medianWidthFt = Number(params.medianWidthFt) || 0;
    const majorLanes = Number(params.majorLanes) || 2;

    if (!Number.isFinite(speed) || speed <= 0) {
      return { valid: false, error: 'Enter a positive major-road design speed (mph).' };
    }

    const base = ISD_BASE_GAP[vehicle];
    const perExtraLane = vehicle === 'passenger' ? 0.5 : 0.7;
    const extraLanes = Math.max(0, lanesCrossed - 1);
    const gradeExcess = Math.max(0, gradePct - 3);

    // Case B1: Left Turn from Minor Road Stop
    const tgLeftBase = base.left;
    const tgLeftLaneAdj = extraLanes * perExtraLane;
    const tgLeftGradeAdj = gradeExcess * 0.2;
    const tgLeft = tgLeftBase + tgLeftLaneAdj + tgLeftGradeAdj;
    const isdLeft = 1.47 * speed * tgLeft;

    // Case B2: Right Turn from Minor Road Stop
    const tgRightBase = base.right;
    const tgRightGradeAdj = gradeExcess * 0.1;
    const tgRight = tgRightBase + tgRightGradeAdj;
    const isdRight = 1.47 * speed * tgRight;

    // Case B3: Crossing Maneuver from Minor Road Stop
    const tgCrossBase = base.cross;
    const tgCrossLaneAdj = extraLanes * perExtraLane;
    const tgCrossGradeAdj = gradeExcess * 0.1;
    const tgCross = tgCrossBase + tgCrossLaneAdj + tgCrossGradeAdj;
    const isdCross = 1.47 * speed * tgCross;

    // Stopping Sight Distance (AASHTO Green Book / FDOT FDM 210)
    // Controlling two-way SSD uses downgrade (-|G|), with upgrade (+|G|) also reported
    const absG = Math.abs(Number(params.majorGradePct) || 0) / 100;
    const decelUp = Math.max(0.05, (11.2 / 32.2) + absG);
    const decelDown = Math.max(0.05, (11.2 / 32.2) - absG);
    const ssdUpgrade = 1.47 * speed * 2.5 + (speed * speed) / (30 * decelUp);
    const ssdDowngrade = 1.47 * speed * 2.5 + (speed * speed) / (30 * decelDown);
    const ssd = ssdDowngrade;

    // Sight Triangle Leg Offsets from Minor-Road Decision Point
    // Near-side approaching lane center (from left): setback + 0.5 * laneWidth
    // Far-side approaching lane center (from right): setback + (majorLanes/2)*laneWidth + median + 0.5*laneWidth
    const halfLanes = Math.max(1, majorLanes / 2);
    const aLeftLook = setbackFt + 0.5 * laneWidthFt;
    const aRightLook = setbackFt + halfLanes * laneWidthFt + medianWidthFt + 0.5 * laneWidthFt;

    // Controlling sight distances along major road:
    // Full access: Looking left uses max(B1, B2), looking right uses max(B1, B3).
    // RIRO (Right-In/Right-Out): Only Case B2 looking left applies.
    const accessType = params.accessType === 'riro' ? 'riro' : 'full';
    const bLeftLook = accessType === 'riro' ? isdRight : Math.max(isdLeft, isdRight);
    const bRightLook = accessType === 'riro' ? 0 : Math.max(isdLeft, isdCross);

    return {
      valid: true,
      speed,
      vehicle,
      vehicleLabel: base.label,
      lanesCrossed,
      gradePct,
      setbackFt,
      laneWidthFt,
      medianWidthFt,
      majorLanes,
      accessType,
      tgLeftBase,
      tgLeftLaneAdj,
      tgLeftGradeAdj,
      tgLeft,
      isdLeft,
      tgRightBase,
      tgRightGradeAdj,
      tgRight,
      isdRight,
      tgCrossBase,
      tgCrossLaneAdj,
      tgCrossGradeAdj,
      tgCross,
      isdCross,
      ssd,
      ssdUpgrade,
      ssdDowngrade,
      aLeftLook,
      aRightLook,
      bLeftLook,
      bRightLook
    };
  }

  /**
   * Check whether a proposed/existing obstruction at (xObs, yObs) violates the
   * clear sight triangle for a given leg (a = minor-road vertex distance to
   * conflicting lane center, b = major-road ISD).
   * xObs: distance along major road from minor-road centerline (ft)
   * yObs: setback from conflicting lane centerline toward minor road (ft)
   */
  function checkSightObstruction(a, b, xObs, yObs) {
    if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) {
      return { applicable: false };
    }
    const x = Number(xObs);
    const y = Number(yObs);
    if (!Number.isFinite(x) || !Number.isFinite(y) || x <= 0 || y <= 0) {
      return { applicable: false };
    }
    // Line of sight connects (0, a) on minor road to (b, 0) on major road: x/b + y/a = 1
    const ratio = (x / b) + (y / a);
    const maxAllowedYAtX = a * (1 - x / b);
    const obstructed = ratio < 1;
    // If obstructed, how far back is the sight line blocked along the major road?
    // Ray from (0, a) through (x, y) hits y=0 at x_avail = x * a / (a - y) if y < a
    const availableMajorDist = y < a ? (x * a) / (a - y) : Infinity;
    return {
      applicable: true,
      obstructed,
      ratio,
      maxAllowedYAtX: Math.max(0, maxAllowedYAtX),
      availableMajorDist,
      clearanceFt: y - maxAllowedYAtX
    };
  }

  /**
   * Compute Decision Sight Distance (DSD) for Driveway Maneuver
   * per TRB Access Management Application Guidelines (Decision Sight Distance.xlsx).
   */
  const DSD_PRT_PRESETS = {
    rural: { prt: 3.0, label: 'Rural (3.0 s)' },
    suburban: { prt: 6.0, label: 'Suburban (6.0 s)' },
    urban: { prt: 9.1, label: 'Urban (9.1 s)' }
  };

  const DSD_ACTIVITY_PRESETS = {
    right_in: { pct: 20, label: 'Right Turn In (20%)' },
    right_out: { pct: 12, label: 'Right Turn Out (12%)' },
    left_in: { pct: 10, label: 'Left Turn In (10%)' },
    left_out: { pct: 10, label: 'Left Turn Out (10%)' }
  };

  function recommendedDecelRate(speed) {
    if (speed <= 40) return 7.2;
    if (speed <= 55) return 9.9;
    return 11.2;
  }

  function computeDSD(params) {
    const speed = Number(params.speed);
    const prt = Number(params.prt);
    const speedReductionPct = Number(params.speedReductionPct);
    const decelRate = Number(params.decelRate) || recommendedDecelRate(speed);

    if (!Number.isFinite(speed) || speed <= 0 || !Number.isFinite(prt) || prt <= 0 || !Number.isFinite(decelRate) || decelRate <= 0) {
      return { valid: false, error: 'Enter positive speed, PRT, and deceleration rate.' };
    }
    const red = Math.max(0, Math.min(100, Number.isFinite(speedReductionPct) ? speedReductionPct : 20));
    const dPRT = (1.4666667) * speed * prt;
    const deltaV = speed * (red / 100);
    const dSlow = 1.075 * (deltaV * deltaV) / decelRate;
    const totalDSD = dPRT + dSlow;

    return {
      valid: true,
      speed,
      prt,
      speedReductionPct: red,
      decelRate,
      dPRT,
      dSlow,
      totalDSD
    };
  }

  const api = {
    ISD_BASE_GAP,
    DSD_PRT_PRESETS,
    DSD_ACTIVITY_PRESETS,
    recommendedDecelRate,
    computeISD,
    checkSightObstruction,
    computeDSD
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.SightEngine = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
