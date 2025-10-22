"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"

export function MarketFilters() {
  return (
    <div className="mb-6 flex flex-col sm:flex-row gap-4">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search markets..." className="pl-10" />
      </div>
      <div className="flex gap-2 overflow-x-auto">
        <Button variant="default" size="sm">
          All
        </Button>
        <Button variant="outline" size="sm">
          Economics
        </Button>
        <Button variant="outline" size="sm">
          Politics
        </Button>
        <Button variant="outline" size="sm">
          Technology
        </Button>
        <Button variant="outline" size="sm">
          Sports
        </Button>
      </div>
    </div>
  )
}
