from fastapi import FastAPI

from .api.routes import analysis, health, waste
from .core.config import settings

app = FastAPI(title=settings.app_name, version="0.1.0")
app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(analysis.router, prefix="/api", tags=["analysis"])
app.include_router(waste.router, prefix="/api", tags=["waste"])
