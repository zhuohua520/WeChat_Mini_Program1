// app.js
const storage = require('./utils/storage');

App({
  globalData: {
    userInfo: null,
    userId: ''
  },

  onLaunch() {
    // 初始化用户信息
    storage.getUserInfo().then(info => {
      this.globalData.userInfo = info;
      this.globalData.userId = info.userId;
    }).catch(err => {
      console.error('初始化用户信息失败:', err);
    });

    // 初始化工位数据
    storage.initDeskList().then(desks => {
      console.log(`[app] 工位数据已初始化，共 ${desks.length} 个工位`);
    }).catch(err => {
      console.error('初始化工位失败:', err);
    });

    // 更新预约状态（含违规检测）
    storage.refreshReservationStatus().catch(err => {
      console.error('更新预约状态失败:', err);
    });
  },

  onShow() {
    storage.refreshReservationStatus().catch(err => {
      console.error('刷新预约状态失败:', err);
    });
  },

  // 获取位置授权
  requestLocation(callback) {
    wx.getLocation({
      type: 'gcj02',
      success(res) {
        const { latitude, longitude } = res;
        wx.getFuzzyLocation ? wx.getFuzzyLocation({
          type: 'gcj02',
          success(fuzzyRes) {
            const address = (fuzzyRes.street || '') + (fuzzyRes.poiName || '');
            callback && callback({
              latitude, longitude,
              address: address || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
            });
          },
          fail() {
            callback && callback({
              latitude, longitude,
              address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
            });
          }
        }) : callback && callback({
          latitude, longitude,
          address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
        });
      },
      fail(err) {
        console.error('获取位置失败:', err);
        if (err.errMsg.includes('auth deny')) {
          wx.showModal({
            title: '位置授权',
            content: '打卡需要获取您的位置信息，请在设置中开启位置权限',
            confirmText: '去设置',
            success(modalRes) {
              if (modalRes.confirm) wx.openSetting();
            }
          });
        }
        callback && callback(null);
      }
    });
  }
});
