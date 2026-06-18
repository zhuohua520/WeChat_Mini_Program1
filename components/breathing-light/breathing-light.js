/**
 * components/breathing-light/breathing-light.js
 * 呼吸灯组件 — 用于打卡进行中状态的视觉指示
 */
Component({
  properties: {
    size: {
      type: Number,
      value: 120 // rpx
    },
    color: {
      type: String,
      value: '#10B981' // 绿色
    }
  },

  data: {
    animated: true
  },

  lifetimes: {
    attached() {
      // 启动动画
      this.setData({ animated: true });
    }
  },

  methods: {}
});
