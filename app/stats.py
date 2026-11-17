"""Calcula todas as estatísticas a partir da lista de partidas.

O volume de dados de um campeonato entre duas pessoas é pequeno, então calcular
tudo em Python a cada requisição é simples e rápido o suficiente.
"""
from collections import defaultdict

from .config import GAMES, POINTS_DRAW, POINTS_WIN


def _result_for(match: dict, pid: int) -> str:
    w = match.get("winner")
    if w is None:
        return "D"
    return "W" if w == pid else "L"


def _score(match: dict, pid: int) -> int:
    return match["player1_score"] if pid == 1 else match["player2_score"]


def _player_block(player: dict, matches: list[dict]) -> dict:
    pid = player["id"]
    other = 2 if pid == 1 else 1
    wins = losses = draws = 0
    score_for = score_against = 0
    best_streak = 0
    run = 0
    form: list[str] = []
    for m in matches:
        r = _result_for(m, pid)
        form.append(r)
        score_for += _score(m, pid)
        score_against += _score(m, other)
        if r == "W":
            wins += 1
            run += 1
            best_streak = max(best_streak, run)
        else:
            run = 0
            if r == "L":
                losses += 1
            else:
                draws += 1

    # sequência atual (vitórias, derrotas ou empates seguidos)
    streak_type, streak_count = None, 0
    for r in reversed(form):
        if streak_type is None:
            streak_type, streak_count = r, 1
        elif r == streak_type:
            streak_count += 1
        else:
            break

    total = len(matches)
    return {
        **player,
        "points": wins * POINTS_WIN + draws * POINTS_DRAW,
        "matches": total,
        "wins": wins,
        "losses": losses,
        "draws": draws,
        "win_rate": round(wins / total * 100) if total else 0,
        "score_for": score_for,
        "score_against": score_against,
        "best_streak": best_streak,
        "streak": {"type": streak_type, "count": streak_count},
        "form": form[-5:],
    }


def compute(players: list[dict], matches: list[dict]) -> dict:
    players = sorted(players, key=lambda p: p["id"])
    blocks = [_player_block(p, matches) for p in players]
    p1, p2 = blocks[0], blocks[1]

    if p1["points"] == p2["points"]:
        leader, gap = None, 0
    else:
        leader = 1 if p1["points"] > p2["points"] else 2
        gap = abs(p1["points"] - p2["points"])

    # Linha do tempo de pontos acumulados
    timeline = []
    a = b = 0
    for m in matches:
        w = m.get("winner")
        if w is None:
            a += POINTS_DRAW
            b += POINTS_DRAW
        elif w == 1:
            a += POINTS_WIN
        else:
            b += POINTS_WIN
        timeline.append({
            "id": m["id"],
            "played_at": m["played_at"],
            "game": m["game"],
            "p1": a,
            "p2": b,
            "diff": m["player1_score"] - m["player2_score"],
            "winner": w,
        })

    # Quebra por jogo
    per_game = defaultdict(list)
    for m in matches:
        per_game[m["game"]].append(m)

    by_game = []
    for g in GAMES:
        gm = per_game.get(g["slug"], [])
        n = len(gm)
        p1w = sum(1 for m in gm if m.get("winner") == 1)
        p2w = sum(1 for m in gm if m.get("winner") == 2)
        dr = n - p1w - p2w
        s1 = sum(m["player1_score"] for m in gm)
        s2 = sum(m["player2_score"] for m in gm)

        biggest = None
        for m in gm:
            margin = abs(m["player1_score"] - m["player2_score"])
            if m.get("winner") and (biggest is None or margin > biggest["margin"]):
                biggest = {"id": m["id"], "margin": margin, "winner": m["winner"],
                           "score": f'{m["player1_score"]}-{m["player2_score"]}'}

        stats_avg = {"p1": {}, "p2": {}}
        for side in ("p1", "p2"):
            sums, counts = defaultdict(float), defaultdict(int)
            for m in gm:
                for k, v in ((m.get("details") or {}).get(side) or {}).items():
                    sums[k] += v
                    counts[k] += 1
            stats_avg[side] = {k: round(sums[k] / counts[k], 1) for k in sums}

        leader_g = None
        if p1w != p2w:
            leader_g = 1 if p1w > p2w else 2

        by_game.append({
            "slug": g["slug"],
            "matches": n,
            "p1_wins": p1w,
            "p2_wins": p2w,
            "draws": dr,
            "p1_score": s1,
            "p2_score": s2,
            "p1_avg": round(s1 / n, 1) if n else 0,
            "p2_avg": round(s2 / n, 1) if n else 0,
            "p1_win_rate": round(p1w / n * 100) if n else 0,
            "p2_win_rate": round(p2w / n * 100) if n else 0,
            "leader": leader_g,
            "biggest_win": biggest,
            "stats_avg": stats_avg,
            "last_played": gm[-1]["played_at"] if gm else None,
            "minutes": sum(m.get("duration_minutes") or 0 for m in gm),
        })

    played = [g for g in by_game if g["matches"]]
    most_played = max(played, key=lambda g: g["matches"])["slug"] if played else None

    overall_biggest = None
    for m in matches:
        if not m.get("winner"):
            continue
        margin = abs(m["player1_score"] - m["player2_score"])
        if overall_biggest is None or margin > overall_biggest["margin"]:
            overall_biggest = {"id": m["id"], "game": m["game"], "margin": margin,
                               "winner": m["winner"],
                               "score": f'{m["player1_score"]}-{m["player2_score"]}'}

    return {
        "players": blocks,
        "leader": leader,
        "gap": gap,
        "total_matches": len(matches),
        "total_minutes": sum(m.get("duration_minutes") or 0 for m in matches),
        "games_played": len(played),
        "most_played": most_played,
        "biggest_win": overall_biggest,
        "timeline": timeline,
        "by_game": by_game,
        "rules": {"win": POINTS_WIN, "draw": POINTS_DRAW},
    }
