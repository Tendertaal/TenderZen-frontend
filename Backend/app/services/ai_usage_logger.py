"""
AI Usage Logger — TenderZen
Logt AI token verbruik naar de ai_usage_log tabel.
Non-fatal: een fout hier breekt de hoofdflow nooit.
"""
import logging

logger = logging.getLogger(__name__)

# Kosten per miljoen tokens in EUR (input / output)
KOSTEN_PER_MILJOEN = {
    'claude-haiku-4-5-20251001':  {'input': 0.80,  'output': 4.00},
    'claude-haiku-4-5-20250514':  {'input': 0.80,  'output': 4.00},
    'claude-sonnet-4-20250514':   {'input': 3.00,  'output': 15.00},
    'claude-sonnet-4-5-20250514': {'input': 3.00,  'output': 15.00},
    'claude-sonnet-4-6':          {'input': 3.00,  'output': 15.00},
    'claude-opus-4-6':            {'input': 15.00, 'output': 75.00},
}


def bereken_kosten(model: str, input_tokens: int, output_tokens: int) -> float:
    t = KOSTEN_PER_MILJOEN.get(model, {'input': 3.0, 'output': 15.0})
    return round(
        input_tokens  / 1_000_000 * t['input'] +
        output_tokens / 1_000_000 * t['output'],
        6
    )


def log_ai_usage(
    db,
    bureau_id: str,
    call_type: str,
    model: str,
    input_tokens: int,
    output_tokens: int,
    tender_id: str = None,
):
    """
    Schrijf één AI-call naar de ai_usage_log tabel.

    Args:
        db:            Supabase client
        bureau_id:     UUID van het tenderbureau
        call_type:     'smart_import' | 'ai_generatie' | 'backplanning'
        model:         Volledig model-ID, bijv. 'claude-haiku-4-5-20251001'
        input_tokens:  Aantal verbruikte input tokens
        output_tokens: Aantal verbruikte output tokens
        tender_id:     UUID van de tender (optioneel, None indien niet gekoppeld)
    """
    try:
        kosten = bereken_kosten(model, input_tokens, output_tokens)
        db.table('ai_usage_log').insert({
            'tender_id':     tender_id,
            'bureau_id':     bureau_id,
            'call_type':     call_type,
            'model':         model,
            'input_tokens':  input_tokens,
            'output_tokens': output_tokens,
            'kosten_eur':    kosten,
        }).execute()
        logger.debug(
            f"[ai_usage] {call_type} | {model} | "
            f"in={input_tokens} out={output_tokens} | €{kosten:.4f}"
        )
    except Exception as e:
        logger.warning(f"[ai_usage_logger] Logging mislukt (non-fatal): {e}")
