import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Search, Image as ImageIcon, Tag, Box, Loader2, Filter } from "lucide-react";
import { ColorHistogram } from "@/components/ImageAnalysis/ColorHistogram";

export default function ImageAnalysisDashboard() {
    const [searchTag, setSearchTag] = useState("");
    const [searchObject, setSearchObject] = useState("");
    const [searchColor, setSearchColor] = useState("");
    const [minQuality, setMinQuality] = useState(0);

    // Queries
    const { data: stats, isLoading: isLoadingStats } = trpc.analysis.stats.useQuery();
    const { data: images, isLoading: isLoadingImages } = trpc.analysis.search.useQuery({
        tag: searchTag || undefined,
        object: searchObject || undefined,
        color: searchColor || undefined,
        minQuality: minQuality > 0 ? minQuality : undefined,
        limit: 50,
    });

    const handleFilterReset = () => {
        setSearchTag("");
        setSearchObject("");
        setSearchColor("");
        setMinQuality(0);
    };

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">Image Analysis</h1>
                <div className="text-sm text-muted-foreground">
                    Enriched Media Intelligence
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Images</CardTitle>
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {isLoadingStats ? <Loader2 className="h-4 w-4 animate-spin" /> : stats?.totalImages || 0}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Top Detected Object</CardTitle>
                        <Box className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold truncate">
                            {isLoadingStats ? <Loader2 className="h-4 w-4 animate-spin" /> : stats?.topObjects[0]?.object || "N/A"}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {stats?.topObjects[0] ? `${stats.topObjects[0].count} occurrences` : ""}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Trending Tag</CardTitle>
                        <Tag className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold truncate">
                            {isLoadingStats ? <Loader2 className="h-4 w-4 animate-spin" /> : stats?.topTags[0]?.tag || "N/A"}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {stats?.topTags[0] ? `${stats.topTags[0].count} occurrences` : ""}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Color Palette</CardTitle>
                        <div className="h-4 w-4 rounded-full bg-gradient-to-br from-red-500 to-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="h-8 flex space-x-1 mt-1">
                            {isLoadingStats ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                stats?.colorDistribution.slice(0, 5).map((c, i) => (
                                    <div
                                        key={i}
                                        className="h-full flex-1 rounded-sm"
                                        style={{ backgroundColor: c.color }}
                                        title={`${c.color} (${c.count})`}
                                    />
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Filters & Stats Detail */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Filter className="h-5 w-5" />
                                Filters
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Tag Search</label>
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search by tag..."
                                        className="pl-9"
                                        value={searchTag}
                                        onChange={(e) => setSearchTag(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Object Detection</label>
                                <div className="relative">
                                    <Box className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search objects (e.g. car, person)..."
                                        className="pl-9"
                                        value={searchObject}
                                        onChange={(e) => setSearchObject(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Dominant Color</label>
                                <Input
                                    placeholder="Query color (e.g. red, #FF0000)..."
                                    value={searchColor}
                                    onChange={(e) => setSearchColor(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <label className="text-sm font-medium">Min Quality Score</label>
                                    <span className="text-sm text-muted-foreground">{minQuality.toFixed(1)}</span>
                                </div>
                                <Slider
                                    value={[minQuality]}
                                    onValueChange={(vals) => setMinQuality(vals[0])}
                                    max={1}
                                    step={0.1}
                                />
                            </div>

                            <Button variant="outline" className="w-full" onClick={handleFilterReset}>
                                Reset Filters
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Color Analysis Chart */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Color Distribution</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {stats?.colorDistribution && (
                                <ColorHistogram data={stats.colorDistribution} />
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Image Grid */}
                <div className="lg:col-span-2 space-y-4">
                    {isLoadingImages ? (
                        <div className="flexjustify-center items-center h-64">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : images && images.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {images.map((image) => (
                                <Card key={image.id} className="overflow-hidden group">
                                    <div className="aspect-video relative bg-slate-100 dark:bg-slate-800">
                                        <img
                                            src={image.imageUrl}
                                            alt={image.caption || "Analyzed Image"}
                                            className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105"
                                        />
                                        {image.moderationStatus && image.moderationStatus !== "safe" && (
                                            <Badge variant="destructive" className="absolute top-2 right-2">
                                                {image.moderationStatus}
                                            </Badge>
                                        )}
                                    </div>
                                    <CardContent className="p-4">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <p className="text-sm font-medium line-clamp-1">{image.caption || "No caption"}</p>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {new Date(image.timestamp).toLocaleString()}
                                                </p>
                                            </div>
                                            {image.qualityScore && (
                                                <Badge variant={image.qualityScore > 0.8 ? "default" : "secondary"}>
                                                    Q: {image.qualityScore.toFixed(2)}
                                                </Badge>
                                            )}
                                        </div>

                                        {image.objects && image.objects.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-3">
                                                {image.objects.slice(0, 3).map((obj, i) => (
                                                    <Badge key={i} variant="outline" className="text-xs">
                                                        {obj}
                                                    </Badge>
                                                ))}
                                                {image.objects.length > 3 && (
                                                    <span className="text-xs text-muted-foreground self-center">
                                                        +{image.objects.length - 3}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 border-2 border-dashed rounded-lg">
                            <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                            <h3 className="text-lg font-medium">No images found</h3>
                            <p className="text-muted-foreground">Try adjusting your filters</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
