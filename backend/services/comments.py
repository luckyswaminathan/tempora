from __future__ import annotations

from collections import defaultdict
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from core import models
from schemas.comment import (
    CommentAuthor,
    CommentCreateRequest,
    CommentReactionCount,
    CommentReactionRequest,
    CommentReactionResponse,
    MarketComment,
    MarketCommentListResponse,
)


class CommentService:
    ALLOWED_REACTIONS = {"like", "love", "bullish", "bearish", "laugh"}

    def __init__(self, session: Session) -> None:
        self.session = session

    def list_market_comments(
        self,
        *,
        market_id: str,
        current_user_id: Optional[str] = None,
    ) -> MarketCommentListResponse:
        self._require_market(market_id)

        comments_stmt = (
            select(models.Comment)
            .where(models.Comment.market_id == market_id)
            .order_by(models.Comment.created_at.asc())
        )
        comments = self.session.scalars(comments_stmt).all()
        if not comments:
            return MarketCommentListResponse(items=[], count=0)

        user_ids = sorted({comment.user_id for comment in comments})
        profile_stmt = select(models.Profile).where(models.Profile.id.in_(user_ids))
        profiles = {profile.id: profile for profile in self.session.scalars(profile_stmt).all()}

        comment_ids = [comment.id for comment in comments]
        reaction_stmt = select(models.CommentReaction).where(
            models.CommentReaction.comment_id.in_(comment_ids)
        )
        reaction_rows = self.session.scalars(reaction_stmt).all()

        reaction_counts: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
        my_reactions: dict[str, set[str]] = defaultdict(set)
        for reaction in reaction_rows:
            if reaction.reaction not in self.ALLOWED_REACTIONS:
                continue
            reaction_counts[reaction.comment_id][reaction.reaction] += 1
            if current_user_id and reaction.user_id == current_user_id:
                my_reactions[reaction.comment_id].add(reaction.reaction)

        nodes_by_id: dict[str, MarketComment] = {}
        for comment in comments:
            profile = profiles.get(comment.user_id)
            author = CommentAuthor(
                id=comment.user.id,
                email=comment.user.email,
                displayName=profile.display_name if profile else None,
            )

            counts = reaction_counts.get(comment.id, {})
            reactions = [
                CommentReactionCount(reaction=key, count=value)
                for key, value in sorted(
                    counts.items(), key=lambda item: (-item[1], item[0])
                )
            ]

            nodes_by_id[comment.id] = MarketComment(
                id=comment.id,
                marketId=comment.market_id,
                userId=comment.user_id,
                parentCommentId=comment.parent_comment_id,
                content=comment.content,
                createdAt=comment.created_at,
                updatedAt=comment.updated_at,
                author=author,
                reactions=reactions,
                myReactions=sorted(my_reactions.get(comment.id, set())),
                replies=[],
            )

        roots: list[MarketComment] = []
        for comment in comments:
            node = nodes_by_id[comment.id]
            if comment.parent_comment_id and comment.parent_comment_id in nodes_by_id:
                nodes_by_id[comment.parent_comment_id].replies.append(node)
            else:
                roots.append(node)

        return MarketCommentListResponse(items=roots, count=len(comments))

    def create_comment(
        self,
        *,
        market_id: str,
        payload: CommentCreateRequest,
        user_id: str,
    ) -> MarketComment:
        self._require_market(market_id)

        content = payload.content.strip()
        if not content:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Comment content cannot be empty",
            )

        parent_comment_id = payload.parent_comment_id
        if parent_comment_id:
            parent = self.session.get(models.Comment, parent_comment_id)
            if not parent:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Parent comment not found",
                )
            if parent.market_id != market_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Parent comment must be in the same market",
                )

        comment = models.Comment(
            market_id=market_id,
            user_id=user_id,
            parent_comment_id=parent_comment_id,
            content=content,
        )
        self.session.add(comment)
        self.session.commit()
        self.session.refresh(comment)

        return self._build_comment_node(comment=comment, current_user_id=user_id)

    def toggle_reaction(
        self,
        *,
        market_id: str,
        comment_id: str,
        payload: CommentReactionRequest,
        user_id: str,
    ) -> CommentReactionResponse:
        self._require_market(market_id)

        reaction = payload.reaction.strip().lower()
        if reaction not in self.ALLOWED_REACTIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Unsupported reaction. Allowed values: "
                    + ", ".join(sorted(self.ALLOWED_REACTIONS))
                ),
            )

        comment_stmt = select(models.Comment.id).where(
            models.Comment.id == comment_id,
            models.Comment.market_id == market_id,
        )
        if self.session.scalar(comment_stmt) is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Comment not found",
            )

        existing_stmt = select(models.CommentReaction).where(
            models.CommentReaction.comment_id == comment_id,
            models.CommentReaction.user_id == user_id,
            models.CommentReaction.reaction == reaction,
        )
        existing = self.session.scalar(existing_stmt)
        if existing:
            self.session.delete(existing)
            active = False
        else:
            self.session.add(
                models.CommentReaction(
                    comment_id=comment_id,
                    user_id=user_id,
                    reaction=reaction,
                )
            )
            active = True

        self.session.commit()

        return CommentReactionResponse(
            commentId=comment_id,
            reaction=reaction,
            active=active,
        )

    def _require_market(self, market_id: str) -> None:
        stmt = select(func.count()).select_from(models.Market).where(
            models.Market.id == market_id
        )
        exists = int(self.session.scalar(stmt) or 0)
        if exists == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Market not found",
            )

    def _build_comment_node(
        self,
        *,
        comment: models.Comment,
        current_user_id: Optional[str],
    ) -> MarketComment:
        profile = self.session.get(models.Profile, comment.user_id)
        reaction_stmt = select(models.CommentReaction).where(
            models.CommentReaction.comment_id == comment.id
        )
        reaction_rows = self.session.scalars(reaction_stmt).all()

        counts: dict[str, int] = defaultdict(int)
        my_reactions: set[str] = set()
        for reaction in reaction_rows:
            if reaction.reaction not in self.ALLOWED_REACTIONS:
                continue
            counts[reaction.reaction] += 1
            if current_user_id and reaction.user_id == current_user_id:
                my_reactions.add(reaction.reaction)

        return MarketComment(
            id=comment.id,
            marketId=comment.market_id,
            userId=comment.user_id,
            parentCommentId=comment.parent_comment_id,
            content=comment.content,
            createdAt=comment.created_at,
            updatedAt=comment.updated_at,
            author=CommentAuthor(
                id=comment.user.id,
                email=comment.user.email,
                displayName=profile.display_name if profile else None,
            ),
            reactions=[
                CommentReactionCount(reaction=key, count=value)
                for key, value in sorted(counts.items(), key=lambda item: (-item[1], item[0]))
            ],
            myReactions=sorted(my_reactions),
            replies=[],
        )
