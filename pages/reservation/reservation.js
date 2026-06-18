/**
 * pages/reservation/reservation.js — 预约记录管理
 */
const storage = require('../../utils/storage');

Page({
  data: {
    activeTab: '进行中',
    tabs: ['进行中', '待开始', '已结束'],
    allReservations: [],
    filteredList: [],
    activeBookedSlots: [],      // 所有预约中时段（详情弹窗数据）
    bookedDeskCount: 0,         // 当前被预约的工位数（去重）
    showSlotsModal: false,
    loading: true
  },

  onShow() {
    this.loadData();
  },

  onPullDownRefresh() {
    this.loadData().then(() => wx.stopPullDownRefresh());
  },

  async loadData() {
    this.setData({ loading: true });
    try {
      // 先刷新状态，再读取
      await storage.refreshReservationStatus();
      
      const allReservations = await storage.getReservationList();
      const activeBookedSlots = await storage.getAllActiveBookedSlots();
      
      // 计算唯一被预约工位数
      const uniqueDesks = new Set(activeBookedSlots.map(s => s.deskId));
      
      const reservations = allReservations.filter(r => r.status !== '已取消');
      
      this.setData({ 
        allReservations: reservations,
        activeBookedSlots,
        bookedDeskCount: uniqueDesks.size
      });
      this.filterByTab(this.data.activeTab);
    } catch (err) {
      console.error('加载预约记录失败:', err);
      this.setData({ loading: false });
    }
  },

  onTabChange(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
    this.filterByTab(tab);
  },

  filterByTab(tab) {
    const { allReservations } = this.data;
    let filteredList = [];
    
    if (tab === '进行中') {
      filteredList = allReservations.filter(r => r.status === '进行中');
    } else if (tab === '待开始') {
      filteredList = allReservations.filter(r => r.status === '待开始');
    } else if (tab === '已结束') {
      filteredList = allReservations.filter(r => r.status === '已结束');
    }
    
    filteredList.sort((a, b) => {
      const aTime = a.date + ' ' + a.startTime;
      const bTime = b.date + ' ' + b.startTime;
      if (tab === '已结束') {
        return bTime.localeCompare(aTime);
      }
      return aTime.localeCompare(bTime);
    });
    
    this.setData({ filteredList, loading: false });
  },

  onShowSlotsDetail() {
    if (this.data.activeBookedSlots.length === 0) {
      wx.showToast({ title: '暂无预约中的时段', icon: 'none' });
      return;
    }
    this.setData({ showSlotsModal: true });
  },

  onCloseSlotsModal() {
    this.setData({ showSlotsModal: false });
  },

  noop() {},

  onCancelReservation(e) {
    const id = e.currentTarget.dataset.id;
    const record = this.data.allReservations.find(r => r.id === id);
    
    if (!record) return;
    
    wx.showModal({
      title: '取消预约',
      content: `确定取消 ${record.deskName} 的预约吗？\n${record.date} ${record.startTime}-${record.endTime}`,
      confirmText: '确认取消',
      confirmColor: '#EF4444',
      success: async (res) => {
        if (!res.confirm) return;
        
        try {
          await storage.cancelReservation(id);
          wx.vibrateShort({ type: 'medium' });
          wx.showToast({ title: '已取消', icon: 'success' });
          this.loadData();
        } catch (err) {
          wx.showToast({ title: err.message || '取消失败', icon: 'none' });
        }
      }
    });
  }
});
