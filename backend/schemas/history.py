from pydantic import BaseModel, ConfigDict, Field

from schemas.date import UTCDateTime


class ProbabilityHistData(BaseModel):
    probability: float
    date: UTCDateTime

    model_config = ConfigDict(populate_by_name=True)


class ProbabilityHistResponse(BaseModel):
    history: list[ProbabilityHistData]

    model_config = ConfigDict(populate_by_name=True)
