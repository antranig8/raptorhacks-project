import supabase
import os

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

client: supabase.AClient = supabase.Client(supabase_url=SUPABASE_URL,supabase_key=SUPABASE_KEY)