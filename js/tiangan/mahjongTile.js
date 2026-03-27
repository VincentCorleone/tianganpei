
export default class MahjongTile {
  constructor(type, value, x, y, layer, width = 45, height = 55) {
    this.type = type;
    this.value = value;
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.layer = layer;
    this.selected = false;
    this.destroyed = false;
    this.opacity = 1;
    this.moving = false;
    this.targetX = x;
    this.targetY = y;
  }

  isClicked(touchX, touchY, topTiles) {
    if (this.destroyed || this.moving) return false;

    const isTopTile = topTiles.includes(this);
    if (!isTopTile) return false;

    return (
      touchX >= this.x - 3 &&
      touchX <= this.x + this.width + 3 &&
      touchY >= this.y - 3 &&
      touchY <= this.y + this.height + 3
    );
  }

  render(ctx, isTop) {
    if (this.destroyed) return;

    ctx.globalAlpha = this.opacity;

    const shadowOffset = isTop ? 3 : 2;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    this.drawRoundRect(ctx, this.x + shadowOffset, this.y + shadowOffset, this.width, this.height, 6);
    ctx.fill();

    ctx.fillStyle = this.selected ? '#FFE87C' : '#FFF8DC';
    this.drawRoundRect(ctx, this.x, this.y, this.width, this.height, 6);
    ctx.fill();

    ctx.strokeStyle = isTop ? '#8B7355' : '#A0926C';
    ctx.lineWidth = isTop ? 3 : 2;
    this.drawRoundRect(ctx, this.x, this.y, this.width, this.height, 6);
    ctx.stroke();

    ctx.fillStyle = this.type === 'relation' ? '#C41E3A' : '#333';
    
    if (this.type === 'relation') {
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.value, this.x + this.width / 2, this.y + this.height / 2);
    } else {
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.value, this.x + this.width / 2, this.y + this.height / 2);
    }

    ctx.globalAlpha = 1;
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
    if (this.moving) {
      const dx = this.targetX - this.x;
      const dy = this.targetY - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < 2) {
        this.x = this.targetX;
        this.y = this.targetY;
        this.moving = false;
      } else {
        this.x += dx * 0.2;
        this.y += dy * 0.2;
      }
    }
  }

  moveTo(x, y) {
    this.targetX = x;
    this.targetY = y;
    this.moving = true;
  }

  destroy() {
    this.destroyed = true;
  }
}
