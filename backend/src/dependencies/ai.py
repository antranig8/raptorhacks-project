import os

from dotenv import load_dotenv

from ..ai.groq import GroqAI

load_dotenv()

groq_api_key = os.getenv("GROQ_API_KEY")
ai_platform = GroqAI(api_key=groq_api_key, system_prompt=None)


def get_ai_platform() -> GroqAI:
    return ai_platform
