//=============================================================================
// combatTimingPlugin.js
//=============================================================================

/*:
 * @target MZ
 * @plugindesc Combat Timing Mini-Game Plugin v2.0.1
 * @author Arnaut + Claude
 * @version 2.0.1
 * @description Mini-jeu de timing pendant le combat avec bonus de dégâts
 * 
 * @param barWidth
 * @text Largeur de la barre
 * @desc Largeur de la barre de timing en pixels
 * @type number
 * @min 200
 * @max 800
 * @default 400
 * 
 * @param barHeight
 * @text Hauteur de la barre
 * @desc Hauteur de la barre de timing en pixels
 * @type number
 * @min 20
 * @max 100
 * @default 40
 * 
 * @param cursorSpeed
 * @text Vitesse du curseur
 * @desc Vitesse de défilement du curseur (1-10, plus élevé = plus rapide)
 * @type number
 * @min 1
 * @max 10
 * @default 3
 * 
 * @param zoneMinSize
 * @text Taille minimale des zones vertes
 * @desc Taille minimale des zones vertes en pixels
 * @type number
 * @min 10
 * @max 100
 * @default 30
 * 
 * @param zoneMaxSize
 * @text Taille maximale des zones vertes
 * @desc Taille maximale des zones vertes en pixels
 * @type number
 * @min 20
 * @max 150
 * @default 60
 * 
 * @param damageBonus
 * @text Bonus de dégâts (%)
 * @desc Pourcentage de bonus de dégâts en cas de réussite
 * @type number
 * @min 0
 * @max 100
 * @default 10
 * 
 * @param timeoutDuration
 * @text Durée avant timeout (secondes)
 * @desc Durée maximale du mini-jeu avant échec automatique
 * @type number
 * @min 3
 * @max 15
 * @default 8
 * 
 * @param cursorSize
 * @text Taille du curseur
 * @desc Taille du curseur en pixels
 * @type number
 * @min 2
 * @max 20
 * @default 4
 * 
 * @param zone1Chance
 * @text Chance pour 1 zone (%)
 * @desc Pourcentage de chance d'avoir 1 seule zone verte
 * @type number
 * @min 0
 * @max 100
 * @default 15
 * 
 * @param zone2Chance
 * @text Chance pour 2 zones (%)
 * @desc Pourcentage de chance d'avoir 2 zones vertes
 * @type number
 * @min 0
 * @max 100
 * @default 30
 * 
 * @param zone3Chance
 * @text Chance pour 3 zones (%)
 * @desc Pourcentage de chance d'avoir 3 zones vertes
 * @type number
 * @min 0
 * @max 100
 * @default 30
 * 
 * @param zone4Chance
 * @text Chance pour 4 zones (%)
 * @desc Pourcentage de chance d'avoir 4 zones vertes
 * @type number
 * @min 0
 * @max 100
 * @default 25
 * 
 * @help combatTimingPlugin.js
 * 
 * Ce plugin ajoute un mini-jeu de timing pendant le combat.
 * Après l'attaque du personnage, une barre défile avec des zones vertes.
 * Appuyez sur OK quand le curseur est dans une zone verte pour 10% de dégâts bonus.
 * 
 * Le mini-jeu se termine par succès ou échec, pas de malus en cas d'échec.
 * Compatible avec le système de parade - les contre-attaques n'activent pas le timing.
 */

