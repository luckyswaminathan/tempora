from fastapi import APIRouter, Depends

from api import deps
from schemas.history import ProbabilityHistResponse
from services.history import HistoryService

router = APIRouter(prefix="/history", tags=["history"])


@router.get("/probability/{security_id}", response_model=ProbabilityHistResponse)
def get_probability_history(
    security_id: str,
    history_service: HistoryService = Depends(deps.get_history_service),
) -> ProbabilityHistResponse:
    return history_service.get_probability_history(security_id)
