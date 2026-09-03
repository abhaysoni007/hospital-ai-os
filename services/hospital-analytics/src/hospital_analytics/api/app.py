"""FastAPI application factory for Hospital Analytics Service."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routes import router
from ..core.config import settings

def create_app() -> FastAPI:
    """Instantiates and configures the FastAPI application."""
    app = FastAPI(
        title="Hospital AI OS — Operational Risk & Pattern Analytics Plugin",
        description=(
            "Standalone operational analytics service for Hospital AI OS. "
            "Evaluates hospital workflow bottleneck risk, identifies contributing factors, "
            "and provides explainable risk scoring without processing clinical text or making clinical decisions."
        ),
        version=settings.version,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # Enable CORS for local integration testing
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Mount API routes
    app.include_router(router)

    return app


app = create_app()
