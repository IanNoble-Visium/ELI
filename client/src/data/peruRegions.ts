/**
 * Peru Regions GeoJSON Data
 * 
 * Simplified boundary data for Peru's 25 departments/regions.
 * Used to display region outlines on the Geographic Map.
 * 
 * Data source: Simplified from peru_departamental_simple.geojson
 */

export interface PeruRegionFeature {
    type: "Feature";
    properties: {
        NOMBDEP: string;
        color?: string;
    };
    geometry: {
        type: "Polygon" | "MultiPolygon";
        coordinates: number[][][] | number[][][][];
    };
}

export interface PeruRegionsGeoJSON {
    type: "FeatureCollection";
    features: PeruRegionFeature[];
}

// Region colors matching the Peru theme
export const REGION_COLORS: Record<string, string> = {
    "LIMA": "#D91023",
    "CUSCO": "#E63946",
    "AREQUIPA": "#F77F00",
    "LA LIBERTAD": "#FCBF49",
    "PIURA": "#10B981",
    "LAMBAYEQUE": "#3B82F6",
    "JUNIN": "#8B5CF6",
    "LORETO": "#6366F1",
    "ANCASH": "#EC4899",
    "CAJAMARCA": "#14B8A6",
    "PUNO": "#F59E0B",
    "ICA": "#84CC16",
    "SAN MARTIN": "#22C55E",
    "TACNA": "#06B6D4",
    "UCAYALI": "#A855F7",
    "HUANUCO": "#EF4444",
    "AYACUCHO": "#F97316",
    "AMAZONAS": "#0EA5E9",
    "APURIMAC": "#8B5CF6",
    "HUANCAVELICA": "#64748B",
    "MOQUEGUA": "#78716C",
    "PASCO": "#71717A",
    "TUMBES": "#0D9488",
    "MADRE DE DIOS": "#059669",
    "CALLAO": "#DC2626",
};

