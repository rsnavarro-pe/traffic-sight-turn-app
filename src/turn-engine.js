// =========================================================================
// TURN-LANE WARRANT & GEOMETRY ENGINE
// NCHRP Report 457 Figures 2-5 (2-Lane & 4-Lane Left Turn) & 2-6 (Right Turn)
// FDOT FDM 212.11 / AASHTO Turn-Lane Deceleration, Taper & Queue Storage
// =========================================================================
(function (root) {
  'use strict';

  /**
   * NCHRP Report 457 Figure 2-5: 2-Lane Roadway Left-Turn Bay
   * Returns limiting advancing volume VA (veh/h).
   */
  function leftLimit2Lane(speed, shareDecimal, opposing, turnTime = 3.0, gap = 5.0, clear = 1.9) {
    const arrival = opposing / 3600;
    const waiting = arrival ? Math.expm1(arrival * gap) / arrival - gap : 0;
    const service = arrival
      ? opposing * Math.exp(-arrival * 0.79 * gap) / -Math.expm1(-arrival * turnTime)
      : 3600 / turnTime;
    return Math.sqrt((0.04 - 0.0005 * speed) * 2400 * service / (shareDecimal * (1 - shareDecimal) * (waiting + clear)));
  }

  /**
   * NCHRP Report 457 Figure 2-5: 4-Lane Roadway Left-Turn Bay
   * Returns limiting left-turn volume VL (veh/h) and 400-vph combined check.
   */
  function leftLimit4Lane(opposing, turnTime = 4.0, gap = 6.0) {
    const rho = 0.03;
    const f = 0.79;
    const platoonHdwy = 2.7;
    const pNoQueue = Math.pow(Math.max(0, 1 - (opposing / 3600 / 2) * platoonHdwy), 2);
    const arrival = opposing / 3600;
    const servRate = arrival
      ? opposing * Math.exp(-arrival * f * (gap - platoonHdwy)) / (1 - Math.exp(-arrival * turnTime)) * pNoQueue
      : (3600 / turnTime);
    return {
      pNoQueue,
      servRate,
      limitVL: rho * servRate
    };
  }

  /**
   * Evaluate Left-Turn Bay Warrant (2-lane or 4-lane major roadway).
   */
  function evaluateLeftTurn(params) {
    const lanes = Number(params.lanes) === 4 ? 4 : 2;
    const speed = Number(params.speed);
    const advance = Number(params.advance);
    const oppose = Number(params.oppose);
    const sharePct = Number(params.share);
    const turnTime = Number(params.turnTime) || (lanes === 4 ? 4.0 : 3.0);
    const gap = Number(params.gap) || (lanes === 4 ? 6.0 : 5.0);
    const clear = Number(params.clear) || 1.9;

    if (!Number.isFinite(advance) || !Number.isFinite(oppose) || advance < 0 || oppose < 0) {
      return { complete: false, status: 'Enter advancing and opposing volumes.' };
    }

    if (lanes === 2) {
      if (!Number.isFinite(speed) || speed <= 0 || speed >= 80) {
        return { complete: false, status: 'Enter 2-lane operating speed (1–79.9 mph).' };
      }
      if (!Number.isFinite(sharePct) || sharePct <= 0 || sharePct >= 100) {
        return { complete: false, status: 'No left-turn demand (share must be > 0% and < 100%).' };
      }
      const limit = leftLimit2Lane(speed, sharePct / 100, oppose, turnTime, gap, clear);
      const warranted = advance > limit;
      return {
        complete: true,
        lanes: 2,
        warranted,
        metricLabel: 'Limiting advancing volume (VA)',
        actual: advance,
        limit,
        leftTurns: advance * (sharePct / 100),
        status: warranted ? 'Left-turn bay warranted' : 'Left-turn bay NOT warranted',
        note: oppose > 800 ? 'Opposing volume exceeds 800 veh/h scale of Figure 2-5. Confirm applicability.' : ''
      };
    }

    // 4-lane roadway
    const leftTurns = Number.isFinite(Number(params.leftTurns)) && params.leftTurns !== ''
      ? Number(params.leftTurns)
      : (Number.isFinite(sharePct) ? advance * (sharePct / 100) : NaN);

    if (!Number.isFinite(leftTurns) || leftTurns < 0) {
      return { complete: false, status: 'Enter left-turning volume (VL) for 4-lane roadway.' };
    }
    const lowCombined = advance < 400 && oppose < 400;
    const calc = leftLimit4Lane(oppose, turnTime, gap);
    const warranted = !lowCombined && leftTurns > calc.limitVL;
    return {
      complete: true,
      lanes: 4,
      warranted,
      lowCombined,
      metricLabel: 'Limiting left-turn volume (VL)',
      actual: leftTurns,
      limit: calc.limitVL,
      leftTurns,
      status: lowCombined
        ? 'Left-turn bay NOT warranted (VA & VO < 400 veh/h)'
        : (warranted ? 'Left-turn bay warranted' : 'Left-turn bay NOT warranted'),
      note: oppose <= 1 ? 'Opposing volume too low for gap-acceptance curve.' : ''
    };
  }

  /**
   * NCHRP Report 457 Figure 2-6: Right-Turn Bay (2-lane & 4-lane).
   */
  function rightLimit(speed, geometry, volume) {
    const kph = Math.min(speed * 1.609, 100);
    const [b0, b1, b2, c0, c1, c2] = geometry === 2
      ? [113.61840184989288, -2.087935007883949, 0.010054656362029834, -15.84726076602802, 0.29828445774369533, -0.0014463389581583898]
      : [71.42927888933085, -1.106699124662079, 0.0045996480980963, -9.257194000251868, 0.15031632641649545, -0.0006419911009248072];
    return Math.exp(b0 + b1 * kph + b2 * kph * kph + (c0 + c1 * kph + c2 * kph * kph) * Math.log(volume));
  }

  function evaluateRightTurn(params) {
    const lanes = Number(params.lanes) === 4 ? 4 : 2;
    const speed = Number(params.speed);
    const volume = Number(params.volume);
    const turns = Number(params.turns);

    if (!Number.isFinite(speed) || speed <= 0 || !Number.isFinite(volume) || volume < 0 || !Number.isFinite(turns) || turns < 0) {
      return { complete: false, status: 'Enter speed, approach volume, and right-turn volume.' };
    }
    if (turns > volume) {
      return { complete: false, status: 'Right-turn volume cannot exceed approach volume.' };
    }
    if (volume === 0) {
      return { complete: true, lanes, warranted: false, status: 'No right-turn demand', actual: 0, limit: Infinity, note: '' };
    }
    const kph = Math.min(speed * 1.609, 100);
    const [b0, b1, b2, c0, c1, c2] = lanes === 2
      ? [113.61840184989288, -2.087935007883949, 0.010054656362029834, -15.84726076602802, 0.29828445774369533, -0.0014463389581583898]
      : [71.42927888933085, -1.106699124662079, 0.0045996480980963, -9.257194000251868, 0.15031632641649545, -0.0006419911009248072];
    const limit = Math.exp(b0 + b1 * kph + b2 * kph * kph + (c0 + c1 * kph + c2 * kph * kph) * Math.log(volume));
    const warranted = turns > limit;
    const notes = [];
    if (speed * 1.609 > 100) notes.push('Speed capped at 100 km/h (~62 mph) per NCHRP 457.');
    if (speed >= 45 && turns >= 40) notes.push('FDOT Access Mgmt note: ≥45 mph with ≥40 right-turns/h typically warrants a right-turn lane.');
    else if (speed >= 50 && turns >= 20) notes.push('FDOT Access Mgmt note: ≥50 mph with ≥20 right-turns/h may warrant a right-turn lane.');
    return {
      complete: true,
      lanes,
      warranted,
      metricLabel: 'Limiting right-turn volume (VR)',
      actual: turns,
      limit,
      status: warranted ? 'Right-turn bay warranted' : 'Right-turn bay NOT warranted',
      note: notes.join(' ')
    };
  }

  /**
   * FDOT FDM 212.11 / AASHTO Turn-Lane Geometry & Queue Storage Sizing
   * Deceleration distances (ft) include standard 50-ft approach taper per FDOT FDM 212.11.1.
   */
  const FDOT_DECEL_TABLE = [
    { speed: 30, totalDecel: 145, taper: 50, decelOnly: 95 },
    { speed: 35, totalDecel: 185, taper: 50, decelOnly: 135 },
    { speed: 40, totalDecel: 240, taper: 50, decelOnly: 190 },
    { speed: 45, totalDecel: 290, taper: 50, decelOnly: 240 },
    { speed: 50, totalDecel: 350, taper: 50, decelOnly: 300 },
    { speed: 55, totalDecel: 405, taper: 50, decelOnly: 355 },
    { speed: 60, totalDecel: 460, taper: 50, decelOnly: 410 },
    { speed: 65, totalDecel: 530, taper: 50, decelOnly: 480 }
  ];

  function interpolateDecel(speed) {
    const s = Math.max(30, Math.min(65, Number(speed) || 35));
    for (let i = 0; i < FDOT_DECEL_TABLE.length; i++) {
      if (s <= FDOT_DECEL_TABLE[i].speed) {
        if (i === 0) return FDOT_DECEL_TABLE[0];
        const prev = FDOT_DECEL_TABLE[i - 1];
        const curr = FDOT_DECEL_TABLE[i];
        const t = (s - prev.speed) / (curr.speed - prev.speed);
        const totalDecel = Math.round(prev.totalDecel + t * (curr.totalDecel - prev.totalDecel));
        return { speed: s, totalDecel, taper: 50, decelOnly: totalDecel - 50 };
      }
    }
    return FDOT_DECEL_TABLE[FDOT_DECEL_TABLE.length - 1];
  }

  function computeTurnGeometry(params) {
    const speed = Number(params.speed) || 35;
    const turnVolume = Math.max(0, Number(params.turnVolume) || 0);
    const controlType = params.controlType === 'signal' ? 'signal' : 'unsignalized';
    const cycleSec = Math.max(30, Number(params.cycleSec) || 90);
    const vehLengthFt = Math.max(20, Number(params.vehLengthFt) || 25);
    const bayWidthFt = Math.max(10, Number(params.bayWidthFt) || 12);
    const customTaper = Number(params.taperFt);

    const decel = interpolateDecel(speed);
    const taperFt = Number.isFinite(customTaper) && customTaper > 0 ? customTaper : decel.taper;
    const decelOnlyFt = decel.decelOnly;

    // Queue storage length:
    // Unsignalized: 2-minute arrival rule (V_t * 2 / 60), min 50 ft (2 cars)
    // Signalized: 1.5 * (V_t * C / 3600) * L_veh, min 50 ft
    const avgQueueVeh = controlType === 'signal'
      ? 1.5 * (turnVolume * cycleSec / 3600)
      : (turnVolume * 2 / 60);
    const designQueueVeh = Math.max(2, Math.ceil(avgQueueVeh));
    const storageFt = Math.max(50, Math.ceil((designQueueVeh * vehLengthFt) / 25) * 25);
    const totalLengthFt = taperFt + decelOnlyFt + storageFt;

    return {
      speed,
      turnVolume,
      controlType,
      cycleSec,
      vehLengthFt,
      bayWidthFt,
      taperFt,
      decelOnlyFt,
      avgQueueVeh,
      designQueueVeh,
      storageFt,
      totalLengthFt
    };
  }

  const api = {
    leftLimit2Lane,
    leftLimit4Lane,
    evaluateLeftTurn,
    rightLimit,
    evaluateRightTurn,
    FDOT_DECEL_TABLE,
    computeTurnGeometry
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.TurnEngine = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
