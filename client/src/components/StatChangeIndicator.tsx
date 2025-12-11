/**
 * Stat Change Indicator Component
 * 
 * Animated +/- symbols showing KPI value changes.
 * Color-coded: green for positive, red for negative.
 */
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StatChangeIndicatorProps {
    currentValue: number;
    previousValue: number;
    showAbsoluteChange?: boolean;
    className?: string;
}

export function StatChangeIndicator({
    currentValue,
    previousValue,
    showAbsoluteChange = true,
    className = "",
}: StatChangeIndicatorProps) {
    const change = currentValue - previousValue;
    const percentChange = previousValue !== 0
        ? ((change / previousValue) * 100).toFixed(1)
        : change > 0 ? "+∞" : change < 0 ? "-∞" : "0";

    const isPositive = change > 0;
    const isNegative = change < 0;
    const isNeutral = change === 0;

    if (isNeutral) {
        return (
            <div className={`flex items-center gap-1 text-muted-foreground text-xs ${className}`}>
                <Minus className="w-3 h-3" />
                <span>No change</span>
            </div>
        );
    }

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={`${currentValue}-${previousValue}`}
                initial={{ opacity: 0, y: isPositive ? 10 : -10, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{
                    type: "spring",
                    stiffness: 500,
                    damping: 30,
                    duration: 0.3
                }}
                className={`flex items-center gap-1 text-xs font-medium ${isPositive ? "text-green-500" : "text-red-500"
                    } ${className}`}
            >
                {/* Arrow icon */}
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.1, type: "spring", stiffness: 400 }}
                >
                    {isPositive ? (
                        <TrendingUp className="w-3.5 h-3.5" />
                    ) : (
                        <TrendingDown className="w-3.5 h-3.5" />
                    )}
                </motion.div>

                {/* Change value */}
                <motion.span
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 }}
                >
                    {isPositive ? "+" : ""}{showAbsoluteChange ? change.toLocaleString() : `${percentChange}%`}
                </motion.span>
            </motion.div>
        </AnimatePresence>
    );
}

export default StatChangeIndicator;
