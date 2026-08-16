import { useState, useMemo, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronRight,
  Crown,
  Landmark,
  HelpCircle,
  LucideLoader,
  MessageSquareQuote,
  Plus,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Tag,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
  Zap,
  Ban,
} from "lucide-react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import {
  adminListAgents,
  adminPromoteUserToAgent,
  adminRemoveAgentRole,
  adminTransferSuperAdminRole,
  adminUpdateAgentPermissions,
  listAllUsers,
} from "@/lib/admin.functions";
import { useUrlBooleanState, useUrlStringState } from "@/lib/use-url-search-state";

type AgentItem = Awaited<ReturnType<typeof adminListAgents>>[number];
type UserItem = Awaited<ReturnType<typeof listAllUsers>>[number];

const TASK_PERMISSIONS = [
  {
    id: "approve_loans",
    label: "Approve & Disburse Loans",
    desc: "Can review loan applications, approve pending requests, and trigger M-Pesa B2C payouts.",
    icon: Landmark,
  },
  {
    id: "manage_users",
    label: "Manage Borrowers & Credibility",
    desc: "Can view borrower details, adjust credibility scores, freeze points, and update profiles.",
    icon: Users,
  },
  {
    id: "manage_tiers",
    label: "Manage Loan Tiers & Products",
    desc: "Can create and edit loan product tiers, interest rates, and lock/unlock tiers.",
    icon: Tag,
  },
  {
    id: "manage_testimonials",
    label: "Moderate Testimonials & Reviews",
    desc: "Can approve, reject, or delete homepage review submissions from borrowers.",
    icon: MessageSquareQuote,
  },
  {
    id: "manage_phone_requests",
    label: "Handle M-Pesa Phone Requests",
    desc: "Can review and approve or reject borrower requests to update M-Pesa phone numbers.",
    icon: Smartphone,
  },
  {
    id: "handle_user_requests",
    label: "Handle User Support Requests",
    desc: "Can view, reply to, and resolve user support tickets and reported problem inquiries.",
    icon: HelpCircle,
  },
  {
    id: "manage_settings",
    label: "Business & Daraja API Settings",
    desc: "Can edit company profile, contact details, and Safaricom Daraja M-Pesa credentials.",
    icon: Settings,
  },
  {
    id: "receive_system_alerts",
    label: "Receive & View System Alerts",
    desc: "Allowed by initial admin to receive and view administrative system alert notifications.",
    icon: ShieldAlert,
  },
];

