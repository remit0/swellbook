from fastapi import FastAPI
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(
    title="SwellBook API",
    version="0.1.0",
    description="Surf session tracking and recommendation engine"
)


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "swellbook"}
