/**
 * NodeContextMenu Component
 * 
 * A floating context menu that appears on right-click of nodes in
 * Topology Graph and Geographic Map screens.
 * 
 * Features:
 * - Positioned at click coordinates
 * - Context-aware menu items based on node type
 * - Smooth animations with Framer Motion
 * - Closes on outside click or Escape key
 */

import { useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Eye,
    AlertTriangle,
    MapPin,
    User,
    Car,
    Camera,
    Calendar,
    Link2,
    FileText,
    ShieldAlert,
    Network,
    X
} from "lucide-react";

export interface ContextMenuNode {
    id: string;
    name: string;
    type: "camera" | "location" | "vehicle" | "person" | "event" | "region";
    latitude?: number;
    longitude?: number;
    region?: string;
    imageUrl?: string;
    [key: string]: any;
}

export interface ContextMenuPosition {
    x: number;
    y: number;
}

export interface ContextMenuAction {
    id: string;
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    variant?: "default" | "destructive" | "warning";
    disabled?: boolean;
}

interface NodeContextMenuProps {
    node: ContextMenuNode | null;
    position: ContextMenuPosition | null;
    onClose: () => void;
    onViewDetails?: (node: ContextMenuNode) => void;
    onCreateIncident?: (node: ContextMenuNode) => void;
    onAddToPole?: (node: ContextMenuNode) => void;
    onViewRelatedEvents?: (node: ContextMenuNode) => void;
    onMarkAsHighRisk?: (node: ContextMenuNode) => void;
    onViewInTopology?: (node: ContextMenuNode) => void;
    customActions?: ContextMenuAction[];
}

// Icon mapping for node types
const NODE_TYPE_ICONS: Record<string, React.ReactNode> = {
    camera: <Camera className="w-4 h-4" />,
    location: <MapPin className="w-4 h-4" />,
    vehicle: <Car className="w-4 h-4" />,
    person: <User className="w-4 h-4" />,
    event: <Calendar className="w-4 h-4" />,
    region: <MapPin className="w-4 h-4" />,
};

// Node type colors
const NODE_TYPE_COLORS: Record<string, string> = {
    camera: "text-green-500",
    location: "text-purple-500",
    vehicle: "text-orange-500",
    person: "text-blue-500",
    event: "text-red-500",
    region: "text-cyan-500",
};

