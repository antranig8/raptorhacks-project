from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from .router import public, private
from .auth.throttling import (
    rate_limit_authenticated,
    rate_limit_public,
)
app = FastAPI()

origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://raptorhacks-project.vercel.app",
    "https://raptorhacks-project-lqrh.vercel.app",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(
    private.router,
    prefix="/api/v1/private",
    dependencies=[Depends(rate_limit_authenticated)]
)

app.include_router(
    public.router,
    prefix="/api/v1/public",
    dependencies=[Depends(rate_limit_public)]
)


@app.get("/")
async def root():
    return {"message": "FastAPI Backend is running"}
