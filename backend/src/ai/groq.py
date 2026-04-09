from .base import AIPlatform
from groq import Groq
from ..schemas.ai import UsageInfo
import re


def _clean_llm_json(raw_output: str):
    # Remove the <think> tags and everything inside them
    clean_text = re.sub(r'<think>.*?</think>', '', raw_output, flags=re.DOTALL)
    # Remove markdown code blocks if they exist
    clean_text = re.sub(r'```json|```', '', clean_text)
    return clean_text.strip()

# creating groq class
class GroqAI(AIPlatform):
    #constructor
    def __init__(self, api_key: str, system_prompt:str = None, model:str = "qwen/qwen3-32b"):
        self.client = Groq(api_key=api_key)
        self.system_prompt = system_prompt
        # llama-3.1-8b-instant is the first model used
        # llama-3.3-70b-versatile is also available for usage
        self.model = model

    # chat that sends a prompt and returns a text response
    def chat(self, prompt: str,
             temperature: float = 0.7,
             max_tokens: int = 800) -> str:
        messages = []

        if self.system_prompt:
            messages.append({
                "role": "system",
                "content": self.system_prompt
            })

        messages.append({
            "role": "user",
            "content": prompt
        })

        response = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=temperature,
            max_completion_tokens=max_tokens,
        )

        return _clean_llm_json(response.choices[0].message.content)

    def chat_messages(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 800,
    ) -> tuple[str, UsageInfo | None]:
        # Reuse the configured system prompt for structured-generation routes
        # unless the caller already supplied an explicit system message.
        if self.system_prompt and not any(message.get("role") == "system" for message in messages):
            messages = [{"role": "system", "content": self.system_prompt}, *messages]

        response = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=temperature,
            max_completion_tokens=max_tokens,
        )

        usage = None
        if getattr(response, "usage", None):
            usage = UsageInfo(
                prompt_tokens=getattr(response.usage, "prompt_tokens", None),
                completion_tokens=getattr(response.usage, "completion_tokens", None),
                total_tokens=getattr(response.usage, "total_tokens", None),
            )

        return response.choices[0].message.content, usage
