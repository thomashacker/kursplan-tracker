from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import account, clubs, invitations, plans
from app.config import settings

app = FastAPI(
    title="Kurs.Y API",
    description="Backend für die Trainingsplan-Verwaltung",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(account.router, prefix="/konto", tags=["Konto"])
app.include_router(clubs.router, prefix="/vereine", tags=["Vereine"])
app.include_router(invitations.router, prefix="/einladungen", tags=["Einladungen"])
app.include_router(plans.router, prefix="/wochen", tags=["Trainingspläne"])


@app.get("/health")
def health():
    return {"status": "ok"}
