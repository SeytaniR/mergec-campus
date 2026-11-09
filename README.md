# Mergec Campus 🧙‍♂️♟️✨

**Auto-Battler & Merge Tático 8-Direções** inspirado em *Teamfight Tactics (TFT)* no universo de *Magic Campus*.
Construído com arquitetura estrita **ECS (Entity-Component-System)**, **ES6 Modules**, **Zero God Objects**, internacionalização **i18n por chaves/variáveis com referência PT-BR no banco de dados**, **layout fluido multidispositivo** e **Servidor Autoritário**.

---

## 🎯 Regras Arquiteturais Implementadas

### 1. Arquitetura Modular com ECS & ES6 Modules (Zero God Objects)
Nenhuma classe acumula lógica de múltiplos domínios. Cada arquivo tem responsabilidade única:
* **Core ECS (`web/src/ecs/`):**
  * `EventBus.js` — Barramento pub/sub desacoplado para comunicação entre sistemas.
  * `World.js` — Registro de entidades, mapas de componentes puros e pipeline de execução ordenada.
* **Componentes de Dados Puros (`web/src/components/`):**
  * `TransformComponent.js` — Coordenadas `(x, y)`, escala, alfa e cálculo matemático das 8 direções (`calculateDirection8`).
  * `GridCellComponent.js` — Zona (`bench` ou `board`), `slotIndex`, coluna/linha e equipe (`player` ou `enemy`).
  * `UnitStatsComponent.js` — Atributos escaláveis por estrela (`1⭐`, `2⭐⭐`, `3⭐⭐⭐`), mana e parâmetros de skill.
  * `TraitComponent.js` — Chaves de sinergia de Origem e Classe.
  * `SpriteAnimComponent.js` — Estado de animação (`0..7`) nas 8 direções (`0..7`) e vínculo de efeito visual (VFX).
  * `CombatAIStateComponent.js` — Máquina de estados tática (`IDLE`, `MOVING`, `ATTACKING`, `CASTING`, `DEAD`).
* **Sistemas Especializados (`web/src/systems/`):**
  * `AssetCacheSystem.js` — Carregamento assíncrono e fatiamento de texturas WebP sem colisão global de IDs.
  * `BoardCoordSystem.js` — Tabuleiro tático 7×6 + Banco de Reserva de 9 slots e conversão geométrica.
  * `MergeSystem.js` — Fusão automática em cascata: 3 cópias idênticas (`⭐`) fundem-se em `⭐⭐` e 3 `⭐⭐` em `⭐⭐⭐`.
  * `SynergySystem.js` — Contagem de peças únicas no tabuleiro e aplicação de bônus de Origem/Classe (`2/4/6`).
  * `DragDropSystem.js` — Arrastar e soltar (mouse/toque) entre banco, tabuleiro e zona de venda.
  * `CombatSystem.js` — Simulação de batalha em 8 direções, busca de caminho em grid discreto, ganho de mana e disparo de Ultimate com VFX.
  * `AnimationSystem.js` — Reprodução de sequências `${dir}-${action}` e explosões aditivas de VFX.
  * `UnitRenderSystem.js` — Containers visuais Pixi.js, barras de HP/Escudo/Mana, estrelas e números flutuantes.
  * `LayoutSystem.js` — `ResizeObserver` fluido para telas Mobile e Desktop, Retrato (Vertical) e Paisagem (Horizontal).
  * `HudUiSystem.js` — Interface reativa, Loja, Inspetor e Catálogo das 298 unidades 8-direções.

---

### 2. Auditoria Estrita: 298 Modelos 100% 8-Direções
Todos os 914 modelos originais foram auditados via script automatizado:
* ✅ **298 Modelos Aprovados (Importados):** Possuem **todas as 8 direções (`0..7`)** e **todas as animações de combate (`0` Stand, `1` Walk, `2` Run, `3` Attack, `4` Dead, `5` Hurt, `7` Magic Cast)**:
  * **25 Heróis Jogáveis** (Classes Masculinas e Femininas Tier 1 e Tier 2 Supremo).
  * **270 Monstros & Pets de Combate**.
  * **3 NPCs Especiais de Batalha**.
* ❌ **616 Modelos Parciais Descartados:** Modelos que possuíam apenas 1 ou 2 direções foram excluídos.

---

### 3. Sistema de Tradução i18n com Chaves, Variáveis e Referência PT-BR no Banco
* No banco de dados (`server/db/schema.sql` e `web/assets/data/verified_units_db.json`), todos os registros possuem:
  * `i18n_name_key` (ex: `unit.pc_female_000001.name`) + `name_ptbr` (ex: `"Guerreira Base (F)"`)
  * `i18n_skill_key` (ex: `unit.pc_female_000001.skill_desc`) + `skill_desc_ptbr` (ex: `"Golpeia o alvo causando {damage} de dano físico e recebe {shield} de escudo por 4s."`)
* O `I18nService.js` resolve a chave i18n no idioma selecionado (`pt-BR` ou `en-US`), interpola variáveis dinâmicas (`{damage}`, `{shield}`, `{cost}`, `{round}`) e utiliza o campo `*_ptbr` do banco de dados como referência canônica.

---

### 4. Servidor Autoritário & Guia de VPS Gratuita (Azure vs Alternativas)
Veja `docker-compose.yml` e `server/src/AuthoritativeServer.js` para subir o servidor WebSocket + PostgreSQL com `docker compose up -d`.