(() => {
    'use strict';
    
    // Récupération des paramètres
    const parameters = PluginManager.parameters('combatTimingPlugin');
    const barWidth = parseInt(parameters['barWidth']) || 400;
    const barHeight = parseInt(parameters['barHeight']) || 40;
    const cursorSpeed = parseInt(parameters['cursorSpeed']) || 3;
    const zoneMinSize = parseInt(parameters['zoneMinSize']) || 30;
    const zoneMaxSize = parseInt(parameters['zoneMaxSize']) || 60;
    const damageBonus = parseInt(parameters['damageBonus']) || 10;
    const timeoutDuration = parseInt(parameters['timeoutDuration']) || 8;
    const cursorSize = parseInt(parameters['cursorSize']) || 4;
    const zone1Chance = parseInt(parameters['zone1Chance']) || 15;
    const zone2Chance = parseInt(parameters['zone2Chance']) || 30;
    const zone3Chance = parseInt(parameters['zone3Chance']) || 30;
    const zone4Chance = parseInt(parameters['zone4Chance']) || 25;
    
    // Variables globales
    let combatPaused = false;
    let pendingAction = null;
    let pendingTarget = null;
    let timingWindow = null;
    let timingActive = false;
    let bonusApplied = false;
    
    // Variable pour détecter les contre-attaques
    let isCounterAttack = false;
    
    // Fonction pour marquer une action comme contre-attaque
    window.markAsCounterAttack = function() {
        isCounterAttack = true;
        // Auto-reset après un court délai pour éviter les problèmes
        setTimeout(() => {
            isCounterAttack = false;
        }, 100);
    };
    
            // Classe pour le mini-jeu de timing
    class Window_TimingGame extends Window_Base {
        constructor() {
            const windowWidth = barWidth + 80;
            const windowHeight = barHeight + 120;
            const rect = new Rectangle(0, 0, windowWidth, windowHeight);
            super(rect);
            this.x = (Graphics.boxWidth - this.width) / 2;
            this.y = (Graphics.boxHeight - this.height) / 2;
            
            // Variables du mini-jeu
            this.cursorPosition = 0;
            this.greenZones = [];
            this.hitZones = []; // Zones déjà touchées
            this.gameStartTime = Date.now();
            this.gameCompleted = false;
            this.successAchieved = false;
            this.currentZoneIndex = 0; // Index de la prochaine zone à toucher
            
            this.generateGreenZones();
            this.refresh();
        }
        
        generateGreenZones() {
            this.greenZones = [];
            
            // Déterminer le nombre de zones selon les pourcentages
            const random = Math.random() * 100;
            let numZones = 1;
            
            if (random < zone1Chance) {
                numZones = 1;
            } else if (random < zone1Chance + zone2Chance) {
                numZones = 2;
            } else if (random < zone1Chance + zone2Chance + zone3Chance) {
                numZones = 3;
            } else {
                numZones = 4;
            }
            
            const startArea = Math.floor(barWidth * 0.34); // Début des 66% finaux
            const availableWidth = barWidth - startArea;
            
            for (let i = 0; i < numZones; i++) {
                const zoneSize = Math.floor(Math.random() * (zoneMaxSize - zoneMinSize + 1)) + zoneMinSize;
                const maxPosition = availableWidth - zoneSize;
                const position = Math.floor(Math.random() * maxPosition) + startArea;
                
                // Vérifier qu'il n'y a pas de chevauchement
                let overlap = false;
                for (let zone of this.greenZones) {
                    if (position < zone.end && position + zoneSize > zone.start) {
                        overlap = true;
                        break;
                    }
                }
                
                if (!overlap) {
                    this.greenZones.push({
                        start: position,
                        end: position + zoneSize,
                        size: zoneSize,
                        hit: false
                    });
                }
            }
            
            // Trier les zones par position
            this.greenZones.sort((a, b) => a.start - b.start);
        }
        
        update() {
            super.update();
            
            if (this.gameCompleted) return;
            
            // Vérifier le timeout
            if (Date.now() - this.gameStartTime > timeoutDuration * 1000) {
                this.completeGame(false);
                return;
            }
            
            // Déplacer le curseur (un seul aller)
            this.cursorPosition += cursorSpeed;
            
            // Si le curseur atteint la fin, vérifier si toutes les zones ont été touchées
            if (this.cursorPosition >= barWidth - cursorSize) {
                if (this.hitZones.length === this.greenZones.length) {
                    this.completeGame(true);
                } else {
                    this.completeGame(false);
                }
                return;
            }
            
            // Vérifier l'input
            if (Input.isTriggered('ok')) {
                this.checkTiming();
            }
            
            this.refresh();
        }
        
        checkTiming() {
            const cursorCenter = this.cursorPosition + cursorSize / 2;
            
            // Vérifier si on est dans une zone verte
            for (let i = 0; i < this.greenZones.length; i++) {
                const zone = this.greenZones[i];
                
                // Vérifier si le curseur est dans cette zone ET qu'elle n'a pas déjà été touchée
                if (cursorCenter >= zone.start && cursorCenter <= zone.end && !this.hitZones.includes(i)) {
                    this.hitZones.push(i);
                    zone.hit = true; // Marquer la zone comme touchée
                    return; // Continuer le jeu
                }
            }
            
            // Si on arrive ici, le joueur a appuyé en dehors d'une zone ou sur une zone déjà touchée
            this.completeGame(false);
        }
        
        completeGame(success) {
            this.gameCompleted = true;
            this.successAchieved = success;
            bonusApplied = success;
            
            // Attendre un peu pour montrer le résultat
            setTimeout(() => {
                this.close();
                this.hide();
                combatPaused = false;
                timingActive = false;
                
                // Appliquer l'action en attente
                if (pendingAction && pendingTarget) {
                    _Game_Action_apply.call(pendingAction, pendingTarget);
                    
                    // Si l'ennemi est mort, forcer les actions de mort
                    if (pendingTarget.isDead()) {
                        // Exécuter les actions de mort
                        pendingTarget.performCollapse();
                        
                        // Forcer la mise à jour de la scène de combat
                        setTimeout(() => {
                            if (SceneManager._scene && SceneManager._scene.constructor === Scene_Battle) {
                                // Déclencher manuellement les effets de mort
                                if (SceneManager._scene._spriteset && SceneManager._scene._spriteset._enemySprites) {
                                    const enemySprites = SceneManager._scene._spriteset._enemySprites;
                                    for (let sprite of enemySprites) {
                                        if (sprite._battler === pendingTarget && pendingTarget.isDead()) {
                                            sprite.startEffect('collapse');
                                            break;
                                        }
                                    }
                                }
                                
                                // Forcer la vérification de fin de combat
                                BattleManager.checkBattleEnd();
                            }
                        }, 200);
                    }
                    
                    pendingAction = null;
                    pendingTarget = null;
                    bonusApplied = false;
                }
            }, 500);
        }
        
        refresh() {
            this.contents.clear();
            
            // Titre
            const title = this.gameCompleted ? 
                (this.successAchieved ? "RÉUSSI !" : "RATÉ !") : 
                "Timing Attack !";
            this.drawText(title, 0, 0, this.contentsWidth(), 'center');
            
            if (!this.gameCompleted) {
                // Instructions
                //this.drawText("Appuyez sur OK dans TOUTES les zones vertes", 0, 30, this.contentsWidth(), 'center');
                
                // Progression
                const progress = this.hitZones.length + "/" + this.greenZones.length + " zones touchées";
                this.drawText(progress, 0, 50, this.contentsWidth(), 'center');
                
                // Temps restant
                const timeLeft = Math.max(0, timeoutDuration - Math.floor((Date.now() - this.gameStartTime) / 1000));
                //this.drawText("Temps: " + timeLeft + "s", 0, 65, this.contentsWidth(), 'center');
            }
            
            // Dessiner la barre
            const barX = 40;
            const barY = 90;
            
            // Fond de la barre
            this.contents.fillRect(barX, barY, barWidth, barHeight, '#333333');
            this.contents.strokeRect(barX, barY, barWidth, barHeight, '#ffffff');
            
            // Zones vertes
            for (let i = 0; i < this.greenZones.length; i++) {
                const zone = this.greenZones[i];
                const color = zone.hit ? '#ffff00' : '#00ff00'; // Jaune si touchée, vert sinon
                this.contents.fillRect(barX + zone.start, barY, zone.size, barHeight, color);
            }
            
            // Curseur
            if (!this.gameCompleted) {
                this.contents.fillRect(barX + this.cursorPosition, barY - 5, cursorSize, barHeight + 10, '#ff0000');
            }
        }
    }
    
    // Override de Game_Action pour appliquer le bonus
    const _Game_Action_makeDamageValue = Game_Action.prototype.makeDamageValue;
    Game_Action.prototype.makeDamageValue = function(target, critical) {
        const damage = _Game_Action_makeDamageValue.call(this, target, critical);
        
        // Appliquer le bonus si c'est l'action en cours et que le joueur a réussi
        if (bonusApplied && this === pendingAction && target === pendingTarget) {
            const bonus = Math.floor(damage * (damageBonus / 100));
            $gameMessage.add("\\C[3]Timing parfait ! +" + bonus + " dégâts !\\C[0]");
            return damage + bonus;
        }
        
        return damage;
    };
    
    // Override de la méthode d'application des dégâts
    const _Game_Action_apply = Game_Action.prototype.apply;
    Game_Action.prototype.apply = function(target) {
        // MODIFICATION: Vérifier si c'est une contre-attaque
        if (isCounterAttack) {
            // Si c'est une contre-attaque, appliquer normalement sans mini-jeu
            _Game_Action_apply.call(this, target);
            return;
        }
        
        // Vérifier si c'est une action du joueur pendant un combat
        if ($gameParty.inBattle() && this.subject().isActor() && target.isEnemy()) {
            // Stocker l'action et la cible pour plus tard
            pendingAction = this;
            pendingTarget = target;
            combatPaused = true;
            timingActive = true;
            bonusApplied = false;
            
            // Créer la fenêtre de timing
            timingWindow = new Window_TimingGame();
            SceneManager._scene.addChild(timingWindow);
            timingWindow.show();
            timingWindow.open();
            
            // Ne pas appliquer les dégâts tout de suite
            return;
        }
        
        // Appliquer normalement si ce n'est pas une action du joueur
        _Game_Action_apply.call(this, target);
    };
    
    // Override de la méthode update de Scene_Battle
    const _Scene_Battle_update = Scene_Battle.prototype.update;
    Scene_Battle.prototype.update = function() {
        // Si le mini-jeu de timing est actif
        if (timingActive && timingWindow) {
            timingWindow.update();
            Input.update();
            TouchInput.update();
            return;
        }
        
        // Update normal si pas en pause
        _Scene_Battle_update.call(this);
    };
    
    // Nettoyer les variables quand le combat se termine
    const _Scene_Battle_terminate = Scene_Battle.prototype.terminate;
    Scene_Battle.prototype.terminate = function() {
        _Scene_Battle_terminate.call(this);
        combatPaused = false;
        timingActive = false;
        pendingAction = null;
        pendingTarget = null;
        bonusApplied = false;
        isCounterAttack = false; // Reset du flag de contre-attaque
        
        // Supprimer la fenêtre de timing si elle existe
        if (timingWindow) {
            if (timingWindow.parent) {
                timingWindow.parent.removeChild(timingWindow);
            }
            timingWindow = null;
        }
    };
    
    // Override pour empêcher d'autres actions pendant le mini-jeu
    const _Scene_Battle_isAnyInputWindowActive = Scene_Battle.prototype.isAnyInputWindowActive;
    Scene_Battle.prototype.isAnyInputWindowActive = function() {
        if (timingActive) {
            return true; // Empêcher d'autres entrées pendant le mini-jeu
        }
        return _Scene_Battle_isAnyInputWindowActive.call(this);
    };
    
})();