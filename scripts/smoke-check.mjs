import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const SightEngine = require('../src/sight-engine.js');
const TurnEngine = require('../src/turn-engine.js');
const Diagrams = require('../src/diagrams.js');

// 1. ISD Minor Stop (ISD_Minor_Stop.xlsx: V=30, Passenger Car, 2 lanes, <=3% grade)
const isd = SightEngine.computeISD({
  speed: 30, vehicle: 'passenger', majorLanes: 2, lanesCrossed: 2,
  gradePct: 0, setbackFt: 14.5, laneWidthFt: 12, medianWidthFt: 0
});
assert.equal(isd.valid, true);
assert.ok(Math.abs(isd.isdLeft - 352.8) < 0.01, `Expected 352.8, got ${isd.isdLeft}`);
assert.ok(Math.abs(isd.isdRight - 286.65) < 0.01, `Expected 286.65, got ${isd.isdRight}`);

// 2. ISD grade & truck adjustment
const isdTruck = SightEngine.computeISD({
  speed: 45, vehicle: 'combination', majorLanes: 4, lanesCrossed: 3, gradePct: 5
});
// tgLeft = 11.5 + 2*0.7 + 2*0.2 = 13.3 s -> 1.47*45*13.3 = 879.795 ft
assert.ok(Math.abs(isdTruck.tgLeft - 13.3) < 0.001);
assert.ok(Math.abs(isdTruck.isdLeft - 879.795) < 0.01);

// 3. Sight-triangle obstruction check
const obs = SightEngine.checkSightObstruction(20.5, 352.8, 100, 10);
assert.equal(obs.obstructed, true);
const clr = SightEngine.checkSightObstruction(20.5, 352.8, 100, 20);
assert.equal(clr.obstructed, false);

// 4. Decision Sight Distance (Decision_Sight_Distance.xlsx: V=40, PRT=3, 20%, decel=7.2)
const dsd = SightEngine.computeDSD({ speed: 40, prt: 3, speedReductionPct: 20, decelRate: 7.2 });
assert.equal(dsd.valid, true);
assert.ok(Math.abs(dsd.dPRT - 176.0) < 0.01);
assert.ok(Math.abs(dsd.dSlow - 9.5556) < 0.01);
assert.ok(Math.abs(dsd.totalDSD - 185.5556) < 0.01);

// 5. NCHRP 457 Left-Turn 2-Lane (NCHRP_457_Left_Turn.xlsx: V=30, VA=236, VO=200, 12.3%)
const lt2 = TurnEngine.evaluateLeftTurn({ lanes: 2, speed: 30, advance: 236, oppose: 200, share: 12.3 });
assert.equal(lt2.complete, true);
assert.equal(lt2.warranted, false);
assert.ok(Math.abs(lt2.limit - 467.39) < 0.5, `Expected ~467.39, got ${lt2.limit}`);

// 6. NCHRP 457 Left-Turn 4-Lane (NCHRP_457_Left_Turn.xlsx 4-lane: VL=15, VA=390, VO=400)
const lt4 = TurnEngine.evaluateLeftTurn({ lanes: 4, advance: 390, oppose: 400, leftTurns: 15 });
assert.equal(lt4.complete, true);
assert.equal(lt4.warranted, false);
assert.ok(Math.abs(lt4.limit - 18.086) < 0.05, `Expected ~18.086, got ${lt4.limit}`);

// 7. NCHRP 457 Right-Turn 2-Lane (NCHRP_457_Right_Turn.xlsx: V=30, vol=229, turns=29)
const rt2 = TurnEngine.evaluateRightTurn({ lanes: 2, speed: 30, volume: 229, turns: 29 });
assert.equal(rt2.complete, true);
assert.equal(rt2.warranted, false);

// 8. Turn-lane bay geometry sizing
const geom = TurnEngine.computeTurnGeometry({ speed: 45, turnVolume: 90, controlType: 'unsignalized', vehLengthFt: 25 });
assert.equal(geom.taperFt, 50);
assert.equal(geom.decelOnlyFt, 240);
assert.equal(geom.storageFt, 75); // 90*2/60 = 3 veh -> 75 ft
assert.equal(geom.totalLengthFt, 365);

// 9. Two-stage divided median & RIRO mode
const isdDiv = SightEngine.computeISD({
  speed: 45, vehicle: 'passenger', majorLanes: 4, lanesCrossed: 3, medianWidthFt: 22, accessType: 'full'
});
assert.equal(isdDiv.twoStageEligible, true);
assert.ok(isdDiv.isdStage1 < isdDiv.isdLeft);

const isdRiro = SightEngine.computeISD({
  speed: 30, vehicle: 'passenger', majorLanes: 2, lanesCrossed: 2, accessType: 'riro'
});
assert.equal(isdRiro.bRightLook, 0);
assert.ok(Math.abs(isdRiro.bLeftLook - 286.65) < 0.05);

// 10. SVG generation
const svgSight = Diagrams.sightTriangleSvg(isd, { ...obs, x: 100, y: 10 }, { ...clr, x: 100, y: 20 });
assert.ok(svgSight.startsWith('<svg') && svgSight.includes('Left ISD: 353 ft'));
const svgGeom = Diagrams.turnGeometrySvg(geom);
assert.ok(svgGeom.startsWith('<svg') && svgGeom.includes('Total Bay Length: 365 ft'));

console.log('ALL_SMOKE_CHECKS_PASSED');
