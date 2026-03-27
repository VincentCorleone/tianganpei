
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
    this.init();
    this.bindEvents();
    this.loop();
  }

  init() {
    this.tiles = [];
    this.slotTiles = [];
    this.score = 0;
    this.generateTiles();
  }

  generateTiles() {
    const tileSet = [];
    
    for (let i = 0; i < 3; i++) {
      TIANGAN.forEach(tiangan => {
        tileSet.push({ type: 'tiangan', value: tiangan });
      });
      RELATIONS.forEach(relation => {
        tileSet.push({ type: 'relation', value: relation });
      });
    }

    this.shuffleArray(tileSet);
    
    const selectedTiles = tileSet.slice(0, 60);
    
    this.createMultiLayerTiles(selectedTiles);
  }

  createMultiLayerTiles(tileData) {
    const centerX = canvas.width / 2;
    const centerY = 220;
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
    if (this.slotTiles.length >= this.slotCount) return;

    const topTiles = this.getTopTiles();
    
    for (const tile of this.tiles) {
      if (tile.isClicked(x, y, topTiles)) {
        this.moveTileToSlot(tile);
        break;
      }
    }
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
    }, 300);
  }

  checkAndEliminate() {
    const valueCount = {};
    
    this.slotTiles.forEach(tile => {
      if (!tile.destroyed) {
        const key = `${tile.type}-${tile.value}`;
        valueCount[key] = (valueCount[key] || 0) + 1;
      }
    });

    for (const key in valueCount) {
      if (valueCount[key] >= 3) {
        const [type, value] = key.split('-');
        let eliminated = 0;
        
        this.slotTiles.forEach(tile => {
          if (!tile.destroyed && tile.type === type && tile.value === value && eliminated < 3) {
            tile.destroy();
            eliminated++;
            this.score += 10;
          }
        });
        
        break;
      }
    }

    this.rearrangeSlots();
    this.checkGameState();
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
    const remainingActive = this.tiles.filter(t => !t.destroyed).length + 
                            this.slotTiles.filter(t => !t.destroyed).length;

    if (remainingActive === 0) {
      wx.showModal({
        title: '恭喜通关',
        content: `得分: ${this.score}`,
        showCancel: false,
        success: () => {
          this.init();
        }
      });
    } else if (this.slotTiles.filter(t => !t.destroyed).length >= this.slotCount) {
      wx.showModal({
        title: '游戏结束',
        content: `槽位已满！得分: ${this.score}`,
        showCancel: false,
        success: () => {
          this.init();
        }
      });
    }
  }

  render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#B5EAD7';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    this.drawGrass();

    ctx.fillStyle = '#333';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('天干配对消消乐', canvas.width / 2, 40);

    ctx.font = '18px Arial';
    ctx.fillText(`得分: ${this.score}`, canvas.width / 2, 70);

    this.drawSlots();

    const topTiles = this.getTopTiles();
    const sortedTiles = [...this.tiles].sort((a, b) => a.layer - b.layer);
    
    sortedTiles.forEach(tile => {
      const isTop = topTiles.includes(tile);
      tile.render(ctx, isTop);
    });

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