export default function NodeContextMenu({
    node,
    position,
    onClose,
    onViewDetails,
    onCreateIncident,
    onAddToPole,
    onViewRelatedEvents,
    onMarkAsHighRisk,
    onViewInTopology,
    customActions = [],
}: NodeContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        if (!node) return;

        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onClose();
            }
        };

        // Delay adding listener to prevent immediate close
        const timeout = setTimeout(() => {
            document.addEventListener("mousedown", handleClickOutside);
            document.addEventListener("keydown", handleEscape);
        }, 50);

        return () => {
            clearTimeout(timeout);
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleEscape);
        };
    }, [node, onClose]);

    // Build menu actions based on node type
    const getMenuActions = useCallback((): ContextMenuAction[] => {
        if (!node) return [];

        const actions: ContextMenuAction[] = [];

        // View Details - always available
        if (onViewDetails) {
            actions.push({
                id: "view-details",
                label: "View Details",
                icon: <Eye className="w-4 h-4" />,
                onClick: () => {
                    onViewDetails(node);
                    onClose();
                },
            });
        }

        // Create Incident - available for all types
        if (onCreateIncident) {
            actions.push({
                id: "create-incident",
                label: "Create Incident",
                icon: <AlertTriangle className="w-4 h-4" />,
                onClick: () => {
                    onCreateIncident(node);
                    onClose();
                },
            });
        }

        // Add to POLE - available for all types
        if (onAddToPole) {
            const poleLabel = node.type === "person"
                ? "Add Person to POLE"
                : node.type === "vehicle"
                    ? "Add Object to POLE"
                    : node.type === "location" || node.type === "camera" || node.type === "region"
                        ? "Add Location to POLE"
                        : "Add Event to POLE";

            actions.push({
                id: "add-to-pole",
                label: poleLabel,
                icon: <Link2 className="w-4 h-4" />,
                onClick: () => {
                    onAddToPole(node);
                    onClose();
                },
            });
        }

        // View Related Events - for cameras and locations
        if (onViewRelatedEvents && (node.type === "camera" || node.type === "location" || node.type === "region")) {
            actions.push({
                id: "view-events",
                label: "View Related Events",
                icon: <FileText className="w-4 h-4" />,
                onClick: () => {
                    onViewRelatedEvents(node);
                    onClose();
                },
            });
        }

        // View in Topology - for map elements
        if (onViewInTopology && (node.type === "camera" || node.type === "region")) {
            actions.push({
                id: "view-topology",
                label: "View in Topology",
                icon: <Network className="w-4 h-4" />,
                onClick: () => {
                    onViewInTopology(node);
                    onClose();
                },
            });
        }

        // Mark as High Risk - available for all types
        if (onMarkAsHighRisk) {
            actions.push({
                id: "mark-high-risk",
                label: "Mark as High Risk",
                icon: <ShieldAlert className="w-4 h-4" />,
                onClick: () => {
                    onMarkAsHighRisk(node);
                    onClose();
                },
                variant: "warning",
            });
        }

        // Add custom actions
        customActions.forEach((action) => {
            actions.push({
                ...action,
                onClick: () => {
                    action.onClick();
                    onClose();
                },
            });
        });

        return actions;
    }, [node, onClose, onViewDetails, onCreateIncident, onAddToPole, onViewRelatedEvents, onMarkAsHighRisk, onViewInTopology, customActions]);

    if (!node || !position) return null;

    const actions = getMenuActions();
    const nodeIcon = NODE_TYPE_ICONS[node.type] || <MapPin className="w-4 h-4" />;
    const nodeColor = NODE_TYPE_COLORS[node.type] || "text-gray-500";

    // Calculate position to keep menu in viewport
    const menuWidth = 220;
    const menuHeight = actions.length * 40 + 60; // Approximate height
    const adjustedX = position.x + menuWidth > window.innerWidth
        ? window.innerWidth - menuWidth - 10
        : position.x;
    const adjustedY = position.y + menuHeight > window.innerHeight
        ? window.innerHeight - menuHeight - 10
        : position.y;

    return (
        <AnimatePresence>
            <motion.div
                ref={menuRef}
                initial={{ opacity: 0, scale: 0.9, y: -5 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -5 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="fixed z-[100] min-w-[200px] max-w-[280px] bg-popover border border-border rounded-lg shadow-xl overflow-hidden"
                style={{
                    left: adjustedX,
                    top: adjustedY,
                }}
            >
                {/* Header with node info */}
                <div className="px-3 py-2 bg-muted/50 border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                        <span className={nodeColor}>{nodeIcon}</span>
                        <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{node.name || node.id}</p>
                            <p className="text-xs text-muted-foreground capitalize">{node.type}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-muted rounded transition-colors"
                    >
                        <X className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                </div>

                {/* Menu actions */}
                <div className="py-1">
                    {actions.map((action, index) => (
                        <motion.button
                            key={action.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.03 }}
                            onClick={action.onClick}
                            disabled={action.disabled}
                            className={`
                w-full px-3 py-2 text-left flex items-center gap-2.5 text-sm
                transition-colors hover:bg-muted
                ${action.disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                ${action.variant === "destructive" ? "text-red-500 hover:bg-red-500/10" : ""}
                ${action.variant === "warning" ? "text-orange-500 hover:bg-orange-500/10" : ""}
              `}
                        >
                            <span className={action.variant === "warning" ? "text-orange-500" : action.variant === "destructive" ? "text-red-500" : "text-muted-foreground"}>
                                {action.icon}
                            </span>
                            {action.label}
                        </motion.button>
                    ))}
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
