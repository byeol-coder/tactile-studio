"""Serve the pre-made tactile vector library (Dot Space, etc.).

Lets the frontend browse ready-made tactile source vectors and feed any of them
straight into the conversion pipeline.
"""
from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from .. import config

router = APIRouter(prefix="/api/library", tags=["library"])


@router.get("")
def list_library() -> dict:
    manifest = config.LIBRARY_DIR / "library.json"
    if not manifest.exists():
        return {"collection": None, "count": 0, "items": []}
    return json.loads(manifest.read_text(encoding="utf-8"))


@router.get("/svg/{file_name}")
def get_svg(file_name: str):
    # Guard against path traversal — only plain .svg basenames are allowed.
    if "/" in file_name or ".." in file_name or not file_name.endswith(".svg"):
        raise HTTPException(400, "잘못된 파일명입니다.")
    path = config.LIBRARY_DIR / "svg" / file_name
    if not path.exists():
        raise HTTPException(404, "도안을 찾을 수 없습니다.")
    return Response(path.read_text(encoding="utf-8"), media_type="image/svg+xml")
