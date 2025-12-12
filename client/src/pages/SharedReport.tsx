import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Copy, Download } from "lucide-react";
import { Streamdown } from "streamdown";
import { toast } from "sonner";

function usePath(): string {
  const [location] = useLocation();
  return location;
}

export default function SharedReport() {
  const [, setLocation] = useLocation();
  const path = usePath();

  const shareToken = useMemo(() => {
    const parts = path.split("/share/report/");
    return parts[1] || "";
  }, [path]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<any | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!shareToken) {
        setError("Missing share token");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const resp = await fetch(`/api/data/topology-reports?shareToken=${encodeURIComponent(shareToken)}`, {
          credentials: "include",
        });
        const data = await resp.json();
        if (!resp.ok || !data.success) {
          throw new Error(data.error || "Failed to load report");
        }
        if (cancelled) return;
        setReport(data.report);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [shareToken]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-50">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => setLocation("/dashboard/executive")}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-xl font-bold">Shared Report</h1>
              <p className="text-xs text-muted-foreground">Read-only share link</p>
            </div>
          </div>

          {report?.id && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open(`/api/data/topology-reports?id=${report.id}&format=json`, "_blank")}
              >
                <Download className="w-4 h-4 mr-2" />
                JSON
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open(`/api/data/topology-reports?id=${report.id}&format=csv`, "_blank")}
              >
                <Download className="w-4 h-4 mr-2" />
                CSV
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(report.content || "");
                    toast.success("Report copied");
                  } catch {
                    toast.error("Failed to copy");
                  }
                }}
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy
              </Button>
            </div>
          )}
        </div>
      </header>

      <main className="container py-8">
        {loading ? (
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-52" />
              <Skeleton className="h-4 w-96" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[60vh] w-full" />
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardHeader>
              <CardTitle>Unable to load report</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => window.location.reload()}>Retry</Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>{report?.title || report?.id || "Report"}</CardTitle>
              <CardDescription>
                {report?.createdAt ? `Created ${new Date(report.createdAt).toLocaleString()}` : ""}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[70vh] pr-4">
                {report?.content ? <Streamdown>{report.content}</Streamdown> : <div className="text-sm text-muted-foreground">No content</div>}
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
