import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, AlertTriangle, CheckCircle, Clock, Play, Filter, Plus, X, MessageSquare, Tag, MapPin, User, Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { format } from "date-fns";
import { motion } from "framer-motion";

// Mock incident data
const generateMockIncidents = () => {
  const priorities = ["critical", "high", "medium", "low"];
  const statuses = ["open", "investigating", "resolved", "closed"];
  const types = ["Intrusion", "Loitering", "Vehicle Theft", "Assault", "Vandalism", "Suspicious Activity"];
  const regions = ["Lima", "Cusco", "Arequipa", "Trujillo", "Piura"];
  
  return Array.from({ length: 25 }, (_, i) => ({
    id: `INC-${String(i + 1).padStart(4, "0")}`,
    type: types[Math.floor(Math.random() * types.length)],
    priority: priorities[Math.floor(Math.random() * priorities.length)],
    status: statuses[Math.floor(Math.random() * statuses.length)],
    location: `${regions[Math.floor(Math.random() * regions.length)]}, Peru`,
    region: regions[Math.floor(Math.random() * regions.length)],
    description: "Suspicious activity detected by surveillance system",
    assignedOfficer: `Officer ${Math.floor(Math.random() * 50) + 1}`,
    assignedUnit: `Unit ${Math.floor(Math.random() * 20) + 1}`,
    responseTime: Math.floor(Math.random() * 30) + 5,
    createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
    videoUrl: `https://example.com/video-${i + 1}.mp4`,
    hasVideo: Math.random() > 0.3,
  }));
};

