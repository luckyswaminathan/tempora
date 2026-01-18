"use client";

import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { usersApi, type PriceHistoryData } from "@/lib/api";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

interface PriceHistoryChartProps {
  securityId: string;
  outcome: string;
}

export function PriceHistoryChart({
  securityId,
  outcome,
}: PriceHistoryChartProps) {
  const [data, setData] = useState<
    Array<PriceHistoryData & { timeFormatted: string }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const response = await usersApi.get_security_price_history(securityId);
        const formattedData = response.history.map((item) => ({
          ...item,
          timeFormatted: format(parseISO(item.time), "MMM d, h:mm a"),
        }));
        setData(formattedData);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to load price history",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [securityId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">
          Loading price history...
        </span>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <Card className="p-4 text-center text-sm text-muted-foreground">
        No price history available yet
      </Card>
    );
  }

  const minPrice = Math.min(...data.map((d) => d.priceCents));
  const maxPrice = Math.max(...data.map((d) => d.priceCents));
  const currentPrice = data[data.length - 1].priceCents;
  const priceChange = currentPrice - (data[0]?.priceCents || 0);
  const percentChange = data[0]
    ? ((priceChange / data[0].priceCents) * 100).toFixed(1)
    : "0";

  return (
    <Card className="p-4 space-y-3 border border-border bg-card">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">{outcome}</h3>
          <p className="text-xs text-muted-foreground">Price History</p>
        </div>
        <div className="text-right space-y-1">
          <div className="text-sm font-mono font-semibold">
            {(currentPrice / 100).toFixed(2)}¢
          </div>
          <div
            className={`text-xs font-mono ${
              priceChange >= 0 ? "text-green-600" : "text-red-600"
            }`}
          >
            {priceChange >= 0 ? "+" : ""}
            {(priceChange / 100).toFixed(2)}¢ ({percentChange}%)
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground">Low</span>
            <div className="font-mono font-semibold">
              {(minPrice / 100).toFixed(2)}¢
            </div>
          </div>
          <div>
            <span className="text-muted-foreground">High</span>
            <div className="font-mono font-semibold">
              {(maxPrice / 100).toFixed(2)}¢
            </div>
          </div>
          <div>
            <span className="text-muted-foreground">Current</span>
            <div className="font-mono font-semibold">
              {(currentPrice / 100).toFixed(2)}¢
            </div>
          </div>
        </div>

        <div className="w-full h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--muted-foreground) / 0.2)"
              />
              <XAxis
                dataKey="timeFormatted"
                tick={{ fontSize: 12 }}
                interval={Math.floor(data.length / 4)}
                stroke="hsl(var(--muted-foreground))"
              />
              <YAxis
                dataKey="priceCents"
                tick={{ fontSize: 12 }}
                stroke="hsl(var(--muted-foreground))"
                domain={["dataMin - 5", "dataMax + 5"]}
                label={{
                  value: "Price (¢)",
                  angle: -90,
                  position: "insideLeft",
                }}
              />
              <Tooltip
                formatter={(value: number) => `${(value / 100).toFixed(2)}¢`}
                labelFormatter={(label) => `Time: ${label}`}
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "4px",
                  padding: "8px",
                }}
              />
              <Line
                type="monotone"
                dataKey="priceCents"
                stroke="hsl(var(--primary))"
                dot={false}
                strokeWidth={2}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
}
