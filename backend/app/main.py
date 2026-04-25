from fastapi import FastAPI

from app.routes import sessions, spots

app = FastAPI(
    title="SwellBook API",
    version="0.1.0",
    description="Surf session tracking and recommendation engine"
)

app.include_router(sessions.router, prefix="/api/sessions", tags=["sessions"])
app.include_router(spots.router, prefix="/api/spots", tags=["spots"])


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "swellbook"}
