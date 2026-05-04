"""
FastAPI Application Entry Point
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.api.v1 import tenders, users, ai_documents, smart_import, tendermatch, bedrijven_import, bedrijven, verrijking, implementatieplanning, bedrijfsprofiel, tendersignalering, offerte_calculator
from app.api.v1.password_history import router as password_router
from app.api.v1.planning import router as planning_router
from app.routers.document_router import router as document_router
from app.routers.finalize_router import router as finalize_router
from app.routers.profile_router import router as profile_router
from app.routers.ai_usage import router as ai_usage_router

# Create FastAPI app
app = FastAPI(
    title="TenderPlanner API",
    description="Python/FastAPI Backend for TenderPlanner",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    redirect_slashes=False  # ← FIX: Voorkom CORS errors bij redirects
)

# CORS middleware - HERSTELD NA DEBUG
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(users.router, prefix="/api/v1")
app.include_router(tenders.router, prefix="/api/v1")
app.include_router(password_router, prefix="/api/v1")
app.include_router(ai_documents.router, prefix="/api/v1")
app.include_router(smart_import.router, prefix="/api/v1")
app.include_router(planning_router, prefix="/api/v1", tags=["Planning"])
app.include_router(document_router, prefix="/api/v1")
app.include_router(finalize_router, prefix="/api/v1")
app.include_router(profile_router, prefix="/api/v1")
app.include_router(ai_usage_router)
app.include_router(tendermatch.router)
app.include_router(bedrijven_import.router)
app.include_router(bedrijven.router)
app.include_router(verrijking.router)
app.include_router(implementatieplanning.router, prefix="/api/v1")
app.include_router(bedrijfsprofiel.router)
app.include_router(tendersignalering.router)
app.include_router(offerte_calculator.router)


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "TenderPlanner API",
        "version": "1.0.0",
        "docs": "/api/docs"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "environment": settings.environment
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.port,
        reload=settings.is_development
    )
