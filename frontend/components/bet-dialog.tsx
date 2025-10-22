"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

interface Market {
  id: string
  question: string
  yesPrice: number
  noPrice: number
  settlementDates: Array<{ date: string; label: string }>
}

interface BetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  market: Market
  outcome: "YES" | "NO"
}

export function BetDialog({ open, onOpenChange, market, outcome }: BetDialogProps) {
  const [amount, setAmount] = useState("")
  const price = outcome === "YES" ? market.yesPrice : market.noPrice
  const shares = amount ? (Number.parseFloat(amount) / price) * 100 : 0
  const potentialReturn = shares * 100

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-balance">Place Your Bet</DialogTitle>
          <DialogDescription className="text-balance">{market.question}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Betting on</div>
              <div className="text-2xl font-bold">{outcome}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground mb-1">Current price</div>
              <div className="text-2xl font-bold font-mono">{price}¢</div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount ($)</Label>
            <Input
              id="amount"
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="0"
              step="0.01"
            />
          </div>

          {amount && (
            <div className="space-y-2 p-4 rounded-lg bg-muted/50">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Shares</span>
                <span className="font-mono font-medium">{shares.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Potential return</span>
                <span className="font-mono font-medium text-success">${potentialReturn.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Potential profit</span>
                <span className="font-mono font-medium text-success">
                  ${(potentialReturn - Number.parseFloat(amount)).toFixed(2)}
                </span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="text-sm font-medium">Settlement Dates</div>
            <div className="flex flex-wrap gap-2">
              {market.settlementDates.map((settlement, idx) => (
                <Badge key={idx} variant="outline" className="text-xs font-mono">
                  {settlement.label}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              This market will be evaluated at multiple dates. You can cash out at any settlement date if the outcome is
              favorable.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={() => {
              // Handle bet placement
              onOpenChange(false)
              setAmount("")
            }}
            disabled={!amount || Number.parseFloat(amount) <= 0}
            className="flex-1"
          >
            Place Bet
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
