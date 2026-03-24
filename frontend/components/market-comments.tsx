"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Plus,
  SmilePlus,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  commentsApi,
  type CreateCommentRequest,
  type MarketComment,
} from "@/lib/api";

const REACTION_OPTIONS = [
  { key: "like", emoji: "👍", label: "Like" },
  { key: "love", emoji: "❤️", label: "Love" },
  { key: "bullish", emoji: "📈", label: "Bullish" },
  { key: "bearish", emoji: "📉", label: "Bearish" },
  { key: "laugh", emoji: "😂", label: "Laugh" },
] as const;

const REACTION_KEYS: Set<string> = new Set(
  REACTION_OPTIONS.map((item) => item.key),
);

interface MarketCommentsProps {
  marketId: string;
  isSignedIn: boolean;
  onRequireAuth: () => void;
}

type CommentSortMode = "most-reactions" | "most-recent";

function displayAuthorName(comment: MarketComment): string {
  return comment.author.displayName || comment.author.email;
}

function commentReactionCount(comment: MarketComment, reaction: string): number {
  return comment.reactions.find((item) => item.reaction === reaction)?.count ?? 0;
}

function totalReactionCount(comment: MarketComment): number {
  return comment.reactions.reduce((sum, item) => sum + item.count, 0);
}

function sortComments(
  nodes: MarketComment[],
  sortMode: CommentSortMode,
): MarketComment[] {
  const sorted = [...nodes].map((node) => ({
    ...node,
    replies: sortComments(node.replies, sortMode),
  }));

  sorted.sort((a, b) => {
    if (sortMode === "most-reactions") {
      const byReaction = totalReactionCount(b) - totalReactionCount(a);
      if (byReaction !== 0) return byReaction;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }

    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return sorted;
}

export function MarketComments({
  marketId,
  isSignedIn,
  onRequireAuth,
}: MarketCommentsProps) {
  const [comments, setComments] = useState<MarketComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sortMode, setSortMode] = useState<CommentSortMode>("most-reactions");

  const [replyParentId, setReplyParentId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);

  const totalCommentCount = useMemo(() => {
    const walk = (nodes: MarketComment[]): number =>
      nodes.reduce((sum, node) => sum + 1 + walk(node.replies), 0);
    return walk(comments);
  }, [comments]);

  const loadComments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await commentsApi.listComments(marketId);
      setComments(response.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load comments");
    } finally {
      setLoading(false);
    }
  }, [marketId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const submitComment = useCallback(
    async (payload: CreateCommentRequest, onSuccess?: () => void) => {
      if (!isSignedIn) {
        onRequireAuth();
        return;
      }

      const content = payload.content.trim();
      if (!content) return;

      try {
        setSubmitting(true);
        await commentsApi.createComment(marketId, {
          ...payload,
          content,
        });
        await loadComments();
        onSuccess?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to post comment");
      } finally {
        setSubmitting(false);
      }
    },
    [isSignedIn, loadComments, marketId, onRequireAuth],
  );

  const toggleReaction = useCallback(
    async (commentId: string, reaction: string) => {
      if (!isSignedIn) {
        onRequireAuth();
        return;
      }
      try {
        await commentsApi.toggleReaction(marketId, commentId, reaction);
        await loadComments();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to update reaction",
        );
      }
    },
    [isSignedIn, loadComments, marketId, onRequireAuth],
  );

  const toggleReplies = useCallback((commentId: string) => {
    setExpandedReplies((prev) => {
      const next = new Set(prev);
      if (next.has(commentId)) {
        next.delete(commentId);
      } else {
        next.add(commentId);
        // Bring the parent comment to the top when opening its thread.
        requestAnimationFrame(() => {
          const node = document.getElementById(`comment-thread-${commentId}`);
          node?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
      return next;
    });
  }, []);

  const sortedComments = useMemo(
    () => sortComments(comments, sortMode),
    [comments, sortMode],
  );

  const reactionEmojiFor = useCallback((reaction: string): string => {
    const option = REACTION_OPTIONS.find((item) => item.key === reaction);
    return option?.emoji ?? "";
  }, []);

  const renderComment = (comment: MarketComment, depth: number) => {
    const createdAgo = formatDistanceToNow(new Date(comment.createdAt), {
      addSuffix: true,
    });
    const isReplying = replyParentId === comment.id;
    const isExpanded = expandedReplies.has(comment.id);
    const replyCount = comment.replies.length;
    const showReactionPicker = reactionPickerFor === comment.id;
    const visibleReactions = comment.reactions.filter(
      (r) => r.count > 0 && REACTION_KEYS.has(r.reaction),
    );

    return (
      <article
        key={comment.id}
        id={`comment-thread-${comment.id}`}
        className={`${depth > 0 ? "pl-4 border-l border-border/70" : ""} space-y-2`}
      >
        <div className="rounded-md border p-3 bg-background">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-2">
            <span className="text-sm font-medium">{displayAuthorName(comment)}</span>
            <span className="text-xs text-muted-foreground">{createdAgo}</span>
          </div>

          <p className="text-sm whitespace-pre-wrap leading-relaxed">
            {comment.content}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1 pl-1">
          {visibleReactions.map((reactionItem) => {
            const active = comment.myReactions.includes(reactionItem.reaction);
            return (
              <button
                key={`${comment.id}:${reactionItem.reaction}`}
                type="button"
                onClick={() => toggleReaction(comment.id, reactionItem.reaction)}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                  active
                    ? "border-primary/60 bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                }`}
                title={reactionItem.reaction}
              >
                <span aria-hidden>{reactionEmojiFor(reactionItem.reaction)}</span>
                <span>{reactionItem.count}</span>
              </button>
            );
          })}

          <div className="relative">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() =>
                setReactionPickerFor((prev) => (prev === comment.id ? null : comment.id))
              }
              title="Add reaction"
            >
              <SmilePlus className="h-3.5 w-3.5" />
              <Plus className="h-3 w-3" />
            </button>

            {showReactionPicker && (
              <div className="absolute left-0 top-9 z-20 flex items-center gap-1 rounded-xl border bg-popover p-2 shadow-md">
                {REACTION_OPTIONS.map((option) => (
                  <button
                    key={`${comment.id}:${option.key}:picker`}
                    type="button"
                    className="rounded-md p-1.5 text-lg hover:bg-accent"
                    aria-label={option.label}
                    title={option.label}
                    onClick={() => {
                      setReactionPickerFor(null);
                      void toggleReaction(comment.id, option.key);
                    }}
                  >
                    {option.emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => {
              setReplyParentId(isReplying ? null : comment.id);
              setReplyContent("");
            }}
          >
            <MessageSquare className="h-3.5 w-3.5 mr-1" />
            Reply
          </Button>
        </div>

        {replyCount > 0 && (
          <div className="pt-1">
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => toggleReplies(comment.id)}
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
              <span>
                {replyCount} {replyCount === 1 ? "reply" : "replies"}
              </span>
            </button>
          </div>
        )}

        {isReplying && (
          <div className="mt-2 space-y-2">
            <textarea
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="Write a reply..."
              maxLength={1000}
              className="w-full min-h-[88px] rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="text-xs text-muted-foreground text-right">
              {replyContent.length}/1000
            </div>
            <div className="flex items-center gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setReplyParentId(null);
                  setReplyContent("");
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={submitting || !replyContent.trim()}
                onClick={() =>
                  submitComment(
                    {
                      content: replyContent,
                      parentCommentId: comment.id,
                    },
                    () => {
                      setReplyParentId(null);
                      setReplyContent("");
                    },
                  )
                }
              >
                Post Reply
              </Button>
            </div>
          </div>
        )}

        {replyCount > 0 && isExpanded && (
          <div className="space-y-4 pt-1">
            {comment.replies.map((reply) => renderComment(reply, depth + 1))}
          </div>
        )}
      </article>
    );
  };

  return (
    <Card className="p-4 md:p-5 mt-8">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <h2 className="text-lg font-semibold">Comments</h2>
        <Badge variant="secondary">{totalCommentCount}</Badge>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Sort</span>
          <Button
            size="sm"
            variant={
              sortMode === "most-reactions" ? "default" : "outline"
            }
            className="h-7 px-2 text-xs"
            onClick={() => setSortMode("most-reactions")}
          >
            Most reactions
          </Button>
          <Button
            size="sm"
            variant={sortMode === "most-recent" ? "default" : "outline"}
            className="h-7 px-2 text-xs"
            onClick={() => setSortMode("most-recent")}
          >
            Most recent
          </Button>
        </div>
      </div>

      {!isSignedIn && (
        <div className="rounded-md border border-dashed p-3 mb-4 text-sm text-muted-foreground">
          <p>Sign in to post comments and react.</p>
          <Button size="sm" className="mt-2" onClick={onRequireAuth}>
            Sign in
          </Button>
        </div>
      )}

      <div className="space-y-2 mb-5">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Share your take on this market..."
          maxLength={1000}
          className="w-full min-h-[110px] rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="text-xs text-muted-foreground text-right">
          {newComment.length}/1000
        </div>
        <div className="flex justify-end">
          <Button
            disabled={submitting || !newComment.trim()}
            onClick={() =>
              submitComment({ content: newComment }, () => setNewComment(""))
            }
          >
            Post Comment
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive mb-3">{error}</p>}

      {loading ? (
        <div className="animate-pulse space-y-2">
          <div className="h-20 rounded bg-muted" />
          <div className="h-20 rounded bg-muted" />
        </div>
      ) : sortedComments.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          No comments yet. Be the first to start the discussion.
        </p>
      ) : (
        <div className="space-y-5 divide-y divide-border/60">
          {sortedComments.map((item) => (
            <div key={item.id} className="pt-4 first:pt-0">
              {renderComment(item, 0)}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
