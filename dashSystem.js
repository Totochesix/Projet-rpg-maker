const DASH_DISTANCE = 48;   // Pixels
const DASH_SPEED = 8;       // Pixels par frame (ex: 4 = rapide, 2 = lent)
let isDashing = false;
let dashCooldown = 0;
DASH_KEY = Input.keyMapper[33];
const DASH_COOLDOWN = 60;
SOUND_NAME_DASH = "Wind7";

const _SceneMap_update = Scene_Map.prototype.update;
Scene_Map.prototype.update = function () {
  _SceneMap_update.call(this);

  if (Input.isTriggered(DASH_KEY) && dashCooldown === 0 ) {
    performDash();
  }

  if (dashCooldown > 0) dashCooldown--;
};

function performDash() {
  if (isDashing) return;

  const horz = Input.isPressed("right") - Input.isPressed("left");
  const vert = Input.isPressed("down") - Input.isPressed("up");

  if (horz === 0 && vert === 0) return;

  let direction;
  if (horz !== 0 && vert !== 0) {
    direction = 0; // Diagonal
  } else if (horz !== 0) {
    direction = horz > 0 ? 6 : 4;
  } else {
    direction = vert > 0 ? 2 : 8;
  }

  const player = $gamePlayer;
  const dx = horz !== 0 ? Math.sign(horz) : 0;
  const dy = vert !== 0 ? Math.sign(vert) : 0;

  const steps = Math.floor(DASH_DISTANCE / DASH_SPEED);
  let stepCount = 0;

  isDashing = true;
  dashCooldown = DASH_COOLDOWN;

  const interval = setInterval(() => {
    if (stepCount >= steps) {
      AudioManager.playSe({
      name: SOUND_NAME_DASH,  // Nom du fichier audio (sans l'extension .ogg/.m4a)
      volume: 90,
      pitch: 100,
      pan: 0
     });

      clearInterval(interval);
      isDashing = false;
      return;
    }

    // Vérifie collision avec passabilité
    const canDash = (dx !== 0 && dy !== 0)
      ? player.canPassDiagonally(player.x, player.y, dx > 0 ? 6 : 4, dy > 0 ? 2 : 8)
      : player.canPass(player.x, player.y, direction);

    if (!canDash) {
      clearInterval(interval);
      isDashing = false;
      return;
    }

    // Applique déplacement en pixels
    const newX = player._realX + dx * DASH_SPEED / $gameMap.tileWidth();
    const newY = player._realY + dy * DASH_SPEED / $gameMap.tileHeight();

    player._realX = newX;
    player._realY = newY;
    player._x = Math.floor(player._realX);
    player._y = Math.floor(player._realY);

    stepCount++;
  }, 16); // 60 FPS → ~1 frame = 16 ms

}
