import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { FileStack, FileEdit, Trash2, FolderOpen, ArrowRight, Eye, Folder, ChevronDown, ChevronLeft } from "lucide-react";
import FilePreviewDialog from "@/components/FilePreviewDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type FileRow = Database["public"]["Tables"]["files"]["Row"];

interface MemberFolder {
  user_id: string;
  display_name: string;
  folder_name: string;
  file_count: number;
}

interface GroupedFiles {
  folderName: string;
  files: FileRow[];
}

function groupFilesBySubfolder(fileList: FileRow[]): GroupedFiles[] {
  const grouped: Record<string, FileRow[]> = {};
  fileList.forEach(file => {
    const parts = file.file_path.split("/");
    // path format: mainFolder/subfolder/filename or mainFolder/filename
    const subfolder = parts.length > 2 ? parts[1] : "المجلد الرئيسي";
    if (!grouped[subfolder]) grouped[subfolder] = [];
    grouped[subfolder].push(file);
  });
  return Object.entries(grouped).map(([folderName, files]) => ({ folderName, files }));
}

export default function FilesPage() {
  const { user, isAdmin, organizationId } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const memberFilter = searchParams.get("member");

  const [files, setFiles] = useState<FileRow[]>([]);
  const [folders, setFolders] = useState<MemberFolder[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(true);
  const [editDialog, setEditDialog] = useState<{ open: boolean; file: FileRow | null }>({ open: false, file: null });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; file: FileRow | null }>({ open: false, file: null });
  const [newName, setNewName] = useState("");
  const [reason, setReason] = useState("");
  const [previewFile, setPreviewFile] = useState<FileRow | null>(null);
  const [memberName, setMemberName] = useState("");
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});

  const groupedFiles = useMemo(() => groupFilesBySubfolder(files), [files]);

  const toggleFolder = (name: string) => {
    setOpenFolders(prev => ({ ...prev, [name]: !prev[name] }));
  };

  // Initialize all folders as open
  useEffect(() => {
    const initial: Record<string, boolean> = {};
    groupedFiles.forEach(g => { initial[g.folderName] = true; });
    setOpenFolders(initial);
  }, [groupedFiles.length]);

  const fetchFolders = async () => {
    if (!organizationId) return;
    setLoadingFolders(true);

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name")
      .eq("organization_id", organizationId);

    if (!profiles) { setLoadingFolders(false); return; }

    const folderList: MemberFolder[] = [];

    for (const profile of profiles) {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", profile.user_id);

      const isMember = roles?.some(r => r.role === "member");
      if (!isMember) continue;

      const { data: settings } = await supabase
        .from("member_settings")
        .select("folder_name")
        .eq("user_id", profile.user_id)
        .eq("organization_id", organizationId)
        .single();

      const { count } = await supabase
        .from("files")
        .select("id", { count: "exact", head: true })
        .eq("user_id", profile.user_id);

      folderList.push({
        user_id: profile.user_id,
        display_name: profile.display_name,
        folder_name: settings?.folder_name ?? "uploads",
        file_count: count ?? 0,
      });
    }

    setFolders(folderList);
    setLoadingFolders(false);
  };

  const fetchFiles = async () => {
    if (!user) return;
    
    if (isAdmin && memberFilter) {
      const { data } = await supabase
        .from("files")
        .select("*")
        .eq("user_id", memberFilter)
        .order("created_at", { ascending: false });
      setFiles(data ?? []);

      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", memberFilter)
        .single();
      setMemberName(profile?.display_name ?? "");
    } else if (!isAdmin) {
      const { data } = await supabase
        .from("files")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setFiles(data ?? []);
    }
  };

  useEffect(() => {
    if (!user) return;
    if (isAdmin && !memberFilter) {
      fetchFolders();
    } else {
      fetchFiles();
    }
  }, [user, isAdmin, memberFilter, organizationId]);

  const submitRequest = async (type: "edit" | "delete", fileId: string) => {
    const { error } = await supabase.from("change_requests").insert({
      file_id: fileId, user_id: user!.id, request_type: type,
      new_file_name: type === "edit" ? newName : null, reason,
    });
    if (error) toast.error(error.message);
    else toast.success(`تم إرسال طلب ${type === "edit" ? "التعديل" : "الحذف"}`);
    setEditDialog({ open: false, file: null });
    setDeleteDialog({ open: false, file: null });
    setNewName(""); setReason("");
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "approved": return <span className="status-approved">معتمد</span>;
      case "rejected": return <span className="status-rejected">مرفوض</span>;
      case "delete_requested": return <span className="status-pending">طلب حذف</span>;
      default: return <span className="status-pending">قيد المراجعة</span>;
    }
  };

  const renderFileItem = (file: FileRow) => (
    <div key={file.id} className="glass-panel p-4 flex items-center justify-between animate-slide-in">
      <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={() => setPreviewFile(file)}>
        <FileStack className="h-5 w-5 text-primary shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{file.file_name}</p>
          <p className="text-xs text-muted-foreground">{(file.file_size / 1024 / 1024).toFixed(1)} MB</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button size="sm" variant="ghost" className="text-primary hover:bg-primary/10" onClick={() => setPreviewFile(file)}>
          <Eye className="h-4 w-4" />
        </Button>
        {statusBadge(file.status)}
        {!isAdmin && file.status !== "pending" && (
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-warning" onClick={() => { setEditDialog({ open: true, file }); setNewName(file.file_name); }}>
              <FileEdit className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => setDeleteDialog({ open: true, file })}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  // Admin folder view
  if (isAdmin && !memberFilter) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-6" dir="rtl">
        <div className="text-center space-y-1 pb-4 border-b border-border">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground" style={{ fontFamily: "'DM Sans', sans-serif", letterSpacing: '-0.02em' }}>جميع الملفات</h1>
          <p className="text-sm text-muted-foreground">مجلدات أعضاء الفريق</p>
        </div>

        {loadingFolders ? (
          <div className="flex justify-center p-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : folders.length === 0 ? (
          <div className="glass-panel p-8 text-center">
            <FolderOpen className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">لا يوجد أعضاء بعد</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {folders.map(folder => (
              <button
                key={folder.user_id}
                onClick={() => navigate(`/files?member=${folder.user_id}`)}
                className="glass-panel p-5 text-center hover:bg-secondary/60 transition-colors cursor-pointer group"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 mx-auto mb-3 group-hover:bg-primary/20 transition-colors">
                  <FolderOpen className="h-7 w-7 text-primary" />
                </div>
                <p className="text-xs font-bold text-foreground mb-0.5">{folder.display_name}</p>
                <p className="text-[10px] text-muted-foreground" dir="ltr">{folder.folder_name}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{folder.file_count} ملف</p>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // File list view grouped by subfolders
  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6" dir="rtl">
      <div className="text-center space-y-1 pb-4 border-b border-border">
        {isAdmin && memberFilter && (
          <button
            onClick={() => navigate("/files")}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline mb-2"
          >
            <ArrowRight className="h-3 w-3" />
            العودة للمجلدات
          </button>
        )}
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground" style={{ fontFamily: "'DM Sans', sans-serif", letterSpacing: '-0.02em' }}>
          {isAdmin && memberName ? `ملفات ${memberName}` : "ملفاتي"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isAdmin ? "عرض محتوى العضو" : "عرض وإدارة ملفاتك"}
        </p>
      </div>

      {files.length === 0 ? (
        <div className="glass-panel p-8 text-center">
          <FolderOpen className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">لا توجد ملفات بعد</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedFiles.map(group => (
            <Collapsible
              key={group.folderName}
              open={openFolders[group.folderName] !== false}
              onOpenChange={() => toggleFolder(group.folderName)}
            >
              <CollapsibleTrigger className="w-full flex items-center gap-2 p-3 rounded-lg bg-secondary/40 hover:bg-secondary/60 transition-colors">
                <ChevronDown className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform",
                  openFolders[group.folderName] === false && "-rotate-90"
                )} />
                <Folder className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-foreground flex-1 text-right" dir="ltr">{group.folderName}</span>
                <span className="text-xs text-muted-foreground">{group.files.length} ملف</span>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 mt-2 pr-2">
                {group.files.map(renderFileItem)}
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      )}

      <Dialog open={editDialog.open} onOpenChange={o => setEditDialog({ open: o, file: editDialog.file })}>
        <DialogContent className="bg-card border-border" dir="rtl">
          <DialogHeader><DialogTitle className="text-foreground">طلب إعادة تسمية</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>الاسم الجديد</Label><Input value={newName} onChange={e => setNewName(e.target.value)} /></div>
            <div className="space-y-2"><Label>السبب</Label><Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="لماذا تحتاج هذا التغيير؟" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog({ open: false, file: null })}>إلغاء</Button>
            <Button onClick={() => editDialog.file && submitRequest("edit", editDialog.file.id)}>إرسال الطلب</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialog.open} onOpenChange={o => setDeleteDialog({ open: o, file: deleteDialog.file })}>
        <DialogContent className="bg-card border-border" dir="rtl">
          <DialogHeader><DialogTitle className="text-foreground">طلب حذف</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">طلب حذف <strong className="text-foreground">{deleteDialog.file?.file_name}</strong>؟</p>
          <div className="space-y-2"><Label>السبب</Label><Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="لماذا يجب حذف هذا الملف؟" /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, file: null })}>إلغاء</Button>
            <Button variant="destructive" onClick={() => deleteDialog.file && submitRequest("delete", deleteDialog.file.id)}>إرسال الطلب</Button>
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
