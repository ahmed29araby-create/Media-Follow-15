import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  BarChart3, TrendingUp, DollarSign, Building2, Loader2,
  CalendarDays, CreditCard, Gift, CheckCircle, XCircle, Clock,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

interface Subscription {
  id: string;
  organization_id: string;
  starts_at: string;
  ends_at: string;
  months: number;
  amount: number;
  payment_method: string;
  notes: string | null;
  created_at: string;
  granted_by: string | null;
}

interface OrgInfo {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

const MONTHS_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

export default function FinancialReportsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [orgs, setOrgs] = useState<Record<string, OrgInfo>>({});
  const [loading, setLoading] = useState(true);
  const [yearFilter, setYearFilter] = useState(String(new Date().getFullYear()));

  useEffect(() => {
    const fetchData = async () => {
      const [subRes, orgRes] = await Promise.all([
        supabase.from("subscriptions").select("*").order("created_at", { ascending: false }),
        supabase.from("organizations").select("id, name, is_active, created_at"),
      ]);
      setSubscriptions((subRes.data ?? []) as Subscription[]);
      const orgMap: Record<string, OrgInfo> = {};
      (orgRes.data ?? []).forEach((o: any) => { orgMap[o.id] = o; });
      setOrgs(orgMap);
      setLoading(false);
    };
    fetchData();
  }, []);

  // Filter by year
  const filteredSubs = subscriptions.filter(s => new Date(s.created_at).getFullYear() === parseInt(yearFilter));
  const availableYears = [...new Set(subscriptions.map(s => new Date(s.created_at).getFullYear()))].sort((a, b) => b - a);
  if (availableYears.length === 0) availableYears.push(new Date().getFullYear());

  // Stats
  const totalRevenue = filteredSubs.reduce((sum, s) => sum + Number(s.amount), 0);
  const paidSubs = filteredSubs.filter(s => s.payment_method === "vodafone_cash");
  const freeSubs = filteredSubs.filter(s => s.payment_method === "free_grant");
  const paidRevenue = paidSubs.reduce((sum, s) => sum + Number(s.amount), 0);
  const totalOrgs = Object.keys(orgs).length;

  // Active subscriptions — count unique orgs with active subscription (latest per org)
  const now = new Date();
  const latestSubPerOrg: Record<string, Subscription> = {};
  for (const s of subscriptions) {
    if (!latestSubPerOrg[s.organization_id] || new Date(s.created_at) > new Date(latestSubPerOrg[s.organization_id].created_at)) {
      latestSubPerOrg[s.organization_id] = s;
    }
  }
  const activeOrgIds = Object.entries(latestSubPerOrg).filter(([_, s]) => new Date(s.ends_at) > now).map(([id]) => id);
  const activeSubs = activeOrgIds.length;

  // Free grant orgs — unique orgs whose latest subscription is free_grant AND still active
  const freeActiveOrgs = Object.entries(latestSubPerOrg).filter(([_, s]) => s.payment_method === "free_grant" && new Date(s.ends_at) > now).length;

  // Monthly revenue chart data
  const monthlyData = MONTHS_AR.map((name, i) => {
    const monthSubs = filteredSubs.filter(s => new Date(s.created_at).getMonth() === i);
    const revenue = monthSubs.reduce((sum, s) => sum + Number(s.amount), 0);
    const count = monthSubs.length;
    return { name, revenue, count };
  });

  // Payment method pie chart
  const pieData = [
    { name: "فودافون كاش", value: paidSubs.length, color: "hsl(var(--primary))" },
    { name: "مجاني (من المالك)", value: freeSubs.length, color: "hsl(var(--muted-foreground))" },
  ].filter(d => d.value > 0);

  // Recent subscriptions — show only the latest per organization
  const uniqueOrgSubs: Subscription[] = [];
  const seenOrgs = new Set<string>();
  for (const s of filteredSubs) {
    if (!seenOrgs.has(s.organization_id)) {
      seenOrgs.add(s.organization_id);
      uniqueOrgSubs.push(s);
    }
  }
  const recentSubs = uniqueOrgSubs.slice(0, 10);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" });

