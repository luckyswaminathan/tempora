import { MarketCard } from "@/components/market-card"

const MOCK_MARKETS = [
  {
    id: "1",
    question: "Will the US enter a recession before 2027?",
    category: "Economics",
    yesPrice: 42,
    noPrice: 58,
    volume: 125000,
    traders: 1243,
    settlementDates: [
      { date: "Dec 31, 2025", label: "Q4 2025" },
      { date: "Dec 31, 2026", label: "Q4 2026" },
    ],
    endDate: "Dec 31, 2026",
  },
  {
    id: "2",
    question: "Will Bitcoin reach $150,000 before 2026?",
    category: "Technology",
    yesPrice: 35,
    noPrice: 65,
    volume: 89000,
    traders: 892,
    settlementDates: [
      { date: "Jun 30, 2025", label: "Q2 2025" },
      { date: "Dec 31, 2025", label: "Q4 2025" },
    ],
    endDate: "Dec 31, 2025",
  },
  {
    id: "3",
    question: "Will AI replace 25% of software engineering jobs by 2028?",
    category: "Technology",
    yesPrice: 28,
    noPrice: 72,
    volume: 67000,
    traders: 654,
    settlementDates: [
      { date: "Dec 31, 2026", label: "End 2026" },
      { date: "Dec 31, 2027", label: "End 2027" },
    ],
    endDate: "Dec 31, 2027",
  },
  {
    id: "4",
    question: "Will global temperatures rise by 1.5°C before 2030?",
    category: "Climate",
    yesPrice: 68,
    noPrice: 32,
    volume: 156000,
    traders: 1876,
    settlementDates: [
      { date: "Dec 31, 2027", label: "2027" },
      { date: "Dec 31, 2028", label: "2028" },
      { date: "Dec 31, 2029", label: "2029" },
    ],
    endDate: "Dec 31, 2029",
  },
  {
    id: "5",
    question: "Will SpaceX land humans on Mars before 2030?",
    category: "Technology",
    yesPrice: 15,
    noPrice: 85,
    volume: 234000,
    traders: 2341,
    settlementDates: [
      { date: "Dec 31, 2027", label: "2027" },
      { date: "Dec 31, 2028", label: "2028" },
      { date: "Dec 31, 2029", label: "2029" },
    ],
    endDate: "Dec 31, 2029",
  },
  {
    id: "6",
    question: "Will remote work become the majority by 2026?",
    category: "Economics",
    yesPrice: 52,
    noPrice: 48,
    volume: 78000,
    traders: 987,
    settlementDates: [
      { date: "Jun 30, 2025", label: "Mid 2025" },
      { date: "Dec 31, 2025", label: "End 2025" },
    ],
    endDate: "Dec 31, 2025",
  },
]

export function MarketGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {MOCK_MARKETS.map((market) => (
        <MarketCard key={market.id} market={market} />
      ))}
    </div>
  )
}
