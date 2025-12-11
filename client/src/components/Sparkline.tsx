/**
 * Sparkline Component
 * 
 * Minimal trend chart showing 7-day data.
 * No axes, just a clean trend line with subtle fill.
 */
import { useMemo } from "react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";

interface SparklineProps {
    data: number[];
    color?: string;
    height?: number;
    className?: string;
    showTrendColor?: boolean;
}

export function Sparkline({
    data,
    color,
    height = 32,
    className = "",
    showTrendColor = true,
}: SparklineProps) {
    // Calculate trend direction
    const trend = useMemo(() => {
        if (data.length < 2) return "neutral";
        const first = data.slice(0, Math.floor(data.length / 2));
        const second = data.slice(Math.floor(data.length / 2));
        const avgFirst = first.reduce((a, b) => a + b, 0) / first.length;
        const avgSecond = second.reduce((a, b) => a + b, 0) / second.length;
        if (avgSecond > avgFirst * 1.05) return "up";
        if (avgSecond < avgFirst * 0.95) return "down";
        return "neutral";
    }, [data]);

    // Determine color based on trend or use provided color
    const lineColor = useMemo(() => {
        if (color) return color;
        if (!showTrendColor) return "#6B7280"; // gray
        switch (trend) {
            case "up": return "#10B981"; // green
            case "down": return "#EF4444"; // red
            default: return "#6B7280"; // gray
        }
    }, [color, trend, showTrendColor]);

    // Format data for Recharts
    const chartData = useMemo(() => {
        return data.map((value, index) => ({ value, index }));
    }, [data]);

    if (data.length === 0) {
        return (
            <div
                className={`flex items-center justify-center text-xs text-muted-foreground ${className}`}
                style={{ height }}
            >
                No data
            </div>
        );
    }

    return (
        <div className={className} style={{ height, width: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                    data={chartData}
                    margin={{ top: 2, right: 2, left: 2, bottom: 2 }}
                >
                    <defs>
                        <linearGradient id={`sparkline-gradient-${lineColor.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={lineColor} stopOpacity={0.3} />
                            <stop offset="100%" stopColor={lineColor} stopOpacity={0.05} />
                        </linearGradient>
                    </defs>
                    <Area
                        type="monotone"
                        dataKey="value"
                        stroke={lineColor}
                        strokeWidth={1.5}
                        fill={`url(#sparkline-gradient-${lineColor.replace('#', '')})`}
                        isAnimationActive={true}
                        animationDuration={500}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

export default Sparkline;
