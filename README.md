# 微信小程序「工作室助手」开发全记录——从零构建打卡预约+社交动态系统

> 一个面向高校工作室成员的轻量级管理工具，涵盖时段打卡、工位预约、违规惩罚、图文社交等完整功能，纯本地存储架构。

---

## 📌 项目简介

**工作室助手**是一款基于微信小程序原生框架开发的内部管理工具，服务对象为高校工作室成员。核心解决三个痛点：

1. **出勤管理**：成员上下班打卡，记录工作时长与地点
2. **工位分配**：有限工位资源的预约与冲突管理
3. **团队氛围**：内置「摸鱼」社交圈，成员可发布图文动态互动

项目采用**纯本地存储**架构（无后端/无云开发），但通过分层设计预留了云端迁移接口。

![小程序首页截图（TabBar 五个栏目概览）](https://i-blog.csdnimg.cn/direct/8fe9cc628fd04ac2ac018073b6430598.jpeg#pic_center)



---

## 🧩 功能模块概览

### 1. 时段打卡

- **签到前强制选择地点**：弹出 ActionSheet 提供两个固定选项——「校内打卡点」和「校外打卡点」
- **无限次数打卡**：同一天内可多次签到/签退，每次独立记录
- **签退自动计算时长**：显示「X小时X分钟」
- **呼吸灯动效**：进行中的打卡以绿色呼吸光环指示
- **历史记录分页**：下拉刷新 + 上拉加载更多

![签到地点选择界面截图](https://i-blog.csdnimg.cn/direct/6284b56773274825a7503ca659f34895.jpeg#pic_center)



### 2. 工位预约

- **4个校内工位**，2列网格卡片展示
- **实时状态看板**：绿色=空闲，橙色=预约中，红色=使用中
- **预约规则**：
  - 必须**提前至少1天**预约
  - 30分钟粒度选择时段
  - 自动冲突检测（时间段重叠算法）
  - 已占时段可视化展示（红色标签）
- **违规惩罚机制**：
  - 预约时段内未在校内签到 → 视为违规缺席
  - 自动暂停该成员**后续2天**的预约资格
- **详情弹窗**：点击工位卡片弹出，展示今日已占时段 + 全部历史预约

![工位看板界面截图](https://i-blog.csdnimg.cn/direct/66be062170f642178514d1ab8bdaeb76.jpeg#pic_center)


![预约时间选择界面截图](https://i-blog.csdnimg.cn/direct/dd86f40ea6934f969aa7baff42e41523.jpeg#pic_center)


### 3. 预约记录

- 三 Tab 分类：**进行中 / 待开始 / 已结束**
- 顶部「预约中」标签可点击，弹出底部弹窗展示所有当前预约时段
- 显示预约人姓名、日期、时段
- 支持取消预约（进行中/待开始）

![预约记录列表截图](https://i-blog.csdnimg.cn/direct/8dbf8059736e4b69a727986253f4df99.jpeg#pic_center)


### 4. 个人信息

- 头像上传（压缩后存文件系统）+ 姓名编辑
- 打卡次数、预约记录统计
- 一键清除所有本地数据（含文件系统清理）

![个人信息页截图](https://i-blog.csdnimg.cn/direct/d58ac599b6b5414ead966b4de1c6d175.jpeg#pic_center)


### 5. 「摸鱼」社交圈

- **图文动态发布**：文字（500字上限）+ 最多9张图片
- **图片处理**：压缩→存文件系统→Storage 只存路径，无数量限制
- **朋友圈式信息流**：卡片布局，头像+姓名+相对时间+九宫格图
- **点赞**：❤️/🤍 实时切换，带震动反馈
- **评论**：展开/折叠，行内输入
- **长按删除**：仅可删除自己的动态，同时清理图片文件
- **FAB 悬浮发布按钮**

![摸鱼动态列表截图](https://i-blog.csdnimg.cn/direct/6065890221ca494886db02a15aff913d.jpeg#pic_center)

![发布动态界面截图](https://i-blog.csdnimg.cn/direct/50a697642dff45a6a771daf3b64819ca.jpeg#pic_center)


---

## 🏗️ 技术选型与架构

### 技术栈

| 层 | 技术 |
|---|------|
| 框架 | 微信小程序原生 + ES6 |
| 存储 | `wx.Storage`（结构化数据）+ `FileSystemManager`（图片文件） |
| 样式 | CSS3 变量 + 毛玻璃卡片 + 马卡龙渐变主题 |
| 架构 | 分层设计（页面层 → 数据访问层 → 存储层） |

### 数据模型

```
Storage Keys:
├── checkin_list      打卡记录
├── reservation_list  预约记录
├── desk_list         工位基础数据
├── penalty_list      违规惩罚记录
├── fish_posts        摸鱼动态
└── user_info         用户信息
```

### 分层架构

```
┌─────────────────────────────────┐
│  pages/  (页面逻辑)              │
│  只调用 storage.js，不直接操作   │
│  wx.Storage 或 FileSystem        │
├─────────────────────────────────┤
│  utils/storage.js  (数据访问层)  │
│  统一 CRUD 封装 + Promise 返回   │
│  USE_CLOUD = false ← 切换开关    │
├─────────────────────────────────┤
│  wx.Storage + FileSystemManager  │
└─────────────────────────────────┘
```

所有数据操作通过 `storage.js` 统一封装，预留 `USE_CLOUD` 开关。未来迁移云端只需将此开关改为 `true` 并替换内部实现，页面代码无需任何修改。

---

## 🔧 开发过程中的关键问题与解决方案

### 1. 预约冲突检测

**问题**：同一工位同一时段只能被一人预约，需高效检测时间段重叠。

**方案**：采用经典时间段重叠算法：

```javascript
// A开始 < B结束 && A结束 > B开始 → 冲突
if (reqStart < existEnd && reqEnd > existStart) {
  return { conflicted: true };
}
```

遍历该工位该日期的所有有效预约，逐一比对。复杂度 O(n)，工位数量少时完全够用。

---

### 2. 违规缺席自动检测

**问题**：预约时段结束后，需自动判断成员是否到岗签到。

**方案**：在 `refreshReservationStatus()` 中，当预约状态变为「已结束」时触发检测：

1. 查询该成员该日期的所有打卡记录
2. 判断是否有打卡地点含「逸夫楼」或「校内」且时间与预约时段重叠
3. 若无 → 调用 `addPenalty()` 记录违规，禁止后续 2 天预约

---

### 3. 点赞状态实时同步

**问题**：WXML 模板中使用 `Array.indexOf()` 判断点赞状态不稳定，且刷新后颜色不更新。

**方案**：在 JS 层预计算 `isLiked` 标志，存入每个 post 对象：

```javascript
markLikedStatus(posts, userId) {
  return posts.map(p => ({
    ...p,
    isLiked: p.likes && p.likes.indexOf(userId) > -1
  }));
}
```

WXML 直接用 `{{post.isLiked ? '❤️' : '🤍'}}`，避免模板中的 indexOf 不可靠问题。点赞操作采用**乐观更新**（先改 UI，失败再回滚）。

---

### 4. 图片预览兼容（base64 → 文件路径）

**问题**：初期图片存为 base64 在 Storage 中，`wx.previewImage` 不支持 data URI。

**方案**：架构演进两步走——

- **第一阶段**：base64 写入临时文件再预览（兼容老数据）
- **第二阶段**：改为「图片存文件系统、Storage 只存路径」，新数据直接预览，速度快且无存储限制

```javascript
// 新格式：文件路径直接预览
if (first.startsWith('/') || first.includes('USER_DATA_PATH')) {
  wx.previewImage({ current: images[imgIndex], urls: images });
  return;
}
// 旧格式：base64 转临时文件再预览（兼容）
```

---

### 5. Storage 10MB 上限突破

**问题**：base64 图片存 Storage，多张图片动态发布几次就爆满。

**方案**：全部图片（头像 + 动态图片）改为**存文件系统**（`wx.env.USER_DATA_PATH`），Storage 只存几十字节的文件路径。理论可存数万条动态。

```javascript
// 发布前：压缩 → 复制到永久目录 → 只传路径给 Storage
wx.compressImage({ src: path, quality: 50, ... });
fm.copyFile({ srcPath, destPath: IMAGE_DIR + 'fish_xxx.jpg' });
storage.createFishPost({ images: [savedPath] }); // 只存路径
```

---

### 6. 工位看板「预约中」始终显示 0

**问题**：`getAllDeskStatuses()` 中判断「预约中」的条件为 `r.date === today && r.startTime > nowTime`，但预约规则要求提前至少 1 天，所以未来日期的预约全部被过滤掉了。

**方案**：扩展判断逻辑为「今天未开始的 + 所有未来日期」：

```javascript
const reserved = deskReservations.some(r => {
  if (r.date > nowDate) return true;               // 明天及以后
  if (r.date === nowDate && r.startTime > nowTime) return true; // 今天稍后
  return false;
});
```

---

### 7. backdrop-filter 导致分辨率降低

**问题**：全局 `.glass-card` 使用 `backdrop-filter: blur(20px)`，在微信小程序中导致整个画面渲染模糊、文字发虚。

**方案**：移除 `backdrop-filter`，将卡片背景透明度从 0.8 提升到 0.9，保持视觉效果同时恢复清晰渲染。

---

### 8. 删除动态时图片文件泄漏

**问题**：`deleteFishPost` 只删 Storage 记录，不删文件系统中的图片文件，长期使用后孤立文件堆积。

**方案**：删除时同步遍历 `post.images`，调用 `FileSystemManager.unlinkSync` 清理：

```javascript
post.images.forEach(p => {
  if (p && p.includes('USER_DATA_PATH')) {
    try { fm.unlinkSync(p); } catch (e) {}
  }
});
```

---

### 9. loadMore 分页逻辑错误

**问题**：`loadMore` 每次全量读取所有记录后 `slice(0, start)` 替换列表，页面闪烁且不追加。

**方案**：改为追加模式 `[...oldList, ...newItems]`，正确使用 offset 切片。

---

## 📁 项目结构

```
miniprogram/
├── app.js / app.json / app.wxss    # 入口 + 全局样式变量
├── utils/
│   └── storage.js                  # 数据访问层（900+ 行）
├── pages/
│   ├── checkin/                    # 打卡页
│   ├── desk/                       # 工位看板
│   ├── desk-reserve/               # 预约子页
│   ├── reservation/                # 预约记录
│   ├── fish/                       # 摸鱼信息流
│   ├── fish-post/                  # 发布动态
│   └── mine/                       # 我的
├── components/
│   └── breathing-light/            # 呼吸灯组件
└── images/                         # TabBar 图标
```

---

## 📝 总结与展望

### 开发心得

1. **分层架构很重要**：`storage.js` 的抽象让页面层完全解耦，后期修复数据层 Bug 不需要改页面代码
2. **图片存储要趁早规划**：从 base64 → 文件路径的迁移如果一开始就做对，能省去很多兼容代码
3. **模板中的复杂表达式不可靠**：`indexOf` 在 WXML 中的不稳定行为是踩坑后的教训——预计算到 `isLiked` 字段才是正解
4. **微信小程序的 CSS 有暗坑**：`backdrop-filter` 导致的渲染模糊问题花了很长时间才定位到

### 可改进方向

1. **云同步**：当前纯本地存储，切换 `USE_CLOUD=true` + 接入云开发即可实现多端同步
2. **数据导出**：打卡记录导出 Excel 报表
3. **打卡围栏**：GPS 地理位置校验，确保成员确实在指定地点打卡
4. **消息推送**：预约即将开始/违规通知等订阅消息

---

> 完整源码可前往Github获取[https://github.com/zhuohua520/WeChat_Mini_Program1]。欢迎 Star ⭐ 和交流讨论！
