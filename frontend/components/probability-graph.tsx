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
import { historyApi, type ProbabilityHistData } from "@/lib/api";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

interface ProbabiltiyGraphProps {
  securityId: string;
  outcome: string;
}

export function ProbabilityGraph({
  securityId,
  outcome,
}: ProbabiltiyGraphProps) {
  const [data, setData] = useState<
    Array<ProbabilityHistData & { dateFormatted: string; timestamp: number }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const response = await historyApi.getProbabilityHistory(securityId);
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
            : "Failed to load probability history",
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
          Loading probability history...
        </span>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <Card className="p-4 text-center text-sm text-muted-foreground">
        No probability history available yet
      </Card>
    );
  }

  const minProb = Math.min(...data.map((d) => d.probability));
  const maxProb = Math.max(...data.map((d) => d.probability));
  const currentProb = data[data.length - 1].probability;
  const probChange = currentProb - (data[0]?.probability || 0);

  return (
    <Card className="p-4 space-y-3 border border-border bg-card">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">{outcome}</h3>
          <p className="text-xs text-muted-foreground">History</p>
        </div>
        <div className="text-right space-y-1">
          <div className="text-sm font-mono font-semibold">
            {(currentProb * 100).toFixed(2)}%
          </div>
          <div
            className={`text-xs font-mono ${
              probChange >= 0 ? "text-green-600" : "text-red-600"
            }`}
          >
            {probChange >= 0 ? "+" : ""}
            {(probChange * 100).toFixed(2)}%
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground">Low</span>
            <div className="font-mono font-semibold">
              {(minProb * 100).toFixed(2)}%
            </div>
          </div>
          <div>
            <span className="text-muted-foreground">High</span>
            <div className="font-mono font-semibold">
              {(maxProb * 100).toFixed(2)}%
            </div>
          </div>
          <div>
            <span className="text-muted-foreground">Current</span>
            <div className="font-mono font-semibold">
              {(currentProb * 100).toFixed(2)}%
            </div>
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
                stroke="var(--border)"
                vertical={false}
              />
              <XAxis
                dataKey="timestamp"
                type="number"
                scale="time"
                domain={["dataMin", "dataMax"]}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickFormatter={(timestamp) =>
                  format(new Date(timestamp), "MMM d")
                }
                stroke="var(--muted-foreground)"
                tickCount={5}
              />
              <YAxis
                dataKey="probability"
                tick={{ fontSize: 8, fill: "var(--muted-foreground)" }}
                stroke="var(--muted-foreground)"
                domain={[(dataMin: number) => Math.max(0, dataMin), "auto"]}
                tickFormatter={(value) => `${(value * 100).toFixed(2)}%`}
              />
              <Tooltip
                formatter={(value: number) => [
                  `${(value * 100).toFixed(2)}%`,
                  "Prob",
                ]}
                labelFormatter={(timestamp) =>
                  format(new Date(timestamp), "MMM d, h:mm a")
                }
                contentStyle={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "4px",
                  padding: "8px",
                }}
              />
              <Area
                type="linear"
                dataKey="probability"
                stroke="var(--primary)"
                strokeWidth={1.5}
                fill="var(--primary)"
                fillOpacity={0.15}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
}
