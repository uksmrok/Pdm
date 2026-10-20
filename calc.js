/* CA-0117B-PD000-02 training-only source relationships.
   This file intentionally contains NO aircraft-specific estimates for un-digitized charts. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PDMCalc = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const finite = (...nums) => nums.every(v => typeof v === 'number' && Number.isFinite(v));
  const between = (v, a, b) => finite(v) && v >= a && v <= b;
  const clampAngle = deg => ((deg % 360) + 360) % 360;
  function tableISA(rows, altitude) {
    if (!between(altitude, 0, 30000)) throw Error('ISA Table 1-1 only covers 0–30,000 ft.');
    if (!Array.isArray(rows) || rows.length !== 31) throw Error('ISA table is unavailable.');
    const base = Math.min(Math.floor(altitude / 1000), 30);
    const x = (altitude - base * 1000) / 1000;
    const current = rows[base];
    const next = rows[Math.min(base + 1, 30)];
    return {
      altitude,
      sigma: current[1] + x * (next[1] - current[1]),
      reciprocalRootSigma: current[2] + x * (next[2] - current[2]),
      theta: current[3] + x * (next[3] - current[3]),
      isaC: current[4] + x * (next[4] - current[4]),
      isaF: current[5] + x * (next[5] - current[5]),
      delta: current[6] + x * (next[6] - current[6]),
      pressureInHg: current[7] + x * (next[7] - current[7])
    };
  }
  function atmosphere(rows, altitude, oatC) {
    if (!finite(altitude, oatC) || oatC <= -273.15) throw Error('Enter a valid altitude and temperature.');
    const isa = tableISA(rows, altitude);
    const actualDensityRatio = isa.delta * (288.15 / (oatC + 273.15));
    return {...isa, oatC, deviation: oatC - isa.isaC, actualDensityRatio,
      densityKgM3: actualDensityRatio * 1.225,
      easToTasMultiplier: 1 / Math.sqrt(actualDensityRatio)};
  }
  function winds(runwayHeading, windFrom, steady, gust = steady, policy = 'recommended') {
    if (![runwayHeading, windFrom, steady, gust].every(Number.isFinite)) throw Error('Invalid wind input.');
    if (!between(runwayHeading, 0, 360) || !between(windFrom, 0, 360) || !between(steady, 0, 60) || !between(gust, steady, 60))
      throw Error('Headings 0–360°; steady/gust 0–60 kt with gust ≥ steady (PDM charts 3-1/3-2).');
    const angle = ((windFrom - runwayHeading + 540) % 360) - 180;
    const rad = angle * Math.PI / 180;
    const headwind = Math.max(0, steady * Math.cos(rad));
    const tailwind = Math.max(0, -gust * Math.cos(rad));
    const crosswind = Math.abs(gust * Math.sin(rad));
    const signedCrosswind = gust * Math.sin(rad);
    const appliedHeadwind = policy === 'ignore-headwind' ? 0 : headwind * 0.5;
    return { angle, headwind, tailwind, crosswind, crosswindSide: signedCrosswind >= 0 ? 'from right' : 'from left',
      gustIncrement: gust - steady, appliedHeadwind, appliedTailwind: tailwind * 1.5,
      obstacleHeadwind: 0, obstacleTailwind: tailwind * 1.5 };
  }
  function speeds({vsrUp, vsrLanding, vmcl, vth, vsrTakeoff, vmca, normalV2Factor = 1.18, vfToInput}) {
    const out = {};
    if (finite(vsrUp) && vsrUp > 0) {
      out.vfto = 1.18 * vsrUp;
      out.vtoUpMin = out.vfto - 10;
    }
    if (finite(vsrLanding) && vsrLanding > 0) {
      out.vrefShort = 1.13 * vsrLanding;
      if (finite(vmcl) && vmcl > 0) out.vrefNormal = Math.max(1.23 * vsrLanding, vmcl);
      else out.vrefNormal = null;
    }
    if (finite(vth) && vth > 0) out.vapp = vth + 10;
    if (finite(vsrTakeoff) && vsrTakeoff > 0 && finite(vmca) && vmca > 0 && between(normalV2Factor, 1.13, 1.18)) {
      out.normalV2Candidate = Math.max(normalV2Factor * vsrTakeoff, 1.1 * vmca);
    }
    if (finite(vfToInput) && vfToInput > 0) out.vtoUpMin = vfToInput - 10;
    return out;
  }
  function cruise({tas, headwind, fuelFlowPerEngine, engines = 2, usableFuel, durationMin, distanceNm}) {
    if (!finite(tas, headwind, fuelFlowPerEngine, engines, usableFuel, durationMin, distanceNm) ||
        tas < 0 || fuelFlowPerEngine <= 0 || engines <= 0 || usableFuel < 0 || durationMin < 0 || distanceNm < 0)
      throw Error('Enter valid nonnegative numbers and positive engine fuel flow.');
    const groundSpeed = tas - headwind;
    if (groundSpeed <= 0) throw Error('Groundspeed must be positive.');
    const totalFlow = fuelFlowPerEngine * engines;
    return {
      totalFlow, groundSpeed, specificRange: tas / totalFlow, specificGroundRange: groundSpeed / totalFlow,
      enduranceHours: usableFuel / totalFlow, stillAirRangeNm: tas * usableFuel / totalFlow,
      groundRangeNm: groundSpeed * usableFuel / totalFlow, legFuelKg: totalFlow * durationMin / 60,
      legDistanceNm: groundSpeed * durationMin / 60,
      fuelForDistanceKg: (distanceNm / groundSpeed) * totalFlow,
      durationForDistanceMin: distanceNm / groundSpeed * 60
    };
  }
  function vertical({startFt, endFt, rateFpm, groundSpeed}) {
    if (!finite(startFt, endFt, rateFpm, groundSpeed) || rateFpm <= 0 || groundSpeed < 0)
      throw Error('Enter valid altitudes, a positive vertical rate and a nonnegative ground speed.');
    const distanceFt = Math.abs(endFt - startFt);
    return { direction: endFt >= startFt ? 'climb' : 'descent', altitudeChangeFt: distanceFt,
      minutes: distanceFt / rateFpm, horizontalDistanceNm: distanceFt / rateFpm * groundSpeed / 60,
      gradientPercent: groundSpeed === 0 ? null : rateFpm / (groundSpeed * 6076.12 / 60) * 100 };
  }
  const POWER = [
    {setting:'Normal takeoff', bleed:'OFF', np:'100%', shp:2645, limit:'33 °C static'},
    {setting:'Maximum takeoff', bleed:'OFF', np:'100%', shp:2920, limit:'33 °C static'},
    {setting:'Maximum continuous', bleed:'OFF', np:'100%', shp:2920, limit:'35 °C at 160 KTAS'},
    {setting:'Normal takeoff', bleed:'ON', np:'100%', shp:2645, limit:'22 °C static'},
    {setting:'Maximum continuous', bleed:'ON', np:'100%', shp:2920, limit:'28 °C at 160 KTAS'},
    {setting:'Maximum climb', bleed:'ON', np:'95%', shp:2240, limit:'24 °C at 200 KTAS'},
    {setting:'Maximum cruise 1', bleed:'ON', np:'90%', shp:2132, limit:'20 °C at 200 KTAS'},
    {setting:'Maximum cruise 2', bleed:'ON', np:'80%', shp:2132, limit:'20 °C at 200 KTAS'}
  ];
  const runwayRcr = { 'Dry paved':23, 'Wet paved':12, 'Icy paved':5 };
  const runwayRfi = { 'Dry paved':2, 'Wet paved':2, 'Hard soil (CBR ≥7)':3, 'Hard grass (CBR ≥7)':4,
    'Soft unpaved CBR 6':4, 'Soft unpaved CBR 5':6, 'Soft unpaved CBR 4':8,
    'Soft unpaved CBR 3':11, 'Soft unpaved CBR 2':14 };
  return { tableISA, atmosphere, winds, speeds, cruise, vertical, POWER, runwayRcr, runwayRfi };
});
