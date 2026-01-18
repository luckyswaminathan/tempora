"use client";

import { useState, useEffect } from "react";
import {
  AreaChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
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
    Array<PriceHistoryData & { dateFormatted: string; timestamp: number }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const response = await usersApi.get_security_price_history(securityId);
        const formattedData = response.history.map((item) => ({
          ...item,
          dateFormatted: format(parseISO(item.date), "MMM d, h:mm a"),
          timestamp: parseISO(item.date).getTime(),
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
          <div className="text-sm font-mono font-semibold">{currentPrice}¢</div>
          <div
            className={`text-xs font-mono ${
              priceChange >= 0 ? "text-green-600" : "text-red-600"
            }`}
          >
            {priceChange >= 0 ? "+" : ""}
            {priceChange}¢ ({percentChange}%)
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground">Low</span>
            <div className="font-mono font-semibold">{minPrice}¢</div>
          </div>
          <div>
            <span className="text-muted-foreground">High</span>
            <div className="font-mono font-semibold">{maxPrice}¢</div>
          </div>
          <div>
            <span className="text-muted-foreground">Current</span>
            <div className="font-mono font-semibold">{currentPrice}¢</div>
          </div>
        </div>

        <div className="w-full h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#e5e7eb"
                vertical={false}
              />
              <XAxis
                dataKey="timestamp"
                type="number"
                scale="time"
                domain={["dataMin", "dataMax"]}
                tick={{ fontSize: 11, fill: "#6b7280" }}
                tickFormatter={(timestamp) =>
                  format(new Date(timestamp), "MMM d")
                }
                stroke="#9ca3af"
                tickCount={5}
              />
              <YAxis
                dataKey="priceCents"
                tick={{ fontSize: 11, fill: "#6b7280" }}
                stroke="#9ca3af"
                domain={["auto", "auto"]}
                tickFormatter={(value) => `${value}¢`}
              />
              <Tooltip
                formatter={(value: number) => [
                  `${(value / 100).toFixed(2)}¢`,
                  "Price",
                ]}
                labelFormatter={(timestamp) =>
                  format(new Date(timestamp), "MMM d, h:mm a")
                }
                contentStyle={{
                  backgroundColor: "#ffffff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "4px",
                  padding: "8px",
                }}
              />
              <Area
                type="monotone"
                dataKey="priceCents"
                stroke="none"
                fill="#3b82f6"
                fillOpacity={0.6}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
}
