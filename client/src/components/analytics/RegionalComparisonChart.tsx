/**
 * Regional Comparison Chart Component
 * Multi-line chart comparing activity across different regions over time.
 */
import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts";

interface RegionalComparisonChartProps {
    data: any[];
    title: string;
    description: string;
}

const REGION_COLORS = [
    "#3B82F6", "#10B981", "#F59E0B", "#EF4444",
    "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16",
];

export function RegionalComparisonChart({ data, title, description }: RegionalComparisonChartProps) {
    const regions = useMemo(() => {
        if (data.length === 0) return [];
        return Object.keys(data[0]).filter(key => key !== "date");
    }, [data]);

    const chartData = data.map(item => ({
        ...item,
        date: item.date?.split("-").slice(1).join("/") || item.date,
    }));

    if (regions.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>{title}</CardTitle>
                    <CardDescription>{description}</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                        No regional data available
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="hover:shadow-lg hover:shadow-primary/5 transition-shadow">
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.5} />
                        <XAxis dataKey="date" stroke="#9CA3AF" tick={{ fontSize: 11 }} />
                        <YAxis stroke="#9CA3AF" tick={{ fontSize: 11 }} />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: "#1f2937",
                                border: "1px solid #374151",
                                borderRadius: "8px",
                            }}
                        />
                        <Legend />
                        {regions.map((region, i) => (
                            <Line
                                key={region}
                                type="monotone"
                                dataKey={region}
                                stroke={REGION_COLORS[i % REGION_COLORS.length]}
                                strokeWidth={2}
                                dot={false}
                                activeDot={{ r: 4 }}
                            />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}

export default RegionalComparisonChart;
