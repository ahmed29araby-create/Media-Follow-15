import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  BarChart3, TrendingUp, DollarSign, Building2, Loader2,
  CalendarDays, CreditCard, Gift, CheckCircle, XCircle, CalendarIcon,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval } from "date-fns";
import { ar } from "date-fns/locale";
import { cn } from "@/lib/utils";

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

interface PaymentRecord {
  id: string;
  organization_id: string;
  user_id: string;
  months: number;
  amount: number;
  status: string;
  created_at: string;
}

interface OrgInfo {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

type PeriodType = "year" | "month" | "week" | "day";

const MONTHS_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

export default function FinancialReportsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [orgs, setOrgs] = useState<Record<string, OrgInfo>>({});
  const [loading, setLoading] = useState(true);

  const [periodType, setPeriodType] = useState<PeriodType>("year");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [expandedCard, setExpandedCard] = useState<"subscribed" | "expired" | "revenue" | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const [subRes, orgRes, payRes] = await Promise.all([
        supabase.from("subscriptions").select("*").order("created_at", { ascending: false }),
        supabase.from("organizations").select("id, name, is_active, created_at"),
        supabase.from("subscription_payments").select("*").order("created_at", { ascending: false }),
      ]);
      setSubscriptions((subRes.data ?? []) as Subscription[]);
      setPayments((payRes.data ?? []) as PaymentRecord[]);
      const orgMap: Record<string, OrgInfo> = {};
      (orgRes.data ?? []).forEach((o: any) => { orgMap[o.id] = o; });
      setOrgs(orgMap);
      setLoading(false);
    };
    fetchData();
  }, []);

  // Calculate date range based on period type and selected date
  const dateRange = useMemo(() => {
    const d = selectedDate;
    switch (periodType) {
      case "day":
        return { start: startOfDay(d), end: endOfDay(d) };
      case "week":
        return { start: startOfWeek(d, { weekStartsOn: 6 }), end: endOfWeek(d, { weekStartsOn: 6 }) };
      case "month":
        return { start: startOfMonth(d), end: endOfMonth(d) };
      case "year":
      default:
        return { start: startOfYear(d), end: endOfYear(d) };
    }
  }, [periodType, selectedDate]);

  // Filter subscriptions by date range
  const filteredSubs = useMemo(() => {
    return subscriptions.filter(s => {
      const d = new Date(s.created_at);
      return d >= dateRange.start && d <= dateRange.end;
    });
  }, [subscriptions, dateRange]);

  // Filter payments by date range
  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      const d = new Date(p.created_at);
      return d >= dateRange.start && d <= dateRange.end;
    });
  }, [payments, dateRange]);

  // Get unique org subs in this period (latest per org)
  const uniqueOrgSubsInPeriod = useMemo(() => {
    const map: Record<string, Subscription> = {};
    for (const s of filteredSubs) {
      if (!map[s.organization_id] || new Date(s.created_at) > new Date(map[s.organization_id].created_at)) {
        map[s.organization_id] = s;
      }
    }
    return map;
  }, [filteredSubs]);

  // Stats
  const now = new Date();
  const totalOrgs = Object.keys(orgs).length;

  // Latest sub per org (all time) for active status
  const latestSubPerOrg = useMemo(() => {
    const map: Record<string, Subscription> = {};
    for (const s of subscriptions) {
      if (!map[s.organization_id] || new Date(s.created_at) > new Date(map[s.organization_id].created_at)) {
        map[s.organization_id] = s;
      }
    }
    return map;
  }, [subscriptions]);

  const activeSubs = Object.values(latestSubPerOrg).filter(s => new Date(s.ends_at) > now).length;
  const freeActiveOrgs = Object.values(latestSubPerOrg).filter(s => s.payment_method === "free_grant" && new Date(s.ends_at) > now).length;

  // Revenue from approved payments (vodafone cash)
  const approvedPayments = filteredPayments.filter(p => p.status === "approved");
  const paidRevenue = approvedPayments.reduce((sum, p) => sum + Number(p.amount), 0);

  // Total revenue = approved payments amount + free grants (0)
  const totalRevenue = paidRevenue;

  // New subs in period (unique orgs that got a subscription)
  const subscribedOrgsInPeriod = useMemo(() => {
    return Object.values(uniqueOrgSubsInPeriod).map(s => ({
      sub: s,
      org: orgs[s.organization_id],
    }));
  }, [uniqueOrgSubsInPeriod, orgs]);
  const newSubsCount = subscribedOrgsInPeriod.length;

  // Expired subs in period — subs whose ends_at falls in this period
  const expiredOrgsInPeriod = useMemo(() => {
    const seen = new Set<string>();
    const results: { sub: Subscription; org: OrgInfo | undefined }[] = [];
    for (const s of subscriptions) {
      const endDate = new Date(s.ends_at);
      if (endDate >= dateRange.start && endDate <= dateRange.end && endDate <= now && !seen.has(s.organization_id)) {
        seen.add(s.organization_id);
        results.push({ sub: s, org: orgs[s.organization_id] });
      }
    }
    return results;
  }, [subscriptions, dateRange, now, orgs]);
  const expiredInPeriod = expiredOrgsInPeriod.length;

  // Chart data based on period type
  const chartData = useMemo(() => {
    switch (periodType) {
      case "day": {
        // Show hours
        const hours = Array.from({ length: 24 }, (_, i) => {
          const hourSubs = filteredSubs.filter(s => new Date(s.created_at).getHours() === i);
          const hourPayments = approvedPayments.filter(p => new Date(p.created_at).getHours() === i);
          return {
            name: `${i}:00`,
            revenue: hourPayments.reduce((sum, p) => sum + Number(p.amount), 0),
            count: new Set(hourSubs.map(s => s.organization_id)).size,
          };
        });
        return hours;
      }
      case "week": {
        const days = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
        return days.map(day => {
          const dayStart = startOfDay(day);
          const dayEnd = endOfDay(day);
          const daySubs = filteredSubs.filter(s => { const d = new Date(s.created_at); return d >= dayStart && d <= dayEnd; });
          const dayPayments = approvedPayments.filter(p => { const d = new Date(p.created_at); return d >= dayStart && d <= dayEnd; });
          return {
            name: format(day, "EEE d", { locale: ar }),
            revenue: dayPayments.reduce((sum, p) => sum + Number(p.amount), 0),
            count: new Set(daySubs.map(s => s.organization_id)).size,
          };
        });
      }
      case "month": {
        const days = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
        return days.map(day => {
          const dayStart = startOfDay(day);
          const dayEnd = endOfDay(day);
          const daySubs = filteredSubs.filter(s => { const d = new Date(s.created_at); return d >= dayStart && d <= dayEnd; });
          const dayPayments = approvedPayments.filter(p => { const d = new Date(p.created_at); return d >= dayStart && d <= dayEnd; });
          return {
            name: `${day.getDate()}`,
            revenue: dayPayments.reduce((sum, p) => sum + Number(p.amount), 0),
            count: new Set(daySubs.map(s => s.organization_id)).size,
          };
        });
      }
      case "year":
      default:
        return MONTHS_AR.map((monthName, i) => {
          const monthSubs = filteredSubs.filter(s => new Date(s.created_at).getMonth() === i);
          const monthPayments = approvedPayments.filter(p => new Date(p.created_at).getMonth() === i);
          return {
            name: monthName,
            revenue: monthPayments.reduce((sum, p) => sum + Number(p.amount), 0),
            count: new Set(monthSubs.map(s => s.organization_id)).size,
          };
        });
    }
  }, [periodType, filteredSubs, approvedPayments, dateRange]);

  // Pie chart — unique orgs by payment method (in period)
  const pieData = useMemo(() => {
    const paidOrgs = new Set<string>();
    const freeOrgs = new Set<string>();
    for (const s of Object.values(uniqueOrgSubsInPeriod)) {
      if (s.payment_method === "free_grant") freeOrgs.add(s.organization_id);
      else paidOrgs.add(s.organization_id);
    }
    return [
      { name: "فودافون كاش", value: paidOrgs.size, color: "hsl(var(--primary))" },
      { name: "مجاني (من المالك)", value: freeOrgs.size, color: "hsl(var(--muted-foreground))" },
    ].filter(d => d.value > 0);
  }, [uniqueOrgSubsInPeriod]);

  // Recent subs — latest per org in period
  const recentSubs = useMemo(() => {
    return Object.values(uniqueOrgSubsInPeriod)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10);
  }, [uniqueOrgSubsInPeriod]);

  const formatDateStr = (d: string) =>
    new Date(d).toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" });

  const formatCurrency = (n: number) => `${n.toLocaleString("ar-EG")} جنيه`;

  const getPeriodLabel = () => {
    switch (periodType) {
      case "day": return format(selectedDate, "d MMMM yyyy", { locale: ar });
      case "week": return `${format(dateRange.start, "d MMM", { locale: ar })} — ${format(dateRange.end, "d MMM yyyy", { locale: ar })}`;
      case "month": return format(selectedDate, "MMMM yyyy", { locale: ar });
      case "year": return format(selectedDate, "yyyy");
    }
  };

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
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            <BarChart3 className="h-8 w-8 text-primary" />
            التقارير المالية
          </h1>
          <p className="text-sm text-muted-foreground">تحليل الإيرادات والاشتراكات</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={periodType} onValueChange={(v) => setPeriodType(v as PeriodType)}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="year">سنة</SelectItem>
              <SelectItem value="month">شهر</SelectItem>
              <SelectItem value="week">أسبوع</SelectItem>
              <SelectItem value="day">يوم</SelectItem>
            </SelectContent>
          </Select>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-auto justify-start text-right font-normal gap-2")}>
                <CalendarIcon className="h-4 w-4" />
                {getPeriodLabel()}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => { if (d) { setSelectedDate(d); setCalendarOpen(false); } }}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">إجمالي الإيرادات</CardTitle>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <DollarSign className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{formatCurrency(totalRevenue)}</div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">اشتراكات نشطة</CardTitle>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{activeSubs}</div>
            <p className="text-xs text-muted-foreground mt-1">من أصل {totalOrgs} شركة</p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
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

      {/* Period Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card
          className={cn("border-border/50 cursor-pointer transition-all hover:border-primary/50", expandedCard === "subscribed" && "border-primary ring-1 ring-primary/20")}
          onClick={() => setExpandedCard(expandedCard === "subscribed" ? null : "subscribed")}
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <CheckCircle className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{newSubsCount}</p>
                <p className="text-xs text-muted-foreground">شركة اشتركت في هذه الفترة</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={cn("border-border/50 cursor-pointer transition-all hover:border-destructive/50", expandedCard === "expired" && "border-destructive ring-1 ring-destructive/20")}
          onClick={() => setExpandedCard(expandedCard === "expired" ? null : "expired")}
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                <XCircle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{expiredInPeriod}</p>
                <p className="text-xs text-muted-foreground">شركة انتهى اشتراكها في هذه الفترة</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={cn("border-border/50 cursor-pointer transition-all hover:border-accent-foreground/30", expandedCard === "revenue" && "border-accent-foreground/50 ring-1 ring-accent-foreground/10")}
          onClick={() => setExpandedCard(expandedCard === "revenue" ? null : "revenue")}
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
                <DollarSign className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(totalRevenue)}</p>
                <p className="text-xs text-muted-foreground">إجمالي الإيرادات في هذه الفترة</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Expanded Detail Panel */}
      {expandedCard === "subscribed" && (
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-primary" />
              الشركات اللي اشتركت في هذه الفترة ({newSubsCount})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {subscribedOrgsInPeriod.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">لا توجد شركات اشتركت في هذه الفترة</p>
            ) : (
              <div className="space-y-2">
                {subscribedOrgsInPeriod.map(({ sub, org }) => (
                  <div key={sub.id} className="flex items-center justify-between p-3 rounded-lg border border-border/30">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${sub.payment_method === "free_grant" ? "bg-accent" : "bg-primary/10"}`}>
                        {sub.payment_method === "free_grant" ? <Gift className="h-4 w-4 text-muted-foreground" /> : <Building2 className="h-4 w-4 text-primary" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{org?.name || "شركة"}</p>
                        <p className="text-xs text-muted-foreground">
                          {sub.months} شهر — {sub.payment_method === "free_grant" ? "مجاني" : "فودافون كاش"} — {formatDateStr(sub.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground">{Number(sub.amount) > 0 ? formatCurrency(Number(sub.amount)) : "مجاني"}</span>
                      {new Date(sub.ends_at) > now ? (
                        <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px]">نشط</Badge>
                      ) : (
                        <Badge className="bg-destructive/15 text-destructive border-destructive/30 text-[10px]">منتهي</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {expandedCard === "expired" && (
        <Card className="border-destructive/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <XCircle className="h-4 w-4 text-destructive" />
              الشركات اللي انتهى اشتراكها في هذه الفترة ({expiredInPeriod})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {expiredOrgsInPeriod.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">لا توجد شركات انتهى اشتراكها في هذه الفترة</p>
            ) : (
              <div className="space-y-2">
                {expiredOrgsInPeriod.map(({ sub, org }) => (
                  <div key={sub.id} className="flex items-center justify-between p-3 rounded-lg border border-border/30">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10">
                        <XCircle className="h-4 w-4 text-destructive" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{org?.name || "شركة"}</p>
                        <p className="text-xs text-muted-foreground">
                          انتهى في {formatDateStr(sub.ends_at)} — {sub.months} شهر — {sub.payment_method === "free_grant" ? "مجاني" : "فودافون كاش"}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-foreground">{Number(sub.amount) > 0 ? formatCurrency(Number(sub.amount)) : "مجاني"}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {expandedCard === "revenue" && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              تفاصيل الإيرادات في هذه الفترة
            </CardTitle>
          </CardHeader>
          <CardContent>
            {approvedPayments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">لا توجد إيرادات مؤكدة في هذه الفترة</p>
            ) : (
              <div className="space-y-2">
                {approvedPayments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border border-border/30">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                        <CreditCard className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{orgs[p.organization_id]?.name || "شركة"}</p>
                        <p className="text-xs text-muted-foreground">{p.months} شهر — {formatDateStr(p.created_at)}</p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-foreground">{formatCurrency(Number(p.amount))}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20 mt-2">
                  <p className="text-sm font-bold text-foreground">الإجمالي</p>
                  <p className="text-sm font-bold text-primary">{formatCurrency(totalRevenue)}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="border-border/50 lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              الإيرادات — {getPeriodLabel()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
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
                    formatter={(value: number, name: string) => {
                      if (name === "revenue") return [`${value} جنيه`, "الإيرادات"];
                      return [`${value} شركة`, "الاشتراكات"];
                    }}
                  />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
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
                    <Tooltip formatter={(value: number) => [`${value} شركة`]} />
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

      {/* Recent Subscriptions */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" />
            آخر الاشتراكات — {getPeriodLabel()}
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
                          {s.months} شهر — {formatDateStr(s.starts_at)} → {formatDateStr(s.ends_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-foreground">{Number(s.amount) > 0 ? formatCurrency(Number(s.amount)) : "مجاني"}</span>
                      {isActive ? (
                        <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px]">نشط</Badge>
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
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            ملخص حسب الشركة
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Object.values(orgs).map((org) => {
              const latestSub = latestSubPerOrg[org.id];
              const isActive = latestSub ? new Date(latestSub.ends_at) > now : false;
              const orgPayments = payments.filter(p => p.organization_id === org.id && p.status === "approved");
              const orgRevenue = orgPayments.reduce((sum, p) => sum + Number(p.amount), 0);

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
                          <CheckCircle className="h-3.5 w-3.5 text-primary" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-destructive" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {latestSub ? `${latestSub.months} شهر — ${latestSub.payment_method === "free_grant" ? "مجاني" : "فودافون كاش"}` : "بدون اشتراك"}
                      </p>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-foreground">{formatCurrency(orgRevenue)}</p>
                    {latestSub && (
                      <p className="text-[10px] text-muted-foreground">
                        ينتهي: {formatDateStr(latestSub.ends_at)}
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
