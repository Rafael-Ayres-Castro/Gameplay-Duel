"""Gera partidas de exemplo no banco configurado (local ou Supabase).

Uso:  python -m scripts.seed_demo        (na raiz do projeto)
Para apagar depois no modo local: delete o arquivo data/local_db.json.
"""
import asyncio
import random
from datetime import datetime, timedelta, timezone

from app.config import GAMES
from app.store import build_store

RANGES = {
    "fifa": 5, "rocket_league": 6, "clash_royale": 3, "minecraft": 20,
    "fall_guys": 6, "gang_beasts": 5, "plato": 3,
}
MODES = {
    "fifa": ["Real x City", "Barça x PSG", "Flamengo x Palmeiras"],
    "rocket_league": ["1v1 Duel", "Hoops"],
    "clash_royale": ["Batalha amistosa", "Touchdown"],
    "minecraft": ["Bedwars", "PvP", "Corrida de parkour"],
    "fall_guys": ["Solo", "Knockout"],
    "gang_beasts": ["Trem", "Roda-gigante", "Ringue"],
    "plato": ["Sinuca", "Damas", "Golf"],
}


async def main(n: int = 28):
    store = build_store()
    start = datetime.now(timezone.utc) - timedelta(days=n)
    for i in range(n):
        g = random.choice(GAMES)
        hi = RANGES[g["slug"]]
        a, b = random.randint(0, hi), random.randint(0, hi)
        details = {"mode": random.choice(MODES[g["slug"]]), "p1": {}, "p2": {}}
        for s in g["stats"]:
            top = 100 if s["unit"] == "%" else 12
            details["p1"][s["key"]] = random.randint(0, top)
            details["p2"][s["key"]] = random.randint(0, top)
        if g["slug"] == "fifa":
            details["p1"]["possession"] = random.randint(35, 65)
            details["p2"]["possession"] = 100 - details["p1"]["possession"]
        winner = 1 if a > b else 2 if b > a else None
        await store.create_match({
            "game": g["slug"], "player1_score": a, "player2_score": b, "winner": winner,
            "duration_minutes": random.randint(6, 40), "notes": None, "details": details,
            "played_at": (start + timedelta(days=i, hours=random.randint(18, 23))).isoformat(),
        })
    print(f"{n} partidas de exemplo criadas.")


if __name__ == "__main__":
    asyncio.run(main())
