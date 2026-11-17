import secrets
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from . import config
from .models import MatchIn, PlayerUpdate
from .stats import compute
from .store import LocalStore, StoreError, build_store

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"

app = FastAPI(title=config.CHAMPIONSHIP_NAME, docs_url="/api/docs", redoc_url=None)
store = build_store()
LOCAL_MODE = isinstance(store, LocalStore)


@app.exception_handler(StoreError)
async def store_error_handler(_: Request, exc: StoreError):
    return JSONResponse(status_code=502, content={"detail": str(exc)})


def require_admin(x_admin_key: Optional[str] = Header(default=None)):
    """Protege as rotas de escrita. Só quem sabe a ADMIN_KEY registra partidas."""
    if not config.ADMIN_KEY:
        if LOCAL_MODE:
            return  # modo local sem senha: liberado para testes
        raise HTTPException(503, "Defina a variável ADMIN_KEY no servidor.")
    if not x_admin_key or not secrets.compare_digest(x_admin_key, config.ADMIN_KEY):
        raise HTTPException(401, "Senha de admin inválida.")


@app.get("/api/health")
async def health():
    return {"ok": True, "mode": "local" if LOCAL_MODE else "supabase"}


@app.get("/api/config")
async def get_config():
    return {
        "name": config.CHAMPIONSHIP_NAME,
        "prize": config.PRIZE,
        "start_date": config.START_DATE or None,
        "end_date": config.END_DATE or None,
        "rules": {"win": config.POINTS_WIN, "draw": config.POINTS_DRAW},
        "games": config.GAMES,
        "players": await store.list_players(),
        "admin_required": bool(config.ADMIN_KEY) or not LOCAL_MODE,
        "mode": "local" if LOCAL_MODE else "supabase",
    }


@app.get("/api/matches")
async def list_matches(game: Optional[str] = None):
    rows = await store.list_matches()
    if game:
        rows = [m for m in rows if m["game"] == game]
    return list(reversed(rows))  # mais recentes primeiro


@app.get("/api/stats")
async def get_stats():
    players = await store.list_players()
    if len(players) < 2:
        raise HTTPException(500, "Cadastre os 2 jogadores na tabela players.")
    return compute(players, await store.list_matches())


@app.post("/api/auth/check", dependencies=[Depends(require_admin)])
async def auth_check():
    return {"ok": True}


@app.post("/api/matches", dependencies=[Depends(require_admin)], status_code=201)
async def create_match(body: MatchIn):
    if body.winner is None:
        if body.player1_score > body.player2_score:
            winner = 1
        elif body.player2_score > body.player1_score:
            winner = 2
        else:
            winner = None
    else:
        winner = body.winner or None  # 0 => empate

    played_at = body.played_at or datetime.now(timezone.utc)
    if played_at.tzinfo is None:
        played_at = played_at.replace(tzinfo=timezone.utc)

    return await store.create_match({
        "game": body.game,
        "player1_score": body.player1_score,
        "player2_score": body.player2_score,
        "winner": winner,
        "duration_minutes": body.duration_minutes,
        "notes": (body.notes or "").strip() or None,
        "details": body.details,
        "played_at": played_at.isoformat(),
    })


@app.delete("/api/matches/{match_id}", dependencies=[Depends(require_admin)])
async def delete_match(match_id: int):
    if not await store.delete_match(match_id):
        raise HTTPException(404, "Partida não encontrada.")
    return {"ok": True}


@app.put("/api/players/{player_id}", dependencies=[Depends(require_admin)])
async def update_player(player_id: int, body: PlayerUpdate):
    if player_id not in (1, 2):
        raise HTTPException(404, "Jogador não encontrado.")
    data = body.model_dump(exclude_none=True)
    row = await store.update_player(player_id, data)
    if not row:
        raise HTTPException(404, "Jogador não encontrado.")
    return row


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/", include_in_schema=False)
async def index():
    return FileResponse(STATIC_DIR / "index.html")
