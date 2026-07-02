import asyncio
import sys

from sqlalchemy import text

from app.db.session import engine


async def main() -> None:
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as exc:
        print(f"[backend] database check failed: {exc}", file=sys.stderr)
        sys.exit(1)
