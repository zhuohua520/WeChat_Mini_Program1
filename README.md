# 工作室助手 - 微信小程序

> 时段打卡 + 工位预约系统 | 轻拟态 · 毛玻璃 UI | 本地存储版

---

## 功能概览

| 模块 | 功能 | 说明 |
|------|------|------|
| **打卡** | 签到/签退 | 自动获取位置，呼吸灯动效，无次数限制，历史记录分页 |
| **工位看板** | 状态网格 | 10个工位实时状态（空闲/预约中/使用中），颜色区分 |
| **预约记录** | 三段分类 | 进行中/待开始/已结束，支持手动取消 |
| **我的** | 数据统计 | 打卡统计、快捷入口、数据清除 |

---

## 项目架构

```
miniprogram/
├── app.js                       # 应用入口，初始化逻辑
├── app.json                     # 路由 & TabBar 配置
├── app.wxss                     # 全局样式（CSS变量、毛玻璃、动画）
├── utils/
│   └── storage.js               # ⭐ 数据访问层（核心）
├── pages/
│   ├── checkin/                 # Tab 1 - 打卡
│   ├── desk/                    # Tab 2 - 工位看板
│   ├── reservation/             # Tab 3 - 预约记录
│   ├── mine/                    # Tab 4 - 我的
│   └── desk-reserve/            # 子页 - 预约工位
├── components/
│   └── breathing-light/         # 呼吸灯组件
└── images/                      # TabBar 图标
```

### 分层架构

```
┌──────────────────────────────────────┐
│  页面层 (pages/)                      │
│  只调用 storage.js，不直接操作 Storage │
├──────────────────────────────────────┤
│  数据访问层 (utils/storage.js)         │
│  统一 CRUD 封装，Promise 返回          │
│  USE_CLOUD = false ← 切换开关          │
├──────────────────────────────────────┤
│  微信本地存储 (wx.StorageSync)         │
└──────────────────────────────────────┘
```

---

## 数据模型

### checkin_list — 打卡记录
| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 唯一ID |
| date | string | 日期 YYYY-MM-DD |
| startTime | string | 签到时间 |
| endTime | string | 签退时间（进行中为空） |
| status | string | 进行中 / 已签退 |
| duration | string | 总时长（如"2小时30分钟"） |
| location | object | { latitude, longitude, address } |
| createTime | string | 创建时间 |
| updateTime | string | 更新时间 |

### reservation_list — 预约记录
| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 唯一ID |
| deskId | string | 工位ID |
| deskName | string | 工位名称 |
| date | string | 预约日期 |
| startTime | string | 开始时间 HH:MM |
| endTime | string | 结束时间 HH:MM |
| status | string | 待开始 / 进行中 / 已结束 / 已取消 |
| userId | string | 预约用户ID |
| createTime | string | 创建时间 |

### desk_list — 工位基础数据
| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 唯一ID |
| area | string | 区域（A区/B区） |
| number | number | 编号（1-5） |
| name | string | 完整名称（如"A区1号"） |

---

## 核心设计

### 云端迁移预留

`utils/storage.js` 是唯一的存储访问入口：

```javascript
const USE_CLOUD = false; // ← 改为 true 启用云端

// 当前实现（本地）
function getCheckinList() {
  return getStorage('checkin_list').then(list => list || []);
}

// 未来替换（云端）
// function getCheckinList() {
//   if (!USE_CLOUD) return getStorage('checkin_list').then(list => list || []);
//   return wx.cloud.callFunction({ name: 'getCheckinList' });
// }
```

**切换步骤**：
1. 将 `USE_CLOUD` 改为 `true`
2. 替换每个函数的内部实现为云端 API 调用
3. 页面层代码**无需任何修改**

### 冲突检测算法

预约提交时，对同一工位同一日期的现有预约进行时间段重叠检测：

```
冲突条件：A开始 < B结束 && A结束 > B开始
```

### 自动状态更新

每次页面 `onShow` 时调用 `refreshReservationStatus()`，根据当前时间自动将预约状态从"待开始"→"进行中"→"已结束"。

---

## 快速开始

1. 微信开发者工具打开此目录
2. 填入 AppID（`project.config.json` 中已预设）
3. 编译运行即可

首次启动自动初始化：
- 10 个工位（A区1-5号，B区1-5号）
- 若干示例打卡记录（便于测试 UI）

---

## 第二期规划（扩展预留）

| 功能 | 依赖接口 | 状态 |
|------|----------|------|
| 📊 数据导出 Excel | storage.getCheckinList() | 已预留 |
| 📍 打卡围栏校验 | location 数据已采集 | 已预留 |
| 📈 每周统计报表 | 打卡数据聚合查询 | 已预留 |
| 🔔 订阅消息提醒 | wx.requestSubscribeMessage | 预留接口 |
| ☁️ 云端数据同步 | USE_CLOUD 开关 | 已预留 |
| 👥 多用户管理 | userId 字段已设计 | 已预留 |

---

## 技术栈

- 微信小程序原生框架
- ES6 Promise 异步
- CSS3 动画（呼吸灯、淡入、上滑）
- **设计风格**：轻拟态 + 毛玻璃 (Glassmorphism)
- **配色**：蓝紫渐变主色 `#6366F1 → #8B5CF6`

## 注意事项

- TabBar 图标为纯色占位图标，建议替换为专业设计图标（推荐 81x81px PNG）
- 当前版本为纯本地存储，清除小程序数据会丢失所有记录
- 位置权限需用户手动授权，用于打卡地址记录
