/* Generated from ayaliz/hakuraku @ 88015af9f6473fa4b76463b9cf217a3c79817811 (MIT).
 * Copyright (c) 2021 SSHZ.ORG. See THIRD_PARTY_NOTICES.md.
 * Rebuild: node scripts/build_award_telemetry.cjs /path/to/pinned/hakuraku
 * Source formulas are retained; imports/types and unused analysis exports are removed.
 */
(function(global){
'use strict';
function estimateOtherEvents(raceData,raceHorseInfo,courseId,activations,distance,condition,data){

 const UMDatabaseWrapper = {skills: data.skills};
 const GameDataLoader = {courseData: data.courses, racetracks: data.racetracks};
 const RaceSimulateEventData_SimulateEventType = {SKILL: 3, COMPETE_FIGHT: 5, COMPETE_TOP: 4};
 const RaceSimulateHorseResultData_RunningStyle = {NIGE: 1, SENKO: 2, SASHI: 3, OIKOMI: 4};
 // Full horseACT response fields are already hydrated. Rank scoring is not used.
 function fromRaceHorseData(d) {
  const mapping = names => Object.fromEntries(names.map((name,i) => [i+1,d[name]]));
  return {speed:d.speed,stamina:d.stamina,pow:d.pow||d.power,guts:d.guts,wiz:d.wiz,
   skills:(d.skill_array||[]).map(s=>({skillId:s.skill_id,level:s.level})),
   properDistances:mapping(['proper_distance_short','proper_distance_mile','proper_distance_middle','proper_distance_long']),
   properRunningStyles:mapping(['proper_running_style_nige','proper_running_style_senko','proper_running_style_sashi','proper_running_style_oikomi']),
   properGroundTurf:d.proper_ground_turf,properGroundDirt:d.proper_ground_dirt,
   fanCount:Number(d.fan_count),rawData:d};
 }
// Source: src/components/RaceReplay/utils/raceConstants.ts
// Race speed formula: baseSpeed = BASE_SPEED_CONSTANT - (courseDistance - BASE_SPEED_COURSE_OFFSET) / BASE_SPEED_COURSE_SCALE
const BASE_SPEED_CONSTANT = 20.0;
const BASE_SPEED_COURSE_OFFSET = 2000;
const BASE_SPEED_COURSE_SCALE = 1000;

// HP consumption reference formula: SCALE * pow(speed - baseSpeed + SPEED_OFFSET, 2) / DIVISOR
const HP_CONSUMPTION_SCALE = 20.0;
const HP_CONSUMPTION_SPEED_OFFSET = 12.0;
const HP_CONSUMPTION_DIVISOR = 144.0;

// Slope formulas
// slope units: raw game value where SLOPE_SCALE = 1 grade fraction (e.g. slope -10000 → 1% downhill)
const SLOPE_SCALE = 10000;
const SLOPE_PENALTY_COEFF = 200; // Uphill speed penalty: (slope / SLOPE_SCALE * SLOPE_PENALTY_COEFF) / adjustedPower

// Downhill Mode speed bonus: bonus = DOWNHILL_BONUS_BASE + |slope| / DOWNHILL_BONUS_DIVISOR
const DOWNHILL_BONUS_BASE = 0.3;
const DOWNHILL_BONUS_DIVISOR = 100000; // slope -10000 (1% grade) → +0.1 m/s bonus

// HP consumption ratios (actual / reference) used to detect downhill mode
const DOWNHILL_HP_RATIO_THRESHOLD = 0.8;  // Below → likely downhill mode
const DOWNHILL_HP_RATIO_STRONG = 0.5;      // Below → definitely downhill (skip speed matching)
const DOWNHILL_HP_RATIO_PACE_DOWN = 0.3;   // Downhill + pace down confirmation

// Position keep mode speed multipliers
const PACE_UP_MULTIPLIER = 1.04;
const OVERTAKE_MULTIPLIER = 1.05;
const PACE_DOWN_MULTIPLIER = 0.915;
const RUSHED_TYPE2_MULTIPLIER = 1.04; // Applied multiplicatively alongside other mode multipliers

// Skill timing
const SKILL_TIME_SCALE = 10000;     // Converts game base time to race-proportional duration: (baseTime / SKILL_TIME_SCALE) * (distance / 1000)
const DEFAULT_SKILL_DURATION = 2.0; // Fallback duration (seconds) when skill has no base time

// Guts bonus speed formulas
// Spot Struggle (Competes Pos): Math.pow(BASE * guts, EXPONENT) * SCALE
const SPOT_STRUGGLE_GUTS_BASE = 500;
const SPOT_STRUGGLE_GUTS_EXPONENT = 0.6;
const SPOT_STRUGGLE_GUTS_SCALE = 0.0001;
// Dueling (Competes Speed): Math.pow(BASE * guts, EXPONENT) * SCALE
const DUELING_GUTS_BASE = 200;
const DUELING_GUTS_EXPONENT = 0.708;
const DUELING_GUTS_SCALE = 0.0001;

// Special skill IDs
const OONIGE_SKILL_ID = 202051;

// Temptation mode values
const TEMPTATION_MODE_RUSH_BOOST = 4; // The "rushed boost" variant that applies RUSHED_TYPE2_MULTIPLIER

// Career race (raceType === 'Single') flat stat bonus, applied after mood modifier and 1200 cap
const CAREER_RACE_STAT_BONUS = 400;

// Display adjustment for mode/downhill durations (server vs client simulation timing)
const MODE_DISPLAY_TIME_SCALE = 15 / 16;

// Source: src/components/RaceReplay/utils/speedCalculations.ts


// Coefficients
const STRATEGY_PHASE_COEFFS                           = {
    // [Early, Mid, Late]
    [RaceSimulateHorseResultData_RunningStyle.NIGE]: [1.0, 0.98, 0.962],
    [RaceSimulateHorseResultData_RunningStyle.SENKO]: [0.978, 0.991, 0.975],
    [RaceSimulateHorseResultData_RunningStyle.SASHI]: [0.938, 0.998, 0.994],
    [RaceSimulateHorseResultData_RunningStyle.OIKOMI]: [0.931, 1.0, 1.0],
};
const OONIGE_COEFFS = [1.063, 0.962, 0.95];

const DISTANCE_PROFICIENCY_MODIFIER                         = {
    8: 1.05, // S
    7: 1.0,  // A
    6: 0.9,  // B
    5: 0.8,  // C
    4: 0.6,  // D
    3: 0.4,  // E
    2: 0.2,  // F
    1: 0.1,  // G
};

const STRATEGY_PROFICIENCY_MODIFIER                         = {
    8: 1.1,  // S
    7: 1.0,  // A
    6: 0.85, // B
    5: 0.75, // C
    4: 0.6,  // D
    3: 0.4,  // E
    2: 0.2,  // F
    1: 0.1,  // G
};

const MOOD_MODIFIER                         = {
    5: 1.04, // Great
    4: 1.02, // Good
    3: 1.0,  // Normal
    2: 0.98, // Bad
    1: 0.96, // Awful
};

// Stat cap: above this, excess is halved before mood modifier
const STAT_CAP = 1200;

// Track stat threshold modifiers
const TRACK_STAT_THRESHOLD_HIGH = 900;
const TRACK_STAT_MODIFIER_HIGH = 1.2;
const TRACK_STAT_THRESHOLD_MID = 600;
const TRACK_STAT_MODIFIER_MID = 1.15;
const TRACK_STAT_THRESHOLD_LOW = 300;
const TRACK_STAT_MODIFIER_LOW = 1.1;
const TRACK_STAT_MODIFIER_BASE = 1.05;

// Speed term in base target speed: Math.sqrt(SPEED_TERM_COEFF * adjustedSpeed) * distMod * SPEED_TERM_SCALE
const SPEED_TERM_COEFF = 500;
const SPEED_TERM_SCALE = 0.002;

// Last spurt guts term: Math.pow(GUTS_TERM_BASE * guts, GUTS_TERM_EXPONENT) * GUTS_TERM_SCALE
const GUTS_TERM_BASE = 450;
const GUTS_TERM_EXPONENT = 0.597;
const GUTS_TERM_SCALE = 0.0001;

// Last spurt speed formula: (lateBase + LAST_SPURT_BASE_RATIO * baseSpeed) * LAST_SPURT_MULTIPLIER + speedTerm + gutsTerm
const LAST_SPURT_MULTIPLIER = 1.05;
const LAST_SPURT_BASE_RATIO = 0.01;

// Wisdom target speed variance
const WISDOM_VARIANCE_DIVISOR = 5500;
const WISDOM_LOG_SCALE = 0.1;
const WISDOM_MIN_PCT_OFFSET = 0.65;

function computeGroundPowerBonus(surface        , condition        )         {
    if (surface === 2) { // Dirt
        return condition === 2 ? -50 : -100; // 稍重 → -50, all others → -100
    } else if (surface === 1) { // Turf
        return condition === 1 ? 0 : -50; // 良 → 0, all others → -50
    }
    return 0;
}

function adjustStat(stat        , mood        , bonus         = 0)         {
    let val = stat;
    if (val > STAT_CAP) {
        val = STAT_CAP + (val - STAT_CAP) / 2;
    }
    const moodMod = MOOD_MODIFIER[mood] || 1.0;
    return val * moodMod + bonus;
}

function calculateSectionBaseSpeedWitRoll(params

 )                                              {
    const baseSpeed = BASE_SPEED_CONSTANT
        - (params.courseDistance - BASE_SPEED_COURSE_OFFSET) / BASE_SPEED_COURSE_SCALE;
    const strategyProficiencyModifier = STRATEGY_PROFICIENCY_MODIFIER[params.strategyProficiency ?? 7] ?? 1.0;
    const adjustedWisdom = adjustStat(params.wisdomStat, params.mood) * strategyProficiencyModifier
        + (params.wisdomBonus ?? 0);
    const rangeMax = (adjustedWisdom / WISDOM_VARIANCE_DIVISOR)
        * Math.log10(WISDOM_LOG_SCALE * adjustedWisdom);
    const percentage = rangeMax - WISDOM_MIN_PCT_OFFSET + params.roll * WISDOM_MIN_PCT_OFFSET;
    return {
        speedAddend: baseSpeed * percentage / 100,
        percentage,
    };
}

function getTrackStatThresholdModifier(courseId        , stats                                                                                 , mood        )         {
    if (!courseId) return 1.0;
    const trackInfo = GameDataLoader.racetracks.pageProps.racetrackFilterData.find((t     ) => t.id === courseId);
    if (!trackInfo || !trackInfo.statThresholds || trackInfo.statThresholds.length === 0) return 1.0;

    const moodMod = MOOD_MODIFIER[mood] || 1.0;
    let totalMod = 0;
    let count = 0;

    trackInfo.statThresholds.forEach((statName        ) => {
        const statVal = (stats       )[statName] ?? 0;
        const adjusted = statVal * moodMod;

        let mod = TRACK_STAT_MODIFIER_BASE;
        if (adjusted > TRACK_STAT_THRESHOLD_HIGH) mod = TRACK_STAT_MODIFIER_HIGH;
        else if (adjusted > TRACK_STAT_THRESHOLD_MID) mod = TRACK_STAT_MODIFIER_MID;
        else if (adjusted > TRACK_STAT_THRESHOLD_LOW) mod = TRACK_STAT_MODIFIER_LOW;

        totalMod += mod;
        count++;
    });

    if (count === 0) return 1.0;
    return totalMod / count;
}

function getDistanceCategory(distance        )         {
    if (distance <= 1400) return 1;
    if (distance <= 1800) return 2;
    if (distance <= 2400) return 3;
    return 4;
}

function calculateTargetSpeed(params                        )                    {
    const {
        courseDistance,
        courseId,
        currentDistance,
        speedStat,
        wisdomStat,
        powerStat,
        gutsStat = 0,
        staminaStat = 0,
        strategy,
        distanceProficiency,
        strategyProficiency,
        mood,
        isOonige,
        inLastSpurt,
        slope,
        greenSkillBonuses,
        activeSpeedBuff,
        isSpotStruggle,
        isDueling,
        isRushed,
        rushedType,
        activeSpeedDebuff,
        isPaceUp,
        isPaceDown,
        isSpeedUp,
        isOvertake,
        isDownhillMode,
    } = params;

    const trackSpeedMultiplier = getTrackStatThresholdModifier(courseId || 0, { speed: speedStat, stamina: staminaStat, power: powerStat, guts: gutsStat, wisdom: wisdomStat }, mood);

    const adjustedSpeed = adjustStat(speedStat, mood, 0) * trackSpeedMultiplier + (greenSkillBonuses?.speed ?? 0);
    const strategyProficiencyModifier = STRATEGY_PROFICIENCY_MODIFIER[strategyProficiency ?? 7] ?? 1.0;
    const adjustedWisdom = adjustStat(wisdomStat, mood) * strategyProficiencyModifier + (greenSkillBonuses?.wisdom ?? 0);
    const adjustedPower = adjustStat(powerStat, mood, greenSkillBonuses?.power);
    const adjustedGuts = adjustStat(gutsStat, mood, greenSkillBonuses?.guts);

    const baseSpeed = BASE_SPEED_CONSTANT - (courseDistance - BASE_SPEED_COURSE_OFFSET) / BASE_SPEED_COURSE_SCALE;

    let phase = 0; // 0: Early, 1: Mid, 2: Late/Last
    if (currentDistance >= courseDistance * 2 / 3) {
        phase = 2;
    } else if (currentDistance >= courseDistance / 6) {
        phase = 1;
    }

    let strategyCoeffs = STRATEGY_PHASE_COEFFS[strategy] || STRATEGY_PHASE_COEFFS[RaceSimulateHorseResultData_RunningStyle.NIGE];
    if (isOonige) {
        strategyCoeffs = OONIGE_COEFFS;
    }

    const phaseCoeff = strategyCoeffs[phase];
    let baseTargetSpeed = baseSpeed * phaseCoeff;

    const distMod = DISTANCE_PROFICIENCY_MODIFIER[distanceProficiency] || 1.0;
    const speedTerm = Math.sqrt(SPEED_TERM_COEFF * adjustedSpeed) * distMod * SPEED_TERM_SCALE;

    if (phase === 2) {
        baseTargetSpeed += speedTerm;
    }
    if (inLastSpurt) {
        const baseTargetSpeedPhase2 = baseSpeed * strategyCoeffs[2];
        const lateRaceBaseSpeed = baseTargetSpeedPhase2 + speedTerm;
        const gutsTerm = Math.pow(GUTS_TERM_BASE * adjustedGuts, GUTS_TERM_EXPONENT) * GUTS_TERM_SCALE;

        baseTargetSpeed = (lateRaceBaseSpeed + LAST_SPURT_BASE_RATIO * baseSpeed) * LAST_SPURT_MULTIPLIER + speedTerm + gutsTerm;
    }
    if (slope > 0) {
        const slopePer = slope / SLOPE_SCALE;
        const penalty = (slopePer * SLOPE_PENALTY_COEFF) / adjustedPower;
        baseTargetSpeed -= penalty;
    }
    // Note: Downhill non-mode logic is usually handled by consuming less HP, not increasing speed,
    // unless in Downhill Mode which is handled below.

    // Apply Position Keep Modifiers to Base Speed (before skills/downhill)
    let modeMultiplier = 1.0;
    if (isPaceUp || isSpeedUp) {
        modeMultiplier = PACE_UP_MULTIPLIER;
    } else if (isOvertake) {
        modeMultiplier = OVERTAKE_MULTIPLIER;
    } else if (isPaceDown) {
        modeMultiplier = PACE_DOWN_MULTIPLIER;
    }

    // Rushed type 2 is also a base speed multiplier
    if (isRushed && rushedType === 2) {
        modeMultiplier *= RUSHED_TYPE2_MULTIPLIER;
    }

    baseTargetSpeed *= modeMultiplier;

    if (isDownhillMode) {
        baseTargetSpeed += DOWNHILL_BONUS_BASE + Math.abs(slope) / DOWNHILL_BONUS_DIVISOR;
    }

    baseTargetSpeed += (activeSpeedBuff || 0);
    baseTargetSpeed -= (activeSpeedDebuff || 0);

    if (isSpotStruggle) {
        baseTargetSpeed += Math.pow(SPOT_STRUGGLE_GUTS_BASE * adjustedGuts, SPOT_STRUGGLE_GUTS_EXPONENT) * SPOT_STRUGGLE_GUTS_SCALE;
    }
    if (isDueling) {
        baseTargetSpeed += Math.pow(DUELING_GUTS_BASE * adjustedGuts, DUELING_GUTS_EXPONENT) * DUELING_GUTS_SCALE;
    }

    // If in Last Spurt, no Wit variance (or rather, we are at the max/fixed speed)
    if (inLastSpurt) {
        return {
            min: baseTargetSpeed,
            max: baseTargetSpeed,
            base: baseTargetSpeed,
        };
    }

    const logVal = Math.log10(adjustedWisdom * WISDOM_LOG_SCALE);
    const maxPct = (adjustedWisdom / WISDOM_VARIANCE_DIVISOR) * logVal;
    const minPct = maxPct - WISDOM_MIN_PCT_OFFSET;

    const maxSpeed = baseTargetSpeed + baseSpeed * (maxPct / 100);
    const minSpeed = baseTargetSpeed + baseSpeed * (minPct / 100);

    return {
        min: minSpeed,
        max: maxSpeed,
        base: baseTargetSpeed,
    };
}

function calculateLastSpurtTargetSpeedWithTruncatedLateRaceBase(params                        )         {
    const {
        courseDistance,
        courseId,
        speedStat,
        wisdomStat,
        powerStat,
        gutsStat = 0,
        staminaStat = 0,
        strategy,
        distanceProficiency,
        mood,
        isOonige,
        slope,
        greenSkillBonuses,
        activeSpeedBuff,
        isSpotStruggle,
        isDueling,
        isRushed,
        rushedType,
        activeSpeedDebuff,
        isPaceUp,
        isPaceDown,
        isSpeedUp,
        isOvertake,
        isDownhillMode,
    } = params;

    const trackSpeedMultiplier = getTrackStatThresholdModifier(courseId || 0, { speed: speedStat, stamina: staminaStat, power: powerStat, guts: gutsStat, wisdom: wisdomStat }, mood);
    const adjustedSpeed = adjustStat(speedStat, mood, 0) * trackSpeedMultiplier + (greenSkillBonuses?.speed ?? 0);
    const adjustedPower = adjustStat(powerStat, mood, greenSkillBonuses?.power);
    const adjustedGuts = adjustStat(gutsStat, mood, greenSkillBonuses?.guts);

    const baseSpeed = BASE_SPEED_CONSTANT - (courseDistance - BASE_SPEED_COURSE_OFFSET) / BASE_SPEED_COURSE_SCALE;

    let strategyCoeffs = STRATEGY_PHASE_COEFFS[strategy] || STRATEGY_PHASE_COEFFS[RaceSimulateHorseResultData_RunningStyle.NIGE];
    if (isOonige) {
        strategyCoeffs = OONIGE_COEFFS;
    }

    const distMod = DISTANCE_PROFICIENCY_MODIFIER[distanceProficiency] || 1.0;
    const speedTerm = Math.sqrt(SPEED_TERM_COEFF * adjustedSpeed) * distMod * SPEED_TERM_SCALE;
    const gutsTerm = Math.pow(GUTS_TERM_BASE * adjustedGuts, GUTS_TERM_EXPONENT) * GUTS_TERM_SCALE;
    const lateRaceBase = baseSpeed * strategyCoeffs[2] + speedTerm;
    const truncatedLateRaceBase = Math.floor(lateRaceBase * 100) / 100;

    let baseTargetSpeed = (truncatedLateRaceBase + LAST_SPURT_BASE_RATIO * baseSpeed) * LAST_SPURT_MULTIPLIER + speedTerm + gutsTerm;

    if (slope > 0) {
        const slopePer = slope / SLOPE_SCALE;
        const penalty = (slopePer * SLOPE_PENALTY_COEFF) / adjustedPower;
        baseTargetSpeed -= penalty;
    }

    let modeMultiplier = 1.0;
    if (isPaceUp || isSpeedUp) {
        modeMultiplier = PACE_UP_MULTIPLIER;
    } else if (isOvertake) {
        modeMultiplier = OVERTAKE_MULTIPLIER;
    } else if (isPaceDown) {
        modeMultiplier = PACE_DOWN_MULTIPLIER;
    }

    if (isRushed && rushedType === 2) {
        modeMultiplier *= RUSHED_TYPE2_MULTIPLIER;
    }

    baseTargetSpeed *= modeMultiplier;

    if (isDownhillMode) {
        baseTargetSpeed += DOWNHILL_BONUS_BASE + Math.abs(slope) / DOWNHILL_BONUS_DIVISOR;
    }

    baseTargetSpeed += (activeSpeedBuff || 0);
    baseTargetSpeed -= (activeSpeedDebuff || 0);

    if (isSpotStruggle) {
        baseTargetSpeed += Math.pow(SPOT_STRUGGLE_GUTS_BASE * adjustedGuts, SPOT_STRUGGLE_GUTS_EXPONENT) * SPOT_STRUGGLE_GUTS_SCALE;
    }
    if (isDueling) {
        baseTargetSpeed += Math.pow(DUELING_GUTS_BASE * adjustedGuts, DUELING_GUTS_EXPONENT) * DUELING_GUTS_SCALE;
    }

    return baseTargetSpeed;
}

function calculateReferenceHpConsumption(speed        , courseDistance        ) {
    const baseSpeed = BASE_SPEED_CONSTANT - (courseDistance - BASE_SPEED_COURSE_OFFSET) / BASE_SPEED_COURSE_SCALE;
    return HP_CONSUMPTION_SCALE * Math.pow(Math.max(0, speed - baseSpeed + HP_CONSUMPTION_SPEED_OFFSET), 2) / HP_CONSUMPTION_DIVISOR;
}

// Source: src/components/RaceReplay/utils/SkillDataUtils.ts


function getSkillDef(skillId        )                    {
    const direct = UMDatabaseWrapper.skills[skillId];
    if (direct) return direct;

    // Handle inherited unique skills (9xxxxx) — look up parent (1xxxxx)
    if (skillId >= 900000 && skillId < 1000000) {
        return UMDatabaseWrapper.skills[skillId - 800000];
    }
    return undefined;
}

function getSkillConditionGroup(skillId        , conditionGroupIndex         ) {
    const def = getSkillDef(skillId);
    if (!def || def.conditionGroups.length === 0) return undefined;

    if (
        conditionGroupIndex !== undefined
        && Number.isInteger(conditionGroupIndex)
        && conditionGroupIndex >= 0
        && conditionGroupIndex < def.conditionGroups.length
    ) {
        return def.conditionGroups[conditionGroupIndex];
    }

    return def.conditionGroups[0];
}

function getPassiveStatModifiers(skillId        , conditionGroupIndex         )                            {
    const def = getSkillDef(skillId);
    if (!def || def.conditionGroups.length === 0) return {};

    const mods                            = { speed: 0, stamina: 0, power: 0, guts: 0, wisdom: 0 };

    const groups = conditionGroupIndex === undefined
        ? def.conditionGroups
        : [getSkillConditionGroup(skillId, conditionGroupIndex)].filter(group => group !== undefined);

    groups.forEach(group => {
        group.effects.forEach(eff => {
            const val = eff.value / 10000; // e.g. 400000 -> 40
            switch (eff.type) {
                case 1: mods.speed += val; break;
                case 2: mods.stamina += val; break;
                case 3: mods.power += val; break;
                case 4: mods.guts += val; break;
                case 5: mods.wisdom += val; break;
            }
        });
    });
    return mods;
}

function getRushedChanceModifier(skillId        , conditionGroupIndex         )         {
    const def = getSkillDef(skillId);
    if (!def || def.conditionGroups.length === 0) return 0;

    const groups = conditionGroupIndex === undefined
        ? def.conditionGroups
        : [getSkillConditionGroup(skillId, conditionGroupIndex)].filter(group => group !== undefined);
    return groups.reduce((total, group) => total + group.effects.reduce(
        (groupTotal, effect) => groupTotal + (effect.type === 29 ? effect.value / 10000 : 0),
        0,
    ), 0);
}

// Hardcoded for special skills whose effects are custom-scripted and absent from skill_data
const HARDCODED_SPEED_MODIFIERS                         = {
    210061: 0.3,
    210062: 0.06,
};

const UNIQUE_SKILL_LEVEL_SPEED_MULTIPLIERS = [1, 1.01, 1.04, 1.07, 1.10, 1.13];
const HIGHEST_STAT_SCALING_SKILLS = new Set([210081, 210082]);

// Skills whose speed effect scales with the runner's fan count rather than being the flat
// value published in skill_data.
const FAN_COUNT_SCALING_SKILLS = new Set([
    210071, // I Wanna Win with You
    210072, // On the Way to Our Dream
]);

// Skills where only PART of the skill_data speed value scales, with the number of green skills
// the runner activated. The scaled portion is listed here; the rest of the value is flat.
// 100981 Luck Runs My Way: effects are 0.25 + 0.05, of which the 0.05 is the scaling step.
const GREEN_SKILL_COUNT_SCALED_PORTION                         = {
    100981: 0.05,
};

// These uniques start with a base type-27 speed modifier, then add the second
// type-27 value once for each subsequent skill activation, up to three times.
// skill_data stores the base and per-activation increment but not the repeat cap.
const PROGRESSIVE_ACTIVATION_SPEED_SKILLS                                                                             = {
    110351: { base: 0.25, increment: 0.05, maxIncrements: 3 },
    910351: { base: 0.05, increment: 0.05, maxIncrements: 3 },
};

// Stat-modifier effect types. A green skill is a passive that grants one of these.
const GREEN_SKILL_STAT_EFFECT_TYPES = new Set([1, 2, 3, 4, 5]);

const UNITY_CUP_SKILL_TEAM_STAT                                = {
    210011: "speed",
    210012: "speed",
    210021: "stamina",
    210022: "stamina",
    210031: "pow",
    210032: "pow",
    210041: "guts",
    210042: "guts",
    210051: "wiz",
    210052: "wiz",
};

function getUnityCupEffectMultiplier(skillId        , stats                    )         {
    const teamStat = UNITY_CUP_SKILL_TEAM_STAT[skillId];
    const total = teamStat ? stats?.unityTeamStats?.[teamStat] : undefined;
    if (total === undefined || !Number.isFinite(total)) return 1;
    if (total < 1200) return 0.8;
    if (total < 1800) return 0.9;
    if (total < 2600) return 1.0;
    if (total < 3600) return 1.1;
    return 1.2;
}

/**
 * Green skills resolve on frame 0, but frame 0 is not enough on its own to identify them:
 * skills like 202051 (Runaway, effect type 6) and 200432 (Focus, effect type 10) also report a
 * frame time of 0 without being passives. What makes a skill green is that it grants a stat
 * modifier, so require both.
 */
function isGreenSkill(skillId        )          {
    const def = getSkillDef(skillId);
    if (!def) return false;
    return def.conditionGroups.some(group =>
        group.effects.some(eff => GREEN_SKILL_STAT_EFFECT_TYPES.has(eff.type)));
}

function countGreenSkills(activations                                      )         {
    if (!activations) return 0;
    const green = new Set        ();
    for (const activation of activations) {
        if (Math.abs(activation.time) > 1e-9) continue; // frame 0 only
        const skillId = activation.param[1];
        if (isGreenSkill(skillId)) green.add(skillId);
    }
    return green.size;
}

function applyUniqueSkillLevelScaling(skillId        , speed        , skillLevel         )         {
    if (skillId >= 200000 || speed <= 0) return speed;
    const level = Math.max(1, Math.min(6, Math.floor(skillLevel ?? 1)));
    return speed * UNIQUE_SKILL_LEVEL_SPEED_MULTIPLIERS[level - 1];
}

function getHighestStatScalingMultiplier(stats                    )         {
    if (!stats) return 1;
    const highest = Math.max(stats.speed, stats.stamina, stats.pow, stats.guts, stats.wiz);
    if (highest < 600) return 0.8;
    if (highest < 800) return 0.9;
    if (highest < 1000) return 1.0;
    if (highest < 1100) return 1.1;
    return 1.2;
}

function getFanCountScalingMultiplier(fanCount         )         {
    if (fanCount === undefined || !Number.isFinite(fanCount)) return 1.2;
    if (fanCount < 20000) return 0.8;
    if (fanCount < 50000) return 0.9;
    if (fanCount < 100000) return 1.0;
    if (fanCount < 160000) return 1.1;
    return 1.2;
}

function getGreenSkillCountMultiplier(greenSkillCount         )         {
    const count = greenSkillCount ?? 0;
    if (count < 3) return 0;
    if (count < 5) return 1;
    if (count === 5) return 2;
    return 3;
}

function applySpecialSpeedScaling(skillId        , speed        , stats                    )         {
    if (speed <= 0) return speed;
    if (skillId in UNITY_CUP_SKILL_TEAM_STAT) {
        return speed * getUnityCupEffectMultiplier(skillId, stats);
    }
    if (HIGHEST_STAT_SCALING_SKILLS.has(skillId)) {
        return speed * getHighestStatScalingMultiplier(stats);
    }
    if (FAN_COUNT_SCALING_SKILLS.has(skillId)) {
        return speed * getFanCountScalingMultiplier(stats?.fanCount);
    }
    const scaledPortion = GREEN_SKILL_COUNT_SCALED_PORTION[skillId];
    if (scaledPortion !== undefined) {
        // skill_data already bakes in one step of the scaled portion; swap it for the real one.
        return speed - scaledPortion + scaledPortion * getGreenSkillCountMultiplier(stats?.greenSkillCount);
    }
    return speed;
}

function getActiveSpeedModifier(
    skillId        ,
    conditionGroupIndex         ,
    skillLevel         ,
    stats                    ,
    subsequentActivationCount         ,
)         {
    if (skillId in HARDCODED_SPEED_MODIFIERS) return HARDCODED_SPEED_MODIFIERS[skillId];

    const group = getSkillConditionGroup(skillId, conditionGroupIndex);
    if (!group) return 0;

    const progressive = PROGRESSIVE_ACTIVATION_SPEED_SKILLS[skillId];
    let speedInc        ;
    if (progressive && subsequentActivationCount !== undefined) {
        const increments = Math.max(0, Math.min(progressive.maxIncrements, Math.floor(subsequentActivationCount)));
        speedInc = progressive.base + progressive.increment * increments;
    } else {
        speedInc = 0;
        group.effects.forEach(eff => {
            if (eff.type === 22 || eff.type === 27) {
                speedInc += eff.value / 10000; // e.g. 4500 -> 0.45 m/s
            }
        });
    }
    return applySpecialSpeedScaling(skillId, applyUniqueSkillLevelScaling(skillId, speedInc, skillLevel), stats);
}

function getActiveSpeedDebuff(skillId        , conditionGroupIndex         )         {
    const group = getSkillConditionGroup(skillId, conditionGroupIndex);
    if (!group) return 0;

    let speedDec = 0;
    group.effects.forEach(eff => {
        if (eff.type === 21) {
            speedDec += Math.abs(eff.value) / 10000;
        }
    });
    return speedDec;
}

function hasTargetDebuffEffect(skillId        , conditionGroupIndex         )          {
    const group = getSkillConditionGroup(skillId, conditionGroupIndex);
    if (!group) return false;

    // Targeting is established from the race event's target bitmask. Any negative
    // effect in that group is therefore a debuff, regardless of its effect type.
    return group.effects.some(eff => eff.value < 0 || eff.type === 13);
}

function hasSkillEffect(skillId        , effectType        , conditionGroupIndex         )          {
    if (conditionGroupIndex !== undefined) {
        const group = getSkillConditionGroup(skillId, conditionGroupIndex);
        return group?.effects.some(eff => eff.type === effectType) ?? false;
    }

    const def = getSkillDef(skillId);
    if (!def || def.conditionGroups.length === 0) return false;

    return def.conditionGroups.some(group =>
        group.effects.some(eff => eff.type === effectType)
    );
}

function getRushedDebuffDurationSecs(skillId        , conditionGroupIndex         )         {
    const group = getSkillConditionGroup(skillId, conditionGroupIndex);
    if (!group) return 0;

    return group.effects.reduce((duration, effect) => (
        effect.type === 13 && effect.value > 0
            ? Math.max(duration, effect.value / 10000)
            : duration
    ), 0);
}

function getHpDrainRatio(skillId        , conditionGroupIndex         )         {
    const group = getSkillConditionGroup(skillId, conditionGroupIndex);
    if (!group) return 0;

    return group.effects.reduce((total, effect) => (
        effect.type === 9 && effect.value < 0
            ? total + Math.abs(effect.value) / 10000
            : total
    ), 0);
}

function getSkillBaseTime(skillId        , conditionGroupIndex         )         {
    return getSkillConditionGroup(skillId, conditionGroupIndex)?.baseTime ?? 0;
}

// Skill timing is hybrid:
// - frame_time === 0 skills still use the local base_time calculation
// - later skills trust the server-reported duration in param[2]
// - 0 / -1 / missing durations fall back to 2 seconds
function getSkillDurationSecs(
    skillId        ,
    courseDistance        ,
    frameTime         ,
    reportedDurationParam         ,
    conditionGroupIndex
)         {
    if (frameTime != null && Math.abs(frameTime) > 1e-9) {
        if (reportedDurationParam != null && reportedDurationParam > 0) {
            return reportedDurationParam / 10000;
        }
        return 2;
    }

    const baseTime = getSkillBaseTime(skillId, conditionGroupIndex);
    if (baseTime > 0) return (baseTime / 10000) * (courseDistance / 1000);
    return 2;
}

// Source: src/data/RaceDataUtils.ts


// Return undefined when the detector cannot decide, so the recorded bitmask remains the fallback.

const customSkillHitDetectors = new Map                                ();
const OPPONENTS_AHEAD_TARGET_DISTANCE_AMBIGUITY = 0.2;

function registerCustomSkillHitDetector(skillIds          , detector                        )       {
    skillIds.forEach(skillId => customSkillHitDetectors.set(skillId, detector));
}

function distanceAtTime(raceSimulateData                  , frameOrder        , time        )                     {
    const frames = raceSimulateData.frame ?? [];
    if (frames.length === 0) return undefined;
    let previous = frames[0];
    for (let index = 1; index < frames.length; index++) {
        const next = frames[index];
        if ((next.time ?? 0) >= time) {
            const previousHorse = previous.horseFrame?.[frameOrder];
            const nextHorse = next.horseFrame?.[frameOrder];
            if (!previousHorse || !nextHorse) return undefined;
            const previousTime = previous.time ?? 0;
            const nextTime = next.time ?? previousTime;
            const ratio = nextTime > previousTime ? (time - previousTime) / (nextTime - previousTime) : 0;
            return (previousHorse.distance ?? 0) + ((nextHorse.distance ?? 0) - (previousHorse.distance ?? 0)) * ratio;
        }
        previous = next;
    }
    return previous.horseFrame?.[frameOrder]?.distance;
}

function horseInfoByFrameOrder(raceHorseInfo                   , frameOrder        )                  {
    return raceHorseInfo?.find(horse => Number(horse?.frame_order ?? horse?.frameOrder) - 1 === frameOrder);
}

const opponentsAheadHitDetector                         = ({ raceSimulateData, raceHorseInfo, event, casterFrameOrder, targetFrameOrder }) => {
    if (targetFrameOrder === casterFrameOrder) return false;
    const casterInfo = horseInfoByFrameOrder(raceHorseInfo, casterFrameOrder);
    const targetInfo = horseInfoByFrameOrder(raceHorseInfo, targetFrameOrder);
    const casterTeamId = Number(casterInfo?.team_id ?? casterInfo?.teamId ?? 0);
    const targetTeamId = Number(targetInfo?.team_id ?? targetInfo?.teamId ?? 0);
    if (casterTeamId > 0 && targetTeamId === casterTeamId) return false;

    const activationTime = event.frameTime ?? 0;
    const casterDistance = distanceAtTime(raceSimulateData, casterFrameOrder, activationTime);
    const targetDistance = distanceAtTime(raceSimulateData, targetFrameOrder, activationTime);
    if (casterDistance === undefined || targetDistance === undefined) return undefined;
    if (Math.abs(targetDistance - casterDistance) <= OPPONENTS_AHEAD_TARGET_DISTANCE_AMBIGUITY) {
        return targetDistance > casterDistance ? "ambiguous-hit" : "ambiguous-miss";
    }
    return targetDistance > casterDistance;
};

registerCustomSkillHitDetector([200691, 200692, 110301, 910301], opponentsAheadHitDetector);

// frameOrder should be 0-indexed.
function filterRaceEvents(raceSimulateData                  , frameOrder        , eventType                                         )                          {
    return raceSimulateData.event.map(e => e.event )
        .filter(event => event.type === eventType && event.param[0] === frameOrder);
}

// frameOrder should be 0-indexed.
function filterCharaSkills(raceSimulateData                  , frameOrder        )                          {
    return filterRaceEvents(raceSimulateData, frameOrder, RaceSimulateEventData_SimulateEventType.SKILL);
}

// frameOrder should be 0-indexed.
function getCharaActivatedSkillIds(raceSimulateData                  , frameOrder        )              {
    return new Set(filterCharaSkills(raceSimulateData, frameOrder).map(event => event.param[1]));
}

function isSkillEventTargetingFrame(
    raceSimulateData                  ,
    event                       ,
    targetFrameOrder        ,
    raceHorseInfo        ,
)          {
    const state = getSkillEventTargetingState(raceSimulateData, event, targetFrameOrder, raceHorseInfo);
    return state === "hit" || state === "ambiguous-hit";
}

function getSkillEventTargetingState(
    raceSimulateData                  ,
    event                       ,
    targetFrameOrder        ,
    raceHorseInfo        ,
)                      {
    if (event.param[0] === targetFrameOrder) return "miss";
    const detector = customSkillHitDetectors.get(event.param[1]);
    if (detector) {
        const customHit = detector({
            raceSimulateData,
            raceHorseInfo,
            event,
            casterFrameOrder: event.param[0],
            targetFrameOrder,
        });
        if (typeof customHit === "string") return customHit;
        if (customHit !== undefined) return customHit ? "hit" : "miss";
    }
    return event.paramCount  >= 5 && Boolean(event.param[4] & (1 << targetFrameOrder)) ? "hit" : "miss";
}

// frameOrder should be 0-indexed. This excludes skills casted by self.
function filterCharaTargetedSkills(raceSimulateData                  , frameOrder        , raceHorseInfo        )                          {
    return raceSimulateData.event.map(e => e.event )
        .filter(event => event.type === RaceSimulateEventData_SimulateEventType.SKILL &&
            isSkillEventTargetingFrame(raceSimulateData, event, frameOrder, raceHorseInfo));
}

// Source: src/components/RaceReplay/utils/analysisUtils.ts


// Dueling detection
const DUELING_HP_THRESHOLD_RATIO = 0.05;   // Dueling ends if HP drops below this fraction of starting HP
const DUEL_UPHILL_SPEED_SLACK = 0.2;       // Min gap between target and current speed to check if duel resumes
const DUEL_ENTRY_ACCEL_MAX = 0.1;          // Max acceleration at duel start to consider early exit
const DUEL_RESUME_SPEED_SLACK = 0.02;      // Speed must exceed target + downhill bonus + this to count as resumed
const DUEL_RECENT_UPHILL_EXIT_GRACE = 4.0; // Avoid ending duel while speed is still recovering from an uphill penalty
const DUEL_MAX_OPPONENT_GAP = 5.0;         // Dueling ends once every current/former dueler is at least this far away

// Spot Struggle (COMPETE_TOP)
const SPOT_STRUGGLE_DIST_RATIO = 9 / 24;           // Only active before this fraction of course distance
const SPOT_STRUGGLE_GUTS_DURATION_BASE = 700;       // Math.pow(BASE * guts, EXPONENT) * SCALE → duration
const SPOT_STRUGGLE_GUTS_DURATION_EXPONENT = 0.5;
const SPOT_STRUGGLE_GUTS_DURATION_SCALE = 0.012;

// Max adjusted speed calculation
const DECELERATION_THRESHOLD = -0.05;      // m/s²: frames with accel below this are skipped
const DUELING_FRAME_LOOKAHEAD = 2;         // Frames to skip after dueling ends before counting peak speed
const DUELING_END_TIME_LOOKAHEAD = 1.5;    // Seconds to skip after dueling expires; raw speed can lag behind the lower target
const SPEED_BUFF_DROP_FRAME_LOOKAHEAD = 0; // Skip the drop frame; dense snapshots are covered by the time lookahead
const SPEED_BUFF_DROP_TIME_LOOKAHEAD = 0.5; // Seconds to skip after a speed skill falls off when snapshots are dense
const TYPE_28_POWER_SPEED_SCALE = 0.0002;
const LAST_SPURT_HIGH_SPEED_TOLERANCE = 0.05;
const SPEED_COMPARISON_EPSILON = 1e-9;
const GAME_TICK_SECONDS = 1 / 15;
const MAX_AMBIGUOUS_DEBUFFS_TO_ENUMERATE = 12;
const DOWNHILL_EXIT_DISTANCE_GRACE = 10;   // Compensate sampled speed that retains the downhill bonus just past the slope boundary
const DOWNHILL_EXIT_REJECTION_GRACE = 11;  // In the outer fringe, reject only clearly high observations instead of subtracting the full bonus
const PROGRESSIVE_ACTIVATION_SPEED_SKILL_IDS = new Set([110351, 910351]);

function computeGroundHpModifier(surface        , condition        )         {
    if (surface === 1) {
        if (condition === 3 || condition === 4) return 1.02;
    } else if (surface === 2) {
        if (condition === 3) return 1.01;
        if (condition === 4) return 1.02;
    }
    return 1.0;
}

// HP outcome calculation
const DEATH_EPSILON = 0.1;                 // Horse is considered to have died before finish if dist < raceDistance - this
const HP_STATUS_MODIFIER_GUTS_BASE = 600;  // Guts scaling base: 1 + COEFF / sqrt(BASE * guts)
const HP_STATUS_MODIFIER_COEFF = 200;

function computeOtherEvents(
    raceData                  ,
    raceHorseInfo       ,
    detectedCourseId                    ,
    skillActivations                                                                   ,
    goalInX        ,
    groundCondition
)                                                                     {
    const allOtherEvents                                                                     = {};
    if (!raceData.frame || raceData.frame.length === 0) {
        return allOtherEvents;
    }

    const charaData = new Map                          ();
    const charaRawData = new Map             ();
    if (raceHorseInfo) {
        raceHorseInfo.forEach((data, index) => {
            const frameOrder = (data['frame_order'] ?? data.frameOrder ?? (index + 1)) - 1;
            charaData.set(frameOrder, fromRaceHorseData(data));
            charaRawData.set(frameOrder, data);
        });
    }

    const distanceCategory = getDistanceCategory(goalInX);
    const trackSlopes = detectedCourseId ? (GameDataLoader.courseData       )[detectedCourseId]?.slopes ?? [] : [];
    const surface         = detectedCourseId ? (GameDataLoader.courseData       )[detectedCourseId]?.surface ?? 0 : 0;
    const groundPowerBonus = computeGroundPowerBonus(surface, groundCondition ?? 0);
    const duelStartTimeByFrameOrder = new Map                ();
    for (const event of raceData.event) {
        const e = event.event;
        if (e?.type !== RaceSimulateEventData_SimulateEventType.COMPETE_FIGHT) continue;
        duelStartTimeByFrameOrder.set(
            e.param[0],
            Math.min(duelStartTimeByFrameOrder.get(e.param[0]) ?? Infinity, e.frameTime ?? 0)
        );
    }

    for (const event of raceData.event) {
        const e = event.event ;
        const frameOrder = e.param[0];
        const startTime = e.frameTime ;

        if (e.type === RaceSimulateEventData_SimulateEventType.SKILL) {
            const rushedDuration = getRushedDebuffDurationSecs(e.param[1], e.param?.[3]);
            if (rushedDuration > 0) {
                for (let targetFrameOrder = 0; targetFrameOrder < raceData.horseResult.length; targetFrameOrder++) {
                    if (!isSkillEventTargetingFrame(raceData, e, targetFrameOrder, raceHorseInfo)) continue;
                    if (!allOtherEvents[targetFrameOrder]) allOtherEvents[targetFrameOrder] = [];
                    allOtherEvents[targetFrameOrder].push({
                        time: startTime,
                        duration: rushedDuration,
                        name: "Rushed (Frenzied)",
                    });
                }
            }
        }

        if (e.type === RaceSimulateEventData_SimulateEventType.COMPETE_FIGHT) {
            const startHp = raceData.frame[0].horseFrame[frameOrder].hp ;
            const hpThreshold = startHp * DUELING_HP_THRESHOLD_RATIO;
            const lastFrameTime = raceData.frame[raceData.frame.length - 1].time ;
            const rawFinishTime = raceData.horseResult[frameOrder]?.finishTimeRaw;
            const finishTime = typeof rawFinishTime === "number" && rawFinishTime > 0
                ? rawFinishTime
                : lastFrameTime;
            let endTime = Math.min(lastFrameTime, finishTime);

            // Prepare data for speed check
            const trainedChara = charaData.get(frameOrder);
            const rawData = charaRawData.get(frameOrder);
            let checkSpeedCriteria = false;
            let passiveStats = { speed: 0, stamina: 0, power: 0, guts: 0, wisdom: 0 };
            let isOonige = false;
            let strategy = 1;
            let strategyProficiency = 7;
            let learnedSkillLevelById = new Map                ();
            let hasFullSpurtHp = true;
            const targetedSkillActivations = filterCharaTargetedSkills(raceData, frameOrder, raceHorseInfo);
            const scalingStats                                = trainedChara
                ? { ...trainedChara, greenSkillCount: countGreenSkills(skillActivations?.[frameOrder]) }
                : undefined;

            if (trainedChara && rawData) {
                checkSpeedCriteria = true;
                learnedSkillLevelById = new Map(trainedChara.skills.map(skill => [skill.skillId, skill.level]));
                // Passives
                const skillEvents = filterCharaSkills(raceData, frameOrder);
                const activatedSkillGroups = new Map(skillEvents.map(ev => [ev.param[1], ev.param?.[3]]));
                const activatedSkillIds = new Set(activatedSkillGroups.keys());
                activatedSkillGroups.forEach((conditionGroupIndex, id) => {
                    const mods = getPassiveStatModifiers(id, conditionGroupIndex);
                    passiveStats.speed += (mods.speed || 0);
                    passiveStats.stamina += (mods.stamina || 0);
                    passiveStats.power += (mods.power || 0);
                    passiveStats.guts += (mods.guts || 0);
                    passiveStats.wisdom += (mods.wisdom || 0);
                });
                if (activatedSkillIds.has(202051)) isOonige = true;

                const runningStyleStr = rawData.running_style ?? 0;
                strategy = +runningStyleStr > 0 ? +runningStyleStr : (trainedChara.rawData?.param?.runningStyle ?? 1);
                strategyProficiency = trainedChara.properRunningStyles[isOonige ? 1 : strategy] ?? 7;

                let hpAtPhase3Start                    ;
                const phase3StartDist = goalInX * 2 / 3;
                for (const frame of raceData.frame) {
                    const h = frame.horseFrame?.[frameOrder];
                    if (h && (h.distance ?? 0) >= phase3StartDist) {
                        hpAtPhase3Start = h.hp ?? undefined;
                        break;
                    }
                }

                if (hpAtPhase3Start !== undefined) {
                    const fullSpurtTarget = calculateTargetSpeed({
                        courseDistance: goalInX,
                        courseId: detectedCourseId,
                        currentDistance: goalInX,
                        speedStat: trainedChara.speed,
                        wisdomStat: trainedChara.wiz,
                        powerStat: trainedChara.pow,
                        gutsStat: trainedChara.guts,
                        staminaStat: trainedChara.stamina,
                        strategy,
                        distanceProficiency: trainedChara.properDistances[distanceCategory] ?? 1,
                        strategyProficiency,
                        mood: rawData['motivation'],
                        isOonige,
                        inLastSpurt: true,
                        slope: 0,
                        greenSkillBonuses: passiveStats,
                        activeSpeedBuff: 0,
                        isDueling: false,
                        isSpotStruggle: false
                    }).base;
                    const adjustedGuts = adjustStat(trainedChara.guts, rawData['motivation'], passiveStats.guts);
                    if (fullSpurtTarget > 0 && adjustedGuts > 0) {
                        const baseSpeed = BASE_SPEED_CONSTANT - (goalInX - BASE_SPEED_COURSE_OFFSET) / BASE_SPEED_COURSE_SCALE;
                        const gutsModifier = 1.0 + 200 / Math.sqrt(600 * adjustedGuts);
                        const baseHpDrain = HP_CONSUMPTION_SCALE * Math.pow(fullSpurtTarget - baseSpeed + HP_CONSUMPTION_SPEED_OFFSET, 2) / HP_CONSUMPTION_DIVISOR;
                        const totalHpDrain = baseHpDrain * computeGroundHpModifier(surface, groundCondition ?? 0) * gutsModifier;
                        const requiredSpurtHp = ((goalInX / 3 - 62) / fullSpurtTarget) * totalHpDrain;
                        hasFullSpurtHp = hpAtPhase3Start >= requiredSpurtHp;
                    }
                }
            }

            // Find start frame index
            let startIndex = 0;
            for (let i = 0; i < raceData.frame.length; i++) {
                if (raceData.frame[i].time  >= startTime) {
                    startIndex = i;
                    break;
                }
            }
            let lastUphillAffectedTime = -Infinity;
            for (let i = startIndex; i < raceData.frame.length; i++) {
                const frame = raceData.frame[i];
                const frameTime = frame.time ?? 0;
                if (frameTime >= finishTime) {
                    endTime = Math.min(endTime, finishTime);
                    break;
                }

                if (frame.horseFrame[frameOrder].hp  < hpThreshold) {
                    endTime = Math.min(frameTime, finishTime);
                    break;
                }

                const currentDistance = frame.horseFrame[frameOrder].distance ?? 0;
                const relevantDuelerDistances = Array.from(duelStartTimeByFrameOrder.entries())
                    .filter(([otherFrameOrder, otherStartTime]) =>
                        otherFrameOrder !== frameOrder
                        && otherStartTime <= frameTime
                        && frame.horseFrame[otherFrameOrder] !== undefined
                    )
                    .map(([otherFrameOrder]) => frame.horseFrame[otherFrameOrder].distance ?? 0);
                if (
                    relevantDuelerDistances.length > 0
                    && relevantDuelerDistances.every(distance =>
                        Math.abs(distance - currentDistance) >= DUEL_MAX_OPPONENT_GAP
                    )
                ) {
                    endTime = Math.min(frameTime, finishTime);
                    break;
                }

                // Speed Check
                if (checkSpeedCriteria && trainedChara) {
                    const h = frame.horseFrame[frameOrder];
                    const currentSpeed = (h.speed ?? 0) / 100;

                    let accel = 0;
                    if (i < raceData.frame.length - 1) {
                        const nextFrame = raceData.frame[i + 1];
                        const nextH = nextFrame.horseFrame[frameOrder];
                        const nextSpeed = (nextH.speed ?? 0) / 100;
                        const dt = (nextFrame.time  - frame.time );
                        if (dt > 0) {
                            accel = (nextSpeed - currentSpeed) / dt;
                        }
                    }

                    let activeSpeedBuff = 0;
                    if (skillActivations && skillActivations[frameOrder]) {
                        skillActivations[frameOrder].forEach(s => {
                            const duration = getSkillDurationSecs(s.param[1], goalInX, s.time, s.param?.[2], s.param?.[3]);
                            if (frameTime >= s.time && frameTime < s.time + duration) {
                                activeSpeedBuff += getActiveSpeedModifier(
                                    s.param[1],
                                    s.param?.[3],
                                    (s       ).skillLevel ?? learnedSkillLevelById.get(s.param[1]),
                                    scalingStats
                                );
                            }
                        });
                    }
                    targetedSkillActivations.forEach(s => {
                        const duration = getSkillDurationSecs(s.param[1], goalInX, s.frameTime, s.param?.[2], s.param?.[3]);
                        if (frameTime >= s.frameTime && frameTime < s.frameTime + duration) {
                            activeSpeedBuff -= getActiveSpeedDebuff(s.param[1], s.param?.[3]);
                        }
                    });

                    const targetRes = calculateTargetSpeed({
                        courseDistance: goalInX,
                        courseId: detectedCourseId,
                        currentDistance: h.distance ?? 0,
                        speedStat: trainedChara.speed,
                        wisdomStat: trainedChara.wiz,
                        powerStat: trainedChara.pow,
                        gutsStat: trainedChara.guts,
                        staminaStat: trainedChara.stamina,
                        strategy,
                        distanceProficiency: trainedChara.properDistances[distanceCategory] ?? 1,
                        strategyProficiency,
                        mood: rawData['motivation'],
                        isOonige,
                        inLastSpurt: (raceData.horseResult[frameOrder]?.lastSpurtStartDistance ?? -1) > 0
                            && (h.distance ?? 0) >= (raceData.horseResult[frameOrder]?.lastSpurtStartDistance ?? -1),
                        slope: 0,
                        greenSkillBonuses: passiveStats,
                        activeSpeedBuff: activeSpeedBuff,
                        isDueling: true,
                        isSpotStruggle: false
                    });

                    const dist = h.distance ?? 0;
                    const currentSlopeObj = trackSlopes.find((s     ) => dist >= s.start && dist < s.start + s.length);
                    const currentSlope = currentSlopeObj?.slope ?? 0;
                    if (currentSlope > 0) {
                        const slopePer = currentSlope / SLOPE_SCALE;
                        const adjustedPower = adjustStat(trainedChara.pow, rawData['motivation'], passiveStats.power + groundPowerBonus);
                        const penalty = (slopePer * SLOPE_PENALTY_COEFF) / adjustedPower;
                        targetRes.base -= penalty;
                    }

                    let isAffectedByUphill = currentSlope > 0;
                    if (!isAffectedByUphill && i < raceData.frame.length - 1) {
                        const nextFrame = raceData.frame[i + 1];
                        const nextH = nextFrame.horseFrame[frameOrder];
                        const nextDist = nextH.distance ?? 0;
                        const nextSlopeObj = trackSlopes.find((s     ) => nextDist >= s.start && nextDist < s.start + s.length);
                        const nextSlope = nextSlopeObj?.slope ?? 0;
                        if (nextSlope > 0) isAffectedByUphill = true;
                    }

                    if (isAffectedByUphill) {
                        lastUphillAffectedTime = frameTime;
                    }

                    const recentlyExitedUphill = frameTime - lastUphillAffectedTime <= DUEL_RECENT_UPHILL_EXIT_GRACE;
                    const inLastSpurt = (h.distance ?? 0) > (raceData.horseResult[frameOrder]?.lastSpurtStartDistance ?? 999999);
                    if (
                        (!inLastSpurt || hasFullSpurtHp)
                        && !isAffectedByUphill
                        && !recentlyExitedUphill
                        && (targetRes.base > currentSpeed + DUEL_UPHILL_SPEED_SLACK)
                        && (accel < DUEL_ENTRY_ACCEL_MAX)
                    ) {
                        let duelResumed = false;
                        for (let j = i + 1; j < raceData.frame.length; j++) {
                            const futureFrame = raceData.frame[j];
                            const futureH = futureFrame.horseFrame[frameOrder];
                            const futureSpeed = (futureH.speed ?? 0) / 100;
                            const futureTime = futureFrame.time ?? 0;
                            if (futureTime >= finishTime) break;
                            const futureDist = futureH.distance ?? 0;
                            if (futureDist > goalInX) break;

                            let futureIsDecelerating = false;
                            const previousFutureFrame = raceData.frame[j - 1];
                            const previousFutureH = previousFutureFrame?.horseFrame?.[frameOrder];
                            if (previousFutureH) {
                                const dt = futureTime - (previousFutureFrame.time ?? futureTime);
                                if (dt > 0) {
                                    const previousFutureSpeed = (previousFutureH.speed ?? 0) / 100;
                                    futureIsDecelerating = (futureSpeed - previousFutureSpeed) / dt < DECELERATION_THRESHOLD;
                                }
                            }
                            if (!futureIsDecelerating && j < raceData.frame.length - 1) {
                                const nextFutureFrame = raceData.frame[j + 1];
                                const nextFutureH = nextFutureFrame?.horseFrame?.[frameOrder];
                                if (nextFutureH) {
                                    const dt = (nextFutureFrame.time ?? futureTime) - futureTime;
                                    if (dt > 0) {
                                        const nextFutureSpeed = (nextFutureH.speed ?? 0) / 100;
                                        futureIsDecelerating = (nextFutureSpeed - futureSpeed) / dt < DECELERATION_THRESHOLD;
                                    }
                                }
                            }

                            let futureActiveSpeedBuff = 0;
                            if (skillActivations && skillActivations[frameOrder]) {
                                skillActivations[frameOrder].forEach(s => {
                                    const dur = getSkillDurationSecs(s.param[1], goalInX, s.time, s.param?.[2], s.param?.[3]);
                                    if (futureTime >= s.time && futureTime < s.time + dur) {
                                        futureActiveSpeedBuff += getActiveSpeedModifier(
                                            s.param[1],
                                            s.param?.[3],
                                            (s       ).skillLevel ?? learnedSkillLevelById.get(s.param[1]),
                                            scalingStats
                                        );
                                    }
                                });
                            }
                            targetedSkillActivations.forEach(s => {
                                const dur = getSkillDurationSecs(s.param[1], goalInX, s.frameTime, s.param?.[2], s.param?.[3]);
                                if (futureTime >= s.frameTime && futureTime < s.frameTime + dur) {
                                    futureActiveSpeedBuff -= getActiveSpeedDebuff(s.param[1], s.param?.[3]);
                                }
                            });

                            const futureTargetRes = calculateTargetSpeed({
                                courseDistance: goalInX,
                                courseId: detectedCourseId,
                                currentDistance: futureDist,
                                speedStat: trainedChara.speed,
                                wisdomStat: trainedChara.wiz,
                                powerStat: trainedChara.pow,
                                gutsStat: trainedChara.guts,
                                staminaStat: trainedChara.stamina,
                                strategy,
                                distanceProficiency: trainedChara.properDistances[distanceCategory] ?? 1,
                                strategyProficiency,
                                mood: rawData['motivation'],
                                isOonige,
                                inLastSpurt: (raceData.horseResult[frameOrder]?.lastSpurtStartDistance ?? -1) > 0
                                    && futureDist >= (raceData.horseResult[frameOrder]?.lastSpurtStartDistance ?? -1),
                                slope: 0,
                                greenSkillBonuses: passiveStats,
                                activeSpeedBuff: futureActiveSpeedBuff,
                                isDueling: false,
                                isSpotStruggle: false
                            });

                            const futureSlopeObj = trackSlopes.find((s     ) => futureDist >= s.start && futureDist < s.start + s.length);
                            const futureSlope = futureSlopeObj?.slope ?? 0;
                            if (futureSlope > 0) {
                                const slopePer = futureSlope / SLOPE_SCALE;
                                const adjustedPower = adjustStat(trainedChara.pow, rawData['motivation'], passiveStats.power + groundPowerBonus);
                                futureTargetRes.base -= (slopePer * SLOPE_PENALTY_COEFF) / adjustedPower;
                            }

                            let futureDownhillBuff = 0;
                            if (futureSlope < 0 && j < raceData.frame.length - 1) {
                                const nextFutureH = raceData.frame[j + 1].horseFrame[frameOrder];
                                const dt = raceData.frame[j + 1].time  - futureTime;
                                if (dt > 0) {
                                    const rate = ((futureH.hp ?? 0) - (nextFutureH.hp ?? 0)) / dt;
                                    const expected = calculateReferenceHpConsumption(futureSpeed, goalInX);
                                    if (expected > 0 && rate > 0 && rate < expected * DOWNHILL_HP_RATIO_THRESHOLD) {
                                        futureDownhillBuff = DOWNHILL_BONUS_BASE + Math.abs(futureSlope) / DOWNHILL_BONUS_DIVISOR;
                                    }
                                }
                            }

                            if (
                                !futureIsDecelerating
                                && futureSpeed > futureTargetRes.base + futureDownhillBuff + DUEL_RESUME_SPEED_SLACK
                            ) {
                                duelResumed = true;
                                break;
                            }
                        }

                        if (!duelResumed) {
                            endTime = Math.min(frameTime, finishTime);
                            break;
                        }
                    }
                }
            }
            if (!allOtherEvents[frameOrder]) {
                allOtherEvents[frameOrder] = [];
            }
            const duration = Math.max(0, endTime - startTime);
            if (duration > 0) {
                allOtherEvents[frameOrder].push({ time: startTime, duration, name: "Dueling" });
            }
        }

        if (e.type === RaceSimulateEventData_SimulateEventType.COMPETE_TOP) {
            const trainedChara = charaData.get(frameOrder);
            const guts = trainedChara?.guts ?? 0;
            const frontRunnerAptitude = trainedChara?.properRunningStyles[1] ?? 7;
            const strategyProficiencyModifier = STRATEGY_PROFICIENCY_MODIFIER[frontRunnerAptitude] ?? 1.0;
            const gutsDuration = Math.pow(SPOT_STRUGGLE_GUTS_DURATION_BASE * guts, SPOT_STRUGGLE_GUTS_DURATION_EXPONENT) * SPOT_STRUGGLE_GUTS_DURATION_SCALE * strategyProficiencyModifier;
            const distanceThreshold = SPOT_STRUGGLE_DIST_RATIO * goalInX;

            let distanceThresholdTime = -1;
            for (let i = 0; i < raceData.frame.length; i++) {
                if (raceData.frame[i].horseFrame[frameOrder].distance  >= distanceThreshold) {
                    distanceThresholdTime = raceData.frame[i].time ;
                    break;
                }
            }
            if (distanceThresholdTime === -1) distanceThresholdTime = raceData.frame[raceData.frame.length - 1].time ;

            if (startTime < distanceThresholdTime) {
                const duration = Math.min(gutsDuration, distanceThresholdTime - startTime);
                if (!allOtherEvents[frameOrder]) {
                    allOtherEvents[frameOrder] = [];
                }
                allOtherEvents[frameOrder].push({ time: startTime, duration: duration, name: "Spot Struggle" });
            }
        }
    }
    return allOtherEvents;
}


return computeOtherEvents(raceData,raceHorseInfo,courseId,activations,distance,condition);
}
global.HakurakuAwardTelemetry={estimateOtherEvents};
if(typeof module!=="undefined")module.exports=global.HakurakuAwardTelemetry;
})(typeof window!=="undefined"?window:globalThis);
