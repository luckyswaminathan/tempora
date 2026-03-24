from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from schemas.date import UTCDateTime


class CommentAuthor(BaseModel):
    id: str
    display_name: Optional[str] = Field(default=None, alias="displayName")
    email: str

    model_config = ConfigDict(populate_by_name=True)


class CommentReactionCount(BaseModel):
    reaction: str
    count: int


class MarketComment(BaseModel):
    id: str
    market_id: str = Field(alias="marketId")
    user_id: str = Field(alias="userId")
    parent_comment_id: Optional[str] = Field(default=None, alias="parentCommentId")
    content: str
    created_at: UTCDateTime = Field(alias="createdAt")
    updated_at: UTCDateTime = Field(alias="updatedAt")
    author: CommentAuthor
    reactions: List[CommentReactionCount] = Field(default_factory=list)
    my_reactions: List[str] = Field(default_factory=list, alias="myReactions")
    replies: List[MarketComment] = Field(default_factory=list)

    model_config = ConfigDict(populate_by_name=True)


class MarketCommentListResponse(BaseModel):
    items: List[MarketComment]
    count: int


class CommentCreateRequest(BaseModel):
    content: str = Field(min_length=1, max_length=1000)
    parent_comment_id: Optional[str] = Field(default=None, alias="parentCommentId")

    model_config = ConfigDict(populate_by_name=True)


class CommentReactionRequest(BaseModel):
    reaction: str = Field(min_length=1, max_length=32)


class CommentReactionResponse(BaseModel):
    comment_id: str = Field(alias="commentId")
    reaction: str
    active: bool

    model_config = ConfigDict(populate_by_name=True)


MarketComment.model_rebuild()
