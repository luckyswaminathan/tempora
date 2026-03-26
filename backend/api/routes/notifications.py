from fastapi import APIRouter, Depends, HTTPException, Query, status

from api import deps
from schemas.notification import (
    NotificationListResponse,
    NotificationMarkAllReadResponse,
    NotificationReadResponse,
    NotificationUnreadCountResponse,
)
from schemas.user import UserBase
from services.notifications import NotificationService

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=NotificationListResponse)
def list_notifications(
    unread_only: bool = Query(default=False, alias="unreadOnly"),
    limit: int = Query(default=50, ge=1, le=200),
    service: NotificationService = Depends(deps.get_notification_service),
    user: UserBase = Depends(deps.get_current_user),
) -> NotificationListResponse:
    notifications, unread_count = service.list_notifications(
        user_id=user.id,
        unread_only=unread_only,
        limit=limit,
    )
    items = [
        {
            "id": n.id,
            "eventType": n.event_type,
            "title": n.title,
            "body": n.body,
            "payload": n.payload,
            "isRead": n.is_read,
            "readAt": n.read_at,
            "createdAt": n.created_at,
        }
        for n in notifications
    ]
    return NotificationListResponse.model_validate(
        {
            "items": items,
            "count": len(items),
            "unreadCount": unread_count,
        }
    )


@router.get("/unread-count", response_model=NotificationUnreadCountResponse)
def get_unread_count(
    service: NotificationService = Depends(deps.get_notification_service),
    user: UserBase = Depends(deps.get_current_user),
) -> NotificationUnreadCountResponse:
    count = service.get_unread_count(user.id)
    return NotificationUnreadCountResponse.model_validate({"unreadCount": count})


@router.post("/{notification_id}/read", response_model=NotificationReadResponse)
def mark_notification_read(
    notification_id: str,
    service: NotificationService = Depends(deps.get_notification_service),
    user: UserBase = Depends(deps.get_current_user),
) -> NotificationReadResponse:
    notification = service.mark_read(user_id=user.id, notification_id=notification_id)
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
    return NotificationReadResponse.model_validate(
        {
            "id": notification.id,
            "isRead": notification.is_read,
            "readAt": notification.read_at,
        }
    )


@router.post("/read-all", response_model=NotificationMarkAllReadResponse)
def mark_all_notifications_read(
    service: NotificationService = Depends(deps.get_notification_service),
    user: UserBase = Depends(deps.get_current_user),
) -> NotificationMarkAllReadResponse:
    updated = service.mark_all_read(user_id=user.id)
    return NotificationMarkAllReadResponse.model_validate({"updated": updated})
