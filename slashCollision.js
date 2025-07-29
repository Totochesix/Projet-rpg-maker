(function() {
  const ENEMY_TAGS = "enemy";
  const COLLISION_RADIUS = 30;

 // Récupérer les tags depuis les commentaires d'une page d'événement
  function getTagsFromEvent(gameEvent) {
    const page = gameEvent.page();
    if (!page) return [];

    const tags = [];
    for (const command of page.list) {
      if (command.code === 108 || command.code === 408) { // commentaire
        const text = command.parameters[0];
        const match = text.match(/<Tag:\s*(.+?)\s*>/i);
        if (match) {
          tags.push(match[1]);
        }
      }
    }
    return tags;
  }

  // Fonction pour récupérer le troopId depuis la note d'une page active d'un événement
  function getTroopIdFromEvent(gameEvent) {
    const eventData = gameEvent.event();
    if (!gameEvent || !gameEvent.event()) return null;
    if (!eventData || !eventData.pages) return null;

    const page = gameEvent.page();
    if (!page) return null;

    // La note est dans page.list sous forme de commentaires (code 108 ou 408)
    const comments = [];
    for (const command of page.list) {
      if (command.code === 108 || command.code === 408) {
        comments.push(command.parameters[0]);
      }
    }

    for (const comment of comments) {
      const match = comment.match(/<TroopId:\s*(\d+)\s*>/i);
      if (match) {
        return Number(match[1]);
      }
    }

    return null;
  }

  function hasEnemyTag(gameEvent) {
  if (!gameEvent.event()) return false; // Vérifie si l’événement est valide
  const tags = getTagsFromEvent(gameEvent);
  return tags.some(tag => ENEMY_TAGS.includes(tag));
}

  // Étendre SlashSprite.update pour la collision
  const _update = SlashSprite.prototype.update;
  SlashSprite.prototype.update = function() {
    _update.call(this);
    this.checkEnemyCollision();
  };

  SlashSprite.prototype.checkEnemyCollision = function() {
    if (this._checked) return;

    const enemies = $gameMap.events().filter(ev => hasEnemyTag(ev) && !ev._erased);
    for (const enemy of enemies) {
      const dx = this.x - enemy.screenX();
      const dy = this.y - enemy.screenY();
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < COLLISION_RADIUS) {
        this._checked = true;
        this._onEnemyHit(enemy);
        break;
      }
    }
  };

  function eraseEventFully(event) {
  if (!event) return;
  const eventId = event.eventId();   // ID de l’événement actif
  const mapId = $gameMap.mapId();

  // Efface visuellement l’événement
  $gameMap.eraseEvent(eventId);

  // Reset des self switches A, B, C, D pour cet événement
  ['A', 'B', 'C', 'D'].forEach(letter => {
    $gameSelfSwitches.setValue([mapId, eventId, letter], false);
  });

  console.log(`Événement ${event.event().name} (ID ${eventId}) effacé complètement.`);
}

  SlashSprite.prototype._onEnemyHit = function(enemy) {
    const troopId = getTroopIdFromEvent(enemy);
    const eventId = enemy.eventId();
    const mapId = $gameMap.mapId();

    console.log(troopId);
    console.log(eventId);
    console.log(mapId);

    if (troopId === null) {
      console.warn(`Aucun <TroopId: X> trouvé dans l'événement ${enemy.event().name}, ID ${enemy.eventId()}`);
      return;
    }

    console.log(`Ennemi touché : ${enemy.event().name}, TroopId: ${troopId}`);

    if (!$gameParty.inBattle()) {
      BattleManager.setup(troopId, false, false);
      //BattleManager.setEncounterEffect(true);
      SceneManager.push(Scene_Battle);
    }

    $gameMap.eraseEvent(enemy.eventId());
    ['A', 'B', 'C', 'D'].forEach(letter => {
    $gameSelfSwitches.setValue([mapId, eventId, letter], false);
  });
  $gameMap.eraseEvent(eventId);

  };

  (function() {
  const _Scene_Battle_start = Scene_Battle.prototype.start;
  Scene_Battle.prototype.start = function() {
    _Scene_Battle_start.call(this);

    $gameTroop.members().forEach(enemy => {
      const reduction = Math.floor(enemy.mhp * 0.1);
      enemy.gainHp(-reduction);
      enemy.startDamagePopup();
    });
  };
})();
})();
