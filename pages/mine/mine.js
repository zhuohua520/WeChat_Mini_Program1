/**
 * pages/mine/mine.js — 我的页面（含头像上传、姓名编辑）
 */
const storage = require('../../utils/storage');

Page({
  data: {
    userInfo: {
      nickName: '工作室成员',
      userId: '',
      avatarUrl: ''
    },
    checkinCount: 0,
    reservationCount: 0,
    isEditingName: false,
    editNameValue: ''
  },

  onShow() {
    this.loadData();
  },

  async loadData() {
    try {
      const userInfo = await storage.getUserInfo();
      const checkins = await storage.getCheckinList();
      const reservations = await storage.getReservationList();
      
      this.setData({
        userInfo,
        checkinCount: checkins.length,
        reservationCount: reservations.filter(r => r.status !== '已取消').length
      });
    } catch (err) {
      console.error('加载用户数据失败:', err);
    }
  },

  // 上传/更换头像（存文件路径，避免撑爆 Storage）
  onChangeAvatar() {
    wx.chooseImage({
      count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'],
      success: (res) => {
        const tempPath = res.tempFilePaths[0];
        wx.showLoading({ title: '处理中...', mask: true });
        
        // 压缩后存入文件系统
        wx.compressImage({
          src: tempPath, quality: 60,
          success: (cr) => {
            const avatarDir = wx.env.USER_DATA_PATH + '/avatar/';
            const fm = wx.getFileSystemManager();
            try { fm.accessSync(avatarDir); } catch (e) { fm.mkdirSync(avatarDir, true); }
            const savedPath = avatarDir + 'avatar_' + Date.now() + '.jpg';
            fm.copyFile({
              srcPath: cr.tempFilePath, destPath: savedPath,
              success: () => this.saveAvatarPath(savedPath),
              fail: () => {
                fm.copyFile({
                  srcPath: tempPath, destPath: savedPath,
                  success: () => this.saveAvatarPath(savedPath),
                  fail: () => { wx.hideLoading(); wx.showToast({ title: '保存失败', icon: 'none' }); }
                });
              }
            });
          },
          fail: () => {
            // 压缩失败直接用原图
            const avatarDir = wx.env.USER_DATA_PATH + '/avatar/';
            const fm = wx.getFileSystemManager();
            try { fm.accessSync(avatarDir); } catch (e) { fm.mkdirSync(avatarDir, true); }
            const savedPath = avatarDir + 'avatar_' + Date.now() + '.jpg';
            fm.copyFile({
              srcPath: tempPath, destPath: savedPath,
              success: () => this.saveAvatarPath(savedPath),
              fail: () => { wx.hideLoading(); wx.showToast({ title: '保存失败', icon: 'none' }); }
            });
          }
        });
      }
    });
  },

  async saveAvatarPath(path) {
    try {
      // 删除旧头像文件
      const oldInfo = await storage.getUserInfo();
      if (oldInfo.avatarUrl && oldInfo.avatarUrl.includes('USER_DATA_PATH')) {
        try { wx.getFileSystemManager().unlinkSync(oldInfo.avatarUrl); } catch (e) {}
      }
      await storage.updateUserInfo({ avatarUrl: path });
      this.setData({ 'userInfo.avatarUrl': path });
      wx.hideLoading();
      wx.showToast({ title: '头像已更新', icon: 'success' });
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },

  // 开始编辑姓名
  onEditName() {
    this.setData({ 
      isEditingName: true,
      editNameValue: this.data.userInfo.nickName
    });
  },

  // 确认修改姓名
  onConfirmName() {
    const newName = this.data.editNameValue.trim();
    if (!newName) {
      wx.showToast({ title: '姓名不能为空', icon: 'none' });
      return;
    }
    
    storage.updateUserInfo({ nickName: newName }).then(updated => {
      this.setData({ 
        'userInfo.nickName': newName,
        isEditingName: false
      });
      wx.showToast({ title: '姓名已更新', icon: 'success' });
    }).catch(() => {
      wx.showToast({ title: '保存失败', icon: 'none' });
    });
  },

  // 取消编辑
  onCancelEditName() {
    this.setData({ isEditingName: false });
  },

  // 姓名输入
  onNameInput(e) {
    this.setData({ editNameValue: e.detail.value });
  },

  // 清除所有数据
  onClearData() {
    wx.showModal({
      title: '清除数据',
      content: '将清除所有本地数据（含图片文件），此操作不可恢复。确定继续？',
      confirmText: '确认清除',
      confirmColor: '#EF4444',
      success: (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '清除中...', mask: true });
        try {
          // 清除文件系统中的图片
          const fm = wx.getFileSystemManager();
          const dirs = ['/fish_images/', '/avatar/', '/preview/'];
          dirs.forEach(d => {
            const dp = wx.env.USER_DATA_PATH + d;
            try {
              const files = fm.readdirSync(dp);
              files.forEach(f => { try { fm.unlinkSync(dp + f); } catch (e) {} });
              fm.rmdirSync(dp);
            } catch (e) {}
          });
          // 清除 Storage
          wx.clearStorageSync();
          wx.hideLoading();
          wx.showToast({ title: '数据已清除', icon: 'success' });
          getApp().onLaunch();
          setTimeout(() => this.loadData(), 500);
        } catch (err) {
          wx.hideLoading();
          wx.showToast({ title: '清除失败', icon: 'none' });
        }
      }
    });
  },

  onViewStats() {
    wx.switchTab({ url: '/pages/checkin/checkin' });
  },

  onViewReservations() {
    wx.switchTab({ url: '/pages/reservation/reservation' });
  },

  onAbout() {
    wx.showModal({
      title: '关于',
      content: '工作室助手 v1.1\n\n时段打卡 & 工位预约系统\n校内工位：逸夫楼117\n当前版本使用本地存储',
      showCancel: false,
      confirmText: '知道了'
    });
  }
});
