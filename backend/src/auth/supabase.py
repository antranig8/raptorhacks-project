import os
from inspect import isawaitable
from typing import Any

import supabase

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

client: supabase.AsyncClient = supabase.AsyncClient(
    supabase_url=SUPABASE_URL,
    supabase_key=SUPABASE_KEY,
)


async def execute_query(query: Any) -> Any:
    result = query.execute()
    if isawaitable(result):
        return await result
    return result
