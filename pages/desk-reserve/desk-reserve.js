/**
 * pages/desk-reserve/desk-reserve.js — 工位预约页面
 */
const storage = require('../../utils/storage');

Page({
  data: {
    deskId: '',
    deskName: '',
    selectedDate: '',
    dateIndex: 0,
    dateOptions: [],
    startTimeIndex: 0,
    endTimeIndex: 1,
    timeSlots: [],
    submitting: false,
    // 已占时段
    bookedSlots: [],
    loadingBookedSlots: false
  },

  onLoad(options) {
    const deskId = options.deskId || '';
    const deskName = decodeURIComponent(options.deskName || '未知工位');
    
    const dateOptions = [];
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      const dateStr = storage.formatDate(d);
      const weekDay = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()];
      const label = i === 0 ? `今天 ${weekDay}` : `${dateStr} ${weekDay}`;
      dateOptions.push({ value: dateStr, label });
    }

    const timeSlots = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 30) {
        timeSlots.push({
          value: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
          label: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
        });
      }
    }

    this.setData({
      deskId, deskName,
      selectedDate: dateOptions[0].value,
      dateOptions, timeSlots
    });

    // 初始加载已占时段
    this.loadBookedSlots(dateOptions[0].value);
  },

  // 加载已占时段
  async loadBookedSlots(date) {
    if (!this.data.deskId || !date) return;
    this.setData({ loadingBookedSlots: true });
    try {
      const bookedSlots = await storage.getBookedSlotsForDate(this.data.deskId, date);
      this.setData({ bookedSlots, loadingBookedSlots: false });
    } catch (err) {
      this.setData({ loadingBookedSlots: false });
    }
  },

  onDateChange(e) {
    const idx = parseInt(e.detail.value);
    const selectedDate = this.data.dateOptions[idx].value;
    this.setData({ dateIndex: idx, selectedDate });
    this.loadBookedSlots(selectedDate);
  },

  onStartTimeChange(e) {
    const idx = parseInt(e.detail.value);
    this.setData({ startTimeIndex: idx });
    if (idx >= this.data.endTimeIndex) {
      this.setData({ endTimeIndex: Math.min(idx + 1, this.data.timeSlots.length - 1) });
    }
  },

  onEndTimeChange(e) {
    const idx = parseInt(e.detail.value);
    this.setData({ endTimeIndex: idx });
    if (idx <= this.data.startTimeIndex) {
      this.setData({ startTimeIndex: Math.max(idx - 1, 0) });
    }
  },

  async onSubmit() {
    const { deskId, deskName, selectedDate, timeSlots, startTimeIndex, endTimeIndex } = this.data;
    const startTime = timeSlots[startTimeIndex].value;
    const endTime = timeSlots[endTimeIndex].value;

    if (startTime >= endTime) {
      wx.showToast({ title: '结束时间必须大于开始时间', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    wx.vibrateShort({ type: 'light' });

    try {
      const conflict = await storage.checkReservationConflict(deskId, selectedDate, startTime, endTime);
      
      if (conflict.conflicted) {
        const cf = conflict.conflictRecord;
        wx.showModal({
          title: '时段冲突',
          content: `该工位在 ${startTime}-${endTime} 已被 ${cf.userName || '他人'} 预约\n（${cf.startTime} - ${cf.endTime}）\n请选择其他时段`,
          showCancel: false,
          confirmText: '知道了'
        });
        this.setData({ submitting: false });
        return;
      }

      const user = await storage.getUserInfo();
      
      wx.showModal({
        title: '确认预约',
        content: `${deskName}\n${selectedDate}\n${startTime} - ${endTime}`,
        confirmText: '确认预约',
        confirmColor: '#6366F1',
        success: async (res) => {
          if (!res.confirm) { this.setData({ submitting: false }); return; }

          try {
            await storage.createReservation({
              deskId, deskName,
              date: selectedDate, startTime, endTime,
              userId: user.userId,
              userName: user.nickName
            });
            
            wx.vibrateShort({ type: 'medium' });
            wx.showToast({ title: '预约成功', icon: 'success' });
            
            setTimeout(() => wx.navigateBack(), 1500);
          } catch (err) {
            wx.showToast({ title: err.message || '预约失败', icon: 'none' });
            this.setData({ submitting: false });
          }
        }
      });
    } catch (err) {
      wx.showToast({ title: '检测冲突失败', icon: 'none' });
      this.setData({ submitting: false });
    }
  }
});
