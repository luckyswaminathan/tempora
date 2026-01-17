"use client"

import { useEffect, useState } from "react"
import { marketsApi } from "@/lib/api"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MarketSettleForm } from "@/components/market-settle-form"
import { Badge } from "@/components/ui/badge"

interface Market {
  id: string
  question: string
  status: string
  category: string
  securities: Array<{
    id: string
    outcome: string
  }>
}

export const MarketSettleTab = () => {
  const [markets, setMarkets] = useState<Market[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [settlingMarket, setSettlingMarket] = useState<string | null>(null)

  useEffect(() => {
    loadMarkets()
  }, [])

  const loadMarkets = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await marketsApi.listMarkets()
      // Filter for open and closed markets (not yet resolved)
      const unsettledMarkets = response.filter(
        (m: Market) => m.status === "open" || m.status === "closed"
      )
      setMarkets(unsettledMarkets)
    } catch (err) {
      setError("Failed to load markets")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSettled = (marketId: string) => {
    setSettlingMarket(null)
    // Reload markets to reflect the settled status
    loadMarkets()
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Loading markets...</p>
      </div>
    )
  }

  if (error) {
    return (
      <Card className="p-6 border-red-200 bg-red-50">
        <p className="text-red-600">{error}</p>
        <Button onClick={loadMarkets} className="mt-4">
          Retry
        </Button>
      </Card>
    )
  }

  if (markets.length === 0) {
    return (
      <Card className="p-6 text-center">
        <p className="text-muted-foreground">No markets available to settle</p>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        <p>Found {markets.length} market(s) available to settle</p>
      </div>

      <div className="grid gap-4">
        {markets.map((market) => (
          <Card key={market.id} className="p-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-lg leading-tight max-w-md">
                    {market.question}
                  </h3>
                  <Badge variant="outline">{market.status}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Category: {market.category}
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Possible outcomes:</p>
                <div className="flex flex-wrap gap-2">
                  {market.securities.map((security) => (
                    <Badge key={security.id} variant="secondary">
                      {security.outcome}
                    </Badge>
                  ))}
                </div>
              </div>

              {settlingMarket === market.id ? (
                <MarketSettleForm
                  market={market}
                  onSettled={() => handleSettled(market.id)}
                  onCancel={() => setSettlingMarket(null)}
                />
              ) : (
                <Button
                  onClick={() => setSettlingMarket(market.id)}
                  className="w-full"
                >
                  Settle Market
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
