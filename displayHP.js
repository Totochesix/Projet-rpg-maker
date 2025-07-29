(() => {
  const BAR_WIDTH = 64;
  const BAR_HEIGHT = 10;

  const _Sprite_Enemy_update = Sprite_Enemy.prototype.update;
  Sprite_Enemy.prototype.update = function() {
    _Sprite_Enemy_update.call(this);
    this.updateHpBar();
  };

  Sprite_Enemy.prototype.updateHpBar = function() {
    if (!this._battler || !this._battler.isEnemy()) return;

    if (!this._hpBarSprite) {
      const bitmap = new Bitmap(BAR_WIDTH, BAR_HEIGHT + 12); // barre + texte
      const sprite = new Sprite(bitmap);
      sprite.anchor.set(0.5, 1);
      sprite.y = -this.height - 6; // Position au-dessus de l’ennemi
      this._hpBarSprite = sprite;
      this.addChild(this._hpBarSprite);
    }

    const hp = this._battler.hp;
    const maxHp = this._battler.mhp;
    const rate = hp / maxHp;

    const bar = this._hpBarSprite.bitmap;
    bar.clear();

    if (this._battler.isAlive()) {
      // --- Fond sombre ---
      bar.fillAll('rgba(0, 0, 0, 120)');

      // --- Barre rouge ---
      const fillW = Math.floor((BAR_WIDTH - 2) * rate);
      bar.fillRect(1, 1, fillW, BAR_HEIGHT - 2, '#ff4444');

      // --- Texte blanc centré ---
      bar.fontSize = 12;
      bar.textColor = '#ffffff';
      bar.drawText(`${hp} / ${maxHp}`, 0, BAR_HEIGHT - 2, BAR_WIDTH, 20, 'center');

      this._hpBarSprite.visible = true;
    } else {
      this._hpBarSprite.visible = false;
    }
  };
})();
