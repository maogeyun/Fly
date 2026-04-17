/**
 * 传感器封装：加速度计 + 陀螺仪，game 间隔
 */
const buffer = []
let accHandler = null
let gyroHandler = null
let t0 = 0
let lastGyro = { x: 0, y: 0, z: 0 }

function nowMs() {
  return Date.now()
}

function clearBuffer() {
  buffer.length = 0
  t0 = nowMs()
  lastGyro = { x: 0, y: 0, z: 0 }
}

/**
 * @param {(sample: object) => void} [onSample] 每收到加速度采样时回调（含当前陀螺仪）
 */
function startRecording(onSample) {
  clearBuffer()

  gyroHandler = (res) => {
    lastGyro = { x: res.x, y: res.y, z: res.z }
  }

  accHandler = (res) => {
    const t = Date.now() - t0
    const sample = {
      t,
      ax: res.x,
      ay: res.y,
      az: res.z,
      gx: lastGyro.x,
      gy: lastGyro.y,
      gz: lastGyro.z
    }
    buffer.push(sample)
    if (typeof onSample === 'function') onSample(sample)
  }

  wx.onGyroscopeChange(gyroHandler)
  wx.onAccelerometerChange(accHandler)

  try {
    wx.startAccelerometer({ interval: 'game' })
  } catch (e) {
    wx.showModal({
      title: '无法启动加速度计',
      content: '请在真机上使用，并检查系统权限设置。',
      showCancel: false
    })
    throw e
  }

  try {
    wx.startGyroscope({ interval: 'game' })
  } catch (e) {
    // 无陀螺仪时姿态分将降级
  }
}

function stopRecording() {
  if (accHandler) {
    try {
      wx.stopAccelerometer()
    } catch (e) {}
    wx.offAccelerometerChange(accHandler)
    accHandler = null
  }
  if (gyroHandler) {
    try {
      wx.stopGyroscope()
    } catch (e) {}
    wx.offGyroscopeChange(gyroHandler)
    gyroHandler = null
  }
}

function getBuffer() {
  return buffer
}

module.exports = {
  startRecording,
  stopRecording,
  getBuffer,
  clearBuffer
}
