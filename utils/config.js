/**
 * 可调阈值与评分参数 — 真机迭代时主要改这里
 * 加速度单位：微信文档为 m/s²，静止时合量约 9.8
 */
module.exports = {
  /** 判定「抛出」峰值：合加速度超过重力明显阈值 */
  THROW_THRESHOLD: 16,
  /** 近似失重（自由落体段） */
  FREEFALL_THRESHOLD: 5,
  /** 着陆冲击 */
  LANDING_THRESHOLD: 20,
  /** 疑似摔机超强冲击，立即停止采集并提示 */
  IMPACT_STOP_THRESHOLD: 45,
  /** 空中状态需连续满足着陆阈值的采样次数（约 game 间隔） */
  LANDING_CONFIRM_FRAMES: 2,
  /** 单次采集最大时长 ms，超时自动结束 */
  MAX_SESSION_MS: 15000,
  /** 重力常量 m/s² */
  G: 9.8,
  /** 评分：滞空时间映射 — 低于 minAirMs 0 分，达到 maxAirMs 100 分 */
  SCORE_AIR_MS_MIN: 200,
  SCORE_AIR_MS_MAX: 2200,
  /** 评分权重 */
  WEIGHT_AIR: 0.4,
  WEIGHT_POSE: 0.35,
  WEIGHT_TRAJ: 0.25,
  /** 历史记录条数上限 */
  HISTORY_MAX: 20
}
