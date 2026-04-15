"""
Centrale Anthropic API wrapper voor TenderZen.
Alle directe Claude API calls gaan via call_claude() zodat
logging, client-hergebruik en toekomstige uitbreidingen
op één plek beheerd worden.
"""
import anthropic
from app.config import settings
from app.services.ai_usage_logger import log_ai_usage

_client = None


def get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    return _client


def call_claude(
    messages: list,
    model: str,
    max_tokens: int = 4096,
    system: str = None,
    temperature: float = None,
    db=None,
    tender_id: str = None,
    bureau_id: str = None,
    call_type: str = 'ai_call',
    log_usage: bool = True,
) -> anthropic.types.Message:
    """
    Voer een Claude API call uit en log het token-verbruik.

    Args:
        messages:    Lijst van message-dicts (role/content).
        model:       Model-ID (bijv. 'claude-haiku-4-5-20251001').
        max_tokens:  Maximum output tokens.
        system:      Optioneel system-prompt.
        temperature: Optionele temperature (None = API default).
        db:          Supabase client voor logging (None = geen logging).
        tender_id:   UUID van de tender voor logging.
        bureau_id:   UUID van het bureau voor logging.
        call_type:   Categorie voor de usage log.
        log_usage:   False om logging te onderdrukken.

    Returns:
        anthropic.types.Message — ongewijzigde API response.
    """
    kwargs = dict(
        model=model,
        max_tokens=max_tokens,
        messages=messages,
    )
    if system is not None:
        kwargs['system'] = system
    if temperature is not None:
        kwargs['temperature'] = temperature

    response = get_client().messages.create(**kwargs)

    if log_usage and db is not None and bureau_id is not None:
        log_ai_usage(
            db=db,
            bureau_id=bureau_id,
            tender_id=tender_id,
            call_type=call_type,
            model=model,
            input_tokens=response.usage.input_tokens,
            output_tokens=response.usage.output_tokens,
        )

    return response
