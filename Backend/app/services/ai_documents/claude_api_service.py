# app/services/ai_documents/claude_api_service.py
"""
Claude API Service
TenderZen v2.0

v2.0 NIEUW:
- Model parameter in execute_prompt_with_retry() 
- Ondersteunt wisselen tussen Haiku (standaard) en Sonnet (pro)
- Model info in response voor tracking

MODELLEN:
- claude-haiku-4-5-20251001 (standaard) - Snel, goedkoop
- claude-sonnet-4-20250514 (pro) - Nauwkeuriger, duurder

"""
import json
import logging
import time
from typing import Dict, Any, Optional
import anthropic

logger = logging.getLogger(__name__)

# Model constanten
MODEL_HAIKU = "claude-haiku-4-5-20251001"      # Standaard - snel, goedkoop
MODEL_SONNET = "claude-sonnet-4-20250514"      # Pro - nauwkeuriger
DEFAULT_MODEL = MODEL_HAIKU


class ClaudeAPIService:
    """
    Service voor Claude API interacties.
    v2.0: Ondersteunt model keuze (Haiku vs Sonnet)
    """
    
    def __init__(self, api_key: str):
        """
        Initialize Claude API client.
        
        Args:
            api_key: Anthropic API key
        """
        if not api_key:
            raise ValueError("Anthropic API key is required")
        
        self.client = anthropic.Anthropic(api_key=api_key)
        self.default_model = DEFAULT_MODEL
        logger.info(f"✅ ClaudeAPIService initialized with default model: {self.default_model}")
    
    async def execute_prompt_with_retry(
        self,
        system_prompt: str,
        user_prompt: str,
        response_format: str = "text",
        max_tokens: int = 4096,
        temperature: float = 0.3,
        max_retries: int = 3,
        model: Optional[str] = None,  # v2.0: Model parameter
        db=None,
        tender_id: Optional[str] = None,
        bureau_id: Optional[str] = None,
        call_type: str = 'ai_call',
        log_usage: bool = True,
    ) -> Dict[str, Any]:
        """
        Execute a prompt with automatic retry on failure.
        
        Args:
            system_prompt: System instruction for Claude
            user_prompt: User's prompt/question
            response_format: "text" or "json"
            max_tokens: Maximum tokens in response
            temperature: Creativity setting (0-1)
            max_retries: Number of retry attempts
            model: Model to use (None = default Haiku, "sonnet" = Sonnet Pro)
        
        Returns:
            Dict with success, content, model, usage info
        """
        # v2.0: Bepaal welk model te gebruiken
        if model == "sonnet" or model == MODEL_SONNET:
            selected_model = MODEL_SONNET
        elif model == "haiku" or model == MODEL_HAIKU or model is None:
            selected_model = MODEL_HAIKU
        else:
            # Probeer als exacte model string
            selected_model = model if model else self.default_model
        
        logger.info(f"🤖 Using model: {selected_model}")
        
        last_error = None
        
        for attempt in range(max_retries):
            try:
                logger.info(f"📤 API call attempt {attempt + 1}/{max_retries}")
                
                # Build messages
                messages = [
                    {"role": "user", "content": user_prompt}
                ]
                
                # Make API call
                response = self.client.messages.create(
                    model=selected_model,
                    max_tokens=max_tokens,
                    temperature=temperature,
                    system=system_prompt,
                    messages=messages
                )
                
                # Extract content
                content = ""
                if response.content:
                    for block in response.content:
                        if hasattr(block, 'text'):
                            content += block.text
                
                # Parse JSON if requested
                if response_format == "json":
                    try:
                        # Try to parse, but return raw string if it fails
                        # (caller will handle parsing)
                        pass  # Keep as string, let caller parse
                    except:
                        pass
                
                stop_reason = getattr(response, 'stop_reason', None)
                if stop_reason == 'max_tokens':
                    logger.warning(f"⚠️ Response afgekapt door max_tokens limiet. Ontvangen: {len(content)} tekens.")
                    return {
                        "success": False,
                        "error": f"Response afgekapt door max_tokens limiet. Ontvangen: {len(content)} tekens.",
                        "truncated": True,
                        "content": content
                    }

                logger.info(f"✅ API call successful, response length: {len(content)}")

                if log_usage and db is not None:
                    try:
                        from app.services.ai_usage_logger import log_ai_usage
                        log_ai_usage(
                            db=db,
                            bureau_id=bureau_id,
                            tender_id=tender_id,
                            call_type=call_type,
                            model=selected_model,
                            input_tokens=getattr(response.usage, 'input_tokens', 0),
                            output_tokens=getattr(response.usage, 'output_tokens', 0),
                        )
                    except Exception as e:
                        print(f"[claude_api_service] Logging mislukt (non-fatal): {e}")

                return {
                    "success": True,
                    "content": content,
                    "model": selected_model,
                    "model_type": "pro" if selected_model == MODEL_SONNET else "standaard",
                    "usage": {
                        "input_tokens": response.usage.input_tokens,
                        "output_tokens": response.usage.output_tokens
                    }
                }
                
            except anthropic.RateLimitError as e:
                last_error = str(e)
                wait_time = (attempt + 1) * 5
                logger.warning(f"⚠️ Rate limit hit, waiting {wait_time}s...")
                time.sleep(wait_time)
                
            except anthropic.APIError as e:
                last_error = str(e)
                logger.error(f"❌ API error: {e}")
                if attempt < max_retries - 1:
                    time.sleep(2)
                    
            except Exception as e:
                last_error = str(e)
                logger.exception(f"❌ Unexpected error: {e}")
                if attempt < max_retries - 1:
                    time.sleep(1)
        
        # All retries failed
        logger.error(f"❌ All {max_retries} attempts failed")
        return {
            "success": False,
            "error": last_error or "Unknown error",
            "model": selected_model
        }
    
    def get_available_models(self) -> Dict[str, Dict[str, Any]]:
        """
        Return available models with their properties.
        
        Returns:
            Dict with model info for UI display
        """
        return {
            "haiku": {
                "id": MODEL_HAIKU,
                "name": "Standaard (Haiku)",
                "description": "Snel en goedkoop - geschikt voor de meeste documenten",
                "speed": "fast",
                "cost": "low",
                "accuracy": "good"
            },
            "sonnet": {
                "id": MODEL_SONNET,
                "name": "Pro (Sonnet)",
                "description": "Nauwkeuriger analyse - voor complexe aanbestedingen",
                "speed": "medium", 
                "cost": "medium",
                "accuracy": "excellent"
            }
        }
