/**
 * Hourly Activity Chart Component
 * Bar chart showing activity distribution throughout the day with peak hours highlighted.
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
    ReferenceLine,
} from "recharts";

interface TimeSeriesData {
    timestamp: string;
    value: number;
}

interface HourlyActivityChartProps {
    data: TimeSeriesData[];
    peakHours: number[];
    title: string;
    description: string;
}

export function HourlyActivityChart({
    data,
    peakHours,
    title,
    description,
}: HourlyActivityChartProps) {
    // Calculate average for reference line
    const average = data.length > 0
        ? data.reduce((sum, d) => sum + d.value, 0) / data.length
        : 0;

    // Get bar color based on whether it's a peak hour
    const getBarColor = (hour: number): string => {
        if (peakHours.includes(hour)) return "#D91023";
        return "#3B82F6";
    };

    return (
        <Card className="hover:shadow-lg hover:shadow-primary/5 transition-shadow">
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data}>
                        <defs>
                            <linearGradient id="hourlyGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#3B82F6" stopOpacity={1} />
                                <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.6} />
                            </linearGradient>
                            <linearGradient id="peakGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#D91023" stopOpacity={1} />
                                <stop offset="100%" stopColor="#D91023" stopOpacity={0.6} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.5} />
                        <XAxis
                            dataKey="timestamp"
                            stroke="#9CA3AF"
                            tick={{ fontSize: 10 }}
                        />
                        <YAxis stroke="#9CA3AF" tick={{ fontSize: 11 }} />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: "#1f2937",
                                border: "1px solid #374151",
                                borderRadius: "8px",
                            }}
                            formatter={(value: number) => [value.toLocaleString(), "Events"]}
                        />
                        <ReferenceLine
                            y={average}
                            stroke="#9CA3AF"
                            strokeDasharray="3 3"
                            label={{ value: "Avg", position: "right", fill: "#9CA3AF", fontSize: 10 }}
                        />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                            {data.map((entry, index) => {
                                const hour = parseInt(entry.timestamp?.split(":")[0] || "0");
                                return (
                                    <Cell
                                        key={index}
                                        fill={peakHours.includes(hour) ? "url(#peakGradient)" : "url(#hourlyGradient)"}
                                    />
                                );
                            })}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>

                {/* Legend */}
                <div className="flex items-center justify-center gap-6 mt-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-blue-500" />
                        <span>Regular Hours</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-primary" />
                        <span>Peak Hours</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export default HourlyActivityChart;
