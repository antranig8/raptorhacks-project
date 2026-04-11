import os

from dotenv import load_dotenv
from pathlib import Path
from ..ai.groq import GroqAI
from ..services.prompts import load_prompt

load_dotenv()

base_path = Path(__file__).parent


def _load_system_prompt(file: str) -> str:
    with open(file, "r", encoding="utf-8") as f:
        system_prompt = f.read()
    return system_prompt


def _build_quiz_system_prompt() -> str:
    prompt_parts = [_load_system_prompt(base_path.parent / "prompts" / "quiz_prompt.md")]
    # language_reference = load_prompt("quiz_languages_prompt.md")
    # if language_reference:
    #     prompt_parts.append(language_reference)
    return "\n\n".join(part.strip() for part in prompt_parts if part and part.strip())


def _build_advancement_system_prompt() -> str:
    return _load_system_prompt(base_path.parent / "prompts" / "skill_tree_advancement_prompt.md")


groq_api_key = os.getenv("GROQ_API_KEY")
skill_tree_platform = GroqAI(api_key=groq_api_key, system_prompt=None)
quiz_platform = GroqAI(api_key=groq_api_key, system_prompt=_load_system_prompt(base_path.parent / "prompts" / "quiz_prompt.md"))
ai_platform = GroqAI(api_key=groq_api_key, system_prompt=_load_system_prompt(base_path.parent / "prompts" / "skill_tree_prompt.md"))
advancement_platform = GroqAI(api_key=groq_api_key, system_prompt=_build_advancement_system_prompt())

def get_ai_platform() -> GroqAI:
    return ai_platform
