/*:
 * @target MZ
 * @plugindesc [v2.0.0] Modern Slash Attack System
 * @author VotreNom
 * @version 2.0.0
 * @description Système d'attaque slash moderne avec architecture orientée événements
 */

(() => {
    'use strict';

    // =========================================================================
    // Architecture moderne basée sur des événements
    // =========================================================================

    /**
     * Gestionnaire d'événements simple mais puissant
     */
    class EventEmitter {
        constructor() {
            this.events = new Map();
        }

        on(event, callback) {
            if (!this.events.has(event)) {
                this.events.set(event, []);
            }
            this.events.get(event).push(callback);
        }

        emit(event, ...args) {
            if (this.events.has(event)) {
                this.events.get(event).forEach(callback => {
                    try {
                        callback(...args);
                    } catch (error) {
                        console.error(`Erreur dans l'événement ${event}:`, error);
                    }
                });
            }
        }

        off(event, callback) {
            if (this.events.has(event)) {
                const callbacks = this.events.get(event);
                const index = callbacks.indexOf(callback);
                if (index > -1) callbacks.splice(index, 1);
            }
        }
    }

    /**
     * Configuration centralisée avec validation
     */
    class SlashConfig {
        constructor() {
            this.settings = {
                input: {
                    key: 'pagedown',
                    cooldownMs: 800 // En millisecondes au lieu de frames
                },
                visual: {
                    image: 'WeaponAnimationTransparent',
                    scale: 0.06,
                    duration: 300, // En millisecondes
                    arcAngle: Math.PI / 2.5,
                    radius: 50
                },
                audio: {
                    attackSound: 'Slash1',
                    hitSound: 'Sword2',
                    volume: 0.7
                },
                combat: {
                    damagePercent: 10,
                    collisionRadius: 35,
                    animationId: 121
                }
            };
        }

        get(path) {
            return path.split('.').reduce((obj, key) => obj?.[key], this.settings);
        }

        set(path, value) {
            const keys = path.split('.');
            const lastKey = keys.pop();
            const target = keys.reduce((obj, key) => obj[key] = obj[key] || {}, this.settings);
            target[lastKey] = value;
        }

        validate() {
            // Validation des paramètres critiques
            const requiredPaths = [
                'input.key',
                'visual.image',
                'combat.damagePercent'
            ];
            
            for (const path of requiredPaths) {
                if (this.get(path) === undefined) {
                    throw new Error(`Configuration manquante: ${path}`);
                }
            }
        }
    }

    /**
     * Gestionnaire de ressources avec cache
     */
    class ResourceManager {
        constructor() {
            this.cache = new Map();
            this.loadingPromises = new Map();
        }

        async loadBitmap(folder, filename) {
            const key = `${folder}/${filename}`;
            
            if (this.cache.has(key)) {
                return this.cache.get(key);
            }

            if (this.loadingPromises.has(key)) {
                return this.loadingPromises.get(key);
            }

            const promise = new Promise((resolve, reject) => {
                const bitmap = ImageManager.loadBitmap(folder, filename);
                
                bitmap.addLoadListener(() => {
                    if (bitmap.isError()) {
                        reject(new Error(`Impossible de charger ${key}`));
                    } else {
                        this.cache.set(key, bitmap);
                        resolve(bitmap);
                    }
                });
            });

            this.loadingPromises.set(key, promise);
            return promise;
        }

        preloadAssets(assets) {
            return Promise.all(
                assets.map(asset => this.loadBitmap(asset.folder, asset.filename))
            );
        }
    }

    /**
     * Gestionnaire de timing moderne
     */
    class TimeManager {
        constructor() {
            this.timers = new Map();
            this.lastUpdate = Date.now();
        }

        update() {
            const now = Date.now();
            const deltaTime = now - this.lastUpdate;
            this.lastUpdate = now;

            for (const [id, timer] of this.timers) {
                timer.elapsed += deltaTime;
                
                if (timer.elapsed >= timer.duration) {
                    timer.callback();
                    this.timers.delete(id);
                }
            }
        }

        setTimeout(callback, duration, id = Symbol()) {
            this.timers.set(id, {
                callback,
                duration,
                elapsed: 0
            });
            return id;
        }

        clearTimeout(id) {
            this.timers.delete(id);
        }

        createCooldown(duration) {
            let lastTrigger = 0;
            return () => {
                const now = Date.now();
                if (now - lastTrigger >= duration) {
                    lastTrigger = now;
                    return true;
                }
                return false;
            };
        }
    }

    /**
     * Sprite d'attaque moderne avec interpolation fluide
     */
    class ModernSlashSprite extends Sprite {
        constructor(config, position, direction) {
            super();
            
            this.config = config;
            this.startTime = Date.now();
            this.duration = config.get('visual.duration');
            this.direction = direction;
            this.centerPos = position;
            this.isDestroyed = false;
            this.imageLoaded = false;
            this._collisionChecked = false; // Flag pour éviter les collisions multiples
            
            this.events = new EventEmitter();
            this.setupSprite();
        }

        setupSprite() {
            this.anchor.set(0.5, 0.5);
            this.scale.set(this.config.get('visual.scale'));
            this.setupAnimation();
            this.loadAssets(); // Charger l'image immédiatement
        }

        setupAnimation() {
            // Utiliser la même logique que votre version originale
            const rotationAngles = {
                2: { start: Math.PI - Math.PI / 4, end: Math.PI + Math.PI / 4 }, // bas
                8: { start: -Math.PI / 4, end: Math.PI / 4 }, // haut
                6: { start: Math.PI / 2 - Math.PI / 4, end: Math.PI / 2 + Math.PI / 4 }, // droite
                4: { start: -Math.PI / 2 - Math.PI / 4, end: -Math.PI / 2 + Math.PI / 4 } // gauche
            };

            const config = rotationAngles[this.direction] || rotationAngles[2];
            this.startRotation = config.start;
            this.endRotation = config.end;
        }

        loadAssets() {
            // Méthode synchrone classique RPG Maker
            this.bitmap = ImageManager.loadBitmap('img/pictures/', this.config.get('visual.image'));
            this.bitmap.addLoadListener(() => {
                if (!this.bitmap.isError()) {
                    this.imageLoaded = true;
                    this.events.emit('ready');
                    // Forcer la première mise à jour de position
                    this.updateAnimation(0);
                } else {
                    console.error('Erreur chargement sprite:', this.config.get('visual.image'));
                    this.destroy();
                }
            });
        }

        update() {
            super.update();
            
            if (this.isDestroyed || !this.imageLoaded) return;

            const elapsed = Date.now() - this.startTime;
            const progress = Math.min(elapsed / this.duration, 1);

            if (progress >= 1) {
                this.destroy();
                return;
            }

            this.updateAnimation(progress);
            
            // Vérification de collision directe comme dans votre version originale
            this.checkEnemyCollision();
        }

        updateAnimation(progress) {
            // Utiliser exactement la même logique que votre version originale
            
            // Progression de l'arc de balayage (-45° à +45°)
            const angleStart = -Math.PI / 4; // -45°
            const angleEnd = Math.PI / 4;    // +45°
            const angle = angleStart + (angleEnd - angleStart) * progress;
            
            // Offset directionnel selon la direction du joueur
            let dirOffset = 0;
            switch (this.direction) {
                case 8: // haut
                    dirOffset = -Math.PI / 2;
                    break;
                case 2: // bas
                    dirOffset = Math.PI / 2;
                    break;
                case 6: // droite
                    dirOffset = 0;
                    break;
                case 4: // gauche
                    dirOffset = Math.PI;
                    break;
                default:
                    dirOffset = 0;
            }
            
            const finalAngle = angle + dirOffset;
            const offsetRadius = this.config.get('visual.radius') + 10;
            const dx = Math.cos(finalAngle) * offsetRadius;
            const dy = Math.sin(finalAngle) * offsetRadius;
            
            this.x = this.centerPos.x + dx;
            this.y = this.centerPos.y + dy;
            
            // Ajustements Y spécifiques par direction (comme dans votre code)
            switch (this.direction) {
                case 8: // haut
                    this.y -= 10;
                    break;
                case 2: // bas
                    this.y -= 25;
                    break;
                case 4: // gauche
                    this.x += 10;
                    break;
                case 6: // droite
                    this.x -= 10;
                    break;
            }
            
            // Rotation du sprite entre startRotation et endRotation
            this.rotation = this.startRotation + (this.endRotation - this.startRotation) * progress;
            
            // Fade out progressif
            if (progress > 0.7) {
                const fadeProgress = (progress - 0.7) / 0.3;
                this.opacity = 255 * (1 - fadeProgress);
            }
        }

        easeOutQuart(t) {
            return 1 - Math.pow(1 - t, 4);
        }

        destroy() {
            if (this.isDestroyed) return;
            
            this.isDestroyed = true;
            this.events.emit('destroy');
            
            if (this.parent) {
                this.parent.removeChild(this);
            }
        }

        // Méthodes de collision (reprises de votre logique originale)
        checkEnemyCollision() {
            if (this._collisionChecked) return;

            const enemies = $gameMap.events().filter(ev => 
                this.hasEnemyTag(ev) && !ev._erased
            );
            
            for (const enemy of enemies) {
                const dx = this.x - enemy.screenX();
                const dy = this.y - enemy.screenY();
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < this.config.get('combat.collisionRadius')) {
                    this._collisionChecked = true;
                    this.onEnemyHit(enemy);
                    break;
                }
            }
        }

        hasEnemyTag(gameEvent) {
            if (!gameEvent || !gameEvent.event()) return false;
            
            const page = gameEvent.page();
            if (!page) return [];

            for (const command of page.list) {
                if (command.code === 108 || command.code === 408) {
                    const text = command.parameters[0];
                    if (text && text.match(/<Tag:\s*enemy\s*>/i)) {
                        return true;
                    }
                }
            }
            return false;
        }

        getTroopIdFromEvent(gameEvent) {
            if (!gameEvent || !gameEvent.event()) return null;
            
            const page = gameEvent.page();
            if (!page) return null;

            for (const command of page.list) {
                if (command.code === 108 || command.code === 408) {
                    const text = command.parameters[0];
                    const match = text && text.match(/<TroopId:\s*(\d+)\s*>/i);
                    if (match) {
                        return Number(match[1]);
                    }
                }
            }
            return null;
        }

        onEnemyHit(enemy) {
            const troopId = this.getTroopIdFromEvent(enemy);
            
            if (troopId === null) {
                console.warn(`Aucun <TroopId: X> trouvé dans l'événement ${enemy.event().name}`);
                return;
            }

            console.log(`Ennemi touché : ${enemy.event().name}, TroopId: ${troopId}`);

            if (!$gameParty.inBattle()) {
                // Marquer qu'un slash a touché pour appliquer les dégâts
                $gameTemp._slashAdvantage = this.config.get('combat.damagePercent');
                
                // Son de frappe
                AudioManager.playSe({
                    name: 'Sword2',
                    volume: 80,
                    pitch: 120,
                    pan: 0
                });
                
                // Supprimer l'événement
                this.eraseEventFully(enemy);
                
                // Lancer le combat
                BattleManager.setup(troopId, false, false);
                SceneManager.push(Scene_Battle);
            }

            this.destroy();
        }

        eraseEventFully(event) {
            if (!event) return;
            
            const eventId = event.eventId();
            const mapId = $gameMap.mapId();

            $gameMap.eraseEvent(eventId);
            ['A', 'B', 'C', 'D'].forEach(letter => {
                $gameSelfSwitches.setValue([mapId, eventId, letter], false);
            });

            console.log(`Événement ${event.event().name} (ID ${eventId}) effacé complètement.`);
        }
    }

    /**
     * Système de collision avec spatial partitioning
     */
    class CollisionSystem {
        constructor(config) {
            this.config = config;
            this.activeSprites = new Set();
            this.events = new EventEmitter();
        }

        registerSprite(sprite) {
            this.activeSprites.add(sprite);
            
            sprite.events.on('update', ({ sprite }) => {
                this.checkCollisions(sprite);
            });
            
            sprite.events.on('destroy', () => {
                this.activeSprites.delete(sprite);
            });
        }

        checkCollisions(sprite) {
            const spriteBounds = sprite.getBounds();
            const enemies = this.getEnemyEvents();
            
            for (const enemy of enemies) {
                if (this.isColliding(spriteBounds, enemy)) {
                    this.events.emit('collision', { sprite, enemy });
                    break;
                }
            }
        }

        isColliding(bounds, enemy) {
            const enemyX = enemy.screenX();
            const enemyY = enemy.screenY();
            
            const dx = bounds.centerX - enemyX;
            const dy = bounds.centerY - enemyY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            return distance < bounds.radius;
        }

        getEnemyEvents() {
            return $gameMap.events().filter(event => {
                return this.hasTag(event, 'enemy') && !event._erased;
            });
        }

        hasTag(event, tag) {
            const page = event.page();
            if (!page) return false;
            
            return page.list.some(command => {
                if (command.code === 108 || command.code === 408) {
                    return command.parameters[0]?.includes(`<${tag}>`);
                }
                return false;
            });
        }

        getTroopId(event) {
            const page = event.page();
            if (!page) return null;
            
            for (const command of page.list) {
                if (command.code === 108 || command.code === 408) {
                    const match = command.parameters[0]?.match(/<troopId:\s*(\d+)>/i);
                    if (match) return Number(match[1]);
                }
            }
            return null;
        }
    }

    /**
     * Système principal orchestrant tout
     */
    class SlashAttackSystem {
        constructor() {
            this.config = new SlashConfig();
            this.timeManager = new TimeManager();
            this.collisionSystem = new CollisionSystem(this.config);
            this.events = new EventEmitter();
            
            this.canAttack = this.timeManager.createCooldown(
                this.config.get('input.cooldownMs')
            );
            
            this.setupEventHandlers();
            this.preloadAssets();
        }

        async preloadAssets() {
            try {
                await ResourceManager.preloadAssets([
                    { folder: 'img/pictures/', filename: this.config.get('visual.image') }
                ]);
                console.log('Assets slash system chargés');
            } catch (error) {
                console.error('Erreur preload assets:', error);
            }
        }

        setupEventHandlers() {
            this.collisionSystem.events.on('collision', ({ sprite, enemy }) => {
                this.handleEnemyHit(sprite, enemy);
            });
        }

        update() {
            this.timeManager.update();
        }

        attemptAttack() {
            if (!this.canPerformAttack()) return false;
            if (!this.canAttack()) return false;

            return this.executeAttack();
        }

        canPerformAttack() {
            return (
                $gamePlayer.canMove() &&
                !$gameMessage.isBusy() &&
                !$gameMap.isEventRunning() &&
                !$gameParty.inBattle() &&
                SceneManager._scene?._spriteset
            );
        }

        executeAttack() {
            try {
                const sprite = new ModernSlashSprite(
                    this.config,
                    { x: $gamePlayer.screenX(), y: $gamePlayer.screenY() },
                    $gamePlayer.direction()
                );

                SceneManager._scene._spriteset.addChild(sprite);

                // Audio avec meilleur contrôle
                this.playSound('attackSound');
                
                this.events.emit('attackExecuted', { sprite });
                return true;

            } catch (error) {
                console.error('Erreur exécution attaque:', error);
                return false;
            }
        }

        handleEnemyHit(sprite, enemy) {
            const troopId = this.collisionSystem.getTroopId(enemy);
            if (!troopId) return;

            this.playSound('hitSound');
            this.eraseEnemy(enemy);
            this.initiateBattle(troupId);
            
            sprite.destroy();
        }

        playSound(soundType) {
            const soundName = this.config.get(`audio.${soundType}`);
            const volume = this.config.get('audio.volume');
            
            if (soundName) {
                AudioManager.playSe({
                    name: soundName,
                    volume: Math.floor(volume * 100),
                    pitch: 100,
                    pan: 0
                });
            }
        }

        eraseEnemy(enemy) {
            const eventId = enemy.eventId();
            const mapId = $gameMap.mapId();

            $gameMap.eraseEvent(eventId);
            ['A', 'B', 'C', 'D'].forEach(letter => {
                $gameSelfSwitches.setValue([mapId, eventId, letter], false);
            });
        }

        initiateBattle(troopId) {
            $gameTemp._slashAdvantage = this.config.get('combat.damagePercent');
            BattleManager.setup(troopId, false, false);
            SceneManager.push(Scene_Battle);
        }
    }

    // =========================================================================
    // Initialisation et intégration globale
    // =========================================================================

    const slashSystem = new SlashAttackSystem();
    window.SlashSystem = slashSystem;

    // Intégration Scene_Map moderne
    const _Scene_Map_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function() {
        _Scene_Map_update.call(this);
        
        slashSystem.update();
        
        if (Input.isTriggered(slashSystem.config.get('input.key'))) {
            slashSystem.attemptAttack();
        }
    };

    // Système de combat avec avantage
    const _Scene_Battle_start = Scene_Battle.prototype.start;
    Scene_Battle.prototype.start = function() {
        _Scene_Battle_start.call(this);

        if ($gameTemp._slashAdvantage) {
            const damagePercent = $gameTemp._slashAdvantage;
            
            $gameTroop.members().forEach(enemy => {
                if (enemy.isAlive()) {
                    const damage = Math.floor(enemy.mhp * damagePercent / 100);
                    enemy.gainHp(-damage);
                    enemy.startDamagePopup();
                }
            });
            
            $gameTemp._slashAdvantage = null;
        }
    };

})();
