/*:
 * @target MZ
 * @plugindesc Affichage Ordre des Tours v1.1.0
 * @author Arnaut + Claude
 * @version 1.1.0
 * @description Affiche joliment l'ordre des tours (utilise le système par défaut de RPG Maker)
 *
 * @param showTurnOrder
 * @text Afficher Ordre des Tours
 * @desc Affiche le tableau d'ordre des tours en combat
 * @type boolean
 * @default true
 *
 * @param windowX
 * @text Position X Fenêtre
 * @desc Position horizontale de la fenêtre
 * @type number
 * @min 0
 * @max 1920
 * @default 1600
 *
 * @param windowY
 * @text Position Y Fenêtre
 * @desc Position verticale de la fenêtre
 * @type number
 * @min 0
 * @max 1080
 * @default 240
 *
 * @param previewTurns
 * @text Tours à Prévisualiser
 * @desc Nombre de tours à afficher en avance
 * @type number
 * @min 1
 * @max 5
 * @default 2
 *
 * @help turnOrderDisplay.js
 * 
 * Ce plugin affiche un tableau élégant de l'ordre des tours :
 * - Utilise le système par défaut de RPG Maker MZ (tri par AGI)
 * - Affiche le tour actuel avec l'ordre de passage
 * - Prévisualise les prochains tours
 * - Distinction visuelle alliés/ennemis
 * - Indicateur du personnage actuellement en action
 * - Version améliorée visuellement
 */

