
import '../render';
import MahjongTile from './mahjongTile';
import { TIANGAN, RELATIONS, TianganRelations } from './data';

const ctx = canvas.getContext('2d');

export default class TianganGame {
  constructor() {
    this.tiles = [];
    this.slotTiles = [];
    this.score = 0;
    this.aniId = 0;
    this.slotCount = 7;
    this.gameEnded = false;
    this.init();
    this.bindEvents();
    this.loop();
  }

  init() {
    this.tiles = [];
    this.slotTiles = [];
    this.score = 0;
    this.gameEnded = false;
    this.generateTiles();
  }

  generateTiles() {
    const tileSet = [];
    
    for (let i = 0; i < 5; i++) {
      TIANGAN.forEach(tiangan => {
        tileSet.push({ type: 'tiangan', value: tiangan });
      });
      RELATIONS.forEach(relation => {
        tileSet.push({ type: 'relation', value: relation });
      });
    }

    this.shuffleArray(tileSet);
    
    const selectedTiles = tileSet.slice(0, 75);
    
    this.createMultiLayerTiles(selectedTiles);
  }

  createMultiLayerTiles(tileData) {
    const centerX = canvas.width / 2;
    const centerY = 280;
    const layerOffset = 10;
    let index = 0;

    for (let layer = 3; layer >= 0; layer--) {
      const cols = 3 + layer;
      const rows = 3 + layer;
      const startX = centerX - (cols * 22) - layer * layerOffset;
      const startY = centerY - (rows * 28) - layer * layerOffset;

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          if (index >= tileData.length) break;
          
          const x = startX + col * 45 + (layer % 2) * 20;
          const y = startY + row * 55 + (layer % 2) * 25;
          
          const tile = new MahjongTile(
            tileData[index].type,
            tileData[index].value,
            x,
            y,
            layer
          );
          
          this.tiles.push(tile);
          index++;
        }
      }
    }
  }

  getTopTiles() {
    const topTiles = [];
    const activeTiles = this.tiles.filter(t => !t.destroyed && !t.moving);

    activeTiles.forEach(tile => {
      let isCovered = false;
      
      for (const other of activeTiles) {
        if (tile === other) continue;
        if (other.layer > tile.layer) {
          const overlapX = Math.abs(tile.x - other.x) < 32;
          const overlapY = Math.abs(tile.y - other.y) < 42;
          if (overlapX && overlapY) {
            isCovered = true;
            break;
          }
        }
      }
      
      if (!isCovered) {
        topTiles.push(tile);
      }
    });

    return topTiles;
  }

  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  bindEvents() {
    wx.onTouchStart((res) => {
      const touch = res.touches[0];
      this.handleTouch(touch.clientX, touch.clientY);
    });
  }

  handleTouch(x, y) {
    if (this.gameEnded && this.gameOverState) {
      this.handleGameOverTouch(x, y);
      return;
    }

    if (this.gameEnded) {
      return;
    }

    if (this.slotTiles.filter(t => !t.destroyed).length >= this.slotCount) {
      return;
    }

    for (const tile of this.slotTiles) {
      if (!tile.destroyed && !tile.moving && this.isSlotTileClicked(tile, x, y)) {
        return;
      }
    }

    const topTiles = this.getTopTiles();

    for (const tile of this.tiles) {
      if (tile.isClicked(x, y, topTiles)) {
        this.moveTileToSlot(tile);
        break;
      }
    }
  }

  isSlotTileClicked(tile, x, y) {
    return (
      x >= tile.x - 3 &&
      x <= tile.x + tile.width + 3 &&
      y >= tile.y - 3 &&
      y <= tile.y + tile.height + 3
    );
  }

  moveTileToSlot(tile) {
    const slotWidth = 45;
    const slotPadding = 6;
    const startX = (canvas.width - (this.slotCount * slotWidth + (this.slotCount - 1) * slotPadding)) / 2;
    const slotY = canvas.height - 120;

    const targetX = startX + this.slotTiles.length * (slotWidth + slotPadding);
    const targetY = slotY;

    tile.layer = -1;
    tile.moveTo(targetX, targetY);
    this.slotTiles.push(tile);

    setTimeout(() => {
      this.checkAndEliminate();
      this.rearrangeSlots();
      this.checkGameState();
    }, 350);
  }

  checkAndEliminate() {
    let foundMatch = true;
    
    while (foundMatch) {
      foundMatch = false;
      const activeTiles = this.slotTiles.filter(t => !t.destroyed);
      
      if (activeTiles.length < 3) {
        break;
      }

      const lastThree = activeTiles.slice(-3);
      
      if (this.isValidMatch(lastThree)) {
        lastThree.forEach(tile => {
          tile.destroy();
          this.score += 10;
        });
        foundMatch = true;
      }
    }
  }

  isValidMatch(tiles) {
    const tianganTiles = tiles.filter(t => t.type === 'tiangan');
    const relationTiles = tiles.filter(t => t.type === 'relation');

    if (tianganTiles.length !== 2 || relationTiles.length !== 1) {
      return false;
    }

    const t1 = tianganTiles[0].value;
    const t2 = tianganTiles[1].value;
    const rel = relationTiles[0].value;

    return (
      (TianganRelations[t1] && TianganRelations[t1][rel] === t2) ||
      (TianganRelations[t2] && TianganRelations[t2][rel] === t1)
    );
  }

  rearrangeSlots() {
    const activeTiles = this.slotTiles.filter(t => !t.destroyed);
    this.slotTiles = activeTiles;

    const slotWidth = 45;
    const slotPadding = 6;
    const startX = (canvas.width - (this.slotCount * slotWidth + (this.slotCount - 1) * slotPadding)) / 2;
    const slotY = canvas.height - 120;

    this.slotTiles.forEach((tile, index) => {
      const targetX = startX + index * (slotWidth + slotPadding);
      tile.moveTo(targetX, slotY);
    });
  }

  checkGameState() {
    if (this.gameEnded) {
      return;
    }

    const remainingActive = this.tiles.filter(t => !t.destroyed).length +
                            this.slotTiles.filter(t => !t.destroyed).length;

    if (remainingActive === 0 || this.slotTiles.filter(t => !t.destroyed).length >= this.slotCount) {
      this.gameEnded = true;
      this.showGameOverUI();
    }
  }

  showGameOverUI() {
    this.gameOverState = {
      score: this.score,
      nickname: '',
      inputFocus: false,
      submitting: false,
      showRanklist: false
    };
  }

  handleGameOverTouch(x, y) {
    if (!this.gameOverState || this.gameOverState.submitting) return;

    const btnWidth = 200;
    const btnHeight = 50;
    const centerX = canvas.width / 2;

    // 输入框区域
    const inputY = 250;
    if (x >= centerX - 150 && x <= centerX + 150 && y >= inputY && y <= inputY + 40) {
      this.gameOverState.inputFocus = !this.gameOverState.inputFocus;
      // 使用微信输入框
      if (this.gameOverState.inputFocus) {
        this.showNativeInput();
      } else {
        wx.hideKeyboard();
      }
      return;
    }

    // 提交按钮
    const submitY = 310;
    if (x >= centerX - btnWidth/2 && x <= centerX + btnWidth/2 && y >= submitY && y <= submitY + btnHeight) {
      this.submitScore();
      return;
    }

    // 查看排行按钮
    const rankY = 380;
    if (x >= centerX - btnWidth/2 && x <= centerX + btnWidth/2 && y >= rankY && y <= rankY + btnHeight) {
      this.openRanklist();
      return;
    }

    // 重新开始按钮
    const retryY = 450;
    if (x >= centerX - btnWidth/2 && x <= centerX + btnWidth/2 && y >= retryY && y <= retryY + btnHeight) {
      this.init();
      return;
    }
  }

  showNativeInput() {
    wx.showModal({
      title: '输入昵称',
      editable: true,
      placeholderText: '请输入昵称（最多6个字符）',
      content: this.gameOverState.nickname || '',
      success: (res) => {
        if (res.confirm && res.content) {
          this.gameOverState.nickname = res.content.trim().substring(0, 6);
        }
        this.gameOverState.inputFocus = false;
      }
    });
  }

  async submitScore() {
    const nickname = this.gameOverState.nickname.trim();
    if (!nickname) {
      wx.showToast({
        title: '请输入昵称',
        icon: 'none'
      });
      return;
    }

    this.gameOverState.submitting = true;

    try {
      // 【请修改为你的服务器IP或域名】
      const API_BASE = 'http://YOUR_SERVER_IP:3000';
      const response = await fetch(`${API_BASE}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: nickname,
          score: this.gameOverState.score
        })
      });

      const result = await response.json();

      if (result.success) {
        wx.showToast({
          title: '提交成功',
          icon: 'success'
        });
      } else {
        throw new Error(result.error || '提交失败');
      }
    } catch (e) {
      console.error('提交分数失败:', e);
      wx.showToast({
        title: '提交失败，请检查网络',
        icon: 'none'
      });
    } finally {
      this.gameOverState.submitting = false;
    }
  }

  openRanklist() {
    wx.navigateTo({
      url: '/pages/ranklist/ranklist'
    }).catch(() => {
      wx.showToast({
        title: '未配置排行榜页面',
        icon: 'none'
      });
    });
  }

  renderGameOverUI() {
    if (!this.gameOverState) return;

    const centerX = canvas.width / 2;
    const inputs = this.gameOverState;

    // 半透明遮罩
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 标题
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('游戏结束', centerX, 120);

    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 24px Arial';
    ctx.fillText(`得分：${inputs.score}`, centerX, 170);

    // 输入框背景
    ctx.fillStyle = '#FFF';
    this.drawRoundRect(ctx, centerX - 150, 250, 300, 40, 8);
    ctx.fill();
    ctx.strokeStyle = inputs.inputFocus ? '#667eea' : '#CCC';
    ctx.lineWidth = 3;
    ctx.stroke();

    // 输入提示
    ctx.fillStyle = inputs.inputFocus ? '#333' : '#999';
    ctx.font = '20px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(inputs.nickname || '点击输入昵称', centerX - 140, 275);

    // 按钮通用
    const buttons = [
      { label: '提交分数', y: 310, color: '#4CAF50' },
      { label: '查看排行', y: 380, color: '#2196F3' },
      { label: '重新开始', y: 450, color: '#FF9800' }
    ];

    buttons.forEach(btn => {
      // 按钮背景
      ctx.fillStyle = btn.color;
      this.drawRoundRect(ctx, centerX - 100, btn.y, 200, 50, 10);
      ctx.fill();

      // 按钮文字
      ctx.fillStyle = '#FFF';
      ctx.font = 'bold 22px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(btn.label, centerX, btn.y + 32);
    });

    // 提交状态
    if (inputs.submitting) {
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#333';
      ctx.font = 'bold 28px Arial';
      ctx.fillText('提交中...', centerX, canvas.height / 2);
    }
  }

  render() {
    if (this.gameEnded && this.gameOverState) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      this.drawGrass();
      this.drawSlots();
      this.renderGameOverUI();
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#B5EAD7';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    this.drawGrass();

    ctx.fillStyle = '#333';
    ctx.font = 'bold 22px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('贵人连连看', canvas.width / 2, 50);

    const topTiles = this.getTopTiles();
    const sortedTiles = [...this.tiles].sort((a, b) => a.layer - b.layer);

    sortedTiles.forEach(tile => {
      const isTop = topTiles.includes(tile);
      tile.render(ctx, isTop);
    });

    this.drawSlots();

    ctx.fillStyle = '#FF5722';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`得分: ${this.score}`, canvas.width / 2, canvas.height - 175);

    this.slotTiles.forEach(tile => {
      tile.render(ctx, true);
    });
  }

  drawGrass() {
    ctx.fillStyle = '#7CB342';
    for (let i = 0; i < 20; i++) {
      const x = (i * 50 + 20) % canvas.width;
      const y = 100 + Math.sin(i) * 30;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 5, y - 15);
      ctx.lineTo(x + 5, y - 15);
      ctx.closePath();
      ctx.fill();
    }
  }

  drawSlots() {
    const slotWidth = 45;
    const slotHeight = 55;
    const slotPadding = 6;
    const startX = (canvas.width - (this.slotCount * slotWidth + (this.slotCount - 1) * slotPadding)) / 2;
    const slotY = canvas.height - 120;

    ctx.fillStyle = '#8B4513';
    ctx.fillRect(0, slotY - 15, canvas.width, 130);

    ctx.strokeStyle = '#5D3A1A';
    ctx.lineWidth = 4;
    ctx.strokeRect(5, slotY - 15, canvas.width - 10, 120);

    for (let i = 0; i < this.slotCount; i++) {
      const x = startX + i * (slotWidth + slotPadding);
      
      ctx.strokeStyle = '#A0856C';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      this.drawSlotRect(ctx, x, slotY, slotWidth, slotHeight, 6);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  drawSlotRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
  }

  update() {
    this.tiles.forEach(tile => tile.update());
    this.slotTiles.forEach(tile => tile.update());
  }

  loop() {
    this.update();
    this.render();
    this.aniId = requestAnimationFrame(this.loop.bind(this));
  }
}
