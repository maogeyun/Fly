const storage = require('../../utils/storage.js')
const shareUtil = require('../../utils/share.js')

const SHARE_DONE_LINES = [
  '分享图已备好，截图发圈更稳。',
  '这张图够狠，发出去吧。',
  '已生成。别怂，发圈见分晓。',
  '好了，朋友圈跑道已清空。',
  '分享图出炉：今天就比这一把。'
]

const DELIGHT_BY_GRADE = {
  S: [
    '这成绩不截图，朋友会以为你在吹牛。',
    '传说级落笔，记得按保存。',
    '可以，这把请你当代言机长。'
  ],
  A: [
    '王牌操作，朋友圈跑道给你清好了。',
    '稳得不像第一次扔。',
    '今日宜发圈，忌低调。'
  ],
  B: [
    '合格机长，再来一把还能抬分。',
    '不丢人，属于「可以嘚瑟一下」。',
    '过得去，但你的手明显还想飞。'
  ],
  C: [
    '实习副驾，建议再扔一次找手感。',
    '能落就好，和谁比心里要有数。',
    '飞过了，就算赢了一半。'
  ],
  D: [
    '地面指挥官，先换块软垫重来。',
    '飞机今天请假，改日再战。',
    '别灰心，地心引力今天比较认真。'
  ]
}

function hashSeed(str) {
  let h = 5381
  for (let i = 0; i < str.length; i++) {
    h = (h * 33) ^ str.charCodeAt(i)
  }
  return h >>> 0
}

/** 同一 record 固定一句，避免反复进页「换嘴」 */
function pickDelightLine(grade, record) {
  const list = DELIGHT_BY_GRADE[grade] || DELIGHT_BY_GRADE.D
  const seed = record
    ? `${record.id || ''}:${record.ts || ''}:${grade}`
    : `anon:${grade}`
  const idx = hashSeed(seed) % list.length
  return list[idx]
}

/** 仅 S 档追加一句「隐藏款」彩蛋（与其它随机句独立） */
const S_GRADE_HIDDEN_LINE =
  '隐藏款｜传说档机长专属：这页可以截长一点，让朋友找「隐藏款」三个字找半天。'

Page({
  data: {
    record: null,
    pageEntered: false,
    delightLine: '',
    delightHidden: '',
    scrollHeight: 600
  },

  _pickShareDoneLine() {
    const r = this.data.record
    const seed = r ? `${r.id || ''}:${r.ts || ''}:${r.metrics.score || 0}` : 'anon'
    return SHARE_DONE_LINES[hashSeed(seed) % SHARE_DONE_LINES.length]
  },

  onLoad(options) {
    let h = 600
    try {
      const wi = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
      h = wi.windowHeight || wi.screenHeight || h
    } catch (e) {
      /* ignore */
    }
    this.setData({ scrollHeight: h })
    this.loadRecord(options)
  },

  loadRecord(options) {
    let record = null
    if (options.id) {
      record = storage.getFlightById(options.id)
    }
    if (!record) {
      record = storage.getCurrentReport()
    }
    const grade = record ? record.metrics.grade : ''
    const delightLine = record ? pickDelightLine(grade, record) : ''
    const delightHidden = grade === 'S' ? S_GRADE_HIDDEN_LINE : ''
    this.setData(
      {
        record,
        delightLine,
        delightHidden,
        pageEntered: false
      },
      () => {
        if (record) {
          setTimeout(() => this.setData({ pageEntered: true }), 40)
        }
      }
    )
  },

  onAgain() {
    storage.clearCurrentReport()
    wx.redirectTo({ url: '/pages/index/index' })
  },

  onShareImage() {
    const r = this.data.record
    if (!r) return
    try {
      if (wx.vibrateShort) wx.vibrateShort({ type: 'light' })
    } catch (e) {
      /* ignore */
    }
    wx.showLoading({ title: '正在生成分享图…', mask: true })
    const data = {
      score: r.metrics.score,
      grade: r.metrics.grade,
      gradeLabel: r.metrics.gradeLabel,
      airTimeMs: r.metrics.airTimeMs,
      estimatedHeight: r.metrics.estimatedHeight,
      rotationCount: r.metrics.rotationCount
    }
    shareUtil
      .renderShareCardToTempFile('shareCanvas', this, data, r.trajectoryPoints || [])
      .then((path) => {
        wx.hideLoading()
        try {
          wx.showToast({
            title: this._pickShareDoneLine(),
            icon: 'none',
            duration: 900
          })
        } catch (e) {
          /* ignore */
        }
        if (wx.showShareImageMenu) {
          wx.showShareImageMenu({ path })
        } else {
          wx.previewImage({ urls: [path] })
        }
      })
      .catch(() => {
        wx.hideLoading()
        wx.showModal({
          title: '分享图没生成出来',
          content:
            '可能是权限没开，或系统正忙。请检查相册/存储权限后重试；点「重试」会重新生成一张分享图。',
          confirmText: '去开启权限',
          cancelText: '稍后再试',
          success: (res) => {
            if (res.confirm) {
              if (wx.openSetting) {
                wx.openSetting({
                  success: () => {
                    try {
                      wx.showToast({
                        title: '权限开好后再点一次「生成分享图」',
                        icon: 'none',
                        duration: 1200
                      })
                    } catch (e) {
                      /* ignore */
                    }
                  }
                })
              } else {
                try {
                  wx.showToast({
                    title: '请到系统设置里开启相册/存储权限',
                    icon: 'none',
                    duration: 1200
                  })
                } catch (e) {
                  /* ignore */
                }
              }
            }
          }
        })
      })
  },

  onShareAppMessage() {
    const r = this.data.record
    const score = r ? r.metrics.score : 0
    const grade = r ? r.metrics.grade : ''
    const label = r ? r.metrics.gradeLabel : ''
    const q = `from=share&score=${encodeURIComponent(
      String(score)
    )}&grade=${encodeURIComponent(String(grade))}&label=${encodeURIComponent(
      String(label)
    )}`
    return {
      title: `我在飞机模式飞出了 ${score} 分，来挑战！`,
      path: `/pages/index/index?${q}`
    }
  }
})
