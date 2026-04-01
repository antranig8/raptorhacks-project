#
from .base import AIPlatform
from groq import Groq
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
