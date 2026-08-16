import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  Check,
  Crown,
  FileSpreadsheet,
  LucideLoader,
  Pencil,
  Save,
  Shield,
  Trash2,
  UserCog,
  User,
  Mail,
  X,
  Lock,
  Phone,
  CreditCard,
} from "lucide-react";
import { getExportDataset } from "@/lib/export.functions";
import { downloadExcelFromData } from "@/lib/excel-export";
import { toast } from "sonner";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Slider } from "@/components/ui/slider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatKes } from "@/lib/format";
import {
  adminDeleteUser,
  adminSetCreditScore,
  adminSetUserStatus,
  adminUpdateUser,
  listAllUsers,
  adminSetLoanLimit,
  adminToggleFreezePoints,
} from "@/lib/admin.functions";
import { useAuth } from "@/lib/auth-context";
import { useAppConfig } from "@/lib/config-context";
import { useUrlStringState } from "@/lib/use-url-search-state";

type UserRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  id_number: string | null;
  status: string;
  credibility_score: number;
  loan_limit: string;
  is_earning_points_frozen: boolean;
  referral_code: string;
  created_at: string;
  is_agent?: boolean;
  is_super_admin?: boolean;
  is_initial_admin?: boolean;
};

export function UserManagement() {
  const { profile: currentProfile, isInitialAdmin: currentIsInitialAdmin } = useAuth();
  const queryClient = useQueryClient();
  const listFn = useServerFn(listAllUsers);
  const updateFn = useServerFn(adminUpdateUser);
  const scoreFn = useServerFn(adminSetCreditScore);
  const limitFn = useServerFn(adminSetLoanLimit);
  const freezeFn = useServerFn(adminToggleFreezePoints);
  const statusFn = useServerFn(adminSetUserStatus);
  const deleteFn = useServerFn(adminDeleteUser);
  const getExportFn = useServerFn(getExportDataset);
  const { businessName } = useAppConfig();
  const [isExportingUsers, setIsExportingUsers] = useState(false);

  const handleQuickExportUsers = async () => {
    setIsExportingUsers(true);
    try {
      const res = await getExportFn({
        data: { dataset: "users", roleFilter: "all" },
      });
      if (res.users && res.users.length > 0) {
        const todayStr = new Date().toISOString().split("T")[0];
        downloadExcelFromData(res.users, {
          fileName: `${businessName}_Users_Profiles_Export_${todayStr}`,
          sheetName: "User Profiles",
        });
      } else {
        toast.error("No user records found to export.");
      }
    } catch {
      toast.error("Failed to export users to Excel.");
    } finally {
      setIsExportingUsers(false);
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ["admin-all-users"],
    queryFn: () => listFn(),
  });

  const users = (data ?? []) as UserRow[];

  const [editUserId, setEditUserId] = useUrlStringState("editUserId");
  const [scoreUserId, setScoreUserId] = useUrlStringState("scoreUserId");
  const [limitUserId, setLimitUserId] = useUrlStringState("limitUserId");
  const [deleteUserId, setDeleteUserId] = useUrlStringState("deleteUserId");
  const [suspendUserId, setSuspendUserId] = useUrlStringState("suspendUserId");

  const editUser = users.find((u) => u.id === editUserId) ?? null;
  const scoreUser = users.find((u) => u.id === scoreUserId) ?? null;
  const limitUser = users.find((u) => u.id === limitUserId) ?? null;
  const deleteUser = users.find((u) => u.id === deleteUserId) ?? null;
  const suspendUser = users.find((u) => u.id === suspendUserId) ?? null;

  const setEditUser = (u: UserRow | null) => setEditUserId(u ? u.id : null);
  const setScoreUser = (u: UserRow | null) => setScoreUserId(u ? u.id : null);
  const setLimitUser = (u: UserRow | null) => setLimitUserId(u ? u.id : null);
  const setDeleteUser = (u: UserRow | null) => setDeleteUserId(u ? u.id : null);
  const setSuspendUser = (u: UserRow | null) => setSuspendUserId(u ? u.id : null);

  const updateMutation = useMutation({
    mutationFn: (input: {
      userId: string;
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      idNumber?: string;
    }) => updateFn({ data: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-all-users"] });
      setEditUser(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const scoreMutation = useMutation({
    mutationFn: (input: { userId: string; score: number }) => scoreFn({ data: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-all-users"] });
      setScoreUser(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const limitMutation = useMutation({
    mutationFn: (input: { userId: string; limit: number }) => limitFn({ data: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-all-users"] });
      setLimitUser(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const freezeMutation = useMutation({
    mutationFn: (input: { userId: string; isFrozen: boolean }) => freezeFn({ data: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-all-users"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const statusMutation = useMutation({
    mutationFn: (input: { userId: string; status: "active" | "suspended" | "pending" }) =>
      statusFn({ data: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-all-users"] });
      setSuspendUser(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => deleteFn({ data: { userId } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-all-users"] });
      setDeleteUser(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Card className="mt-6 border-border/70 shadow-soft">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserCog className="size-4 text-primary" aria-hidden />
            User management
          </CardTitle>
          <CardDescription>
            Edit profiles, adjust credit scores, block or delete accounts.
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleQuickExportUsers}
          disabled={isExportingUsers}
          className="gap-1.5 text-xs text-primary border-primary/30 hover:bg-primary/50 self-start sm:self-auto"
        >
          {isExportingUsers ? (
            <LucideLoader className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FileSpreadsheet className="h-3.5 w-3.5 text-primary" />
          )}
          <span>Export Users (Excel)</span>
        </Button>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <LucideLoader className="size-5 animate-spin text-primary" aria-label="Loading" />
          </div>
        ) : users.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">No users registered yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Limit</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const isSelf = user.id === currentProfile?.id;
                const agentCannotEditInitialAdmin =
                  Boolean(user.is_initial_admin) && !currentIsInitialAdmin;

                return (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Link
                            to="/admin/user/$userId"
                            params={{ userId: user.id }}
                            className="font-bold text-foreground hover:text-primary hover:underline"
                          >
                            {`${user.first_name} ${user.last_name}`.trim() || user.email}
                          </Link>
                          {user.is_initial_admin ? (
                            <Badge variant="gold" className="text-[10px] gap-1">
                              <Crown className="size-3 shrink-0" />
                              <span className="hidden sm:inline">Initial Admin</span>
                            </Badge>
                          ) : user.is_super_admin ? (
                            <Badge variant="default" className="text-[10px] gap-1">
                              <Crown className="size-3 shrink-0" />
                              <span className="hidden sm:inline">Super Admin</span>
                            </Badge>
                          ) : user.is_agent ? (
                            <Badge variant="secondary" className="text-[10px] gap-1">
                              <Shield className="size-3 text-primary shrink-0" />
                              <span className="hidden sm:inline">Agent</span>
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{user.email}</TableCell>
                    <TableCell className="text-xs">{user.phone ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          title={
                            agentCannotEditInitialAdmin ||
                            user.is_agent ||
                            user.is_super_admin ||
                            user.is_initial_admin ||
                            isSelf
                              ? "Agents cannot modify initial admin score"
                              : user.is_earning_points_frozen
                                ? "Points are frozen and cannot be adjusted"
                                : "Adjust score"
                          }
                          disabled={
                            agentCannotEditInitialAdmin ||
                            user.is_earning_points_frozen ||
                            user.is_initial_admin ||
                            user.is_agent ||
                            user.is_super_admin ||
                            isSelf
                          }
                          className={`rounded px-1 font-medium underline-offset-2 ${
                            agentCannotEditInitialAdmin ||
                            user.is_earning_points_frozen ||
                            user.is_initial_admin ||
                            user.is_agent ||
                            user.is_super_admin ||
                            isSelf
                              ? "opacity-50 cursor-not-allowed text-muted-foreground"
                              : "cursor-pointer hover:underline"
                          }`}
                          onClick={() => {
                            if (
                              !agentCannotEditInitialAdmin ||
                              !user.is_earning_points_frozen ||
                              !user.is_agent ||
                              !user.is_super_admin ||
                              !user.is_initial_admin ||
                              !isSelf
                            )
                              setScoreUser(user);
                          }}
                        >
                          {user.credibility_score} pts
                        </button>
                        {user.is_earning_points_frozen && (
                          <Badge
                            variant="destructive"
                            className="text-[10px] py-0 px-1.5 h-4 gap-0.5"
                          >
                            <Lock className="size-2.5" /> Frozen
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        title={
                          agentCannotEditInitialAdmin ||
                          user.is_agent ||
                          user.is_super_admin ||
                          user.is_initial_admin ||
                          isSelf
                            ? "Agents cannot modify initial admin limit"
                            : user.is_earning_points_frozen
                              ? "Points are frozen and cannot be adjusted"
                              : "Adjust loan limit"
                        }
                        disabled={
                          agentCannotEditInitialAdmin ||
                          user.is_earning_points_frozen ||
                          user.is_initial_admin ||
                          user.is_agent ||
                          user.is_super_admin ||
                          isSelf
                        }
                        className={`rounded px-1 font-medium underline-offset-2 ${
                          agentCannotEditInitialAdmin ||
                          user.is_earning_points_frozen ||
                          user.is_initial_admin ||
                          user.is_agent ||
                          user.is_super_admin ||
                          isSelf
                            ? "opacity-50 cursor-not-allowed text-muted-foreground"
                            : "cursor-pointer hover:underline"
                        }`}
                        onClick={() => {
                          if (
                            !agentCannotEditInitialAdmin ||
                            !user.is_earning_points_frozen ||
                            !user.is_agent ||
                            !user.is_super_admin ||
                            !user.is_initial_admin ||
                            !isSelf
                          )
                            setLimitUser(user);
                        }}
                      >
                        {formatKes(Number(user.loan_limit))}
                      </button>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Badge
                          variant={
                            user.status === "active"
                              ? "default"
                              : user.status === "suspended"
                                ? "gold"
                                : "destructive"
                          }
                        >
                          {user.status}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant={user.is_earning_points_frozen ? "outline" : "secondary"}
                          className="text-xs h-8 px-2"
                          title={
                            agentCannotEditInitialAdmin
                              ? "Agents cannot freeze or unfreeze initial admin points."
                              : user.is_earning_points_frozen
                                ? "Unfreeze points earning"
                                : "Stop user from earning points"
                          }
                          disabled={
                            freezeMutation.isPending ||
                            agentCannotEditInitialAdmin ||
                            user.id === currentProfile?.id
                          }
                          onClick={() =>
                            freezeMutation.mutate({
                              userId: user.id,
                              isFrozen: !user.is_earning_points_frozen,
                            })
                          }
                        >
                          {user.is_earning_points_frozen ? "Unfreeze Pts" : "Freeze Pts"}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={agentCannotEditInitialAdmin || user.id === currentProfile?.id}
                          title={
                            agentCannotEditInitialAdmin
                              ? "Agents cannot edit initial admin details."
                              : "Edit user profile"
                          }
                          onClick={() => {
                            if (!agentCannotEditInitialAdmin) setEditUser(user);
                          }}
                        >
                          <Pencil
                            className={`size-4 ${agentCannotEditInitialAdmin ? "opacity-30" : ""}`}
                          />
                        </Button>
                        {user.status === "active" ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            disabled={
                              statusMutation.isPending ||
                              user.is_initial_admin ||
                              user.is_super_admin ||
                              isSelf
                            }
                            title={
                              isSelf
                                ? "You cannot suspend your own account."
                                : user.is_initial_admin || user.is_super_admin
                                  ? "Super Admin status cannot be changed directly."
                                  : "Block account"
                            }
                            onClick={() => setSuspendUser(user)}
                          >
                            <Ban
                              className={`size-4 ${
                                user.is_initial_admin || user.is_super_admin || isSelf
                                  ? "opacity-30"
                                  : "text-destructive"
                              }`}
                            />
                          </Button>
                        ) : (
                          <Button
                            size="icon"
                            variant="ghost"
                            disabled={statusMutation.isPending}
                            onClick={() =>
                              statusMutation.mutate({ userId: user.id, status: "active" })
                            }
                          >
                            <Check className="size-4 text-success" />
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={user.is_initial_admin || user.is_super_admin}
                          title={
                            user.is_initial_admin
                              ? "Initial Admin account cannot be deleted. Role must be transferred to demote to a normal user account."
                              : user.is_super_admin
                                ? "Super Admin accounts cannot be deleted."
                                : "Delete account"
                          }
                          onClick={() => setDeleteUser(user)}
                        >
                          <Trash2
                            className={`size-4 ${
                              user.is_initial_admin || user.is_super_admin
                                ? "text-muted-foreground opacity-30"
                                : "text-destructive"
                            }`}
                          />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <EditUserDialog
        user={editUser}
        pending={updateMutation.isPending}
        onClose={() => setEditUser(null)}
        onSave={(values) => editUser && updateMutation.mutate({ userId: editUser.id, ...values })}
      />

      <ScoreDialog
        user={scoreUser}
        pending={scoreMutation.isPending}
        onClose={() => setScoreUser(null)}
        onSave={(score) => scoreUser && scoreMutation.mutate({ userId: scoreUser.id, score })}
      />

      <LimitDialog
        user={limitUser}
        pending={limitMutation.isPending}
        onClose={() => setLimitUser(null)}
        onSave={(limit) => limitUser && limitMutation.mutate({ userId: limitUser.id, limit })}
      />

      <AlertDialog open={Boolean(deleteUser)} onOpenChange={(open) => !open && setDeleteUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this user permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-semibold">{deleteUser?.email}</span> and all associated loans,
              repayments and M-Pesa transactions will be removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={() => deleteUser && deleteMutation.mutate(deleteUser.id)}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? <LucideLoader className="animate-spin" /> : null}
              Delete user
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(suspendUser)}
        onOpenChange={(open) => !open && setSuspendUser(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              Block this User Account?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to suspend{" "}
              <strong className="text-foreground">
                {`${suspendUser?.first_name ?? ""} ${suspendUser?.last_name ?? ""}`.trim() ||
                  suspendUser?.email}
              </strong>
              ? They will be unable to log in, request loans, or perform transactions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-warning text-warning-foreground hover:bg-warning/90"
              disabled={statusMutation.isPending}
              onClick={() =>
                suspendUser &&
                statusMutation.mutate({ userId: suspendUser.id, status: "suspended" })
              }
            >
              {statusMutation.isPending ? <LucideLoader className="animate-spin mr-1" /> : null}
              Suspend Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function EditUserDialog({
  user,
  pending,
  onClose,
  onSave,
}: {
  user: UserRow | null;
  pending: boolean;
  onClose: () => void;
  onSave: (values: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    idNumber: string;
  }) => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [synced, setSynced] = useState<string | null>(null);

  if (user && synced !== user.id) {
    setFirstName(user.first_name ?? "");
    setLastName(user.last_name ?? "");
    setEmail(user.email);
    setPhone(user.phone ?? "");
    setIdNumber(user.id_number ?? "");
    setSynced(user.id);
  }
  if (!user && synced !== null) setSynced(null);

  return (
    <Sheet open={Boolean(user)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-6 overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <UserCog className="size-5 text-primary" />
            Edit User Profile
          </SheetTitle>
          <SheetDescription className="text-xs">
            Update account contact information, email, phone number, and national identification for{" "}
            {user?.email}.
          </SheetDescription>
        </SheetHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave({ firstName, lastName, email, phone, idNumber });
          }}
          className="flex flex-col flex-1 min-h-0"
        >
          <div className="grid gap-4 py-4 flex-1 overflow-y-auto">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label
                  htmlFor="edit-first"
                  className="text-xs font-medium flex items-center gap-1.5"
                >
                  <User className="size-3.5 text-muted-foreground" /> First Name
                </Label>
                <Input
                  id="edit-first"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="e.g. John"
                  className="text-sm"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="edit-last"
                  className="text-xs font-medium flex items-center gap-1.5"
                >
                  <User className="size-3.5 text-muted-foreground" /> Last Name
                </Label>
                <Input
                  id="edit-last"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="e.g. Doe"
                  className="text-sm"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-email" className="text-xs font-medium flex items-center gap-1.5">
                <Mail className="size-3.5 text-muted-foreground" /> Email Address
              </Label>
              <Input
                id="edit-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                className="text-sm"
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Used for login authentication and account communications.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label
                  htmlFor="edit-phone"
                  className="text-xs font-medium flex items-center gap-1.5"
                >
                  <Phone className="size-3.5 text-muted-foreground" /> M-Pesa Phone Number
                </Label>
                <Input
                  id="edit-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0712345678 or 254..."
                  className="text-sm font-mono"
                />
                <p className="text-[10px] text-muted-foreground">
                  Safely disburse B2C payouts to this number.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-id" className="text-xs font-medium flex items-center gap-1.5">
                  <CreditCard className="size-3.5 text-muted-foreground" /> National ID Number
                </Label>
                <Input
                  id="edit-id"
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  placeholder="6-10 digits"
                  className="text-sm font-mono"
                />
                <p className="text-[10px] text-muted-foreground">
                  Required for borrower identification.
                </p>
              </div>
            </div>
          </div>
          <SheetFooter className="mt-auto pt-4 border-t flex items-center gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onClose} size="sm">
              <X className="size-4 mr-1" /> Cancel
            </Button>
            <Button type="submit" disabled={pending} size="sm" className="gap-1.5">
              {pending ? (
                <>
                  <LucideLoader className="size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="size-4" />
                  Save Changes
                </>
              )}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function ScoreDialog({
  user,
  pending,
  onClose,
  onSave,
}: {
  user: UserRow | null;
  pending: boolean;
  onClose: () => void;
  onSave: (score: number) => void;
}) {
  const [score, setScore] = useState(300);
  const [synced, setSynced] = useState<string | null>(null);

  if (user && synced !== user.id) {
    setScore(user.credibility_score);
    setSynced(user.id);
  }
  if (!user && synced !== null) setSynced(null);

  return (
    <Sheet open={Boolean(user)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-6 overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Adjust credit score</SheetTitle>
          <SheetDescription>
            {user?.first_name} {user?.last_name} — manually set the credibility score (300–850).
          </SheetDescription>
        </SheetHeader>
        <div className="py-6 flex-1 space-y-4">
          <div className="text-center p-6 bg-primary/5 rounded-2xl border border-primary/20">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
              Selected Credibility Score
            </p>
            <div className="flex items-center justify-center gap-2">
              <span className="font-display text-5xl font-extrabold text-primary">{score} pts</span>
            </div>
            {user?.is_earning_points_frozen && (
              <Badge variant="destructive" className="mt-2 text-xs gap-1">
                <Lock className="size-3" /> Points Earning Frozen
              </Badge>
            )}
          </div>
          <Slider
            value={[score]}
            onValueChange={(vals) => setScore(vals[0] ?? 300)}
            min={300}
            max={850}
            step={5}
            className="py-4"
          />
          <div className="flex justify-between text-xs text-muted-foreground font-semibold">
            <span>300 (Base)</span>
            <span>850 (Max)</span>
          </div>
        </div>
        <SheetFooter className="mt-auto pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={pending} onClick={() => onSave(score)}>
            {pending ? <LucideLoader className="animate-spin" /> : <Save />}
            Set score
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function LimitDialog({
  user,
  pending,
  onClose,
  onSave,
}: {
  user: UserRow | null;
  pending: boolean;
  onClose: () => void;
  onSave: (limit: number) => void;
}) {
  const [limit, setLimit] = useState(1000);
  const [synced, setSynced] = useState<string | null>(null);

  if (user && synced !== user.id) {
    setLimit(Number(user.loan_limit) || 1000);
    setSynced(user.id);
  }
  if (!user && synced !== null) setSynced(null);

  return (
    <Sheet open={Boolean(user)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-6 overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Adjust maximum loan limit</SheetTitle>
          <SheetDescription>
            {user?.first_name} {user?.last_name} — set max borrowing limit (KES 500 – 100,000).
          </SheetDescription>
        </SheetHeader>
        <div className="py-6 flex-1 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="limit-input" className="text-sm font-semibold">
              Max Loan Limit (KES)
            </Label>
            <Input
              id="limit-input"
              type="number"
              min={500}
              max={100000}
              step={500}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="text-lg font-bold"
            />
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            This limit overrides system defaults for {user?.first_name}. The borrower cannot apply
            for loans exceeding this value.
          </p>
        </div>
        <SheetFooter className="mt-auto pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={pending} onClick={() => onSave(limit)}>
            {pending ? <LucideLoader className="animate-spin" /> : <Save />}
            Set limit
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