// Simplified Peru regions GeoJSON with approximate boundaries
// These are simplified coordinates for demonstration purposes
export const peruRegionsGeoJSON: PeruRegionsGeoJSON = {
    type: "FeatureCollection",
    features: [
        {
            type: "Feature",
            properties: { NOMBDEP: "AMAZONAS" },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-78.42, -3.40], [-78.01, -3.40], [-77.70, -4.00], [-77.60, -5.00],
                    [-77.70, -5.90], [-77.30, -6.40], [-77.76, -6.95], [-78.33, -6.35],
                    [-78.52, -6.07], [-78.71, -5.83], [-78.68, -5.71], [-78.55, -5.50],
                    [-78.52, -5.45], [-78.60, -5.31], [-78.70, -5.10], [-78.65, -5.07],
                    [-78.64, -4.74], [-78.65, -4.66], [-78.71, -4.62], [-78.66, -4.59],
                    [-78.64, -4.50], [-78.65, -4.33], [-78.62, -4.29], [-78.58, -4.14],
                    [-78.54, -4.07], [-78.57, -3.99], [-78.52, -3.94], [-78.49, -3.93],
                    [-78.42, -3.40]
                ]]
            }
        },
        {
            type: "Feature",
            properties: { NOMBDEP: "ANCASH" },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-78.65, -8.00], [-77.50, -8.20], [-77.20, -9.00], [-77.10, -10.20],
                    [-77.50, -10.50], [-78.00, -10.30], [-78.65, -9.50], [-78.65, -8.00]
                ]]
            }
        },
        {
            type: "Feature",
            properties: { NOMBDEP: "APURIMAC" },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-73.80, -13.30], [-72.80, -13.30], [-72.50, -14.00], [-72.80, -14.70],
                    [-73.50, -14.70], [-73.80, -14.20], [-73.80, -13.30]
                ]]
            }
        },
        {
            type: "Feature",
            properties: { NOMBDEP: "AREQUIPA" },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-75.10, -14.60], [-72.50, -14.60], [-71.80, -15.50], [-71.50, -16.10],
                    [-72.00, -17.30], [-74.50, -17.10], [-75.10, -15.50], [-75.10, -14.60]
                ]]
            }
        },
        {
            type: "Feature",
            properties: { NOMBDEP: "AYACUCHO" },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-75.10, -12.50], [-73.50, -12.50], [-73.30, -13.30], [-73.80, -15.00],
                    [-75.10, -15.00], [-75.30, -13.80], [-75.10, -12.50]
                ]]
            }
        },
        {
            type: "Feature",
            properties: { NOMBDEP: "CAJAMARCA" },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-79.50, -5.00], [-78.30, -4.90], [-78.00, -5.50], [-77.80, -6.50],
                    [-78.10, -7.50], [-78.70, -7.70], [-79.40, -7.00], [-79.50, -5.90],
                    [-79.50, -5.00]
                ]]
            }
        },
        {
            type: "Feature",
            properties: { NOMBDEP: "CALLAO" },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-77.15, -11.85], [-77.05, -11.85], [-77.00, -12.05], [-77.08, -12.12],
                    [-77.18, -12.00], [-77.15, -11.85]
                ]]
            }
        },
        {
            type: "Feature",
            properties: { NOMBDEP: "CUSCO" },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-73.30, -11.80], [-71.00, -11.80], [-70.00, -12.50], [-69.50, -14.00],
                    [-70.50, -14.70], [-72.00, -14.70], [-72.80, -13.80], [-73.30, -12.80],
                    [-73.30, -11.80]
                ]]
            }
        },
        {
            type: "Feature",
            properties: { NOMBDEP: "HUANCAVELICA" },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-75.50, -12.00], [-74.50, -12.00], [-74.30, -12.80], [-74.50, -13.50],
                    [-75.30, -13.50], [-75.70, -12.80], [-75.50, -12.00]
                ]]
            }
        },
        {
            type: "Feature",
            properties: { NOMBDEP: "HUANUCO" },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-77.20, -8.50], [-75.50, -8.50], [-75.20, -9.30], [-75.50, -10.30],
                    [-76.50, -10.30], [-77.20, -9.50], [-77.20, -8.50]
                ]]
            }
        },
        {
            type: "Feature",
            properties: { NOMBDEP: "ICA" },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-76.40, -13.40], [-75.00, -13.40], [-74.80, -14.50], [-75.30, -15.60],
                    [-76.20, -15.60], [-76.40, -14.50], [-76.40, -13.40]
                ]]
            }
        },
        {
            type: "Feature",
            properties: { NOMBDEP: "JUNIN" },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-76.20, -10.70], [-74.50, -10.70], [-74.00, -11.50], [-74.50, -12.30],
                    [-75.50, -12.30], [-76.20, -11.50], [-76.20, -10.70]
                ]]
            }
        },
        {
            type: "Feature",
            properties: { NOMBDEP: "LA LIBERTAD" },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-79.50, -7.00], [-77.80, -7.00], [-77.30, -7.80], [-77.50, -8.50],
                    [-78.70, -8.50], [-79.50, -7.80], [-79.50, -7.00]
                ]]
            }
        },
        {
            type: "Feature",
            properties: { NOMBDEP: "LAMBAYEQUE" },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-80.20, -5.70], [-79.30, -5.70], [-79.20, -6.30], [-79.50, -7.00],
                    [-80.00, -6.80], [-80.20, -6.20], [-80.20, -5.70]
                ]]
            }
        },
        {
            type: "Feature",
            properties: { NOMBDEP: "LIMA" },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-77.60, -10.20], [-76.00, -10.30], [-75.50, -11.00], [-75.80, -12.50],
                    [-76.80, -13.40], [-77.80, -12.80], [-77.80, -11.00], [-77.60, -10.20]
                ]]
            }
        },
        {
            type: "Feature",
            properties: { NOMBDEP: "LORETO" },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-77.80, -0.10], [-73.00, -0.10], [-69.95, -4.20], [-70.00, -6.00],
                    [-73.80, -7.50], [-75.50, -7.00], [-76.50, -5.50], [-77.10, -4.00],
                    [-77.80, -2.50], [-77.80, -0.10]
                ]]
            }
        },
        {
            type: "Feature",
            properties: { NOMBDEP: "MADRE DE DIOS" },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-72.50, -10.00], [-69.00, -10.00], [-69.00, -12.50], [-69.50, -13.00],
                    [-70.50, -12.80], [-72.50, -11.80], [-72.50, -10.00]
                ]]
            }
        },
        {
            type: "Feature",
            properties: { NOMBDEP: "MOQUEGUA" },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-71.50, -16.10], [-70.00, -16.10], [-70.00, -17.30], [-71.00, -17.70],
                    [-71.50, -17.30], [-71.50, -16.10]
                ]]
            }
        },
        {
            type: "Feature",
            properties: { NOMBDEP: "PASCO" },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-76.60, -9.90], [-75.00, -9.90], [-74.80, -10.50], [-75.50, -10.90],
                    [-76.50, -10.70], [-76.60, -9.90]
                ]]
            }
        },
        {
            type: "Feature",
            properties: { NOMBDEP: "PIURA" },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-81.30, -4.00], [-79.90, -4.00], [-79.50, -5.00], [-79.80, -6.30],
                    [-80.50, -6.30], [-81.30, -5.00], [-81.30, -4.00]
                ]]
            }
        },
        {
            type: "Feature",
            properties: { NOMBDEP: "PUNO" },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-71.00, -14.00], [-69.00, -14.00], [-68.70, -15.00], [-69.00, -17.30],
                    [-70.50, -17.30], [-71.50, -16.10], [-71.00, -14.00]
                ]]
            }
        },
        {
            type: "Feature",
            properties: { NOMBDEP: "SAN MARTIN" },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-77.80, -5.30], [-76.00, -5.30], [-75.50, -6.50], [-76.00, -8.10],
                    [-77.50, -8.10], [-77.80, -7.00], [-77.80, -5.30]
                ]]
            }
        },
        {
            type: "Feature",
            properties: { NOMBDEP: "TACNA" },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-70.50, -17.30], [-69.50, -17.30], [-69.50, -18.30], [-70.50, -18.30],
                    [-70.50, -17.30]
                ]]
            }
        },
        {
            type: "Feature",
            properties: { NOMBDEP: "TUMBES" },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-80.90, -3.40], [-80.20, -3.40], [-80.00, -3.90], [-80.30, -4.20],
                    [-80.90, -3.90], [-80.90, -3.40]
                ]]
            }
        },
        {
            type: "Feature",
            properties: { NOMBDEP: "UCAYALI" },
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [-75.50, -7.00], [-73.80, -7.50], [-72.50, -8.50], [-72.50, -10.50],
                    [-73.80, -11.20], [-75.20, -10.80], [-75.50, -9.00], [-75.50, -7.00]
                ]]
            }
        }
    ]
};

export default peruRegionsGeoJSON;
