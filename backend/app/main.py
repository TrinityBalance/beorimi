from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum

from .api.routes import analyses, analysis, health, uploads, waste
from .core.config import settings

app = FastAPI(title=settings.app_name, version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_allow_origins),
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(analysis.router, prefix="/api", tags=["analysis"])
app.include_router(uploads.router, prefix="/api", tags=["uploads"])
app.include_router(analyses.router, prefix="/api", tags=["analyses"])
app.include_router(waste.router, prefix="/api", tags=["waste"])

handler = Mangum(app, lifespan="off")
