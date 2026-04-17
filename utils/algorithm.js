/**
 * 飞行阶段识别、滞空、旋转积分、评分与等级
 */
const cfg = require('./config.js')

function magnitude3(x, y, z) {
  return Math.sqrt(x * x + y * y + z * z)
}

/**
 * 单帧阶段推断（与状态机配合）
 */
function accMagnitude(sample) {
  return magnitude3(sample.ax, sample.ay, sample.az)
}

function createEmptyState() {
  return {
    phase: 'IDLE',
    launchT: null,
    airStartT: null,
    landT: null,
    landFrames: 0,
    maxAcc: 0,
    gyroIntegral: 0,
    lastT: null,
    gyroMagSum: 0,
    gyroMagCount: 0
  }
}

/** 单帧更新状态机（analyzeFlight 与流式采集共用） */
function processSampleState(state, s) {
  const m = accMagnitude(s)
  if (m > state.maxAcc) state.maxAcc = m

  const dt = state.lastT == null ? 0 : Math.max(0, (s.t - state.lastT) / 1000)
  state.lastT = s.t

  const gyroMag = magnitude3(s.gx, s.gy, s.gz)
  state.gyroIntegral += gyroMag * dt
  state.gyroMagSum += gyroMag
  state.gyroMagCount++

  switch (state.phase) {
    case 'IDLE':
      if (m > cfg.THROW_THRESHOLD) {
        state.phase = 'THROW'
        state.launchT = s.t
      }
      break
    case 'THROW':
      if (m < cfg.FREEFALL_THRESHOLD) {
        state.phase = 'AIRBORNE'
        state.airStartT = s.t
      }
      break
    case 'AIRBORNE':
      if (m > cfg.IMPACT_STOP_THRESHOLD) {
        state.phase = 'LANDED'
        state.landT = s.t
        state.landFrames = cfg.LANDING_CONFIRM_FRAMES
      } else if (m > cfg.LANDING_THRESHOLD) {
        state.landFrames++
        if (state.landFrames >= cfg.LANDING_CONFIRM_FRAMES) {
          state.phase = 'LANDED'
          state.landT = s.t
        }
      } else {
        state.landFrames = 0
      }
      break
    case 'LANDED':
    default:
      break
  }
}

/**
 * 流式采集用：累积状态 + 样本
 */
function createStreamingAccumulator() {
  return {
    state: createEmptyState(),
    samples: []
  }
}

/**
 * @returns {{ landed: boolean, strongImpact: boolean, phase: string, magnitude: number }}
 */
function pushStreamingSample(acc, s) {
  acc.samples.push(s)
  const prevPhase = acc.state.phase
  processSampleState(acc.state, s)
  const m = accMagnitude(s)
  const landed = acc.state.phase === 'LANDED'
  const strongImpact = m > cfg.IMPACT_STOP_THRESHOLD && prevPhase === 'AIRBORNE'
  return { landed, strongImpact, phase: acc.state.phase, magnitude: m }
}

/**
 * 处理缓冲区，返回飞行结果
 * @param {Array<{t,ax,ay,az,gx,gy,gz}>} samples
 */
function analyzeFlight(samples) {
  if (!samples || samples.length < 5) {
    return makeEmptyResult('数据过少')
  }

  const state = createEmptyState()
  for (let i = 0; i < samples.length; i++) {
    processSampleState(state, samples[i])
    if (state.phase === 'LANDED') break
  }

  if (state.phase !== 'LANDED' || state.airStartT == null || state.landT == null) {
    return finalizeMetrics(samples, state, false)
  }

  return finalizeMetrics(samples, state, true)
}

