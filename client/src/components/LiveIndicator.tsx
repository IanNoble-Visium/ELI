/**
 * Live Indicator Component
 * 
 * Animated "LIVE" badge for headers indicating real-time data connection.
 * Features a pulsing red dot with glow effect.
 */
import { motion } from "framer-motion";

interface LiveIndicatorProps {
    className?: string;
    showText?: boolean;
}

export function LiveIndicator({ className = "", showText = true }: LiveIndicatorProps) {
    return (
        <div className={`flex items-center gap-2 ${className}`}>
            {/* Pulsing dot with glow */}
            <div className="relative">
                {/* Glow ring */}
                <motion.div
                    className="absolute inset-0 bg-red-500 rounded-full"
                    animate={{
                        scale: [1, 1.8, 1],
                        opacity: [0.5, 0, 0.5],
                    }}
                    transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                />
                {/* Core dot */}
                <motion.div
                    className="relative w-2.5 h-2.5 bg-red-500 rounded-full shadow-lg"
                    style={{
                        boxShadow: "0 0 8px rgba(239, 68, 68, 0.6)",
                    }}
                    animate={{
                        scale: [1, 1.1, 1],
                    }}
                    transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                />
            </div>

            {/* LIVE text */}
            {showText && (
                <span className="text-xs font-bold text-red-500 tracking-wider uppercase">
                    LIVE
                </span>
            )}
        </div>
    );
}

export default LiveIndicator;
