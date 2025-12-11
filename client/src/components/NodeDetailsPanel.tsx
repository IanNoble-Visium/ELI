import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, ExternalLink, Car, Users, Shield, FileText, Clock, MapPin, Camera, Sparkles, Eye, Tag, Palette, AlertTriangle, CheckCircle, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface NodeDetailsPanelProps {
  node: GraphNode | null;
  isOpen: boolean;
  onClose: () => void;
}

interface GraphNode {
  id: string;
  name: string;
  type: "camera" | "location" | "vehicle" | "person" | "event";
  color: string;
  val: number;
  latitude?: number;
  longitude?: number;
  region?: string;
  eventCount?: number;
  imageUrl?: string;
  tags?: string[];
  objects?: string[];
  dominantColors?: string[];
  qualityScore?: number;
  moderationStatus?: string;
  caption?: string;
  channelId?: string;
  timestamp?: number;
  eventId?: string;
  // Gemini AI analysis properties
  geminiCaption?: string;
  geminiTags?: string[];
  geminiObjects?: string[];
  geminiPeopleCount?: number;
  geminiVehicles?: string[];
  geminiWeapons?: string[];
  geminiClothingColors?: string[];
  geminiLicensePlates?: string[];
  geminiTextExtracted?: string[];
  geminiQualityScore?: number;
  geminiBlurScore?: number;
  geminiTimeOfDay?: string;
  geminiLightingCondition?: string;
  geminiEnvironment?: string;
  geminiWeatherCondition?: string;
  geminiCameraPerspective?: string;
  geminiDominantColors?: string[];
  geminiProcessedAt?: number;
  // Allow any additional properties
  [key: string]: any;
}

const panelVariants = {
  hidden: { x: "100%", opacity: 0 },
  visible: { 
    x: 0, 
    opacity: 1,
    transition: { 
      type: "spring", 
      damping: 25, 
      stiffness: 300 
    }
  },
  exit: { 
    x: "100%", 
    opacity: 0,
    transition: { 
      duration: 0.2 
    }
  }
};

const sectionVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.3 }
  })
};

function formatTimestamp(ts: number | undefined): string {
  if (!ts) return "N/A";
  const date = new Date(ts);
  return date.toLocaleString();
}

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text).then(() => {
    toast.success(`${label} copied to clipboard`);
  }).catch(() => {
    toast.error("Failed to copy");
  });
}

function PropertySection({ 
  title, 
  icon: Icon, 
  children, 
  index,
  accentColor = "cyan"
}: { 
  title: string; 
  icon: React.ElementType; 
  children: React.ReactNode;
  index: number;
  accentColor?: string;
}) {
  return (
    <motion.div
      custom={index}
      variants={sectionVariants}
      initial="hidden"
      animate="visible"
      className="space-y-2"
    >
      <div className={`flex items-center gap-2 text-${accentColor}-400`}>
        <Icon className="w-4 h-4" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="pl-6 space-y-2">
        {children}
      </div>
    </motion.div>
  );
}

function PropertyRow({ label, value, copyable = false }: { label: string; value: React.ReactNode; copyable?: boolean }) {
  if (value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) {
    return null;
  }

  return (
    <div className="flex items-start justify-between gap-2 text-xs">
      <span className="text-muted-foreground shrink-0">{label}:</span>
      <div className="flex items-center gap-1 text-right">
        <span className="text-foreground break-all">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
        {copyable && typeof value === 'string' && (
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0 hover:bg-muted"
            onClick={() => copyToClipboard(value, label)}
          >
            <Copy className="w-3 h-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

function BadgeList({ items, colorClass = "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" }: { items: string[]; colorClass?: string }) {
  if (!items || items.length === 0) return null;
  
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item, i) => (
        <Badge 
          key={i} 
          variant="outline" 
          className={`text-[10px] ${colorClass}`}
        >
          {item}
        </Badge>
      ))}
    </div>
  );
}

function ColorSwatches({ colors }: { colors: string[] }) {
  if (!colors || colors.length === 0) return null;
  
  return (
    <div className="flex flex-wrap gap-1">
      {colors.map((color, i) => (
        <div
          key={i}
          className="w-6 h-6 rounded border border-white/20 cursor-pointer hover:scale-110 transition-transform"
          style={{ backgroundColor: color.startsWith('#') ? color : `#${color}` }}
          title={color}
          onClick={() => copyToClipboard(color, "Color")}
        />
      ))}
    </div>
  );
}

