from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    SUPABASE_URL: str
    # Service-role key — bypasses RLS. Must never be sent to the client.
    SUPABASE_SERVICE_ROLE_KEY: str
    OPENAI_API_KEY: str
    ANTHROPIC_API_KEY: str
    STORMGLASS_API_KEY: str

    class Config:
        env_file = ".env"


settings = Settings()
