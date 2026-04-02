# Imports
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
load_dotenv()
from pydantic import BaseModel
from .ai.groq import GroqAI
from .router import public, private
from .auth.throttling import (
    rate_limit_authenticated,
    rate_limit_chat,
    rate_limit_public,
)
import os
#load the env for api_key
groq_api_key = os.getenv("GROQ_API_KEY")
# create the app
app = FastAPI()
# start on default host

origins = [
    "http://localhost:5173",  # Vite default
    "http://localhost:3000",  # Vite default
    "http://127.0.0.1:5173",
]

# 2. Add the middleware to your FastAPI app
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,        # Or use ["*"] for development only
    allow_credentials=True,
    allow_methods=["*"],           # Allows all methods (GET, POST, etc.)
    allow_headers=["*"],           # Allows all headers
)


app.include_router(
    private.router,
    prefix="/api/v1/private",
    dependencies=[Depends(rate_limit_authenticated)]
)

app.include_router(
    public.router,
    prefix="/api/v1/public",
    dependencies=[Depends(rate_limit_public)]
)

@app.get("/")
async def root():
    return {"message": "FastAPI Backend is running"}

# USING Pydantic models (for automatic data validation)
class ChatRequest(BaseModel):
    prompt: str #expecting the JSON body like {"prompt": "..."}

class ChatResponse(BaseModel):
    response: str #expecting the JSON body like {"response": "..."}

# AI System Prompt Config
def load_system_prompt():
    try:
        with open("src/prompts/system_prompt.md", "r") as f:
            return f.read()
    except FileNotFoundError:
        return None

system_prompt = load_system_prompt()

# API endpoint
@app.post("/chat", response_model=ChatResponse, dependencies=[Depends(rate_limit_chat)])
async def chat(request: ChatRequest):
    response_text = ai_platform.chat(request.prompt)
    return ChatResponse(response=response_text)


# create the instance of groq
ai_platform = GroqAI(api_key=groq_api_key, system_prompt=system_prompt)
