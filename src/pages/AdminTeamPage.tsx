import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Users, User, Eye, EyeOff, Loader2, FolderOpen, DollarSign, FileStack, CheckCircle } from "lucide-react";

interface TeamMember {
  id: string;
  user_id: string;
  display_name: string;
  email: string;
  account_status: string;
  member_settings?: {
    folder_name: string;
    price_per_video: number;
  };
  file_stats?: {
    total: number;
    approved: number;
    rejected: number;
    earnings: number;
  };
}

export default function AdminTeamPage() {
  const { organizationId } = useAuth();
  const navigate = useNavigate();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({
    display_name: "", email: "", password: "",
    folder_name: "", price_per_video: "",
  });

  const fetchMembers = async () => {
    if (!organizationId) return;
    
    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (!profiles) { setLoading(false); return; }

    const membersList: TeamMember[] = [];

    for (const profile of profiles) {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", profile.user_id);

      const isMember = roles?.some(r => r.role === "member");
      if (!isMember) continue;

      const { data: settings } = await supabase
        .from("member_settings")
        .select("folder_name, price_per_video")
        .eq("user_id", profile.user_id)
        .eq("organization_id", organizationId)
        .single();

      const { data: files } = await supabase
        .from("files")
        .select("status")
        .eq("user_id", profile.user_id);

      const approved = files?.filter(f => f.status === "approved").length ?? 0;
      const price = settings?.price_per_video ?? 0;

      membersList.push({
        id: profile.id,
        user_id: profile.user_id,
        display_name: profile.display_name,
        email: profile.email,
        account_status: profile.account_status,
        member_settings: settings ? {
          folder_name: settings.folder_name,
          price_per_video: Number(settings.price_per_video),
        } : undefined,
        file_stats: {
          total: files?.length ?? 0,
          approved,
          rejected: files?.filter(f => f.status === "rejected").length ?? 0,
          earnings: approved * Number(price),
        },
      });
    }

    setMembers(membersList);
    setLoading(false);
  };

  useEffect(() => { fetchMembers(); }, [organizationId]);

  const handleCreate = async () => {
    if (form.password.length < 12) {
      toast.error("كلمة المرور يجب أن تكون 12 حرف على الأقل");
      return;
    }
    if (!form.display_name || !form.email) {
      toast.error("جميع الحقول مطلوبة");
      return;
    }
    setCreating(true);

    const { data, error } = await supabase.functions.invoke("create-member", {
      body: {
        email: form.email,
        password: form.password,
        display_name: form.display_name,
        folder_name: form.folder_name || "uploads",
        price_per_video: parseFloat(form.price_per_video) || 0,
      },
    });

    if (error || data?.error) {
      toast.error(data?.error || error?.message || "فشل إنشاء العضو");
    } else {
      toast.success("تم إنشاء العضو بنجاح!");
      setDialogOpen(false);
      setForm({ display_name: "", email: "", password: "", folder_name: "", price_per_video: "" });
      fetchMembers();
    }
    setCreating(false);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6" dir="rtl">
      <div className="text-center space-y-3 pb-4 border-b border-border">
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground" style={{ fontFamily: "'DM Sans', sans-serif", letterSpacing: '-0.02em' }}>إدارة الفريق</h1>
          <p className="text-sm text-muted-foreground">إضافة وإدارة أعضاء الفريق</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="ml-2 h-4 w-4" />إضافة عضو جديد</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-foreground">إضافة عضو فريق جديد</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>الاسم</Label>
                <Input value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} placeholder="محمد أحمد" />
              </div>
              <div className="space-y-2">
                <Label>البريد الإلكتروني</Label>
                <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="member@gmail.com" type="email" dir="ltr" className="text-left" />
              </div>
              <div className="space-y-2">
                <Label>كلمة المرور (12 حرف على الأقل)</Label>
                <div className="relative">
                  <Input
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••••••"
                    dir="ltr" className="text-left pr-10"
                    minLength={12}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1"><FolderOpen className="h-3 w-3" /> اسم المجلد</Label>
                  <Input value={form.folder_name} onChange={e => setForm(f => ({ ...f, folder_name: e.target.value }))} placeholder="uploads" dir="ltr" className="text-left" />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1"><DollarSign className="h-3 w-3" /> سعر الفيديو</Label>
                  <Input value={form.price_per_video} onChange={e => setForm(f => ({ ...f, price_per_video: e.target.value }))} placeholder="250" type="number" dir="ltr" className="text-left" />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                إنشاء العضو
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : members.length === 0 ? (
          <div className="glass-panel p-8 text-center">
            <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">لا يوجد أعضاء بعد</p>
          </div>
        ) : (
          members.map(member => (
            <div key={member.id} className="glass-panel p-5 animate-slide-in">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{member.display_name}</p>
                    <p className="text-xs text-muted-foreground" dir="ltr">{member.email}</p>
                  </div>
                </div>
                <span className="status-approved"><CheckCircle className="h-3 w-3" /> نشط</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <button
                  onClick={() => navigate(`/files?member=${member.user_id}`)}
                  className="rounded-lg bg-secondary/50 p-3 text-center hover:bg-secondary/80 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                    <FolderOpen className="h-3 w-3" />
                    <span className="text-[10px] uppercase tracking-wider">المجلد</span>
                  </div>
                  <p className="text-xs font-medium text-primary underline" dir="ltr">{member.member_settings?.folder_name ?? "-"}</p>
                </button>
                <div className="rounded-lg bg-secondary/50 p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                    <FileStack className="h-3 w-3" />
                    <span className="text-[10px] uppercase tracking-wider">المحتوى</span>
                  </div>
                  <p className="text-sm font-bold text-foreground">{member.file_stats?.total ?? 0}</p>
                </div>
                <div className="rounded-lg bg-success/10 p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-success mb-1">
                    <CheckCircle className="h-3 w-3" />
                    <span className="text-[10px] uppercase tracking-wider">موافق عليها</span>
                  </div>
                  <p className="text-sm font-bold text-success">{member.file_stats?.approved ?? 0}</p>
                </div>
                <div className="rounded-lg bg-primary/10 p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-primary mb-1">
                    <DollarSign className="h-3 w-3" />
                    <span className="text-[10px] uppercase tracking-wider">الأرباح</span>
                  </div>
                  <p className="text-sm font-bold text-primary">{member.file_stats?.earnings?.toLocaleString()} جنيه</p>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  سعر الفيديو: <span className="text-foreground font-medium">{member.member_settings?.price_per_video ?? 0} جنيه</span>
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
