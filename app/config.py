"""Configuração central do campeonato: jogos, regras de pontuação e variáveis de ambiente."""
import os

from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip().rstrip("/").removesuffix("/rest/v1")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
ADMIN_KEY = os.getenv("ADMIN_KEY", "")

CHAMPIONSHIP_NAME = os.getenv("CHAMPIONSHIP_NAME", "Desafio Gameplay")
PRIZE = os.getenv("PRIZE", "GTA 6")
START_DATE = os.getenv("START_DATE", "")  # ISO, ex: 2026-11-01
END_DATE = os.getenv("END_DATE", "")  # ISO, ex: 2027-01-31

POINTS_WIN = int(os.getenv("POINTS_WIN", "3"))
POINTS_DRAW = int(os.getenv("POINTS_DRAW", "1"))

# Cada jogo define o que "placar" significa e quais estatísticas extras
# podem ser registradas por jogador. Tudo opcional, exceto o placar.
GAMES = [
    {
        "slug": "fifa",
        "name": "FIFA",
        "short": "FIFA",
        "score_label": "Gols",
        "mode_label": "Times usados",
        "mode_placeholder": "Real Madrid x Man. City",
        "stats": [
            {"key": "possession", "label": "Posse de bola", "unit": "%"},
            {"key": "shots", "label": "Finalizações", "unit": ""},
            {"key": "on_target", "label": "No alvo", "unit": ""},
        ],
    },
    {
        "slug": "rocket_league",
        "name": "Rocket League",
        "short": "RL",
        "score_label": "Gols",
        "mode_label": "Modo",
        "mode_placeholder": "1v1 Duel",
        "stats": [
            {"key": "shots", "label": "Chutes", "unit": ""},
            {"key": "saves", "label": "Defesas", "unit": ""},
            {"key": "demos", "label": "Demolições", "unit": ""},
        ],
    },
    {
        "slug": "clash_royale",
        "name": "Clash Royale",
        "short": "CR",
        "score_label": "Coroas",
        "mode_label": "Modo",
        "mode_placeholder": "Batalha amistosa",
        "stats": [
            {"key": "king_hp", "label": "HP torre do rei", "unit": "%"},
            {"key": "elixir_leaked", "label": "Elixir desperdiçado", "unit": "", "lower": True},
        ],
    },
    {
        "slug": "minecraft",
        "name": "Minecraft",
        "short": "MC",
        "score_label": "Pontos",
        "mode_label": "Minigame",
        "mode_placeholder": "Bedwars, PvP, corrida...",
        "stats": [
            {"key": "kills", "label": "Abates", "unit": ""},
            {"key": "deaths", "label": "Mortes", "unit": "", "lower": True},
        ],
    },
    {
        "slug": "fall_guys",
        "name": "Fall Guys",
        "short": "FG",
        "score_label": "Rodadas",
        "mode_label": "Show",
        "mode_placeholder": "Solo, Duos, Knockout...",
        "stats": [
            {"key": "placement", "label": "Posição final", "unit": "º", "lower": True},
            {"key": "crowns", "label": "Coroas", "unit": ""},
        ],
    },
    {
        "slug": "gang_beasts",
        "name": "Gang Beasts",
        "short": "GB",
        "score_label": "Rounds",
        "mode_label": "Mapa",
        "mode_placeholder": "Trem, Roda-gigante...",
        "stats": [
            {"key": "knockouts", "label": "Nocautes", "unit": ""},
            {"key": "falls", "label": "Quedas", "unit": "", "lower": True},
        ],
    },
    {
        "slug": "plato",
        "name": "Plato",
        "short": "PL",
        "score_label": "Vitórias",
        "mode_label": "Jogo",
        "mode_placeholder": "Sinuca, Damas, Golf...",
        "stats": [],
    },
]

GAME_SLUGS = {g["slug"] for g in GAMES}
GAMES_BY_SLUG = {g["slug"]: g for g in GAMES}
