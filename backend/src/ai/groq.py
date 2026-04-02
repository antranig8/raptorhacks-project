from .base import AIPlatform
from groq import Groq
from ..schemas.ai import UsageInfo


# creating groq class
class GroqAI(AIPlatform):
    #constructor
    def __init__(self, api_key: str, system_prompt:str = None):
        self.client = Groq(api_key=api_key)
        self.system_prompt = system_prompt
        # llama-3.1-8b-instant is the first model used
        # llama-3.3-70b-versatile is also available for usage
        self.model = "llama-3.1-8b-instant"

    # chat that sends a prompt and returns a text response
    def chat(self, prompt: str) -> str:
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
            messages=messages
        )

        return response.choices[0].message.content

    def chat_messages(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 800,
    ) -> tuple[str, UsageInfo | None]:
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
