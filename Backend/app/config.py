"""
TenderPlanner Configuration
Python/FastAPI equivalent of Node.js env.js
Uses Pydantic Settings for type-safe configuration with validation
"""

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.
    Provides type hints, validation, and default values.
    """
    
    # Model configuration
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )
    
    # Environment
    environment: str = Field(default="development", alias="NODE_ENV")
    port: int = Field(default=3000, alias="PORT")
    frontend_url: str = Field(default="http://localhost:8000", alias="FRONTEND_URL")
    
    # Supabase Configuration
    supabase_url: str = Field(..., alias="SUPABASE_URL")
    supabase_service_role_key: str = Field(..., alias="SUPABASE_SERVICE_ROLE_KEY")
    supabase_anon_key: str = Field(..., alias="SUPABASE_ANON_KEY")
    
    # JWT Configuration
    jwt_secret: str = Field(..., alias="JWT_SECRET")
    jwt_algorithm: str = Field(default="HS256")
    jwt_expires_in_days: int = Field(default=7)
    
    # Rate Limiting
    rate_limit_window_minutes: int = Field(default=15)
    rate_limit_max_requests: int = Field(default=100)
    
    # Optional Features (AI, Email, etc.)
    openai_api_key: Optional[str] = Field(default=None, alias="OPENAI_API_KEY")
    sendgrid_api_key: Optional[str] = Field(default=None, alias="SENDGRID_API_KEY")
    
    # CORS Settings
    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:8000", "http://127.0.0.1:8000"]
    )
    
    @field_validator("port")
    @classmethod
    def validate_port(cls, v: int) -> int:
        """Validate port is in valid range"""
        if not 1 <= v <= 65535:
            raise ValueError("Port must be between 1 and 65535")
        return v
    
    @field_validator("supabase_url")
    @classmethod
    def validate_supabase_url(cls, v: str) -> str:
        """Validate Supabase URL format"""
        if not v.startswith("https://"):
            raise ValueError("Supabase URL must start with https://")
        if not v.endswith(".supabase.co"):
            raise ValueError("Supabase URL must end with .supabase.co")
        return v
    
    @property
    def ai_enabled(self) -> bool:
        """Check if AI features are enabled"""
        return bool(self.openai_api_key)
    
    @property
    def email_enabled(self) -> bool:
        """Check if email features are enabled"""
        return bool(self.sendgrid_api_key)
    
    @property
    def is_development(self) -> bool:
        """Check if running in development mode"""
        return self.environment.lower() in ("development", "dev")
    
    @property
    def is_production(self) -> bool:
        """Check if running in production mode"""
        return self.environment.lower() in ("production", "prod")
    
    @property
    def rate_limit_window_seconds(self) -> int:
        """Get rate limit window in seconds"""
        return self.rate_limit_window_minutes * 60
    
    def __repr__(self) -> str:
        """Safe representation without exposing secrets"""
        return (
            f"Settings(environment={self.environment}, "
            f"port={self.port}, "
            f"ai_enabled={self.ai_enabled}, "
            f"email_enabled={self.email_enabled})"
        )


# Global settings instance
# This will be created once when the app starts
settings = Settings()


# Helper function to reload settings (useful for testing)
def get_settings() -> Settings:
    """
    Get settings instance.
    Can be used as a FastAPI dependency for testing.
    """
    return settings


if __name__ == "__main__":
    # Test configuration loading
    print("🔧 TenderPlanner Configuration")
    print("=" * 50)
    print(f"Environment: {settings.environment}")
    print(f"Port: {settings.port}")
    print(f"Frontend URL: {settings.frontend_url}")
    print(f"Supabase URL: {settings.supabase_url}")
    print(f"AI Enabled: {settings.ai_enabled}")
    print(f"Email Enabled: {settings.email_enabled}")
    print(f"Rate Limit: {settings.rate_limit_max_requests} requests per {settings.rate_limit_window_minutes} minutes")
    print("=" * 50)
    print("✅ Configuration loaded successfully!")
