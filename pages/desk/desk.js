/**
 * pages/desk/desk.js — 工位状态看板（含详情弹窗）
 */
const storage = require('../../utils/storage');

Page({
  data: {
    deskList: [],
    deskStatuses: {},
    stats: { total: 0, free: 0, reserved: 0, inuse: 0 },
    loading: true,
    // 详情弹窗
    showDetailModal: false,
    currentDesk: null,              // 当前查看的工位
    currentDeskReservations: [],    // 该工位所有预约记录
    currentBookedSlots: []          // 今天已占时段
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
      await storage.refreshReservationStatus();
      
      const deskList = await storage.getDeskList();
      const deskStatuses = await storage.getAllDeskStatuses();
      
      let free = 0, reserved = 0, inuse = 0;
      Object.values(deskStatuses).forEach(s => {
        if (s === '空闲') free++;
        else if (s === '预约中') reserved++;
        else if (s === '使用中') inuse++;
      });
      
      this.setData({
        deskList,
        deskStatuses,
        stats: { total: deskList.length, free, reserved, inuse },
        loading: false
      });
    } catch (err) {
      console.error('加载工位数据失败:', err);
      this.setData({ loading: false });
    }
  },

  // 点击工位卡片 → 弹出详情弹窗
  async onDeskTap(e) {
    const deskId = e.currentTarget.dataset.id;
    const desk = this.data.deskList.find(d => d.id === deskId);
    if (!desk) return;

    wx.showLoading({ title: '加载中' });
    try {
      const now = new Date();
      const todayDate = storage.formatDate(now);
      
      const [allReservations, bookedSlots] = await Promise.all([
        storage.getDeskAllReservations(deskId),
        storage.getBookedSlotsForDate(deskId, todayDate)
      ]);

      this.setData({
        showDetailModal: true,
        currentDesk: desk,
        currentDeskReservations: allReservations,
        currentBookedSlots: bookedSlots
      });
      wx.hideLoading();
    } catch (err) {
      wx.hideLoading();
      console.error('加载工位详情失败:', err);
    }
  },

  // 关闭详情弹窗
  onCloseDetail() {
    this.setData({ showDetailModal: false });
  },

  // 从详情弹窗跳转预约
  onReserveFromDetail() {
    const desk = this.data.currentDesk;
    if (!desk) return;
    this.setData({ showDetailModal: false });
    wx.navigateTo({
      url: `/pages/desk-reserve/desk-reserve?deskId=${desk.id}&deskName=${encodeURIComponent(desk.name)}`
    });
  },

  // 从卡片直接跳转预约（保留快捷操作）
  onQuickReserve(e) {
    const deskId = e.currentTarget.dataset.id;
    const deskName = e.currentTarget.dataset.name;
    wx.navigateTo({
      url: `/pages/desk-reserve/desk-reserve?deskId=${deskId}&deskName=${encodeURIComponent(deskName)}`
    });
  },

  noop() {}
});
