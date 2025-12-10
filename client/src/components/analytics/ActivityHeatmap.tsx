/**
 * Activity Heatmap Component
 * 
 * Visual heatmap showing camera activity patterns by hour of day and day of week.
 * Inspired by GitHub contribution graph and Grafana heatmaps.
 */
import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface HeatmapData {
    hour: number;
    day: number;
    value: number;
}

interface ActivityHeatmapProps {
    data: HeatmapData[];
    title: string;
    description: string;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function ActivityHeatmap({ data, title, description }: ActivityHeatmapProps) {
    // Calculate max value for color scaling
    const maxValue = useMemo(() => {
        return Math.max(...data.map(d => d.value), 1);
    }, [data]);

    // Create lookup map for quick access
    const valueMap = useMemo(() => {
        const map = new Map<string, number>();
        data.forEach(d => {
            map.set(`${d.hour}-${d.day}`, d.value);
        });
        return map;
    }, [data]);

    // Get color based on value intensity
    const getColor = (value: number): string => {
        if (value === 0) return "bg-muted/30";

        const intensity = value / maxValue;

        if (intensity < 0.2) return "bg-primary/20";
        if (intensity < 0.4) return "bg-primary/40";
        if (intensity < 0.6) return "bg-primary/60";
        if (intensity < 0.8) return "bg-primary/80";
        return "bg-primary";
    };

    // Format hour for display
    const formatHour = (hour: number): string => {
        if (hour === 0) return "12AM";
        if (hour === 12) return "12PM";
        if (hour < 12) return `${hour}AM`;
        return `${hour - 12}PM`;
    };

    return (
        <Card className="hover:shadow-lg hover:shadow-primary/5 transition-shadow duration-300">
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <div className="min-w-[500px]">
                        {/* Hour labels */}
                        <div className="flex mb-1 ml-12">
                            {HOURS.filter(h => h % 3 === 0).map(hour => (
                                <div
                                    key={hour}
                                    className="text-[10px] text-muted-foreground"
                                    style={{ width: `${100 / 8}%`, textAlign: "center" }}
                                >
                                    {formatHour(hour)}
                                </div>
                            ))}
                        </div>

                        {/* Heatmap grid */}
                        <div className="space-y-1">
                            {DAYS.map((day, dayIndex) => (
                                <div key={day} className="flex items-center gap-1">
                                    {/* Day label */}
                                    <div className="w-10 text-xs text-muted-foreground text-right pr-2">
                                        {day}
                                    </div>

                                    {/* Hour cells */}
                                    <div className="flex-1 flex gap-0.5">
                                        <TooltipProvider>
                                            {HOURS.map(hour => {
                                                const value = valueMap.get(`${hour}-${dayIndex}`) || 0;
                                                return (
                                                    <Tooltip key={`${hour}-${dayIndex}`}>
                                                        <TooltipTrigger asChild>
                                                            <div
                                                                className={`
                                  flex-1 aspect-square rounded-sm cursor-pointer
                                  transition-all duration-200 hover:ring-2 hover:ring-primary/50
                                  ${getColor(value)}
                                `}
                                                                style={{ minWidth: "12px", maxWidth: "24px" }}
                                                            />
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <div className="text-sm">
                                                                <p className="font-medium">{day} {formatHour(hour)}</p>
                                                                <p className="text-muted-foreground">
                                                                    {value.toLocaleString()} events
                                                                </p>
                                                            </div>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                );
                                            })}
                                        </TooltipProvider>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Legend */}
                        <div className="flex items-center justify-end gap-2 mt-4 text-xs text-muted-foreground">
                            <span>Less</span>
                            <div className="flex gap-0.5">
                                <div className="w-3 h-3 rounded-sm bg-muted/30" />
                                <div className="w-3 h-3 rounded-sm bg-primary/20" />
                                <div className="w-3 h-3 rounded-sm bg-primary/40" />
                                <div className="w-3 h-3 rounded-sm bg-primary/60" />
                                <div className="w-3 h-3 rounded-sm bg-primary/80" />
                                <div className="w-3 h-3 rounded-sm bg-primary" />
                            </div>
                            <span>More</span>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export default ActivityHeatmap;
