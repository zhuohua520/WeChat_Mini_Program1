/**
 * pages/checkin/checkin.js — 时段打卡页面
 */
const storage = require('../../utils/storage');
const app = getApp();

Page({
  data: {
    activeRecord: null,       // 当前进行中的打卡记录
    historyList: [],          // 历史记录列表
    isCheckingIn: false,      // 签到按钮 loading
    isCheckingOut: false,     // 签退按钮 loading
    page: 1,
    pageSize: 20,
    hasMore: true,
    loading: true
  },

  onShow() {
    this.loadData();
  },

  onLoad() {
    this.loadData();
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.setData({ page: 1, hasMore: true });
    this.loadData().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 上拉加载更多
  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadMore();
    }
  },

  // 加载数据
  async loadData() {
    this.setData({ loading: true });
    try {
      // 获取进行中的打卡
      const activeRecord = await storage.getActiveCheckin();
      
      // 获取历史记录（分页）
      const historyList = await storage.getCheckinList({ limit: this.data.pageSize });
      const hasMore = historyList.length >= this.data.pageSize;
      
      this.setData({
        activeRecord,
        historyList,
        hasMore,
        page: 1,
        loading: false
      });
    } catch (err) {
      console.error('加载打卡数据失败:', err);
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  // 加载更多历史记录（追加模式）
  async loadMore() {
    if (!this.data.hasMore || this.data.loading) return;
    this.setData({ loading: true });
    try {
      const all = await storage.getCheckinList();
      const skip = this.data.page * this.data.pageSize;
      const more = all.slice(skip, skip + this.data.pageSize);
      this.setData({
        historyList: [...this.data.historyList, ...more],
        page: this.data.page + 1,
        hasMore: all.length > skip + this.data.pageSize,
        loading: false
      });
    } catch (err) {
      console.error('加载更多失败:', err);
      this.setData({ loading: false });
    }
  },

  // 签到
  onCheckin() {
    if (this.data.activeRecord) {
      wx.showToast({ title: '当前有进行中的打卡，请先签退', icon: 'none' });
      return;
    }

    // 先弹出地点选择器
    wx.showActionSheet({
      itemList: [
        '校内：湖南科技大学逸夫楼117',
        '校外：湖南科技大学东门外吉利社区C区16栋2号楼2楼'
      ],
      success: (res) => {
        const selectedAddress = res.tapIndex === 0 
          ? '校内：湖南科技大学逸夫楼117'
          : '校外：湖南科技大学东门外吉利社区C区16栋2号楼2楼';
        
        // 用户已选择地点，继续签到
        this.doCheckin(selectedAddress);
      },
      fail: () => {
        // 用户取消选择
      }
    });
  },

  // 执行签到（地点已选）
  doCheckin(address) {
    this.setData({ isCheckingIn: true });
    wx.vibrateShort({ type: 'light' });

    // 获取 GPS 位置（用于记录经纬度）
    app.requestLocation(async (location) => {
      const finalLocation = {
        latitude: location ? location.latitude : 0,
        longitude: location ? location.longitude : 0,
        address: address // 使用用户选择的地点
      };

      try {
        const record = await storage.checkin(finalLocation);
        wx.vibrateShort({ type: 'medium' });
        wx.showToast({ title: `签到成功\n${address}`, icon: 'success' });
        
        this.setData({
          activeRecord: record,
          isCheckingIn: false
        });
        
        this.loadData();
      } catch (err) {
        console.error('签到失败:', err);
        wx.showToast({ title: '签到失败', icon: 'none' });
        this.setData({ isCheckingIn: false });
      }
    });
  },

  // 签退
  onCheckout() {
    if (!this.data.activeRecord) {
      wx.showToast({ title: '当前无进行中的打卡', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '确认签退',
      content: '确定要签退吗？',
      confirmText: '签退',
      confirmColor: '#F59E0B',
      success: async (res) => {
        if (!res.confirm) return;
        
        this.setData({ isCheckingOut: true });
        wx.vibrateShort({ type: 'light' });

        try {
          const updatedRecord = await storage.checkout(this.data.activeRecord.id);
          wx.vibrateShort({ type: 'medium' });
          wx.showToast({ title: '签退成功', icon: 'success' });
          
          this.setData({
            activeRecord: null,
            isCheckingOut: false
          });
          
          // 把刚签退的记录替换掉旧的进行中记录
          const historyList = [updatedRecord, ...this.data.historyList.filter(r => r.id !== updatedRecord.id)];
          this.setData({ historyList });
        } catch (err) {
          console.error('签退失败:', err);
          wx.showToast({ title: '签退失败', icon: 'none' });
          this.setData({ isCheckingOut: false });
        }
      }
    });
  },

  // 格式化时长（用于模板显示）
  formatDuration(duration) {
    return duration || '-';
  }
});
