/**
 * utils/storage.js — 本地存储数据访问层
 * 
 * 设计原则：
 * 1. 所有数据操作统一通过此模块，页面逻辑不直接调用 wx.setStorageSync
 * 2. 所有方法返回 Promise，便于未来切换云端 API
 * 3. 预留 USE_CLOUD 开关，设为 true + 替换内部实现即可迁移云端
 * 4. 数据读写均通过此层，确保数据一致性
 */

const USE_CLOUD = false; // 切换云端存储开关

// ==================== 内部工具函数 ====================

/** 生成唯一ID */
function generateId() {
  return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
}

/** 格式化日期 YYYY-MM-DD */
function formatDate(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 格式化时间 HH:MM:SS */
function formatTime(date) {
  const d = new Date(date);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

/** 格式化日期时间 YYYY-MM-DD HH:MM:SS */
function formatDateTime(date) {
  return formatDate(date) + ' ' + formatTime(date);
}

/** 计算时长（分钟）→ 返回可读字符串 */
function calcDuration(startTime, endTime) {
  const diff = new Date(endTime).getTime() - new Date(startTime).getTime();
  const totalMinutes = Math.floor(diff / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) return `${hours}小时${minutes}分钟`;
  if (hours > 0) return `${hours}小时`;
  return `${minutes}分钟`;
}

/** 读取本地存储 */
function getStorage(key) {
  return new Promise((resolve, reject) => {
    try {
      const data = wx.getStorageSync(key);
      resolve(data || null);
    } catch (e) {
      console.error(`[storage] 读取 ${key} 失败:`, e);
      reject(e);
    }
  });
}

/** 写入本地存储 */
function setStorage(key, value) {
  return new Promise((resolve, reject) => {
    try {
      wx.setStorageSync(key, value);
      resolve(true);
    } catch (e) {
      console.error(`[storage] 写入 ${key} 失败:`, e);
      reject(e);
    }
  });
}

/** 获取明天的日期 YYYY-MM-DD */
function getTomorrowDate() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return formatDate(d);
}

// ==================== 打卡记录 CRUD ====================

/**
 * 获取所有打卡记录
 * @param {Object} filters 可选筛选条件 { date, status, limit }
 * @returns {Promise<Array>}
 */
function getCheckinList(filters = {}) {
  if (USE_CLOUD) {
    // TODO: 替换为云端查询
    return Promise.resolve([]);
  }

  return getStorage('checkin_list').then(list => {
    let result = list || [];
    
    if (filters.date) {
      result = result.filter(r => r.date === filters.date);
    }
    if (filters.status) {
      result = result.filter(r => r.status === filters.status);
    }
    
    // 按创建时间倒序
    result.sort((a, b) => new Date(b.createTime).getTime() - new Date(a.createTime).getTime());
    
    if (filters.limit) {
      result = result.slice(0, filters.limit);
    }
    
    return result;
  });
}

/**
 * 获取单条打卡记录
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
function getCheckinById(id) {
  return getCheckinList().then(list => list.find(r => r.id === id) || null);
}

/**
 * 签到：创建新打卡记录
 * @param {Object} location { latitude, longitude, address }
 * @returns {Promise<Object>} 新创建的记录
 */
function checkin(location) {
  const now = new Date();
  const record = {
    id: generateId(),
    date: formatDate(now),
    startTime: formatDateTime(now),
    endTime: '',
    status: '进行中',
    duration: '',
    location: {
      latitude: location.latitude || 0,
      longitude: location.longitude || 0,
      address: location.address || '未知位置'
    },
    createTime: formatDateTime(now),
    updateTime: formatDateTime(now)
  };

  return getStorage('checkin_list').then(list => {
    const newList = [record, ...(list || [])];
    return setStorage('checkin_list', newList).then(() => record);
  });
}

/**
 * 签退：更新打卡记录
 * @param {string} id 打卡记录ID
 * @returns {Promise<Object>} 更新后的记录
 */
function checkout(id) {
  const now = new Date();
  const endTime = formatDateTime(now);

  return getStorage('checkin_list').then(list => {
    if (!list) throw new Error('无打卡记录');
    
    const index = list.findIndex(r => r.id === id);
    if (index === -1) throw new Error('打卡记录不存在');
    if (list[index].status !== '进行中') throw new Error('该记录已签退');

    const record = list[index];
    record.endTime = endTime;
    record.status = '已签退';
    record.duration = calcDuration(record.startTime, endTime);
    record.updateTime = endTime;

    const newList = [...list];
    newList[index] = { ...record };
    
    return setStorage('checkin_list', newList).then(() => record);
  });
}

/**
 * 获取当前进行中的打卡记录（仅一条）
 * @returns {Promise<Object|null>}
 */
function getActiveCheckin() {
  return getCheckinList({ status: '进行中', limit: 1 }).then(list => list[0] || null);
}

/**
 * 删除打卡记录（管理员功能预留）
 */
function deleteCheckin(id) {
  return getStorage('checkin_list').then(list => {
    if (!list) return false;
    const newList = list.filter(r => r.id !== id);
    return setStorage('checkin_list', newList).then(() => true);
  });
}

// ==================== 工位 CRUD ====================

/**
 * 获取所有工位
 * @returns {Promise<Array>}
 */
function getDeskList() {
  if (USE_CLOUD) {
    return Promise.resolve([]);
  }
  return getStorage('desk_list').then(list => list || []);
}

/**
 * 初始化工位数据（仅首次）
 */
function initDeskList() {
  return getStorage('desk_list').then(existing => {
    if (existing && existing.length > 0) return existing;
    
    const desks = [];
    // 4 个校内工位（逸夫楼117）
    for (let i = 1; i <= 4; i++) {
      desks.push({
        id: generateId(),
        area: '校内·逸夫楼117',
        number: i,
        name: `工位${i}号`,
        createTime: formatDateTime(new Date())
      });
    }
    return setStorage('desk_list', desks).then(() => desks);
  });
}

// ==================== 预约记录 CRUD ====================

/**
 * 获取所有预约记录
 * @param {Object} filters { status, deskId, date }
 * @returns {Promise<Array>}
 */
function getReservationList(filters = {}) {
  if (USE_CLOUD) {
    return Promise.resolve([]);
  }

  return getStorage('reservation_list').then(list => {
    let result = list || [];
    
    if (filters.status) {
      result = result.filter(r => r.status === filters.status);
    }
    if (filters.deskId) {
      result = result.filter(r => r.deskId === filters.deskId);
    }
    if (filters.date) {
      result = result.filter(r => r.date === filters.date);
    }
    
    result.sort((a, b) => new Date(b.createTime).getTime() - new Date(a.createTime).getTime());
    return result;
  });
}

/**
 * 冲突检测：检查指定工位在指定时间段内是否有冲突预约
 * @param {string} deskId
 * @param {string} date YYYY-MM-DD
 * @param {string} startTime HH:MM
 * @param {string} endTime HH:MM
 * @returns {Promise<Object>} { conflicted: boolean, conflictRecord: null|Object }
 */
function checkReservationConflict(deskId, date, startTime, endTime) {
  return getReservationList({ deskId, date }).then(list => {
    // 只检查非取消的预约
    const activeList = list.filter(r => r.status !== '已取消');
    
    const reqStart = startTime;
    const reqEnd = endTime;
    
    for (const record of activeList) {
      const existStart = record.startTime;
      const existEnd = record.endTime;
      
      // 时间段重叠检测：A开始 < B结束 && A结束 > B开始
      if (reqStart < existEnd && reqEnd > existStart) {
        return { conflicted: true, conflictRecord: record };
      }
    }
    
    return { conflicted: false, conflictRecord: null };
  });
}

/**
 * 创建预约
 * @param {Object} data { deskId, date, startTime, endTime, deskName }
 * @returns {Promise<Object>}
 */
function createReservation(data) {
  const now = new Date();
  const todayDate = formatDate(now);
  const tomorrowDate = getTomorrowDate();
  const userId = data.userId || 'local_user';
  
  // 规则1：必须至少提前1天预约
  if (data.date <= todayDate) {
    return Promise.reject(new Error(`预约需提前至少1天，最早可预约 ${tomorrowDate}`));
  }
  
  // 规则2：检查是否在惩罚期内
  return isUserBanned(userId, data.date).then(banned => {
    if (banned) {
      return getPenaltyList().then(penalties => {
        const active = penalties.find(p => p.userId === userId && p.banEndDate >= data.date);
        throw new Error(`您因违规被暂停预约资格，${active.banEndDate} 后可恢复`);
      });
    }
  }).then(() => {
    // 规则3：检测时段冲突
    return checkReservationConflict(data.deskId, data.date, data.startTime, data.endTime);
  }).then(result => {
    if (result.conflicted) {
      throw new Error('该时段已被预约');
    }
    
    const record = {
      id: generateId(),
      deskId: data.deskId,
      deskName: data.deskName,
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      status: '待开始',
      userId: userId,
      userName: data.userName || '本地用户',
      createTime: formatDateTime(now),
      updateTime: formatDateTime(now)
    };
    
    return getStorage('reservation_list').then(list => {
      const newList = [record, ...(list || [])];
      return setStorage('reservation_list', newList).then(() => record);
    });
  });
}

/**
 * 取消预约
 * @param {string} id
 * @returns {Promise<Object>}
 */
function cancelReservation(id) {
  return getStorage('reservation_list').then(list => {
    if (!list) throw new Error('无预约记录');
    
    const index = list.findIndex(r => r.id === id);
    if (index === -1) throw new Error('预约记录不存在');
    if (list[index].status === '已结束') throw new Error('已结束的预约无法取消');
    if (list[index].status === '已取消') throw new Error('该预约已取消');
    
    const newList = [...list];
    newList[index] = {
      ...newList[index],
      status: '已取消',
      updateTime: formatDateTime(new Date())
    };
    
    return setStorage('reservation_list', newList).then(() => newList[index]);
  });
}

/**
 * 自动更新预约状态（在页面 onShow 时调用）
 * 将到时间的"待开始"改为"进行中"，过期的改为"已结束"
 */
function refreshReservationStatus() {
  return getStorage('reservation_list').then(list => {
    if (!list || list.length === 0) return [];
    
    const now = new Date();
    const nowDate = formatDate(now);
    const nowTime = formatTime(now);
    
    let changed = false;
    const violationPromises = []; // 违规检测 Promise 列表
    
    const newList = list.map(r => {
      if (r.status === '已取消' || r.status === '已结束') return r;
      
      const isToday = r.date === nowDate;
      const isBeforeStart = isToday && r.startTime > nowTime;
      const isInRange = isToday && r.startTime <= nowTime && r.endTime > nowTime;
      const isPast = r.date < nowDate || (isToday && r.endTime <= nowTime);
      
      if (isPast && r.status !== '已结束') {
        changed = true;
        // 检测违规：预约时段结束，检查是否在校内签到
        violationPromises.push(
          detectNoShowViolation(r).then(violated => {
            if (violated) {
              return addPenalty(r.userId, `预约 ${r.deskName} ${r.date} ${r.startTime}-${r.endTime} 未到岗签到`, 2);
            }
          })
        );
        return { ...r, status: '已结束', updateTime: formatDateTime(now) };
      }
      if (isInRange && r.status !== '进行中') {
        changed = true;
        return { ...r, status: '进行中', updateTime: formatDateTime(now) };
      }
      if (isBeforeStart && r.status !== '待开始') {
        changed = true;
        return { ...r, status: '待开始', updateTime: formatDateTime(now) };
      }
      return r;
    });
    
    const savePromise = changed
      ? setStorage('reservation_list', newList).then(() => newList)
      : Promise.resolve(newList);
    
    return savePromise.then(result => {
      return Promise.all(violationPromises).then(() => result);
    });
  });
}

/**
 * 检测预约时段内是否在校内签到（违规缺席检测）
 * @param {Object} reservation 已结束的预约记录
 * @returns {Promise<boolean>} true=违规（未签到）
 */
function detectNoShowViolation(reservation) {
  return getCheckinList({ date: reservation.date }).then(checkins => {
    // 查找该预约时段内是否有校内打卡记录
    const hasCampusCheckin = checkins.some(c => {
      if (c.status !== '已签退') return false;
      const checkinTime = c.startTime.split(' ')[1] || c.startTime; // 取时间部分 HH:MM:SS
      const checkoutTime = c.endTime.split(' ')[1] || c.endTime;
      const isCampus = c.location.address && (
        c.location.address.includes('逸夫楼') || 
        c.location.address.includes('校内')
      );
      // 打卡时间与预约时段有重叠
      return isCampus && checkinTime < reservation.endTime && checkoutTime > reservation.startTime;
    });
    return !hasCampusCheckin; // 没有校内打卡 → 违规
  });
}

// ==================== 惩罚管理 ====================

/**
 * 获取惩罚列表
 */
function getPenaltyList() {
  return getStorage('penalty_list').then(list => list || []);
}

/**
 * 检查用户是否在指定日期被禁止预约
 * @param {string} userId
 * @param {string} targetDate YYYY-MM-DD
 * @returns {Promise<boolean>}
 */
function isUserBanned(userId, targetDate) {
  return getPenaltyList().then(list => {
    return list.some(p => p.userId === userId && p.banStartDate <= targetDate && p.banEndDate >= targetDate);
  });
}

/**
 * 添加惩罚记录（禁止预约 N 天）
 * @param {string} userId
 * @param {string} reason
 * @param {number} banDays 禁止天数
 */
function addPenalty(userId, reason, banDays) {
  const now = new Date();
  const banStartDate = formatDate(now);
  const banEnd = new Date(now);
  banEnd.setDate(banEnd.getDate() + banDays);
  const banEndDate = formatDate(banEnd);
  
  const record = {
    id: generateId(),
    userId,
    reason,
    banStartDate,
    banEndDate,
    banDays,
    createTime: formatDateTime(now)
  };
  
  return getPenaltyList().then(list => {
    const newList = [record, ...(list || [])];
    return setStorage('penalty_list', newList).then(() => record);
  });
}

/**
 * 获取当前用户的惩罚状态
 * @param {string} userId
 * @returns {Promise<Object>} { isBanned, activePenalty }
 */
function getUserPenaltyStatus(userId) {
  const today = formatDate(new Date());
  return getPenaltyList().then(list => {
    const active = list.find(p => p.userId === userId && p.banStartDate <= today && p.banEndDate >= today);
    return {
      isBanned: !!active,
      activePenalty: active || null
    };
  });
}

// ==================== 预约看板 ====================

/**
 * 获取所有当前有效的已预约时段（进行中 + 待开始）
 * 用于预约页"预约中"标签点击查看详情
 * @returns {Promise<Array>}
 */
function getAllActiveBookedSlots() {
  return getReservationList().then(list => {
    return (list || [])
      .filter(r => r.status === '进行中' || r.status === '待开始')
      .sort((a, b) => {
        const aTime = a.date + a.startTime;
        const bTime = b.date + b.startTime;
        return aTime.localeCompare(bTime);
      });
  });
}

/**
 * 获取指定工位的所有预约记录（历史+未来，含已取消）
 * @param {string} deskId
 * @returns {Promise<Array>}
 */
function getDeskAllReservations(deskId) {
  return getReservationList().then(list => {
    return (list || [])
      .filter(r => r.deskId === deskId)
      .sort((a, b) => {
        const aTime = a.date + a.startTime;
        const bTime = b.date + b.startTime;
        return bTime.localeCompare(aTime); // 时间倒序
      });
  });
}

/**
 * 获取指定工位在指定日期的已占时段
 * @param {string} deskId
 * @param {string} date YYYY-MM-DD
 * @returns {Promise<Array>} [{startTime, endTime, userName, status}]
 */
function getBookedSlotsForDate(deskId, date) {
  return getReservationList({ deskId, date }).then(list => {
    return (list || [])
      .filter(r => r.status !== '已取消')
      .map(r => ({
        startTime: r.startTime,
        endTime: r.endTime,
        userName: r.userName || '未知',
        status: r.status
      }))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  });
}

/**
 * 获取工位当前状态（基于预约数据实时计算）
 * @param {string} deskId
 * @returns {Promise<string>} '空闲' | '预约中' | '使用中'
 */
function getDeskStatus(deskId) {
  const now = new Date();
  const nowDate = formatDate(now);
  const nowTime = formatTime(now);
  
  // 获取该工位所有有效预约（不限定今天）
  return getReservationList({ deskId }).then(list => {
    const activeList = list.filter(r => r.status !== '已取消' && r.status !== '已结束');
    
    // 1. 检查当前是否正在使用中
    for (const r of activeList) {
      if (r.date === nowDate && r.startTime <= nowTime && r.endTime > nowTime) {
        return '使用中';
      }
    }
    
    // 2. 检查是否有未来预约（今天未开始的 + 明天及以后）
    const hasUpcoming = activeList.some(r => {
      if (r.date > nowDate) return true;               // 明天及以后
      if (r.date === nowDate && r.startTime > nowTime) return true; // 今天稍后
      return false;
    });
    if (hasUpcoming) return '预约中';
    
    return '空闲';
  });
}

/**
 * 批量获取所有工位状态
 * @returns {Promise<Object>} { deskId: status }
 */
function getAllDeskStatuses() {
  return getDeskList().then(desks => {
    return getReservationList().then(reservations => {
      const now = new Date();
      const nowDate = formatDate(now);
      const nowTime = formatTime(now);
      
      const statusMap = {};
      desks.forEach(desk => {
        const deskReservations = reservations.filter(r => 
          r.deskId === desk.id && 
          r.status !== '已取消' && 
          r.status !== '已结束'
        );
        
        // 1. 检查当前是否正在使用中
        const inUse = deskReservations.some(r => 
          r.date === nowDate && r.startTime <= nowTime && r.endTime > nowTime
        );
        
        if (inUse) {
          statusMap[desk.id] = '使用中';
          return;
        }
        
        // 2. 检查是否有未来预约（今天未开始的 + 明天及以后）
        const reserved = deskReservations.some(r => {
          if (r.date > nowDate) return true;
          if (r.date === nowDate && r.startTime > nowTime) return true;
          return false;
        });
        
        if (reserved) {
          statusMap[desk.id] = '预约中';
        } else {
          statusMap[desk.id] = '空闲';
        }
      });
      
      return statusMap;
    });
  });
}

// ==================== 示例数据初始化 ====================

function initSampleCheckinData() {
  return getStorage('checkin_list').then(existing => {
    if (existing && existing.length > 0) return existing;
    
    const now = new Date();
    const records = [];
    
    // 生成前3天的示例记录
    for (let dayOffset = 3; dayOffset >= 0; dayOffset--) {
      const date = new Date(now);
      date.setDate(date.getDate() - dayOffset);
      const dateStr = formatDate(date);
      const baseHour = 8 + Math.floor(Math.random() * 2);
      
      records.push({
        id: generateId(),
        date: dateStr,
        startTime: `${dateStr} ${String(baseHour).padStart(2, '0')}:${String(Math.floor(Math.random() * 30)).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
        endTime: `${dateStr} ${String(baseHour + 4 + Math.floor(Math.random() * 6)).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
        status: '已签退',
        duration: `${4 + Math.floor(Math.random() * 6)}小时${Math.floor(Math.random() * 60)}分钟`,
        location: {
          latitude: 30.5728 + Math.random() * 0.01,
          longitude: 104.0668 + Math.random() * 0.01,
          address: '成都市武侯区天府软件园'
        },
        createTime: `${dateStr} ${String(baseHour).padStart(2, '0')}:00:00`,
        updateTime: `${dateStr} ${String(baseHour + 4).padStart(2, '0')}:00:00`
      });
    }
    
    return setStorage('checkin_list', records).then(() => records);
  });
}

// ==================== 用户信息 ====================

function getUserInfo() {
  return getStorage('user_info').then(info => {
    if (info) return info;
    const defaultInfo = {
      userId: 'user_' + generateId(),
      nickName: '工作室成员',
      avatarUrl: ''
    };
    return setStorage('user_info', defaultInfo).then(() => defaultInfo);
  });
}

/**
 * 更新用户信息
 * @param {Object} updates { nickName, avatarUrl }
 */
function updateUserInfo(updates) {
  return getUserInfo().then(info => {
    const updated = { ...info, ...updates };
    return setStorage('user_info', updated).then(() => updated);
  });
}

// ==================== 摸鱼动态 ====================

/**
 * 获取所有动态（分页）
 * @param {Object} filters { page, pageSize }
 */
function getFishPosts(filters = {}) {
  const page = filters.page || 1;
  const pageSize = filters.pageSize || 10;
  return getStorage('fish_posts').then(list => {
    const posts = (list || [])
      .filter(p => p.status !== 'deleted')
      .sort((a, b) => new Date(b.createTime).getTime() - new Date(a.createTime).getTime());
    const start = (page - 1) * pageSize;
    const items = posts.slice(start, start + pageSize);
    return { items, total: posts.length, hasMore: start + pageSize < posts.length };
  });
}

/**
 * 发布动态
 * @param {Object} data { userId, userName, userAvatar, text, images }
 */
function createFishPost(data) {
  const now = new Date();
  const post = {
    id: generateId(),
    userId: data.userId,
    userName: data.userName || '匿名',
    userAvatar: data.userAvatar || '',
    text: data.text || '',
    images: data.images || [],
    likes: [],
    comments: [],
    status: 'active',
    createTime: formatDateTime(now),
    updateTime: formatDateTime(now)
  };
  return getStorage('fish_posts').then(list => {
    const newList = [post, ...(list || [])];
    // 用异步写入避免大图片 base64 阻塞主线程
    return new Promise((resolve, reject) => {
      wx.setStorage({ key: 'fish_posts', data: newList,
        success: () => resolve(post),
        fail: (e) => reject(new Error('存储空间不足，请减少图片数量或大小'))
      });
    });
  });
}

/**
 * 删除动态（仅自己）
 * @param {string} postId
 * @param {string} userId
 */
function deleteFishPost(postId, userId) {
  return getStorage('fish_posts').then(list => {
    if (!list) throw new Error('无动态数据');
    const idx = list.findIndex(p => p.id === postId);
    if (idx === -1) throw new Error('动态不存在');
    if (list[idx].userId !== userId) throw new Error('只能删除自己的动态');
    const newList = [...list];
    newList[idx] = { ...newList[idx], status: 'deleted' };
    return setStorage('fish_posts', newList).then(() => true);
  });
}

/**
 * 点赞/取消点赞
 * @param {string} postId
 * @param {string} userId
 * @returns {Promise<Object>} { liked: boolean, likeCount: number }
 */
function toggleLikePost(postId, userId) {
  return getStorage('fish_posts').then(list => {
    if (!list) throw new Error('无动态数据');
    const idx = list.findIndex(p => p.id === postId);
    if (idx === -1) throw new Error('动态不存在');
    const post = { ...list[idx] };
    const likes = [...post.likes];
    const likeIdx = likes.indexOf(userId);
    let liked;
    if (likeIdx > -1) { likes.splice(likeIdx, 1); liked = false; }
    else { likes.push(userId); liked = true; }
    post.likes = likes;
    const newList = [...list];
    newList[idx] = post;
    return setStorage('fish_posts', newList).then(() => ({ liked, likeCount: likes.length }));
  });
}

/**
 * 发表评论
 * @param {string} postId
 * @param {string} userId
 * @param {string} userName
 * @param {string} text
 */
function commentOnPost(postId, userId, userName, text) {
  if (!text || !text.trim()) return Promise.reject(new Error('评论不能为空'));
  const comment = {
    id: generateId(),
    userId, userName,
    text: text.trim(),
    createTime: formatDateTime(new Date())
  };
  return getStorage('fish_posts').then(list => {
    if (!list) throw new Error('无动态数据');
    const idx = list.findIndex(p => p.id === postId);
    if (idx === -1) throw new Error('动态不存在');
    const post = { ...list[idx] };
    post.comments = [...post.comments, comment];
    const newList = [...list];
    newList[idx] = post;
    return setStorage('fish_posts', newList).then(() => comment);
  });
}

// ==================== 模块导出 ====================

module.exports = {
  // 开关
  USE_CLOUD,
  
  // 工具函数
  formatDate,
  formatTime,
  formatDateTime,
  calcDuration,
  
  // 打卡
  getCheckinList,
  getCheckinById,
  checkin,
  checkout,
  getActiveCheckin,
  deleteCheckin,
  
  // 工位
  getDeskList,
  initDeskList,
  getDeskStatus,
  getAllDeskStatuses,
  
  // 预约
  getReservationList,
  checkReservationConflict,
  createReservation,
  cancelReservation,
  refreshReservationStatus,
  getAllActiveBookedSlots,
  getDeskAllReservations,
  getBookedSlotsForDate,
  
  // 惩罚
  getPenaltyList,
  isUserBanned,
  addPenalty,
  getUserPenaltyStatus,
  
  // 初始化
  initSampleCheckinData,
  
  // 用户
  getUserInfo,
  updateUserInfo,
  
  // 摸鱼动态
  getFishPosts,
  createFishPost,
  deleteFishPost,
  toggleLikePost,
  commentOnPost,
  
  // 底层读写（供特殊情况使用）
  getStorage,
  setStorage
};
