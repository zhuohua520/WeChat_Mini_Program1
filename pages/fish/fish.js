/**
 * pages/fish/fish.js — 摸鱼动态信息流
 */
const storage = require('../../utils/storage');

Page({
  data: {
    posts: [],
    userInfo: null,
    page: 1,
    pageSize: 8,
    hasMore: true,
    loading: true,
    expandedComments: {},
    commentTexts: {}
  },

  onShow() {
    // 首次加载后才刷新，避免切换 Tab 重置列表
    if (this.data.posts.length === 0) {
      this.loadUserAndPosts();
    } else {
      this.loadUserAndPosts(false);
    }
  },

  async loadUserAndPosts(resetPage = true) {
    try {
      const userInfo = await storage.getUserInfo();
      if (resetPage) this.setData({ userInfo, page: 1, hasMore: true });
      else this.setData({ userInfo });
      await this.loadPosts(resetPage);
    } catch (err) {
      console.error('加载失败:', err);
    }
  },

  onPullDownRefresh() {
    this.setData({ page: 1, hasMore: true });
    this.loadPosts(true).then(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) this.loadPosts(false);
  },

  // 为帖子标记当前用户是否已点赞
  markLikedStatus(posts, userId) {
    return posts.map(p => ({
      ...p,
      isLiked: p.likes && p.likes.indexOf(userId) > -1
    }));
  },

  async loadPosts(reset) {
    const page = reset ? 1 : this.data.page;
    this.setData({ loading: true });
    try {
      const res = await storage.getFishPosts({ page, pageSize: this.data.pageSize });
      const userId = this.data.userInfo ? this.data.userInfo.userId : '';
      const items = this.markLikedStatus(res.items, userId);
      const posts = reset ? items : [...this.data.posts, ...items];
      this.setData({ posts, hasMore: res.hasMore, page: page + 1, loading: false });
    } catch (err) {
      this.setData({ loading: false });
    }
  },

  onPublish() {
    wx.navigateTo({ url: '/pages/fish-post/fish-post' });
  },

  // 图片预览（兼容旧 base64 和新文件路径）
  onPreviewImage(e) {
    const postId = e.currentTarget.dataset.postId;
    const imgIndex = parseInt(e.currentTarget.dataset.imgIndex);
    const post = this.data.posts.find(p => p.id === postId);
    if (!post || !post.images) return;
    
    const images = post.images;
    const first = images[imgIndex] || '';
    
    // 新格式：文件路径直接预览
    if (first.startsWith('/') || first.startsWith('wxfile://') || first.includes('USER_DATA_PATH')) {
      wx.previewImage({ current: images[imgIndex], urls: images });
      return;
    }
    
    // 旧格式：base64 转临时文件
    const fm = wx.getFileSystemManager();
    const tempDir = wx.env.USER_DATA_PATH + '/preview/';
    try { fm.accessSync(tempDir); } catch (e) { fm.mkdirSync(tempDir, true); }
    let done = 0;
    const tempPaths = new Array(images.length);
    images.forEach((base64, idx) => {
      const data = base64.replace(/^data:image\/\w+;base64,/, '');
      const fp = tempDir + 'prev_' + Date.now() + '_' + idx + '.jpg';
      fm.writeFile({
        filePath: fp, data, encoding: 'base64',
        success: () => { tempPaths[idx] = fp; done++; if (done === images.length) wx.previewImage({ current: tempPaths[imgIndex], urls: tempPaths }); },
        fail: () => { done++; if (done === images.length) wx.previewImage({ current: tempPaths[imgIndex], urls: tempPaths }); }
      });
    });
  },

  // 点赞/取消
  async onToggleLike(e) {
    const postId = e.currentTarget.dataset.id;
    const userId = this.data.userInfo.userId;
    try {
      const { liked } = await storage.toggleLikePost(postId, userId);
      wx.vibrateShort({ type: 'light' });
      
      // 乐观更新本地状态
      const posts = this.data.posts.map(p => {
        if (p.id !== postId) return p;
        let likes = [...(p.likes || [])];
        if (liked) { if (likes.indexOf(userId) === -1) likes.push(userId); }
        else { const i = likes.indexOf(userId); if (i > -1) likes.splice(i, 1); }
        return { ...p, likes, isLiked: liked };
      });
      this.setData({ posts });
    } catch (err) {
      // 失败回滚
      const posts = this.data.posts.map(p => {
        if (p.id !== postId) return p;
        return { ...p, isLiked: !p.isLiked };
      });
      this.setData({ posts });
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  onToggleComments(e) {
    const postId = e.currentTarget.dataset.id;
    const expanded = { ...this.data.expandedComments };
    expanded[postId] = !expanded[postId];
    this.setData({ expandedComments: expanded });
  },

  onCommentInput(e) {
    const postId = e.currentTarget.dataset.id;
    const texts = { ...this.data.commentTexts };
    texts[postId] = e.detail.value;
    this.setData({ commentTexts: texts });
  },

  async onSubmitComment(e) {
    const postId = e.currentTarget.dataset.id;
    const text = (this.data.commentTexts[postId] || '').trim();
    if (!text) { wx.showToast({ title: '请输入评论', icon: 'none' }); return; }
    const userId = this.data.userInfo.userId;
    const userName = this.data.userInfo.nickName;
    try {
      const comment = await storage.commentOnPost(postId, userId, userName, text);
      const posts = this.data.posts.map(p => {
        if (p.id !== postId) return p;
        return { ...p, comments: [...p.comments, comment] };
      });
      const texts = { ...this.data.commentTexts }; texts[postId] = '';
      this.setData({ posts, commentTexts: texts, expandedComments: { ...this.data.expandedComments, [postId]: true } });
      wx.vibrateShort({ type: 'light' });
    } catch (err) {
      wx.showToast({ title: err.message || '评论失败', icon: 'none' });
    }
  },

  onLongPress(e) {
    const postId = e.currentTarget.dataset.id;
    const post = this.data.posts.find(p => p.id === postId);
    if (!post) return;
    if (post.userId !== this.data.userInfo.userId) {
      wx.showToast({ title: '只能删除自己的动态', icon: 'none' }); return;
    }
    wx.showModal({
      title: '删除动态', content: '确定删除这条动态吗？',
      confirmColor: '#F08080',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await storage.deleteFishPost(postId, this.data.userInfo.userId);
          // 清理图片文件
          if (post.images && post.images.length > 0) {
            const fm = wx.getFileSystemManager();
            post.images.forEach(p => {
              if (p && (p.startsWith('/') || p.includes('USER_DATA_PATH'))) {
                try { fm.unlinkSync(p); } catch (e) {}
              }
            });
          }
          const posts = this.data.posts.filter(p => p.id !== postId);
          this.setData({ posts });
          wx.showToast({ title: '已删除', icon: 'success' });
        } catch (err) {
          wx.showToast({ title: err.message || '删除失败', icon: 'none' });
        }
      }
    });
  },

  relativeTime(dateStr) {
    const now = Date.now();
    const then = new Date(dateStr.replace(' ', 'T')).getTime();
    const diff = Math.floor((now - then) / 1000);
    if (diff < 60) return '刚刚';
    if (diff < 3600) return Math.floor(diff / 60) + '分钟前';
    if (diff < 86400) return Math.floor(diff / 3600) + '小时前';
    if (diff < 604800) return Math.floor(diff / 86400) + '天前';
    return (dateStr || '').split(' ')[0];
  }
});
