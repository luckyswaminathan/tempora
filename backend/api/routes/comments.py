from fastapi import APIRouter, Depends, status

from api import deps
from schemas.comment import (
    CommentCreateRequest,
    CommentReactionRequest,
    CommentReactionResponse,
    MarketComment,
    MarketCommentListResponse,
)
from schemas.user import UserBase
from services.comments import CommentService

router = APIRouter(prefix="/markets", tags=["comments"])


@router.get("/{market_id}/comments", response_model=MarketCommentListResponse)
def list_market_comments(
    market_id: str,
    service: CommentService = Depends(deps.get_comment_service),
    current_user: UserBase | None = Depends(deps.get_optional_current_user),
) -> MarketCommentListResponse:
    return service.list_market_comments(
        market_id=market_id,
        current_user_id=current_user.id if current_user else None,
    )


@router.post(
    "/{market_id}/comments",
    response_model=MarketComment,
    status_code=status.HTTP_201_CREATED,
)
def create_comment(
    market_id: str,
    payload: CommentCreateRequest,
    service: CommentService = Depends(deps.get_comment_service),
    current_user: UserBase = Depends(deps.get_current_user),
) -> MarketComment:
    return service.create_comment(
        market_id=market_id,
        payload=payload,
        user_id=current_user.id,
    )


@router.post(
    "/{market_id}/comments/{comment_id}/reactions",
    response_model=CommentReactionResponse,
)
def toggle_comment_reaction(
    market_id: str,
    comment_id: str,
    payload: CommentReactionRequest,
    service: CommentService = Depends(deps.get_comment_service),
    current_user: UserBase = Depends(deps.get_current_user),
) -> CommentReactionResponse:
    return service.toggle_reaction(
        market_id=market_id,
        comment_id=comment_id,
        payload=payload,
        user_id=current_user.id,
    )