export default function NodeDetailsPanel({ node, isOpen, onClose }: NodeDetailsPanelProps) {
  if (!node) return null;

  const hasGeminiData = node.geminiProcessedAt || node.geminiCaption;
  const hasCloudinaryData = node.tags?.length || node.objects?.length || node.dominantColors?.length;

  return (
    <AnimatePresence>
      {isOpen && node && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 z-40"
            onClick={onClose}
          />
          
          {/* Panel */}
          <motion.div
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed right-0 top-0 h-full w-[420px] max-w-[90vw] bg-card border-l border-border shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border bg-card/95 backdrop-blur">
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: node.color + "30", borderColor: node.color, borderWidth: 2 }}
                >
                  {node.type === "camera" && <Camera className="w-5 h-5" style={{ color: node.color }} />}
                  {node.type === "event" && <Eye className="w-5 h-5" style={{ color: node.color }} />}
                  {node.type === "vehicle" && <Car className="w-5 h-5" style={{ color: node.color }} />}
                  {node.type === "person" && <Users className="w-5 h-5" style={{ color: node.color }} />}
                  {node.type === "location" && <MapPin className="w-5 h-5" style={{ color: node.color }} />}
                </div>
                <div>
                  <h2 className="text-lg font-bold truncate max-w-[280px]">{node.name}</h2>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {node.type}
                    </Badge>
                    {hasGeminiData && (
                      <Badge className="text-[10px] bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                        <Sparkles className="w-3 h-3 mr-1" />
                        AI Analyzed
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Content */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-6">
                {/* Image Preview */}
                {node.imageUrl && (
                  <motion.div
                    custom={0}
                    variants={sectionVariants}
                    initial="hidden"
                    animate="visible"
                    className="relative rounded-lg overflow-hidden border border-border"
                  >
                    <img 
                      src={node.imageUrl} 
                      alt={node.name}
                      className="w-full h-48 object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <a
                      href={node.imageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute bottom-2 right-2 bg-black/70 hover:bg-black/90 text-white text-xs px-2 py-1 rounded flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Open Full
                    </a>
                  </motion.div>
                )}

                {/* Gemini AI Caption - Prominent Display */}
                {node.geminiCaption && (
                  <motion.div
                    custom={1}
                    variants={sectionVariants}
                    initial="hidden"
                    animate="visible"
                    className="p-4 rounded-lg bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/20"
                  >
                    <div className="flex items-center gap-2 mb-2 text-yellow-400">
                      <Sparkles className="w-4 h-4" />
                      <h3 className="text-sm font-semibold">AI Scene Description</h3>
                    </div>
                    <p className="text-sm text-foreground leading-relaxed">
                      {node.geminiCaption}
                    </p>
                  </motion.div>
                )}

                {/* Basic Event Details */}
                <PropertySection title="Event Details" icon={FileText} index={2}>
                  <PropertyRow label="ID" value={node.id} copyable />
                  {node.eventId && <PropertyRow label="Event ID" value={node.eventId} copyable />}
                  {node.channelId && <PropertyRow label="Channel" value={node.channelId} copyable />}
                  {node.timestamp && <PropertyRow label="Timestamp" value={formatTimestamp(node.timestamp)} />}
                  {node.region && <PropertyRow label="Region" value={node.region} />}
                  {node.latitude && node.longitude && (
                    <PropertyRow label="Location" value={`${node.latitude.toFixed(6)}, ${node.longitude.toFixed(6)}`} copyable />
                  )}
                </PropertySection>

                <Separator className="bg-border/50" />

                {/* Gemini AI Analysis */}
                {hasGeminiData && (
                  <>
                    {/* Vehicles */}
                    {node.geminiVehicles && node.geminiVehicles.length > 0 && (
                      <PropertySection title="Vehicles Detected" icon={Car} index={3} accentColor="blue">
                        <BadgeList 
                          items={node.geminiVehicles} 
                          colorClass="bg-blue-500/20 text-blue-400 border-blue-500/30"
                        />
                      </PropertySection>
                    )}

                    {/* License Plates */}
                    {node.geminiLicensePlates && node.geminiLicensePlates.length > 0 && (
                      <PropertySection title="License Plates" icon={Tag} index={4} accentColor="green">
                        <div className="flex flex-wrap gap-2">
                          {node.geminiLicensePlates.map((plate, i) => (
                            <div
                              key={i}
                              className={`px-3 py-1.5 rounded font-mono text-sm cursor-pointer hover:scale-105 transition-transform ${
                                plate.toLowerCase() === 'obscured' 
                                  ? 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                                  : 'bg-green-500/20 text-green-400 border border-green-500/30'
                              }`}
                              onClick={() => plate.toLowerCase() !== 'obscured' && copyToClipboard(plate, "License Plate")}
                            >
                              {plate}
                            </div>
                          ))}
                        </div>
                      </PropertySection>
                    )}

                    {/* People & Clothing */}
                    {(node.geminiPeopleCount !== undefined && node.geminiPeopleCount > 0) || (node.geminiClothingColors && node.geminiClothingColors.length > 0) ? (
                      <PropertySection title="People & Clothing" icon={Users} index={5} accentColor="purple">
                        {node.geminiPeopleCount !== undefined && node.geminiPeopleCount > 0 && (
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-2xl font-bold text-purple-400">{node.geminiPeopleCount}</span>
                            <span className="text-sm text-muted-foreground">
                              {node.geminiPeopleCount === 1 ? 'person' : 'people'} detected
                            </span>
                          </div>
                        )}
                        {node.geminiClothingColors && node.geminiClothingColors.length > 0 && (
                          <div>
                            <span className="text-xs text-muted-foreground mb-1 block">Clothing Colors:</span>
                            <BadgeList 
                              items={node.geminiClothingColors}
                              colorClass="bg-purple-500/20 text-purple-400 border-purple-500/30"
                            />
                          </div>
                        )}
                      </PropertySection>
                    ) : null}

                    {/* Weapons Alert */}
                    {node.geminiWeapons && node.geminiWeapons.length > 0 && (
                      <PropertySection title="⚠️ Weapons Detected" icon={AlertTriangle} index={6} accentColor="red">
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                          <BadgeList 
                            items={node.geminiWeapons}
                            colorClass="bg-red-500/30 text-red-400 border-red-500/50"
                          />
                        </div>
                      </PropertySection>
                    )}

                    {/* Extracted Text */}
                    {node.geminiTextExtracted && node.geminiTextExtracted.length > 0 && (
                      <PropertySection title="Extracted Text" icon={FileText} index={7} accentColor="orange">
                        <BadgeList 
                          items={node.geminiTextExtracted}
                          colorClass="bg-orange-500/20 text-orange-400 border-orange-500/30"
                        />
                      </PropertySection>
                    )}

                    {/* Scene Environment */}
                    {(node.geminiTimeOfDay || node.geminiEnvironment || node.geminiWeatherCondition || node.geminiLightingCondition) && (
                      <PropertySection title="Scene Environment" icon={Eye} index={8}>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {node.geminiTimeOfDay && (
                            <div className="p-2 rounded bg-muted/50">
                              <span className="text-muted-foreground block">Time of Day</span>
                              <span className="capitalize">{node.geminiTimeOfDay.replace(/_/g, ' ')}</span>
                            </div>
                          )}
                          {node.geminiEnvironment && (
                            <div className="p-2 rounded bg-muted/50">
                              <span className="text-muted-foreground block">Environment</span>
                              <span className="capitalize">{node.geminiEnvironment.replace(/_/g, ' ')}</span>
                            </div>
                          )}
                          {node.geminiWeatherCondition && (
                            <div className="p-2 rounded bg-muted/50">
                              <span className="text-muted-foreground block">Weather</span>
                              <span className="capitalize">{node.geminiWeatherCondition.replace(/_/g, ' ')}</span>
                            </div>
                          )}
                          {node.geminiLightingCondition && (
                            <div className="p-2 rounded bg-muted/50">
                              <span className="text-muted-foreground block">Lighting</span>
                              <span className="capitalize">{node.geminiLightingCondition.replace(/_/g, ' ')}</span>
                            </div>
                          )}
                          {node.geminiCameraPerspective && (
                            <div className="p-2 rounded bg-muted/50">
                              <span className="text-muted-foreground block">Camera</span>
                              <span className="capitalize">{node.geminiCameraPerspective.replace(/_/g, ' ')}</span>
                            </div>
                          )}
                        </div>
                      </PropertySection>
                    )}

                    {/* Dominant Colors */}
                    {node.geminiDominantColors && node.geminiDominantColors.length > 0 && (
                      <PropertySection title="Dominant Colors" icon={Palette} index={9}>
                        <ColorSwatches colors={node.geminiDominantColors} />
                      </PropertySection>
                    )}

                    {/* Quality Metrics */}
                    {(node.geminiQualityScore !== undefined || node.geminiBlurScore !== undefined) && (
                      <PropertySection title="Image Quality" icon={CheckCircle} index={10}>
                        <div className="flex gap-4">
                          {node.geminiQualityScore !== undefined && (
                            <div className="flex-1 p-3 rounded-lg bg-muted/50 text-center">
                              <div className={`text-2xl font-bold ${
                                node.geminiQualityScore >= 70 ? 'text-green-400' :
                                node.geminiQualityScore >= 40 ? 'text-yellow-400' :
                                'text-red-400'
                              }`}>
                                {node.geminiQualityScore}
                              </div>
                              <div className="text-xs text-muted-foreground">Quality Score</div>
                            </div>
                          )}
                          {node.geminiBlurScore !== undefined && (
                            <div className="flex-1 p-3 rounded-lg bg-muted/50 text-center">
                              <div className={`text-2xl font-bold ${
                                node.geminiBlurScore <= 30 ? 'text-green-400' :
                                node.geminiBlurScore <= 60 ? 'text-yellow-400' :
                                'text-red-400'
                              }`}>
                                {node.geminiBlurScore}
                              </div>
                              <div className="text-xs text-muted-foreground">Blur Score</div>
                            </div>
                          )}
                        </div>
                      </PropertySection>
                    )}

                    {/* AI Tags & Objects */}
                    {node.geminiTags && node.geminiTags.length > 0 && (
                      <PropertySection title="AI Tags" icon={Tag} index={11}>
                        <BadgeList items={node.geminiTags} />
                      </PropertySection>
                    )}

                    {node.geminiObjects && node.geminiObjects.length > 0 && (
                      <PropertySection title="Detected Objects" icon={Eye} index={12}>
                        <BadgeList 
                          items={node.geminiObjects}
                          colorClass="bg-indigo-500/20 text-indigo-400 border-indigo-500/30"
                        />
                      </PropertySection>
                    )}

                    {/* Gemini Processing Info */}
                    {node.geminiProcessedAt && (
                      <div className="text-xs text-muted-foreground text-center pt-2 border-t border-border/50">
                        <Sparkles className="w-3 h-3 inline mr-1" />
                        AI analyzed on {formatTimestamp(node.geminiProcessedAt)}
                      </div>
                    )}

                    <Separator className="bg-border/50" />
                  </>
                )}

                {/* Cloudinary Analysis (if available) */}
                {hasCloudinaryData && (
                  <>
                    <PropertySection title="Cloudinary Analysis" icon={ImageIcon} index={13}>
                      {node.tags && node.tags.length > 0 && (
                        <div className="mb-2">
                          <span className="text-xs text-muted-foreground mb-1 block">Tags:</span>
                          <BadgeList items={node.tags} />
                        </div>
                      )}
                      {node.objects && node.objects.length > 0 && (
                        <div className="mb-2">
                          <span className="text-xs text-muted-foreground mb-1 block">Objects:</span>
                          <BadgeList 
                            items={node.objects}
                            colorClass="bg-teal-500/20 text-teal-400 border-teal-500/30"
                          />
                        </div>
                      )}
                      {node.dominantColors && node.dominantColors.length > 0 && (
                        <div>
                          <span className="text-xs text-muted-foreground mb-1 block">Colors:</span>
                          <ColorSwatches colors={node.dominantColors} />
                        </div>
                      )}
                      {node.qualityScore !== undefined && (
                        <PropertyRow label="Quality Score" value={node.qualityScore} />
                      )}
                      {node.moderationStatus && (
                        <PropertyRow label="Moderation" value={node.moderationStatus} />
                      )}
                    </PropertySection>
                    <Separator className="bg-border/50" />
                  </>
                )}

                {/* All Other Properties */}
                <PropertySection title="All Properties" icon={FileText} index={14}>
                  <div className="space-y-1 text-xs">
                    {Object.entries(node)
                      .filter(([key]) => !['x', 'y', 'fx', 'fy', 'vx', 'vy', 'index', '__indexColor', 'color', 'val'].includes(key))
                      .filter(([, value]) => value !== null && value !== undefined && value !== '')
                      .map(([key, value]) => (
                        <div key={key} className="flex items-start gap-2 py-1 border-b border-border/30 last:border-0">
                          <span className="text-muted-foreground font-mono text-[10px] shrink-0 w-32 truncate" title={key}>
                            {key}:
                          </span>
                          <span className="text-foreground break-all text-[11px]">
                            {Array.isArray(value) 
                              ? value.length > 0 
                                ? `[${value.slice(0, 3).join(', ')}${value.length > 3 ? `, +${value.length - 3} more` : ''}]`
                                : '[]'
                              : typeof value === 'object'
                                ? JSON.stringify(value).slice(0, 50) + (JSON.stringify(value).length > 50 ? '...' : '')
                                : String(value).slice(0, 100) + (String(value).length > 100 ? '...' : '')
                            }
                          </span>
                        </div>
                      ))
                    }
                  </div>
                </PropertySection>
              </div>
            </ScrollArea>

            {/* Footer */}
            <div className="p-4 border-t border-border bg-card/95 backdrop-blur">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => copyToClipboard(JSON.stringify(node, null, 2), "Node data")}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy JSON
                </Button>
                {node.imageUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => window.open(node.imageUrl, '_blank')}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open Image
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
