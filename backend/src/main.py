# Imports
from fastapi import FastAPI
from dotenv import load_dotenv
from pydantic import BaseModel
from .ai.groq import GroqAI
import os
#load the env for api_key
load_dotenv()
groq_api_key = os.getenv("GROQ_API_KEY")
# create the app
app = FastAPI()
# start on default host
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
@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    response_text = ai_platform.chat(request.prompt)
    return ChatResponse(response=response_text)


# create the instance of groq
ai_platform = GroqAI(api_key=groq_api_key, system_prompt=system_prompt)