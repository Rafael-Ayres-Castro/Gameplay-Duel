from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator

from .config import GAME_SLUGS


class MatchIn(BaseModel):
    game: str
    player1_score: int = Field(ge=0, le=999)
    player2_score: int = Field(ge=0, le=999)
    # 1 ou 2 = vencedor, 0 = empate, None = decidir pelo placar
    winner: Optional[int] = Field(default=None, ge=0, le=2)
    duration_minutes: Optional[int] = Field(default=None, ge=0, le=1440)
    notes: Optional[str] = Field(default=None, max_length=500)
    details: dict[str, Any] = Field(default_factory=dict)
    played_at: Optional[datetime] = None

    @field_validator("game")
    @classmethod
    def valid_game(cls, v: str) -> str:
        if v not in GAME_SLUGS:
            raise ValueError("Jogo inválido")
        return v

    @field_validator("details")
    @classmethod
    def clean_details(cls, v: dict) -> dict:
        out: dict[str, Any] = {}
        mode = v.get("mode")
        if isinstance(mode, str) and mode.strip():
            out["mode"] = mode.strip()[:80]
        for side in ("p1", "p2"):
            raw = v.get(side) or {}
            if not isinstance(raw, dict):
                continue
            nums = {}
            for k, val in raw.items():
                if val in (None, ""):
                    continue
                try:
                    nums[str(k)[:32]] = float(val)
                except (TypeError, ValueError):
                    continue
            if nums:
                out[side] = nums
        return out


class PlayerUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=24)
    nickname: Optional[str] = Field(default=None, max_length=12)
    color: Optional[str] = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
