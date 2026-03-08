import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Check, X, Film, Clock, FileEdit, Trash2, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Database } from "@/integrations/supabase/types";

type FileRow = Database["public"]["Tables"]["files"]["Row"];
type ChangeRequestRow = Database["public"]["Tables"]["change_requests"]["Row"];

interface ChangeRequestWithFile extends ChangeRequestRow {
  files: { file_name: string } | null;
}

export default function ModerationPage() {
  const [pendingFiles, setPendingFiles] = useState<FileRow[]>([]);
  const [changeRequests, setChangeRequests] = useState<ChangeRequestWithFile[]>([]);

  const fetchData = async () => {
    const [filesRes, requestsRes] = await Promise.all([
      supabase.from("files").select("*").eq("status", "pending"),
      supabase.from("change_requests").select("*, files(file_name)").eq("status", "pending"),
    ]);
    setPendingFiles(filesRes.data ?? []);
    setChangeRequests((requestsRes.data as ChangeRequestWithFile[]) ?? []);
  };

  useEffect(() => { fetchData(); }, []);

  const [syncingFiles, setSyncingFiles] = useState<Set<string>>(new Set());

  const handleFileAction = async (fileId: string, action: "approved" | "rejected") => {
    if (action === "approved") {
      setSyncingFiles((prev) => new Set(prev).add(fileId));
      try {
        const { data, error } = await supabase.functions.invoke("sync-to-drive", {
          body: { file_id: fileId },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        toast.success("File approved & synced to Google Drive");
      } catch (err: any) {
        toast.error(`Sync failed: ${err.message}`);
      } finally {
        setSyncingFiles((prev) => {
          const next = new Set(prev);
          next.delete(fileId);
          return next;
        });
        fetchData();
      }
    } else {
      const { error } = await supabase.from("files").update({ status: action }).eq("id", fileId);
      if (error) toast.error(error.message);
      else {
        toast.success(`File rejected`);
        fetchData();
      }
    }
  };

  const handleRequestAction = async (requestId: string, action: "approved" | "rejected", request: ChangeRequestWithFile) => {
    const { error } = await supabase.from("change_requests").update({ status: action }).eq("id", requestId);
    if (error) { toast.error(error.message); return; }

    if (action === "approved") {
      if (request.request_type === "delete") {
        await supabase.from("files").update({ status: "rejected" }).eq("id", request.file_id);
      } else if (request.request_type === "edit" && request.new_file_name) {
        await supabase.from("files").update({ file_name: request.new_file_name }).eq("id", request.file_id);
      }
    }
    toast.success(`Request ${action}`);
    fetchData();
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Moderation Panel</h1>
        <p className="text-sm text-muted-foreground">Review and approve pending actions</p>
      </div>

      <Tabs defaultValue="uploads">
        <TabsList className="bg-secondary">
          <TabsTrigger value="uploads" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            Uploads ({pendingFiles.length})
          </TabsTrigger>
          <TabsTrigger value="requests" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            Requests ({changeRequests.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="uploads" className="space-y-3 mt-4">
          {pendingFiles.length === 0 ? (
            <div className="glass-panel p-8 text-center">
              <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No pending uploads</p>
            </div>
          ) : (
            pendingFiles.map((file) => (
              <div key={file.id} className="glass-panel p-4 flex items-center justify-between animate-slide-in">
                <div className="flex items-center gap-3">
                  <Film className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{file.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.file_size / 1024 / 1024).toFixed(1)} MB • {file.quality} quality
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" className="text-success hover:bg-success/10" onClick={() => handleFileAction(file.id, "approved")} disabled={syncingFiles.has(file.id)}>
                    {syncingFiles.has(file.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => handleFileAction(file.id, "rejected")}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="requests" className="space-y-3 mt-4">
          {changeRequests.length === 0 ? (
            <div className="glass-panel p-8 text-center">
              <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No pending requests</p>
            </div>
          ) : (
            changeRequests.map((req) => (
              <div key={req.id} className="glass-panel p-4 flex items-center justify-between animate-slide-in">
                <div className="flex items-center gap-3">
                  {req.request_type === "delete" ? (
                    <Trash2 className="h-5 w-5 text-destructive" />
                  ) : (
                    <FileEdit className="h-5 w-5 text-warning" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {req.request_type === "delete" ? "Delete" : "Rename"}: {req.files?.file_name}
                    </p>
                    {req.new_file_name && (
                      <p className="text-xs text-muted-foreground">New name: {req.new_file_name}</p>
                    )}
                    {req.reason && (
                      <p className="text-xs text-muted-foreground">Reason: {req.reason}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" className="text-success hover:bg-success/10" onClick={() => handleRequestAction(req.id, "approved", req)}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => handleRequestAction(req.id, "rejected", req)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
