import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, Camera, Radio } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { motion } from "framer-motion";

interface TickerEvent {
    id: string;
    topic: string;
    level: number;
    channelName: string;
    startTime: number;
    module: string;
}

// Get level info for styling
const getLevelInfo = (level: number) => {
    switch (level) {
        case 3: return { label: "CRITICAL", color: "bg-red-600", textColor: "text-red-400" };
        case 2: return { label: "HIGH", color: "bg-orange-500", textColor: "text-orange-400" };
        case 1: return { label: "MEDIUM", color: "bg-yellow-500", textColor: "text-yellow-400" };
        default: return { label: "LOW", color: "bg-blue-500", textColor: "text-blue-400" };
    }
};

export default function EventTicker() {
    const [events, setEvents] = useState<TickerEvent[]>([]);
    const [isPaused, setIsPaused] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Fetch recent events
    const fetchEvents = useCallback(async () => {
        try {
            const response = await fetch("/api/data/events?limit=20", {
                credentials: "include",
            });

            if (!response.ok) throw new Error("Failed to fetch events");

            const data = await response.json();

            if (data.success && data.events) {
                setEvents(data.events.map((e: any) => ({
                    id: e.id,
                    topic: e.topic,
                    level: e.level,
                    channelName: e.channelName || "Unknown Camera",
                    startTime: e.startTime,
                    module: e.module,
                })));
            }
        } catch (error) {
            console.error("[EventTicker] Fetch error:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Initial fetch and auto-refresh
    useEffect(() => {
        fetchEvents();
        const interval = setInterval(fetchEvents, 10000); // Refresh every 10 seconds
        return () => clearInterval(interval);
    }, [fetchEvents]);

    if (isLoading || events.length === 0) {
        return null; // Don't render if no events
    }

    // Duplicate events for seamless scrolling
    const duplicatedEvents = [...events, ...events];

    return (
        <div
            className="relative overflow-hidden bg-gradient-to-r from-background via-card to-background border-y border-border"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
        >
            {/* Live indicator */}
            <div className="absolute left-0 top-0 bottom-0 z-10 flex items-center px-3 bg-gradient-to-r from-background via-background to-transparent">
                <div className="flex items-center gap-2 pr-4">
                    <motion.div
                        className="w-2 h-2 bg-red-500 rounded-full"
                        animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                    />
                    <span className="text-xs font-semibold text-primary uppercase tracking-wider">LIVE</span>
                </div>
            </div>

            {/* Scrolling ticker */}
            <div
                className={`flex py-2 pl-20 ${isPaused ? "" : "animate-scroll"}`}
                style={{
                    animationPlayState: isPaused ? "paused" : "running",
                }}
            >
                {duplicatedEvents.map((event, index) => {
                    const levelInfo = getLevelInfo(event.level);
                    return (
                        <div
                            key={`${event.id}-${index}`}
                            className="flex items-center gap-3 px-4 border-r border-border/50 whitespace-nowrap"
                        >
                            {/* Level indicator */}
                            <Badge className={`${levelInfo.color} text-white text-[10px] px-1.5 py-0`}>
                                {levelInfo.label}
                            </Badge>

                            {/* Event info */}
                            <div className="flex items-center gap-2">
                                <span className={`font-medium text-sm ${levelInfo.textColor}`}>
                                    {event.topic}
                                </span>
                                <span className="text-muted-foreground text-xs">•</span>
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Camera className="w-3 h-3" />
                                    {event.channelName.length > 25
                                        ? `${event.channelName.substring(0, 25)}...`
                                        : event.channelName}
                                </span>
                                <span className="text-muted-foreground text-xs">•</span>
                                <span className="text-xs text-muted-foreground">
                                    {(() => {
                                        try {
                                            const date = new Date(event.startTime);
                                            if (isNaN(date.getTime())) return "N/A";
                                            return format(date, "HH:mm:ss");
                                        } catch {
                                            return "N/A";
                                        }
                                    })()}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Right fade */}
            <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-background to-transparent pointer-events-none" />
        </div>
    );
}
