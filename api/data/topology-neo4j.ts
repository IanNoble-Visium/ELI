/**
 * Neo4j Topology API - Stub File
 * 
 * This is a stub file that provides empty implementations for functions
 * that were previously in topology-neo4j.ts. The Neo4j integration has been
 * simplified, but these exports are still needed for routers.ts compatibility.
 */

// Stub for searchImages - returns empty array
export async function searchImages(criteria: {
    tag?: string;
    object?: string;
    color?: string;
    minQuality?: number;
    limit?: number;
}): Promise<any[]> {
    console.log("[Neo4j Stub] searchImages called - returning empty array");
    return [];
}

// Stub for getImageAnalysisStats - returns null
export async function getImageAnalysisStats(): Promise<{
    totalImages: number;
    topTags: Array<{ tag: string; count: number }>;
    topObjects: Array<{ object: string; count: number }>;
    colorDistribution: Array<{ color: string; count: number }>;
} | null> {
    console.log("[Neo4j Stub] getImageAnalysisStats called - returning null");
    return null;
}
