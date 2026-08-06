"""FastAPI 앱 조립과 Lambda 진입점.

라우터를 붙이는 것 외의 로직은 두지 않는다. 실제 처리는 api/routes → services →
repositories 순서로 내려간다.
"""

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

# AIDEV-NOTE: Mangum 이 API Gateway 이벤트를 ASGI 로 번역한다. lifespan="off" 인 이유는
#             Lambda 가 startup/shutdown 훅을 보장하지 않기 때문 — 전역 초기화를 여기 걸면 안 된다.
handler = Mangum(app, lifespan="off")
