import { Button } from "@/components/ui/button"
import { TrendingUp } from "lucide-react"

export function Header() {
  return (
    <header className="border-b bg-card">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary text-primary-foreground">
              <TrendingUp className="w-6 h-6" />
            </div>
            <a href="/" className="text-xl font-bold hover:opacity-90">PredictMarket</a>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <a href="/" className="text-sm font-medium hover:text-primary transition-colors">
              Markets
            </a>
            <a href="/portfolio" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              Portfolio
            </a>
            <a href="/leaderboard" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              Leaderboard
            </a>
          </nav>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm">
              Sign In
            </Button>
            <Button size="sm">Get Started</Button>
          </div>
        </div>
      </div>
    </header>
  )
}
