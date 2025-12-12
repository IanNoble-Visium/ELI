/**
 * Anomaly Agent Dashboard
 * 
 * Displays detected anomalies, severity levels, and regional groupings.
 * Uses color-coded severity indicators and time-based visualization.
 */
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    AlertTriangle,
    Calendar,
    Play,
    RefreshCw,
    ChevronRight,
    MapPin,
    Camera,
    Eye,
    AlertCircle,
    CheckCircle,
    XCircle,
    Loader2,
    FileText,
    Download,
    ExternalLink,
    Flame,
    Shield,
    Car,
    Users,
    Siren,
} from "lucide-react";

// Types
interface AgentRun {
    id: string;
    agentType: string;
    runMode: string;
    status: string;
    nodesProcessed: number;
    nodesMatched: number;
    nodesTagged: number;
    batchesCompleted: number;
    processingTimeMs: number;
    groupId: string | null;
    groupSize: number | null;
    executiveSummary: string | null;
    findings: any;
    startedAt: string;
    completedAt: string | null;
}

interface AgentConfig {
    enabled: boolean;
    batchSize: number;
    confidenceThreshold: number;
    minGroupSizeCron: number;
    minGroupSizeContext: number;
    maxExecutionMs: number;
    overlapThreshold: number;
    scanNewEventsOnly: boolean;
    config?: {
        timeWindowHours?: number;
        regionRadiusKm?: number;
        minPeopleForGathering?: number;
    };
}

interface AnomalyEvent {
    id: string;
    timestamp: number;
    channelId: string;
    region?: string;
    anomalyType?: string;
}

// Severity colors
const severityColors = {
    critical: {
        bg: "bg-red-900/30",
        border: "border-red-600",
        text: "text-red-400",
        badge: "bg-red-600",
    },
    high: {
        bg: "bg-orange-900/30",
        border: "border-orange-600",
        text: "text-orange-400",
        badge: "bg-orange-600",
    },
    medium: {
        bg: "bg-yellow-900/30",
        border: "border-yellow-600",
        text: "text-yellow-400",
        badge: "bg-yellow-600",
    },
};

// Anomaly type icons
const AnomalyIcon = ({ type }: { type: string }) => {
    const types = type.toLowerCase().split(", ");

    if (types.includes("fire")) return <Flame className="w-4 h-4 text-red-400" />;
    if (types.includes("weapon") || types.includes("violence")) return <Shield className="w-4 h-4 text-red-400" />;
    if (types.includes("accident")) return <Car className="w-4 h-4 text-orange-400" />;
    if (types.includes("gathering")) return <Users className="w-4 h-4 text-yellow-400" />;
    if (types.includes("emergency")) return <Siren className="w-4 h-4 text-red-400" />;
    return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
};

