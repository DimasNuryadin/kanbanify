"""Root entrypoint module for `uvicorn main:app --port 8001` or `python main.py`."""

from __future__ import annotations

from app.main import app, create_app, run

__all__ = ["app", "create_app", "run"]

if __name__ == "__main__":
    run()
