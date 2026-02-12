"""
FastAPI Application Entry Point
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.api.v1 import tenders, users, ai_documents, smart_import
from app.api.v1.password_history import router as password_router
from app.api.v1.planning import router as planning_crud_router      # Bestaande CRUD endpoints
from app.routers.planning_router import router as planning_router    # Nieuwe v4 endpoints
from app.routers.document_router import router as document_router
from app.routers.finalize_router import router as finalize_router
from app.routers.profile_router import router as profile_router

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
app.include_router(planning_crud_router, prefix="/api/v1")   # Bestaande: planning CRUD, agenda, populate
app.include_router(planning_router, prefix="/api/v1")         # Nieuw: backplanning, templates, counts
app.include_router(document_router, prefix="/api/v1")
app.include_router(finalize_router, prefix="/api/v1")
app.include_router(profile_router, prefix="/api/v1")


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