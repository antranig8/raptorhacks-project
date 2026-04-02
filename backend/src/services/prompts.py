from pathlib import Path


PROMPTS_DIR = Path(__file__).resolve().parents[1] / "prompts"


def load_prompt(filename: str) -> str | None:
    try:
        return (PROMPTS_DIR / filename).read_text(encoding="utf-8")
    except FileNotFoundError:
        return None
