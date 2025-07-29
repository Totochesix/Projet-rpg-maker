//=============================================================================
// TDF_ParrySystem.js
//=============================================================================

/*:
 * @target MZ
 * @plugindesc [v2.0.0] Système de Parade à Seuils Multiples
 * @author YourName
 * @url 
 * @help TDF_ParrySystem.js
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
 * Système de parade avec 4 seuils de réussite.
 * Timing précis requis pour éviter les dégâts !
 */

(() => {
    
})();'use strict';
    
    const pluginName = 'TDF_ParrySystem';
    const parameters = PluginManager.parameters(pluginName);
    const parryKey = parameters['parryKey'] || 'ok';
    const totalDuration = Number(parameters['totalDuration']) || 45;
    const normalFailZone = Number(parameters['normalFailZone']) || 15;
    const goodParryZone = Number(parameters['goodParryZone']) || 12;
    const perfectParryZone = Number(parameters['perfectParryZone']) || 8;
    const criticalFailZone = Number(parameters['criticalFailZone']) || 10;
    
    // Perfect parry delay system
    let perfectParryDelayActive = false;
    let perfectParryEndTime = 0;
    let delayedActions = [];
    const PERFECT_PARRY_DELAY = 180; // 3 seconds delay after perfect parry
    
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
        return {
            normalFail: { start: 0, end: normalFailZone },
            criticalFail: { start: normalFailZone, end: normalFailZone + criticalFailZone },
            goodParry: { start: normalFailZone + criticalFailZone, end: normalFailZone + criticalFailZone + goodParryZone },
            perfectParry: { start: normalFailZone + criticalFailZone + goodParryZone, end: totalDuration }
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
        const progress = elapsed / totalDuration;
        const zones = getZones();
        
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
        const normalWidth = (zones.normalFail.end / totalDuration) * barWidth;
        parryUI.bitmap.fillRect(barX, barY, normalWidth, barHeight, zoneColors.normalFail);
        
        // Critical fail zone (milieu - rouge)
        const criticalStart = (zones.criticalFail.start / totalDuration) * barWidth;
        const criticalWidth = (criticalFailZone / totalDuration) * barWidth;
        parryUI.bitmap.fillRect(barX + criticalStart, barY, criticalWidth, barHeight, zoneColors.criticalFail);
        
        // Good parry zone (bleu)
        const goodStart = (zones.goodParry.start / totalDuration) * barWidth;
        const goodWidth = (goodParryZone / totalDuration) * barWidth;
        parryUI.bitmap.fillRect(barX + goodStart, barY, goodWidth, barHeight, zoneColors.goodParry);
        
        // Perfect parry zone (fin - vert)
        const perfectStart = (zones.perfectParry.start / totalDuration) * barWidth;
        const perfectWidth = (perfectParryZone / totalDuration) * barWidth;
        parryUI.bitmap.fillRect(barX + perfectStart, barY, perfectWidth, barHeight, zoneColors.perfectParry);
        
        // Progress cursor (white line moving left to right)
        const cursorX = barX + (progress * barWidth);
        parryUI.bitmap.fillRect(cursorX - 2, barY - 5, 4, barHeight + 10, '#ffffff');
        
        // Show input mark if pressed
        if (parryState.inputPressed) {
            const inputProgress = (parryState.inputFrame - parryState.startFrame) / totalDuration;
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
        
        // Current zone indication
        const currentZone = getCurrentZone(elapsed);
        const zoneTexts = {
            'normalFail': 'Attendez...',
            'criticalFail': 'DANGER! PAS MAINTENANT!',
            'goodParry': 'PAREZ MAINTENANT!',
            'perfectParry': 'PARFAIT!'
        };
        
        const zoneTextColors = {
            'normalFail': '#ffffff',
            'criticalFail': '#ff4444',
            'goodParry': '#4488ff',
            'perfectParry': '#44ff44'
        };
        
        // Main instruction
        parryUI.bitmap.fontSize = 24;
        parryUI.bitmap.textColor = zoneTextColors[currentZone];
        parryUI.bitmap.drawText(`${zoneTexts[currentZone]}`, 0, 5, Graphics.width, 30, 'center');
        
        // Key instruction
        parryUI.bitmap.fontSize = 18;
        parryUI.bitmap.textColor = '#ffffff';
        parryUI.bitmap.drawText(`Appuyez sur ${parryKey.toUpperCase()} pour parer`, 0, 85, Graphics.width, 25, 'center');
        
        // Zone legend
        parryUI.bitmap.fontSize = 14;
        parryUI.bitmap.textColor = '#cccccc';
        const legendY = 100;
        parryUI.bitmap.drawText('Gris: Trop tôt | Rouge: Échec critique (+25%) | Bleu: Parade (-25%) | Vert: Parfait (0 + contre)', 0, legendY, Graphics.width, 20, 'center');
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
    
    // Separate function for parry sequence execution
    function executeParrySequence(target) {
        // Wait for timing completion
        const waitForParry = () => {
            if (!parryState.active) {
                const result = processParryResult();
                
                if (result.type === 'perfectParry') {
                    // Perfect parry - no damage at all
                    return;
                } else {
                    // Apply damage with multiplier
                    const originalMakeDamageValue = this.makeDamageValue;
                    this.makeDamageValue = function(target, critical) {
                        const damage = originalMakeDamageValue.call(this, target, critical);
                        return Math.floor(damage * result.multiplier);
                    };
                    
                    _Game_Action_apply.call(this, target);
                }
                return;
            }
            
            parryState.currentFrame = Graphics.frameCount;
            updateParryUI();
            
            // Check for timeout
            const elapsed = parryState.currentFrame - parryState.startFrame;
            if (elapsed >= totalDuration) {
                const result = processParryResult();
                _Game_Action_apply.call(this, target);
                return;
            }
            
            requestAnimationFrame(waitForParry);
        };
        
        waitForParry();
    }
    
    // Start parry sequence
    function startParrySequence(target, attacker, action) {
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
    }
    
    // Process parry result
    function processParryResult() {
        if (!parryState.active) return { type: 'none', multiplier: 1.0 };
        
        // End parry state and clean UI
        parryState.active = false;
        removeParryUI();
        
        let result = { type: 'normalFail', multiplier: 1.0 };
        
        if (parryState.inputPressed) {
            const inputTiming = parryState.inputFrame - parryState.startFrame;
            const zone = getCurrentZone(inputTiming);
            
            switch (zone) {
                case 'normalFail':
                    result = { type: 'normalFail', multiplier: 1.0 };
                    AudioManager.playSe({name: 'Buzzer2', volume: 80, pitch: 80, pan: 0});
                    //$gameMessage.add(`\\C[2]Trop tôt...\\C[0]`);
                    break;
                    
                case 'criticalFail':
                    result = { type: 'criticalFail', multiplier: 1.25 };
                    AudioManager.playSe({name: 'Buzzer1', volume: 100, pitch: 60, pan: 0});
                    //$gameMessage.add(`\\C[2]${parryState.target.name()} - ÉCHEC CRITIQUE!\\C[0]`);
                    //$gameMessage.add(`\\C[2]Dégâts augmentés de 25%!\\C[0]`);
                    break;
                    
                case 'goodParry':
                    result = { type: 'goodParry', multiplier: 0.75 };
                    AudioManager.playSe({name: 'Absorb1', volume: 90, pitch: 110, pan: 0});
                    //$gameMessage.add(`\\C[4]${parryState.target.name()} - Bonne parade!\\C[0]`);
                    //$gameMessage.add(`\\C[4]Dégâts réduits de 25%!\\C[0]`);
                    break;
                    
                case 'perfectParry':
                    result = { type: 'perfectParry', multiplier: 0.0 };
                    AudioManager.playSe({name: 'Recovery', volume: 100, pitch: 130, pan: 0});
                    //$gameMessage.add(`\\C[3]${parryState.target.name()} - PARADE PARFAITE!\\C[0]`);
                    //$gameMessage.add(`\\C[3]Attaque annulée!\\C[0]`);
                    
                    // Save references for counter attack before they get overwritten
                    const counterTarget = parryState.target;
                    const counterAttacker = parryState.attacker;
                    
                    // Activate perfect parry delay - block battle progression
                    perfectParryDelayActive = true;
                    perfectParryEndTime = Graphics.frameCount + PERFECT_PARRY_DELAY;
                    
                    // Pause battle manager
                    BattleManager._phase = 'perfectParryDelay';
                    
                    // Counter attack with saved references
                    setTimeout(() => {
                        //$gameMessage.add(`\\C[2]Contre-attaque!\\C[0]`);
                        performCounterAttack(counterTarget, counterAttacker);
                        // Reset state after counter attack
                        setTimeout(() => resetParryState(), 100);
                    }, 1500);
                    break;
            }
        } else {
            // No input
            result = { type: 'noInput', multiplier: 1.0 };
            AudioManager.playSe({name: 'Miss', volume: 70, pitch: 80, pan: 0});
            //$gameMessage.add(`\\C[2]Aucune parade tentée...\\C[0]`);
        }
        
        // Reset state for non-perfect parries
        if (result.type !== 'perfectParry') {
            setTimeout(() => resetParryState(), 100);
        }
        
        return result;
    }
    
    // Perform counter attack
    function performCounterAttack(target, attacker) {
        // Use passed parameters instead of parryState to avoid conflicts
        if (!attacker || !target) return;
        
        const action = new Game_Action(target);
        action.setAttack();
        
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
                
                // Trigger battle end check
                BattleManager.checkBattleEnd();
                
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
    
    // Hook into battle action execution
    const _Game_Action_apply = Game_Action.prototype.apply;
    Game_Action.prototype.apply = function(target) {
        // Only trigger for enemy attacks on actors that deal HP damage
        if (this.subject().isEnemy() && target.isActor() && this.isHpEffect()) {
            // Start parry sequence
            startParrySequence(target, this.subject(), this);
            executeParrySequence.call(this, target);
            return;
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
