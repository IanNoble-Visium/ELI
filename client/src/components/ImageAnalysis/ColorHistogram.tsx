import { useMemo } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";

interface ColorHistogramProps {
    data: Array<{ color: string; count: number }>;
    className?: string;
    height?: number;
}

export function ColorHistogram({ data, className, height = 300 }: ColorHistogramProps) {
    // Sort data by count descending
    const sortedData = useMemo(() => {
        return [...data].sort((a, b) => b.count - a.count);
    }, [data]);

    return (
        <div className={className} style={{ width: "100%", height }}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sortedData} layout="vertical" margin={{ left: 10, right: 30, top: 10, bottom: 10 }}>
                    <XAxis type="number" hide />
                    <YAxis
                        dataKey="color"
                        type="category"
                        width={80}
                        tick={{ fill: "#888", fontSize: 12 }}
                    />
                    <Tooltip
                        contentStyle={{ backgroundColor: "#1f2937", borderColor: "#374151" }}
                        itemStyle={{ color: "#e5e7eb" }}
                        cursor={{ fill: "rgba(255, 255, 255, 0.05)" }}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                        {sortedData.map((entry, index) => {
                            // Try to use the color itself if it's a valid hex/name
                            const isHex = entry.color.startsWith("#");
                            // Fallback color if not a valid color string (or use a dynamic color)
                            const fill = isHex ? entry.color : `hsl(${index * 45}, 70%, 50%)`;
                            return <Cell key={`cell-${index}`} fill={fill} stroke="#374151" />;
                        })}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
