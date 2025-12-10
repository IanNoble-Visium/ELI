/**
 * Events Trend Chart Component
 * 
 * Grafana-style interactive line chart showing events and alerts over time.
 * Features gradient fills, smooth animations, and interactive tooltips.
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Brush,
} from "recharts";

interface TimeSeriesData {
    timestamp: string;
    value: number;
}

interface EventsTrendChartProps {
    eventsData: TimeSeriesData[];
    alertsData: TimeSeriesData[];
    title: string;
    description: string;
}

// Custom tooltip component
const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-card/95 backdrop-blur border border-border rounded-lg p-3 shadow-xl">
                <p className="font-medium text-sm mb-2">{label}</p>
                {payload.map((entry: any, index: number) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                        <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: entry.color }}
                        />
                        <span className="text-muted-foreground">{entry.name}:</span>
                        <span className="font-medium">{entry.value.toLocaleString()}</span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

export function EventsTrendChart({
    eventsData,
    alertsData,
    title,
    description,
}: EventsTrendChartProps) {
    // Merge data for chart
    const chartData = eventsData.map((event, index) => ({
        timestamp: formatTimestamp(event.timestamp),
        events: event.value,
        alerts: alertsData[index]?.value || 0,
    }));

    return (
        <Card className="hover:shadow-lg hover:shadow-primary/5 transition-shadow duration-300">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    {title}
                </CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={chartData}>
                        <defs>
                            <linearGradient id="eventsGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="alertsGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#F97316" stopOpacity={0.4} />
                                <stop offset="95%" stopColor="#F97316" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.5} />
                        <XAxis
                            dataKey="timestamp"
                            stroke="#9CA3AF"
                            tick={{ fontSize: 11 }}
                            tickLine={{ stroke: "#4B5563" }}
                        />
                        <YAxis
                            stroke="#9CA3AF"
                            tick={{ fontSize: 11 }}
                            tickLine={{ stroke: "#4B5563" }}
                            tickFormatter={(value) => value.toLocaleString()}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend
                            wrapperStyle={{ paddingTop: "10px" }}
                            iconType="circle"
                        />
                        <Area
                            type="monotone"
                            dataKey="events"
                            name="All Events"
                            stroke="#3B82F6"
                            strokeWidth={2}
                            fill="url(#eventsGradient)"
                            animationDuration={1500}
                            animationEasing="ease-out"
                        />
                        <Area
                            type="monotone"
                            dataKey="alerts"
                            name="Alerts"
                            stroke="#F97316"
                            strokeWidth={2}
                            fill="url(#alertsGradient)"
                            animationDuration={1500}
                            animationEasing="ease-out"
                        />
                        {chartData.length > 10 && (
                            <Brush
                                dataKey="timestamp"
                                height={30}
                                stroke="#6B7280"
                                fill="#1F2937"
                                tickFormatter={(value) => value}
                            />
                        )}
                    </AreaChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}

// Format timestamp for display
function formatTimestamp(timestamp: string): string {
    // Handle different timestamp formats
    if (timestamp.includes(" ")) {
        // Format: "2024-01-01 14:00"
        const [date, time] = timestamp.split(" ");
        const [, month, day] = date.split("-");
        return `${month}/${day} ${time}`;
    }

    // Format: "2024-01-01"
    const [year, month, day] = timestamp.split("-");
    return `${month}/${day}`;
}

export default EventsTrendChart;
