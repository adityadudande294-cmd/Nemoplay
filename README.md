# Nemoplay - Production-Ready NVIDIA Nemotron 3 Ultra AI Chat Web Application

Nemoplay is a full-stack, state-of-the-art AI chat application built with Python (**FastAPI**), **Tailwind CSS**, and **Vanilla JavaScript**. It features a modern **Cyber Crimson** visual identity (`#0F0F12`, `#1A1A1E`, `#EF4444`), server-side rate limiting, SSE (Server-Sent Events) response streaming powered by **NVIDIA NIM API**, Markdown and code syntax highlighting with one-click copy, and multi-persona AI switching.

---

## 🌟 Key Features

1. **Visual Design & Cyber Crimson Theme**:
   - Deep charcoal matte background (`#0F0F12`) with dark slate containers (`#1A1A1E`).
   - Vibrant red glowing accents (`#EF4444` / `#DC2626`) and glassmorphic panels (`backdrop-blur-md`).
   - Responsive ChatGPT-style 2-column layout with a collapsible sidebar.

2. **Backend & Architecture (FastAPI)**:
   - `/api/chat` POST endpoint with SSE streaming to stream tokens live from NVIDIA NIM API.
   - Built-in rate limiting (`slowapi`) enforcing a maximum of 10 requests per user IP per 10 minutes.
   - Secure environment variable management via `.env` without exposing server API keys to the client.
   - Client key fallback support (`X-NVIDIA-API-KEY` header) allowing users to supply custom NVIDIA API keys via Settings Modal.

3. **Multi-Persona AI Support**:
   - **General Assistant**: Articulate, versatile, clear conversation.
   - **Coding & Data Science Expert**: Production-grade code, data wrangling, ML models, and clean comments.
   - **System Architect**: Distributed systems, microservices, cloud infrastructure, and database schemas.

4. **Frontend Capabilities**:
   - Welcome view with 3 starter prompt chips ("Write a Python script for data wrangling", "Explain hybrid Mamba-Transformer architecture", "Design a relational database schema").
   - Live Markdown parsing via **Marked.js**.
   - Code syntax highlighting via **Highlight.js** with one-click "Copy Code" buttons.
   - Session persistence in `LocalStorage`.
   - Smooth pulsing typing/streaming indicator.
   - Stop generation button to abort active stream requests.

---

## 🚀 Project Structure

```
Nemoplay/
├── main.py              # FastAPI server, slowapi rate limiting, SSE streaming endpoint
├── requirements.txt     # Python dependencies
├── .env.example         # Environment variables template
├── .env                 # Server environment configuration
├── static/
│   ├── index.html       # Single-Page Application HTML5 structure
│   ├── style.css        # Cyber Crimson design system stylesheet
│   └── app.js           # Single-Page Application JS logic & state manager
└── README.md            # Complete documentation & deployment guide
```

---

## ⚙️ Quick Start (Local Setup)

### 1. Prerequisites
- **Python 3.9+** installed on your system.
- An **NVIDIA NIM API Key** (obtain free from [build.nvidia.com](https://build.nvidia.com)).

### 2. Environment Setup

Create and configure your `.env` file:
```bash
cp .env.example .env
```

Edit `.env` and set your key:
```env
NVIDIA_API_KEY=nvapi-your-actual-nvidia-api-key
DEFAULT_MODEL=nvidia/llama-3.1-nemotron-70b-instruct
PORT=8000
HOST=0.0.0.0
```

### 3. Install Dependencies

Install the required Python packages:
```bash
pip install -r requirements.txt
```

### 4. Run Server

Start the FastAPI application with Uvicorn:
```bash
python main.py
```
*or directly with Uvicorn:*
```bash
uvicorn main:app --reload --port 8000
```

Open your browser and navigate to: **`http://localhost:8000`**

---

## 🌐 Deployment Instructions

### Deploy to Render (FastAPI + Static Files)

1. Fork or push this repository to GitHub.
2. Log into [Render.com](https://render.com) and create a **Web Service**.
3. Connect your repository and configure:
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python main.py` or `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. In **Environment Variables**, add:
   - `NVIDIA_API_KEY` = `nvapi-your-key`
   - `DEFAULT_MODEL` = `nvidia/llama-3.1-nemotron-70b-instruct`
5. Click **Deploy Web Service**.

### Deploy to Vercel (Serverless Python API)

1. Create a `vercel.json` file in the root directory:
```json
{
  "builds": [
    {
      "src": "main.py",
      "use": "@vercel/python"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "main.py"
    }
  ]
}
```
2. Run `vercel` CLI or deploy via Vercel GitHub Integration.
3. Set `NVIDIA_API_KEY` in Vercel Project Settings -> Environment Variables.

---

## 🛡️ Security & Rate Limiting

- **Server-Side API Key Protection**: The server `NVIDIA_API_KEY` is loaded strictly from environment variables and is never transmitted to the browser client.
- **SlowAPI Rate Limiter**: IP-based throttling limits users to 10 chat completions per 10 minutes, protecting against token exhaustion and DDoS attacks.
- **Client Key Overrides**: If the server key hits quota or is missing, users can input their own NVIDIA API Key in the Settings Modal. Client keys are stored solely in their browser's local storage and passed securely via HTTP headers (`X-NVIDIA-API-KEY`).

---

## 📄 License

MIT License. Designed & Developed for high-performance AI chat powered by NVIDIA Nemotron.