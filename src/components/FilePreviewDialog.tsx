import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Eye } from "lucide-react";

interface FilePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storagePath: string | null;
  fileName: string;
  drivePath?: string | null;
}

function getFileType(fileName: string): "video" | "image" | "audio" | "text" | "unknown" {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (["mp4", "mov", "webm", "avi", "mkv", "m4v"].includes(ext)) return "video";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "heic"].includes(ext)) return "image";
  if (["mp3", "wav", "ogg", "m4a", "aac"].includes(ext)) return "audio";
  if (["txt", "md", "csv", "json", "xml"].includes(ext)) return "text";
  return "unknown";
}

export default function FilePreviewDialog({ open, onOpenChange, storagePath, fileName, drivePath }: FilePreviewDialogProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileType = getFileType(fileName);

  useEffect(() => {
    if (!open) { setUrl(null); setError(null); return; }

    const loadUrl = async () => {
      setLoading(true);
      setError(null);

      if (storagePath) {
        const { data, error: err } = await supabase.storage
          .from("pending_uploads")
          .createSignedUrl(storagePath, 3600);

        if (err || !data?.signedUrl) {
          setError("تعذر تحميل الملف");
        } else {
          setUrl(data.signedUrl);
        }
      } else if (drivePath?.startsWith("http")) {
        // Already on Drive, use the link
        setUrl(drivePath);
      } else {
        setError("لا يوجد ملف للمعاينة");
      }
      setLoading(false);
    };

    loadUrl();
  }, [open, storagePath, drivePath]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-foreground text-sm truncate">{fileName}</DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-center min-h-[200px]">
          {loading && <Loader2 className="h-8 w-8 animate-spin text-primary" />}

          {error && <p className="text-sm text-destructive">{error}</p>}

          {!loading && !error && url && fileType === "video" && (
            <video
              src={url}
              controls
              autoPlay
              className="w-full rounded-lg max-h-[70vh]"
              controlsList="nodownload"
            />
          )}

          {!loading && !error && url && fileType === "image" && (
            <img src={url} alt={fileName} className="w-full rounded-lg max-h-[70vh] object-contain" />
          )}

          {!loading && !error && url && fileType === "audio" && (
            <audio src={url} controls autoPlay className="w-full" />
          )}

          {!loading && !error && url && (fileType === "text" || fileType === "unknown") && (
            <div className="w-full text-center space-y-3">
              <p className="text-sm text-muted-foreground">لا يمكن عرض هذا النوع من الملفات مباشرة</p>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <Eye className="h-4 w-4" />
                فتح الملف
              </a>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
