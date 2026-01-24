"""
Claude API Service
Wrapper for Anthropic Claude API calls
TenderPlanner v3.0 - AI Features
"""
import os
import json
import time
from typing import Optional, Dict, Any
from anthropic import Anthropic, APIError, APITimeoutError
from datetime import datetime


class ClaudeAPIService:
    """
    Service voor Claude API interacties.
    Handles prompt execution, token tracking, error handling.
    """
    
    # Default model
    DEFAULT_MODEL = "claude-sonnet-4-20250514"
    
    # Timeout settings
    REQUEST_TIMEOUT = 120  # 2 minutes
    MAX_RETRIES = 3
    
    def __init__(self, api_key: Optional[str] = None):
        """Initialize Claude API service."""
        self.api_key = api_key or os.getenv("ANTHROPIC_API_KEY")
        
        if not self.api_key:
            raise ValueError(
                "ANTHROPIC_API_KEY niet gevonden. "
                "Zet deze in .env file of geef mee aan constructor."
            )
        
        self.client = Anthropic(api_key=self.api_key)
        self.total_tokens_used = 0
    
    async def execute_prompt(
        self,
        system_prompt: str,
        user_prompt: str,
        model: str = DEFAULT_MODEL,
        max_tokens: int = 4000,
        temperature: float = 0.7,
        response_format: str = "json"
    ) -> Dict[str, Any]:
        """Execute een Claude prompt en return resultaat."""
        start_time = time.time()
        
        try:
            # Construct messages
            messages = [
                {
                    "role": "user",
                    "content": user_prompt
                }
            ]
            
            # Call Claude API
            response = self.client.messages.create(
                model=model,
                max_tokens=max_tokens,
                temperature=temperature,
                system=system_prompt,
                messages=messages
            )
            
            # Extract content
            content_text = response.content[0].text
            
            # Parse JSON if requested
            if response_format == "json":
                try:
                    content = json.loads(content_text)
                except json.JSONDecodeError as e:
                    print(f"⚠️ JSON parse error, returning raw text: {e}")
                    content = content_text
            else:
                content = content_text
            
            # Track tokens
            tokens_used = response.usage.input_tokens + response.usage.output_tokens
            self.total_tokens_used += tokens_used
            
            execution_time = time.time() - start_time
            
            print(f"✅ Claude API call successful ({tokens_used} tokens, {execution_time:.1f}s)")
            
            return {
                'success': True,
                'content': content,
                'tokens_used': tokens_used,
                'input_tokens': response.usage.input_tokens,
                'output_tokens': response.usage.output_tokens,
                'model_used': model,
                'execution_time_seconds': round(execution_time, 2),
                'error': None
            }
            
        except APITimeoutError as e:
            execution_time = time.time() - start_time
            print(f"❌ Claude API timeout after {execution_time:.1f}s")
            
            return {
                'success': False,
                'content': None,
                'tokens_used': 0,
                'model_used': model,
                'execution_time_seconds': round(execution_time, 2),
                'error': f"API timeout: {str(e)}"
            }
            
        except APIError as e:
            execution_time = time.time() - start_time
            print(f"❌ Claude API error: {e}")
            
            return {
                'success': False,
                'content': None,
                'tokens_used': 0,
                'model_used': model,
                'execution_time_seconds': round(execution_time, 2),
                'error': f"API error: {str(e)}"
            }
            
        except Exception as e:
            execution_time = time.time() - start_time
            print(f"❌ Unexpected error: {e}")
            
            return {
                'success': False,
                'content': None,
                'tokens_used': 0,
                'model_used': model,
                'execution_time_seconds': round(execution_time, 2),
                'error': f"Unexpected error: {str(e)}"
            }
    
    async def execute_prompt_with_retry(
        self,
        system_prompt: str,
        user_prompt: str,
        max_retries: int = MAX_RETRIES,
        **kwargs
    ) -> Dict[str, Any]:
        """Execute prompt met automatic retry bij failures."""
        for attempt in range(max_retries):
            result = await self.execute_prompt(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                **kwargs
            )
            
            if result['success']:
                return result
            
            # Retry logic
            if attempt < max_retries - 1:
                wait_seconds = 2 ** attempt
                print(f"⏳ Retry {attempt + 1}/{max_retries} na {wait_seconds}s...")
                time.sleep(wait_seconds)
        
        print(f"❌ Alle {max_retries} pogingen mislukt")
        return result
    
    async def analyze_tender_document(
        self,
        document_text: str,
        analysis_focus: str = "general"
    ) -> Dict[str, Any]:
        """Analyseer een tender document met Claude."""
        system_prompt = """Je bent een expert tender analist. 
Je taak is om aanbestedingsdocumenten te analyseren en de belangrijkste informatie te extraheren.
Geef altijd je antwoord in valide JSON format."""
        
        user_prompt = f"""
Analyseer dit aanbestedingsdocument en extract de volgende informatie:

1. Opdrachtgever (naam organisatie)
2. Tender type (Europese aanbesteding, nationale, etc.)
3. Onderwerp/titel van de opdracht
4. Deadline inschrijving (datum + tijd)
5. Geraamde waarde (indien vermeld)
6. Gunningscriteria (lijst met percentages)
7. Verplichte certificeringen
8. Belangrijke data (schouw, presentatie, etc.)

DOCUMENT TEXT:
{document_text[:15000]}

Geef het resultaat als JSON in dit format:
{{
    "opdrachtgever": "naam",
    "tender_type": "type",
    "onderwerp": "beschrijving",
    "deadline_inschrijving": "YYYY-MM-DD HH:MM",
    "geraamde_waarde": 123456,
    "gunningscriteria": [
        {{"code": "K1", "naam": "Kwaliteit", "punten": 50}},
        {{"code": "P1", "naam": "Prijs", "punten": 50}}
    ],
    "certificeringen": ["ISO 9001", "VCA"],
    "belangrijke_data": {{
        "schouw": "YYYY-MM-DD",
        "presentatie": "YYYY-MM-DD"
    }}
}}
"""
        
        return await self.execute_prompt_with_retry(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            response_format="json",
            max_tokens=3000,
            temperature=0.3
        )
    
    def get_token_usage_stats(self) -> Dict[str, int]:
        """Return token usage statistics"""
        return {
            'total_tokens_used': self.total_tokens_used,
            'estimated_cost_usd': self.total_tokens_used * 0.000015
        }