export function AgentManagement() {
  const queryClient = useQueryClient();
  const listAgentsFn = useServerFn(adminListAgents);
  const listUsersFn = useServerFn(listAllUsers);
  const promoteFn = useServerFn(adminPromoteUserToAgent);
  const updatePermissionsFn = useServerFn(adminUpdateAgentPermissions);
  const removeAgentFn = useServerFn(adminRemoveAgentRole);
  const transferSuperAdminFn = useServerFn(adminTransferSuperAdminRole);

  const { data: agentsData, isLoading: isLoadingAgents } = useQuery({
    queryKey: ["admin-agents"],
    queryFn: () => listAgentsFn(),
  });

  const { data: usersData, isLoading: isLoadingUsers } = useQuery({
    queryKey: ["admin-all-users-for-agents"],
    queryFn: () => listUsersFn(),
  });

  const agents = (agentsData ?? []) as AgentItem[];

  const [openDialog, setOpenDialog] = useUrlBooleanState("createAgent");
  const [wizardStep, setWizardStep] = useState<"select_user" | "assign_tasks">("select_user");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterActiveOnly, setFilterActiveOnly] = useState(true);

  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([
    "approve_loans",
    "manage_users",
  ]);

  const [editingAgentId, setEditingAgentId] = useUrlStringState("editAgentId");
  const editingAgent = agents.find((a) => a.id === editingAgentId) ?? null;
  const setEditingAgent = (a: AgentItem | null) => setEditingAgentId(a ? a.id : null);

  const [editPermissions, setEditPermissions] = useState<string[]>([]);

  useEffect(() => {
    if (editingAgent) {
      setEditPermissions(editingAgent.agent_permissions ?? []);
    }
  }, [editingAgent]);

  const [transferDialogOpen, setTransferDialogOpen] = useUrlBooleanState("transferSuperAdmin");
  const [transferTargetAgent, setTransferTargetAgent] = useState<AgentItem | null>(null);

  const promoteMutation = useMutation({
    mutationFn: (input: { userId: string; permissions: string[] }) => promoteFn({ data: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-agents"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-all-users-for-agents"] });
      setOpenDialog(false);
      setSelectedUser(null);
      setWizardStep("select_user");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updatePermissionsMutation = useMutation({
    mutationFn: (input: { agentUserId: string; permissions: string[] }) =>
      updatePermissionsFn({ data: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-agents"] });
      setEditingAgent(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeAgentMutation = useMutation({
    mutationFn: (userId: string) => removeAgentFn({ data: { userId } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-agents"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-all-users-for-agents"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const transferSuperAdminMutation = useMutation({
    mutationFn: (targetUserId: string) => transferSuperAdminFn({ data: { targetUserId } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-agents"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-all-users-for-agents"] });
      setTransferDialogOpen(false);
      setTransferTargetAgent(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const [revokeAgentId, setRevokeAgentId] = useUrlStringState("revokeAgentId");
  const revokeTargetAgent = agents.find((a) => a.id === revokeAgentId) ?? null;
  const setRevokeTargetAgent = (a: AgentItem | null) => setRevokeAgentId(a ? a.id : null);

  const allUsers = useMemo(() => usersData ?? [], [usersData]);

  const filteredUsers = useMemo(() => {
    return allUsers.filter((u: any) => {
      // Exclude Initial Admin, existing Super Admins, and ALREADY appointed Staff Agents from selection list
      if (u.is_super_admin || u.is_initial_admin || u.is_agent) return false;
      if (filterActiveOnly && u.status !== "active") return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const name = `${u.first_name} ${u.last_name}`.toLowerCase();
      const email = (u.email || "").toLowerCase();
      const phone = (u.phone || "").toLowerCase();
      const idNum = (u.id_number || "").toLowerCase();
      return name.includes(q) || email.includes(q) || phone.includes(q) || idNum.includes(q);
    });
  }, [allUsers, searchQuery, filterActiveOnly]);

  const togglePermission = (permId: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId],
    );
  };

  const toggleEditPermission = (permId: string) => {
    setEditPermissions((prev) =>
      prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId],
    );
  };

  const handleChooseUser = (user: UserItem) => {
    if (user.status !== "active") {
      toast.error(
        `Cannot select ${user.first_name || "user"}. Only active users can be added as staff agents.`,
      );
      return;
    }
    if (user.has_defaulted_loan) {
      toast.error(
        `Cannot select ${user.first_name || "user"}. User has defaulted on a loan and cannot be appointed as a staff agent.`,
      );
      return;
    }
    if (user.has_active_or_pending_loan) {
      toast.error(
        `Cannot select ${user.first_name || "user"}. User currently has an active, pending, or disbursing loan and cannot be appointed as a staff agent.`,
      );
      return;
    }
    setSelectedUser(user);
    if (user.agent_permissions && user.agent_permissions.length > 0) {
      setSelectedPermissions(user.agent_permissions);
    } else {
      setSelectedPermissions(["approve_loans", "manage_users"]);
    }
    setWizardStep("assign_tasks");
  };

  return (
    <div className="space-y-6">
      {/* CARD 1: ACTIVE AGENTS LIST */}
      <Card className="border-border/70 shadow-soft">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserCheck className="size-5 text-primary" aria-hidden />
              Task-Based Staff Agents
            </CardTitle>
            <CardDescription className="text-xs">
              Staff agents hold delegated access to manage specific lending operations.
            </CardDescription>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setWizardStep("select_user");
              setSelectedUser(null);
              setOpenDialog(true);
            }}
          >
            <UserPlus className="size-4 mr-1.5" />
            Add Task-Based Staff Agent
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoadingAgents ? (
            <div className="flex justify-center py-8">
              <LucideLoader className="size-5 animate-spin text-primary" aria-label="Loading" />
            </div>
          ) : agents.length === 0 ? (
            <div className="text-center py-8 border rounded-xl bg-muted/20 space-y-3">
              <UserCheck className="size-8 mx-auto text-muted-foreground/60" />
              <p className="text-sm font-medium">No staff agents assigned yet.</p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Promote active users to staff agents and assign specific operational permissions.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setWizardStep("select_user");
                  setSelectedUser(null);
                  setOpenDialog(true);
                }}
              >
                <Plus className="size-4 mr-1" /> Choose Active User to Promote
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent Profile</TableHead>
                  <TableHead>Contact Info</TableHead>
                  <TableHead>Assigned Task Permissions</TableHead>
                  <TableHead>Account Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.map((agent) => (
                  <TableRow key={agent.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="size-8">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                            {initials(agent.first_name, agent.last_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="font-semibold text-sm">
                              {`${agent.first_name} ${agent.last_name}`.trim() || "Staff Agent"}
                            </p>
                            {agent.is_initial_admin ? (
                              <Badge variant="gold" className="text-[10px] gap-1">
                                <Crown className="size-3 shrink-0" /> Initial Super Admin
                              </Badge>
                            ) : agent.is_super_admin ? (
                              <Badge variant="default" className="text-[10px] gap-1">
                                <Crown className="size-3 shrink-0" /> Super Admin
                              </Badge>
                            ) : null}
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            Agent since {new Date(agent.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs space-y-0.5">
                        <p>{agent.email}</p>
                        <p className="text-muted-foreground">{agent.phone || "No phone"}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-sm">
                        {agent.is_super_admin || agent.is_initial_admin ? (
                          <Badge variant="outline" className="text-[10px]">
                            Full Super Admin Access
                          </Badge>
                        ) : agent.permissions.length === 0 ? (
                          <Badge variant="outline" className="text-[10px]">
                            No Task Rights Assigned
                          </Badge>
                        ) : (
                          agent.permissions.map((p) => {
                            const found = TASK_PERMISSIONS.find((tp) => tp.id === p);
                            const IconComp = found?.icon || Zap;
                            return (
                              <Badge key={p} variant="secondary" className="text-[10px] gap-1">
                                <IconComp className="size-3 text-primary shrink-0" />
                                {found?.label || p.replace(/_/g, " ")}
                              </Badge>
                            );
                          })
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={agent.status === "active" ? "default" : "secondary"}>
                        {agent.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="flex justify-end items-center space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingAgent(agent);
                          setEditPermissions(agent.permissions);
                        }}
                      >
                        Edit Permissions
                      </Button>

                      {agent.is_initial_admin || agent.is_super_admin ? (
                        <Button
                          size="sm"
                          variant="gold"
                          onClick={() => {
                            setTransferTargetAgent(null);
                            setTransferDialogOpen(true);
                          }}
                        >
                          <Crown className="size-3 mr-1" /> Transfer Role
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={removeAgentMutation.isPending}
                          onClick={() => setRevokeTargetAgent(agent)}
                        >
                          <Trash2 className="size-3 mr-1" /> Revoke
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* SIDE PANEL 1: ADD TASK-BASED STAFF AGENT (2-STEP SEARCH & ASSIGN WIZARD) */}
      <Sheet open={openDialog} onOpenChange={setOpenDialog}>
        <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col p-6 overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" />
              Add Task-Based Staff Agent
            </SheetTitle>
            <SheetDescription className="text-xs">
              {wizardStep === "select_user"
                ? "Step 1 of 2: Search and select an active user account to appoint as staff agent."
                : `Step 2 of 2: Configure operational task permissions for ${selectedUser?.first_name} ${selectedUser?.last_name}.`}
            </SheetDescription>
          </SheetHeader>

          {/* STEP 1: SEARCH & SELECT ACTIVE USER */}
          {wizardStep === "select_user" && (
            <div className="space-y-4 py-2">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users by name, email, phone, or ID number..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 text-xs"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={filterActiveOnly ? "default" : "outline"}
                    size="sm"
                    className="text-xs"
                    onClick={() => setFilterActiveOnly(!filterActiveOnly)}
                  >
                    {filterActiveOnly ? "Show Active Users Only" : "Show All Users"}
                  </Button>
                </div>
              </div>

              <div className="border rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                {isLoadingUsers ? (
                  <div className="flex justify-center py-10">
                    <LucideLoader className="size-6 animate-spin text-primary" />
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    No matching users found.
                  </div>
                ) : (
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10 border-b">
                      <TableRow>
                        <TableHead className="text-xs">User Profile</TableHead>
                        <TableHead className="text-xs">Contact & National ID</TableHead>
                        <TableHead className="text-xs">Account Status</TableHead>
                        <TableHead className="text-xs text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((user) => {
                        const isActive = user.status === "active";
                        return (
                          <TableRow
                            key={user.id}
                            className={!isActive ? "opacity-60 bg-muted/20" : ""}
                          >
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Avatar className="size-7">
                                  <AvatarFallback className="text-[10px]">
                                    {initials(user.first_name, user.last_name)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="text-xs font-semibold">
                                    {`${user.first_name} ${user.last_name}`.trim() || "User"}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground">{user.email}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs">
                              <p>{user.phone || "—"}</p>
                              {user.id_number && (
                                <p className="text-[10px] text-muted-foreground">
                                  ID: {user.id_number}
                                </p>
                              )}
                            </TableCell>{" "}
                            <TableCell>
                              <div className="flex flex-wrap items-center gap-1">
                                {isActive ? (
                                  <Badge variant="default" className="text-[10px]">
                                    Active
                                  </Badge>
                                ) : (
                                  <Badge variant="gold" className="text-[10px]">
                                    {user.status}
                                  </Badge>
                                )}
                                {user.is_agent && (
                                  <Badge variant="secondary" className="text-[10px]">
                                    Staff Agent
                                  </Badge>
                                )}
                                {user.has_defaulted_loan && (
                                  <Badge variant="destructive" className="text-[10px]">
                                    Defaulted Loan
                                  </Badge>
                                )}
                                {user.has_active_or_pending_loan && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] border-gold text-gold"
                                  >
                                    Active Loan
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {!isActive ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="text-[11px] text-destructive font-medium flex items-center justify-center">
                                      <Ban className="size-3" />
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="bottom">
                                    Ineligible (Not Active)
                                  </TooltipContent>
                                </Tooltip>
                              ) : user.has_defaulted_loan ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="text-[11px] text-destructive font-medium flex items-center justify-center">
                                      <Ban className="size-3" />
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="bottom">Defaulted Loan</TooltipContent>
                                </Tooltip>
                              ) : user.has_active_or_pending_loan ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="text-[11px] text-gold font-medium flex items-center justify-center">
                                      <Ban className="size-3" />
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="bottom">Active/Pending Loan</TooltipContent>
                                </Tooltip>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="gold"
                                  onClick={() => handleChooseUser(user)}
                                  className="font-semibold shadow-xs text-xs px-3.5 h-8 gap-1.5"
                                >
                                  Select & Continue <ChevronRight className="size-3.5" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: ASSIGN TASK PERMISSIONS */}
          {wizardStep === "assign_tasks" && selectedUser && (
            <div className="space-y-6 py-2">
              {/* Selected User Summary Banner */}
              <div className="flex items-center justify-between p-4 rounded-xl border bg-primary/5 border-primary/20">
                <div className="flex items-center gap-3">
                  <Avatar className="size-10">
                    <AvatarFallback className="bg-primary text-primary-foreground font-bold text-sm">
                      {initials(selectedUser.first_name, selectedUser.last_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm">
                        {`${selectedUser.first_name} ${selectedUser.last_name}`.trim()}
                      </p>
                      <Badge variant="default" className="text-[10px]">
                        Active User
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {selectedUser.email} · {selectedUser.phone || "No Phone"}
                    </p>
                  </div>
                </div>

                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => {
                    setWizardStep("select_user");
                    setSelectedUser(null);
                  }}
                >
                  Change User
                </Button>
              </div>

              {/* Task Permissions Checklist */}
              <div className="space-y-3">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Permitted Operational Tasks
                </Label>

                <div className="grid gap-3 sm:grid-cols-2">
                  {TASK_PERMISSIONS.map((task) => {
                    const checked = selectedPermissions.includes(task.id);
                    return (
                      <div
                        key={task.id}
                        onClick={() => togglePermission(task.id)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                          checked
                            ? "bg-primary/5 border-primary shadow-xs"
                            : "bg-background border-border/70 hover:border-border"
                        }`}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => togglePermission(task.id)}
                          className="mt-0.5"
                        />
                        <div className="space-y-1">
                          <p className="text-xs font-semibold flex items-center gap-1.5">
                            <task.icon className="size-3.5 text-primary shrink-0" />
                            {task.label}
                          </p>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">
                            {task.desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <SheetFooter className="gap-2 sm:gap-0 mt-auto pt-4 border-t">
            {wizardStep === "assign_tasks" ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setWizardStep("select_user")}
                >
                  ← Back to Users
                </Button>
                <Button
                  type="button"
                  disabled={promoteMutation.isPending || !selectedUser}
                  onClick={() => {
                    if (selectedUser) {
                      promoteMutation.mutate({
                        userId: selectedUser.id,
                        permissions: selectedPermissions,
                      });
                    }
                  }}
                >
                  {promoteMutation.isPending && (
                    <LucideLoader className="mr-2 size-4 animate-spin" />
                  )}
                  Confirm & Appoint Staff Agent
                </Button>
              </>
            ) : (
              <Button type="button" variant="outline" onClick={() => setOpenDialog(false)}>
                Cancel
              </Button>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* SIDE PANEL 2: EDIT EXISTING AGENT PERMISSIONS */}
      <Sheet open={!!editingAgent} onOpenChange={(open) => !open && setEditingAgent(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-6 overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Agent Permissions</SheetTitle>
            <SheetDescription>
              Update operational tasks for {editingAgent?.first_name} {editingAgent?.last_name}.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-3 py-4 flex-1">
            {TASK_PERMISSIONS.map((task) => {
              const checked = editPermissions.includes(task.id);
              return (
                <div
                  key={task.id}
                  onClick={() => toggleEditPermission(task.id)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                    checked ? "bg-primary/5 border-primary" : "bg-background border-border/70"
                  }`}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleEditPermission(task.id)}
                    className="mt-0.5"
                  />
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold flex items-center gap-1.5">
                      <task.icon className="size-3.5 text-primary shrink-0" />
                      {task.label}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{task.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <SheetFooter className="mt-auto pt-4 border-t">
            <Button variant="outline" onClick={() => setEditingAgent(null)}>
              Cancel
            </Button>
            <Button
              disabled={updatePermissionsMutation.isPending || !editingAgent}
              onClick={() => {
                if (editingAgent) {
                  updatePermissionsMutation.mutate({
                    agentUserId: editingAgent.id,
                    permissions: editPermissions,
                  });
                }
              }}
            >
              {updatePermissionsMutation.isPending && (
                <LucideLoader className="mr-2 size-4 animate-spin" />
              )}
              Save Permissions
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* SIDE PANEL 3: TRANSFER SUPER ADMIN ROLE */}
      <Sheet open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-6 overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Crown className="size-5 text-amber-500" />
              Transfer Super Admin Role
            </SheetTitle>
            <SheetDescription className="text-xs">
              Select an active staff agent to receive full Super Admin operational authority. Upon
              transfer, your account will be demoted to a normal user account with standard base
              credibility points (300) and loan limit corresponding to your points level.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 py-4 flex-1">
            <Label className="text-xs font-semibold">Select Target Staff Agent:</Label>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {agents
                .filter((a) => !a.is_super_admin && a.status === "active")
                .map((a) => (
                  <div
                    key={a.id}
                    onClick={() => setTransferTargetAgent(a)}
                    className={`p-3 rounded-lg border cursor-pointer flex items-center justify-between transition-all ${
                      transferTargetAgent?.id === a.id
                        ? "bg-primary/5 border-primary"
                        : "bg-background border-border/70 hover:border-border"
                    }`}
                  >
                    <div>
                      <p className="text-xs font-semibold">{`${a.first_name} ${a.last_name}`}</p>
                      <p className="text-[10px] text-muted-foreground">{a.email}</p>
                    </div>
                    {transferTargetAgent?.id === a.id && <Check className="size-4 text-primary" />}
                  </div>
                ))}
              {agents.filter((a) => !a.is_super_admin && a.status === "active").length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No other active staff agents available. Promote a user to staff agent first.
                </p>
              )}
            </div>
          </div>

          <SheetFooter className="mt-auto pt-4 border-t">
            <Button variant="outline" onClick={() => setTransferDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="gold"
              disabled={
                transferSuperAdminMutation.isPending ||
                !transferTargetAgent ||
                transferTargetAgent.is_super_admin
              }
              onClick={() => {
                if (transferTargetAgent) {
                  transferSuperAdminMutation.mutate(transferTargetAgent.id);
                }
              }}
            >
              {transferSuperAdminMutation.isPending && (
                <LucideLoader className="mr-2 size-4 animate-spin" />
              )}
              Confirm Transfer
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Revoke Agent Confirmation Modal */}
      <AlertDialog
        open={Boolean(revokeTargetAgent)}
        onOpenChange={(open) => !open && setRevokeTargetAgent(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="size-5" /> Revoke Staff Agent Status
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke staff agent privileges for{" "}
              <strong className="text-foreground">
                {revokeTargetAgent?.first_name} {revokeTargetAgent?.last_name}
              </strong>{" "}
              ({revokeTargetAgent?.email})? They will immediately lose access to task-based
              administrative controls.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-semibold"
              disabled={removeAgentMutation.isPending}
              onClick={() => {
                if (revokeTargetAgent) {
                  removeAgentMutation.mutate(revokeTargetAgent.id);
                  setRevokeTargetAgent(null);
                }
              }}
            >
              {removeAgentMutation.isPending ? (
                <LucideLoader className="mr-1.5 size-4 animate-spin" />
              ) : (
                <Trash2 className="mr-1.5 size-4" />
              )}
              Confirm Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
