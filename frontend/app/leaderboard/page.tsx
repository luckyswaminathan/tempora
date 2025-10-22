import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trophy, TrendingUp, Users } from "lucide-react"

const MOCK_LEADERBOARD = [
  { rank: 1, name: "Alice Johnson", pnl: 18450, roi: 142, trades: 312 },
  { rank: 2, name: "QuantumTrader", pnl: 16320, roi: 129, trades: 281 },
  { rank: 3, name: "MacroHawk", pnl: 15110, roi: 118, trades: 245 },
  { rank: 4, name: "TechAlpha", pnl: 12780, roi: 104, trades: 198 },
  { rank: 5, name: "RiskParity", pnl: 11240, roi: 96, trades: 176 },
]

export default function LeaderboardPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-balance flex items-center gap-2">
            <Trophy className="w-7 h-7 text-yellow-500" /> Top Traders
          </h1>
          <p className="text-muted-foreground mt-1">Weekly leaderboard by realized P&L</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="secondary">This week</Badge>
          <Badge variant="outline">All-time</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {MOCK_LEADERBOARD.map((row) => (
          <Card key={row.rank} className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 text-center font-mono text-xl font-bold">{row.rank}</div>
                <div>
                  <div className="font-medium">{row.name}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <Users className="w-3 h-3" /> {row.trades} trades
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-8">
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">P&L</div>
                  <div className="text-lg font-semibold text-green-600">${row.pnl.toLocaleString()}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">ROI</div>
                  <div className="text-lg font-semibold flex items-center gap-1">
                    <TrendingUp className="w-4 h-4 text-green-600" /> {row.roi}%
                  </div>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}


