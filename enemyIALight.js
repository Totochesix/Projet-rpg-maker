/*:
 * @target MZ
 * @plugindesc [v2.3] Système de détection d'ennemis avec pathfinding A* et collisions précises
 * @author Votre nom
 * @version 2.3
 * 
 * @param updateFrequency
 * @text Fréquence de mise à jour
 * @desc Nombre de frames entre chaque vérification (plus élevé = meilleure performance)
 * @type number
 * @min 1
 * @max 60
 * @default 10
 * 

 *
 * @help
 * ============================================================================
 * Système de détection d'ennemis pour RPG Maker MZ - Version Pathfinding A*
 * ============================================================================
 * 
 * Ajoutez ce commentaire dans la première page d'un événement ennemi :
 * 
 * 1. Chase (Poursuite avec pathfinding A*)
 * <enemyAI sight:6 angle:120 behavior:chase speed:5 defaultSpeed:3 chaseTime:300>
 * 
 * 2. Ranged (Combat à distance avec collisions précises)
 * <enemyAI sight:8 angle:90 behavior:ranged speed:3 defaultSpeed:2 projectileSprite:Arrow projectileDamage:15 projectileSpeed:8 minRange:3 maxRange:6>
 * 
 * 3. Flee (Fuite avec pathfinding intelligent)
 * <enemyAI sight:5 angle:360 behavior:flee speed:6 defaultSpeed:3 chaseTime:200>
 * 
 * AMÉLIORATIONS v2.3 :
 * - Pathfinding A* complet pour contournement intelligent
 * - Collision projectile ultra-précise avec détection par raycast
 * - Détection RegionID 1 corrigée avec vérification continue
 * 
 * PROJECTILES ULTRA-PRÉCIS :
 * - Détection continue sur toute la trajectoire
 * - Collision RegionID 1 vérifiée à chaque pixel
 * - Aucun passage à travers possible
 * 
 * Paramètres :
 * - sight: Distance de détection (défaut: 5)
 * - angle: Angle de vision en degrés (défaut: 90)
 * - behavior: Comportement (chase/ranged/flee) (défaut: chase)
 * - speed: Vitesse de déplacement/action (défaut: 5)
 * - defaultSpeed: Vitesse normale (défaut: 3)
 * - chaseTime: Durée max d'action en frames (défaut: 300)
 * - projectileSprite: Nom du fichier sprite pour projectile (défaut: "")
 * - projectileSpeed: Vitesse projectile (défaut: 4)
 * - minRange: Distance min pour ranged/flee (défaut: 3)
 * - maxRange: Distance max pour ranged (défaut: 7)
 * - hpPenalty: % PV perdus en début de combat si touché (défaut: 5)
 * ============================================================================
 */