function finalizeMetrics(samples, state, landed) {
  const airTimeMs =
    landed && state.airStartT != null && state.landT != null
      ? Math.max(0, state.landT - state.airStartT)
      : 0

  /** 简化估算高度：对称抛物线 t_peak = airTime/2 */
  const airS = airTimeMs / 1000
  const estimatedHeight =
    airS > 0 ? 0.5 * cfg.G * (airS / 2) * (airS / 2) : 0

  const rotationRad = state.gyroIntegral
  const rotationCount = rotationRad / (2 * Math.PI)

  const gyroMean = state.gyroMagCount ? state.gyroMagSum / state.gyroMagCount : 0
  const gyroVariance = computeGyroVariance(samples, gyroMean)

  const airScore = scoreAirTime(airTimeMs)
  const poseScore = scorePose(rotationCount, gyroVariance, samples)
  const trajScore = scoreTrajectoryPlaceholder(airTimeMs, state.maxAcc)

  const total =
    airScore * cfg.WEIGHT_AIR +
    poseScore * cfg.WEIGHT_POSE +
    trajScore * cfg.WEIGHT_TRAJ

  const score = Math.round(Math.min(100, Math.max(0, total)))
  const grade = gradeFromScore(score)
  const gradeLabel = gradeLabelZh(grade)

  return {
    ok: landed && airTimeMs > 0,
    airTimeMs,
    estimatedHeight,
    rotationCount,
    maxAcc: state.maxAcc,
    airScore,
    poseScore,
    trajScore,
    score,
    grade,
    gradeLabel,
    launchT: state.launchT,
    airStartT: state.airStartT,
    landT: state.landT,
    phase: state.phase,
    phaseEnd: state.phase
  }
}

function computeGyroVariance(samples, mean) {
  if (!samples.length) return 0
  let sum = 0
  let n = 0
  for (const s of samples) {
    const gm = magnitude3(s.gx, s.gy, s.gz)
    sum += (gm - mean) * (gm - mean)
    n++
  }
  return n ? sum / n : 0
}

function scoreAirTime(ms) {
  const { SCORE_AIR_MS_MIN, SCORE_AIR_MS_MAX } = cfg
  if (ms <= SCORE_AIR_MS_MIN) return 0
  if (ms >= SCORE_AIR_MS_MAX) return 100
  const t = (ms - SCORE_AIR_MS_MIN) / (SCORE_AIR_MS_MAX - SCORE_AIR_MS_MIN)
  return Math.min(100, Math.max(0, t * 100))
}

function scorePose(rotationCount, gyroVariance, samples) {
  const hasGyro = samples.some(
    (s) => Math.abs(s.gx) > 0.01 || Math.abs(s.gy) > 0.01 || Math.abs(s.gz) > 0.01
  )
  if (!hasGyro) {
    return 40
  }
  const rotPart = Math.min(100, rotationCount * 18)
  const stabilityPart = Math.max(0, 100 - Math.min(100, gyroVariance * 800))
  return rotPart * 0.55 + stabilityPart * 0.45
}

/** 轨迹美感占位：结合滞空与冲击平滑度 */
function scoreTrajectoryPlaceholder(airTimeMs, maxAcc) {
  if (airTimeMs <= 0) return 0
  const airPart = scoreAirTime(airTimeMs)
  const landSmooth = maxAcc > cfg.LANDING_THRESHOLD * 2 ? 40 : 75
  return airPart * 0.5 + landSmooth * 0.5
}

function gradeFromScore(score) {
  if (score >= 90) return 'S'
  if (score >= 75) return 'A'
  if (score >= 60) return 'B'
  if (score >= 40) return 'C'
  return 'D'
}

function gradeLabelZh(grade) {
  const map = {
    S: '传说级飞行员',
    A: '王牌飞行员',
    B: '合格机长',
    C: '实习副驾',
    D: '地面指挥官'
  }
  return map[grade] || ''
}

function makeEmptyResult(reason) {
  return {
    ok: false,
    reason,
    airTimeMs: 0,
    estimatedHeight: 0,
    rotationCount: 0,
    maxAcc: 0,
    airScore: 0,
    poseScore: 0,
    trajScore: 0,
    score: 0,
    grade: 'D',
    gradeLabel: gradeLabelZh('D'),
    launchT: null,
    airStartT: null,
    landT: null,
    phase: 'IDLE',
    phaseEnd: 'IDLE'
  }
}

/**
 * 实时检测（用于飞行页）：返回 { shouldStop, reason, strongImpact }
 */
function checkLiveSample(sample, ctx) {
  const m = accMagnitude(sample)
  const strongImpact = m > cfg.IMPACT_STOP_THRESHOLD
  return { strongImpact, magnitude: m }
}

/**
 * 采集结束后用累积器生成与 analyzeFlight 一致的指标（避免重复扫描）
 */
function finalizeMetricsFromAccumulator(acc) {
  return finalizeMetrics(acc.samples, acc.state, acc.state.phase === 'LANDED')
}

module.exports = {
  magnitude3,
  accMagnitude,
  analyzeFlight,
  checkLiveSample,
  createStreamingAccumulator,
  pushStreamingSample,
  finalizeMetricsFromAccumulator,
  gradeFromScore,
  gradeLabelZh
}
