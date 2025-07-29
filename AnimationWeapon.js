class SlashSprite extends Sprite {
  constructor(startX, startY, dir) {
    super();
    this._duration = 0;
    this._dir = dir;

    // Angles de rotation pour le sweep d'épée (de -45° à +45°)
    switch (dir) {
      case 2: // bas
        this._startRot = Math.PI - Math.PI / 4;  // 180° + 45°
        this._endRot = Math.PI + Math.PI / 4;    // 180° - 45°
        break;
      case 8: // haut
        this._startRot = -Math.PI / 4;  // -45°
        this._endRot = Math.PI / 4;     // +45°
        break;
      case 6: // droite
        this._startRot = Math.PI / 2 - Math.PI / 4;  // 90° - 45° = 45°
        this._endRot = Math.PI / 2 + Math.PI / 4;    // 90° + 45° = 135°
        break;
      case 4: // gauche
        this._startRot = -Math.PI / 2 - Math.PI / 4; // -90° + 45° = -45°
        this._endRot = -Math.PI / 2 + Math.PI / 4;   // -90° - 45° = -135°
        break;
      default:
        this._startRot = 0;
        this._endRot = 0;
    }

    this._centerX = startX;
    this._centerY = startY;
    this._spriteReady = false;

    this.anchor.set(0.5, 0.5);
    this.scale.set(SLASH_SCALE, SLASH_SCALE);

    this.bitmap = ImageManager.loadBitmap('img/pictures/', SLASH_IMAGE, 0, true);
    this.bitmap.addLoadListener(() => {
      this._spriteReady = true;
      this.updatePosition(0);
    });
  }

  update() {
    super.update();
    this._duration++;
    const progress = this._duration / SLASH_DURATION;
    this.updatePosition(progress);
    if (this._duration >= SLASH_DURATION) {
      if (this.parent) this.parent.removeChild(this);
    }
    
  }

  updatePosition(progress) {
    // progression entre 0 et 1 
    const angleStart = -Math.PI / 4; // -45°
    const angleEnd = Math.PI / 4;    // +45°
    const angle = angleStart + (angleEnd - angleStart) * progress;
    // Calcul de la position selon la direction : balayage linéaire devant le joueur
    let dirOffset = 0;
    switch (this._dir) {
      case 8: // haut : balayage horizontal au dessus du perso
       // this.x = this._centerX - SLASH_RADIUS + 2 * SLASH_RADIUS * progress;
      //  this.y = this._centerY - 150; // légèrement au dessus
        dirOffset = -Math.PI / 2;
        break;
      case 2: // bas : balayage horizontal en dessous du perso
        //this.x = this._centerX - SLASH_RADIUS + 2 * SLASH_RADIUS * progress;
        //this.y = this._centerY + 20; // légèrement en dessous
        dirOffset = Math.PI / 2;
        break;
      case 6: // droite : balayage vertical à droite du perso
       // this.x = this._centerX + 40; // légèrement à droite
       // this.y = this._centerY - SLASH_RADIUS + 2 * SLASH_RADIUS * progress;
        dirOffset = 0;
        break;
      case 4: // gauche : balayage vertical à gauche du perso
      //  this.x = this._centerX - 40; // légèrement à gauche
       // this.y = this._centerY - SLASH_RADIUS + 2 * SLASH_RADIUS * progress;
        dirOffset = Math.PI;
        break;
      default:
        this.x = this._centerX;
        this.y = this._centerY;
    }
    const finalAngle = angle + dirOffset;
    const OFFSET_RADIUS = SLASH_RADIUS + 10;
    const dx = Math.cos(finalAngle) * OFFSET_RADIUS;
    const dy = Math.sin(finalAngle) * OFFSET_RADIUS; 
    this.x = this._centerX + dx;
    this.y = this._centerY + dy;
    
    switch (this._dir) {
      case 8:
       this.y -= 20;
       break;
      case 2:
       this.y -= 10;
       break;

    default:
    }

    // Rotation entre _startRot et _endRot
    this.rotation = this._startRot + (this._endRot - this._startRot) * progress;
  }
}

// Fonction à appeler pour spawn l'animation slash devant le joueur
function spawnSlash() {
  const px = $gamePlayer.screenX();
  const py = $gamePlayer.screenY();
  const dir = $gamePlayer.direction();

  const sprite = new SlashSprite(px, py, dir);
  SceneManager._scene._spriteset.addChild(sprite);
  AudioManager.playSe({
  name: SOUND_NAME_SLASH,  // Nom du fichier audio (sans l'extension .ogg/.m4a)
  volume: 90,
  pitch: 100,
  pan: 0
  });
  slashcooldown = SLASH_COOLDOWN;
  //$gameTemp.requestAnimation([gameEvent], ANIMATION_ID);
}


  function loadMapData(mapId, callback) {
    const filename = `Map${mapId.toString().padStart(3, "0")}.json`;
    const xhr = new XMLHttpRequest();
    xhr.open("GET", `data/${filename}`);
    xhr.overrideMimeType("application/json");
    xhr.onload = () => {
      if (xhr.status < 400) {
        const data = JSON.parse(xhr.responseText);
        callback(data);
      } else {
        console.error(`Erreur chargement ${filename}`);
      }
    };
    xhr.onerror = () => console.error(`Erreur réseau ${filename}`);
    xhr.send();
  }

/*   function cloneEventAt(x, y) {
    loadMapData(MODEL_MAP_ID, (mapData) => {
      const model = mapData.events.find(e => e && e.name === MODEL_EVENT_NAME);
      if (!model) return console.error(`Événement modèle "${MODEL_EVENT_NAME}" non trouvé`);

      const newEvent = JSON.parse(JSON.stringify(model));
      const newId = $dataMap.events.length;
      newEvent.id = newId;
      newEvent.x = x;
      newEvent.y = y;

      $dataMap.events[newId] = newEvent;
      const gameEvent = new Game_Event($gameMap._mapId, newId);
      $gameMap._events[newId] = gameEvent;

      // Recrée tous les sprites personnages (joueur + événements)
      if (SceneManager._scene._spriteset) {
        SceneManager._scene._spriteset._characterSprites = [];
        SceneManager._scene._spriteset.createCharacters();
      }
	  //$gameTemp.requestAnimation([gameEvent], ANIMATION_ID);

     // console.log(`"${MODEL_EVENT_NAME}" cloné à (${x}, ${y}) avec animation`);
    });
  } */

  function positionDevantLeJoueur() {
    const dir = $gamePlayer.direction();
    const x = $gamePlayer.x + (dir === 6 ? 1 : dir === 4 ? -1 : 0);
    const y = $gamePlayer.y + (dir === 2 ? 1 : dir === 8 ? -1 : 0);
    return [x, y];
  }