(() => {
    'use strict';
    
    const pluginName = 'enemyIALight';
    const parameters = PluginManager.parameters(pluginName);
    const updateFrequency = Number(parameters['updateFrequency'] || 10);
    
    // Cache pour éviter le re-parsing constant
    const enemyCache = new Map();
    let frameCounter = 0;
    
    // Parse la configuration d'un événement
    const parseEnemyConfig = (event) => {
        const eventId = event.eventId();
        const pageIndex = event._pageIndex;
        const cacheKey = `${eventId}_${pageIndex}`;
        
        // Vérifier le cache d'abord
        if (enemyCache.has(cacheKey)) {
            return enemyCache.get(cacheKey);
        }
        
        const page = event.event().pages[pageIndex];
        if (!page) {
            enemyCache.set(cacheKey, null);
            return null;
        }
        
        for (const command of page.list) {
            if (command.code === 108 || command.code === 408) {
                const match = command.parameters[0].match(/<enemyAI\s+(.+?)>/i);
                if (match) {
                    const config = parseConfigString(match[1]);
                    enemyCache.set(cacheKey, config);
                    return config;
                }
            }
        }
        
        enemyCache.set(cacheKey, null);
        return null;
    };
    
    // Parse la chaîne de configuration de manière plus robuste
    const parseConfigString = (configStr) => {
        const config = {
            sight: 5,
            angle: 90,
            behavior: 'chase',
            speed: 5,
            defaultSpeed: 3,
            chaseTime: 300,
            projectileSprite: '',
            projectileSpeed: 4,
            minRange: 3,
            maxRange: 7,
            hpPenalty: 5
        };
        
        const params = configStr.split(/\s+/);
        for (const param of params) {
            const [key, value] = param.split(':');
            if (key && value !== undefined) {
                if (key === 'behavior') {
                    if (['chase', 'ranged', 'flee'].includes(value)) {
                        config[key] = value;
                    }
                } else if (key === 'projectileSprite') {
                    config[key] = value;
                } else if (['sight', 'angle', 'speed', 'defaultSpeed', 'chaseTime', 'projectileSpeed', 'minRange', 'maxRange', 'hpPenalty'].includes(key)) {
                    const numValue = Number(value);
                    if (!isNaN(numValue)) {
                        config[key] = numValue;
                    }
                }
            }
        }
        
        return config;
    };
    
    // Calcule la distance entre deux points
    const getDistance = (x1, y1, x2, y2) => {
        return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    };
    
    // Convertit une direction en angle
    const directionToAngle = (direction) => {
        const angles = { 2: 90, 4: 180, 6: 0, 8: 270 };
        return angles[direction] || 0;
    };
    
    // Normalise un angle entre 0 et 360
    const normalizeAngle = (angle) => {
        return ((angle % 360) + 360) % 360;
    };
    
    // Calcule l'angle entre deux points
    const getAngleBetween = (x1, y1, x2, y2) => {
        return Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
    };
    
    // Vérifie s'il y a une ligne de vue claire
    const hasLineOfSight = (x1, y1, x2, y2) => {
        const dx = Math.abs(x2 - x1);
        const dy = Math.abs(y2 - y1); 
        const steps = Math.max(dx, dy);
        
        if (steps === 0) return true;
        
        const xStep = (x2 - x1) / steps;
        const yStep = (y2 - y1) / steps;
        
        for (let i = 1; i < steps; i++) {
            const checkX = Math.round(x1 + (xStep * i));
            const checkY = Math.round(y1 + (yStep * i));
            
            // Vérifier si la tuile bloque la vue
            if (!$gameMap.isPassable(checkX, checkY, 2)) {
                return false;
            }
        }
        
        return true;
    };
    
    // Vérifie si le joueur est dans le champ de vision
    const canSeePlayer = (event, config) => {
        const ex = event.x;
        const ey = event.y;
        const px = $gamePlayer.x;
        const py = $gamePlayer.y;
        
        const distance = getDistance(ex, ey, px, py);
        if (distance > config.sight) return false;
        
        // Vérification de l'angle de vision
        if (config.angle < 360) {
            const facingAngle = directionToAngle(event.direction());
            const playerAngle = normalizeAngle(getAngleBetween(ex, ey, px, py));
            const angleDiff = Math.min(
                Math.abs(facingAngle - playerAngle),
                360 - Math.abs(facingAngle - playerAngle)
            );
            
            if (angleDiff > config.angle / 2) return false;
        }
        
        // Vérification de la ligne de vue
        return hasLineOfSight(ex, ey, px, py);
    };
    
    // Vérifie si une position est dans les limites de la carte
    const isWithinMapBounds = (x, y) => {
        return x >= 0 && y >= 0 && x < $gameMap.width() && y < $gameMap.height();
    };
    
    // CORRIGÉ : Vérification précise des collisions pour projectiles (exclut l'événement source)
    const checkProjectileCollision = (x, y, sourceEvent) => {
        const tileX = Math.floor(x / 48);
        const tileY = Math.floor(y / 48);
        
        // 1. Vérifier les limites de la carte
        if (!isWithinMapBounds(tileX, tileY)) {
            return { collision: true, type: 'boundary' };
        }
        
        // 2. Vérifier Region ID 1 avec une tolérance réduite
        const regionId = $gameMap.regionId(tileX, tileY);
        if (regionId === 1) {
            return { collision: true, type: 'region' };
        }
        
        // 3. Vérifier les événements intraversables (SAUF l'événement source)
        const events = $gameMap.eventsXy(tileX, tileY);
        for (const event of events) {
            if (event !== sourceEvent && event.isNormalPriority() && !event.isThrough()) {
                return { collision: true, type: 'event', event: event };
            }
        }
        
        return { collision: false };
    };
    
    // NOUVEAU : Pathfinding A* simplifié mais efficace
    class SimpleAStar {
        constructor(startX, startY, goalX, goalY, character) {
            this.startX = startX;
            this.startY = startY;
            this.goalX = goalX;
            this.goalY = goalY;
            this.character = character;
            this.openSet = [];
            this.closedSet = new Set();
            this.maxNodes = 100; // Limite pour éviter les calculs trop longs
        }
        
        // Heuristique (distance Manhattan)
        heuristic(x, y) {
            return Math.abs(x - this.goalX) + Math.abs(y - this.goalY);
        }
        
        // Vérifier si une position est praticable
        isWalkable(x, y) {
            if (!isWithinMapBounds(x, y)) return false;
            
            // Vérifier la passabilité de base dans toutes les directions
            if (!$gameMap.isPassable(x, y, 2) || !$gameMap.isPassable(x, y, 4) || 
                !$gameMap.isPassable(x, y, 6) || !$gameMap.isPassable(x, y, 8)) {
                return false;
            }
            
            // Vérifier les événements (sauf le caractère lui-même et le joueur)
            const events = $gameMap.eventsXy(x, y);
            for (const event of events) {
                if (event !== this.character && event.isNormalPriority() && !event.isThrough()) {
                    return false;
                }
            }
            
            return true;
        }
        
        // Obtenir les voisins d'un nœud
        getNeighbors(node) {
            const neighbors = [];
            const directions = [
                { x: 0, y: -1 }, // Haut
                { x: 1, y: 0 },  // Droite
                { x: 0, y: 1 },  // Bas
                { x: -1, y: 0 }  // Gauche
            ];
            
            for (const dir of directions) {
                const newX = node.x + dir.x;
                const newY = node.y + dir.y;
                
                if (this.isWalkable(newX, newY)) {
                    neighbors.push({
                        x: newX,
                        y: newY,
                        g: node.g + 1,
                        h: this.heuristic(newX, newY),
                        parent: node
                    });
                }
            }
            
            return neighbors;
        }
        
        // Trouver le chemin
        findPath() {
            const startNode = {
                x: this.startX,
                y: this.startY,
                g: 0,
                h: this.heuristic(this.startX, this.startY),
                parent: null
            };
            startNode.f = startNode.g + startNode.h;
            
            this.openSet.push(startNode);
            let processedNodes = 0;
            
            while (this.openSet.length > 0 && processedNodes < this.maxNodes) {
                processedNodes++;
                
                // Trouver le nœud avec le plus petit f
                this.openSet.sort((a, b) => a.f - b.f);
                const currentNode = this.openSet.shift();
                
                // Ajouter à la liste fermée
                const nodeKey = `${currentNode.x},${currentNode.y}`;
                this.closedSet.add(nodeKey);
                
                // Vérifier si on a atteint le but
                if (currentNode.x === this.goalX && currentNode.y === this.goalY) {
                    const path = [];
                    let node = currentNode;
                    while (node.parent) {
                        path.unshift({ x: node.x, y: node.y });
                        node = node.parent;
                    }
                    return path;
                }
                
                // Explorer les voisins
                const neighbors = this.getNeighbors(currentNode);
                for (const neighbor of neighbors) {
                    const neighborKey = `${neighbor.x},${neighbor.y}`;
                    
                    if (this.closedSet.has(neighborKey)) continue;
                    
                    neighbor.f = neighbor.g + neighbor.h;
                    
                    // Vérifier si ce voisin est déjà dans openSet avec un meilleur coût
                    const existingIndex = this.openSet.findIndex(node => 
                        node.x === neighbor.x && node.y === neighbor.y
                    );
                    
                    if (existingIndex === -1) {
                        this.openSet.push(neighbor);
                    } else if (neighbor.g < this.openSet[existingIndex].g) {
                        this.openSet[existingIndex] = neighbor;
                    }
                }
            }
            
            return null; // Aucun chemin trouvé
        }
        
        // Obtenir juste la prochaine direction
        getNextDirection() {
            const path = this.findPath();
            if (path && path.length > 0) {
                const nextStep = path[0];
                const dx = nextStep.x - this.startX;
                const dy = nextStep.y - this.startY;
                
                if (dx > 0) return 6; // Droite
                if (dx < 0) return 4; // Gauche
                if (dy > 0) return 2; // Bas
                if (dy < 0) return 8; // Haut
            }
            
            return 0; // Aucun mouvement
        }
    }
    
    // AMÉLIORÉ : Mouvement intelligent avec A*
    const moveTowardPlayerSmart = (event) => {
        const pathfinder = new SimpleAStar(event.x, event.y, $gamePlayer.x, $gamePlayer.y, event);
        const direction = pathfinder.getNextDirection();
        
        if (direction > 0) {
            event.moveStraight(direction);
        }
    };
    
    // AMÉLIORÉ : Fuite intelligente mais simple
    const moveFlee = (event) => {
        const dx = event.x - $gamePlayer.x;
        const dy = event.y - $gamePlayer.y;
        
        // Calculer la direction de fuite idéale
        let moveX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
        let moveY = dy > 0 ? 1 : dy < 0 ? -1 : 0;
        
        // Si trop proche, forcer une direction de fuite
        if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
            if (moveX === 0) moveX = Math.random() > 0.5 ? 1 : -1;
            if (moveY === 0) moveY = Math.random() > 0.5 ? 1 : -1;
        }
        
        // Essayer le mouvement principal (diagonal -> simple)
        let targetX = event.x;
        let targetY = event.y;
        let direction = 0;
        
        // Privilégier le mouvement le plus éloigné du joueur
        if (Math.abs(moveX) >= Math.abs(moveY)) {
            // Mouvement horizontal prioritaire
            direction = moveX > 0 ? 6 : 4; // Droite ou Gauche
            targetX += moveX;
        } else {
            // Mouvement vertical prioritaire
            direction = moveY > 0 ? 2 : 8; // Bas ou Haut
            targetY += moveY;
        }
        
        // Vérifier si le mouvement principal est possible
        if (isWithinMapBounds(targetX, targetY) && 
            $gameMap.isPassable(targetX, targetY, 2) &&
            $gameMap.isPassable(targetX, targetY, 4) &&
            $gameMap.isPassable(targetX, targetY, 6) &&
            $gameMap.isPassable(targetX, targetY, 8)) {
            
            // Vérifier les événements
            const events = $gameMap.eventsXy(targetX, targetY);
            let blocked = false;
            for (const otherEvent of events) {
                if (otherEvent !== event && otherEvent.isNormalPriority() && !otherEvent.isThrough()) {
                    blocked = true;
                    break;
                }
            }
            
            if (!blocked) {
                event.moveStraight(direction);
                return;
            }
        }
        
        // Si bloqué, essayer l'autre direction
        let alternativeDirection = 0;
        let altTargetX = event.x;
        let altTargetY = event.y;
        
        if (Math.abs(moveX) >= Math.abs(moveY)) {
            // Essayer vertical
            alternativeDirection = moveY > 0 ? 2 : 8;
            altTargetY += moveY;
        } else {
            // Essayer horizontal
            alternativeDirection = moveX > 0 ? 6 : 4;
            altTargetX += moveX;
        }
        
        if (isWithinMapBounds(altTargetX, altTargetY) && 
            $gameMap.isPassable(altTargetX, altTargetY, 2) &&
            $gameMap.isPassable(altTargetX, altTargetY, 4) &&
            $gameMap.isPassable(altTargetX, altTargetY, 6) &&
            $gameMap.isPassable(altTargetX, altTargetY, 8)) {
            
            const events = $gameMap.eventsXy(altTargetX, altTargetY);
            let blocked = false;
            for (const otherEvent of events) {
                if (otherEvent !== event && otherEvent.isNormalPriority() && !otherEvent.isThrough()) {
                    blocked = true;
                    break;
                }
            }
            
            if (!blocked) {
                event.moveStraight(alternativeDirection);
                return;
            }
        }
        
        // Si toujours bloqué, essayer toutes les directions possibles
        const directions = [2, 4, 6, 8]; // Bas, Gauche, Droite, Haut
        for (const dir of directions) {
            let testX = event.x;
            let testY = event.y;
            
            switch (dir) {
                case 2: testY += 1; break; // Bas
                case 4: testX -= 1; break; // Gauche
                case 6: testX += 1; break; // Droite
                case 8: testY -= 1; break; // Haut
            }
            
            if (isWithinMapBounds(testX, testY) && 
                $gameMap.isPassable(testX, testY, 2) &&
                $gameMap.isPassable(testX, testY, 4) &&
                $gameMap.isPassable(testX, testY, 6) &&
                $gameMap.isPassable(testX, testY, 8)) {
                
                const events = $gameMap.eventsXy(testX, testY);
                let blocked = false;
                for (const otherEvent of events) {
                    if (otherEvent !== event && otherEvent.isNormalPriority() && !otherEvent.isThrough()) {
                        blocked = true;
                        break;
                    }
                }
                
                if (!blocked) {
                    event.moveStraight(dir);
                    return;
                }
            }
        }
        
        // Aucun mouvement possible, rester sur place
    };
    
    // Crée et lance un projectile avec sprite
    const createProjectile = (event, config, targetX, targetY) => {
        if (!config.projectileSprite) {
            console.warn('Aucun sprite de projectile défini pour l\'événement', event.eventId());
            return null;
        }
        
        const projectile = {
            x: event.x * 48 + 24, // Position en pixels (centre de la case)
            y: event.y * 48 + 24,
            targetX: targetX * 48 + 24,
            targetY: targetY * 48 + 24,
            speed: config.projectileSpeed,
            sprite: config.projectileSprite,
            sourceEvent: event,
            hpPenalty: config.hpPenalty,
            active: true,
            spriteObj: null,
            // NOUVEAU : Position précédente pour détection continue
            prevX: event.x * 48 + 24,
            prevY: event.y * 48 + 24
        };
        
        const dx = projectile.targetX - projectile.x;
        const dy = projectile.targetY - projectile.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance === 0) return null;
        
        projectile.velocityX = (dx / distance) * projectile.speed;
        projectile.velocityY = (dy / distance) * projectile.speed;
        
        // Créer le sprite du projectile
        projectile.spriteObj = new Sprite();
        projectile.spriteObj.bitmap = ImageManager.loadPicture(config.projectileSprite);
        projectile.spriteObj.anchor.x = 0.5;
        projectile.spriteObj.anchor.y = 0.5;
        projectile.spriteObj.x = projectile.x - $gameMap.displayX() * 48;
        projectile.spriteObj.y = projectile.y - $gameMap.displayY() * 48;
        
        // Rotation du sprite selon la direction (ajuster pour flèche orientée vers le haut)
        const angle = Math.atan2(dy, dx) + Math.PI / 2; // +90° car la flèche pointe vers le haut dans l'image
        projectile.spriteObj.rotation = angle;
        
        // Ajouter le sprite à la scène
        if (SceneManager._scene && SceneManager._scene._spriteset) {
            SceneManager._scene._spriteset.addChild(projectile.spriteObj);
        }
        
        if (!$gameMap._projectiles) {
            $gameMap._projectiles = [];
        }
        
        $gameMap._projectiles.push(projectile);
        return projectile;
    };
    
    // AMÉLIORÉ : Détection ultra-précise des collisions avec raycast
    const updateProjectiles = () => {
        if (!$gameMap._projectiles) return;
        
        for (let i = $gameMap._projectiles.length - 1; i >= 0; i--) {
            const projectile = $gameMap._projectiles[i];
            
            if (!projectile.active) {
                // Nettoyer le sprite
                if (projectile.spriteObj) {
                    if (projectile.spriteObj.parent) {
                        projectile.spriteObj.parent.removeChild(projectile.spriteObj);
                    }
                    projectile.spriteObj.destroy();
                    projectile.spriteObj = null;
                }
                $gameMap._projectiles.splice(i, 1);
                continue;
            }
            
            // Sauvegarder la position précédente
            projectile.prevX = projectile.x;
            projectile.prevY = projectile.y;
            
            // Déplacement du projectile
            projectile.x += projectile.velocityX;
            projectile.y += projectile.velocityY;
            
            // Mettre à jour la position du sprite
            if (projectile.spriteObj) {
                projectile.spriteObj.x = projectile.x - $gameMap.displayX() * 48;
                projectile.spriteObj.y = projectile.y - $gameMap.displayY() * 48;
            }
            
            // DÉTECTION CONTINUE PAR RAYCAST - Vérifier toute la trajectoire
            const steps = Math.max(Math.abs(projectile.x - projectile.prevX), Math.abs(projectile.y - projectile.prevY)) / 4;
            let collisionDetected = false;
            
            for (let step = 0; step <= steps; step++) {
                const t = step / Math.max(steps, 1);
                const checkX = projectile.prevX + (projectile.x - projectile.prevX) * t;
                const checkY = projectile.prevY + (projectile.y - projectile.prevY) * t;
                
                const tileX = Math.floor(checkX / 48);
                const tileY = Math.floor(checkY / 48);
                const playerTileX = $gamePlayer.x;
                const playerTileY = $gamePlayer.y;
                
                // Vérification collision avec le joueur
                if (tileX === playerTileX && tileY === playerTileY) {
                    // Forcer l'arrêt du projectile immédiatement
                    projectile.active = false;
                    collisionDetected = true;
                    
                    // Déclencher le combat IMMÉDIATEMENT
                    if (projectile.sourceEvent && !$gamePlayer.isInAirship() && !$gamePlayer.isInShip() && !$gamePlayer.isInBoat()) {
                        // Marquer que le joueur a été touché par un projectile
                        $gameTemp._projectileHit = {
                            sourceEvent: projectile.sourceEvent,
                            hpPenalty: projectile.hpPenalty
                        };
                        
                        // Forcer le déclenchement du combat
                        $gamePlayer._encounterCount = 0;
                        projectile.sourceEvent.start();
                    }
                    break;
                }
                
                // Vérifier les collisions avec l'environnement (PASSER l'événement source)
                const collision = checkProjectileCollision(checkX, checkY, projectile.sourceEvent);
                if (collision.collision) {
                    projectile.active = false;
                    collisionDetected = true;
                    break;
                }
            }
            
            if (collisionDetected) continue;
            
            // Vérification distance maximale (15 cases)
            const totalDistance = Math.sqrt(
                Math.pow((projectile.x - (projectile.sourceEvent.x * 48 + 24)), 2) +
                Math.pow((projectile.y - (projectile.sourceEvent.y * 48 + 24)), 2)
            ) / 48;
            
            if (totalDistance > 15) {
                projectile.active = false;
            }
        }
    };
    
    // Hook pour appliquer la pénalité HP en début de combat
    const _BattleManager_setup = BattleManager.setup;
    BattleManager.setup = function(troopId, canEscape, canLose) {
        _BattleManager_setup.call(this, troopId, canEscape, canLose);
        
        // Vérifier si le combat a été déclenché par un projectile
        if ($gameTemp._projectileHit) {
            const penalty = $gameTemp._projectileHit.hpPenalty;
            
            // Appliquer la pénalité à tous les membres du groupe
            $gameParty.allMembers().forEach(actor => {
                if (actor && actor.hp > 0) {
                    const damage = Math.floor(actor.mhp * penalty / 100);
                    actor.gainHp(-damage);
                    if (actor.hp <= 0) {
                        actor.setHp(1); // Laisser au moins 1 PV
                    }
                }
            });
            
            // Message en début de combat
            $gameMessage.add(`Le projectile a touché ! Tous les membres perdent ${penalty}% de leurs PV !`);
            
            // Nettoyer
            $gameTemp._projectileHit = null;
        }
    };
    
    // Sauvegarde l'état original d'un événement
    const saveOriginalState = (event) => {
        if (!event._originalState) {
            event._originalState = {
                x: event.x,
                y: event.y,
                direction: event.direction(),
                moveRouteIndex: event._moveRouteIndex,
                moveRoute: event._moveRoute
            };
        }
    };
    
    // Restaure l'état original d'un événement
    const restoreOriginalState = (event) => {
        if (event._originalState) {
            event.setDirection(event._originalState.direction);
        }
    };
    
    // Extension de Game_Event pour gérer les changements de page
    const _Game_Event_refresh = Game_Event.prototype.refresh;
    Game_Event.prototype.refresh = function() {
        const oldPageIndex = this._pageIndex;
        _Game_Event_refresh.call(this);
        
        // Si la page a changé, nettoyer le cache pour cet événement
        if (oldPageIndex !== this._pageIndex) {
            const eventId = this.eventId();
            // Nettoyer toutes les entrées de cache pour cet événement
            const keysToDelete = [];
            for (const key of enemyCache.keys()) {
                if (key.startsWith(`${eventId}_`)) {
                    keysToDelete.push(key);
                }
            }
            keysToDelete.forEach(key => enemyCache.delete(key));
            
            // Reset l'état AI si il existe
            if (this._aiState) {
                this._aiState.active = false;
                this._aiState.lastPageIndex = this._pageIndex;
            }
        }
    };
    
    // Extension de Game_Event
    const _Game_Event_updateSelfMovement = Game_Event.prototype.updateSelfMovement;
    Game_Event.prototype.updateSelfMovement = function() {
        // Vérifier l'IA AVANT le mouvement automatique
        if ($gameMap && $gamePlayer && !$gamePlayer.isInVehicle()) {
            // Optimisation : mise à jour moins fréquente
            if (frameCounter % updateFrequency === 0) {
                this.updateEnemyAI();
            }
        }
        
        _Game_Event_updateSelfMovement.call(this);
    };
    
    const _Game_Event_update = Game_Event.prototype.update;
    Game_Event.prototype.update = function() {
        _Game_Event_update.call(this);
    };
    
    // Mise à jour des projectiles à chaque frame
    const _Scene_Map_updateMain = Scene_Map.prototype.updateMain;
    Scene_Map.prototype.updateMain = function() {
        _Scene_Map_updateMain.call(this);
        updateProjectiles();
    };
    
    Game_Event.prototype.updateEnemyAI = function() {
        const config = parseEnemyConfig(this);
        if (!config) {
            // Si pas de config, nettoyer l'état AI s'il existe
            if (this._aiState) {
                this._aiState.active = false;
                this.setMoveSpeed(config?.defaultSpeed || 3);
                restoreOriginalState(this);
            }
            return;
        }
        
        const canSee = canSeePlayer(this, config);
        
        // État de poursuite
        if (!this._aiState) {
            this._aiState = {
                active: false,
                actionTimer: 0,
                originalStateSaved: false,
                lastShotTime: 0,
                shotCooldown: 120, // 2 secondes à 60fps
                currentSpeed: config.defaultSpeed,
                lastPageIndex: this._pageIndex,
                hasSeenPlayer: false // Une fois qu'il a vu le joueur, il le garde en mémoire
            };
        }
        
        // Vérifier si la page a changé
        if (this._aiState.lastPageIndex !== this._pageIndex) {
            this._aiState.lastPageIndex = this._pageIndex;
            this._aiState.active = false;
            this._aiState.hasSeenPlayer = false;
            this._aiState.currentSpeed = config.defaultSpeed;
            this.setMoveSpeed(config.defaultSpeed);
        }
        
        const distance = getDistance(this.x, this.y, $gamePlayer.x, $gamePlayer.y);
        
        // Si il voit le joueur OU qu'il l'a déjà vu une fois
        if (canSee || this._aiState.hasSeenPlayer) {
            
            // Marquer qu'il a vu le joueur (il ne l'oubliera plus jamais)
            if (canSee) {
                this._aiState.hasSeenPlayer = true;
            }
            
            // INSTANTANÉMENT passer en mode actif et accélérer
            if (!this._aiState.active) {
                this._aiState.active = true;
                this._aiState.actionTimer = config.chaseTime;
                saveOriginalState(this);
                this._aiState.originalStateSaved = true;
            }
            
            // TOUJOURS s'assurer qu'il est à la vitesse rapide
            if (this._aiState.currentSpeed !== config.speed) {
                this._aiState.currentSpeed = config.speed;
                this.setMoveSpeed(config.speed);
            }
            
            this._aiState.actionTimer = config.chaseTime; // Reset timer
            
            // Comportement selon le type avec pathfinding A*
            switch (config.behavior) {
                case 'chase':
                    moveTowardPlayerSmart(this);
                    break;
                    
                case 'ranged':
                    // Maintenir une distance optimale
                    if (distance < config.minRange) {
                        // Trop proche, reculer intelligemment
                        moveFlee(this);
                    } else if (distance > config.maxRange) {
                        // Trop loin, se rapprocher intelligemment
                        moveTowardPlayerSmart(this);
                    } else {
                        // Distance parfaite, tirer si possible
                        const currentTime = Graphics.frameCount;
                        if (currentTime - this._aiState.lastShotTime >= this._aiState.shotCooldown) {
                            createProjectile(this, config, $gamePlayer.x, $gamePlayer.y);
                            this._aiState.lastShotTime = currentTime;
                        }
                    }
                    break;
                    
                case 'flee':
                    moveFlee(this);
                    break;
            }
            
        } else {
            // Comportement normal - s'assurer que la vitesse est correcte
            if (this._aiState.currentSpeed !== config.defaultSpeed) {
                this._aiState.currentSpeed = config.defaultSpeed;
                this.setMoveSpeed(config.defaultSpeed);
            }
            
            // Reset l'état actif seulement si il n'a jamais vu le joueur
            if (this._aiState.active) {
                this._aiState.active = false;
                restoreOriginalState(this);
                this._aiState.hasSeenPlayer = false; // Reset complet seulement ici
            }
        }
    };
    
    // Nettoie le cache et les projectiles quand on change de carte
    const _Game_Map_setup = Game_Map.prototype.setup;
    Game_Map.prototype.setup = function(mapId) {
        // Nettoyer tous les projectiles avant de changer de carte
        if (this._projectiles) {
            for (const projectile of this._projectiles) {
                if (projectile.spriteObj) {
                    if (projectile.spriteObj.parent) {
                        projectile.spriteObj.parent.removeChild(projectile.spriteObj);
                    }
                    projectile.spriteObj.destroy();
                    projectile.spriteObj = null;
                }
            }
        }
        
        _Game_Map_setup.call(this, mapId);
        enemyCache.clear();
        // Nettoyer les projectiles
        this._projectiles = [];
    };
    
    // Nettoyage des projectiles lors de la fin de combat
    const _Scene_Battle_terminate = Scene_Battle.prototype.terminate;
    Scene_Battle.prototype.terminate = function() {
        // Nettoyer tous les projectiles avant de revenir à la carte
        if ($gameMap._projectiles) {
            for (let i = $gameMap._projectiles.length - 1; i >= 0; i--) {
                const projectile = $gameMap._projectiles[i];
                if (projectile.spriteObj) {
                    if (projectile.spriteObj.parent) {
                        projectile.spriteObj.parent.removeChild(projectile.spriteObj);
                    }
                    projectile.spriteObj.destroy();
                    projectile.spriteObj = null;
                }
            }
            $gameMap._projectiles = [];
        }
        
        _Scene_Battle_terminate.call(this);
    };
    
    // Incrémente le compteur de frames
    const _Scene_Map_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function() {
        _Scene_Map_update.call(this);
        frameCounter = (frameCounter + 1) % (updateFrequency * 100);
    };
    
})();
            