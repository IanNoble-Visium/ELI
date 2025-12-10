/**
 * Prediction Chart Component
 * 
 * Advanced time series chart showing historical data with forecasted values
 * and anomaly detection. Features confidence bands and interactive elements.
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    ComposedChart,
    Line,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    ReferenceDot,
    Brush,
} from "recharts";
import { TrendingUp, AlertTriangle } from "lucide-react";

interface TimeSeriesData {
    timestamp: string;
    value: number;
}

interface ForecastPoint {
    timestamp: string;
    predicted: number;
    lower: number;
    upper: number;
}

interface AnomalyPoint {
    timestamp: string;
    actual: number;
    expected: number;
    deviation: number;
    isAnomaly: boolean;
}

interface PredictionChartProps {
    historicalData: TimeSeriesData[];
    forecastData: ForecastPoint[];
    anomalies: AnomalyPoint[];
    title: string;
    description: string;
}

// Custom tooltip for prediction chart
const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const dataPoint = payload[0]?.payload;
        const isForecasted = dataPoint?.isForecast;
        const isAnomaly = dataPoint?.isAnomaly;

        return (
            <div className="bg-card/95 backdrop-blur border border-border rounded-lg p-3 shadow-xl min-w-[180px]">
                <div className="flex items-center gap-2 mb-2">
                    <p className="font-medium text-sm">{label}</p>
                    {isForecasted && (
                        <Badge variant="outline" className="text-[10px] py-0">
                            Forecast
                        </Badge>
                    )}
                    {isAnomaly && (
                        <Badge variant="destructive" className="text-[10px] py-0">
                            Anomaly
                        </Badge>
                    )}
                </div>

                {payload.map((entry: any, index: number) => {
                    if (entry.dataKey === "confidenceBand") return null;

                    return (
                        <div key={index} className="flex items-center justify-between gap-4 text-sm">
                            <div className="flex items-center gap-2">
                                <div
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: entry.color }}
                                />
                                <span className="text-muted-foreground">{entry.name}:</span>
                            </div>
                            <span className="font-medium">
                                {typeof entry.value === "number" ? entry.value.toLocaleString() : "—"}
                            </span>
                        </div>
                    );
                })}

                {isForecasted && dataPoint?.lower !== undefined && (
                    <div className="mt-2 pt-2 border-t border-border text-xs text-muted-foreground">
                        <div className="flex justify-between">
                            <span>95% CI:</span>
                            <span>{dataPoint.lower} - {dataPoint.upper}</span>
                        </div>
                    </div>
                )}

                {isAnomaly && dataPoint?.deviation !== undefined && (
                    <div className="mt-2 pt-2 border-t border-border text-xs text-orange-400">
                        Deviation: {dataPoint.deviation > 0 ? "+" : ""}{dataPoint.deviation.toFixed(2)}σ
                    </div>
                )}
            </div>
        );
    }
    return null;
};

export function PredictionChart({
    historicalData,
    forecastData,
    anomalies,
    title,
    description,
}: PredictionChartProps) {
    // Create anomaly lookup map
    const anomalyMap = new Map(
        anomalies
            .filter(a => a.isAnomaly)
            .map(a => [a.timestamp, a])
    );

    // Merge historical data with forecast
    const chartData = [
        ...historicalData.map(d => {
            const anomaly = anomalyMap.get(d.timestamp);
            return {
                timestamp: formatTimestamp(d.timestamp),
                actual: d.value,
                predicted: null,
                lower: null,
                upper: null,
                isForecast: false,
                isAnomaly: !!anomaly,
                deviation: anomaly?.deviation || 0,
            };
        }),
        ...forecastData.map(d => ({
            timestamp: formatTimestamp(d.timestamp),
            actual: null,
            predicted: d.predicted,
            lower: d.lower,
            upper: d.upper,
            isForecast: true,
            isAnomaly: false,
            deviation: 0,
        })),
    ];

    // Get anomaly points for markers
    const anomalyPoints = chartData.filter(d => d.isAnomaly);

    // Stats for header
    const anomalyCount = anomalies.filter(a => a.isAnomaly).length;
    const lastForecast = forecastData[forecastData.length - 1];

    return (
        <Card className="hover:shadow-lg hover:shadow-primary/5 transition-shadow duration-300">
            <CardHeader>
                <div className="flex items-start justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-primary" />
                            {title}
                        </CardTitle>
                        <CardDescription>{description}</CardDescription>
                    </div>
                    <div className="flex gap-2">
                        {forecastData.length > 0 && (
                            <Badge variant="outline" className="border-blue-500/50 text-blue-400">
                                {forecastData.length} day forecast
                            </Badge>
                        )}
                        {anomalyCount > 0 && (
                            <Badge variant="outline" className="border-orange-500/50 text-orange-400">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                {anomalyCount} anomalies
                            </Badge>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                    <ComposedChart data={chartData}>
                        <defs>
                            <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="confidenceGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.2} />
                                <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.05} />
                            </linearGradient>
                        </defs>

                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.5} />

                        <XAxis
                            dataKey="timestamp"
                            stroke="#9CA3AF"
                            tick={{ fontSize: 10 }}
                            tickLine={{ stroke: "#4B5563" }}
                            interval="preserveStartEnd"
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

                        {/* Confidence band for forecasts */}
                        <Area
                            type="monotone"
                            dataKey="upper"
                            stroke="none"
                            fill="url(#confidenceGradient)"
                            name="Confidence Band"
                            legendType="none"
                        />
                        <Area
                            type="monotone"
                            dataKey="lower"
                            stroke="none"
                            fill="transparent"
                            name="Lower Bound"
                            legendType="none"
                        />

                        {/* Historical data */}
                        <Area
                            type="monotone"
                            dataKey="actual"
                            name="Actual Events"
                            stroke="#3B82F6"
                            strokeWidth={2}
                            fill="url(#actualGradient)"
                            animationDuration={1500}
                            dot={false}
                            activeDot={{ r: 4, stroke: "#3B82F6", strokeWidth: 2 }}
                        />

                        {/* Forecast line */}
                        <Line
                            type="monotone"
                            dataKey="predicted"
                            name="Predicted"
                            stroke="#8B5CF6"
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            dot={{ r: 3, fill: "#8B5CF6" }}
                            animationDuration={1500}
                        />

                        {/* Anomaly markers */}
                        {anomalyPoints.map((point, index) => (
                            <ReferenceDot
                                key={index}
                                x={point.timestamp}
                                y={point.actual || 0}
                                r={6}
                                fill="#F97316"
                                stroke="#FFF"
                                strokeWidth={2}
                            />
                        ))}

                        {/* Brush for zooming */}
                        {chartData.length > 14 && (
                            <Brush
                                dataKey="timestamp"
                                height={30}
                                stroke="#6B7280"
                                fill="#1F2937"
                                travellerWidth={8}
                            />
                        )}
                    </ComposedChart>
                </ResponsiveContainer>

                {/* Legend annotation */}
                <div className="flex items-center justify-center gap-6 mt-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-0.5 bg-blue-500" />
                        <span>Historical</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-0.5 bg-purple-500 border-dashed border-t-2 border-purple-500" style={{ height: 0 }} />
                        <span>Forecast</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-orange-500" />
                        <span>Anomaly</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

// Format timestamp for display
function formatTimestamp(timestamp: string): string {
    if (timestamp.includes("T")) {
        // ISO format
        const date = new Date(timestamp);
        return `${date.getMonth() + 1}/${date.getDate()}`;
    }

    if (timestamp.includes(" ")) {
        const [date, time] = timestamp.split(" ");
        const [, month, day] = date.split("-");
        return `${month}/${day} ${time}`;
    }

    const [year, month, day] = timestamp.split("-");
    return `${month}/${day}`;
}

export default PredictionChart;