(() => {
    'use strict';
    
    const pluginName = 'turnOrderDisplay';
    const parameters = PluginManager.parameters(pluginName);
    const showTurnOrder = parameters['showTurnOrder'] === 'true';
    const windowX = parseInt(parameters['windowX'] || 1600);
    const windowY = parseInt(parameters['windowY'] || 240);
    const previewTurns = parseInt(parameters['previewTurns'] || 2);
    
    // Fenêtre d'affichage de l'ordre des tours
    class Window_TurnOrderDisplay extends Window_Base {
        constructor() {
            const width = 280;
            const height = Math.min(400, Graphics.height - windowY - 20);
            const rect = new Rectangle(windowX, windowY, width, height);
            super(rect);
            this.currentSubject = null;
            this.refresh();
        }
        
        refresh() {
            this.contents.clear();
            
            if (!$gameParty.inBattle()) {
                return;
            }
            
            // Obtenir l'ordre des tours
            const turnOrder = this.getTurnOrder();
            if (turnOrder.length === 0) {
                return;
            }
            
            // Titre amélioré (juste l'icône ajoutée)
            this.changeTextColor(ColorManager.systemColor());
            this.contents.fontSize = 16;
            this.drawText('⚔️ Ordre de passage', 0, 0, this.contentsWidth(), 'center');
            this.contents.fontSize = $dataSystem.advanced.fontSize;
            
            let y = 30;
            
            // Afficher l'ordre simplifié
            this.drawSimplifiedTurnOrder(turnOrder, y);
        }
        
        getTurnOrder() {
            // Si le combat a commencé et qu'il y a des actionBattlers, les utiliser
            if (BattleManager._actionBattlers && BattleManager._actionBattlers.length > 0) {
                return BattleManager._actionBattlers.filter(battler => battler && battler.isAlive());
            }
            
            // Sinon, générer l'ordre basé sur l'AGI (comme le ferait RPG Maker)
            const allBattlers = this.getAllAliveBattlers();
            return allBattlers.sort((a, b) => {
                if (b.agi !== a.agi) {
                    return b.agi - a.agi;
                }
                // Pour les AGI identiques, ordre stable
                return (a.actorId || a.enemyId || 0) - (b.actorId || b.enemyId || 0);
            });
        }
        
        drawSimplifiedTurnOrder(turnOrder, startY) {
            let y = startY;
            const currentSubject = BattleManager._subject;
            
            for (let i = 0; i < Math.min(turnOrder.length, 8); i++) {
                const battler = turnOrder[i];
                if (!battler || !battler.isAlive()) continue;
                
                const isCurrent = battler === currentSubject;
                const isActor = battler.isActor();
                
                // Fond pour le battler actuel (amélioré avec couleur dorée)
                if (isCurrent) {
                    this.contents.fillRect(0, y - 2, this.contentsWidth(), this.lineHeight(), 
                        ColorManager.textColor(6)); // Couleur dorée
                }
                
                // Indicateur de position
                this.changeTextColor(ColorManager.normalColor());
                if (isCurrent) {
                    this.changeTextColor(ColorManager.crisisColor());
                    this.contents.fontBold = true; // Gras pour le battler actuel
                    this.drawText('►', 8, y, 20);
                    this.contents.fontBold = false;
                } else {
                    this.drawText((i + 1).toString(), 8, y, 20, 'center');
                }
                
                // Nom du battler (couleurs légèrement améliorées)
                if (isCurrent) {
                    this.changeTextColor(ColorManager.crisisColor());
                    this.contents.fontBold = true;
                } else if (isActor) {
                    this.changeTextColor(ColorManager.textColor(4)); // Bleu plus vif pour alliés
                } else {
                    this.changeTextColor(ColorManager.textColor(10)); // Rouge différent pour ennemis
                }
                
                let displayName = battler.name();
                if (displayName.length > 15) {
                    displayName = displayName.substring(0, 14) + '…';
                }
                this.drawText(displayName, 35, y, 150);
                
                // Reset du gras
                if (isCurrent) {
                    this.contents.fontBold = false;
                }
                
                // AGI affiché de manière plus visible
                //this.changeTextColor(ColorManager.dimColor2());
                //this.contents.fontSize = $dataSystem.advanced.fontSize - 2;
                //this.drawText(`⚡${battler.agi}`, 190, y + 2, 40, 'right');
                //this.contents.fontSize = $dataSystem.advanced.fontSize;
                
                y += this.lineHeight();
                
                // Éviter de dépasser la fenêtre
                if (y > this.contentsHeight() - 40) {
                    if (i < turnOrder.length - 1) {
                        this.changeTextColor(ColorManager.dimColor2());
                        this.drawText(`... +${turnOrder.length - i - 1}`, 35, y, 150);
                    }
                    break;
                }
            }
            
            // Afficher les prochains tours si la place le permet
            if (y < this.contentsHeight() - 80) {
                this.drawUpcomingTurns(y + 20);
            }
        }
        
        drawUpcomingTurns(startY) {
            let y = startY;
            
            // Titre des tours à venir (amélioré avec icône)
            this.changeTextColor(ColorManager.systemColor());
            this.contents.fontSize = 14;
            this.drawText('🔮 Prochains Tours', 0, y, this.contentsWidth(), 'center');
            this.contents.fontSize = $dataSystem.advanced.fontSize;
            
            y += 25;
            
            // Simuler les prochains tours
            const upcomingTurns = this.simulateUpcomingTurns(Math.min(previewTurns, 2));
            
            for (let turnIndex = 0; turnIndex < upcomingTurns.length; turnIndex++) {
                const turn = upcomingTurns[turnIndex];
                
                if (y >= this.contentsHeight() - 20) break;
                
                // Titre du tour avec opacité réduite
                const alpha = 0.8 - (turnIndex * 0.3);
                this.contents.paintOpacity = Math.max(120, alpha * 255);
                
                this.changeTextColor(ColorManager.normalColor());
                this.contents.fontSize = $dataSystem.advanced.fontSize - 2;
                this.drawText(`T.${$gameTroop.turnCount() + turnIndex + 1}:`, 8, y, 60);
                
                // Noms compacts
                let x = 70;
                const maxShow = Math.min(turn.length, 3);
                for (let i = 0; i < maxShow; i++) {
                    const battler = turn[i];
                    const isActor = battler.isActor();
                    
                    if (isActor) {
                        this.changeTextColor(ColorManager.textColor(4)); // Même couleur améliorée
                    } else {
                        this.changeTextColor(ColorManager.textColor(10)); // Même couleur améliorée
                    }
                    
                    let name = battler.name();
                    if (name.length > 7) {
                        name = name.substring(0, 6) + '…';
                    }
                    
                    this.drawText(name, x, y, 40);
                    x += 45;
                }
                
                if (turn.length > maxShow) {
                    this.changeTextColor(ColorManager.dimColor2());
                    this.drawText(`+${turn.length - maxShow}`, x, y, 30);
                }
                
                y += this.lineHeight() - 2;
                this.contents.paintOpacity = 255;
                this.contents.fontSize = $dataSystem.advanced.fontSize;
            }
        }
        
        simulateUpcomingTurns(numTurns) {
            const allBattlers = this.getAllAliveBattlers();
            const turns = [];
            
            for (let i = 0; i < numTurns; i++) {
                const turnBattlers = [...allBattlers].sort((a, b) => {
                    if (b.agi !== a.agi) {
                        return b.agi - a.agi;
                    }
                    return (a.actorId || a.enemyId || 0) - (b.actorId || b.enemyId || 0);
                });
                
                turns.push(turnBattlers.filter(b => b.isAlive() && b.canMove()));
            }
            
            return turns;
        }
        
        getAllAliveBattlers() {
            if (!$gameParty || !$gameTroop) return [];
            
            const party = $gameParty.battleMembers().filter(battler => 
                battler && battler.isAlive() && battler.canMove()
            );
            const troop = $gameTroop.aliveMembers().filter(battler => 
                battler && battler.canMove()
            );
            return party.concat(troop);
        }
        
        updateCurrentSubject() {
            const newSubject = BattleManager._subject;
            if (this.currentSubject !== newSubject) {
                this.currentSubject = newSubject;
                this.refresh();
            }
        }
    }
    
    // Instance globale
    let turnOrderWindow = null;
    
    // Hook pour créer la fenêtre dès le début du combat
    const _Scene_Battle_createAllWindows = Scene_Battle.prototype.createAllWindows;
    Scene_Battle.prototype.createAllWindows = function() {
        _Scene_Battle_createAllWindows.call(this);
        
        if (showTurnOrder) {
            this.createTurnOrderWindow();
        }
    };
    
    // Créer la fenêtre dès le début
    const _BattleManager_startBattle = BattleManager.startBattle;
    BattleManager.startBattle = function() {
        _BattleManager_startBattle.call(this);
        
        // Rafraîchir l'affichage après l'initialisation du combat
        if (turnOrderWindow) {
            setTimeout(() => {
                turnOrderWindow.refresh();
            }, 100);
        }
    };
    
    Scene_Battle.prototype.createTurnOrderWindow = function() {
        if (turnOrderWindow) {
            if (turnOrderWindow.parent) {
                turnOrderWindow.parent.removeChild(turnOrderWindow);
            }
        }
        
        try {
            turnOrderWindow = new Window_TurnOrderDisplay();
            this.addChild(turnOrderWindow);
        } catch (error) {
            console.error('Erreur création fenêtre ordre des tours:', error);
        }
    };
    
    // Mettre à jour l'affichage
    const _Scene_Battle_update = Scene_Battle.prototype.update;
    Scene_Battle.prototype.update = function() {
        _Scene_Battle_update.call(this);
        
        if (turnOrderWindow) {
            turnOrderWindow.updateCurrentSubject();
        }
    };
    
    // Rafraîchir quand l'ordre change
    const _BattleManager_makeActionOrders = BattleManager.makeActionOrders;
    BattleManager.makeActionOrders = function() {
        _BattleManager_makeActionOrders.call(this);
        
        if (turnOrderWindow) {
            setTimeout(() => {
                turnOrderWindow.refresh();
            }, 10);
        }
    };
    
    // Nettoyer en quittant le combat
    const _Scene_Battle_terminate = Scene_Battle.prototype.terminate;
    Scene_Battle.prototype.terminate = function() {
        if (turnOrderWindow) {
            if (turnOrderWindow.parent) {
                turnOrderWindow.parent.removeChild(turnOrderWindow);
            }
            turnOrderWindow = null;
        }
        _Scene_Battle_terminate.call(this);
    };
    
    // Rafraîchir après les actions
    const _BattleManager_endAction = BattleManager.endAction;
    BattleManager.endAction = function() {
        _BattleManager_endAction.call(this);
        
        if (turnOrderWindow) {
            setTimeout(() => {
                turnOrderWindow.refresh();
            }, 50);
        }
    };
    

})();
