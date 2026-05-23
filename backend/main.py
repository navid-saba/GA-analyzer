import os
import io
import json
import base64
import wave
import httpx
import pandas as pd
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*")
origins = ["*"] if ALLOWED_ORIGINS == "*" else [o.strip() for o in ALLOWED_ORIGINS.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
TTS_PROVIDER = os.getenv("TTS_PROVIDER", "gemini").lower()
GEMINI_TTS_MODEL = os.getenv("GEMINI_TTS_MODEL", "gemini-2.5-flash-preview-tts")
GEMINI_TTS_VOICE = os.getenv("GEMINI_TTS_VOICE", "Kore")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID")
ELEVENLABS_MODEL_ID = os.getenv("ELEVENLABS_MODEL_ID", "eleven_multilingual_v2")

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)


def _pcm_to_wav(pcm_bytes: bytes, rate: int = 24000) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(rate)
        wf.writeframes(pcm_bytes)
    return buf.getvalue()


def _concat_wav_parts(wav_parts: list[bytes]) -> bytes:
    if len(wav_parts) == 1:
        return wav_parts[0]

    frames: list[bytes] = []
    params = None
    for part in wav_parts:
        with wave.open(io.BytesIO(part), "rb") as wf:
            if params is None:
                params = wf.getparams()
            frames.append(wf.readframes(wf.getnframes()))

    out = io.BytesIO()
    with wave.open(out, "wb") as wf:
        wf.setparams(params)
        wf.writeframes(b"".join(frames))
    return out.getvalue()


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "tts_provider": TTS_PROVIDER,
        "gemini_configured": bool(GEMINI_API_KEY),
        "elevenlabs_configured": bool(ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID),
    }


@app.post("/analyse")
async def analyse(file: UploadFile = File(...)):
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY is not set in the environment")

    if not file.filename.endswith(('.csv', '.xlsx')):
        raise HTTPException(status_code=400, detail="Only CSV and XLSX files are supported")

    try:
        if file.filename.endswith('.csv'):
            df = pd.read_csv(file.file, comment='#')
        else:
            df = pd.read_excel(file.file)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(e)}")

    csv_data = df.to_csv(index=False)

    prompt = """
    Analyze the following data and return a single JSON object with these exact keys:
    - "summary_table": array of { "metric", "value", "change" } — extract all available metrics including sessions, users, conversions, bounce rate, top pages, revenue if present. Calculate change if possible or set to "N/A".
    - "questions_and_answers": array of { "question", "answer" } — 5 to 7 executive-relevant questions derived from data patterns, each answered in 2–3 sentences using only the data.
    - "exec_summary": array of 5 objects { "area", "key_finding", "implication" }
    - "podcast_script": string, ~550 words, single host, plain spoken language, no jargon, no bullet points, structured as: short intro -> key findings -> 3 highlights -> 1 risk or opportunity -> close with one clear recommendation.

    Return ONLY valid JSON. No markdown formatting, no backticks, no markdown code blocks. Just the raw JSON object.

    Data:
    """ + csv_data

    model = genai.GenerativeModel('gemini-flash-latest')

    def try_generate():
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                response_mime_type="application/json"
            )
        )
        return json.loads(response.text)

    try:
        result = try_generate()
    except Exception as e:
        print(f"First attempt failed: {e}")
        try:
            result = try_generate()
        except Exception as retry_e:
            print(f"Retry attempt failed: {retry_e}")
            raise HTTPException(status_code=500, detail=f"Gemini API Error: {str(retry_e)}")

    return result


class AudioRequest(BaseModel):
    podcast_script: str


def _chunk_text(text: str, max_chars: int = 4500) -> list[str]:
    text = text.strip()
    if len(text) <= max_chars:
        return [text]

    chunks: list[str] = []
    current = ""
    for sentence in text.replace("\n", " ").split(". "):
        part = sentence if sentence.endswith(".") else sentence + "."
        if len(current) + len(part) <= max_chars:
            current += (" " if current else "") + part
        else:
            if current:
                chunks.append(current.strip())
            current = part
    if current:
        chunks.append(current.strip())
    return chunks


