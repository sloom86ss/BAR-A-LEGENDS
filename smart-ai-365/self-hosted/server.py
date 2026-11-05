import os
import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434").rstrip("/")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen3:8b")
ALLOWED_ORIGIN = os.getenv("ALLOWED_ORIGIN", "http://localhost:8080")

app = FastAPI(title="SMART AI 365 API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[x.strip() for x in ALLOWED_ORIGIN.split(",") if x.strip()],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)

class Message(BaseModel):
    role: str
    content: str = Field(min_length=1, max_length=6000)

class ChatRequest(BaseModel):
    messages: list[Message] = Field(min_length=1, max_length=12)

@app.get("/health")
async def health():
    return {"ok": True, "service": "SMART AI 365", "engine": "Ollama / Qwen3", "model": OLLAMA_MODEL}

@app.post("/api/chat")
async def chat(payload: ChatRequest, request: Request):
    if payload.messages[-1].role != "user":
        raise HTTPException(status_code=400, detail="آخر رسالة يجب أن تكون من المستخدم.")
    for item in payload.messages:
        if item.role not in ("user", "assistant"):
            raise HTTPException(status_code=400, detail="صيغة الرسائل غير صحيحة.")

    system = (
        "You are SMART AI 365, a careful multilingual assistant. Reply in the same language "
        "as the user's latest message unless asked otherwise. Support Arabic, English, Hindi "
        "and other languages. Be accurate and clear. Verify calculations carefully. Provide "
        "usable code and state assumptions. Never invent facts, citations, live data, or tools. "
        "If uncertain or outdated, say so. Distinguish facts from estimates and opinions."
    )
    messages = [{"role": "system", "content": system}]
    messages.extend({"role": m.role, "content": m.content.strip()} for m in payload.messages)

    try:
        async with httpx.AsyncClient(timeout=180.0) as client:
            response = await client.post(
                f"{OLLAMA_URL}/api/chat",
                json={
                    "model": OLLAMA_MODEL,
                    "messages": messages,
                    "stream": False,
                    "options": {"temperature": 0.35, "num_predict": 1400},
                },
            )
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"تعذر الاتصال بمحرك Qwen3: {exc.__class__.__name__}") from exc

    answer = (data.get("message") or {}).get("content", "").strip()
    if not answer:
        raise HTTPException(status_code=502, detail="لم يصل رد صالح من النموذج.")
    return {"ok": True, "answer": answer, "model": OLLAMA_MODEL}
