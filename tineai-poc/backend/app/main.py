from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.database import engine
from app.models.models import Base
from app.routers import auth, users, datasets, access, audit, projects
from app.config import settings
import os

Base.metadata.create_all(bind=engine)

app = FastAPI(title="TINE AI Data Platform", version="0.1.0-poc")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://localhost:8001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(datasets.router)
app.include_router(access.router)
app.include_router(audit.router)
app.include_router(projects.router)

if os.path.exists(settings.UPLOAD_DIR):
    app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

@app.get("/")
def root():
    return {"message": "TINE AI Data Platform API - POC", "docs": "/docs"}
