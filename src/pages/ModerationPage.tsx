import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Check, X, Film, Clock, FileEdit, Trash2, Loader2, Eye, FolderOpen, Plus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import FilePreviewDialog from "@/components/FilePreviewDialog";
import type { Database } from "@/integrations/supabase/types";

type FileRow = Database["public"]["Tables"]["files"]["Row"];
type ChangeRequestRow = Database["public"]["Tables"]["change_requests"]["Row"];

interface ChangeRequestWithFile extends ChangeRequestRow {
  files: { file_name: string } | null;
}

interface DriveFolder {
  id: string;
  name: string;
}

export default function ModerationPage() {
  const { organizationId } = useAuth();
  const [pendingFiles, setPendingFiles] = useState<FileRow[]>([]);
  const [changeRequests, setChangeRequests] = useState<ChangeRequestWithFile[]>([]);
  const [syncingFiles, setSyncingFiles] = useState<Set<string>>(new Set());
  const [previewFile, setPreviewFile] = useState<FileRow | null>(null);

  // Folder picker state
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [approvalFile, setApprovalFile] = useState<FileRow | null>(null);
  const [driveFolders, setDriveFolders] = useState<DriveFolder[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);

  const fetchData = async () => {
    const [filesRes, requestsRes] = await Promise.all([
      supabase.from("files").select("*").eq("status", "pending"),
      supabase.from("change_requests").select("*, files(file_name)").eq("status", "pending"),
    ]);
    setPendingFiles(filesRes.data ?? []);
    setChangeRequests((requestsRes.data as ChangeRequestWithFile[]) ?? []);
  };

  useEffect(() => { fetchData(); }, []);

  const fetchDriveFolders = async () => {
    setLoadingFolders(true);
    try {
      const { data, error } = await supabase.functions.invoke("list-drive-folders", {
        body: { action: "list" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setDriveFolders(data?.folders ?? []);
    } catch (err: any) {
      toast.error(err.message || "فشل تحميل المجلدات");
    }
    setLoadingFolders(false);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    setCreatingFolder(true);
    try {
      const { data, error } = await supabase.functions.invoke("list-drive-folders", {
        body: { action: "create", folder_name: newFolderName.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setDriveFolders(data?.folders ?? []);
      setNewFolderName("");
      setShowNewFolderInput(false);
      toast.success("تم إنشاء المجلد بنجاح");
    } catch (err: any) {
      toast.error(err.message || "فشل إنشاء المجلد");
    }
    setCreatingFolder(false);
  };

  const handleApproveClick = (file: FileRow) => {
    setApprovalFile(file);
    setFolderPickerOpen(true);
    fetchDriveFolders();
  };

  const handleFolderSelect = async (folderName: string) => {
    if (!approvalFile) return;
    const fileId = approvalFile.id;
    setFolderPickerOpen(false);

    setSyncingFiles(prev => new Set(prev).add(fileId));
    try {
      const { data, error } = await supabase.functions.invoke("sync-to-drive", {
        body: { file_id: fileId, target_subfolder: folderName },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      await supabase.from("notifications").insert({
        user_id: approvalFile.user_id,
        organization_id: organizationId,
        title: "تمت الموافقة على فيديو ✅",
        message: `تمت الموافقة على "${approvalFile.file_name}" وحفظه في مجلد "${folderName}"`,
        type: "approval",
        related_file_id: fileId,
      });

      toast.success(`تمت الموافقة وحفظ الملف في "${folderName}"`);
    } catch (err: any) {
      toast.error(`فشل المزامنة: ${err.message}`);
    } finally {
      setSyncingFiles(prev => { const n = new Set(prev); n.delete(fileId); return n; });
      setApprovalFile(null);
      fetchData();
    }
  };

  const handleFileAction = async (fileId: string, action: "rejected", file: FileRow) => {
    const { error } = await supabase.from("files").update({ status: action }).eq("id", fileId);
    if (error) toast.error(error.message);
    else {
      await supabase.from("notifications").insert({
        user_id: file.user_id,
        organization_id: organizationId,
        title: "تم رفض فيديو ❌",
        message: `تم رفض "${file.file_name}"`,
        type: "rejection",
        related_file_id: fileId,
      });
      toast.success("تم الرفض");
      fetchData();
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
    toast.success(`تم ${action === "approved" ? "الموافقة على" : "رفض"} الطلب`);
    fetchData();
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6" dir="rtl">
      <div className="text-center space-y-1 pb-4 border-b border-border">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground" style={{ fontFamily: "'DM Sans', sans-serif", letterSpacing: '-0.02em' }}>لوحة المراجعة</h1>
        <p className="text-sm text-muted-foreground">مراجعة والموافقة على الإجراءات المعلقة</p>
      </div>

      <Tabs defaultValue="uploads" dir="rtl">
        <TabsList className="bg-secondary">
          <TabsTrigger value="uploads" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            الرفع ({pendingFiles.length})
          </TabsTrigger>
          <TabsTrigger value="requests" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            الطلبات ({changeRequests.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="uploads" className="space-y-3 mt-4">
          {pendingFiles.length === 0 ? (
            <div className="glass-panel p-8 text-center">
              <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">لا توجد ملفات معلقة</p>
            </div>
          ) : (
            pendingFiles.map(file => (
              <div key={file.id} className="glass-panel p-4 flex items-center justify-between animate-slide-in">
                <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={() => setPreviewFile(file)}>
                  <Film className="h-5 w-5 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{file.file_name}</p>
                    <p className="text-xs text-muted-foreground">{(file.file_size / 1024 / 1024).toFixed(1)} MB • {file.quality === "original" ? "أصلي" : "بروكسي"}</p>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="ghost" className="text-primary hover:bg-primary/10" onClick={() => setPreviewFile(file)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" className="text-success hover:bg-success/10" onClick={() => handleApproveClick(file)} disabled={syncingFiles.has(file.id)}>
                    {syncingFiles.has(file.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => handleFileAction(file.id, "rejected", file)}>
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
              <p className="text-sm text-muted-foreground">لا توجد طلبات معلقة</p>
            </div>
          ) : (
            changeRequests.map(req => (
              <div key={req.id} className="glass-panel p-4 flex items-center justify-between animate-slide-in">
                <div className="flex items-center gap-3">
                  {req.request_type === "delete" ? <Trash2 className="h-5 w-5 text-destructive" /> : <FileEdit className="h-5 w-5 text-warning" />}
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {req.request_type === "delete" ? "حذف" : "إعادة تسمية"}: {req.files?.file_name}
                    </p>
                    {req.new_file_name && <p className="text-xs text-muted-foreground">الاسم الجديد: {req.new_file_name}</p>}
                    {req.reason && <p className="text-xs text-muted-foreground">السبب: {req.reason}</p>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" className="text-success hover:bg-success/10" onClick={() => handleRequestAction(req.id, "approved", req)}><Check className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => handleRequestAction(req.id, "rejected", req)}><X className="h-4 w-4" /></Button>
                </div>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Folder Picker Dialog */}
      <Dialog open={folderPickerOpen} onOpenChange={(o) => { if (!o) { setFolderPickerOpen(false); setApprovalFile(null); setShowNewFolderInput(false); } }}>
        <DialogContent className="bg-card border-border max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-foreground">اختر مكان حفظ الفيديو</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-2">
            اختر المجلد الذي سيتم حفظ "<strong className="text-foreground">{approvalFile?.file_name}</strong>" فيه على Google Drive
          </p>

          {loadingFolders ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {driveFolders.length === 0 ? (
                <div className="text-center p-4 text-sm text-muted-foreground">
                  <FolderOpen className="h-6 w-6 mx-auto mb-2" />
                  لا توجد مجلدات. أنشئ مجلداً جديداً
                </div>
              ) : (
                driveFolders.map(folder => (
                  <button
                    key={folder.id}
                    onClick={() => handleFolderSelect(folder.name)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-secondary/60 hover:border-primary/30 transition-colors text-right"
                  >
                    <FolderOpen className="h-5 w-5 text-primary shrink-0" />
                    <span className="text-sm font-medium text-foreground">{folder.name}</span>
                  </button>
                ))
              )}
            </div>
          )}

          <div className="border-t border-border pt-3 mt-2">
            {showNewFolderInput ? (
              <div className="flex gap-2">
                <Input
                  value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  placeholder="اسم المجلد الجديد"
                  className="flex-1"
                  onKeyDown={e => e.key === "Enter" && handleCreateFolder()}
                />
                <Button size="sm" onClick={handleCreateFolder} disabled={creatingFolder || !newFolderName.trim()}>
                  {creatingFolder ? <Loader2 className="h-4 w-4 animate-spin" /> : "إنشاء"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setShowNewFolderInput(false); setNewFolderName(""); }}>
                  إلغاء
                </Button>
              </div>
            ) : (
              <Button variant="outline" className="w-full gap-2" onClick={() => setShowNewFolderInput(true)}>
                <Plus className="h-4 w-4" />
                إنشاء مجلد جديد
              </Button>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => { setFolderPickerOpen(false); setApprovalFile(null); }}>إلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FilePreviewDialog
        open={!!previewFile}
        onOpenChange={(o) => !o && setPreviewFile(null)}
        storagePath={previewFile?.storage_path ?? null}
        fileName={previewFile?.file_name ?? ""}
        drivePath={previewFile?.drive_path}
      />
    </div>
  );
}
