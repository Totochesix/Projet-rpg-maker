//=============================================================================
// ParrySystem.js
//=============================================================================

/*:
 * @target MZ
 * @plugindesc [v2.0.3] Système de Parade à Seuils Multiples - Compatible Timing Attack
 * @author Arnaut + Claude
 * @url 
 * @help ParrySystem.js
 * 
 * @param parryKey
 * @text Touche de Parade
 * @desc Touche pour effectuer la parade
 * @type string
 * @default ok
 * 
 * @param totalDuration
 * @text Durée Totale (frames)
 * @desc Durée totale avant impact de l'attaque
 * @type number
 * @default 45
 * 
 * @param normalFailZone
 * @text Zone Échec Normal (frames)
 * @desc Taille de la zone d'échec normal au début
 * @type number
 * @default 15
 * 
 * @param goodParryZone
 * @text Zone Parade Réussie (frames)
 * @desc Taille de la zone de parade réussie
 * @type number
 * @default 12
 * 
 * @param perfectParryZone
 * @text Zone Parade Parfaite (frames)
 * @desc Taille de la zone de parade parfaite
 * @type number
 * @default 8
 * 
 * @param criticalFailZone
 * @text Zone Échec Critique (frames)
 * @desc Taille de la zone d'échec critique à la fin
 * @type number
 * @default 10
 * 
 * @param normalFailMultiplier
 * @text Multiplicateur Échec Normal
 * @desc Multiplicateur de dégâts pour un échec normal (1.0 = dégâts normaux)
 * @type number
 * @decimals 2
 * @default 1.00
 * 
 * @param criticalFailMultiplier
 * @text Multiplicateur Échec Critique
 * @desc Multiplicateur de dégâts pour un échec critique
 * @type number
 * @decimals 2
 * @default 1.25
 * 
 * @param goodParryMultiplier
 * @text Multiplicateur Parade Réussie
 * @desc Multiplicateur de dégâts pour une parade réussie
 * @type number
 * @decimals 2
 * @default 0.75
 * 
 * @param perfectParryMultiplier
 * @text Multiplicateur Parade Parfaite
 * @desc Multiplicateur de dégâts pour une parade parfaite (0.0 = aucun dégât)
 * @type number
 * @decimals 2
 * @default 0.00
 * 
 * Système de parade avec 4 seuils de réussite.
 * Timing précis requis pour éviter les dégâts !
 * Compatible avec le système de timing attack.
 */

