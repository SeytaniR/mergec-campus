/**
 * I18nService.js
 * Modular internationalization engine using translation keys, {variable} interpolation,
 * and database PT-BR canonical reference names.
 */
import { ptBR } from './locales/pt-BR.js';
import { enUS } from './locales/en-US.js';

const PTBR_TO_EN_GLOSSARY = [
  ["Guerreira Sagrada Tier 2", "Sacred Warrior Tier 2"],
  ["Arquimaga Suprema Tier 2", "Supreme Archmage Tier 2"],
  ["Franco-Atiradora Tier 2", "Sharpshooter Tier 2"],
  ["Suma Sacerdotisa Tier 2", "High Priestess Tier 2"],
  ["Mestra Mecatrônica Tier 2", "Mechatronic Master Tier 2"],
  ["Lorde Mística Tier 2", "Mystic Lord Tier 2"],
  ["Guerreiro Sagrado Tier 2", "Sacred Warrior Tier 2"],
  ["Arquimago Supremo Tier 2", "Supreme Archmage Tier 2"],
  ["Franco-Atirador Tier 2", "Sharpshooter Tier 2"],
  ["Sumo Sacerdote Tier 2", "High Priest Tier 2"],
  ["Mestre Mecatrônico Tier 2", "Mechatronic Master Tier 2"],
  ["Lorde Místico Tier 2", "Mystic Lord Tier 2"],
  ["Guerreira Base", "Base Warrior"],
  ["Guerreiro Base", "Base Warrior"],
  ["Maga Base", "Base Mage"],
  ["Mago Base", "Base Mage"],
  ["Caçadora / Arqueira Base", "Base Ranger"],
  ["Caçador / Arqueiro Base", "Base Ranger"],
  ["Sacerdotisa Base", "Base Priestess"],
  ["Sacerdote Base", "Base Priest"],
  ["Artífice / Mecânica Base", "Base Artificer"],
  ["Artífice / Mecânico Base", "Base Artificer"],
  ["Mística / Assassina Base", "Base Mystic Assassin"],
  ["Místico / Assassino Base", "Base Mystic Assassin"],
  ["Guardião Escarlate", "Crimson Guardian"],
  ["Arcanista Astral", "Astral Arcanist"],
  ["Caçador das Sombras", "Shadow Hunter"],
  ["Sacerdotisa Solar", "Solar Priestess"],
  ["Engenheiro Mecatrônico", "Mechatronic Engineer"],
  ["Místico do Vazio", "Void Mystic"],
  ["Dragão Ancestral", "Ancient Dragon"],
  ["Fera Glacial", "Glacial Beast"],
  ["Colosso de Engrenagens", "Clockwork Colossus"],
  ["Espírito da Floresta", "Forest Spirit"],
  ["Lobo da Tempestade", "Storm Wolf"],
  ["Cavaleiro do Crepúsculo", "Twilight Knight"],
  ["Golpeia o alvo causando", "Strikes the target dealing"],
  ["de dano físico e recebe", "physical damage and gaining a"],
  ["de escudo por 4s.", "shield for 4s."],
  ["Conjura uma explosão arcana que causa", "Conjures an arcane blast dealing"],
  ["de dano mágico em área.", "area magic damage."],
  ["Salta para a retaguarda inimiga e desfere um ataque crítico de", "Leaps to the enemy backline and lands a critical strike for"],
  ["de dano.", "damage."],
  ["Restaura", "Restores"],
  ["de vida dos aliados próximos e aumenta a velocidade em", "HP to nearby allies and boosts speed by"],
  ["Dispara um feixe de plasma que causa", "Fires a plasma beam dealing"],
  ["de dano verdadeiro e reduz armadura.", "true damage and shredding armor."],
  ["Canaliza energia espiritual causando", "Channels spirit energy dealing"],
  ["de dano mágico e drenando", "magic damage and draining"],
  ["de mana.", "mana."],
  ["Sopra chamas primordiais em cone causando", "Breathes primordial flames in a cone dealing"],
  ["de dano mágico e queimadura.", "magic damage and burn."],
  ["Investe ferozmente contra o inimigo causando", "Charges ferociously at the enemy dealing"],
  ["de dano e atordoando por 1.5s.", "damage and stunning for 1.5s."],
  ["Ativa sobrecarga defensiva, ganhando", "Activates defensive overload, gaining a"],
  ["de escudo e refletindo", "shield and reflecting"],
  ["Invoca raízes místicas que causam", "Summons mystic roots dealing"],
  ["de dano mágico e curam", "magic damage and healing"],
  ["Uiva invocando relâmpagos que atingem 3 alvos com", "Howls to summon lightning bolts hitting 3 targets for"],
  ["de dano mágico.", "magic damage."],
  ["Gira sua lâmina sagrada causando", "Spins a sacred blade dealing"],
  ["de dano físico a todos os inimigos adjacentes.", "physical damage to all adjacent enemies."]
];

