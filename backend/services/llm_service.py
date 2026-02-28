import httpx
import json
import logging
from typing import AsyncGenerator
from fastapi import HTTPException

# Configure logging for the LLM service
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL_NAME = "llama3"

async def check_ollama_health() -> bool:
    """Check if the local Ollama instance is running and responding."""
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            response = await client.get("http://localhost:11434/api/tags")
            return response.status_code == 200
    except Exception:
        return False

async def stream_explanation(prompt: str) -> AsyncGenerator[str, None]:
    payload = {
        "model": MODEL_NAME,
        "prompt": prompt,
        "stream": True,
        "options": {"temperature": 0.5}
    }
    
    async with httpx.AsyncClient() as client:
        try:
            async with client.stream("POST", OLLAMA_URL, json=payload, timeout=60.0) as response:
                if response.status_code != 200:
                    yield f"Error from LLM: HTTP {response.status_code}"
                    return
                    
                async for line in response.aiter_lines():
                    if line:
                        data = json.loads(line)
                        if "response" in data:
                            yield data["response"]
        except Exception as e:
            logger.error(f"[LLM] Connection error during streaming explanation: {str(e)}")
            yield f"Error connecting to local LLM: {str(e)}"

async def generate_json_sync(prompt: str, json_format=True) -> str:
    """Used for Study Plans - expecting JSON back"""
    payload = {
        "model": MODEL_NAME,
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": 0.3} # lower temp for more reliable JSON
    }
    if json_format:
        payload["format"] = "json"
        
    logger.info(f"[LLM] Sending request to Ollama (model={MODEL_NAME}, prompt_len={len(prompt)})")
    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            response = await client.post(OLLAMA_URL, json=payload)
            if response.status_code == 200:
                data = response.json()
                resp_text = data.get("response", "{}")
                logger.info(f"[LLM] Response received successfully (len={len(resp_text)})")
                return resp_text
            
            logger.error(f"[LLM] Unexpected status code: {response.status_code}")
            raise HTTPException(status_code=503, detail=f"LLM service returned status {response.status_code}")
        except httpx.RequestError as e:
            logger.error(f"[LLM] Connection refused or timeout: {str(e)}. Ensure Ollama is running.")
            raise HTTPException(status_code=503, detail="LLM service is unreachable. Is Ollama running?")
        except Exception as e:
            logger.error(f"[LLM] Unexpected error during JSON generation: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))

