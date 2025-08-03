// ============================================================================
// Plugin de Dash pour RPG Maker MZ - Version Améliorée
// ============================================================================
/*:
 * @target MZ
 * @plugindesc Système de dash pour le joueur
 * @author Arnaut + Claude
 * @version 2.0.1
 * @description Système de dash pour le joueur pour lui permettre d'equiver des projectiles
 */
(() => {
    'use strict';
    
    // ========================================
    // Configuration
    // ========================================
    const CONFIG = {
        DASH_DISTANCE: 48,      // Distance en pixels
        DASH_SPEED: 8,          // Vitesse en pixels par frame
        DASH_COOLDOWN: 60,      // Cooldown en frames (60 = 1 seconde)
        DASH_KEY: 'pageup',     // Touche de dash (pageup = Page Up)
        SOUND_NAME: "Wind7",    // Son du dash
        SOUND_VOLUME: 90,
        SOUND_PITCH: 100,
        FRAME_RATE: 60          // FPS du jeu
    };
    
    // ========================================
    // Variables globales
    // ========================================
    let dashState = {
        isDashing: false,
        cooldown: 0,
        currentInterval: null
    };
    
    // ========================================
    // Classe DashManager pour encapsuler la logique
    // ========================================
    class DashManager {
        static canDash() {
            return !dashState.isDashing && 
                   dashState.cooldown === 0 && 
                   !$gamePlayer.isMoving() &&
                   !$gameMessage.isBusy() &&
                   $gameSystem.isMenuEnabled();
        }
        
        static getInputDirection() {
            const horz = Input.isPressed("right") - Input.isPressed("left");
            const vert = Input.isPressed("down") - Input.isPressed("up");
            
            if (horz === 0 && vert === 0) return null;
            
            return {
                horizontal: horz,
                vertical: vert,
                dx: horz !== 0 ? Math.sign(horz) : 0,
                dy: vert !== 0 ? Math.sign(vert) : 0,
                direction: this.calculateDirection(horz, vert)
            };
        }
        
        static calculateDirection(horz, vert) {
            // Pour les diagonales, on retourne un objet avec les deux directions
            if (horz !== 0 && vert !== 0) {
                return {
                    horizontal: horz > 0 ? 6 : 4,
                    vertical: vert > 0 ? 2 : 8,
                    isDiagonal: true
                };
            } else if (horz !== 0) {
                return horz > 0 ? 6 : 4; // Droite : Gauche
            } else {
                return vert > 0 ? 2 : 8; // Bas : Haut
            }
        }
        
        static checkCollision(player, dx, dy, direction) {
            // Calcul de la position suivante en pixels
            const nextRealX = player._realX + dx * CONFIG.DASH_SPEED / $gameMap.tileWidth();
            const nextRealY = player._realY + dy * CONFIG.DASH_SPEED / $gameMap.tileHeight();
            const nextX = Math.round(nextRealX);
            const nextY = Math.round(nextRealY);
            
            // Vérification des limites de la carte
            if (nextX < 0 || nextX >= $gameMap.width() || 
                nextY < 0 || nextY >= $gameMap.height()) {
                return false;
            }
            
            // Vérification de passabilité
            if (typeof direction === 'object' && direction.isDiagonal) {
                // Mouvement diagonal : on vérifie les deux directions séparément
                // ET on vérifie la passabilité diagonale
                const canPassHorizontal = player.canPass(player.x, player.y, direction.horizontal);
                const canPassVertical = player.canPass(player.x, player.y, direction.vertical);
                const canPassDiagonal = player.canPassDiagonally(player.x, player.y, 
                    direction.horizontal, direction.vertical);
                
                return canPassHorizontal && canPassVertical && canPassDiagonal;
            } else {
                // Mouvement cardinal
                return player.canPass(player.x, player.y, direction);
            }
        }
        
        static playDashSound() {
            if (CONFIG.SOUND_NAME) {
                AudioManager.playSe({
                    name: CONFIG.SOUND_NAME,
                    volume: CONFIG.SOUND_VOLUME,
                    pitch: CONFIG.SOUND_PITCH,
                    pan: 0
                });
            }
        }
        
        static cleanup() {
            if (dashState.currentInterval) {
                clearInterval(dashState.currentInterval);
                dashState.currentInterval = null;
            }
            dashState.isDashing = false;
        }
        
        static performDash() {
            if (!this.canDash()) return;
            
            const inputDir = this.getInputDirection();
            if (!inputDir) return;
            
            const player = $gamePlayer;
            const { dx, dy, direction } = inputDir;
            
            // Vérification initiale de collision
            if (!this.checkCollision(player, dx, dy, direction)) return;
            
            const steps = Math.floor(CONFIG.DASH_DISTANCE / CONFIG.DASH_SPEED);
            let stepCount = 0;
            
            // Initialisation du dash
            dashState.isDashing = true;
            dashState.cooldown = CONFIG.DASH_COOLDOWN;
            this.playDashSound();
            
            // Animation du dash
            dashState.currentInterval = setInterval(() => {
                // Fin du dash
                if (stepCount >= steps) {
                    this.cleanup();
                    return;
                }
                
                // Vérification continue des collisions AVANT le mouvement
                if (!this.checkCollision(player, dx, dy, direction)) {
                    this.cleanup();
                    return;
                }
                
                // Application du mouvement
                const pixelMoveX = dx * CONFIG.DASH_SPEED / $gameMap.tileWidth();
                const pixelMoveY = dy * CONFIG.DASH_SPEED / $gameMap.tileHeight();
                
                player._realX = Math.max(0, Math.min(player._realX + pixelMoveX, $gameMap.width() - 1));
                player._realY = Math.max(0, Math.min(player._realY + pixelMoveY, $gameMap.height() - 1));
                
                // Mise à jour des coordonnées de tuile
                player._x = Math.round(player._realX);
                player._y = Math.round(player._realY);
                
                stepCount++;
            }, Math.floor(1000 / CONFIG.FRAME_RATE));
        }
    }
    
    // ========================================
    // Extension de Scene_Map
    // ========================================
    const _Scene_Map_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function() {
        _Scene_Map_update.call(this);
        this.updateDash();
    };
    
    Scene_Map.prototype.updateDash = function() {
        // Gestion du cooldown
        if (dashState.cooldown > 0) {
            dashState.cooldown--;
        }
        
        // Déclenchement du dash
        if (Input.isTriggered(CONFIG.DASH_KEY)) {
            DashManager.performDash();
        }
    };
    
    // ========================================
    // Nettoyage lors du changement de scène
    // ========================================
    const _Scene_Map_terminate = Scene_Map.prototype.terminate;
    Scene_Map.prototype.terminate = function() {
        DashManager.cleanup();
        _Scene_Map_terminate.call(this);
    };
    
    // ========================================
    // API publique (optionnelle)
    // ========================================
    window.DashAPI = {
        isDashing: () => dashState.isDashing,
        getCooldown: () => dashState.cooldown,
        forceDash: (direction) => {
            // Possibilité de forcer un dash dans une direction spécifique
            // Utile pour les événements ou cutscenes
        }
    };
    
})();