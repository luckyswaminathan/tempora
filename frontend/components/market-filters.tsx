"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"

interface MarketFiltersProps {
  category?: string | null
  onCategoryChange: (category: string | null) => void
  searchQuery: string
  onSearchChange: (query: string) => void
}

const CATEGORIES = ["All", "Economics", "Politics", "Technology", "Sports", "Climate", "General"]

export function MarketFilters({ category, onCategoryChange, searchQuery, onSearchChange }: MarketFiltersProps) {
  return (
    <div className="mb-6 flex flex-col sm:flex-row gap-4">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search markets..."
          className="pl-10"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <div className="flex gap-2 overflow-x-auto">
        {CATEGORIES.map((cat) => (
          <Button
            key={cat}
            variant={category === cat || (cat === "All" && !category) ? "default" : "outline"}
            size="sm"
            onClick={() => onCategoryChange(cat === "All" ? null : cat)}
          >
            {cat}
          </Button>
        ))}
      </div>
    </div>
  )
}
