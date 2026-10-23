import base64
import json
import logging
import re
from typing import Optional, Dict, Any, List
import httpx
from app.config import settings
from app.repository.social import SocialSettingsRepository
from app.utils.social_crypto import decrypt_social_token
from app.services.social.utils import mask

logger = logging.getLogger("hrms.social")

def extract_json_from_response(text: str) -> Dict[str, Any]:
    """Extracts JSON dict from raw LLM output, handling markdown blocks."""
    if not text or not isinstance(text, str):
        raise ValueError("Empty response from LLM")
    
    text = text.strip()
    
    # Try direct parse
    try:
        return json.loads(text)
    except Exception:
        pass
    
    # Match ```json ... ``` or ``` ... ```
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text, re.IGNORECASE)
    if match:
        extracted = match.group(1).strip()
        try:
            return json.loads(extracted)
        except Exception:
            pass

    # Find first { and last }
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        candidate = text[start:end+1]
        try:
            return json.loads(candidate)
        except Exception:
            pass

    raise ValueError(f"Could not extract valid JSON from LLM response: {text[:200]}")

class LlmClient:
    """Unified LLM client with automatic fallback from Gemini to Groq."""

    @classmethod
    async def get_effective_keys(cls) -> Dict[str, str]:
        """Loads API keys from database with fallback to settings (.env)."""
        db_settings = await SocialSettingsRepository.get_effective_settings()
        
        gemini_key = db_settings.get("GEMINI_API_KEY")
        if gemini_key:
            gemini_key = decrypt_social_token(gemini_key)
        if not gemini_key:
            gemini_key = getattr(settings, "GEMINI_API_KEY", "") or ""

        groq_1 = db_settings.get("GROQ_API_KEY_1")
        if groq_1:
            groq_1 = decrypt_social_token(groq_1)
        if not groq_1:
            groq_1 = getattr(settings, "GROQ_API_KEY_1", "") or ""

        groq_2 = db_settings.get("GROQ_API_KEY_2")
        if groq_2:
            groq_2 = decrypt_social_token(groq_2)
        if not groq_2:
            groq_2 = getattr(settings, "GROQ_API_KEY_2", "") or ""

        return {
            "gemini_api_key": gemini_key,
            "groq_api_key_1": groq_1,
            "groq_api_key_2": groq_2,
            "gemini_model": db_settings.get("DEFAULT_GEMINI_MODEL") or getattr(settings, "DEFAULT_GEMINI_MODEL", "gemini-2.5-flash"),
            "groq_model": db_settings.get("DEFAULT_GROQ_MODEL") or getattr(settings, "DEFAULT_GROQ_MODEL", "llama-3.3-70b-versatile"),
        }

    @classmethod
    async def call_gemini(
        cls,
        api_key: str,
        model: str,
        prompt: str,
        system_prompt: Optional[str] = None,
        image_bytes: Optional[bytes] = None,
        mime_type: Optional[str] = "image/jpeg"
    ) -> str:
        """Invokes Gemini v1beta REST API."""
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        
        parts: List[Dict[str, Any]] = []
        if image_bytes:
            b64_data = base64.b64encode(image_bytes).decode("utf-8")
            parts.append({
                "inlineData": {
                    "mimeType": mime_type or "image/jpeg",
                    "data": b64_data
                }
            })
        
        full_user_prompt = prompt
        parts.append({"text": full_user_prompt})
        
        payload: Dict[str, Any] = {
            "contents": [
                {
                    "role": "user",
                    "parts": parts
                }
            ],
            "generationConfig": {
                "temperature": 0.7,
                "topP": 0.95,
                "maxOutputTokens": 4096,
                "responseMimeType": "application/json"
            }
        }
        
        if system_prompt:
            payload["systemInstruction"] = {
                "role": "system",
                "parts": [{"text": system_prompt}]
            }

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code != 200:
                raise RuntimeError(f"Gemini API error ({resp.status_code}): {resp.text}")
            
            data = resp.json()
            candidates = data.get("candidates", [])
            if not candidates:
                raise RuntimeError("Gemini returned no candidates.")
            
            parts = candidates[0].get("content", {}).get("parts", [])
            text_result = "".join(p.get("text", "") for p in parts)
            return text_result

    @classmethod
    async def call_groq(
        cls,
        api_key: str,
        model: str,
        prompt: str,
        system_prompt: Optional[str] = None
    ) -> str:
        """Invokes Groq OpenAI-compatible Chat Completions API."""
        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": model,
            "messages": messages,
            "temperature": 0.7,
            "max_tokens": 4096,
            "response_format": {"type": "json_object"}
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            if resp.status_code != 200:
                raise RuntimeError(f"Groq API error ({resp.status_code}): {resp.text}")
            
            data = resp.json()
            choices = data.get("choices", [])
            if not choices:
                raise RuntimeError("Groq returned no choices.")
            
            return choices[0].get("message", {}).get("content", "")

    @classmethod
    async def generate_json(
        cls,
        prompt: str,
        system_prompt: str,
        image_bytes: Optional[bytes] = None,
        mime_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """Executes LLM call with Gemini -> Groq 1 -> Groq 2 fallback chain."""
        keys = await cls.get_effective_keys()
        errors: List[str] = []

        # 1. Attempt Gemini (supports multimodal if image provided)
        if keys["gemini_api_key"]:
            try:
                raw = await cls.call_gemini(
                    api_key=keys["gemini_api_key"],
                    model=keys["gemini_model"],
                    prompt=prompt,
                    system_prompt=system_prompt,
                    image_bytes=image_bytes,
                    mime_type=mime_type
                )
                parsed = extract_json_from_response(raw)
                return parsed
            except Exception as e:
                err_msg = f"Gemini failed: {str(e)}"
                logger.warning(err_msg)
                errors.append(err_msg)

        # If image was required and Gemini failed, Groq doesn't support images on standard tier
        if image_bytes:
            raise RuntimeError(
                f"Multimodal image generation failed. Gemini was unable to process the image and Groq does not support image analysis: {'; '.join(errors)}"
            )

        # 2. Attempt Groq Key 1
        if keys["groq_api_key_1"]:
            try:
                raw = await cls.call_groq(
                    api_key=keys["groq_api_key_1"],
                    model=keys["groq_model"],
                    prompt=prompt,
                    system_prompt=system_prompt
                )
                parsed = extract_json_from_response(raw)
                return parsed
            except Exception as e:
                err_msg = f"Groq Key 1 failed: {str(e)}"
                logger.warning(err_msg)
                errors.append(err_msg)

        # 3. Attempt Groq Key 2
        if keys["groq_api_key_2"]:
            try:
                raw = await cls.call_groq(
                    api_key=keys["groq_api_key_2"],
                    model=keys["groq_model"],
                    prompt=prompt,
                    system_prompt=system_prompt
                )
                parsed = extract_json_from_response(raw)
                return parsed
            except Exception as e:
                err_msg = f"Groq Key 2 failed: {str(e)}"
                logger.warning(err_msg)
                errors.append(err_msg)

        if not keys["gemini_api_key"] and not keys["groq_api_key_1"]:
            raise RuntimeError(
                "No AI API keys configured. Please add GEMINI_API_KEY or GROQ_API_KEY in Social Settings or .env"
            )

        raise RuntimeError(f"All AI LLM providers failed: {'; '.join(errors)}")
