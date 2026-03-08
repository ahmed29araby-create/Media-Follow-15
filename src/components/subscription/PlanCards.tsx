import { CheckCircle, Crown, Star, Zap, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface Plan {
  id: number;
  name: string;
  nameEn: string;
  price: number;
  maxMembers: number | null; // null = unlimited
  features: string[];
  popular?: boolean;
  icon: React.ReactNode;
}

export const PLANS: Plan[] = [
  {
    id: 1,
    name: "الأساسية",
    nameEn: "Basic",
    price: 400,
    maxMembers: 5,
    icon: <Zap className="h-5 w-5" />,
    features: [
      "إدارة كاملة للفريق والملفات",
      "رفع ومراجعة الملفات",
      "مزامنة مع Google Drive",
      "إشعارات فورية",
      "إضافة حتى 5 أعضاء",
    ],
  },
  {
    id: 2,
    name: "الأساسية بلس",
    nameEn: "Basic Plus",
    price: 600,
    maxMembers: 10,
    icon: <Zap className="h-5 w-5" />,
    features: [
      "إدارة كاملة للفريق والملفات",
      "رفع ومراجعة الملفات",
      "مزامنة مع Google Drive",
      "إشعارات فورية",
      "إضافة حتى 10 أعضاء",
    ],
  },
  {
    id: 3,
    name: "المعيارية",
    nameEn: "Standard",
    price: 800,
    maxMembers: 20,
    icon: <Star className="h-5 w-5" />,
    features: [
      "إدارة كاملة للفريق والملفات",
      "رفع ومراجعة الملفات",
      "مزامنة مع Google Drive",
      "إشعارات فورية",
      "إضافة حتى 20 عضو",
    ],
  },
  {
    id: 4,
    name: "المعيارية بلس",
    nameEn: "Standard Plus",
    price: 1000,
    maxMembers: 35,
    icon: <Star className="h-5 w-5" />,
    features: [
      "إدارة كاملة للفريق والملفات",
      "رفع ومراجعة الملفات",
      "مزامنة مع Google Drive",
      "إشعارات فورية",
      "إضافة حتى 35 عضو",
    ],
    popular: true,
  },
  {
    id: 5,
    name: "الاحترافية",
    nameEn: "Professional",
    price: 1500,
    maxMembers: 50,
    icon: <Crown className="h-5 w-5" />,
    features: [
      "إدارة كاملة للفريق والملفات",
      "رفع ومراجعة الملفات",
      "مزامنة مع Google Drive",
      "إشعارات فورية",
      "إضافة حتى 50 عضو",
      "دعم فني أولوية",
    ],
  },
  {
    id: 6,
    name: "الاحترافية بلس",
    nameEn: "Pro Plus",
    price: 2000,
    maxMembers: 75,
    icon: <Crown className="h-5 w-5" />,
    features: [
      "إدارة كاملة للفريق والملفات",
      "رفع ومراجعة الملفات",
      "مزامنة مع Google Drive",
      "إشعارات فورية",
      "إضافة حتى 75 عضو",
      "دعم فني أولوية",
    ],
  },
  {
    id: 7,
    name: "الأعمال",
    nameEn: "Business",
    price: 2500,
    maxMembers: 100,
    icon: <Users className="h-5 w-5" />,
    features: [
      "إدارة كاملة للفريق والملفات",
      "رفع ومراجعة الملفات",
      "مزامنة مع Google Drive",
      "إشعارات فورية",
      "إضافة حتى 100 عضو",
      "دعم فني أولوية",
      "تقارير متقدمة",
    ],
  },
  {
    id: 8,
    name: "الأعمال بلس",
    nameEn: "Business Plus",
    price: 3000,
    maxMembers: 150,
    icon: <Users className="h-5 w-5" />,
    features: [
      "إدارة كاملة للفريق والملفات",
      "رفع ومراجعة الملفات",
      "مزامنة مع Google Drive",
      "إشعارات فورية",
      "إضافة حتى 150 عضو",
      "دعم فني أولوية",
      "تقارير متقدمة",
    ],
  },
  {
    id: 9,
    name: "المؤسسية",
    nameEn: "Enterprise",
    price: 4000,
    maxMembers: 200,
    icon: <Crown className="h-5 w-5" />,
    features: [
      "إدارة كاملة للفريق والملفات",
      "رفع ومراجعة الملفات",
      "مزامنة مع Google Drive",
      "إشعارات فورية",
      "إضافة حتى 200 عضو",
      "دعم فني أولوية",
      "تقارير متقدمة",
      "مدير حساب مخصص",
    ],
  },
  {
    id: 10,
    name: "المؤسسية بلس",
    nameEn: "Enterprise Plus",
    price: 5000,
    maxMembers: null,
    icon: <Crown className="h-5 w-5" />,
    features: [
      "إدارة كاملة للفريق والملفات",
      "رفع ومراجعة الملفات",
      "مزامنة مع Google Drive",
      "إشعارات فورية",
      "إضافة أعضاء غير محدود",
      "دعم فني أولوية",
      "تقارير متقدمة",
      "مدير حساب مخصص",
    ],
  },
];

interface PlanCardsProps {
  selectedPlanId: number | null;
  onSelectPlan: (plan: Plan) => void;
  hasPendingPayment: boolean;
  isAdmin: boolean;
}

export default function PlanCards({ selectedPlanId, onSelectPlan, hasPendingPayment, isAdmin }: PlanCardsProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-foreground">اختر الباقة المناسبة</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {PLANS.map((plan) => {
          const isSelected = selectedPlanId === plan.id;
          return (
            <Card
              key={plan.id}
              className={cn(
                "relative overflow-hidden transition-all duration-200 cursor-pointer hover:shadow-lg",
                "border-border/50",
                isSelected && "ring-2 ring-primary border-primary/50 shadow-lg",
                plan.popular && "border-primary/40"
              )}
              onClick={() => !hasPendingPayment && isAdmin && onSelectPlan(plan)}
            >
              {plan.popular && (
                <div className="absolute top-0 left-0 right-0 bg-primary text-primary-foreground text-center text-xs font-bold py-1">
                  الأكثر طلباً
                </div>
              )}
              <CardHeader className={cn("pb-2", plan.popular && "pt-8")}>
                <div className="flex items-center gap-2 text-primary">
                  {plan.icon}
                  <CardTitle className="text-sm font-bold">{plan.name}</CardTitle>
                </div>
                <p className="text-xs text-muted-foreground">{plan.nameEn}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-primary">{plan.price.toLocaleString()}</span>
                  <span className="text-xs text-muted-foreground">جنيه / شهر</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold text-foreground">
                    {plan.maxMembers === null ? "أعضاء غير محدود" : `حتى ${plan.maxMembers} عضو`}
                  </span>
                </div>

                <ul className="space-y-1.5 pt-1 border-t border-border/30">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <CheckCircle className="h-3.5 w-3.5 text-success shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                {isAdmin && !hasPendingPayment && (
                  <Button
                    size="sm"
                    className={cn(
                      "w-full mt-2",
                      isSelected ? "bg-primary" : "bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectPlan(plan);
                    }}
                  >
                    {isSelected ? "✓ تم الاختيار" : "اختر هذه الباقة"}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
