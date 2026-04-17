// app.js — 飞机模式
App({
  globalData: {
    /** 最近一次飞行完整结果（报告页优先读 storage，此作备份） */
    pendingReport: null
  },

  onLaunch() {
    // 免责声明在首页处理；此处可做版本迁移
  }
})
