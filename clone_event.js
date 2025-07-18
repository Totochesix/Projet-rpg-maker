/*:
 * @target MZ
 * @plugindesc Clone Un evennement devant le personnage depuis une carte modèle quand on appuie sur un bouton
 */

(() => {
  const MODEL_MAP_ID = 2;             // ID de la map EventTools
  const MODEL_EVENT_NAME = "Caillou"; // Nom de l'événement modèle
  const CLONE_KEY = "pageup";         // Touche de clonage

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

  function cloneEventAt(x, y) {
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

      console.log(`"${MODEL_EVENT_NAME}" cloné à (${x}, ${y})`);
    });
  }

  function positionDevantLeJoueur() {
    const dir = $gamePlayer.direction();
    const x = $gamePlayer.x + (dir === 6 ? 1 : dir === 4 ? -1 : 0);
    const y = $gamePlayer.y + (dir === 2 ? 1 : dir === 8 ? -1 : 0);
    return [x, y];
  }

  const alias_update = Scene_Map.prototype.update;
  Scene_Map.prototype.update = function () {
    alias_update.call(this);
    if (Input.isTriggered(CLONE_KEY)) {
      const [x, y] = positionDevantLeJoueur();
      cloneEventAt(x, y);
    }
  };
})();
