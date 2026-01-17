"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { marketsApi } from "@/lib/api"
import { toast } from "sonner"

const CATEGORIES = ["Economics", "Politics", "Technology", "Sports", "Climate", "General"]

export function MarketCreateForm() {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    question: "",
    category: "General",
    description: "",
    resolutionDate: "",
    outcomes: ["", ""],
    tags: "",
    initialLiquidity: "1000",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Filter out empty outcomes
      const outcomes = formData.outcomes.filter((o) => o.trim())
      if (outcomes.length < 2) {
        toast.error("Please provide at least 2 outcomes")
        setLoading(false)
        return
      }

      if (!formData.question.trim()) {
        toast.error("Please enter a question")
        setLoading(false)
        return
      }

      if (!formData.resolutionDate) {
        toast.error("Please select a resolution date")
        setLoading(false)
        return
      }

      const tags = formData.tags
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t)

      const market = await marketsApi.createMarket({
        question: formData.question,
        category: formData.category,
        description: formData.description,
        resolutionDate: formData.resolutionDate,
        outcomes,
        tags,
        initialLiquidity: formData.initialLiquidity ? parseInt(formData.initialLiquidity) * 100 : 0,
      })

      toast.success("Market created successfully!")
      // Reset form
      setFormData({
        question: "",
        category: "General",
        description: "",
        resolutionDate: "",
        outcomes: ["", ""],
        tags: "",
        initialLiquidity: "1000",
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create market")
    } finally {
      setLoading(false)
    }
  }

  const updateOutcome = (index: number, value: string) => {
    const newOutcomes = [...formData.outcomes]
    newOutcomes[index] = value
    setFormData({ ...formData, outcomes: newOutcomes })
  }

  const addOutcome = () => {
    setFormData({ ...formData, outcomes: [...formData.outcomes, ""] })
  }

  const removeOutcome = (index: number) => {
    if (formData.outcomes.length > 2) {
      setFormData({ ...formData, outcomes: formData.outcomes.filter((_, i) => i !== index) })
    }
  }

  return (
    <Card className="p-6 max-w-2xl">
      <h2 className="text-2xl font-bold mb-6">Create New Market</h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Question */}
        <div>
          <Label htmlFor="question">Question</Label>
          <Input
            id="question"
            placeholder="What is your prediction question?"
            value={formData.question}
            onChange={(e) => setFormData({ ...formData, question: e.target.value })}
            required
          />
        </div>

        {/* Category */}
        <div>
          <Label htmlFor="category">Category</Label>
          <select
            id="category"
            className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground"
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Description */}
        <div>
          <Label htmlFor="description">Description (Optional)</Label>
          <textarea
            id="description"
            placeholder="Provide additional context about this market..."
            className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground min-h-24"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
        </div>

        {/* Resolution Date */}
        <div>
          <Label htmlFor="resolutionDate">Resolution Date</Label>
          <Input
            id="resolutionDate"
            type="datetime-local"
            value={formData.resolutionDate}
            onChange={(e) => setFormData({ ...formData, resolutionDate: e.target.value })}
            required
          />
        </div>

        {/* Outcomes */}
        <div>
          <Label>Outcomes</Label>
          <div className="space-y-2">
            {formData.outcomes.map((outcome, idx) => (
              <div key={idx} className="flex gap-2">
                <Input
                  placeholder={`Outcome ${idx + 1}`}
                  value={outcome}
                  onChange={(e) => updateOutcome(idx, e.target.value)}
                />
                {formData.outcomes.length > 2 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeOutcome(idx)}
                  >
                    Remove
                  </Button>
                )}
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={addOutcome}
          >
            Add Outcome
          </Button>
        </div>

        {/* Tags */}
        <div>
          <Label htmlFor="tags">Tags (Optional, comma-separated)</Label>
          <Input
            id="tags"
            placeholder="election, 2026, politics"
            value={formData.tags}
            onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
          />
        </div>

        {/* Initial Liquidity */}
        <div>
          <Label htmlFor="initialLiquidity">Initial Liquidity ($)</Label>
          <Input
            id="initialLiquidity"
            type="number"
            placeholder="1000"
            value={formData.initialLiquidity}
            onChange={(e) => setFormData({ ...formData, initialLiquidity: e.target.value })}
          />
        </div>

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Creating..." : "Create Market"}
        </Button>
      </form>
    </Card>
  )
}
