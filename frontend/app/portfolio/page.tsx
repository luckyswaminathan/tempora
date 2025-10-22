"use client"

import { useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown, Calendar, Wallet } from "lucide-react"

type Holding = {
  id: string
  question: string
  outcome: "YES" | "NO"
  avgPrice: number
  quantity: number
  markPrice: number
  endDate: string
}

const MOCK_HOLDINGS: Holding[] = [
  {
    id: "1",
    question: "Will the US enter a recession before 2027?",
    outcome: "NO",
    avgPrice: 58,
    quantity: 320,
    markPrice: 62,
    endDate: "Dec 31, 2026",
  },
  {
    id: "2",
    question: "Will Bitcoin reach $150,000 before 2026?",
    outcome: "YES",
    avgPrice: 35,
    quantity: 500,
    markPrice: 41,
    endDate: "Dec 31, 2025",
  },
  {
    id: "3",
    question: "Will AI replace 25% of software engineering jobs by 2028?",
    outcome: "NO",
    avgPrice: 72,
    quantity: 200,
    markPrice: 68,
    endDate: "Dec 31, 2027",
  },
]

export default function PortfolioPage() {
  const totals = useMemo(() => {
    const cost = MOCK_HOLDINGS.reduce((sum, h) => sum + h.avgPrice * h.quantity, 0)
    const marketValue = MOCK_HOLDINGS.reduce((sum, h) => sum + h.markPrice * h.quantity, 0)
    const pnl = marketValue - cost
    const roi = cost > 0 ? (pnl / cost) * 100 : 0
    return { cost, marketValue, pnl, roi }
  }, [])

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-balance flex items-center gap-2">
          <Wallet className="w-7 h-7" /> Your Portfolio
        </h1>
        <p className="text-muted-foreground mt-1">Open positions and performance</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Cost Basis</div>
          <div className="text-2xl font-semibold">${totals.cost.toLocaleString()}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Market Value</div>
          <div className="text-2xl font-semibold">${totals.marketValue.toLocaleString()}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">P&L</div>
          <div className={`text-2xl font-semibold ${totals.pnl >= 0 ? "text-green-600" : "text-red-600"}`}>
            ${totals.pnl.toLocaleString()}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">ROI</div>
          <div className={`text-2xl font-semibold ${totals.roi >= 0 ? "text-green-600" : "text-red-600"}`}>
            {totals.roi.toFixed(1)}%
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {MOCK_HOLDINGS.map((h) => {
          const pnl = (h.markPrice - h.avgPrice) * h.quantity
          const isUp = pnl >= 0
          return (
            <Card key={h.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="mb-1 font-medium leading-snug text-balance">{h.question}</div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="font-mono">{h.outcome}</Badge>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {h.endDate}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Avg Price</div>
                    <div className="font-semibold">{h.avgPrice}¢</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Qty</div>
                    <div className="font-semibold">{h.quantity}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Mark</div>
                    <div className="font-semibold">{h.markPrice}¢</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">P&L</div>
                    <div className={`font-semibold flex items-center justify-end gap-1 ${isUp ? "text-green-600" : "text-red-600"}`}>
                      {isUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />} ${pnl.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}


