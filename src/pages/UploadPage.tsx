import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, Film, Loader2, HardDrive, Zap, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

export default function UploadPage() {
  const { user, organizationId } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [quality, setQuality] = useState<"original" | "proxy">("original");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [folderName, setFolderName] = useState("uploads");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

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
    setUploadProgress(0);
    setUploadSpeed(0);
    setTimeRemaining(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("يرجى تسجيل الدخول أولاً");
        setUploading(false);
        return;
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const uploadUrl = `${supabaseUrl}/functions/v1/upload-to-drive`;

      const formData = new FormData();
      formData.append("file", file);
      formData.append("file_name", file.name);
      formData.append("quality", quality);
      formData.append("folder_name", folderName);
      if (organizationId) formData.append("organization_id", organizationId);

      const result = await new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        let lastLoaded = 0;
        let lastTime = Date.now();

        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            setUploadProgress(percent);

            const now = Date.now();
            const elapsed = (now - lastTime) / 1000;
            if (elapsed > 0.5) {
              const bytesPerSec = (e.loaded - lastLoaded) / elapsed;
              setUploadSpeed(bytesPerSec);
              const remaining = (e.total - e.loaded) / bytesPerSec;
              setTimeRemaining(remaining > 0 ? remaining : null);
              lastLoaded = e.loaded;
              lastTime = now;
            }
          }
        });

        xhr.addEventListener("load", () => {
          try {
            const data = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300 && data.success) {
              resolve(data);
            } else {
              reject(new Error(data.error || `خطأ ${xhr.status}`));
            }
          } catch {
            reject(new Error(`خطأ في الرفع: ${xhr.status}`));
          }
        });

        xhr.addEventListener("error", () => reject(new Error("فشل الاتصال بالخادم")));
        xhr.addEventListener("abort", () => reject(new Error("تم إلغاء الرفع")));

        xhr.open("POST", uploadUrl);
        xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
        xhr.setRequestHeader("apikey", import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
        xhr.send(formData);
      });

      toast.success("تم الرفع بنجاح على Google Drive! في انتظار موافقة المسؤول.");
      setFile(null);
    } catch (err: any) {
      if (err.message !== "تم إلغاء الرفع") {
        toast.error("فشل الرفع: " + err.message);
      }
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setUploadSpeed(0);
      setTimeRemaining(null);
      xhrRef.current = null;
    }
  };

  const cancelUpload = () => {
    if (xhrRef.current) {
      xhrRef.current.abort();
      toast.info("تم إلغاء الرفع");
    }
  };

  const formatSpeed = (bytesPerSec: number) => {
    if (bytesPerSec > 1024 * 1024) return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
    if (bytesPerSec > 1024) return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
    return `${bytesPerSec.toFixed(0)} B/s`;
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${Math.ceil(seconds)} ثانية`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.ceil(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')} دقيقة`;
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
            disabled={uploading}
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
            disabled={uploading}
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
        onClick={() => !uploading && inputRef.current?.click()}
        className={cn(
          "glass-panel flex flex-col items-center justify-center gap-4 p-12 cursor-pointer transition-all",
          dragOver && "glow-border bg-primary/5",
          file && "border-primary/30",
          uploading && "pointer-events-none opacity-70"
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
              <p className="text-xs text-muted-foreground">يدعم جميع صيغ الفيديو • يتم الرفع مباشرة على Google Drive</p>
            </div>
          </>
        )}
      </div>

      {/* Upload Progress */}
      {uploading && (
        <div className="glass-panel p-4 space-y-3 animate-slide-in">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">جاري الرفع إلى Google Drive...</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-primary">{uploadProgress}%</span>
              <Button size="sm" variant="ghost" onClick={cancelUpload} className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <Progress value={uploadProgress} className="h-2" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{uploadSpeed > 0 ? formatSpeed(uploadSpeed) : "جاري الحساب..."}</span>
            <span>{timeRemaining !== null ? `متبقي ${formatTime(timeRemaining)}` : ""}</span>
          </div>
        </div>
      )}

      {!uploading && (
        <Button onClick={handleUpload} disabled={!file} className="w-full">
          إرسال للمراجعة
        </Button>
      )}
    </div>
  );
}
