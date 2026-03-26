from pydantic import BaseModel, ConfigDict, Field

from core.models import NotificationType
from schemas.date import UTCDateTime


class NotificationItem(BaseModel):
    id: str
    event_type: NotificationType = Field(alias="eventType")
    title: str
    body: str
    payload: dict = Field(default_factory=dict)
    is_read: bool = Field(alias="isRead")
    read_at: UTCDateTime | None = Field(default=None, alias="readAt")
    created_at: UTCDateTime = Field(alias="createdAt")

    model_config = ConfigDict(populate_by_name=True)


class NotificationListResponse(BaseModel):
    items: list[NotificationItem]
    count: int
    unread_count: int = Field(alias="unreadCount")

    model_config = ConfigDict(populate_by_name=True)


class NotificationReadResponse(BaseModel):
    id: str
    is_read: bool = Field(alias="isRead")
    read_at: UTCDateTime | None = Field(default=None, alias="readAt")

    model_config = ConfigDict(populate_by_name=True)


class NotificationMarkAllReadResponse(BaseModel):
    updated: int


class NotificationUnreadCountResponse(BaseModel):
    unread_count: int = Field(alias="unreadCount")

    model_config = ConfigDict(populate_by_name=True)
