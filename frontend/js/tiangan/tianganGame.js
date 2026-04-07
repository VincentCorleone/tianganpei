
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
    this.showRanklistDuringGame = false;
    this.showRulesDuringGame = false;
    this.ranklistData = [];
    this.ranklistLoading = false;
    this.ranklistError = null;
    this.ranklistScrollY = 0;
    this.lastTouchY = 0;
    this.isDragging = false;
    
    // 死局检测和救局系统
    this.deadlockState = null; // null: 无死局, 'waiting': 等待换牌, 'selecting': 选择选项
    this.rescueChances = 3; // 换牌机会
    this.selectedTileForRescue = null; // 被选中要换的卡牌
    this.rescueOptions = []; // 换牌选项
    this.correctOption = null; // 正确选项
    
    // 设置微信小游戏转发
    this.setupShare();
    
    this.init();
    this.bindEvents();
    this.loop();
  }

  setupShare() {
    // 设置右上角转发菜单
    if (wx.onShareAppMessage) {
      wx.onShareAppMessage(() => {
        let title = '贵人连连看 - 来和我一起PK吧！';
        if (this.score > 0) {
          title = `我在贵人连连看得了${this.score}分！来和我PK吧！`;
        }
        return {
          title: title,
          imageUrl: '',
          query: ''
        };
      });
    }
  }

  init() {
    this.tiles = [];
    this.slotTiles = [];
    this.score = 0;
    this.gameEnded = false;
    this.showRanklistDuringGame = false;
    this.showRulesDuringGame = false;
    this.ranklistData = [];
    this.ranklistLoading = false;
    this.ranklistError = null;
    this.ranklistScrollY = 0;
    this.lastTouchY = 0;
    this.isDragging = false;
    
    // 重置救局系统
    this.deadlockState = null;
    this.rescueChances = 3;
    this.selectedTileForRescue = null;
    this.rescueOptions = [];
    this.correctOption = null;
    
    this.generateTiles();
  }

  generateTiles() {
    const tileSet = [];
    
    // 生成完整的匹配组（每个组包含2个天干+1个关系，可以完全消除）
    // 确保卡牌数量设为84张（28个匹配组 × 3张/组）
    
    const matchGroups = [];
    
    // 生成匹配组
    for (let i = 0; i < 28; i++) {
      const t1 = TIANGAN[Math.floor(Math.random() * TIANGAN.length)];
      const rel = RELATIONS[Math.floor(Math.random() * RELATIONS.length)];
      let t2 = TianganRelations[t1][rel];
      
      // 确保t2存在
      if (!t2) {
        const validRel = Object.keys(TianganRelations[t1])[0];
        t2 = TianganRelations[t1][validRel];
        matchGroups.push({ t1, t2, rel: validRel });
      } else {
        matchGroups.push({ t1, t2, rel });
      }
    }
    
    // 将匹配组转化为卡牌
    matchGroups.forEach(group => {
      tileSet.push({ type: 'tiangan', value: group.t1 });
      tileSet.push({ type: 'tiangan', value: group.t2 });
      tileSet.push({ type: 'relation', value: group.rel });
    });

    this.shuffleArray(tileSet);
    
    this.createMultiLayerTiles(tileSet);
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
      this.lastTouchY = touch.clientY;
      this.isDragging = false;
      this.handleTouch(touch.clientX, touch.clientY);
    });

    wx.onTouchMove((res) => {
      const touch = res.touches[0];
      if (this.showRanklistDuringGame || (this.gameEnded && this.gameOverState && this.gameOverState.showRanklist)) {
        const deltaY = touch.clientY - this.lastTouchY;
        this.ranklistScrollY -= deltaY; // 反转滚动方向
        this.lastTouchY = touch.clientY;
        this.isDragging = true;
      }
    });

    wx.onTouchEnd(() => {
      this.isDragging = false;
    });
  }

  handleTouch(x, y) {
    // 如果正在拖动，不处理点击
    if (this.isDragging) return;
    
    const centerX = canvas.width / 2;
    
    // 处理死局救局系统点击
    if (this.deadlockState) {
      this.handleDeadlockTouch(x, y);
      return;
    }
    
    // 如果游戏中正在显示排行榜
    if (this.showRanklistDuringGame) {
      // 返回按钮
      const backY = canvas.height - 150;
      const btnWidth = 120;
      const btnHeight = 40;
      if (x >= centerX - btnWidth/2 && x <= centerX + btnWidth/2 && y >= backY && y <= backY + btnHeight) {
        this.showRanklistDuringGame = false;
        return;
      }
      // 分享按钮
      const shareY = canvas.height - 90;
      if (x >= centerX - btnWidth/2 && x <= centerX + btnWidth/2 && y >= shareY && y <= shareY + btnHeight) {
        this.shareGame();
        return;
      }
      return;
    }
    
    // 如果游戏中正在显示规则
    if (this.showRulesDuringGame) {
      // 返回按钮
      const backY = canvas.height - 90;
      const btnWidth = 120;
      const btnHeight = 40;
      if (x >= centerX - btnWidth/2 && x <= centerX + btnWidth/2 && y >= backY && y <= backY + btnHeight) {
        this.showRulesDuringGame = false;
        return;
      }
      return;
    }
    
    // 三个按钮的检测（并排）
    const btnY = canvas.height - 190;
    const btnWidth = 80;
    const btnHeight = 35;
    const btnSpacing = 10;
    const totalWidth = btnWidth * 3 + btnSpacing * 2;
    const startX = (canvas.width - totalWidth) / 2;
    
    // 1. 养羊么按钮
    const sheepBtnX = startX + btnWidth / 2;
    if (!this.showRanklistDuringGame && !this.showRulesDuringGame && !this.gameEnded && 
        x >= sheepBtnX - btnWidth/2 && x <= sheepBtnX + btnWidth/2 && 
        y >= btnY - btnHeight/2 && y <= btnY + btnHeight/2) {
      this.navigateToSheepGame();
      return;
    }
    
    // 2. 游戏规则按钮
    const rulesBtnX = startX + btnWidth + btnSpacing + btnWidth / 2;
    if (!this.showRanklistDuringGame && !this.showRulesDuringGame && !this.gameEnded && 
        x >= rulesBtnX - btnWidth/2 && x <= rulesBtnX + btnWidth/2 && 
        y >= btnY - btnHeight/2 && y <= btnY + btnHeight/2) {
      this.showRulesDuringGame = true;
      this.ranklistScrollY = 0;
      return;
    }
    
    // 3. 排行榜按钮
    const rankBtnX = startX + btnWidth * 2 + btnSpacing * 2 + btnWidth / 2;
    if (!this.showRanklistDuringGame && !this.showRulesDuringGame && !this.gameEnded && 
        x >= rankBtnX - btnWidth/2 && x <= rankBtnX + btnWidth/2 && 
        y >= btnY - btnHeight/2 && y <= btnY + btnHeight/2) {
      this.openRanklistDuringGame();
      return;
    }

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
    if (tiles.length !== 3) {
      return false;
    }

    const t1 = tiles[0];
    const rel = tiles[1];
    const t2 = tiles[2];

    if (t1.type !== 'tiangan' || rel.type !== 'relation' || t2.type !== 'tiangan') {
      return false;
    }

    return (
      TianganRelations[t1.value] && TianganRelations[t1.value][rel.value] === t2.value
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

    // 检查是否死局
    const remainingOnField = this.tiles.filter(t => !t.destroyed).length;
    const remainingInSlot = this.slotTiles.filter(t => !t.destroyed).length;
    
    if (remainingOnField === 0 && remainingInSlot > 0 && remainingInSlot <= 6) {
      const activeSlotTiles = this.slotTiles.filter(t => !t.destroyed);
      if (!this.canEliminateAny(activeSlotTiles)) {
        // 检测到死局
        if (this.rescueChances > 0) {
          this.startDeadlockRescue();
          return;
        } else {
          // 换牌机会用完，游戏结束
          this.gameEnded = true;
          this.showGameOverUI();
          return;
        }
      }
    }

    if (remainingActive === 0 || remainingInSlot >= this.slotCount) {
      this.gameEnded = true;
      this.showGameOverUI();
    }
  }

  canEliminateAny(tiles) {
    if (tiles.length < 3) return false;
    
    for (let i = 0; i <= tiles.length - 3; i++) {
      const triplet = tiles.slice(i, i + 3);
      if (this.isValidMatch(triplet)) {
        return true;
      }
    }
    return false;
  }

  startDeadlockRescue() {
    this.deadlockState = 'waiting';
    this.calculateMinRescueSteps();
  }

  calculateMinRescueSteps() {
    const activeSlotTiles = this.slotTiles.filter(t => !t.destroyed);
    const allTiles = this.tiles.filter(t => !t.destroyed).concat(activeSlotTiles);
    
    let minSteps = Infinity;
    let bestTileIndex = -1;
    
    for (let i = 0; i < activeSlotTiles.length; i++) {
      const steps = this.calculateStepsForTile(i, activeSlotTiles);
      if (steps < minSteps) {
        minSteps = steps;
        bestTileIndex = i;
      }
    }
    
    if (bestTileIndex >= 0) {
      this.selectedTileForRescue = activeSlotTiles[bestTileIndex];
    }
  }

  calculateStepsForTile(tileIndex, slotTiles) {
    const tile = slotTiles[tileIndex];
    let steps = 0;
    
    const otherTiles = slotTiles.filter((_, i) => i !== tileIndex);
    
    for (let i = 0; i <= otherTiles.length - 2; i++) {
      const testTiles = [...otherTiles.slice(0, i), tile, ...otherTiles.slice(i)];
      if (this.canEliminateAny(testTiles)) {
        steps = Math.abs(i - tileIndex);
        break;
      }
    }
    
    return steps === 0 ? 1 : steps;
  }

  handleDeadlockTouch(x, y) {
    const centerX = canvas.width / 2;
    
    if (this.deadlockState === 'waiting') {
      this.handleWaitingTouch(x, y);
    } else if (this.deadlockState === 'selecting') {
      this.handleSelectingTouch(x, y);
    }
  }

  handleWaitingTouch(x, y) {
    const activeSlotTiles = this.slotTiles.filter(t => !t.destroyed);
    
    for (let i = 0; i < activeSlotTiles.length; i++) {
      const tile = activeSlotTiles[i];
      if (this.isSlotTileClicked(tile, x, y)) {
        this.selectedTileForRescue = tile;
        this.generateRescueOptions();
        this.deadlockState = 'selecting';
        return;
      }
    }
  }

  handleSelectingTouch(x, y) {
    const centerX = canvas.width / 2;
    const btnWidth = 140;
    const btnHeight = 60;
    const btnSpacing = 15;
    const startX = centerX - (btnWidth * 1.5 + btnSpacing);
    
    for (let i = 0; i < this.rescueOptions.length; i++) {
      const btnX = startX + i * (btnWidth + btnSpacing);
      const btnY = 400;
      
      if (x >= btnX - btnWidth/2 && x <= btnX + btnWidth/2 && y >= btnY - btnHeight/2 && y <= btnY + btnHeight/2) {
        this.handleOptionSelect(i);
        return;
      }
    }
  }

  generateRescueOptions() {
    const activeSlotTiles = this.slotTiles.filter(t => !t.destroyed);
    const currentIndex = activeSlotTiles.indexOf(this.selectedTileForRescue);
    
    this.rescueOptions = [];
    this.correctOption = -1;
    
    const otherTiles = activeSlotTiles.filter((_, i) => i !== currentIndex);
    
    let correctTargetIndex = -1;
    for (let targetIndex = 0; targetIndex <= otherTiles.length; targetIndex++) {
      const testTiles = [...otherTiles.slice(0, targetIndex), this.selectedTileForRescue, ...otherTiles.slice(targetIndex)];
      if (this.canEliminateAny(testTiles) && targetIndex !== currentIndex) {
        correctTargetIndex = targetIndex;
        break;
      }
    }
    
    if (correctTargetIndex >= 0) {
      this.rescueOptions.push({
        type: 'position',
        index: correctTargetIndex,
        label: this.getPositionLabel(correctTargetIndex, activeSlotTiles.length),
        correct: true
      });
    }
    
    const usedIndices = new Set([currentIndex]);
    if (correctTargetIndex >= 0) usedIndices.add(correctTargetIndex);
    
    while (this.rescueOptions.length < 3) {
      let wrongIndex;
      let attempts = 0;
      do {
        wrongIndex = Math.floor(Math.random() * activeSlotTiles.length);
        attempts++;
      } while ((usedIndices.has(wrongIndex) || this.rescueOptions.some(opt => opt.index === wrongIndex)) && attempts < 100);
      
      if (attempts < 100) {
        usedIndices.add(wrongIndex);
        this.rescueOptions.push({
          type: 'position',
          index: wrongIndex,
          label: this.getPositionLabel(wrongIndex, activeSlotTiles.length),
          correct: false
        });
      } else {
        break;
      }
    }
    
    this.shuffleArray(this.rescueOptions);
    this.correctOption = this.rescueOptions.findIndex(opt => opt.correct);
  }

  canRescueWithPosition(targetIndex) {
    const activeSlotTiles = this.slotTiles.filter(t => !t.destroyed);
    const currentIndex = activeSlotTiles.indexOf(this.selectedTileForRescue);
    const otherTiles = activeSlotTiles.filter((_, i) => i !== currentIndex);
    const testTiles = [...otherTiles.slice(0, targetIndex), this.selectedTileForRescue, ...otherTiles.slice(targetIndex)];
    return this.canEliminateAny(testTiles);
  }

  getPositionLabel(index, total) {
    const labels = ['最左边', '左边第2个', '左边第3个', '左边第4个', '左边第5个', '左边第6个', '最右边'];
    if (index === 0) return '最左边';
    if (index === total - 1) return '最右边';
    return labels[index] || `第${index + 1}个位置`;
  }

  handleOptionSelect(optionIndex) {
    const option = this.rescueOptions[optionIndex];
    
    if (optionIndex === this.correctOption) {
      this.performRescue(option.index);
      wx.showToast({
        title: '换牌成功！',
        icon: 'success'
      });
    } else {
      this.rescueChances--;
      if (this.rescueChances > 0) {
        wx.showToast({
          title: `选错了，还有${this.rescueChances}次机会`,
          icon: 'none'
        });
        this.deadlockState = 'waiting';
      } else {
        this.deadlockState = null;
        this.gameEnded = true;
        this.showGameOverUI();
      }
    }
  }

  performRescue(targetIndex) {
    const activeSlotTiles = this.slotTiles.filter(t => !t.destroyed);
    const currentIndex = activeSlotTiles.indexOf(this.selectedTileForRescue);
    
    const tile = activeSlotTiles.splice(currentIndex, 1)[0];
    activeSlotTiles.splice(targetIndex, 0, tile);
    
    this.slotTiles = activeSlotTiles;
    
    this.rearrangeSlots();
    
    setTimeout(() => {
      this.checkAndEliminate();
      this.rearrangeSlots();
      
      this.deadlockState = null;
      this.selectedTileForRescue = null;
      this.rescueOptions = [];
      this.correctOption = null;
      
      this.checkGameState();
    }, 500);
  }

  showGameOverUI() {
    this.gameOverState = {
      score: this.score,
      nickname: '',
      inputFocus: false,
      submitting: false,
      showRanklist: false,
      ranklistData: [],
      ranklistLoading: false,
      ranklistError: null
    };
    this.ranklistScrollY = 0;
  }

  handleGameOverTouch(x, y) {
    // 如果正在拖动，不处理点击
    if (this.isDragging) return;
    
    if (!this.gameOverState || this.gameOverState.submitting) return;

    const btnWidth = 200;
    const btnHeight = 50;
    const centerX = canvas.width / 2;

    // 如果正在显示排行榜
    if (this.gameOverState.showRanklist) {
      // 返回按钮
      const backY = canvas.height - 150;
      const btnWidth = 180;
      const btnHeight = 45;
      if (x >= centerX - btnWidth/2 && x <= centerX + btnWidth/2 && y >= backY && y <= backY + btnHeight) {
        this.gameOverState.showRanklist = false;
        return;
      }
      // 分享按钮
      const shareY = canvas.height - 90;
      if (x >= centerX - btnWidth/2 && x <= centerX + btnWidth/2 && y >= shareY && y <= shareY + btnHeight) {
        this.shareGame();
        return;
      }
      return;
    }

    // 输入框区域
    const inputY = 210;
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
    const submitY = 270;
    if (x >= centerX - btnWidth/2 && x <= centerX + btnWidth/2 && y >= submitY && y <= submitY + btnHeight) {
      this.submitScore();
      return;
    }

    // 查看排行按钮
    const rankY = 340;
    if (x >= centerX - btnWidth/2 && x <= centerX + btnWidth/2 && y >= rankY && y <= rankY + btnHeight) {
      this.openRanklist();
      return;
    }

    // 重新开始按钮
    const retryY = 410;
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

  submitScore() {
    const nickname = this.gameOverState.nickname.trim();
    if (!nickname) {
      wx.showToast({
        title: '请输入昵称',
        icon: 'none'
      });
      return;
    }

    this.gameOverState.submitting = true;

    const API_BASE = 'https://guiren.interstellar.fan';
    wx.request({
      url: `${API_BASE}/api/score`,
      method: 'POST',
      data: {
        nickname: nickname,
        score: this.gameOverState.score
      },
      header: {
        'Content-Type': 'application/json'
      },
      success: (res) => {
        if (res.data && res.data.success) {
          wx.showToast({
            title: '提交成功',
            icon: 'success'
          });
        } else {
          throw new Error(res.data.error || '提交失败');
        }
      },
      fail: (e) => {
        console.error('提交分数失败:', e);
        wx.showToast({
          title: '提交失败，请检查网络',
          icon: 'none'
        });
      },
      complete: () => {
        this.gameOverState.submitting = false;
      }
    });
  }

  openRanklist() {
    this.gameOverState.showRanklist = true;
    this.gameOverState.ranklistLoading = true;
    this.gameOverState.ranklistError = null;

    const API_BASE = 'https://guiren.interstellar.fan';
    wx.request({
      url: `${API_BASE}/api/leaderboard`,
      method: 'GET',
      success: (res) => {
        if (res.data && res.data.success) {
          this.gameOverState.ranklistData = res.data.data;
        } else {
          throw new Error(res.data.error || '加载失败');
        }
      },
      fail: (e) => {
        console.error('加载排行榜失败:', e);
        this.gameOverState.ranklistError = e.errMsg || '加载失败';
      },
      complete: () => {
        this.gameOverState.ranklistLoading = false;
      }
    });
  }

  renderGameOverUI() {
    if (!this.gameOverState) return;

    const centerX = canvas.width / 2;
    const inputs = this.gameOverState;

    // 半透明遮罩
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 如果正在显示排行榜
    if (inputs.showRanklist) {
      this.renderRanklist();
      return;
    }

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
    this.drawRoundRect(ctx, centerX - 150, 210, 300, 40, 8);
    ctx.fill();
    ctx.strokeStyle = inputs.inputFocus ? '#667eea' : '#CCC';
    ctx.lineWidth = 3;
    ctx.stroke();

    // 输入提示
    ctx.fillStyle = inputs.inputFocus ? '#333' : '#999';
    ctx.font = '20px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(inputs.nickname || '点击输入昵称', centerX - 140, 235);

    // 按钮通用
    const buttons = [
      { label: '提交分数', y: 270, color: '#4CAF50' },
      { label: '查看排行', y: 340, color: '#2196F3' },
      { label: '重新开始', y: 410, color: '#FF9800' }
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

  renderRanklist() {
    const centerX = canvas.width / 2;
    const inputs = this.gameOverState;

    // 限制滚动范围
    const maxScroll = Math.max(0, (inputs.ranklistData.length - 6) * 35);
    this.ranklistScrollY = Math.max(0, Math.min(this.ranklistScrollY, maxScroll));

    // 排行榜标题
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🏆 排行榜', centerX, 50);

    // 加载状态
    if (inputs.ranklistLoading) {
      ctx.fillStyle = '#FFF';
      ctx.font = '20px Arial';
      ctx.fillText('加载中...', centerX, canvas.height / 2);
      this.renderRanklistButtons();
      return;
    }

    // 错误状态
    if (inputs.ranklistError) {
      ctx.fillStyle = '#FF5722';
      ctx.font = '18px Arial';
      ctx.fillText('加载失败: ' + inputs.ranklistError, centerX, canvas.height / 2);
      this.renderRanklistButtons();
      return;
    }

    // 排行榜数据
    const data = inputs.ranklistData;
    if (data.length === 0) {
      ctx.fillStyle = '#999';
      ctx.font = '18px Arial';
      ctx.fillText('暂无排行数据', centerX, canvas.height / 2);
      this.renderRanklistButtons();
      return;
    }

    // 绘制排行榜表格
    const startY = 70;
    const rowHeight = 35;

    // 表头
    ctx.fillStyle = '#667eea';
    this.drawRoundRect(ctx, centerX - 140, startY, 280, rowHeight, 8);
    ctx.fill();

    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('排名', centerX - 95, startY + 22);
    ctx.fillText('昵称', centerX, startY + 22);
    ctx.fillText('分数', centerX + 95, startY + 22);

    // 数据行（使用滚动偏移）
    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      const y = startY + rowHeight + i * rowHeight - this.ranklistScrollY;
      
      // 只绘制可见的行
      if (y < startY + rowHeight - 50 || y > canvas.height - 200) continue;
      
      // 行背景
      ctx.fillStyle = i % 2 === 0 ? '#f9f9f9' : '#fff';
      this.drawRoundRect(ctx, centerX - 140, y, 280, rowHeight, 4);
      ctx.fill();

      // 排名颜色
      let rankColor = '#333';
      if (item.rank === 1) rankColor = '#FFD700';
      else if (item.rank === 2) rankColor = '#C0C0C0';
      else if (item.rank === 3) rankColor = '#CD7F32';

      ctx.fillStyle = rankColor;
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(item.rank, centerX - 95, y + 22);

      ctx.fillStyle = '#333';
      ctx.font = '13px Arial';
      ctx.fillText(item.nickname, centerX, y + 22);
      ctx.fillText(item.score, centerX + 95, y + 22);
    }

    this.renderRanklistButtons();
  }

  renderRanklistButtons() {
    const centerX = canvas.width / 2;
    const btnWidth = 180;
    const btnHeight = 45;
    
    // 返回按钮
    const backY = canvas.height - 150;
    ctx.fillStyle = '#2196F3';
    this.drawRoundRect(ctx, centerX - btnWidth/2, backY, btnWidth, btnHeight, 10);
    ctx.fill();

    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('← 返回', centerX, backY + 28);
    
    // 分享按钮
    const shareY = canvas.height - 90;
    ctx.fillStyle = '#4CAF50';
    this.drawRoundRect(ctx, centerX - btnWidth/2, shareY, btnWidth, btnHeight, 10);
    ctx.fill();

    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 20px Arial';
    ctx.fillText('🎁 分享PK', centerX, shareY + 28);
  }

  shareGame() {
    // 微信小游戏分享功能
    if (wx.shareAppMessage) {
      let title = '贵人连连看 - 来和我一起PK吧！';
      let shareScore = this.score;
      
      // 如果游戏结束了，使用结束时的分数
      if (this.gameOverState && this.gameOverState.score) {
        shareScore = this.gameOverState.score;
      }
      
      if (shareScore > 0) {
        title = `我在贵人连连看得了${shareScore}分！来和我PK吧！`;
      }
      
      wx.shareAppMessage({
        title: title,
        imageUrl: '',
        query: '',
        success: function() {
          wx.showToast({
            title: '分享成功！',
            icon: 'success'
          });
        },
        fail: function(e) {
          console.error('分享失败:', e);
          // 如果是违规限制，给出友好提示
          if (e.errMsg && e.errMsg.includes('违规')) {
            wx.showToast({
              title: '分享功能暂不可用',
              icon: 'none',
              duration: 2000
            });
          } else {
            wx.showToast({
              title: '分享失败',
              icon: 'none'
            });
          }
        }
      });
    } else {
      wx.showToast({
        title: '分享功能暂不可用',
        icon: 'none'
      });
    }
  }

  navigateToSheepGame() {
    // 跳转到"养羊么"小程序
    const SHEEP_GAME_APP_ID = 'wxf88ee8df124faf5f';
    
    if (wx.navigateToMiniProgram) {
      wx.navigateToMiniProgram({
        appId: SHEEP_GAME_APP_ID,
        path: '',
        envVersion: 'release',
        success: function() {
          console.log('跳转成功');
        },
        fail: function(e) {
          console.error('跳转失败:', e);
          wx.showToast({
            title: '跳转失败',
            icon: 'none'
          });
        }
      });
    } else {
      wx.showToast({
        title: '功能暂不可用',
        icon: 'none'
      });
    }
  }

  openRanklistDuringGame() {
    this.showRanklistDuringGame = true;
    this.ranklistLoading = true;
    this.ranklistError = null;
    this.ranklistScrollY = 0;
    
    const API_BASE = 'https://guiren.interstellar.fan';
    wx.request({
      url: API_BASE + '/api/leaderboard',
      method: 'GET',
      header: { 'content-type': 'application/json' },
      success: (res) => {
        if (res.data && res.data.success) {
          this.ranklistData = res.data.data || [];
        } else {
          this.ranklistError = '获取排行榜失败';
        }
      },
      fail: (err) => {
        this.ranklistError = '网络请求失败';
        console.error('加载排行榜失败:', err);
      },
      complete: () => {
        this.ranklistLoading = false;
      }
    });
  }

  renderRanklistDuringGame() {
    const centerX = canvas.width / 2;
    
    // 限制滚动范围
    const maxScroll = Math.max(0, (this.ranklistData.length - 6) * 35);
    this.ranklistScrollY = Math.max(0, Math.min(this.ranklistScrollY, maxScroll));
    
    // 半透明遮罩
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 标题
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('排行榜', centerX, 50);
    
    // 加载状态
    if (this.ranklistLoading) {
      ctx.fillStyle = '#FFF';
      ctx.font = '24px Arial';
      ctx.fillText('加载中...', centerX, canvas.height / 2);
      this.renderRanklistDuringGameButtons();
      return;
    }
    
    // 错误状态
    if (this.ranklistError) {
      ctx.fillStyle = '#FF6B6B';
      ctx.font = '20px Arial';
      ctx.fillText(this.ranklistError, centerX, canvas.height / 2);
      this.renderRanklistDuringGameButtons();
      return;
    }
    
    // 显示排行榜表格
    const startY = 70;
    const rowHeight = 35;
    
    // 表头
    ctx.fillStyle = '#667eea';
    ctx.fillRect(30, startY, canvas.width - 60, rowHeight);
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('排名', 40, startY + 23);
    ctx.textAlign = 'center';
    ctx.fillText('昵称', centerX, startY + 23);
    ctx.textAlign = 'right';
    ctx.fillText('分数', canvas.width - 40, startY + 23);
    
    // 数据行（使用滚动偏移）
    for (let i = 0; i < this.ranklistData.length; i++) {
      const item = this.ranklistData[i];
      const y = startY + rowHeight + i * rowHeight - this.ranklistScrollY;
      
      // 只绘制可见的行
      if (y < startY + rowHeight - 50 || y > canvas.height - 180) continue;
      
      // 行背景
      ctx.fillStyle = i % 2 === 0 ? '#F5F5F5' : '#E8E8E8';
      ctx.fillRect(30, y, canvas.width - 60, rowHeight);
      
      // 排名
      let rankColor = '#333';
      if (i === 0) rankColor = '#FFD700'; // 金牌
      else if (i === 1) rankColor = '#C0C0C0'; // 银牌
      else if (i === 2) rankColor = '#CD7F32'; // 铜牌
      
      ctx.fillStyle = rankColor;
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(`#${i + 1}`, 40, y + 23);
      
      // 昵称
      ctx.fillStyle = '#333';
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(item.nickname, centerX, y + 23);
      
      // 分数
      ctx.fillStyle = '#FF5722';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'right';
      ctx.fillText(String(item.score), canvas.width - 40, y + 23);
    }
    
    // 返回按钮和分享按钮
    this.renderRanklistDuringGameButtons();
  }

  renderRanklistDuringGameButtons() {
    const centerX = canvas.width / 2;
    const btnWidth = 120;
    const btnHeight = 40;
    
    // 返回按钮
    const backY = canvas.height - 150;
    ctx.fillStyle = '#2196F3';
    this.drawRoundRect(ctx, centerX - btnWidth/2, backY, btnWidth, btnHeight, 10);
    ctx.fill();

    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('← 返回', centerX, backY + 26);
    
    // 分享按钮
    const shareY = canvas.height - 90;
    ctx.fillStyle = '#4CAF50';
    this.drawRoundRect(ctx, centerX - btnWidth/2, shareY, btnWidth, btnHeight, 10);
    ctx.fill();

    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 18px Arial';
    ctx.fillText('🎁 分享PK', centerX, shareY + 26);
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

    // 三个按钮并排显示
    const btnY = canvas.height - 190;
    const btnWidth = 80;
    const btnHeight = 35;
    const btnSpacing = 10;
    const totalWidth = btnWidth * 3 + btnSpacing * 2;
    const startX = (canvas.width - totalWidth) / 2;

    // 1. 养羊么按钮
    const sheepBtnX = startX + btnWidth / 2;
    ctx.fillStyle = '#4CAF50';
    this.drawRoundRect(ctx, sheepBtnX - btnWidth/2, btnY - btnHeight/2, btnWidth, btnHeight, 8);
    ctx.fill();

    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🐑 养羊么', sheepBtnX, btnY + 4);

    // 2. 游戏规则按钮
    const rulesBtnX = startX + btnWidth + btnSpacing + btnWidth / 2;
    ctx.fillStyle = '#9C27B0';
    this.drawRoundRect(ctx, rulesBtnX - btnWidth/2, btnY - btnHeight/2, btnWidth, btnHeight, 8);
    ctx.fill();

    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('规则', rulesBtnX, btnY + 4);

    // 3. 排行榜按钮
    const rankBtnX = startX + btnWidth * 2 + btnSpacing * 2 + btnWidth / 2;
    ctx.fillStyle = '#FF9800';
    this.drawRoundRect(ctx, rankBtnX - btnWidth/2, btnY - btnHeight/2, btnWidth, btnHeight, 8);
    ctx.fill();

    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('排行榜', rankBtnX, btnY + 4);

    ctx.fillStyle = '#FF5722';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`得分: ${this.score}`, canvas.width / 2, canvas.height - 155);

    this.slotTiles.forEach(tile => {
      const isHighlighted = this.deadlockState === 'waiting' && this.selectedTileForRescue === tile;
      if (isHighlighted) {
        ctx.save();
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur = 20;
      }
      tile.render(ctx, true);
      if (isHighlighted) {
        ctx.restore();
      }
    });

    // 如果游戏中正在显示排行榜
    if (this.showRanklistDuringGame) {
      this.renderRanklistDuringGame();
    }
    
    // 如果游戏中正在显示规则
    if (this.showRulesDuringGame) {
      this.renderRulesDuringGame();
    }
    
    // 如果正在死局救局状态
    if (this.deadlockState) {
      this.renderDeadlockRescue();
    }
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

  drawRoundRect(ctx, x, y, width, height, radius) {
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

  renderRulesDuringGame() {
    const centerX = canvas.width / 2;
    
    // 半透明遮罩
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 标题
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('游戏规则', centerX, 50);
    
    // 规则内容
    ctx.fillStyle = '#FFF';
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    
    const rules = [
      '1. 点击顶部未被覆盖的卡牌',
      '2. 卡牌会移动到底部卡槽中',
      '3. 按【天干1-关系-天干2】顺序集齐可消除得分',
      '4. 例如：甲-财神-己 可消除得分',
      '5. 消除一组得10分',
      '6. 卡槽满7张且未消除则游戏结束',
      '7. 遇到死局时有3次换牌机会',
      '8. 目标：消除所有卡牌，获得高分！'
    ];
    
    let startY = 90;
    const lineHeight = 32;
    
    rules.forEach((rule, index) => {
      ctx.fillText(rule, 30, startY + index * lineHeight);
    });
    
    // 关系说明
    ctx.fillStyle = '#9C27B0';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('天干关系说明', centerX, 380);
    
    ctx.fillStyle = '#FFF';
    ctx.font = '13px Arial';
    ctx.textAlign = 'left';
    
    const relations = [
      '福神：吉神，带来好运',
      '财神：财神，主财运',
      '贵神：贵人，得人相助',
      '冲：相冲，不利之兆',
      '被冲：被冲，被动不利'
    ];
    
    relations.forEach((rel, index) => {
      ctx.fillText(rel, 30, 410 + index * lineHeight);
    });
    
    // 返回按钮
    const backY = canvas.height - 90;
    const btnWidth = 120;
    const btnHeight = 40;
    ctx.fillStyle = '#2196F3';
    this.drawRoundRect(ctx, centerX - btnWidth/2, backY, btnWidth, btnHeight, 10);
    ctx.fill();

    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('← 返回', centerX, backY + 26);
  }

  renderDeadlockRescue() {
    const centerX = canvas.width / 2;
    
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    if (this.deadlockState === 'waiting') {
      this.renderWaitingState(centerX);
    } else if (this.deadlockState === 'selecting') {
      this.renderSelectingState(centerX);
    }
  }

  renderWaitingState(centerX) {
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('⚠️ 遇到死局了！', centerX, 80);
    
    ctx.fillStyle = '#FFF';
    ctx.font = '16px Arial';
    ctx.fillText(`剩余换牌机会：${this.rescueChances}次`, centerX, 120);
    
    ctx.font = '14px Arial';
    ctx.fillText('点击下方卡槽中的一张卡牌来尝试换牌', centerX, 150);
    
    if (this.selectedTileForRescue) {
      ctx.fillStyle = '#FFD700';
      ctx.font = '14px Arial';
      ctx.fillText('选中的卡牌会高亮显示', centerX, 180);
    }
  }

  renderSelectingState(centerX) {
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 22px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('选择要把这张牌换到哪个位置？', centerX, 100);
    
    ctx.fillStyle = '#FFF';
    ctx.font = '16px Arial';
    ctx.fillText(`剩余换牌机会：${this.rescueChances}次`, centerX, 140);
    
    const btnWidth = 140;
    const btnHeight = 60;
    const btnSpacing = 15;
    const startX = centerX - (btnWidth * 1.5 + btnSpacing);
    
    for (let i = 0; i < this.rescueOptions.length; i++) {
      const option = this.rescueOptions[i];
      const btnX = startX + i * (btnWidth + btnSpacing);
      const btnY = 400;
      
      ctx.fillStyle = option.correct ? '#4CAF50' : '#FF9800';
      this.drawRoundRect(ctx, btnX - btnWidth/2, btnY - btnHeight/2, btnWidth, btnHeight, 12);
      ctx.fill();
      
      ctx.strokeStyle = '#FFF';
      ctx.lineWidth = 3;
      ctx.stroke();
      
      ctx.fillStyle = '#FFF';
      ctx.font = 'bold 18px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(option.label, btnX, btnY + 6);
    }
  }

  loop() {
    this.update();
    this.render();
    this.aniId = requestAnimationFrame(this.loop.bind(this));
  }
}
