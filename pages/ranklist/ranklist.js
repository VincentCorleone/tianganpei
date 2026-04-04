Page({
  data: {
    leaderboard: [],
    loading: true,
    error: ''
  },

  onLoad() {
    this.loadLeaderboard();
  },

  async loadLeaderboard() {
    // 【请修改为你的服务器IP或域名】
    const API_BASE = 'http://YOUR_SERVER_IP:3000';

    try {
      const response = await wx.request({
        url: `${API_BASE}/api/leaderboard`,
        method: 'GET'
      });

      if (response.data.success) {
        this.setData({
          leaderboard: response.data.data,
          loading: false
        });
      } else {
        throw new Error(response.data.error || '加载失败');
      }
    } catch (e) {
      console.error('加载排行榜失败:', e);
      this.setData({
        loading: false,
        error: e.message || '网络请求失败'
      });
    }
  },

  onPullDownRefresh() {
    this.loadLeaderboard().then(() => {
      wx.stopPullDownRefresh();
    });
  }
});
