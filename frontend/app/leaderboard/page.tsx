"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, TrendingUp, Shield, User } from "lucide-react";
import { useEffect, useState } from "react";
import { usersApi } from "@/lib/api";
import { useSearchParams } from "next/navigation";
import { TutorialOverlay } from "@/components/tutorial-overlay";
import { useTutorial } from "@/hooks/useTutorial";
import { LEADERBOARD_STEPS } from "@/lib/tutorial-steps";

interface LeaderboardRow {
  rank: number;
  id: string;
  name: string;
  role: "user" | "market_maker" | "admin";
  pnl: number;
}

export default function LeaderboardPage() {
  const searchParams = useSearchParams();
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const leaderboardTutorial = useTutorial({
    steps: LEADERBOARD_STEPS,
    lessonKey: "leaderboard",
  });

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (mounted && !loading) {
      const tutorialMode = searchParams?.get("tutorial");
      if (tutorialMode === "leaderboard") leaderboardTutorial.start();
    }
  }, [mounted, loading, searchParams]);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        setLoading(true);
        const response = await usersApi.getLeaderboard({ limit: 10 });
        const rows = response.leaderboard.map((user, index) => ({
          rank: index + 1,
          id: user.id,
          name: user.displayName || user.email,
          role: user.role,
          pnl: user.wallet,
        }));
        setLeaderboard(rows);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load leaderboard",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <TutorialOverlay steps={LEADERBOARD_STEPS} currentStep={leaderboardTutorial.currentStep} isActive={leaderboardTutorial.isActive} elementRect={leaderboardTutorial.elementRect} onNext={leaderboardTutorial.next} onClose={leaderboardTutorial.close} />
      <div className="mb-8 flex items-center justify-between" id="leaderboard-title">
        <div>
          <h1 className="text-3xl font-bold text-balance flex items-center gap-2">
            <Trophy className="w-7 h-7 text-yellow-500" /> Top Traders
          </h1>
          <p className="text-muted-foreground mt-1">
            Leaderboard by wallet balance
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="secondary">Top 10</Badge>
        </div>
      </div>

      {loading && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading leaderboard...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 gap-4" id="leaderboard-list">
          {leaderboard.map((row) => (
            <Card key={row.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 text-center font-mono text-xl font-bold">
                    {row.rank}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{row.name}</span>
                      {row.role === "admin" && (
                        <span title="Admin">
                          <Shield className="w-4 h-4 text-violet-600" />
                        </span>
                      )}
                      {row.role === "market_maker" && (
                        <span title="Market Maker">
                          <TrendingUp className="w-4 h-4 text-emerald-600" />
                        </span>
                      )}
                      {row.role === "user" && (
                        <span title="User">
                          <User className="w-4 h-4 text-muted-foreground" />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-8">
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">
                      Wallet Balance
                    </div>
                    <div className="text-lg font-semibold text-green-600">
                      ${(row.pnl / 100.0).toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
