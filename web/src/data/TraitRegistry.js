/**
 * TraitRegistry.js
 * Pure configuration registry for Origins and Classes synergies.
 * Uses i18n keys and PT-BR reference labels.
 */
export const ORIGINS_REGISTRY = {
  academy: {
    key: 'academy',
    icon: '🎓',
    i18nNameKey: 'trait.origin.academy.name',
    namePtBr: 'Academia Mágica',
    i18nDescKey: 'trait.origin.academy.desc',
    thresholds: [2, 4, 6],
    bonuses: {
      2: { bonus: 15, ap: 15 },
      4: { bonus: 30, ap: 35 },
      6: { bonus: 50, ap: 65 }
    }
  },
  dragon: {
    key: 'dragon',
    icon: '🐲',
    i18nNameKey: 'trait.origin.dragon.name',
    namePtBr: 'Dracônico',
    i18nDescKey: 'trait.origin.dragon.desc',
    thresholds: [2, 4, 6],
    bonuses: {
      2: { bonus: 20 },
      4: { bonus: 45 },
      6: { bonus: 80 }
    }
  },
  beast: {
    key: 'beast',
    icon: '🐾',
    i18nNameKey: 'trait.origin.beast.name',
    namePtBr: 'Fera Selvagem',
    i18nDescKey: 'trait.origin.beast.desc',
    thresholds: [2, 4, 6],
    bonuses: {
      2: { bonus: 18 },
      4: { bonus: 38 },
      6: { bonus: 70 }
    }
  },
  mech: {
    key: 'mech',
    icon: '⚙️',
    i18nNameKey: 'trait.origin.mech.name',
    namePtBr: 'Mecatrônico',
    i18nDescKey: 'trait.origin.mech.desc',
    thresholds: [2, 4, 6],
    bonuses: {
      2: { bonus: 180, def: 20 },
      4: { bonus: 400, def: 45 },
      6: { bonus: 750, def: 80 }
    }
  },
  spirit: {
    key: 'spirit',
    icon: '🔮',
    i18nNameKey: 'trait.origin.spirit.name',
    namePtBr: 'Espírito Elemental',
    i18nDescKey: 'trait.origin.spirit.desc',
    thresholds: [2, 4],
    bonuses: {
      2: { bonus: 8 },
      4: { bonus: 18 }
    }
  },
  nature: {
    key: 'nature',
    icon: '🌿',
    i18nNameKey: 'trait.origin.nature.name',
    namePtBr: 'Natureza Viva',
    i18nDescKey: 'trait.origin.nature.desc',
    thresholds: [2, 4],
    bonuses: {
      2: { bonus: 65 },
      4: { bonus: 150 }
    }
  },
  shadow: {
    key: 'shadow',
    icon: '🌑',
    i18nNameKey: 'trait.origin.shadow.name',
    namePtBr: 'Pacto das Sombras',
    i18nDescKey: 'trait.origin.shadow.desc',
    thresholds: [2, 4],
    bonuses: {
      2: { bonus: 22 },
      4: { bonus: 50 }
    }
  },
  celestial: {
    key: 'celestial',
    icon: '☀️',
    i18nNameKey: 'trait.origin.celestial.name',
    namePtBr: 'Celestial',
    i18nDescKey: 'trait.origin.celestial.desc',
    thresholds: [2, 4],
    bonuses: {
      2: { bonus: 15 },
      4: { bonus: 35 }
    }
  }
};

export const CLASSES_REGISTRY = {
  warrior: {
    key: 'warrior',
    icon: '⚔️',
    i18nNameKey: 'trait.class.warrior.name',
    namePtBr: 'Guerreiro',
    i18nDescKey: 'trait.class.warrior.desc',
    thresholds: [2, 4, 6],
    bonuses: {
      2: { bonus: 20, atk: 15 },
      4: { bonus: 45, atk: 35 },
      6: { bonus: 80, atk: 65 }
    }
  },
  mage: {
    key: 'mage',
    icon: '🪄',
    i18nNameKey: 'trait.class.mage.name',
    namePtBr: 'Arcanista',
    i18nDescKey: 'trait.class.mage.desc',
    thresholds: [2, 4, 6],
    bonuses: {
      2: { bonus: 25 },
      4: { bonus: 55 },
      6: { bonus: 95 }
    }
  },
  ranger: {
    key: 'ranger',
    icon: '🏹',
    i18nNameKey: 'trait.class.ranger.name',
    namePtBr: 'Atirador',
    i18nDescKey: 'trait.class.ranger.desc',
    thresholds: [2, 4],
    bonuses: {
      2: { bonus: 20 },
      4: { bonus: 45 }
    }
  },
  assassin: {
    key: 'assassin',
    icon: '🗡️',
    i18nNameKey: 'trait.class.assassin.name',
    namePtBr: 'Assassino',
    i18nDescKey: 'trait.class.assassin.desc',
    thresholds: [2, 4],
    bonuses: {
      2: { bonus: 25 },
      4: { bonus: 60 }
    }
  },
  guardian: {
    key: 'guardian',
    icon: '🛡️',
    i18nNameKey: 'trait.class.guardian.name',
    namePtBr: 'Bastião',
    i18nDescKey: 'trait.class.guardian.desc',
    thresholds: [2, 4],
    bonuses: {
      2: { bonus: 20 },
      4: { bonus: 45 }
    }
  },
  mystic: {
    key: 'mystic',
    icon: '✨',
    i18nNameKey: 'trait.class.mystic.name',
    namePtBr: 'Místico',
    i18nDescKey: 'trait.class.mystic.desc',
    thresholds: [2, 4],
    bonuses: {
      2: { bonus: 25 },
      4: { bonus: 60 }
    }
  }
};
