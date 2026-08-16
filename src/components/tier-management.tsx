import { useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Layers,
  LucideLoader,
  Lock,
  Unlock,
  Pencil,
  Save,
  ShieldAlert,
  X,
  Search,
  UserX,
  Plus,
  Beaker,
  Trash2,
  FlaskConical,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatKes } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  adminListAllTiers,
  adminToggleLockAllTiers,
  adminCreateTier,
  adminUpdateTier,
  adminDeleteTier,
  adminAddSandboxTestTier,
  adminDeleteSandboxTestTier,
  listAllUsers,
} from "@/lib/admin.functions";
import { useUrlStringState, useUrlBooleanState } from "@/lib/use-url-search-state";

type TierItem = {
  id: string;
  name: string;
  description: string;
  min_amount: number;
  max_amount: number;
  interest_rate: number;
  processing_fee_rate: number;
  penalty_rate?: number | null;
  custom_penalty_amount?: number | null;
  term_days: number;
  min_credibility: number;
  guarantors_required: number;
  sort_order: number;
  is_active: boolean;
  is_locked: boolean;
  is_test_tier?: boolean;
  locked_user_ids: string[];
};

export function TierManagement() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(adminListAllTiers);
  const createTierFn = useServerFn(adminCreateTier);
  const updateTierFn = useServerFn(adminUpdateTier);
  const deleteTierFn = useServerFn(adminDeleteTier);
  const lockAllFn = useServerFn(adminToggleLockAllTiers);
  const addSandboxTierFn = useServerFn(adminAddSandboxTestTier);
  const deleteSandboxTierFn = useServerFn(adminDeleteSandboxTestTier);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-tiers"],
    queryFn: () => listFn(),
  });

  const tiers = (data?.tiers ?? []) as TierItem[];

  const [editTierId, setEditTierId] = useUrlStringState("editTierId");
  const [isCreating, setIsCreating] = useUrlBooleanState("createTier");

  const editTier = tiers.find((t) => t.id === editTierId) ?? null;
  const setEditTier = (t: TierItem | null) => setEditTierId(t ? t.id : null);

  const invalidateTierQueries = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-tiers"] });
    void queryClient.invalidateQueries({ queryKey: ["loan-products"] });
    void queryClient.invalidateQueries({ queryKey: ["public-loan-products"] });
  };

  const createMutation = useMutation({
    mutationFn: (input: {
      name: string;
      description: string;
      minAmount: number;
      maxAmount: number;
      interestRate: number;
      processingFeeRate: number;
      penaltyRate?: number | null;
      customPenaltyAmount?: number | null;
      termDays: number;
      minCredibility: number;
      guarantorsRequired: number;
      isActive: boolean;
      isLocked: boolean;
      lockedUserIds: string[];
      isTestTier?: boolean;
    }) => createTierFn({ data: input }),
    onSuccess: () => {
      toast.success("Loan tier created successfully.");
      invalidateTierQueries();
      setIsCreating(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: (input: {
      tierId: string;
      name: string;
      description: string;
      minAmount: number;
      maxAmount: number;
      interestRate: number;
      processingFeeRate: number;
      penaltyRate?: number | null;
      customPenaltyAmount?: number | null;
      termDays: number;
      minCredibility: number;
      guarantorsRequired: number;
      isActive: boolean;
      isLocked: boolean;
      lockedUserIds: string[];
    }) => updateTierFn({ data: input }),
    onSuccess: () => {
      toast.success("Loan tier updated successfully.");
      invalidateTierQueries();
      setEditTier(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (tierId: string) => deleteTierFn({ data: { tierId } }),
    onSuccess: () => {
      toast.success("Loan tier deleted successfully.");
      invalidateTierQueries();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const addSandboxTierMutation = useMutation({
    mutationFn: () =>
      addSandboxTierFn({
        data: {
          name: "Sandbox Tier",
          description: "Small loan tier for M-Pesa sandbox testing (KES 1-10)",
          minAmount: 1,
          maxAmount: 10,
          interestRate: 0.01,
          processingFeeRate: 0,
          penaltyRate: 0.25,
          termDays: 1,
          minCredibility: 0,
          guarantorsRequired: 0,
        },
      }),
    onSuccess: () => {
      toast.success("Sandbox test tier added.");
      invalidateTierQueries();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteSandboxTierMutation = useMutation({
    mutationFn: (tierId: string) => deleteSandboxTierFn({ data: { tierId } }),
    onSuccess: () => {
      toast.success("Sandbox test tier removed.");
      invalidateTierQueries();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const lockAllMutation = useMutation({
    mutationFn: (allTiersLocked: boolean) => lockAllFn({ data: { allTiersLocked } }),
    onSuccess: () => {
      invalidateTierQueries();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const allTiersLocked = Boolean(data?.allTiersLocked);
  const environment = data?.environment ?? "production";
  const isSandbox = environment === "sandbox";
  const hasTestTier = tiers.some((t: any) => t.is_test_tier);

  return (
    <Card className="mt-6 border-border/70 shadow-soft">
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="size-4 text-primary" aria-hidden />
              Loan product tiers & credit requirements
            </CardTitle>
            {isSandbox ? (
              <Badge
                variant="outline"
                className="bg-gold/10 border-gold/30 gap-1 font-semibold text-xs"
              >
                <FlaskConical className="size-3.5" /> Sandbox
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 font-semibold text-xs"
              >
                Production
              </Badge>
            )}
          </div>
          <CardDescription>
            Configure credibility point requirements, interest rates, term lengths, penalty rules,
            or lock tiers for members.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" onClick={() => setIsCreating(true)} className="gap-1.5">
                <Plus className="size-4" /> Add Loan Tier
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Create a new borrowing tier with customized credit limits, interest, duration, and
              penalty fee rules
            </TooltipContent>
          </Tooltip>

          {isSandbox && !hasTestTier && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-gold/40 hover:bg-gold/10 gap-1.5"
                  disabled={addSandboxTierMutation.isPending}
                  onClick={() => addSandboxTierMutation.mutate()}
                >
                  {addSandboxTierMutation.isPending ? (
                    <LucideLoader className="size-4 animate-spin" />
                  ) : (
                    <Beaker className="size-4" />
                  )}
                  Add Sandbox Tier (KES 1–10)
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Quickly add a low-value test tier (KES 1–10) to safely simulate Daraja M-Pesa
                payouts in sandbox mode
              </TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={allTiersLocked ? "destructive" : "outline"}
                size="sm"
                disabled={lockAllMutation.isPending}
                onClick={() => lockAllMutation.mutate(!allTiersLocked)}
              >
                {allTiersLocked ? (
                  <>
                    <Lock className="size-4 mr-1.5" /> All Tiers Locked
                  </>
                ) : (
                  <>
                    <Unlock className="size-4 mr-1.5 text-primary" /> Lock All Tiers
                  </>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {allTiersLocked
                ? "Unlock all tiers to allow eligible borrowers to submit new loan applications"
                : "Lock all tiers globally to temporarily prevent any new loan applications across the platform"}
            </TooltipContent>
          </Tooltip>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <LucideLoader className="size-5 animate-spin text-primary" aria-label="Loading" />
          </div>
        ) : tiers.length === 0 ? (
          <div className="py-12 text-center border rounded-xl border-dashed bg-muted/10 space-y-3">
            <p className="text-sm font-medium text-muted-foreground">
              No loan product tiers configured.
            </p>
            <Button size="sm" onClick={() => setIsCreating(true)} className="gap-1.5">
              <Plus className="size-4" /> Create First Tier
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tier</TableHead>
                <TableHead>Range (KES)</TableHead>
                <TableHead>Interest Rate</TableHead>
                <TableHead>24h Default Penalty</TableHead>
                <TableHead>Term</TableHead>
                <TableHead>Min. Points</TableHead>
                <TableHead>Guarantors</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tiers.map((tier: any) => {
                const hasPenalty =
                  (tier.custom_penalty_amount !== null &&
                    tier.custom_penalty_amount !== undefined &&
                    Number(tier.custom_penalty_amount) > 0) ||
                  (tier.penalty_rate !== null &&
                    tier.penalty_rate !== undefined &&
                    Number(tier.penalty_rate) > 0);

                return (
                  <TableRow key={tier.id}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span>{tier.name}</span>
                          {tier.is_test_tier && (
                            <Badge
                              variant="outline"
                              className="bg-gold/15 border-gold/30 text-[10px] font-bold uppercase tracking-wider"
                            >
                              Sandbox Tier
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground line-clamp-1">
                          {tier.description || "—"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {formatKes(tier.min_amount)} – {formatKes(tier.max_amount)}
                    </TableCell>
                    <TableCell>{(tier.interest_rate * 100).toFixed(1)}%</TableCell>
                    <TableCell>
                      {!hasPenalty ? (
                        <Badge
                          variant="outline"
                          className="text-muted-foreground bg-muted/40 font-normal text-xs"
                        >
                          No penalty fee
                        </Badge>
                      ) : tier.custom_penalty_amount ? (
                        <span className="font-medium text-destructive">
                          {formatKes(tier.custom_penalty_amount)} / 24h
                        </span>
                      ) : (
                        <div className="flex flex-col">
                          <span className="font-medium text-destructive">
                            {(Number(tier.penalty_rate) * 100).toFixed(0)}% of interest
                          </span>
                          <span className="text-[10px] text-muted-foreground">per 24h overdue</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{tier.term_days} days</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-semibold text-primary">
                        {tier.min_credibility} pts
                      </Badge>
                    </TableCell>
                    <TableCell>{tier.guarantors_required}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {allTiersLocked ? (
                          <Badge variant="destructive" className="w-fit">
                            Locked (Global)
                          </Badge>
                        ) : tier.is_locked ? (
                          <Badge variant="destructive" className="w-fit">
                            Locked
                          </Badge>
                        ) : !tier.is_active ? (
                          <Badge variant="secondary" className="w-fit">
                            Inactive
                          </Badge>
                        ) : (
                          <Badge variant="default" className="w-fit bg-emerald-600">
                            Active
                          </Badge>
                        )}
                        {tier.locked_user_ids.length > 0 && (
                          <span className="text-[10px] text-muted-foreground">
                            {tier.locked_user_ids.length} restricted member(s)
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="icon" variant="ghost" onClick={() => setEditTier(tier)}>
                              <Pencil className="size-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            Edit parameters, interest rates, penalty rules, or member access
                            restrictions for this tier
                          </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-destructive hover:bg-destructive/10"
                              disabled={
                                deleteMutation.isPending || deleteSandboxTierMutation.isPending
                              }
                              onClick={() => {
                                if (
                                  confirm(`Are you sure you want to delete tier "${tier.name}"?`)
                                ) {
                                  if (tier.is_test_tier) {
                                    deleteSandboxTierMutation.mutate(tier.id);
                                  } else {
                                    deleteMutation.mutate(tier.id);
                                  }
                                }
                              }}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            Permanently delete this loan tier from the platform
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <TierDialog
        tier={editTier}
        isOpen={Boolean(editTier) || isCreating}
        isCreating={isCreating}
        pending={updateMutation.isPending || createMutation.isPending}
        onClose={() => {
          setEditTier(null);
          setIsCreating(false);
        }}
        onSave={(values) => {
          if (editTier) {
            updateMutation.mutate({
              tierId: editTier.id,
              ...values,
            });
          } else {
            createMutation.mutate(values);
          }
        }}
      />
    </Card>
  );
}

function TierDialog({
  tier,
  isOpen,
  isCreating,
  pending,
  onClose,
  onSave,
}: {
  tier: TierItem | null;
  isOpen: boolean;
  isCreating: boolean;
  pending: boolean;
  onClose: () => void;
  onSave: (values: {
    name: string;
    description: string;
    minAmount: number;
    maxAmount: number;
    interestRate: number;
    processingFeeRate: number;
    penaltyRate?: number | null;
    customPenaltyAmount?: number | null;
    termDays: number;
    minCredibility: number;
    guarantorsRequired: number;
    isActive: boolean;
    isLocked: boolean;
    lockedUserIds: string[];
    isTestTier?: boolean;
  }) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [minAmount, setMinAmount] = useState(500);
  const [maxAmount, setMaxAmount] = useState(5000);
  const [interestRatePct, setInterestRatePct] = useState(10);
  const [processingFeePct, setProcessingFeePct] = useState(2);
  const [hasPenaltyFee, setHasPenaltyFee] = useState(true);
  const [penaltyRatePct, setPenaltyRatePct] = useState(25);
  const [customPenaltyAmount, setCustomPenaltyAmount] = useState<number | "">("");
  const [termDays, setTermDays] = useState(30);
  const [minCredibility, setMinCredibility] = useState(300);
  const [guarantorsRequired, setGuarantorsRequired] = useState(2);
  const [isActive, setIsActive] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [lockedUserIds, setLockedUserIds] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [customUserEntry, setCustomUserEntry] = useState("");
  const [syncedId, setSyncedId] = useState<string | null>(null);

  const listUsersFn = useServerFn(listAllUsers);
  const { data: users = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ["admin-all-users-tier"],
    queryFn: () => listUsersFn(),
    enabled: isOpen,
  });

  if (isOpen && tier && syncedId !== tier.id) {
    setName(tier.name);
    setDescription(tier.description);
    setMinAmount(tier.min_amount);
    setMaxAmount(tier.max_amount);
    setInterestRatePct(Number((tier.interest_rate * 100).toFixed(2)));
    setProcessingFeePct(Number((tier.processing_fee_rate * 100).toFixed(2)));

    const tierHasPenalty =
      (tier.custom_penalty_amount !== null &&
        tier.custom_penalty_amount !== undefined &&
        Number(tier.custom_penalty_amount) > 0) ||
      (tier.penalty_rate !== null &&
        tier.penalty_rate !== undefined &&
        Number(tier.penalty_rate) > 0);

    setHasPenaltyFee(tierHasPenalty);
    setPenaltyRatePct(
      tier.penalty_rate !== null && tier.penalty_rate !== undefined
        ? Number((tier.penalty_rate * 100).toFixed(2))
        : 25,
    );
    setCustomPenaltyAmount(tier.custom_penalty_amount ? tier.custom_penalty_amount : "");
    setTermDays(tier.term_days);
    setMinCredibility(tier.min_credibility);
    setGuarantorsRequired(tier.guarantors_required);
    setIsActive(tier.is_active);
    setIsLocked(tier.is_locked);
    setLockedUserIds(tier.locked_user_ids || []);
    setUserSearch("");
    setCustomUserEntry("");
    setSyncedId(tier.id);
  } else if (isOpen && isCreating && syncedId !== "new") {
    setName("");
    setDescription("");
    setMinAmount(500);
    setMaxAmount(5000);
    setInterestRatePct(10);
    setProcessingFeePct(2);
    setHasPenaltyFee(true);
    setPenaltyRatePct(25);
    setCustomPenaltyAmount("");
    setTermDays(30);
    setMinCredibility(300);
    setGuarantorsRequired(2);
    setIsActive(true);
    setIsLocked(false);
    setLockedUserIds([]);
    setUserSearch("");
    setCustomUserEntry("");
    setSyncedId("new");
  } else if (!isOpen && syncedId !== null) {
    setSyncedId(null);
  }

  const handleSave = () => {
    if (!name.trim()) {
      toast.error("Please enter a name for this loan tier.");
      return;
    }
    if (minAmount > maxAmount) {
      toast.error("Minimum loan amount cannot exceed maximum loan amount.");
      return;
    }

    onSave({
      name: name.trim(),
      description: description.trim(),
      minAmount,
      maxAmount,
      interestRate: interestRatePct / 100,
      processingFeeRate: processingFeePct / 100,
      penaltyRate: hasPenaltyFee ? Math.max(0.01, penaltyRatePct / 100) : null,
      customPenaltyAmount:
        hasPenaltyFee && typeof customPenaltyAmount === "number" && customPenaltyAmount > 0
          ? customPenaltyAmount
          : null,
      termDays,
      minCredibility,
      guarantorsRequired,
      isActive,
      isLocked,
      lockedUserIds,
      isTestTier: Boolean(tier?.is_test_tier),
    });
  };

  const toggleUserRestriction = (targetIdentifier: string) => {
    setLockedUserIds((prev) => {
      if (prev.includes(targetIdentifier)) {
        return prev.filter((id) => id !== targetIdentifier);
      } else {
        return [...prev, targetIdentifier];
      }
    });
  };

  const removeRestriction = (targetIdentifier: string) => {
    setLockedUserIds((prev) => prev.filter((id) => id !== targetIdentifier));
  };

  const addCustomIdentifier = () => {
    const trimmed = customUserEntry.trim();
    if (!trimmed) return;
    if (!lockedUserIds.includes(trimmed)) {
      setLockedUserIds((prev) => [...prev, trimmed]);
    }
    setCustomUserEntry("");
  };

  // Strictly filter out any agents, admins, super admins, initial admins, or staff
  // They are never allowed to borrow, so they should never be listed under Restricted Members.
  const eligibleBorrowers = useMemo(() => {
    return users.filter((u: any) => {
      const isStaffOrAdmin =
        Boolean(u.is_initial_admin) ||
        Boolean(u.is_super_admin) ||
        Boolean(u.is_admin) ||
        Boolean(u.is_agent) ||
        (Array.isArray(u.roles) &&
          u.roles.some((r: any) => {
            const roleName = typeof r === "string" ? r : r?.role;
            return roleName === "staff" || roleName === "super_admin" || roleName === "admin";
          })) ||
        (Array.isArray(u.agent_permissions) && u.agent_permissions.length > 0);

      return !isStaffOrAdmin;
    });
  }, [users]);

  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return eligibleBorrowers;
    const q = userSearch.toLowerCase().trim();

    return eligibleBorrowers.filter((u: any) => {
      const fullName = `${u.first_name || ""} ${u.last_name || ""}`.toLowerCase();
      const email = (u.email || "").toLowerCase();
      const phone = (u.phone || "").toLowerCase();
      const id = String(u.id || "").toLowerCase();

      return fullName.includes(q) || email.includes(q) || phone.includes(q) || id.includes(q);
    });
  }, [eligibleBorrowers, userSearch]);

  const userMap = useMemo(() => {
    const map = new Map<string, (typeof users)[number]>();
    users.forEach((u: any) => {
      map.set(u.id, u);
      if (u.email) map.set(u.email.toLowerCase(), u);
    });
    return map;
  }, [users]);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col p-6 overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {isCreating ? (
              <>
                <Plus className="size-5 text-primary" /> Create New Loan Tier
              </>
            ) : (
              <>
                Edit loan tier — {tier?.name}
                {tier?.is_test_tier && (
                  <Badge
                    variant="outline"
                    className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 text-xs"
                  >
                    Sandbox Tier
                  </Badge>
                )}
              </>
            )}
          </SheetTitle>
          <SheetDescription>
            Adjust limits, interest rates, penalty rules, required credibility points, or member
            restrictions.
          </SheetDescription>
        </SheetHeader>

        {tier?.is_test_tier && (
          <div className="mt-3 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
            <Beaker className="size-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Sandbox Tier Configuration</p>
              <p className="text-[11px] mt-0.5 opacity-90">
                This tier is exclusively available in M-Pesa Sandbox mode for quick testing. Loan
                limits must be set between KES 1 and KES 10.
              </p>
            </div>
          </div>
        )}

        <div className="grid gap-4 py-4 flex-1">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tier-name">Tier name</Label>
              <Input
                id="tier-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Silver, Gold, Starter"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tier-desc">Description</Label>
              <Input
                id="tier-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short description for borrowers"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tier-min-amount">Min Amount (KES)</Label>
              <Input
                id="tier-min-amount"
                type="number"
                value={minAmount}
                onChange={(e) => setMinAmount(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tier-max-amount">Max Amount (KES)</Label>
              <Input
                id="tier-max-amount"
                type="number"
                value={maxAmount}
                onChange={(e) => setMaxAmount(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="tier-interest">Interest Rate (%)</Label>
              <Input
                id="tier-interest"
                type="number"
                step="0.1"
                value={interestRatePct}
                onChange={(e) => setInterestRatePct(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tier-fee">Processing Fee (%)</Label>
              <Input
                id="tier-fee"
                type="number"
                step="0.1"
                value={processingFeePct}
                onChange={(e) => setProcessingFeePct(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tier-term">Term (Days)</Label>
              <Input
                id="tier-term"
                type="number"
                value={termDays}
                onChange={(e) => setTermDays(Number(e.target.value))}
              />
            </div>
          </div>

          {/* 24-Hour Default Penalty Configuration with Checkbox Rule */}
          <div className="rounded-lg border border-border p-4 bg-muted/20 space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5 pr-2">
                <Label
                  htmlFor="tier-has-penalty"
                  className="text-sm font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <ShieldAlert className="size-4 text-primary" /> Apply 24-Hour Default Penalty Fee
                </Label>
                <p className="text-xs text-muted-foreground">
                  Check this box to enable penalty fees when loans under this tier become overdue.
                </p>
              </div>
              <Checkbox
                id="tier-has-penalty"
                checked={hasPenaltyFee}
                onCheckedChange={(checked) => setHasPenaltyFee(Boolean(checked))}
              />
            </div>

            {hasPenaltyFee ? (
              <div className="grid gap-3 sm:grid-cols-2 pt-2 border-t border-border/50">
                <div className="space-y-1.5">
                  <Label htmlFor="tier-penalty-rate" className="text-xs font-medium">
                    Default Penalty Rate (% of Interest / 24h)
                  </Label>
                  <Input
                    id="tier-penalty-rate"
                    type="number"
                    step="1"
                    min={1}
                    max={200}
                    value={penaltyRatePct}
                    onChange={(e) => setPenaltyRatePct(Number(e.target.value))}
                    placeholder="25"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Default: 25% (Interest ÷ 4 every 24 hours).
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tier-custom-penalty" className="text-xs font-medium">
                    Custom Fixed Daily Fee (KES - Optional)
                  </Label>
                  <Input
                    id="tier-custom-penalty"
                    type="number"
                    min={0}
                    step="1"
                    value={customPenaltyAmount}
                    onChange={(e) =>
                      setCustomPenaltyAmount(e.target.value === "" ? "" : Number(e.target.value))
                    }
                    placeholder="Leave empty to use % rate"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Overrides % rate with fixed KES per 24 hours if set.
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-md bg-muted/50 p-2.5 text-xs text-muted-foreground border border-border/50">
                No penalty fee rule applied. Overdue loans under this tier will not accrue default
                penalty fees.
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tier-pts">Min Credibility Points required</Label>
              <Input
                id="tier-pts"
                type="number"
                min={0}
                max={1000}
                value={minCredibility}
                onChange={(e) => setMinCredibility(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Members need at least this score to apply for this tier.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tier-guarantors">Guarantors required</Label>
              <Input
                id="tier-guarantors"
                type="number"
                min={0}
                max={5}
                value={guarantorsRequired}
                onChange={(e) => setGuarantorsRequired(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-lg border p-4 bg-muted/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Active tier</p>
                <p className="text-xs text-muted-foreground">Visible in loan application list</p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>

            <div className="flex items-center justify-between border-t pt-3">
              <div>
                <p className="text-sm font-medium text-destructive flex items-center gap-1.5">
                  <ShieldAlert className="size-4" /> Lock tier for all members
                </p>
                <p className="text-xs text-muted-foreground">
                  Prevents all users from applying to this tier regardless of score
                </p>
              </div>
              <Switch checked={isLocked} onCheckedChange={setIsLocked} />
            </div>
          </div>

          {/* Restricted Members Section */}
          <div className="space-y-3 rounded-lg border p-4 bg-card shadow-xs">
            <div>
              <Label className="text-sm font-semibold flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-destructive font-medium">
                  <UserX className="size-4" /> Restricted Members ({lockedUserIds.length})
                </span>
                {lockedUserIds.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-muted-foreground hover:text-destructive"
                    onClick={() => setLockedUserIds([])}
                  >
                    Clear all
                  </Button>
                )}
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Select members below to block them from applying to this tier even if unlocked.
                Staff and administrators are excluded since they cannot borrow.
              </p>
            </div>

            {/* Badges of currently restricted users */}
            <div className="flex flex-wrap gap-1.5 min-h-9 p-2 bg-muted/30 rounded-md border border-dashed border-border/80">
              {lockedUserIds.length === 0 ? (
                <span className="text-xs text-muted-foreground self-center italic px-1">
                  No members restricted for this tier. Select members from the list below.
                </span>
              ) : (
                lockedUserIds.map((item) => {
                  const matchedUser = userMap.get(item) || userMap.get(item.toLowerCase());
                  const displayName = matchedUser
                    ? `${matchedUser.first_name || ""} ${matchedUser.last_name || ""}`.trim() ||
                      matchedUser.email
                    : item;
                  const displaySub =
                    matchedUser?.email && matchedUser.email !== displayName
                      ? matchedUser.email
                      : null;

                  return (
                    <Badge
                      key={item}
                      variant="destructive"
                      className="inline-flex items-center gap-1 py-1 px-2 text-xs font-normal bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20"
                    >
                      <UserX className="size-3 shrink-0" />
                      <span className="font-medium">{displayName}</span>
                      {displaySub && <span className="opacity-70 text-[10px]">({displaySub})</span>}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeRestriction(item);
                        }}
                        className="ml-1 rounded-full p-0.5 hover:bg-destructive/20 transition-colors"
                        title="Remove restriction"
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  );
                })
              )}
            </div>

            {/* Search and User List */}
            <div className="space-y-2 pt-1">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search members by name, email, phone, or ID..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
                {userSearch && (
                  <button
                    type="button"
                    onClick={() => setUserSearch("")}
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              {isLoadingUsers ? (
                <div className="flex items-center justify-center py-6 text-xs text-muted-foreground gap-2">
                  <LucideLoader className="size-4 animate-spin text-primary" /> Loading members
                  list...
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-6 border rounded-md bg-muted/10 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    {userSearch
                      ? `No members found matching "${userSearch}"`
                      : "No eligible members registered yet"}
                  </p>
                  <div className="flex items-center justify-center gap-2 max-w-sm mx-auto px-4">
                    <Input
                      placeholder="Add ID or Email manually..."
                      value={customUserEntry}
                      onChange={(e) => setCustomUserEntry(e.target.value)}
                      className="h-8 text-xs"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="h-8 text-xs shrink-0"
                      onClick={addCustomIdentifier}
                    >
                      <Plus className="size-3 mr-1" /> Add
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="border rounded-md overflow-hidden bg-background">
                  <div className="bg-muted/40 px-3 py-1.5 border-b text-[11px] font-medium text-muted-foreground flex justify-between items-center">
                    <span>Eligible members ({filteredUsers.length})</span>
                    <span className="text-[10px] text-muted-foreground">Click row to toggle</span>
                  </div>
                  <div className="max-h-52 overflow-y-auto divide-y divide-border/50">
                    {filteredUsers.map((u: any) => {
                      const isRestricted =
                        lockedUserIds.includes(u.id) ||
                        Boolean(u.email && lockedUserIds.includes(u.email));

                      return (
                        <div
                          key={u.id}
                          onClick={() => toggleUserRestriction(u.id)}
                          className={cn(
                            "flex items-center justify-between p-2.5 text-xs hover:bg-muted/50 cursor-pointer transition-colors select-none",
                            isRestricted && "bg-destructive/5 hover:bg-destructive/10",
                          )}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            <Checkbox
                              checked={isRestricted}
                              onCheckedChange={() => toggleUserRestriction(u.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-1.5 font-medium text-foreground truncate">
                                <span>
                                  {u.first_name || ""} {u.last_name || ""}
                                </span>
                                {!u.first_name && !u.last_name && (
                                  <span className="italic opacity-60">Unnamed</span>
                                )}
                              </div>
                              <span className="text-[11px] text-muted-foreground truncate">
                                {u.email || "No email"} {u.phone ? `• ${u.phone}` : ""}
                              </span>
                            </div>
                          </div>
                          {isRestricted ? (
                            <Badge
                              variant="destructive"
                              className="text-[10px] py-0 px-1.5 shrink-0"
                            >
                              Restricted
                            </Badge>
                          ) : (
                            <span className="text-[11px] text-muted-foreground opacity-60 shrink-0 hover:opacity-100">
                              Restrict
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <SheetFooter className="mt-auto pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            <X /> Cancel
          </Button>
          <Button disabled={pending} onClick={handleSave}>
            {pending ? <LucideLoader className="animate-spin" /> : <Save />}
            {isCreating ? "Create Tier" : "Save tier settings"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