(() => {
    'use strict';
    
    const pluginName = 'ParrySystem';
    const parameters = PluginManager.parameters(pluginName);
    const parryKey = parameters['parryKey'] || 'ok';
    const totalDuration = Number(parameters['totalDuration']) || 45;
    const normalFailZone = Number(parameters['normalFailZone']) || 15;
    const goodParryZone = Number(parameters['goodParryZone']) || 12;
    const perfectParryZone = Number(parameters['perfectParryZone']) || 8;
    const criticalFailZone = Number(parameters['criticalFailZone']) || 10;
    
    // Multiplicateurs configurables
    const normalFailMultiplier = Number(parameters['normalFailMultiplier']) || 1.0;
    const criticalFailMultiplier = Number(parameters['criticalFailMultiplier']) || 1.25;
    const goodParryMultiplier = Number(parameters['goodParryMultiplier']) || 0.75;
    const perfectParryMultiplier = Number(parameters['perfectParryMultiplier']) || 0.0;
    
    // Perfect parry delay system - BEAUCOUP PLUS RAPIDE
    let perfectParryDelayActive = false;
    let perfectParryEndTime = 0;
    let delayedActions = [];
    const PERFECT_PARRY_DELAY = 30; // 0.5 secondes au lieu de 3 secondes
    
    // Parry system state
    let parryState = {
        active: false,
        startFrame: 0,
        currentFrame: 0,
        target: null,
        attacker: null,
        originalAction: null,
        inputPressed: false,
        inputFrame: 0
    };
    
    // UI Elements
    let parryUI = null;
    
    // Zone calculations - NOUVEL ORDRE: Gris -> Rouge -> Bleu -> Vert
    function getZones() {
        // Calculer les zones en fonction des paramètres configurés
        const normalEnd = normalFailZone;
        const criticalEnd = normalEnd + criticalFailZone;
        const goodEnd = criticalEnd + goodParryZone;
        const perfectEnd = goodEnd + perfectParryZone;
        
        // Utiliser le maximum entre totalDuration et la somme des zones
        const actualTotalDuration = Math.max(totalDuration, perfectEnd);
        
        return {
            normalFail: { start: 0, end: normalEnd },
            criticalFail: { start: normalEnd, end: criticalEnd },
            goodParry: { start: criticalEnd, end: goodEnd },
            perfectParry: { start: goodEnd, end: actualTotalDuration },
            totalDuration: actualTotalDuration
        };
    }
    
    // Get current zone based on timing
    function getCurrentZone(timing) {
        const zones = getZones();
        
        if (timing >= zones.normalFail.start && timing < zones.normalFail.end) {
            return 'normalFail';
        } else if (timing >= zones.criticalFail.start && timing < zones.criticalFail.end) {
            return 'criticalFail';
        } else if (timing >= zones.goodParry.start && timing < zones.goodParry.end) {
            return 'goodParry';
        } else if (timing >= zones.perfectParry.start && timing <= zones.perfectParry.end) {
            return 'perfectParry';
        }
        return 'normalFail';
    }
    
    // Create parry UI
    function createParryUI() {
        if (parryUI) return;
        
        parryUI = new Sprite();
        parryUI.bitmap = new Bitmap(Graphics.width, 120);
        parryUI.x = 0;
        parryUI.y = Graphics.height - 180;
        parryUI.z = 1000;
        
        // Add to scene
        if (SceneManager._scene && SceneManager._scene.addChild) {
            SceneManager._scene.addChild(parryUI);
        }
    }
    
    // Update parry UI
    function updateParryUI() {
        if (!parryUI || !parryState.active) return;
        
        parryUI.bitmap.clear();
        
        // Calculate progress
        const elapsed = parryState.currentFrame - parryState.startFrame;
        const zones = getZones();
        const actualTotalDuration = zones.totalDuration;
        const progress = elapsed / actualTotalDuration;
        
        // Draw timing bar
        const barWidth = 500;
        const barHeight = 30;
        const barX = (Graphics.width - barWidth) / 2;
        const barY = 50;
        
        // Background
        parryUI.bitmap.fillRect(barX - 3, barY - 3, barWidth + 6, barHeight + 6, '#000000');
        parryUI.bitmap.fillRect(barX, barY, barWidth, barHeight, '#222222');
        
        // Draw zones with colors - NOUVEL ORDRE: Gris -> Rouge -> Bleu -> Vert
        const zoneColors = {
            normalFail: '#666666',    // Gris (début)
            criticalFail: '#aa0000',  // Rouge (milieu)
            goodParry: '#0066aa',     // Bleu 
            perfectParry: '#00aa00'   // Vert (fin)
        };
        
        // Normal fail zone (début - gris)
        const normalWidth = (zones.normalFail.end / actualTotalDuration) * barWidth;
        parryUI.bitmap.fillRect(barX, barY, normalWidth, barHeight, zoneColors.normalFail);
        
        // Critical fail zone (milieu - rouge)
        const criticalStart = (zones.criticalFail.start / actualTotalDuration) * barWidth;
        const criticalWidth = (criticalFailZone / actualTotalDuration) * barWidth;
        parryUI.bitmap.fillRect(barX + criticalStart, barY, criticalWidth, barHeight, zoneColors.criticalFail);
        
        // Good parry zone (bleu)
        const goodStart = (zones.goodParry.start / actualTotalDuration) * barWidth;
        const goodWidth = (goodParryZone / actualTotalDuration) * barWidth;
        parryUI.bitmap.fillRect(barX + goodStart, barY, goodWidth, barHeight, zoneColors.goodParry);
        
        // Perfect parry zone (fin - vert)
        const perfectStart = (zones.perfectParry.start / actualTotalDuration) * barWidth;
        const perfectWidth = (perfectParryZone / actualTotalDuration) * barWidth;
        parryUI.bitmap.fillRect(barX + perfectStart, barY, perfectWidth, barHeight, zoneColors.perfectParry);
        
        // Progress cursor (white line moving left to right)
        const cursorX = barX + (progress * barWidth);
        parryUI.bitmap.fillRect(cursorX - 2, barY - 5, 4, barHeight + 10, '#ffffff');
        
        // Show input mark if pressed
        if (parryState.inputPressed) {
            const inputProgress = (parryState.inputFrame - parryState.startFrame) / actualTotalDuration;
            const inputX = barX + (inputProgress * barWidth);
            const inputZone = getCurrentZone(parryState.inputFrame - parryState.startFrame);
            const inputColor = {
                'criticalFail': '#ff4444',
                'normalFail': '#888888',
                'goodParry': '#4488ff',
                'perfectParry': '#44ff44'
            }[inputZone];
            parryUI.bitmap.fillRect(inputX - 1, barY - 8, 2, barHeight + 16, inputColor);
        }
    }
    
    // Remove parry UI
    function removeParryUI() {
        if (parryUI) {
            if (parryUI.parent) {
                parryUI.parent.removeChild(parryUI);
            }
            parryUI = null;
        }
    }
    
    // Reset parry state completely
    function resetParryState() {
        parryState.active = false;
        parryState.startFrame = 0;
        parryState.currentFrame = 0;
        parryState.target = null;
        parryState.attacker = null;
        parryState.originalAction = null;
        parryState.inputPressed = false;
        parryState.inputFrame = 0;
    }
    
    // CORRECTION PRINCIPALE: Fonction séparée pour l'exécution des actions avec références fixes
    function executeActionWithParryResult(action, target, result) {
        // Validation des paramètres
        if (!action || !target || !result) {
            console.warn('Paramètres invalides pour executeActionWithParryResult');
            return;
        }
        
        if (result.type === 'perfectParry' && perfectParryMultiplier === 0) {
            // Perfect parry - no damage at all
            return;
        }
        
        // Sauvegarder la méthode originale
        const originalMakeDamageValue = action.makeDamageValue;
        
        // Modifier temporairement la méthode de calcul des dégâts
        action.makeDamageValue = function(target, critical) {
            const damage = originalMakeDamageValue.call(this, target, critical);
            return Math.floor(damage * result.multiplier);
        };
        
        try {
            // Appliquer l'action
            _Game_Action_apply.call(action, target);
        } finally {
            // Restaurer la méthode originale dans tous les cas
            action.makeDamageValue = originalMakeDamageValue;
        }
    }
    
    // CORRECTION: Fonction de séquence de parade simplifiée et sécurisée
    function executeParrySequence(action, target) {
        // Sauvegarder les références
        const savedAction = action;
        const savedTarget = target;
        
        // Fonction récursive pour attendre le timing
        const waitForParry = () => {
            if (!parryState.active) {
                // Séquence terminée - traiter le résultat
                const result = processParryResult();
                executeActionWithParryResult(savedAction, savedTarget, result);
                return;
            }
            
            parryState.currentFrame = Graphics.frameCount;
            updateParryUI();
            
            // Check for timeout
            const zones = getZones();
            const elapsed = parryState.currentFrame - parryState.startFrame;
            if (elapsed >= zones.totalDuration) {
                // Timeout - traiter le résultat et appliquer l'action
                const result = processParryResult();
                executeActionWithParryResult(savedAction, savedTarget, result);
                return;
            }
            
            // Continuer à attendre
            requestAnimationFrame(waitForParry);
        };
        
        waitForParry();
    }
    
    // Start parry sequence
    function startParrySequence(target, attacker, action) {
        // Vérifier que tous les paramètres sont valides
        if (!target || !attacker || !action) {
            console.warn('Paramètres invalides pour startParrySequence');
            return false;
        }
        
        parryState.active = true;
        parryState.startFrame = Graphics.frameCount;
        parryState.currentFrame = Graphics.frameCount;
        parryState.target = target;
        parryState.attacker = attacker;
        parryState.originalAction = action;
        parryState.inputPressed = false;
        parryState.inputFrame = 0;
        
        createParryUI();
        
        // Play warning sound
        AudioManager.playSe({name: 'Bell3', volume: 80, pitch: 90, pan: 0});
        
        return true;
    }
    
    // Process parry result
    function processParryResult() {
        if (!parryState.active) return { type: 'none', multiplier: normalFailMultiplier };
        
        // End parry state and clean UI
        parryState.active = false;
        removeParryUI();
        
        let result = { type: 'normalFail', multiplier: normalFailMultiplier };
        
        if (parryState.inputPressed) {
            const inputTiming = parryState.inputFrame - parryState.startFrame;
            const zone = getCurrentZone(inputTiming);
            
            switch (zone) {
                case 'normalFail':
                    result = { type: 'normalFail', multiplier: normalFailMultiplier };
                    AudioManager.playSe({name: 'Buzzer2', volume: 80, pitch: 80, pan: 0});
                    break;
                    
                case 'criticalFail':
                    result = { type: 'criticalFail', multiplier: criticalFailMultiplier };
                    AudioManager.playSe({name: 'Buzzer1', volume: 100, pitch: 60, pan: 0});
                    break;
                    
                case 'goodParry':
                    result = { type: 'goodParry', multiplier: goodParryMultiplier };
                    AudioManager.playSe({name: 'Absorb1', volume: 90, pitch: 110, pan: 0});
                    break;
                    
                case 'perfectParry':
                    result = { type: 'perfectParry', multiplier: perfectParryMultiplier };
                    AudioManager.playSe({name: 'Recovery', volume: 100, pitch: 130, pan: 0});
                    
                    // Save references for counter attack before they get overwritten
                    const counterTarget = parryState.target;
                    const counterAttacker = parryState.attacker;
                    
                    // Activate perfect parry delay - block battle progression
                    perfectParryDelayActive = true;
                    perfectParryEndTime = Graphics.frameCount + PERFECT_PARRY_DELAY;
                    
                    // Pause battle manager
                    BattleManager._phase = 'perfectParryDelay';
                    
                    // Counter attack BEAUCOUP PLUS RAPIDE - 200ms au lieu de 1500ms
                    setTimeout(() => {
                        performCounterAttack(counterTarget, counterAttacker);
                        // Reset state after counter attack - plus rapide aussi
                        setTimeout(() => resetParryState(), 30);
                    }, 200);
                    break;
            }
        } else {
            // No input
            result = { type: 'noInput', multiplier: normalFailMultiplier };
            AudioManager.playSe({name: 'Miss', volume: 70, pitch: 80, pan: 0});
        }
        
        // Reset state for non-perfect parries - plus rapide
        if (result.type !== 'perfectParry') {
            setTimeout(() => resetParryState(), 30);
        }
        
        return result;
    }
    
    // Perform counter attack
    function performCounterAttack(target, attacker) {
        // Validation des paramètres
        if (!attacker || !target) {
            console.warn('Paramètres invalides pour performCounterAttack');
            return;
        }
        
        const action = new Game_Action(target);
        action.setAttack();
        
        // MODIFICATION: Marquer comme contre-attaque pour éviter le mini-jeu de timing
        if (window.markAsCounterAttack) {
            window.markAsCounterAttack();
        }
        
        // Execute counter
        action.apply(attacker);
        
        // Check if enemy is defeated and handle death properly
        if (attacker.isDead()) {
            // Force enemy death sequence
            attacker.performCollapse();
            
            // Remove from battle if it's an enemy
            if (attacker.isEnemy()) {
                // Mark as hidden to make it disappear
                attacker._hidden = true;
                
                // CORRECTION: Ne pas déclencher checkBattleEnd ici
                // Le système vérifiera automatiquement à la fin du délai
                
                // Add experience and gold like normal kill
                if ($gameParty.inBattle()) {
                    $gameTroop.makeDropItems();
                }
            }
        }
        
        // Show animation
        if (target.isActor()) {
            $gameTemp.requestAnimation([attacker], target.attackAnimationId1());
        }
        
        // Show damage popup
        attacker.startDamagePopup();
    }
    
    // Hook into BattleManager update to handle perfect parry delay
    const _BattleManager_update = BattleManager.update;
    BattleManager.update = function(timeActive) {
        // Check if we're in perfect parry delay
        if (perfectParryDelayActive) {
            const currentTime = Graphics.frameCount;
            
            if (currentTime >= perfectParryEndTime) {
                // End delay and resume battle
                perfectParryDelayActive = false;
                this._phase = 'turn';
                
                // CORRECTION: Vérifier la fin de combat après le délai
                // Ceci permettra de détecter si un ennemi a été tué pendant la contre-attaque
                if (this.checkBattleEnd()) {
                    return; // Le combat est terminé, pas besoin de continuer
                }
                
                // Process any delayed actions
                if (delayedActions.length > 0) {
                    const nextAction = delayedActions.shift();
                    this._subject = nextAction.subject;
                    this._action = nextAction.action;
                    this._targets = nextAction.targets;
                }
            } else {
                // Still in delay, don't process normal battle updates
                return;
            }
        }
        
        // Call original update
        _BattleManager_update.call(this, timeActive);
    };
    
    // Hook into BattleManager action execution to delay enemy actions during perfect parry
    const _BattleManager_startAction = BattleManager.startAction;
    BattleManager.startAction = function() {
        if (perfectParryDelayActive && this._subject && this._subject.isEnemy()) {
            // Delay this enemy action
            delayedActions.push({
                subject: this._subject,
                action: this._action,
                targets: this._targets
            });
            
            // Skip to next turn
            this.endAction();
            return;
        }
        
        // Call original startAction
        _BattleManager_startAction.call(this);
    };
    
    // CORRECTION PRINCIPALE: Hook sécurisé dans l'application des actions
    const _Game_Action_apply = Game_Action.prototype.apply;
    Game_Action.prototype.apply = function(target) {
        // Only trigger for enemy attacks on actors that deal HP damage
        if (this.subject().isEnemy() && target.isActor() && this.isHpEffect()) {
            // Validation des objets avant de commencer la séquence
            if (!this.subject() || !target || !this.isValid()) {
                console.warn('Action ou cible invalide pour la parade');
                _Game_Action_apply.call(this, target);
                return;
            }
            
            // Start parry sequence
            if (startParrySequence(target, this.subject(), this)) {
                executeParrySequence(this, target);
                return;
            }
        }
        
        // Normal action execution
        _Game_Action_apply.call(this, target);
    };
    
    // Input handling
    const _Scene_Battle_update = Scene_Battle.prototype.update;
    Scene_Battle.prototype.update = function() {
        _Scene_Battle_update.call(this);
        
        // Check for parry input
        if (parryState.active && Input.isTriggered(parryKey) && !parryState.inputPressed) {
            parryState.inputPressed = true;
            parryState.inputFrame = Graphics.frameCount;
            
            // Immediate audio feedback
            AudioManager.playSe({name: 'Cursor1', volume: 60, pitch: 120, pan: 0});
        }
    };
    
    // Reset perfect parry delay on battle start/end
    function resetPerfectParryDelay() {
        perfectParryDelayActive = false;
        perfectParryEndTime = 0;
        delayedActions = [];
    }
    
    // Cleanup on scene change
    const _Scene_Battle_terminate = Scene_Battle.prototype.terminate;
    Scene_Battle.prototype.terminate = function() {
        resetParryState();
        resetPerfectParryDelay();
        removeParryUI();
        _Scene_Battle_terminate.call(this);
    };
    
    // Reset on battle start
    const _Scene_Battle_start = Scene_Battle.prototype.start;
    Scene_Battle.prototype.start = function() {
        resetPerfectParryDelay();
        _Scene_Battle_start.call(this);
    };
    
})();