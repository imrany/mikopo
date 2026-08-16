import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Phone,
  Check,
  X,
  LucideLoader,
  Clock,
  CheckCircle2,
  XCircle,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { getAdminPhoneRequests, decidePhoneChangeRequest } from "@/lib/account.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUrlStringState } from "@/lib/use-url-search-state";

export function PhoneChangeManagement() {
  const { token, isStaff } = useAuth();
  const queryClient = useQueryClient();

  const getRequestsFn = useServerFn(getAdminPhoneRequests);
  const decideFn = useServerFn(decidePhoneChangeRequest);

  const [rejectDialogReqId, setRejectDialogReqId] = useUrlStringState("declinePhoneRequestId");
  const [rejectionReason, setRejectionReason] = useState("");

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["admin-phone-requests"],
    queryFn: () =>
      getRequestsFn({
        headers: { authorization: `Bearer ${token}` },
      }),
    enabled: Boolean(isStaff && token),
  });

  const decideMutation = useMutation({
    mutationFn: (input: { requestId: string; approve: boolean; rejectionReason?: string }) =>
      decideFn({
        data: input,
        headers: { authorization: `Bearer ${token}` },
      }),
    onSuccess: (res, input) => {
      if (!res.ok) {
        toast.error(res.error || "Failed to process request");
        return;
      }
      toast.success(
        input.approve ? "Phone number change approved!" : "Phone change request declined.",
      );
      setRejectDialogReqId(null);
      setRejectionReason("");
      void queryClient.invalidateQueries({ queryKey: ["admin-phone-requests"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!isStaff) return null;

  const pendingRequests = requests.filter((r) => r.status === "pending");

  return (
    <>
      <Card className="mt-8 border-border/70 shadow-soft">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Phone className="h-4 w-4 text-primary" />
              Phone Number Change Requests
              {pendingRequests.length > 0 && (
                <Badge variant="default" className="bg-amber-600 text-white text-[10px]">
                  {pendingRequests.length} Pending
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="text-xs">
              Review requests from borrowers who need to update their registered M-Pesa numbers.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <LucideLoader className="size-5 animate-spin text-primary" />
            </div>
          ) : requests.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground text-center">
              No phone change requests submitted yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Borrower</TableHead>
                  <TableHead>Current Phone</TableHead>
                  <TableHead>Requested Phone</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="font-medium">
                      <div>
                        <div>{req.userName}</div>
                        <div className="text-[11px] text-muted-foreground">{req.userEmail}</div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{req.currentPhone}</TableCell>
                    <TableCell className="font-mono text-xs text-primary font-bold">
                      {req.requestedPhone}
                    </TableCell>
                    <TableCell className="max-w-[200px] text-xs">
                      <div className="truncate flex items-center gap-1" title={req.reason}>
                        <MessageSquare className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="truncate">{req.reason}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(req.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {req.status === "pending" && (
                        <Badge
                          variant="outline"
                          className="text-[10px] gap-1 text-amber-600 border-amber-500/30"
                        >
                          <Clock className="h-2.5 w-2.5" /> Pending
                        </Badge>
                      )}
                      {req.status === "approved" && (
                        <Badge variant="default" className="text-[10px] gap-1 bg-emerald-600">
                          <CheckCircle2 className="h-2.5 w-2.5" /> Approved
                        </Badge>
                      )}
                      {req.status === "rejected" && (
                        <Badge variant="destructive" className="text-[10px] gap-1">
                          <XCircle className="h-2.5 w-2.5" /> Declined
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {req.status === "pending" && (
                        <div className="flex justify-end gap-1.5">
                          <Button
                            size="sm"
                            className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700"
                            disabled={decideMutation.isPending}
                            onClick={() =>
                              decideMutation.mutate({ requestId: req.id, approve: true })
                            }
                          >
                            <Check className="h-3 w-3" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1 text-destructive hover:bg-destructive/10"
                            disabled={decideMutation.isPending}
                            onClick={() => {
                              setRejectDialogReqId(req.id);
                              setRejectionReason("");
                            }}
                          >
                            <X className="h-3 w-3" /> Decline
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Decline Reason Modal */}
      <Dialog
        open={Boolean(rejectDialogReqId)}
        onOpenChange={(open) => {
          if (!open) setRejectDialogReqId(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Decline Phone Change Request</DialogTitle>
            <DialogDescription className="text-xs">
              Optionally provide a reason for declining this borrower's phone change request.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-2">
            <Input
              placeholder="e.g. Phone number does not match registered M-Pesa ID details"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="text-xs"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRejectDialogReqId(null)}
              disabled={decideMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={decideMutation.isPending}
              onClick={() => {
                if (rejectDialogReqId) {
                  decideMutation.mutate({
                    requestId: rejectDialogReqId,
                    approve: false,
                    rejectionReason: rejectionReason.trim() || undefined,
                  });
                }
              }}
            >
              {decideMutation.isPending ? (
                <LucideLoader className="h-4 w-4 animate-spin" />
              ) : (
                "Decline Request"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
