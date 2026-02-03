from datetime import datetime, timezone
from typing import Any
from pydantic import GetCoreSchemaHandler
from pydantic_core import core_schema


class UTCDateTime(datetime):
    @classmethod
    def __get_pydantic_core_schema__(
        cls,
        source_type: Any,
        handler: GetCoreSchemaHandler,
    ):
        schema = handler(datetime)

        def ensure_utc_if_naive(v: datetime) -> datetime:
            if v.tzinfo is None:
                return v.replace(tzinfo=timezone.utc)
            return v

        return core_schema.no_info_after_validator_function(
            ensure_utc_if_naive,
            schema,
        )
