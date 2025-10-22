import { MarketGrid } from "@/components/market-grid"
import { MarketFilters } from "@/components/market-filters"

export default function Home() {
  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 text-balance">Prediction Markets</h1>
        <p className="text-muted-foreground text-lg">Bet on future outcomes and earn from accurate predictions</p>
      </div>
      <MarketFilters />
      <MarketGrid />
    </main>
  )
}
