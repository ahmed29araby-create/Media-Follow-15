import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, Film, Loader2, X, FolderPlus, Folder } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

interface Subfolder {
  id: string;
  folder_name: string;
}

export default function UploadPage() {
  const { user, organizationId } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [mainFolder, setMainFolder] = useState("uploads");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  // Subfolders state
  const [subfolders, setSubfolders] = useState<Subfolder[]>([]);
  const [selectedSubfolder, setSelectedSubfolder] = useState<string>("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("member_settings")
      .select("folder_name")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => { if (data) setMainFolder(data.folder_name); });

    loadSubfolders();
  }, [user]);

  const loadSubfolders = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("member_subfolders")
      .select("id, folder_name")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    setSubfolders(data ?? []);
  };

  const createSubfolder = async () => {
    const name = newFolderName.trim();
    if (!name) { toast.error("أدخل اسم المجلد", { id: "folder-name-required" }); return; }
    if (!organizationId) return;
    setCreatingFolder(true);
    const { data, error } = await supabase
      .from("member_subfolders")
      .insert({ user_id: user!.id, organization_id: organizationId, folder_name: name })
      .select("id, folder_name")
      .single();
    if (error) {
      if (error.code === "23505") toast.error("يوجد مجلد بهذا الاسم بالفعل", { id: "folder-exists" });
      else toast.error(error.message);
    } else {
      toast.success(`تم إنشاء المجلد "${name}"`);
      setSubfolders(prev => [...prev, data]);
      setSelectedSubfolder(name);
      setNewFolderName("");
      setShowNewFolder(false);
    }
    setCreatingFolder(false);
  };

  const getUploadPath = () => {
    if (selectedSubfolder) return `${mainFolder}/${selectedSubfolder}`;
    return mainFolder;
  };

  const handleUpload = async () => {
    if (!file || !user) return;
    if (!selectedSubfolder && subfolders.length > 0) {
      toast.error("اختر مجلد لرفع المحتوى", { id: "select-folder" });
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    setUploadSpeed(0);
    setTimeRemaining(null);

    const fileExtension = file.name.split('.').pop();
    const safeFileName = crypto.randomUUID() + (fileExtension ? `.${fileExtension}` : '');
    const storagePath = `${user.id}/${Date.now()}_${safeFileName}`;
    const filePath = `${getUploadPath()}/${file.name}`;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("يرجى تسجيل الدخول أولاً"); setUploading(false); return; }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const uploadUrl = `${supabaseUrl}/storage/v1/object/pending_uploads/${storagePath}`;

      const uploaded = await new Promise<boolean>((resolve, reject) => {
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
          if (xhr.status >= 200 && xhr.status < 300) resolve(true);
          else {
            try { const err = JSON.parse(xhr.responseText); reject(new Error(err.message || err.error || `خطأ ${xhr.status}`)); }
            catch { reject(new Error(`خطأ في الرفع: ${xhr.status}`)); }
          }
        });
        xhr.addEventListener("error", () => reject(new Error("فشل الاتصال بالخادم")));
        xhr.addEventListener("abort", () => reject(new Error("تم إلغاء الرفع")));

        xhr.open("POST", uploadUrl);
        xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
        xhr.setRequestHeader("apikey", import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
        xhr.setRequestHeader("x-upsert", "true");
        xhr.send(file);
      });

      if (!uploaded) { setUploading(false); return; }

      const { error: dbError } = await supabase.from("files").insert({
        user_id: user.id,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        quality: "original",
        status: "pending",
        storage_path: storagePath,
        organization_id: organizationId,
      });

      if (dbError) toast.error("فشل تسجيل الملف: " + dbError.message);
      else { toast.success("تم الرفع! في انتظار موافقة المسؤول."); setFile(null); }
    } catch (err: any) {
      if (err.message !== "تم إلغاء الرفع") toast.error("فشل الرفع: " + err.message);
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setUploadSpeed(0);
      setTimeRemaining(null);
      xhrRef.current = null;
    }
  };

  const cancelUpload = () => {
    if (xhrRef.current) { xhrRef.current.abort(); toast.info("تم إلغاء الرفع"); }
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
    if (droppedFile) setFile(droppedFile);
    else toast.error("لم يتم التعرف على الملف");
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">رفع ملف</h1>
        <p className="text-sm text-muted-foreground">
          المجلد الرئيسي: <span className="text-foreground font-medium" dir="ltr">{mainFolder}</span>
          {selectedSubfolder && (
            <> / <span className="text-primary font-medium" dir="ltr">{selectedSubfolder}</span></>
          )}
        </p>
      </div>

      {/* Folder Selector */}
      <div className="glass-panel p-4 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            اختار folder لرفع المحتوى
          </Label>
          <button
            type="button"
            onClick={() => setShowNewFolder(true)}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
          >
            <FolderPlus className="h-3.5 w-3.5" />
            <span>إضافة folder جديد</span>
          </button>
        </div>

        {/* New Folder Input */}
        {showNewFolder && (
          <div className="flex gap-2 items-center">
            <Input
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              placeholder="اسم المجلد الجديد"
              dir="ltr"
              className="text-left flex-1 h-8 text-sm"
              onKeyDown={e => { if (e.key === "Enter") createSubfolder(); if (e.key === "Escape") { setShowNewFolder(false); setNewFolderName(""); } }}
              autoFocus
            />
            <Button size="sm" onClick={createSubfolder} disabled={creatingFolder} className="h-8 px-3">
              {creatingFolder ? <Loader2 className="h-3 w-3 animate-spin" /> : "إنشاء"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowNewFolder(false); setNewFolderName(""); }} className="h-8 px-3">
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* Folder Grid */}
        <div className="grid grid-cols-2 gap-3">
          {subfolders.length === 0 && !showNewFolder ? (
            <div className="col-span-2 text-center py-4">
              <Folder className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">لا توجد مجلدات بعد. أنشئ folder جديد للبدء.</p>
            </div>
          ) : (
            subfolders.map(sf => (
              <button
                key={sf.id}
                type="button"
                onClick={() => setSelectedSubfolder(sf.folder_name)}
                disabled={uploading}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-lg border p-4 transition-all",
                  selectedSubfolder === sf.folder_name
                    ? "border-primary/50 bg-primary/5"
                    : "border-border hover:border-border/80 bg-secondary/30"
                )}
              >
                <Folder className={cn("h-6 w-6", selectedSubfolder === sf.folder_name ? "text-primary" : "text-muted-foreground")} />
                <span className={cn("text-sm font-medium", selectedSubfolder === sf.folder_name ? "text-primary" : "text-muted-foreground")} dir="ltr">
                  {sf.folder_name}
                </span>
              </button>
            ))
          )}
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
        <input ref={inputRef} type="file" className="hidden" onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])} />
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
              <p className="text-sm font-medium text-foreground">اسحب الملف هنا أو اضغط للتصفح</p>
              <p className="text-xs text-muted-foreground">فيديو، صورة، أو أي ملف آخر</p>
            </div>
          </>
        )}
      </div>

      {/* Upload Progress */}
      {uploading && (
        <div className="glass-panel p-4 space-y-3 animate-slide-in">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">جاري الرفع...</span>
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
