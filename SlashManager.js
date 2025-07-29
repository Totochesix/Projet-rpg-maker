const alias_update = Scene_Map.prototype.update;
  Scene_Map.prototype.update = function () {
    alias_update.call(this);
    if (Input.isTriggered(CLONE_KEY) && slashcooldown === 0) {
      const [x, y] = positionDevantLeJoueur();
      //cloneEventAt(x, y);
      spawnSlash();
    }
    if (slashcooldown > 0) slashcooldown--;
  };
