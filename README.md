# Desafio Gameplay 🏆 GTA 6

Campeonato entre 2 jogadores em 7 jogos (FIFA, Rocket League, Clash Royale, Minecraft,
Fall Guys, Gang Beasts e Plato). Placar, estatísticas por partida e gráficos.
Quem terminar com mais pontos leva o GTA 6.

**Stack:** HTML + CSS + JS puro · FastAPI (Python) · Supabase (Postgres) · Render.

## Rodar no seu PC

```bash
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Abra http://localhost:8000. Sem `.env`, o app roda em **modo local**: salva tudo em
`data/local_db.json` e não pede senha. Para ver o site com dados de exemplo:

```bash
python -m scripts.seed_demo        # cria 28 partidas fake
rm data/local_db.json              # apaga tudo de novo
```

Para usar o Supabase localmente, copie `.env.example` para `.env` e preencha.

## Pontuação

- Vitória = `POINTS_WIN` (padrão 3) · Empate = `POINTS_DRAW` (padrão 1) · Derrota = 0
- O vencedor sai do placar automaticamente, mas dá para forçar no formulário
  (ex.: Fall Guys, quando os dois caem na mesma rodada mas um ficou melhor colocado).

## Estrutura

```
app/main.py        rotas da API + serve o site
app/config.py      jogos, estatísticas de cada jogo, regras e variáveis de ambiente
app/stats.py       cálculo de pontos, sequências, médias e gráficos
app/store.py       acesso ao Supabase (REST) ou ao arquivo local
static/            index.html, css/styles.css, js/app.js
supabase/schema.sql  tabelas para colar no SQL Editor do Supabase
render.yaml        blueprint de deploy do Render
```

Para trocar estatísticas de um jogo, edite `GAMES` em `app/config.py`. Os ícones dos
jogos ficam no `<svg>` no topo de `static/index.html` (símbolos `g-<slug>`).

## API

Documentação interativa em `/api/docs`. Rotas de escrita exigem o header `X-Admin-Key`.

| Método | Rota | O que faz |
| --- | --- | --- |
| GET | `/api/config` | jogos, jogadores e regras |
| GET | `/api/stats` | todas as estatísticas calculadas |
| GET | `/api/matches?game=fifa` | histórico de partidas |
| POST | `/api/matches` | registra partida (admin) |
| DELETE | `/api/matches/{id}` | apaga partida (admin) |
| PUT | `/api/players/{1\|2}` | edita nome, apelido e cor (admin) |
# Gameplay-Duel
