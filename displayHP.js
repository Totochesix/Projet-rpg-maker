/*:
 * @target MZ
 * @plugindesc Affiche la barre de vie des monstres 
 * @author Arnaut + Claude
 * @version 2.0.1
 * @description Affiche la barre de vie des monstres et évolue en fonction de l'état
 */

(() => {
  'use strict';
  
  // === CONFIGURATION ===
  const CONFIG = {
    BAR_WIDTH: 64,
    BAR_HEIGHT: 10,
    BAR_OFFSET_Y: -6,
    FONT_SIZE: 12,
    COLORS: {
      BACKGROUND: 'rgba(0, 0, 0, 0.7)',
      BORDER: '#333333',
      HP_HIGH: '#44ff44',    // > 60% HP
      HP_MEDIUM: '#ffaa00',  // 30-60% HP
      HP_LOW: '#ff4444',     // < 30% HP
      HP_CRITICAL: '#ff0000', // < 10% HP
      TEXT: '#ffffff'
    },
    SHOW_PERCENTAGE: false,  // Afficher le pourcentage au lieu des valeurs numériques
    HIDE_WHEN_FULL: false,  // Cacher la barre quand l'ennemi est à 100% HP
    ANIMATION_SPEED: 0.05    // Vitesse d'animation de la barre (0 = pas d'animation)
  };

  // === EXTENSION DE SPRITE_ENEMY ===
  const _Sprite_Enemy_update = Sprite_Enemy.prototype.update;
  Sprite_Enemy.prototype.update = function() {
    _Sprite_Enemy_update.call(this);
    this.updateHpBar();
  };

  const _Sprite_Enemy_setBattler = Sprite_Enemy.prototype.setBattler;
  Sprite_Enemy.prototype.setBattler = function(battler) {
    _Sprite_Enemy_setBattler.call(this, battler);
    this._lastHp = battler ? battler.hp : 0;
    this._animatedHpRate = 1;
  };

  Sprite_Enemy.prototype.updateHpBar = function() {
    if (!this._battler || !this._battler.isEnemy()) return;
    
    this.createHpBarIfNeeded();
    this.refreshHpBarDisplay();
  };

  Sprite_Enemy.prototype.createHpBarIfNeeded = function() {
    if (this._hpBarSprite) return;

    const totalHeight = CONFIG.BAR_HEIGHT + (CONFIG.SHOW_PERCENTAGE ? 16 : 20);
    const bitmap = new Bitmap(CONFIG.BAR_WIDTH + 4, totalHeight);
    const sprite = new Sprite(bitmap);
    
    sprite.anchor.set(0.5, 1);
    sprite.y = CONFIG.BAR_OFFSET_Y - this.height;
    
    this._hpBarSprite = sprite;
    this._animatedHpRate = 1;
    this.addChild(this._hpBarSprite);
  };

  Sprite_Enemy.prototype.refreshHpBarDisplay = function() {
    if (!this._battler.isAlive()) {
      this._hpBarSprite.visible = false;
      return;
    }

    const hp = this._battler.hp;
    const maxHp = this._battler.mhp;
    const currentRate = hp / maxHp;

    // Vérifier si on doit cacher la barre quand elle est pleine
    if (CONFIG.HIDE_WHEN_FULL && currentRate >= 1) {
      this._hpBarSprite.visible = false;
      return;
    }

    // Animation de la barre
    if (CONFIG.ANIMATION_SPEED > 0) {
      const diff = currentRate - this._animatedHpRate;
      if (Math.abs(diff) > 0.001) {
        this._animatedHpRate += diff * CONFIG.ANIMATION_SPEED;
      } else {
        this._animatedHpRate = currentRate;
      }
    } else {
      this._animatedHpRate = currentRate;
    }

    this.drawHpBar(hp, maxHp, this._animatedHpRate);
    this._hpBarSprite.visible = true;
  };

  Sprite_Enemy.prototype.drawHpBar = function(hp, maxHp, animatedRate) {
    const bitmap = this._hpBarSprite.bitmap;
    const currentRate = hp / maxHp;
    
    bitmap.clear();

    // === FOND ET BORDURE ===
    bitmap.fillAll(CONFIG.COLORS.BACKGROUND);
    bitmap.strokeRect(0, 0, CONFIG.BAR_WIDTH + 2, CONFIG.BAR_HEIGHT + 2, CONFIG.COLORS.BORDER);

    // === COULEUR DE LA BARRE SELON LE % DE HP ===
    let barColor;
    if (currentRate > 0.6) {
      barColor = CONFIG.COLORS.HP_HIGH;
    } else if (currentRate > 0.3) {
      barColor = CONFIG.COLORS.HP_MEDIUM;
    } else if (currentRate > 0.1) {
      barColor = CONFIG.COLORS.HP_LOW;
    } else {
      barColor = CONFIG.COLORS.HP_CRITICAL;
    }

    // === BARRE DE VIE ===
    const fillWidth = Math.floor(CONFIG.BAR_WIDTH * animatedRate);
    if (fillWidth > 0) {
      bitmap.fillRect(1, 1, fillWidth, CONFIG.BAR_HEIGHT, barColor);
    }

    // === TEXTE ===
    bitmap.fontSize = CONFIG.FONT_SIZE;
    bitmap.textColor = CONFIG.COLORS.TEXT;
    bitmap.outlineColor = 'rgba(0, 0, 0, 0.8)';
    bitmap.outlineWidth = 2;

    let text;
    if (CONFIG.SHOW_PERCENTAGE) {
      text = `${Math.floor(currentRate * 100)}%`;
    } else {
      text = `${hp} / ${maxHp}`;
    }

    const textY = CONFIG.BAR_HEIGHT + 2;
    bitmap.drawText(text, 0, textY, CONFIG.BAR_WIDTH + 2, 16, 'center');
  };

  // === NETTOYAGE À LA DESTRUCTION ===
  const _Sprite_Enemy_destroy = Sprite_Enemy.prototype.destroy;
  Sprite_Enemy.prototype.destroy = function(options) {
    if (this._hpBarSprite) {
      this._hpBarSprite.bitmap.destroy();
      this._hpBarSprite.destroy();
      this._hpBarSprite = null;
    }
    _Sprite_Enemy_destroy.call(this, options);
  };

})();