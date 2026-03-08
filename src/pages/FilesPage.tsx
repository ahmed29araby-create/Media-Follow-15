import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Film, FileEdit, Trash2, FolderOpen } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Database } from "@/integrations/supabase/types";

type FileRow = Database["public"]["Tables"]["files"]["Row"];

export default function FilesPage() {
  const { user, isAdmin } = useAuth();
  const [files, setFiles] = useState<FileRow[]>([]);
  const [editDialog, setEditDialog] = useState<{ open: boolean; file: FileRow | null }>({ open: false, file: null });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; file: FileRow | null }>({ open: false, file: null });
  const [newName, setNewName] = useState("");
  const [reason, setReason] = useState("");

  const fetchFiles = async () => {
    const query = supabase.from("files").select("*").order("created_at", { ascending: false });
    const { data } = isAdmin ? await query : await query.eq("user_id", user!.id);
    setFiles(data ?? []);
  };

  useEffect(() => { if (user) fetchFiles(); }, [user, isAdmin]);

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

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{isAdmin ? "جميع الملفات" : "ملفاتي"}</h1>
        <p className="text-sm text-muted-foreground">{isAdmin ? "إدارة جميع المحتوى المرفوع" : "عرض وإدارة ملفاتك"}</p>
      </div>

      <div className="space-y-3">
        {files.map(file => (
          <div key={file.id} className="glass-panel p-4 flex items-center justify-between animate-slide-in">
            <div className="flex items-center gap-3">
              <Film className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">{file.file_name}</p>
                <p className="text-xs text-muted-foreground">{(file.file_size / 1024 / 1024).toFixed(1)} MB • {file.quality === "original" ? "أصلي" : "بروكسي"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
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
        ))}
        {files.length === 0 && (
          <div className="glass-panel p-8 text-center">
            <FolderOpen className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">لا توجد ملفات بعد</p>
          </div>
        )}
      </div>

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
    </div>
  );
}
