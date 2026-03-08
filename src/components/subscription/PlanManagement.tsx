import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PLANS, type Plan } from "./PlanCards";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  ChevronDown, ChevronUp, Pencil, Save, X, Users, CheckCircle,
  TrendingUp, TrendingDown, Percent, DollarSign, Settings2, Eye, EyeOff,
} from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

interface PlanPriceOverride {
  [planId: number]: number;
}

export default function PlanManagement() {
  const [expanded, setExpanded] = useState(false);
  const [prices, setPrices] = useState<PlanPriceOverride>({});
  const [hiddenPlans, setHiddenPlans] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<number | null>(null);
  const [editPrice, setEditPrice] = useState("");

  // Bulk action dialog
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkType, setBulkType] = useState<"increase" | "discount">("increase");
  const [bulkMode, setBulkMode] = useState<"percentage" | "fixed">("percentage");
  const [bulkValue, setBulkValue] = useState("");
  const [bulkTarget, setBulkTarget] = useState<"all" | number>("all");

  useEffect(() => {
    loadPrices();
  }, []);

  const loadPrices = async () => {
    const { data } = await supabase
      .from("admin_settings")
      .select("setting_value")
      .eq("setting_key", "plan_prices")
      .is("organization_id", null)
      .maybeSingle();
    if (data) {
      try {
        setPrices(JSON.parse(data.setting_value));
      } catch {}
    }
  };

  const getPrice = (plan: Plan) => prices[plan.id] ?? plan.price;

  const savePrices = async (newPrices: PlanPriceOverride) => {
    setSaving(true);
    const value = JSON.stringify(newPrices);

    // Check if exists
    const { data: existing } = await supabase
      .from("admin_settings")
      .select("id")
      .eq("setting_key", "plan_prices")
      .is("organization_id", null)
      .maybeSingle();

    let error;
    if (existing) {
      ({ error } = await supabase
        .from("admin_settings")
        .update({ setting_value: value })
        .eq("id", existing.id));
    } else {
      ({ error } = await supabase
        .from("admin_settings")
        .insert({ setting_key: "plan_prices", setting_value: value, organization_id: null }));
    }

    if (error) {
      toast.error("حدث خطأ أثناء الحفظ");
    } else {
      setPrices(newPrices);
      toast.success("تم حفظ الأسعار بنجاح");
    }
    setSaving(false);
  };

  const handleSaveIndividual = () => {
    if (editingPlanId === null) return;
    const val = parseFloat(editPrice);
    if (isNaN(val) || val <= 0) {
      toast.error("أدخل سعر صحيح");
      return;
    }
    const newPrices = { ...prices, [editingPlanId]: Math.round(val) };
    savePrices(newPrices);
    setEditingPlanId(null);
    setEditPrice("");
  };

  const handleBulkApply = () => {
    const val = parseFloat(bulkValue);
    if (isNaN(val) || val <= 0) {
      toast.error("أدخل قيمة صحيحة");
      return;
    }

    const newPrices = { ...prices };
    const targetPlans = bulkTarget === "all" ? PLANS : PLANS.filter(p => p.id === bulkTarget);

    for (const plan of targetPlans) {
      const currentPrice = getPrice(plan);
      let newPrice: number;

      if (bulkMode === "percentage") {
        if (bulkType === "increase") {
          newPrice = currentPrice * (1 + val / 100);
        } else {
          newPrice = currentPrice * (1 - val / 100);
        }
      } else {
        if (bulkType === "increase") {
          newPrice = currentPrice + val;
        } else {
          newPrice = currentPrice - val;
        }
      }

      newPrices[plan.id] = Math.max(0, Math.round(newPrice));
    }

    savePrices(newPrices);
    setBulkOpen(false);
    setBulkValue("");
  };

  const handleResetAll = () => {
    savePrices({});
  };

  return (
    <div className="space-y-3">
      <Button
        variant="outline"
        className="w-full justify-between gap-2 text-sm font-bold"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-primary" />
          إدارة باقات الاشتراك
        </span>
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </Button>

      {expanded && (
        <div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
          {/* Bulk actions */}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs"
              onClick={() => { setBulkType("increase"); setBulkTarget("all"); setBulkOpen(true); }}
            >
              <TrendingUp className="h-3.5 w-3.5 text-destructive" />
              زيادة سعر جميع الباقات
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs"
              onClick={() => { setBulkType("discount"); setBulkTarget("all"); setBulkOpen(true); }}
            >
              <TrendingDown className="h-3.5 w-3.5 text-success" />
              خصم على جميع الباقات
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5 text-xs text-muted-foreground"
              onClick={handleResetAll}
            >
              <X className="h-3.5 w-3.5" />
              إعادة الأسعار الافتراضية
            </Button>
          </div>

          {/* Plan cards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {PLANS.map((plan) => {
              const currentPrice = getPrice(plan);
              const isEditing = editingPlanId === plan.id;
              const isChanged = prices[plan.id] !== undefined && prices[plan.id] !== plan.price;

              return (
                <Card
                  key={plan.id}
                  className={cn(
                    "relative overflow-hidden border-border/50 transition-all",
                    isChanged && "border-primary/40"
                  )}
                >
                  {plan.popular && (
                    <div className="absolute top-0 left-0 right-0 bg-primary text-primary-foreground text-center text-[10px] font-bold py-0.5">
                      الأكثر طلباً
                    </div>
                  )}
                  <CardHeader className={cn("pb-1 pt-3", plan.popular && "pt-6")}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-primary">{plan.icon}</span>
                        <CardTitle className="text-xs font-bold">{plan.name}</CardTitle>
                      </div>
                      {isChanged && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 text-primary border-primary/30">
                          معدّل
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 pb-3">
                    {isEditing ? (
                      <div className="space-y-2">
                        <Input
                          type="number"
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          className="text-center text-lg font-bold h-9"
                          autoFocus
                          onKeyDown={(e) => { if (e.key === "Enter") handleSaveIndividual(); if (e.key === "Escape") setEditingPlanId(null); }}
                        />
                        <div className="flex gap-1">
                          <Button size="sm" className="flex-1 h-7 text-xs gap-1" onClick={handleSaveIndividual} disabled={saving}>
                            <Save className="h-3 w-3" />
                            حفظ
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingPlanId(null)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-black text-primary">{currentPrice.toLocaleString()}</span>
                          <span className="text-[10px] text-muted-foreground">جنيه / شهر</span>
                        </div>

                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3 text-muted-foreground" />
                          <span className="text-[10px] text-muted-foreground">
                            {plan.maxMembers === null ? "غير محدود" : `حتى ${plan.maxMembers} عضو`}
                          </span>
                        </div>

                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 h-7 text-[10px] gap-1"
                            onClick={() => { setEditingPlanId(plan.id); setEditPrice(String(currentPrice)); }}
                          >
                            <Pencil className="h-3 w-3" />
                            تعديل السعر
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-[10px] gap-1"
                            onClick={() => { setBulkTarget(plan.id); setBulkType("increase"); setBulkOpen(true); }}
                          >
                            <TrendingUp className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-[10px] gap-1"
                            onClick={() => { setBulkTarget(plan.id); setBulkType("discount"); setBulkOpen(true); }}
                          >
                            <TrendingDown className="h-3 w-3" />
                          </Button>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Bulk action dialog */}
      <Dialog open={bulkOpen} onOpenChange={(open) => { if (!open) { setBulkOpen(false); setBulkValue(""); } }}>
        <DialogContent className="bg-card border-border max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              {bulkType === "increase" ? (
                <TrendingUp className="h-5 w-5 text-destructive" />
              ) : (
                <TrendingDown className="h-5 w-5 text-success" />
              )}
              {bulkType === "increase" ? "زيادة السعر" : "خصم"}
              {bulkTarget === "all" ? " — جميع الباقات" : ` — ${PLANS.find(p => p.id === bulkTarget)?.name}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>نوع التعديل</Label>
              <RadioGroup
                value={bulkMode}
                onValueChange={(v) => setBulkMode(v as "percentage" | "fixed")}
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="percentage" id="pct" />
                  <Label htmlFor="pct" className="flex items-center gap-1 cursor-pointer">
                    <Percent className="h-3.5 w-3.5" />
                    نسبة مئوية
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="fixed" id="fixed" />
                  <Label htmlFor="fixed" className="flex items-center gap-1 cursor-pointer">
                    <DollarSign className="h-3.5 w-3.5" />
                    مبلغ ثابت
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label>
                {bulkType === "increase" ? "قيمة الزيادة" : "قيمة الخصم"}
                {bulkMode === "percentage" ? " (%)" : " (جنيه)"}
              </Label>
              <Input
                type="number"
                value={bulkValue}
                onChange={(e) => setBulkValue(e.target.value)}
                placeholder={bulkMode === "percentage" ? "مثال: 20" : "مثال: 200"}
                onKeyDown={(e) => { if (e.key === "Enter" && bulkValue) handleBulkApply(); }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setBulkOpen(false); setBulkValue(""); }}>
              إلغاء
            </Button>
            <Button onClick={handleBulkApply} disabled={!bulkValue || saving}>
              {bulkType === "increase" ? "تطبيق الزيادة" : "تطبيق الخصم"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