export default function AnomalyAgentDashboard() {
    const [runs, setRuns] = useState<AgentRun[]>([]);
    const [config, setConfig] = useState<AgentConfig | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRunning, setIsRunning] = useState(false);
    const [selectedRun, setSelectedRun] = useState<AgentRun | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Fetch runs and config
    const fetchData = useCallback(async () => {
        try {
            const [runsRes, configRes] = await Promise.all([
                fetch("/api/data/agent-runs?agentType=anomaly&limit=20"),
                fetch("/api/data/agent-config?agentType=anomaly"),
            ]);

            if (runsRes.ok) {
                const runsData = await runsRes.json();
                setRuns(runsData.runs || []);
            }

            if (configRes.ok) {
                const configData = await configRes.json();
                setConfig(configData.config);
            }

            setError(null);
        } catch (err) {
            setError("Failed to load agent data");
            console.error("Error fetching anomaly agent data:", err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        // Auto-refresh every 30 seconds
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, [fetchData]);

    // Trigger manual run
    const triggerRun = async () => {
        setIsRunning(true);
        try {
            const res = await fetch("/api/cron/agent-anomaly?manual=true");
            const data = await res.json();

            if (data.status === "completed" || data.status === "discarded") {
                // Refresh to show new run
                await fetchData();
            }
        } catch (err) {
            setError("Failed to trigger agent run");
        } finally {
            setIsRunning(false);
        }
    };

    // Calculate stats
    const runsWithGroups = runs.filter(r => r.groupId);
    const stats = {
        totalRuns: runs.length,
        anomaliesDetected: runsWithGroups.length,
        totalNodesTagged: runs.reduce((sum, r) => sum + (r.nodesTagged || 0), 0),
        criticalCount: runsWithGroups.filter(r => r.findings?.severity === "critical").length,
        highCount: runsWithGroups.filter(r => r.findings?.severity === "high").length,
        mediumCount: runsWithGroups.filter(r => r.findings?.severity === "medium").length,
    };

    // Status icon
    const StatusIcon = ({ status }: { status: string }) => {
        switch (status) {
            case "completed":
                return <CheckCircle className="w-4 h-4 text-green-400" />;
            case "running":
                return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
            case "failed":
                return <XCircle className="w-4 h-4 text-red-400" />;
            case "discarded":
                return <AlertCircle className="w-4 h-4 text-yellow-400" />;
            default:
                return <AlertTriangle className="w-4 h-4 text-gray-400" />;
        }
    };

    // Format timestamp
    const formatTime = (ts: string | number) => {
        return new Date(ts).toLocaleString();
    };

    // Format duration
    const formatDuration = (ms: number) => {
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(1)}s`;
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6">
            {/* Header */}
            <div className="max-w-7xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                            <AlertTriangle className="w-8 h-8 text-orange-500" />
                            Anomaly Agent
                        </h1>
                        <p className="text-gray-400 mt-2">
                            Detects unusual events: fires, violence, accidents, weapons, gatherings
                        </p>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={fetchData}
                            className="p-2 text-gray-400 hover:text-white transition-colors"
                            title="Refresh"
                        >
                            <RefreshCw className="w-5 h-5" />
                        </button>

                        <button
                            onClick={triggerRun}
                            disabled={isRunning}
                            className={`
                flex items-center gap-2 px-4 py-2 rounded-lg font-medium
                ${isRunning
                                    ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                                    : "bg-orange-600 hover:bg-orange-700 text-white"
                                }
                transition-colors
              `}
                        >
                            {isRunning ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Scanning...
                                </>
                            ) : (
                                <>
                                    <Play className="w-4 h-4" />
                                    Scan Now
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Error Banner */}
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg mb-6"
                    >
                        {error}
                    </motion.div>
                )}

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-gray-800/50 backdrop-blur border border-gray-700 rounded-xl p-6"
                    >
                        <div className="text-gray-400 text-sm mb-1">Total Runs</div>
                        <div className="text-3xl font-bold text-white">{stats.totalRuns}</div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-gray-800/50 backdrop-blur border border-gray-700 rounded-xl p-6"
                    >
                        <div className="text-gray-400 text-sm mb-1">Anomalies Detected</div>
                        <div className="text-3xl font-bold text-orange-400">{stats.anomaliesDetected}</div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="bg-gray-800/50 backdrop-blur border border-gray-700 rounded-xl p-6"
                    >
                        <div className="text-gray-400 text-sm mb-1">Critical</div>
                        <div className="text-3xl font-bold text-red-400">{stats.criticalCount}</div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="bg-gray-800/50 backdrop-blur border border-gray-700 rounded-xl p-6"
                    >
                        <div className="text-gray-400 text-sm mb-1">High</div>
                        <div className="text-3xl font-bold text-orange-400">{stats.highCount}</div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="bg-gray-800/50 backdrop-blur border border-gray-700 rounded-xl p-6"
                    >
                        <div className="text-gray-400 text-sm mb-1">Medium</div>
                        <div className="text-3xl font-bold text-yellow-400">{stats.mediumCount}</div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="bg-gray-800/50 backdrop-blur border border-gray-700 rounded-xl p-6"
                    >
                        <div className="text-gray-400 text-sm mb-1">Agent Status</div>
                        <div className={`text-xl font-bold ${config?.enabled ? "text-green-400" : "text-yellow-400"}`}>
                            {config?.enabled ? "Active" : "Inactive"}
                        </div>
                    </motion.div>
                </div>

                {/* Main Content */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Recent Runs */}
                    <div className="lg:col-span-2 bg-gray-800/50 backdrop-blur border border-gray-700 rounded-xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-700">
                            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                                <Calendar className="w-5 h-5" />
                                Recent Detections
                            </h2>
                        </div>

                        <div className="divide-y divide-gray-700">
                            {runs.length === 0 ? (
                                <div className="p-8 text-center text-gray-400">
                                    <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                    <p>No anomaly detection runs yet. Click "Scan Now" to detect anomalies.</p>
                                </div>
                            ) : (
                                runs.map((run, index) => {
                                    const severity = run.findings?.severity as keyof typeof severityColors || "medium";
                                    const colors = severityColors[severity] || severityColors.medium;

                                    return (
                                        <motion.div
                                            key={run.id}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: index * 0.05 }}
                                            className={`
                        p-4 cursor-pointer transition-colors
                        ${selectedRun?.id === run.id ? "bg-gray-700/50" : "hover:bg-gray-700/30"}
                        ${run.groupId ? colors.bg : ""}
                      `}
                                            onClick={() => setSelectedRun(run)}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    {run.groupId ? (
                                                        <div className={`w-8 h-8 rounded-full ${colors.badge} flex items-center justify-center`}>
                                                            <AnomalyIcon type={run.findings?.anomalyTypes?.join(", ") || ""} />
                                                        </div>
                                                    ) : (
                                                        <StatusIcon status={run.status} />
                                                    )}
                                                    <div>
                                                        <div className="text-white font-medium flex items-center gap-2">
                                                            {run.groupId || run.id}
                                                            {run.findings?.severity && (
                                                                <span className={`text-xs px-2 py-0.5 rounded ${colors.badge} text-white uppercase`}>
                                                                    {run.findings.severity}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-gray-400 text-sm">
                                                            {formatTime(run.startedAt)} • {run.runMode} mode
                                                            {run.findings?.region && (
                                                                <span className="ml-2 flex items-center gap-1 inline-flex">
                                                                    <MapPin className="w-3 h-3" />
                                                                    {run.findings.region}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-4">
                                                    {run.groupSize && (
                                                        <span className={`text-sm ${colors.text || "text-gray-400"}`}>
                                                            {run.groupSize} events
                                                        </span>
                                                    )}
                                                    {run.findings?.anomalyTypes && (
                                                        <span className="text-gray-500 text-sm">
                                                            {run.findings.anomalyTypes.join(", ")}
                                                        </span>
                                                    )}
                                                    <span className="text-gray-500 text-sm">
                                                        {formatDuration(run.processingTimeMs || 0)}
                                                    </span>
                                                    <ChevronRight className="w-4 h-4 text-gray-500" />
                                                </div>
                                            </div>

                                            {run.executiveSummary && (
                                                <p className="text-gray-400 text-sm mt-2 line-clamp-2">
                                                    {run.executiveSummary}
                                                </p>
                                            )}
                                        </motion.div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Selected Run Details */}
                    <div className="bg-gray-800/50 backdrop-blur border border-gray-700 rounded-xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-700">
                            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                                <Eye className="w-5 h-5" />
                                Anomaly Details
                            </h2>
                        </div>

                        {selectedRun ? (
                            <div className="p-6 space-y-6">
                                {/* Severity Badge */}
                                {selectedRun.findings?.severity && (
                                    <div className={`
                    inline-flex items-center gap-2 px-3 py-2 rounded-lg
                    ${severityColors[selectedRun.findings.severity as keyof typeof severityColors]?.bg || ""}
                    ${severityColors[selectedRun.findings.severity as keyof typeof severityColors]?.border || ""} border
                  `}>
                                        <AlertTriangle className={`w-5 h-5 ${severityColors[selectedRun.findings.severity as keyof typeof severityColors]?.text || ""}`} />
                                        <span className={`font-bold uppercase ${severityColors[selectedRun.findings.severity as keyof typeof severityColors]?.text || ""}`}>
                                            {selectedRun.findings.severity} Anomaly
                                        </span>
                                    </div>
                                )}

                                {/* Summary */}
                                {selectedRun.executiveSummary && (
                                    <div>
                                        <h3 className="text-gray-400 text-sm mb-2">Executive Summary</h3>
                                        <p className="text-white text-sm bg-gray-700/50 p-3 rounded-lg">
                                            {selectedRun.executiveSummary}
                                        </p>
                                    </div>
                                )}

                                {/* Time Range */}
                                {selectedRun.findings?.startTime && (
                                    <div>
                                        <h3 className="text-gray-400 text-sm mb-2">Time Range</h3>
                                        <div className="text-white text-sm">
                                            <div>{formatTime(selectedRun.findings.startTime)}</div>
                                            <div className="text-gray-500">to</div>
                                            <div>{formatTime(selectedRun.findings.endTime)}</div>
                                        </div>
                                    </div>
                                )}

                                {/* Metrics */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <div className="text-gray-400 text-xs">Processed</div>
                                        <div className="text-white font-medium">{selectedRun.nodesProcessed}</div>
                                    </div>
                                    <div>
                                        <div className="text-gray-400 text-xs">Matched</div>
                                        <div className="text-white font-medium">{selectedRun.nodesMatched}</div>
                                    </div>
                                    <div>
                                        <div className="text-gray-400 text-xs">Tagged</div>
                                        <div className="text-green-400 font-medium">{selectedRun.nodesTagged}</div>
                                    </div>
                                    <div>
                                        <div className="text-gray-400 text-xs">Duration</div>
                                        <div className="text-white font-medium">
                                            {formatDuration(selectedRun.processingTimeMs || 0)}
                                        </div>
                                    </div>
                                </div>

                                {/* Anomaly Types */}
                                {selectedRun.findings?.anomalyTypes?.length > 0 && (
                                    <div>
                                        <h3 className="text-gray-400 text-sm mb-2">Detected Anomaly Types</h3>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedRun.findings.anomalyTypes.map((type: string, idx: number) => (
                                                <span
                                                    key={idx}
                                                    className="flex items-center gap-1 px-2 py-1 bg-orange-900/50 text-orange-300 text-xs rounded-full"
                                                >
                                                    <AnomalyIcon type={type} />
                                                    {type.charAt(0).toUpperCase() + type.slice(1)}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Event List */}
                                {selectedRun.findings?.anomaly && (
                                    <div>
                                        <h3 className="text-gray-400 text-sm mb-3">Affected Events</h3>
                                        <div className="space-y-2 max-h-48 overflow-y-auto">
                                            {(selectedRun.findings.anomaly as AnomalyEvent[]).slice(0, 10).map((event, idx) => (
                                                <div
                                                    key={event.id}
                                                    className="p-2 bg-gray-700/50 rounded-lg text-xs"
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-white font-mono">{event.id.slice(-12)}</span>
                                                        <span className="text-gray-400">{formatTime(event.timestamp)}</span>
                                                    </div>
                                                    <div className="text-gray-500 flex items-center gap-2 mt-1">
                                                        <Camera className="w-3 h-3" />
                                                        {event.channelId?.slice(-8) || "Unknown"}
                                                        {event.anomalyType && (
                                                            <span className="text-orange-400">• {event.anomalyType}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        {selectedRun.findings.anomaly.length > 10 && (
                                            <div className="text-gray-500 text-sm text-center mt-2">
                                                +{selectedRun.findings.anomaly.length - 10} more events
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex gap-2 pt-4 border-t border-gray-700">
                                    <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors">
                                        <ExternalLink className="w-4 h-4" />
                                        View in Topology
                                    </button>
                                    <button className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors">
                                        <Download className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="p-8 text-center text-gray-400">
                                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                <p>Select a detection to view anomaly details</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Configuration */}
                {config && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 }}
                        className="mt-6 bg-gray-800/50 backdrop-blur border border-gray-700 rounded-xl p-6"
                    >
                        <h2 className="text-lg font-semibold text-white mb-4">Configuration</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            <div>
                                <div className="text-gray-400 text-xs">Batch Size</div>
                                <div className="text-white font-medium">{config.batchSize}</div>
                            </div>
                            <div>
                                <div className="text-gray-400 text-xs">Min Group Size (CRON)</div>
                                <div className="text-white font-medium">{config.minGroupSizeCron}</div>
                            </div>
                            <div>
                                <div className="text-gray-400 text-xs">Min Group Size (Context)</div>
                                <div className="text-white font-medium">{config.minGroupSizeContext}</div>
                            </div>
                            <div>
                                <div className="text-gray-400 text-xs">Time Window</div>
                                <div className="text-white font-medium">{config.config?.timeWindowHours || 1} hour</div>
                            </div>
                            <div>
                                <div className="text-gray-400 text-xs">Max Execution</div>
                                <div className="text-white font-medium">{config.maxExecutionMs}ms</div>
                            </div>
                            <div>
                                <div className="text-gray-400 text-xs">Overlap Threshold</div>
                                <div className="text-white font-medium">{config.overlapThreshold}</div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    );
}
