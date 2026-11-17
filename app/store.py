"""Camada de dados.

- SupabaseStore: fala com a API REST (PostgREST) do Supabase usando a service key,
  que fica só no servidor. Usado em produção (Render).
- LocalStore: arquivo JSON em data/local_db.json. Usado quando SUPABASE_URL não está
  configurado, para rodar e testar no seu PC sem precisar de banco.
"""
import asyncio
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import httpx

from .config import SUPABASE_SERVICE_KEY, SUPABASE_URL

DEFAULT_PLAYERS = [
    {"id": 1, "name": "Jogador 1", "nickname": "P1", "color": "#1DF2C4"},
    {"id": 2, "name": "Jogador 2", "nickname": "P2", "color": "#F5C84C"},
]


class StoreError(Exception):
    pass


class SupabaseStore:
    def __init__(self, url: str, key: str):
        self.base = f"{url}/rest/v1"
        self.headers = {"apikey": key, "Content-Type": "application/json"}
        # Chave antiga (JWT service_role) também vai como Bearer.
        # Chave nova (sb_secret_...) vai só no header apikey.
        if not key.startswith("sb_"):
            self.headers["Authorization"] = f"Bearer {key}"
        self.client = httpx.AsyncClient(timeout=10.0, headers=self.headers)

    async def _req(self, method: str, path: str, **kw) -> Any:
        try:
            r = await self.client.request(method, f"{self.base}/{path}", **kw)
        except httpx.HTTPError as e:
            raise StoreError(f"Falha ao conectar no Supabase: {e}") from e
        if r.status_code >= 400:
            raise StoreError(f"Supabase {r.status_code}: {r.text[:300]}")
        return r.json() if r.content else None

    async def list_players(self) -> list[dict]:
        return await self._req("GET", "players", params={"select": "*", "order": "id.asc"})

    async def update_player(self, pid: int, data: dict) -> Optional[dict]:
        rows = await self._req(
            "PATCH", "players", params={"id": f"eq.{pid}"}, json=data,
            headers={"Prefer": "return=representation"},
        )
        return rows[0] if rows else None

    async def list_matches(self) -> list[dict]:
        return await self._req(
            "GET", "matches", params={"select": "*", "order": "played_at.asc,id.asc"}
        )

    async def create_match(self, data: dict) -> dict:
        rows = await self._req(
            "POST", "matches", json=data, headers={"Prefer": "return=representation"}
        )
        return rows[0]

    async def delete_match(self, mid: int) -> bool:
        rows = await self._req(
            "DELETE", "matches", params={"id": f"eq.{mid}"},
            headers={"Prefer": "return=representation"},
        )
        return bool(rows)


class LocalStore:
    def __init__(self, path: Path):
        self.path = path
        self.lock = asyncio.Lock()
        if not path.exists():
            path.parent.mkdir(parents=True, exist_ok=True)
            self._write({"players": DEFAULT_PLAYERS, "matches": [], "next_id": 1})

    def _read(self) -> dict:
        return json.loads(self.path.read_text(encoding="utf-8"))

    def _write(self, db: dict) -> None:
        self.path.write_text(json.dumps(db, ensure_ascii=False, indent=2), encoding="utf-8")

    async def list_players(self) -> list[dict]:
        return self._read()["players"]

    async def update_player(self, pid: int, data: dict) -> Optional[dict]:
        async with self.lock:
            db = self._read()
            for p in db["players"]:
                if p["id"] == pid:
                    p.update(data)
                    self._write(db)
                    return p
        return None

    async def list_matches(self) -> list[dict]:
        rows = self._read()["matches"]
        return sorted(rows, key=lambda m: (m["played_at"], m["id"]))

    async def create_match(self, data: dict) -> dict:
        async with self.lock:
            db = self._read()
            row = {
                "id": db["next_id"],
                "created_at": datetime.now(timezone.utc).isoformat(),
                **data,
            }
            db["next_id"] += 1
            db["matches"].append(row)
            self._write(db)
            return row

    async def delete_match(self, mid: int) -> bool:
        async with self.lock:
            db = self._read()
            before = len(db["matches"])
            db["matches"] = [m for m in db["matches"] if m["id"] != mid]
            self._write(db)
            return len(db["matches"]) < before


def build_store():
    if SUPABASE_URL and SUPABASE_SERVICE_KEY:
        return SupabaseStore(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return LocalStore(Path(__file__).resolve().parent.parent / "data" / "local_db.json")
