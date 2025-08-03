//=============================================================================
// parrySystem.js
//=============================================================================

/*:
 * @target MZ
 * @plugindesc [v2.0.3] Système de Parade à Seuils Multiples - Compatible Timing Attack
 * @author YourName
 * @url 
 * @help parrySystem.js
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
 * 
 * === TAGS POUR LES COMPÉTENCES ===
 * Dans l'onglet "Note" des compétences, vous pouvez utiliser :
 * 
 * <noParry>           - Cette compétence ne peut pas être parée
 * <parrySpeed:X>      - Modifie la vitesse de parade (ex: <parrySpeed:130> = 30% plus rapide)
 *                       Valeurs recommandées: 70-150
 * 
 * Exemples:
 * <parrySpeed:70>     - Attaque lente (30% plus facile à parer)
 * <parrySpeed:130>    - Attaque rapide (30% plus difficile à parer)
 * <noParry>           - Attaque imparable
 */

(() => {
    'use strict';
    
    const pluginName = 'parrySystem';
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
    
    // Perfect parry delay system
    let perfectParryDelayActive = false;
    let perfectParryEndTime = 0;
    let delayedActions = [];
    const PERFECT_PARRY_DELAY = 30;
    
    // Parry system state
    let parryState = {
        active: false,
        startFrame: 0,
        currentFrame: 0,
        target: null,
        attacker: null,
        originalAction: null,
        inputPressed: false,
        inputFrame: 0,
        // Valeurs actuelles pour cette attaque
        currentValues: {
            totalDuration: totalDuration,
            normalFailZone: normalFailZone,
            criticalFailZone: criticalFailZone,
            goodParryZone: goodParryZone,
            perfectParryZone: perfectParryZone
        }
    };
    
    // UI Elements
    let parryUI = null;
    
    // Fonction pour analyser les tags d'une compétence
    function parseSkillTags(action) {
        let canParry = true;
        let speedMultiplier = 100; // 100 = vitesse normale
        
        if (action.isSkill()) {
            const skill = action.item();
            const note = skill.note;
            
            // Vérifier si la compétence est imparable
            if (note.includes('<noParry>')) {
                canParry = false;
            }
            
            // Vérifier la vitesse de parade
            const speedMatch = note.match(/<parrySpeed:(\d+)>/i);
            if (speedMatch) {
                speedMultiplier = parseInt(speedMatch[1]);
                // Limiter entre 50 et 200 pour éviter les valeurs extremes
                speedMultiplier = Math.max(50, Math.min(200, speedMultiplier));
            }
        }
        
        return { canParry, speedMultiplier };
    }
    
    // Fonction pour calculer les valeurs selon la compétence
    function calculateValuesForAction(action) {
        const tags = parseSkillTags(action);
        
        if (!tags.canParry) {
            return null; // Pas de parade possible
        }
        
        // Calculer les nouvelles valeurs basées sur le multiplicateur de vitesse
        // Plus le multiplicateur est élevé, plus c'est rapide (donc plus difficile)
        const speedFactor = tags.speedMultiplier / 100;
        
        return {
            totalDuration: Math.round(totalDuration / speedFactor),
            normalFailZone: Math.round(normalFailZone / speedFactor),
            criticalFailZone: Math.round(criticalFailZone / speedFactor),
            goodParryZone: Math.round(goodParryZone / speedFactor),
            perfectParryZone: Math.round(perfectParryZone / speedFactor)
        };
    }
    
    // Zone calculations
    function getZones() {
        const values = parryState.currentValues;
        
        const normalEnd = values.normalFailZone;
        const criticalEnd = normalEnd + values.criticalFailZone;
        const goodEnd = criticalEnd + values.goodParryZone;
        const perfectEnd = goodEnd + values.perfectParryZone;
        
        const actualTotalDuration = Math.max(values.totalDuration, perfectEnd);
        
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
        
        // Draw zones with colors
        const zoneColors = {
            normalFail: '#666666',    // Gris
            criticalFail: '#aa0000',  // Rouge
            goodParry: '#0066aa',     // Bleu 
            perfectParry: '#00aa00'   // Vert
        };
        
        // Normal fail zone
        const normalWidth = (zones.normalFail.end / actualTotalDuration) * barWidth;
        parryUI.bitmap.fillRect(barX, barY, normalWidth, barHeight, zoneColors.normalFail);
        
        // Critical fail zone
        const criticalStart = (zones.criticalFail.start / actualTotalDuration) * barWidth;
        const criticalWidth = (parryState.currentValues.criticalFailZone / actualTotalDuration) * barWidth;
        parryUI.bitmap.fillRect(barX + criticalStart, barY, criticalWidth, barHeight, zoneColors.criticalFail);
        
        // Good parry zone
        const goodStart = (zones.goodParry.start / actualTotalDuration) * barWidth;
        const goodWidth = (parryState.currentValues.goodParryZone / actualTotalDuration) * barWidth;
        parryUI.bitmap.fillRect(barX + goodStart, barY, goodWidth, barHeight, zoneColors.goodParry);
        
        // Perfect parry zone
        const perfectStart = (zones.perfectParry.start / actualTotalDuration) * barWidth;
        const perfectWidth = (parryState.currentValues.perfectParryZone / actualTotalDuration) * barWidth;
        parryUI.bitmap.fillRect(barX + perfectStart, barY, perfectWidth, barHeight, zoneColors.perfectParry);
        
        // Progress cursor
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
        // Reset aux valeurs par défaut
        parryState.currentValues = {
            totalDuration: totalDuration,
            normalFailZone: normalFailZone,
            criticalFailZone: criticalFailZone,
            goodParryZone: goodParryZone,
            perfectParryZone: perfectParryZone
        };
    }
    
    // Execute action with parry result
    function executeActionWithParryResult(action, target, result) {
        if (!action || !target || !result) {
            console.warn('Paramètres invalides pour executeActionWithParryResult');
            return;
        }
        
        if (result.type === 'perfectParry' && perfectParryMultiplier === 0) {
            return;
        }
        
        const originalMakeDamageValue = action.makeDamageValue;
        
        action.makeDamageValue = function(target, critical) {
            const damage = originalMakeDamageValue.call(this, target, critical);
            return Math.floor(damage * result.multiplier);
        };
        
        try {
            _Game_Action_apply.call(action, target);
        } finally {
            action.makeDamageValue = originalMakeDamageValue;
        }
    }
    
    // Execute parry sequence
    function executeParrySequence(action, target) {
        const savedAction = action;
        const savedTarget = target;
        
        const waitForParry = () => {
            if (!parryState.active) {
                const result = processParryResult();
                executeActionWithParryResult(savedAction, savedTarget, result);
                return;
            }
            
            parryState.currentFrame = Graphics.frameCount;
            updateParryUI();
            
            const zones = getZones();
            const elapsed = parryState.currentFrame - parryState.startFrame;
            if (elapsed >= zones.totalDuration) {
                const result = processParryResult();
                executeActionWithParryResult(savedAction, savedTarget, result);
                return;
            }
            
            requestAnimationFrame(waitForParry);
        };
        
        waitForParry();
    }
    
    // Start parry sequence
    function startParrySequence(target, attacker, action) {
        if (!target || !attacker || !action) {
            console.warn('Paramètres invalides pour startParrySequence');
            return false;
        }
        
        // Vérifier si cette action peut être parée
        const actionValues = calculateValuesForAction(action);
        if (!actionValues) {
            // Action imparable, continuer normalement sans parade
            return false;
        }
        
        // Utiliser les valeurs calculées pour cette action
        parryState.currentValues = actionValues;
        
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
                    
                    const counterTarget = parryState.target;
                    const counterAttacker = parryState.attacker;
                    
                    perfectParryDelayActive = true;
                    perfectParryEndTime = Graphics.frameCount + PERFECT_PARRY_DELAY;
                    BattleManager._phase = 'perfectParryDelay';
                    
                    setTimeout(() => {
                        performCounterAttack(counterTarget, counterAttacker);
                        setTimeout(() => resetParryState(), 30);
                    }, 200);
                    break;
            }
        } else {
            result = { type: 'noInput', multiplier: normalFailMultiplier };
            AudioManager.playSe({name: 'Miss', volume: 70, pitch: 80, pan: 0});
        }
        
        if (result.type !== 'perfectParry') {
            setTimeout(() => resetParryState(), 30);
        }
        
        return result;
    }
    
    // Perform counter attack
    function performCounterAttack(target, attacker) {
        if (!attacker || !target) {
            console.warn('Paramètres invalides pour performCounterAttack');
            return;
        }
        
        const action = new Game_Action(target);
        action.setAttack();
        
        if (window.markAsCounterAttack) {
            window.markAsCounterAttack();
        }
        
        action.apply(attacker);
        
        if (attacker.isDead()) {
            attacker.performCollapse();
            
            if (attacker.isEnemy()) {
                attacker._hidden = true;
                
                if ($gameParty.inBattle()) {
                    $gameTroop.makeDropItems();
                }
            }
        }
        
        if (target.isActor()) {
            $gameTemp.requestAnimation([attacker], target.attackAnimationId1());
        }
        
        attacker.startDamagePopup();
    }
    
    // Hook into BattleManager update
    const _BattleManager_update = BattleManager.update;
    BattleManager.update = function(timeActive) {
        if (perfectParryDelayActive) {
            const currentTime = Graphics.frameCount;
            
            if (currentTime >= perfectParryEndTime) {
                perfectParryDelayActive = false;
                this._phase = 'turn';
                
                if (this.checkBattleEnd()) {
                    return;
                }
                
                if (delayedActions.length > 0) {
                    const nextAction = delayedActions.shift();
                    this._subject = nextAction.subject;
                    this._action = nextAction.action;
                    this._targets = nextAction.targets;
                }
            } else {
                return;
            }
        }
        
        _BattleManager_update.call(this, timeActive);
    };
    
    // Hook into BattleManager action execution
    const _BattleManager_startAction = BattleManager.startAction;
    BattleManager.startAction = function() {
        if (perfectParryDelayActive && this._subject && this._subject.isEnemy()) {
            delayedActions.push({
                subject: this._subject,
                action: this._action,
                targets: this._targets
            });
            
            this.endAction();
            return;
        }
        
        _BattleManager_startAction.call(this);
    };
    
    // Hook into Game_Action apply
    const _Game_Action_apply = Game_Action.prototype.apply;
    Game_Action.prototype.apply = function(target) {
        if (this.subject().isEnemy() && target.isActor() && this.isHpEffect()) {
            if (!this.subject() || !target || !this.isValid()) {
                console.warn('Action ou cible invalide pour la parade');
                _Game_Action_apply.call(this, target);
                return;
            }
            
            if (startParrySequence(target, this.subject(), this)) {
                executeParrySequence(this, target);
                return;
            }
        }
        
        _Game_Action_apply.call(this, target);
    };
    
    // Input handling
    const _Scene_Battle_update = Scene_Battle.prototype.update;
    Scene_Battle.prototype.update = function() {
        _Scene_Battle_update.call(this);
        
        if (parryState.active && Input.isTriggered(parryKey) && !parryState.inputPressed) {
            parryState.inputPressed = true;
            parryState.inputFrame = Graphics.frameCount;
            
            AudioManager.playSe({name: 'Cursor1', volume: 60, pitch: 120, pan: 0});
        }
    };
    
    // Reset functions
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
