/**
 * World.js
 * Pure Entity-Component-System (ECS) registry and pipeline runner.
 * Zero God Objects: World only stores Entity IDs, Component Maps, and executes Systems.
 */
export class World {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.nextEntityId = 1;
    /** @type {Set<number>} */
    this.entities = new Set();
    /** @type {Map<string, Map<number, Object>>} */
    this.components = new Map();
    /** @type {Array<{name: string, system: Object, priority: number}>} */
    this.systems = [];
  }

  /**
   * Create a new entity ID.
   * @returns {number}
   */
  createEntity() {
    const id = this.nextEntityId++;
    this.entities.add(id);
    return id;
  }

  /**
   * Destroy an entity and remove all its components.
   * @param {number} entityId
   */
  destroyEntity(entityId) {
    if (!this.entities.has(entityId)) return;
    this.eventBus.emit('entity:destroying', { entityId });
    for (const store of this.components.values()) {
      store.delete(entityId);
    }
    this.entities.delete(entityId);
  }

  /**
   * Attach a component data object to an entity.
   * @param {number} entityId
   * @param {string} componentName
   * @param {Object} data
   * @returns {Object}
   */
  addComponent(entityId, componentName, data) {
    if (!this.components.has(componentName)) {
      this.components.set(componentName, new Map());
    }
    this.components.get(componentName).set(entityId, data);
    return data;
  }

  /**
   * Retrieve a component for an entity.
   * @param {number} entityId
   * @param {string} componentName
   * @returns {Object|undefined}
   */
  getComponent(entityId, componentName) {
    const store = this.components.get(componentName);
    return store ? store.get(entityId) : undefined;
  }

  /**
   * Check if an entity has a component.
   * @param {number} entityId
   * @param {string} componentName
   * @returns {boolean}
   */
  hasComponent(entityId, componentName) {
    const store = this.components.get(componentName);
    return store ? store.has(entityId) : false;
  }

  /**
   * Remove a specific component from an entity.
   * @param {number} entityId
   * @param {string} componentName
   */
  removeComponent(entityId, componentName) {
    const store = this.components.get(componentName);
    if (store) {
      store.delete(entityId);
    }
  }

  /**
   * Query all living entities that possess all required component names.
   * @param {string[]} requiredComponents
   * @returns {number[]}
   */
  query(requiredComponents) {
    const result = [];
    for (const entityId of this.entities) {
      let match = true;
      for (let i = 0; i < requiredComponents.length; i++) {
        const store = this.components.get(requiredComponents[i]);
        if (!store || !store.has(entityId)) {
          match = false;
          break;
        }
      }
      if (match) {
        result.push(entityId);
      }
    }
    return result;
  }

  /**
   * Register a system into the execution pipeline.
   * @param {string} name
   * @param {Object} system
   * @param {number} [priority=0]
   */
  registerSystem(name, system, priority = 0) {
    this.systems.push({ name, system, priority });
    this.systems.sort((a, b) => a.priority - b.priority);
    if (typeof system.init === 'function') {
      system.init(this);
    }
  }

  /**
   * Retrieve a registered system by name.
   * @param {string} name
   * @returns {Object|undefined}
   */
  getSystem(name) {
    const entry = this.systems.find(s => s.name === name);
    return entry ? entry.system : undefined;
  }

  /**
   * Execute update(dt) on all registered systems.
   * @param {number} dt Delta time in seconds
   */
  update(dt) {
    for (let i = 0; i < this.systems.length; i++) {
      const sys = this.systems[i].system;
      if (typeof sys.update === 'function') {
        sys.update(dt, this);
      }
    }
  }
}