def _parse_elevenlabs_error(response: httpx.Response) -> str:
    try:
        data = response.json()
        detail = data.get("detail")
        if isinstance(detail, dict):
            return detail.get("message", response.text)
        if isinstance(detail, str):
            return detail
    except Exception:
        pass
    return response.text


async def _synthesize_elevenlabs_chunk(client: httpx.AsyncClient, text: str) -> bytes:
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{ELEVENLABS_VOICE_ID}"
    params = {"output_format": "mp3_44100_128"}
    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
    }
    payload = {
        "text": text,
        "model_id": ELEVENLABS_MODEL_ID,
    }

    response = await client.post(url, params=params, headers=headers, json=payload, timeout=300.0)

    if response.status_code != 200:
        raise HTTPException(
            status_code=response.status_code,
            detail=f"ElevenLabs error: {_parse_elevenlabs_error(response)}",
        )

    return response.content


async def _synthesize_gemini_chunk(client: httpx.AsyncClient, text: str) -> bytes:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_TTS_MODEL}:generateContent"
    headers = {
        "x-goog-api-key": GEMINI_API_KEY,
        "Content-Type": "application/json",
    }
    payload = {
        "contents": [{"parts": [{"text": text}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {
                "voiceConfig": {
                    "prebuiltVoiceConfig": {
                        "voiceName": GEMINI_TTS_VOICE,
                    }
                }
            },
        },
    }

    response = await client.post(url, headers=headers, json=payload, timeout=300.0)

    if response.status_code != 200:
        detail = response.text
        try:
            detail = response.json().get("error", {}).get("message", response.text)
        except Exception:
            pass
        raise HTTPException(
            status_code=response.status_code,
            detail=f"Gemini TTS error: {detail}",
        )

    data = response.json()
    try:
        inline = data["candidates"][0]["content"]["parts"][0]["inlineData"]
        pcm_bytes = base64.b64decode(inline["data"])
    except (KeyError, IndexError, TypeError) as e:
        raise HTTPException(status_code=500, detail=f"Gemini TTS returned unexpected response: {e}")

    return _pcm_to_wav(pcm_bytes)


@app.post("/generate-audio")
async def generate_audio(request: AudioRequest):
    script = request.podcast_script.strip()
    if not script:
        raise HTTPException(status_code=400, detail="Podcast script is empty")

    chunks = _chunk_text(script)

    try:
        async with httpx.AsyncClient() as client:
            if TTS_PROVIDER == "elevenlabs":
                if not ELEVENLABS_API_KEY:
                    raise HTTPException(status_code=500, detail="ELEVENLABS_API_KEY is not set in the environment")
                if not ELEVENLABS_VOICE_ID:
                    raise HTTPException(status_code=500, detail="ELEVENLABS_VOICE_ID is not set in the environment")

                audio_parts: list[bytes] = []
                for chunk in chunks:
                    audio_parts.append(await _synthesize_elevenlabs_chunk(client, chunk))
                audio_bytes = b"".join(audio_parts)
                media_type = "audio/mpeg"
                filename = "podcast.mp3"

            elif TTS_PROVIDER == "gemini":
                if not GEMINI_API_KEY:
                    raise HTTPException(status_code=500, detail="GEMINI_API_KEY is not set in the environment")

                wav_parts: list[bytes] = []
                for chunk in chunks:
                    wav_parts.append(await _synthesize_gemini_chunk(client, chunk))
                audio_bytes = _concat_wav_parts(wav_parts)
                media_type = "audio/wav"
                filename = "podcast.wav"

            else:
                raise HTTPException(
                    status_code=500,
                    detail=f"Unknown TTS_PROVIDER '{TTS_PROVIDER}'. Use 'gemini' or 'elevenlabs'.",
                )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Audio generation failed: {str(e)}")

    return Response(
        content=audio_bytes,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
