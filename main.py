import os
import json
import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from pydantic import BaseModel
from typing import List, Dict, Optional

# Load environment variables
load_dotenv()

# Initialize Rate Limiter
limiter = Limiter(key_func=get_remote_address)

# Initialize FastAPI App
app = FastAPI(title="Nemoplay")
app.state.limiter = limiter

# Custom Rate Limit Handler
async def custom_rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={
            "error_type": "QUOTA_EXHAUSTED",
            "detail": "Rate limit exceeded (10 requests per 10 minutes per IP). Please enter your custom API key or try again later."
        }
    )

app.add_exception_handler(RateLimitExceeded, custom_rate_limit_handler)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration Defaults
DEFAULT_NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY", "")
DEFAULT_MODEL = os.getenv("NVIDIA_MODEL", "nvidia/nemotron-3-ultra-550b-a55b")
NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions"

class ChatRequest(BaseModel):
    messages: List[Dict[str, str]]
    persona: Optional[str] = "General Assistant"
    custom_api_key: Optional[str] = None

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "app": "Nemoplay",
        "nvidia_api_key_configured": bool(DEFAULT_NVIDIA_API_KEY),
        "default_model": DEFAULT_MODEL
    }

@app.post("/api/chat")
@limiter.limit("10/10minutes")
async def chat_endpoint(request: Request, body: ChatRequest):
    api_key = body.custom_api_key.strip() if body.custom_api_key else DEFAULT_NVIDIA_API_KEY

    if not api_key:
        raise HTTPException(
            status_code=401, 
            detail="NVIDIA API Key is missing. Please provide a key in settings or set NVIDIA_API_KEY in .env"
        )

    # Persona Injection
    persona_prompts = {
        "General Assistant": "You are Nemoplay AI, an intelligent, helpful, and concise AI assistant powered by NVIDIA Nemotron 3 Ultra.",
        "Coding & Data Science Expert": "You are an expert Data Scientist and Full-Stack Developer. Always provide complete, executable, production-grade code snippets with clear explanations and markdown formatting.",
        "System Architect": "You are a Senior Principal System Architect. Provide clear architectural breakdowns, schemas, high-level system diagrams, and best design practices."
    }
    
    system_instruction = persona_prompts.get(body.persona, persona_prompts["General Assistant"])
    
    # Format messages
    formatted_messages = [{"role": "system", "content": system_instruction}]
    for msg in body.messages:
        if msg.get("role") != "system":
            formatted_messages.append(msg)

    payload = {
        "model": DEFAULT_MODEL,
        "messages": formatted_messages,
        "temperature": 0.7,
        "top_p": 0.95,
        "max_tokens": 4096,
        "stream": True
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Accept": "text/event-stream"
    }

    async def stream_generator():
        client = httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=10.0))
        try:
            async with client.stream("POST", NVIDIA_API_URL, json=payload, headers=headers) as response:
                if response.status_code in [402, 429]:
                    yield f"data: {json.dumps({'error_type': 'QUOTA_EXHAUSTED', 'text': '⚠️ Token quota exceeded on server. Please use your custom NVIDIA API key.'})}\n\n"
                    return
                elif response.status_code != 200:
                    err_text = await response.aread()
                    yield f"data: {json.dumps({'error': f'NVIDIA API Error ({response.status_code}): {err_text.decode()}'})}\n\n"
                    return

                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data_str = line[6:].strip()
                        if data_str == "[DONE]":
                            yield "data: [DONE]\n\n"
                            break
                        try:
                            chunk = json.loads(data_str)
                            delta = chunk.get("choices", [{}])[0].get("delta", {})
                            
                            # Instantly capture normal text or reasoning tokens without delay
                            content = delta.get("content") or delta.get("reasoning_content") or ""
                            if content:
                                yield f"data: {json.dumps({'text': content})}\n\n"
                        except Exception:
                            continue
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        finally:
            await client.aclose()

    return StreamingResponse(
        stream_generator(), 
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

# Mount Static Files
app.mount("/", StaticFiles(directory="static", html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)