  const formatCurrency = (n: number) => `${n.toLocaleString("ar-EG")} جنيه`;

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3" style={{ fontFamily: "'DM Sans', sans-serif", letterSpacing: '-0.02em' }}>
            <BarChart3 className="h-8 w-8 text-primary" />
            التقارير المالية
          </h1>
          <p className="text-sm text-muted-foreground">تحليل الإيرادات والاشتراكات</p>
        </div>
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {availableYears.map(y => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="glass-panel border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">إجمالي الإيرادات</CardTitle>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <DollarSign className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{formatCurrency(totalRevenue)}</div>
            <p className="text-xs text-muted-foreground mt-1">من {filteredSubs.length} اشتراك</p>
          </CardContent>
        </Card>

        <Card className="glass-panel border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">إيرادات فودافون كاش</CardTitle>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-success/10">
              <CreditCard className="h-4 w-4 text-success" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{formatCurrency(paidRevenue)}</div>
            <p className="text-xs text-muted-foreground mt-1">{paidSubs.length} عملية دفع</p>
          </CardContent>
        </Card>

        <Card className="glass-panel border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">اشتراكات نشطة</CardTitle>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-success/10">
              <TrendingUp className="h-4 w-4 text-success" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{activeSubs}</div>
            <p className="text-xs text-muted-foreground mt-1">من أصل {totalOrgs} شركة</p>
          </CardContent>
        </Card>

        <Card className="glass-panel border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">اشتراكات مجانية</CardTitle>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent">
              <Gift className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{freeActiveOrgs}</div>
            <p className="text-xs text-muted-foreground mt-1">من صاحب الموقع</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Revenue Chart */}
        <Card className="glass-panel border-border/50 lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              الإيرادات الشهرية — {yearFilter}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                      direction: "rtl",
                    }}
                    formatter={(value: number) => [`${value} جنيه`, "الإيرادات"]}
                  />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Payment Method Pie Chart */}
        <Card className="glass-panel border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground">طرق الدفع</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [`${value} اشتراك`]} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-muted-foreground">لا توجد بيانات</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Subscriptions Table */}
      <Card className="glass-panel border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" />
            آخر الاشتراكات
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentSubs.length === 0 ? (
            <div className="text-center py-8">
              <CreditCard className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">لا توجد اشتراكات في هذه الفترة</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentSubs.map((s) => {
                const isActive = new Date(s.ends_at) > now;
                const isFree = s.payment_method === "free_grant";
                return (
                  <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border border-border/30 hover:border-border/60 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${isFree ? "bg-accent" : "bg-primary/10"}`}>
                        {isFree ? <Gift className="h-4 w-4 text-muted-foreground" /> : <Building2 className="h-4 w-4 text-primary" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{orgs[s.organization_id]?.name || "شركة"}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.months} شهر — {formatDate(s.starts_at)} → {formatDate(s.ends_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-foreground">{Number(s.amount) > 0 ? formatCurrency(Number(s.amount)) : "مجاني"}</span>
                      {isActive ? (
                        <Badge className="bg-success/15 text-success border-success/30 text-[10px]">نشط</Badge>
                      ) : (
                        <Badge className="bg-destructive/15 text-destructive border-destructive/30 text-[10px]">منتهي</Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Per-Organization Breakdown */}
      <Card className="glass-panel border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            ملخص حسب الشركة
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Object.values(orgs).map((org) => {
              const orgSubs = filteredSubs.filter(s => s.organization_id === org.id);
              const orgRevenue = orgSubs.reduce((sum, s) => sum + Number(s.amount), 0);
              const latestSub = subscriptions.find(s => s.organization_id === org.id);
              const isActive = latestSub ? new Date(latestSub.ends_at) > now : false;

              return (
                <div key={org.id} className="flex items-center justify-between p-3 rounded-lg border border-border/30">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-foreground">{org.name}</p>
                        {isActive ? (
                          <CheckCircle className="h-3.5 w-3.5 text-success" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-destructive" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{orgSubs.length} اشتراك في {yearFilter}</p>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-foreground">{formatCurrency(orgRevenue)}</p>
                    {latestSub && (
                      <p className="text-[10px] text-muted-foreground">
                        آخر اشتراك: {formatDate(latestSub.ends_at)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