export default function IncidentManagement() {
  const [, setLocation] = useLocation();
  const [incidents] = useState(generateMockIncidents());
  const [selectedIncident, setSelectedIncident] = useState<any>(null);
  const [noteText, setNoteText] = useState("");
  const [tagText, setTagText] = useState("");
  const [tagColor, setTagColor] = useState("#D91023");
  const [isLoading, setIsLoading] = useState(true);

  // Simulate loading for incident data
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  // Fetch notes and tags for selected incident
  const { data: notes, refetch: refetchNotes } = trpc.incidents.getNotes.useQuery(
    { incidentId: selectedIncident?.id || "" },
    { enabled: !!selectedIncident }
  );
  const { data: tags, refetch: refetchTags } = trpc.incidents.getTags.useQuery(
    { incidentId: selectedIncident?.id || "" },
    { enabled: !!selectedIncident }
  );

  // Mutations
  const addNoteMutation = trpc.incidents.addNote.useMutation({
    onSuccess: () => {
      toast.success("Note added successfully");
      setNoteText("");
      refetchNotes();
    },
    onError: (error) => {
      toast.error(`Failed to add note: ${error.message}`);
    },
  });

  const addTagMutation = trpc.incidents.addTag.useMutation({
    onSuccess: () => {
      toast.success("Tag added successfully");
      setTagText("");
      refetchTags();
    },
    onError: (error) => {
      toast.error(`Failed to add tag: ${error.message}`);
    },
  });

  const deleteNoteMutation = trpc.incidents.deleteNote.useMutation({
    onSuccess: () => {
      toast.success("Note deleted");
      refetchNotes();
    },
  });

  const deleteTagMutation = trpc.incidents.deleteTag.useMutation({
    onSuccess: () => {
      toast.success("Tag deleted");
      refetchTags();
    },
  });

  const handleAddNote = () => {
    if (!noteText.trim() || !selectedIncident) return;
    addNoteMutation.mutate({
      incidentId: selectedIncident.id,
      note: noteText,
    });
  };

  const handleAddTag = () => {
    if (!tagText.trim() || !selectedIncident) return;
    addTagMutation.mutate({
      incidentId: selectedIncident.id,
      tag: tagText,
      color: tagColor,
    });
  };
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredIncidents = incidents.filter((incident) => {
    const matchesStatus = filterStatus === "all" || incident.status === filterStatus;
    const matchesPriority = filterPriority === "all" || incident.priority === filterPriority;
    const matchesSearch = 
      incident.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      incident.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      incident.location.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesPriority && matchesSearch;
  });

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      critical: "bg-red-500",
      high: "bg-orange-500",
      medium: "bg-yellow-500",
      low: "bg-blue-500",
    };
    return colors[priority] || "bg-gray-500";
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      open: "bg-red-500",
      investigating: "bg-yellow-500",
      resolved: "bg-green-500",
      closed: "bg-gray-500",
    };
    return colors[status] || "bg-gray-500";
  };

  const stats = {
    total: incidents.length,
    open: incidents.filter(i => i.status === "open").length,
    investigating: incidents.filter(i => i.status === "investigating").length,
    resolved: incidents.filter(i => i.status === "resolved").length,
    critical: incidents.filter(i => i.priority === "critical").length,
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-50">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/dashboard")}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-xl font-bold">Incident Management</h1>
              <p className="text-xs text-muted-foreground">Real-time alerts and response coordination</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Sidebar - Incident List */}
        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="w-96 border-r border-border bg-card/50 backdrop-blur overflow-y-auto"
        >
          {/* Stats */}
          <div className="p-4 border-b border-border">
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <CardContent className="p-3">
                  <div className="text-2xl font-bold">{stats.total}</div>
                  <div className="text-xs text-muted-foreground">Total</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <div className="text-2xl font-bold text-red-500">{stats.critical}</div>
                  <div className="text-xs text-muted-foreground">Critical</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <div className="text-2xl font-bold text-yellow-500">{stats.investigating}</div>
                  <div className="text-xs text-muted-foreground">Investigating</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <div className="text-2xl font-bold text-green-500">{stats.resolved}</div>
                  <div className="text-xs text-muted-foreground">Resolved</div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Filters */}
          <div className="p-4 space-y-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search incidents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="investigating">Investigating</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger>
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Incident List */}
          <div className="p-2 space-y-2">
            {isLoading ? (
              // Loading skeleton for incidents
              Array.from({ length: 8 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Skeleton className="w-4 h-4 rounded" />
                        <Skeleton className="h-4 w-20" />
                      </div>
                      <div className="flex gap-1">
                        <Skeleton className="h-5 w-14 rounded-full" />
                        <Skeleton className="h-5 w-16 rounded-full" />
                      </div>
                    </div>
                    <Skeleton className="h-4 w-28 mb-2" />
                    <Skeleton className="h-3 w-32 mb-1" />
                    <Skeleton className="h-3 w-24" />
                  </CardContent>
                </Card>
              ))
            ) : (
              filteredIncidents.map((incident, index) => (
                <motion.div
                  key={incident.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03, duration: 0.3 }}
                >
                  <Card
                    className={`cursor-pointer hover:border-primary/50 transition-all ${
                      selectedIncident?.id === incident.id ? "border-primary" : ""
                    }`}
                    onClick={() => setSelectedIncident(incident)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className={`w-4 h-4 ${getPriorityColor(incident.priority).replace("bg-", "text-")}`} />
                          <span className="font-mono text-sm font-semibold">{incident.id}</span>
                        </div>
                        <div className="flex gap-1">
                          <Badge className={`${getPriorityColor(incident.priority)} text-white text-xs`}>
                            {incident.priority}
                          </Badge>
                          <Badge className={`${getStatusColor(incident.status)} text-white text-xs`}>
                            {incident.status}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-sm font-medium mb-1">{incident.type}</div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3" />
                        {incident.location}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <Clock className="w-3 h-3" />
                        {format(incident.createdAt, "MMM dd, HH:mm")}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>

        {/* Detail Panel */}
        <div className="flex-1 p-6 overflow-y-auto">
          {selectedIncident ? (
            <motion.div
              key={selectedIncident.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4 }}
              className="space-y-6"
            >
              {/* Header */}
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-3xl font-bold">{selectedIncident.id}</h2>
                  <Badge className={`${getPriorityColor(selectedIncident.priority)} text-white`}>
                    {selectedIncident.priority}
                  </Badge>
                  <Badge className={`${getStatusColor(selectedIncident.status)} text-white`}>
                    {selectedIncident.status}
                  </Badge>
                </div>
                <p className="text-xl text-muted-foreground">{selectedIncident.type}</p>
              </div>

              {/* Video Player */}
              {selectedIncident.hasVideo && (
                <Card>
                  <CardHeader>
                    <CardTitle>Video Evidence</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="aspect-video bg-black rounded-lg flex items-center justify-center">
                      <div className="text-center text-muted-foreground">
                        <Play className="w-12 h-12 mx-auto mb-2" />
                        <p>Video Player Placeholder</p>
                        <p className="text-xs">{selectedIncident.videoUrl}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Details */}
              <div className="grid md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Incident Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <div className="text-sm text-muted-foreground">Location</div>
                      <div className="flex items-center gap-2 mt-1">
                        <MapPin className="w-4 h-4" />
                        <span>{selectedIncident.location}</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Created</div>
                      <div className="flex items-center gap-2 mt-1">
                        <Clock className="w-4 h-4" />
                        <span>{format(selectedIncident.createdAt, "PPpp")}</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Response Time</div>
                      <div className="mt-1">{selectedIncident.responseTime} minutes</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Description</div>
                      <div className="mt-1">{selectedIncident.description}</div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Assignment</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <div className="text-sm text-muted-foreground">Assigned Officer</div>
                      <div className="flex items-center gap-2 mt-1">
                        <User className="w-4 h-4" />
                        <span>{selectedIncident.assignedOfficer}</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Assigned Unit</div>
                      <div className="mt-1">{selectedIncident.assignedUnit}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Region</div>
                      <div className="mt-1">{selectedIncident.region}</div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Notes Section */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-5 h-5" />
                      <CardTitle>Notes</CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Add Note Form */}
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Add a note about this incident..."
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      className="min-h-[80px]"
                    />
                    <Button
                      onClick={handleAddNote}
                      disabled={!noteText.trim() || addNoteMutation.isPending}
                      className="bg-primary hover:bg-primary/90"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add
                    </Button>
                  </div>

                  {/* Notes List */}
                  <div className="space-y-2">
                    {notes && notes.length > 0 ? (
                      notes.map((note: any) => (
                        <Card key={note.id} className="bg-muted/50">
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="text-sm">{note.note}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {format(new Date(note.createdAt), "MMM dd, yyyy HH:mm")}
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteNoteMutation.mutate({ noteId: note.id })}
                                className="h-6 w-6 p-0"
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No notes yet. Add one above.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Tags Section */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Tag className="w-5 h-5" />
                      <CardTitle>Tags</CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Add Tag Form */}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Tag name..."
                      value={tagText}
                      onChange={(e) => setTagText(e.target.value)}
                    />
                    <Input
                      type="color"
                      value={tagColor}
                      onChange={(e) => setTagColor(e.target.value)}
                      className="w-20"
                    />
                    <Button
                      onClick={handleAddTag}
                      disabled={!tagText.trim() || addTagMutation.isPending}
                      className="bg-primary hover:bg-primary/90"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add
                    </Button>
                  </div>

                  {/* Tags List */}
                  <div className="flex flex-wrap gap-2">
                    {tags && tags.length > 0 ? (
                      tags.map((tag: any) => (
                        <Badge
                          key={tag.id}
                          style={{ backgroundColor: tag.color || "#D91023" }}
                          className="text-white px-3 py-1 flex items-center gap-1"
                        >
                          {tag.tag}
                          <button
                            onClick={() => deleteTagMutation.mutate({ tagId: tag.id })}
                            className="ml-1 hover:opacity-70"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4 w-full">
                        No tags yet. Add one above.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Actions */}
              <Card>
                <CardHeader>
                  <CardTitle>Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Button variant="outline">Update Status</Button>
                    <Button variant="outline">Reassign</Button>
                    <Button variant="outline">Export Report</Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <AlertTriangle className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Select an incident to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
