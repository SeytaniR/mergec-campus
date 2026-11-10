# 🧙‍♂️ Mergec Campus — Plano Completo de Arquitetura, Assets & Restauração Futura

Este documento preserva todo o estado, arquitetura e instruções de restauração do projeto **Mergec Campus** (Auto-Battler & Merge Tático 2.5D em 8 Direções no universo *Magic Campus*), para que possa ser retomado a qualquer momento em qualquer VPS ou ambiente local.

---

## 1. Resumo do que já está 100% Construído neste Repositório

1. **Banco Auditado de 298 Modelos 100% 8-Direções (`web/assets/data/verified_units_db.json`)**:
   * **25 Heróis**, **270 Pets/Monstros** e **3 NPCs de Combate** filtrados dentre 914 modelos originais para garantir que todos possuam animações completas nas **8 direções (`0..7`)**.
   * **12 Efeitos Especiais (VFX)** em WebP (`web/assets/effects/`) e **30 Ícones de Habilidades** (`web/assets/skills/icons/`).
2. **Arena 2.5D & Malha de Efeitos em Tempo Real (`web/assets/arena/arena_campus_25d.webp`)**:
   * [`ArenaEnvironmentSystem.js`](web/src/systems/ArenaEnvironmentSystem.js): Renderiza o cenário $1376 \times 768$ e anima as **12 malhas 2.5D** (`water_caustics`, `portal_vortex`, `brazier_fire`, `rune_circle`, `lantern_halo`, `crystal_glow`).
   * [`BoardCoordSystem.js`](web/src/systems/BoardCoordSystem.js): Interpolação bilinear em perspectiva trapezoidal 2.5D para o tabuleiro $7 \times 6$ (`board_perspective_grid`), alinhamento nos 9 pedestais rúnicos da bancada (`bench_runic_pedestals`) e escala de profundidade automática por $Y$.
   * [`default_arena_meshes.json`](web/assets/data/default_arena_meshes.json): Calibração padrão das 12 malhas 2.5D.
3. **Arquitetura ECS Modular com ES6 Modules (Zero God Objects)**:
   * Núcleo ECS: [`EventBus.js`](web/src/ecs/EventBus.js) e [`World.js`](web/src/ecs/World.js).
   * 6 Componentes puros em [`web/src/components/`](web/src/components/).
   * 10 Sistemas de responsabilidade única em [`web/src/systems/`](web/src/systems/).
   * Internacionalização (`i18n`) baseada em chaves, interpolação de variáveis (`{damage}`, `{shield}`, `{heal}`) e referência canônica em PT-BR: [`I18nService.js`](web/src/i18n/I18nService.js).
4. **Rota Admin Studio CRUD (`/admin` / `web/admin.html`)**:
   * Interface modular em [`web/src/admin/`](web/src/admin/) com 7 abas:
     1. **Economia & Fórmulas de Dano** (`EconomyFormulasTab.js`) + Simulador Matemático em Tempo Real
     2. **Personagens & Habilidades** (`UnitsCrudTab.js`)
     3. **Sinergias (Origens/Classes)** (`TraitsCrudTab.js`)
     4. **Efeitos Especiais (VFX)** (`VfxCrudTab.js`)
     5. **Editor Visual Interativo de Malhas 2.5D da Arena** (`ArenaMeshCrudTab.js`)
     6. **Traduções i18n & Referência PT-BR** (`I18nCrudTab.js`)
     7. **Monitor de Partidas Online** (`MatchesMonitorTab.js`)
5. **Servidor Autoritário Node.js + PostgreSQL 16 (`server/`)**:
   * [`schema.sql`](server/db/schema.sql): Tabelas `game_config`, `traits_catalog`, `vfx_catalog`, `units_catalog`, `i18n_translations`, `matches` e `arena_meshes`.
   * [`DatabaseManager.js`](server/src/db/DatabaseManager.js): Migração automática e seed completo das 7 tabelas.
   * [`AdminCrudController.js`](server/src/controllers/AdminCrudController.js): Endpoints REST `/api/admin/*` com broadcast WebSocket `LIVE_CONFIG_UPDATED`.
   * [`AuthoritativeServer.js`](server/src/AuthoritativeServer.js): Servidor HTTP + WebSocket na porta `3001`.

---

## 2. Como Restaurar o Servidor em Qualquer VPS Ubuntu (ou via Docker)

### Opção A — Usando Docker Compose (1 Comando)
```bash
git clone https://github.com/SeytaniR/mergec-campus.git
cd mergec-campus
docker compose up -d
```

### Opção B — Instalação Nativa em VPS Ubuntu (Node.js + PostgreSQL 16 + Systemd)
```bash
# 1. Clonar o repositório
git clone https://github.com/SeytaniR/mergec-campus.git ~/mergec-campus
cd ~/mergec-campus/server
npm install --omit=dev

# 2. Criar usuário e banco no PostgreSQL
sudo -u postgres psql -c "CREATE USER mergec WITH PASSWORD 'mergec_secret_password';"
sudo -u postgres psql -c "CREATE DATABASE mergec_campus OWNER mergec;"
sudo -u postgres psql -d mergec_campus -f db/schema.sql
sudo -u postgres psql -d mergec_campus -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO mergec;"

# 3. Iniciar o servidor na porta 3001
PORT=3001 DATABASE_URL="postgres://mergec:mergec_secret_password@127.0.0.1:5432/mergec_campus" node src/AuthoritativeServer.js
```

---

## 3. Links Permanentes no GitHub
* **Repositório Oficial:** `https://github.com/SeytaniR/mergec-campus`
* **Demo Web (Funciona 100% em Modo Local Loopback mesmo sem VPS):** `https://seytanir.github.io/mergec-campus/`
* **Painel Admin UI:** `https://seytanir.github.io/mergec-campus/admin.html`
