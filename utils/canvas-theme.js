/**
 * 与 app.wxss 中 page 变量对齐，供 2d canvas 使用（canvas 无法读取 CSS 变量）
 */
module.exports = {
  bgChart: '#e3dcd2',
  bgPage: '#e8e0d4',
  textPrimary: '#1c1b18',
  textMuted: '#7d756a',
  ink: '#141311',
  inkSoft: '#2e2b27',
  pencil: '#6b655c',
  baseline: 'rgba(20,19,17,0.14)',
  baselineLight: 'rgba(20,19,17,0.12)',
  areaFill: 'rgba(20,19,17,0.07)',
  /** 仪表盘合加速度曲线（略浅于浓墨） */
  accStroke: '#3a3835',
  /** 分享卡纸色（贴近导航栏/纸本高光） */
  sharePaper: '#ebe4d8',
  shareRule: 'rgba(20,19,17,0.08)',
  /** 轨迹标注点 */
  markStart: '#4a4743',
  markApex: '#141311',
  markEnd: '#6b655c'
}
