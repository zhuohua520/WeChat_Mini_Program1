/**
 * pages/fish-post/fish-post.js — 发布摸鱼动态
 * 图片存文件系统，列表只存路径，无数量限制
 */
const storage = require('../../utils/storage');
const IMAGE_DIR = wx.env.USER_DATA_PATH + '/fish_images/';

// 确保图片目录存在
try { wx.getFileSystemManager().accessSync(IMAGE_DIR); } catch (e) { wx.getFileSystemManager().mkdirSync(IMAGE_DIR, true); }

Page({
  data: {
    text: '',
    images: [],          // [{ path, savedPath }]
    maxImages: 9,
    maxTextLength: 500,
    submitting: false
  },

  onTextInput(e) { this.setData({ text: e.detail.value }); },

  // 选择图片 → 压缩 → 存入永久目录
  onChooseImage() {
    const remain = this.data.maxImages - this.data.images.length;
    if (remain <= 0) { wx.showToast({ title: '最多9张图片', icon: 'none' }); return; }
    wx.chooseImage({
      count: remain, sizeType: ['compressed'], sourceType: ['album', 'camera'],
      success: (res) => this.compressAndSave(res.tempFilePaths)
    });
  },

  compressAndSave(paths) {
    wx.showLoading({ title: '处理图片...', mask: true });
    let done = 0;
    const newImgs = new Array(paths.length);
    const fm = wx.getFileSystemManager();

    paths.forEach((path, idx) => {
      wx.compressImage({
        src: path, quality: 50,
        success: (cr) => {
          const savedPath = IMAGE_DIR + 'fish_' + Date.now() + '_' + Math.random().toString(36).substr(2,6) + '_' + idx + '.jpg';
          fm.copyFile({
            srcPath: cr.tempFilePath, destPath: savedPath,
            success: () => {
              newImgs[idx] = { path: savedPath, savedPath };
              done++; if (done === paths.length) this.finish(newImgs);
            },
            fail: () => {
              // copyFile 失败，尝试直接保存原图
              fm.copyFile({
                srcPath: path, destPath: savedPath,
                success: () => {
                  newImgs[idx] = { path: savedPath, savedPath };
                  done++; if (done === paths.length) this.finish(newImgs);
                },
                fail: () => { done++; if (done === paths.length) this.finish(newImgs); }
              });
            }
          });
        },
        fail: () => {
          // 压缩失败，直接存原图
          const savedPath = IMAGE_DIR + 'fish_' + Date.now() + '_' + Math.random().toString(36).substr(2,6) + '_' + idx + '.jpg';
          fm.copyFile({
            srcPath: path, destPath: savedPath,
            success: () => {
              newImgs[idx] = { path: savedPath, savedPath };
              done++; if (done === paths.length) this.finish(newImgs);
            },
            fail: () => { done++; if (done === paths.length) this.finish(newImgs); }
          });
        }
      });
    });
  },

  finish(newImgs) {
    wx.hideLoading();
    const valid = newImgs.filter(Boolean);
    if (valid.length === 0) { wx.showToast({ title: '图片处理失败', icon: 'none' }); return; }
    this.setData({ images: [...this.data.images, ...valid] });
  },

  onDeleteImage(e) {
    const idx = e.currentTarget.dataset.index;
    const img = this.data.images[idx];
    // 删除文件
    if (img && img.savedPath) {
      try { wx.getFileSystemManager().unlinkSync(img.savedPath); } catch (e) {}
    }
    const images = [...this.data.images]; images.splice(idx, 1);
    this.setData({ images });
  },

  onPreviewImage(e) {
    const url = e.currentTarget.dataset.url;
    const urls = this.data.images.map(i => i.path);
    wx.previewImage({ current: url, urls });
  },

  async onSubmit() {
    const { text, images } = this.data;
    if (!text.trim() && images.length === 0) {
      wx.showToast({ title: '请输入文字或添加图片', icon: 'none' }); return;
    }
    if (text.length > this.data.maxTextLength) {
      wx.showToast({ title: `字数不能超过${this.data.maxTextLength}`, icon: 'none' }); return;
    }

    this.setData({ submitting: true });
    wx.showLoading({ title: '发布中...', mask: true });

    try {
      const userInfo = await storage.getUserInfo();
      await storage.createFishPost({
        userId: userInfo.userId,
        userName: userInfo.nickName,
        userAvatar: userInfo.avatarUrl,
        text: text.trim(),
        images: images.map(i => i.savedPath)  // 只存文件路径
      });
      wx.hideLoading();
      wx.vibrateShort({ type: 'medium' });
      wx.showToast({ title: '发布成功 🎉', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1200);
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: err.message || '发布失败', icon: 'none' });
      this.setData({ submitting: false });
    }
  }
});
