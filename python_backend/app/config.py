from dataclasses import dataclass
import os


@dataclass(frozen=True)
class Settings:
    database_url: str = os.getenv("DATABASE_URL", "")
    llama_cloud_api_key: str = os.getenv("LLAMA_CLOUD_API_KEY", "")
    groq_api_key: str = os.getenv("GROQ_API_KEY", "")
    cohere_api_key: str = os.getenv("COHERE_API_KEY", "")


settings = Settings()
