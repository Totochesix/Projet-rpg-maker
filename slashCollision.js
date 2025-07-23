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

  SlashSprite.prototype._onEnemyHit = function(enemy) {
    const troopId = getTroopIdFromEvent(enemy);

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
  };
})();
