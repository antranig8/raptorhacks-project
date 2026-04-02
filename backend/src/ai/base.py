from abc import ABC, abstractmethod

from ..schemas.ai import UsageInfo

class AIPlatform(ABC):

    @abstractmethod
    def chat(self, prompt: str) -> str:
        """Sends a prompt to the AI and returns a response text."""
        pass

    @abstractmethod
    def chat_messages(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 800,
    ) -> tuple[str, UsageInfo | None]:
        """Sends chat messages to the AI and returns response text plus usage."""
        pass