export class I18nService {
  constructor(eventBus, defaultLocale = 'pt-BR') {
    this.eventBus = eventBus;
    this.locale = defaultLocale;
    this.dictionaries = {
      'pt-BR': { ...ptBR },
      'en-US': { ...enUS }
    };
  }

  /**
   * Register database records (which store i18n keys + PT-BR reference strings)
   * into the translation tables.
   * @param {Array<Object>} unitsDb
   */
  registerDatabaseCatalog(unitsDb) {
    for (const unit of unitsDb) {
      this.dictionaries['pt-BR'][unit.i18n_name_key] = unit.name_ptbr;
      this.dictionaries['pt-BR'][unit.i18n_skill_key] = unit.skill_desc_ptbr;

      if (!this.dictionaries['en-US'][unit.i18n_name_key]) {
        this.dictionaries['en-US'][unit.i18n_name_key] = this.translateFromPtBrReference(unit.name_ptbr);
      }
      if (!this.dictionaries['en-US'][unit.i18n_skill_key]) {
        this.dictionaries['en-US'][unit.i18n_skill_key] = this.translateFromPtBrReference(unit.skill_desc_ptbr);
      }
    }
  }

  /**
   * Uses the PT-BR database text as reference to derive English text when not overridden.
   * @param {string} ptbrText
   * @returns {string}
   */
  translateFromPtBrReference(ptbrText) {
    if (!ptbrText) return '';
    let result = ptbrText;
    for (const [pt, en] of PTBR_TO_EN_GLOSSARY) {
      result = result.replaceAll(pt, en);
    }
    return result;
  }

  /**
   * Set active locale ('pt-BR' | 'en-US') and notify all systems.
   * @param {string} newLocale
   */
  setLocale(newLocale) {
    if (!this.dictionaries[newLocale] || this.locale === newLocale) return;
    this.locale = newLocale;
    this.eventBus.emit('i18n:changed', { locale: this.locale });
  }

  /**
   * Translate a key with {variable} interpolation and optional PT-BR DB fallback.
   * @param {string} key
   * @param {Object} [vars={}]
   * @param {string} [fallbackPtBr='']
   * @returns {string}
   */
  t(key, vars = {}, fallbackPtBr = '') {
    const activeDict = this.dictionaries[this.locale] || this.dictionaries['pt-BR'];
    let template = activeDict[key];

    if (template === undefined) {
      if (this.locale === 'en-US' && fallbackPtBr) {
        template = this.translateFromPtBrReference(fallbackPtBr);
      } else {
        template = this.dictionaries['pt-BR'][key] || fallbackPtBr || key;
      }
    }

    return this.interpolate(template, vars);
  }

  /**
   * Replace {variable} tokens with provided values.
   * @param {string} text
   * @param {Object} vars
   * @returns {string}
   */
  interpolate(text, vars) {
    if (!text || typeof text !== 'string') return String(text ?? '');
    return text.replace(/\{(\w+)\}/g, (match, varName) => {
      return vars[varName] !== undefined ? String(vars[varName]) : match;
    });
  }
}
