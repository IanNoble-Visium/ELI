/**
 * Timeline Agent Dashboard
 * 
 * Displays discovered timelines, execution history, and allows manual triggering.
 * Visualizes timelines as horizontal sequences of events.
 */
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Clock,
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
}

interface TimelineEvent {
    id: string;
    timestamp: number;
    channelId: string;
    region?: string;
}

export default function TimelineAgentDashboard() {
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
                fetch("/api/data/agent-runs?agentType=timeline&limit=20"),
                fetch("/api/data/agent-config?agentType=timeline"),
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
            console.error("Error fetching timeline agent data:", err);
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
            const res = await fetch("/api/cron/agent-timeline?manual=true");
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
    const stats = {
        totalRuns: runs.length,
        successfulRuns: runs.filter(r => r.status === "completed" && r.groupId).length,
        totalTimelines: runs.filter(r => r.groupId).length,
        totalNodesTagged: runs.reduce((sum, r) => sum + (r.nodesTagged || 0), 0),
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
                return <Clock className="w-4 h-4 text-gray-400" />;
        }
    };

    // Format timestamp
    const formatTime = (ts: string) => {
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
                <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
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
                            <Clock className="w-8 h-8 text-red-500" />
                            Timeline Agent
                        </h1>
                        <p className="text-gray-400 mt-2">
                            Discovers temporal sequences of related events across cameras
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
                                    : "bg-red-600 hover:bg-red-700 text-white"
                                }
                transition-colors
              `}
                        >
                            {isRunning ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Running...
                                </>
                            ) : (
                                <>
                                    <Play className="w-4 h-4" />
                                    Run Now
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
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
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
                        <div className="text-gray-400 text-sm mb-1">Timelines Discovered</div>
                        <div className="text-3xl font-bold text-green-400">{stats.totalTimelines}</div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="bg-gray-800/50 backdrop-blur border border-gray-700 rounded-xl p-6"
                    >
                        <div className="text-gray-400 text-sm mb-1">Nodes Tagged</div>
                        <div className="text-3xl font-bold text-blue-400">{stats.totalNodesTagged}</div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="bg-gray-800/50 backdrop-blur border border-gray-700 rounded-xl p-6"
                    >
                        <div className="text-gray-400 text-sm mb-1">Agent Status</div>
                        <div className={`text-xl font-bold ${config?.enabled ? "text-green-400" : "text-yellow-400"}`}>
                            {config?.enabled ? "Enabled" : "Disabled"}
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
                                Recent Runs
                            </h2>
                        </div>

                        <div className="divide-y divide-gray-700">
                            {runs.length === 0 ? (
                                <div className="p-8 text-center text-gray-400">
                                    <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                    <p>No runs yet. Click "Run Now" to discover timelines.</p>
                                </div>
                            ) : (
                                runs.map((run, index) => (
                                    <motion.div
                                        key={run.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        className={`
                      p-4 cursor-pointer transition-colors
                      ${selectedRun?.id === run.id ? "bg-gray-700/50" : "hover:bg-gray-700/30"}
                    `}
                                        onClick={() => setSelectedRun(run)}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <StatusIcon status={run.status} />
                                                <div>
                                                    <div className="text-white font-medium">
                                                        {run.groupId || run.id}
                                                    </div>
                                                    <div className="text-gray-400 text-sm">
                                                        {formatTime(run.startedAt)} • {run.runMode} mode
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4">
                                                {run.groupSize && (
                                                    <span className="text-green-400 text-sm">
                                                        {run.groupSize} events
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
                                ))
                            )}
                        </div>
                    </div>

                    {/* Selected Run Details */}
                    <div className="bg-gray-800/50 backdrop-blur border border-gray-700 rounded-xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-700">
                            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                                <Eye className="w-5 h-5" />
                                Run Details
                            </h2>
                        </div>

                        {selectedRun ? (
                            <div className="p-6 space-y-6">
                                {/* Status */}
                                <div className="flex items-center gap-2">
                                    <StatusIcon status={selectedRun.status} />
                                    <span className={`font-medium ${selectedRun.status === "completed" ? "text-green-400" :
                                            selectedRun.status === "failed" ? "text-red-400" :
                                                selectedRun.status === "discarded" ? "text-yellow-400" : "text-gray-400"
                                        }`}>
                                        {selectedRun.status.charAt(0).toUpperCase() + selectedRun.status.slice(1)}
                                    </span>
                                </div>

                                {/* Summary */}
                                {selectedRun.executiveSummary && (
                                    <div>
                                        <h3 className="text-gray-400 text-sm mb-2">Executive Summary</h3>
                                        <p className="text-white text-sm bg-gray-700/50 p-3 rounded-lg">
                                            {selectedRun.executiveSummary}
                                        </p>
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

                                {/* Timeline Visualization */}
                                {selectedRun.findings?.timeline && (
                                    <div>
                                        <h3 className="text-gray-400 text-sm mb-3">Timeline Sequence</h3>
                                        <div className="relative">
                                            {/* Timeline line */}
                                            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-red-500 to-red-900" />

                                            {/* Events */}
                                            <div className="space-y-4">
                                                {(selectedRun.findings.timeline as TimelineEvent[]).slice(0, 10).map((event, idx) => (
                                                    <div key={event.id} className="flex items-start gap-4 pl-1">
                                                        <div className="w-6 h-6 rounded-full bg-red-600 flex items-center justify-center text-white text-xs font-bold z-10">
                                                            {idx + 1}
                                                        </div>
                                                        <div className="flex-1 bg-gray-700/50 rounded-lg p-3">
                                                            <div className="text-white text-sm font-mono">
                                                                {new Date(event.timestamp).toLocaleString()}
                                                            </div>
                                                            <div className="text-gray-400 text-xs mt-1 flex items-center gap-2">
                                                                <Camera className="w-3 h-3" />
                                                                {event.channelId}
                                                                {event.region && (
                                                                    <>
                                                                        <MapPin className="w-3 h-3 ml-2" />
                                                                        {event.region}
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}

                                                {selectedRun.findings.timeline.length > 10 && (
                                                    <div className="text-gray-500 text-sm pl-11">
                                                        +{selectedRun.findings.timeline.length - 10} more events
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Shared Properties */}
                                {selectedRun.findings?.sharedProperties?.length > 0 && (
                                    <div>
                                        <h3 className="text-gray-400 text-sm mb-2">Common Identifiers</h3>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedRun.findings.sharedProperties.map((prop: string, idx: number) => (
                                                <span
                                                    key={idx}
                                                    className="px-2 py-1 bg-blue-900/50 text-blue-300 text-xs rounded-full"
                                                >
                                                    {prop}
                                                </span>
                                            ))}
                                        </div>
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
                                <p>Select a run to view details</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Configuration */}
                {config && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="mt-6 bg-gray-800/50 backdrop-blur border border-gray-700 rounded-xl p-6"
                    >
                        <h2 className="text-lg font-semibold text-white mb-4">Configuration</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            <div>
                                <div className="text-gray-400 text-xs">Batch Size</div>
                                <div className="text-white font-medium">{config.batchSize}</div>
                            </div>
                            <div>
                                <div className="text-gray-400 text-xs">Confidence Threshold</div>
                                <div className="text-white font-medium">{(config.confidenceThreshold * 100).toFixed(0)}%</div>
                            </div>
                            <div>
                                <div className="text-gray-400 text-xs">Min Size (CRON)</div>
                                <div className="text-white font-medium">{config.minGroupSizeCron}</div>
                            </div>
                            <div>
                                <div className="text-gray-400 text-xs">Min Size (Context)</div>
                                <div className="text-white font-medium">{config.minGroupSizeContext}</div>
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
