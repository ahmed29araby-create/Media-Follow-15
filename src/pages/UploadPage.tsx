import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, Film, Loader2, HardDrive, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export default function UploadPage() {
  const { user, organizationId } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [quality, setQuality] = useState<"original" | "proxy">("original");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [folderName, setFolderName] = useState("uploads");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("member_settings")
      .select("folder_name")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => { if (data) setFolderName(data.folder_name); });
  }, [user]);

  const handleUpload = async () => {
    if (!file || !user) return;
    setUploading(true);

    const storagePath = `${user.id}/${Date.now()}_${file.name}`;
    const { error: storageError } = await supabase.storage
      .from("pending_uploads")
      .upload(storagePath, file);

    if (storageError) {
      toast.error("فشل الرفع: " + storageError.message);
      setUploading(false);
      return;
    }

    const { error: dbError } = await supabase.from("files").insert({
      user_id: user.id,
      file_name: file.name,
      file_path: `${folderName}/${file.name}`,
      file_size: file.size,
      quality,
      status: "pending",
      storage_path: storagePath,
      organization_id: organizationId,
    });

    if (dbError) {
      toast.error("فشل تسجيل الملف: " + dbError.message);
    } else {
      toast.success("تم الرفع! في انتظار موافقة المسؤول.");
      setFile(null);
    }
    setUploading(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile?.type.startsWith("video/")) setFile(droppedFile);
    else toast.error("يرجى إسقاط ملف فيديو");
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">رفع فيديو</h1>
        <p className="text-sm text-muted-foreground">رفع المحتوى لمراجعة المسؤول • المجلد: <span className="text-foreground font-medium" dir="ltr">{folderName}</span></p>
      </div>

      {/* Quality Toggle */}
      <div className="glass-panel p-4">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 block">
          اختيار الجودة
        </Label>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setQuality("original")}
            className={cn(
              "flex flex-col items-center gap-2 rounded-lg border p-4 transition-all",
              quality === "original" ? "border-primary/50 bg-primary/5" : "border-border hover:border-border/80 bg-secondary/30"
            )}
          >
            <HardDrive className={cn("h-6 w-6", quality === "original" ? "text-primary" : "text-muted-foreground")} />
            <span className={cn("text-sm font-medium", quality === "original" ? "text-primary" : "text-muted-foreground")}>أصلي</span>
            <span className="text-[10px] text-muted-foreground">جودة كاملة</span>
          </button>
          <button
            onClick={() => setQuality("proxy")}
            className={cn(
              "flex flex-col items-center gap-2 rounded-lg border p-4 transition-all",
              quality === "proxy" ? "border-primary/50 bg-primary/5" : "border-border hover:border-border/80 bg-secondary/30"
            )}
          >
            <Zap className={cn("h-6 w-6", quality === "proxy" ? "text-primary" : "text-muted-foreground")} />
            <span className={cn("text-sm font-medium", quality === "proxy" ? "text-primary" : "text-muted-foreground")}>بروكسي</span>
            <span className="text-[10px] text-muted-foreground">جودة مخفضة • أسرع</span>
          </button>
        </div>
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "glass-panel flex flex-col items-center justify-center gap-4 p-12 cursor-pointer transition-all",
          dragOver && "glow-border bg-primary/5",
          file && "border-primary/30"
        )}
      >
        <input ref={inputRef} type="file" accept="video/*" className="hidden" onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])} />
        {file ? (
          <>
            <Film className="h-10 w-10 text-primary" />
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">{file.name}</p>
              <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
            </div>
          </>
        ) : (
          <>
            <Upload className="h-10 w-10 text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">اسحب الفيديو هنا أو اضغط للتصفح</p>
              <p className="text-xs text-muted-foreground">يدعم جميع صيغ الفيديو</p>
            </div>
          </>
        )}
      </div>

      <Button onClick={handleUpload} disabled={!file || uploading} className="w-full">
        {uploading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
        {uploading ? "جاري الرفع..." : "إرسال للمراجعة"}
      </Button>
    </div>
  );
}
