# src/ai/base.py
# This is incase of future use, where an updated AI is needed
from abc import ABC, abstractmethod

class AIPlatform(ABC):

    @abstractmethod
    def chat(self, prompt: str) -> str:
        """Sends a prompt to the AI and returns a response text."""
        pass