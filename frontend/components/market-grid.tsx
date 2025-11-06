"use client"

import { useEffect, useState } from "react"
import { MarketCard } from "@/components/market-card"
import type { MarketWithQuote } from "@/lib/api"
import { marketsApi } from "@/lib/api"

interface MarketGridProps {
  category?: string | null
  searchQuery?: string
}

export function MarketGrid({ category, searchQuery = "" }: MarketGridProps) {
  const [markets, setMarkets] = useState<MarketWithQuote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchMarkets() {
      try {
        setLoading(true)
        setError(null)
        const response = await marketsApi.listMarkets({
          category: category || undefined,
          status: "open",
        })
        
        // Filter by search query client-side
        let filtered = response.items
        if (searchQuery.trim()) {
          filtered = filtered.filter(
            (m) =>
              m.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
              m.category.toLowerCase().includes(searchQuery.toLowerCase())
          )
        }
        
        setMarkets(filtered)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load markets")
      } finally {
        setLoading(false)
      }
    }

    fetchMarkets()
  }, [category, searchQuery])

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-64 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Error loading markets: {error}</p>
      </div>
    )
  }

  if (markets.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No markets found</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {markets.map((market) => (
        <MarketCard key={market.id} market={market} />
      ))}
    </div>
  )
}
