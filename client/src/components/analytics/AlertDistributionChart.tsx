/**
 * Alert Distribution Chart Component
 * 
 * Stacked bar chart showing alert severity distribution over time.
 * Uses color coding for severity levels: Critical, High, Medium, Low.
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts";

interface AlertDistribution {
    date: string;
    critical: number;
    high: number;
    medium: number;
    low: number;
}

interface AlertDistributionChartProps {
    data: AlertDistribution[];
    title: string;
    description: string;
}

// Severity colors
const SEVERITY_COLORS = {
    critical: "#EF4444", // Red
    high: "#F97316",     // Orange
    medium: "#EAB308",   // Yellow
    low: "#22C55E",      // Green
};

// Custom tooltip
const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const total = payload.reduce((sum: number, entry: any) => sum + entry.value, 0);

        return (
            <div className="bg-card/95 backdrop-blur border border-border rounded-lg p-3 shadow-xl">
                <p className="font-medium text-sm mb-2">{formatDate(label)}</p>
                {payload.reverse().map((entry: any, index: number) => (
                    <div key={index} className="flex items-center justify-between gap-4 text-sm">
                        <div className="flex items-center gap-2">
                            <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: entry.color }}
                            />
                            <span className="text-muted-foreground capitalize">{entry.name}:</span>
                        </div>
                        <span className="font-medium">{entry.value}</span>
                    </div>
                ))}
                <div className="border-t border-border mt-2 pt-2 flex justify-between text-sm">
                    <span className="text-muted-foreground">Total:</span>
                    <span className="font-bold">{total}</span>
                </div>
            </div>
        );
    }
    return null;
};

export function AlertDistributionChart({
    data,
    title,
    description,
}: AlertDistributionChartProps) {
    // Format data for chart
    const chartData = data.map(item => ({
        ...item,
        date: formatDate(item.date),
    }));

    return (
        <Card className="hover:shadow-lg hover:shadow-primary/5 transition-shadow duration-300">
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.5} />
                        <XAxis
                            dataKey="date"
                            stroke="#9CA3AF"
                            tick={{ fontSize: 11 }}
                            tickLine={{ stroke: "#4B5563" }}
                        />
                        <YAxis
                            stroke="#9CA3AF"
                            tick={{ fontSize: 11 }}
                            tickLine={{ stroke: "#4B5563" }}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend
                            wrapperStyle={{ paddingTop: "10px" }}
                            iconType="circle"
                        />
                        <Bar
                            dataKey="low"
                            name="Low"
                            stackId="a"
                            fill={SEVERITY_COLORS.low}
                            radius={[0, 0, 0, 0]}
                            animationDuration={1200}
                        />
                        <Bar
                            dataKey="medium"
                            name="Medium"
                            stackId="a"
                            fill={SEVERITY_COLORS.medium}
                            radius={[0, 0, 0, 0]}
                            animationDuration={1200}
                        />
                        <Bar
                            dataKey="high"
                            name="High"
                            stackId="a"
                            fill={SEVERITY_COLORS.high}
                            radius={[0, 0, 0, 0]}
                            animationDuration={1200}
                        />
                        <Bar
                            dataKey="critical"
                            name="Critical"
                            stackId="a"
                            fill={SEVERITY_COLORS.critical}
                            radius={[4, 4, 0, 0]}
                            animationDuration={1200}
                        />
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}

// Format date for display
function formatDate(date: string): string {
    if (date.includes(" ")) {
        // Hourly format
        const [datePart, time] = date.split(" ");
        const [, month, day] = datePart.split("-");
        return `${month}/${day} ${time}`;
    }

    // Daily format
    const [year, month, day] = date.split("-");
    return `${month}/${day}`;
}

export default AlertDistributionChart;
