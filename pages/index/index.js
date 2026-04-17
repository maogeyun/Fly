const storage = require('../../utils/storage.js')

function safeText(v, maxLen) {
  const s = String(v == null ? '' : v)
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
  if (!s) return ''
  return s.length > maxLen ? s.slice(0, maxLen) + '…' : s
}

function safeScore(v) {
  const s = safeText(v, 8)
  if (!s) return ''
  // 允许整数/小数；异常则回空
  if (!/^\d+(\.\d+)?$/.test(s)) return ''
  return s
}

Page({
  data: {
    showDisclaimer: false,
    disclaimerChecked: false,
    sharedReport: null
  },

  onLoad(options) {
    if (options && options.from === 'share') {
      const score = safeScore(options.score)
      const grade = safeText(options.grade, 2)
      const label = safeText(options.label, 18)
      this.setData({
        sharedReport: {
          score: score || '—',
          grade,
          label
        }
      })
    } else {
      this.setData({ sharedReport: null })
    }
  },

  onShow() {
    const ok = storage.getDisclaimerAccepted()
    this.setData({
      showDisclaimer: false,
      disclaimerChecked: false
    })
  },

  onDisclaimerChange(e) {
    const v = e.detail.value || []
    this.setData({ disclaimerChecked: v.indexOf('agree') >= 0 })
  },

  acceptDisclaimer() {
    if (!this.data.disclaimerChecked) return
    storage.setDisclaimerAccepted(true)
    this.setData({ showDisclaimer: false })
  },

  closeDisclaimer() {
    this.setData({ showDisclaimer: false, disclaimerChecked: false })
  },

  onTakeoff() {
    if (!storage.getDisclaimerAccepted()) {
      this.setData({ showDisclaimer: true })
      return
    }
    wx.navigateTo({ url: '/pages/flying/flying' })
  }
})
