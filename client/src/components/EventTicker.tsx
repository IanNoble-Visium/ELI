import { useState, useEffect, useCallback } from "react";
import { Camera, Image as ImageIcon, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { motion } from "framer-motion";

interface Snapshot {
    id: string;
    type?: string;
    imageUrl?: string;
    cloudinaryPublicId?: string;
}

interface TickerEvent {
    id: string;
    topic: string;
    level: number;
    channelName: string;
    startTime: number;
    module: string;
    hasImages: boolean;
    snapshots: Snapshot[];
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

// Check if event has valid Cloudinary images
const hasValidImages = (event: any): boolean => {
    if (!event.snapshots || event.snapshots.length === 0) return false;
    return event.snapshots.some((s: any) =>
        s.imageUrl && s.imageUrl.includes("cloudinary.com")
    );
};

// Get Cloudinary image URLs from event
const getImageUrls = (snapshots: Snapshot[]): string[] => {
    return snapshots
        .filter(s => s.imageUrl && s.imageUrl.includes("cloudinary.com"))
        .map(s => s.imageUrl!)
        .slice(0, 6); // Limit to 6 images
};

export default function EventTicker() {
    const [events, setEvents] = useState<TickerEvent[]>([]);
    const [isPaused, setIsPaused] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedEvent, setSelectedEvent] = useState<TickerEvent | null>(null);

    // Fetch recent events with images only
    const fetchEvents = useCallback(async () => {
        try {
            const response = await fetch("/api/data/events?limit=50", {
                credentials: "include",
            });

            if (!response.ok) throw new Error("Failed to fetch events");

            const data = await response.json();

            if (data.success && data.events) {
                // Filter for events with valid Cloudinary images
                const eventsWithImages = data.events
                    .filter((e: any) => hasValidImages(e))
                    .slice(0, 20)
                    .map((e: any) => ({
                        id: e.id,
                        topic: e.topic,
                        level: e.level,
                        channelName: e.channel?.name || e.channelName || "Unknown Camera",
                        startTime: e.startTime,
                        module: e.module,
                        hasImages: true,
                        snapshots: e.snapshots || [],
                    }));

                setEvents(eventsWithImages);
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

    // Handle event click
    const handleEventClick = (event: TickerEvent) => {
        setSelectedEvent(event);
        setIsPaused(true);
    };

    // Close dialog
    const handleCloseDialog = () => {
        setSelectedEvent(null);
    };

    if (isLoading) {
        return (
            <div className="relative overflow-hidden bg-gradient-to-r from-background via-card to-background border-y border-border">
                <div className="flex items-center py-2 px-3 gap-2">
                    <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-pulse" />
                    <span className="text-xs text-muted-foreground">Loading events with images...</span>
                </div>
            </div>
        );
    }

    if (events.length === 0) {
        return (
            <div className="relative overflow-hidden bg-gradient-to-r from-background via-card to-background border-y border-border">
                <div className="flex items-center py-2 px-3 gap-3">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-muted-foreground/30 rounded-full" />
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">LIVE</span>
                    </div>
                    <span className="text-xs text-muted-foreground">Waiting for events with images...</span>
                </div>
            </div>
        );
    }

    // Duplicate events for seamless scrolling
    const duplicatedEvents = [...events, ...events];

    return (
        <>
            <div
                className="relative overflow-hidden bg-gradient-to-r from-background via-card to-background border-y border-border"
                onMouseEnter={() => setIsPaused(true)}
                onMouseLeave={() => !selectedEvent && setIsPaused(false)}
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
                        <ImageIcon className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                </div>

                {/* Scrolling ticker */}
                <div
                    className={`flex py-2 pl-24 ${isPaused ? "" : "animate-scroll"}`}
                    style={{
                        animationPlayState: isPaused ? "paused" : "running",
                    }}
                >
                    {duplicatedEvents.map((event, index) => {
                        const levelInfo = getLevelInfo(event.level);
                        const imageCount = getImageUrls(event.snapshots).length;

                        return (
                            <div
                                key={`${event.id}-${index}`}
                                className="flex items-center gap-4 px-6 border-r border-border/50 whitespace-nowrap min-w-fit cursor-pointer hover:bg-muted/30 transition-colors rounded"
                                onClick={() => handleEventClick(event)}
                            >
                                {/* Level indicator */}
                                <Badge className={`${levelInfo.color} text-white text-xs font-bold px-2 py-0.5 uppercase tracking-wide shadow-sm`}>
                                    {levelInfo.label}
                                </Badge>

                                {/* Event info */}
                                <div className="flex items-center gap-3">
                                    <span className={`font-semibold text-sm ${levelInfo.textColor}`}>
                                        {event.topic}
                                    </span>
                                    <span className="text-muted-foreground/50">|</span>
                                    <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                                        <Camera className="w-3.5 h-3.5" />
                                        {event.channelName.length > 20
                                            ? `${event.channelName.substring(0, 20)}...`
                                            : event.channelName}
                                    </span>
                                    <span className="text-muted-foreground/50">|</span>
                                    <span className="text-sm text-muted-foreground font-mono">
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
                                    {/* Image count indicator */}
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary">
                                        <ImageIcon className="w-3 h-3 mr-1" />
                                        {imageCount}
                                    </Badge>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Right fade */}
                <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-background to-transparent pointer-events-none" />
            </div>

            {/* Image Preview Dialog */}
            <Dialog open={!!selectedEvent} onOpenChange={() => handleCloseDialog()}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-3">
                            <Badge className={`${getLevelInfo(selectedEvent?.level || 0).color} text-white`}>
                                {getLevelInfo(selectedEvent?.level || 0).label}
                            </Badge>
                            <span>{selectedEvent?.topic}</span>
                            <span className="text-muted-foreground text-sm font-normal">
                                • {selectedEvent?.channelName}
                            </span>
                        </DialogTitle>
                    </DialogHeader>

                    {selectedEvent && (
                        <div className="space-y-4">
                            {/* Event details */}
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <span>Module: {selectedEvent.module}</span>
                                <span>•</span>
                                <span>
                                    Time: {(() => {
                                        try {
                                            return format(new Date(selectedEvent.startTime), "PPpp");
                                        } catch {
                                            return "N/A";
                                        }
                                    })()}
                                </span>
                            </div>

                            {/* Image grid */}
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {getImageUrls(selectedEvent.snapshots).map((url, idx) => (
                                    <a
                                        key={idx}
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="relative aspect-video rounded-lg overflow-hidden bg-muted hover:ring-2 hover:ring-primary transition-all group"
                                    >
                                        <img
                                            src={url}
                                            alt={`Snapshot ${idx + 1}`}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                            loading="lazy"
                                        />
                                        <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                                            {idx + 1} / {getImageUrls(selectedEvent.snapshots).length}
                                        </div>
                                    </a>
                                ))}
                            </div>

                            {getImageUrls(selectedEvent.snapshots).length === 0 && (
                                <div className="text-center py-8 text-muted-foreground">
                                    No images available for this event
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
