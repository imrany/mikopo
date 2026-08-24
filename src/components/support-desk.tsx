import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  HelpCircle,
  Search,
  Send,
  AlertCircle,
  LucideLoader,
  User,
  ShieldCheck,
  ChevronRight,
  Phone,
  Mail,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/skeleton-loaders";
import { useAuth } from "@/lib/auth-context";
import {
  adminListSupportTickets,
  adminUpdateTicketStatus,
  getSupportTicketDetails,
  addSupportResponse,
} from "@/lib/support.functions";
import { motion, AnimatePresence } from "motion/react";
import { useUrlStringState, useUrlBooleanState } from "@/lib/use-url-search-state";

export function SupportDesk() {
  const { token, isStaff } = useAuth();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [search, setSearch] = useState("");

  const [selectedTicketId, setSelectedTicketId] = useUrlStringState("ticketId");
  const [agentReply, setAgentReply] = useState("");
  const [_internalNotes, setInternalNotes] = useState("");
  const [isChatExpanded, setIsChatExpanded] = useUrlBooleanState("expandedChat");

  const listTicketsFn = useServerFn(adminListSupportTickets);
  const getTicketDetailsFn = useServerFn(getSupportTicketDetails);
  const updateStatusFn = useServerFn(adminUpdateTicketStatus);
  const addResponseFn = useServerFn(addSupportResponse);

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["admin-support-tickets", statusFilter, priorityFilter, search, token],
    queryFn: () =>
      listTicketsFn({
        data: { status: statusFilter, priority: priorityFilter, search },
        headers: { authorization: `Bearer ${token}` },
      }),
    enabled: Boolean(token) && isStaff,
  });

  const { data: ticketDetail, isLoading: isLoadingDetail } = useQuery({
    queryKey: ["admin-ticket-detail", selectedTicketId, token],
    queryFn: () =>
      getTicketDetailsFn({
        data: { ticketId: selectedTicketId! },
        headers: { authorization: `Bearer ${token}` },
      }),
    enabled: Boolean(token) && Boolean(selectedTicketId),
  });

  const updateStatusMutation = useMutation({
    mutationFn: (data: {
      ticketId: string;
      status?: "open" | "in_progress" | "resolved" | "closed";
      priority?: "low" | "medium" | "high" | "urgent";
      adminNotes?: string;
    }) => updateStatusFn({ data, headers: { authorization: `Bearer ${token}` } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-support-tickets"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-ticket-detail", selectedTicketId] });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to update ticket."),
  });

  const agentReplyMutation = useMutation({
    mutationFn: (data: { ticketId: string; message: string }) =>
      addResponseFn({ data, headers: { authorization: `Bearer ${token}` } }),
    onSuccess: () => {
      setAgentReply("");
      void queryClient.invalidateQueries({ queryKey: ["admin-ticket-detail", selectedTicketId] });
      void queryClient.invalidateQueries({ queryKey: ["admin-support-tickets"] });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to send response."),
  });

  const handleSendAgentReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicketId || !agentReply.trim()) return;
    agentReplyMutation.mutate({ ticketId: selectedTicketId, message: agentReply });
  };

  const openTickets = tickets?.filter((t: any) => t.status === "open").length ?? 0;
  const inProgressTickets = tickets?.filter((t: any) => t.status === "in_progress").length ?? 0;
  const resolvedTickets = tickets?.filter((t: any) => t.status === "resolved").length ?? 0;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return (
          <Badge variant="default" className="bg-gold">
            Open
          </Badge>
        );
      case "in_progress":
        return (
          <Badge variant="default" className="bg-blue-600">
            In Progress
          </Badge>
        );
      case "resolved":
        return <Badge variant="default">Resolved</Badge>;
      case "closed":
        return (
          <Badge variant="default" className="bg-gray-600">
            Closed
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "urgent":
        return (
          <Badge variant="destructive" className="uppercase text-[10px]">
            Urgent
          </Badge>
        );
      case "high":
        return (
          <Badge variant="gold" className="uppercase text-[10px]">
            High
          </Badge>
        );
      case "medium":
        return (
          <Badge variant="secondary" className="uppercase text-[10px]">
            Medium
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="uppercase text-[10px]">
            Low
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border shadow-soft">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Total Tickets</CardDescription>
            <CardTitle className="text-2xl font-bold">{tickets?.length ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border shadow-soft border-gold/50">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs text-gold">Open Requests</CardDescription>
            <CardTitle className="text-2xl font-bold text-gold">{openTickets}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border shadow-soft border-blue-500/50">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs text-blue-700">In Progress</CardDescription>
            <CardTitle className="text-2xl font-bold text-blue-700">{inProgressTickets}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border shadow-soft border-primary/50">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs text-primary">Resolved</CardDescription>
            <CardTitle className="text-2xl font-bold text-primary">{resolvedTickets}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="flex flex-col gap-1">
        {/* Filter Toolbar */}
        <Card className="p-4 border shadow-soft">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-55">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search by subject, user, email or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 text-sm"
              />
            </div>

            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">Status:</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-35 text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">Urgency:</Label>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-32.5 text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Tickets Table */}
        {isLoading ? (
          <TableSkeleton rows={5} cols={6} />
        ) : !tickets || tickets.length === 0 ? (
          <Card className="py-12 text-center p-6 border">
            <HelpCircle className="size-10 text-muted-foreground mx-auto mb-2" />
            <h3 className="font-semibold text-lg">No Support Tickets Found</h3>
            <p className="text-sm text-muted-foreground">
              No user problem reports match your active search filters.
            </p>
          </Card>
        ) : (
          <Card className="p-4 border-border/70 shadow-soft overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User / Contact</TableHead>
                  <TableHead>Subject & Category</TableHead>
                  <TableHead>Urgency</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((ticket: any) => (
                  <TableRow key={ticket.id}>
                    <TableCell>
                      <div className="font-medium text-xs">
                        {ticket.user?.name || "Unknown User"}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {ticket.user?.phone || ticket.user?.email}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-xs">{ticket.subject}</div>
                      <div className="text-[11px] text-muted-foreground capitalize">
                        {ticket.category.replace(/_/g, " ")} • {ticket.responseCount} messages
                      </div>
                    </TableCell>
                    <TableCell>{getPriorityBadge(ticket.priority)}</TableCell>
                    <TableCell>{getStatusBadge(ticket.status)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(ticket.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedTicketId(ticket.id);
                          setInternalNotes(ticket.adminNotes || "");
                        }}
                        className="h-7 text-xs gap-1"
                      >
                        Handle Request <ChevronRight className="size-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      {/* Ticket Management Drawer / Sheet */}
      <Sheet
        open={Boolean(selectedTicketId)}
        onOpenChange={(o) => {
          if (!o) {
            setSelectedTicketId(null);
            setIsChatExpanded(false);
          }
        }}
      >
        <SheetContent className="w-full sm:max-w-xl flex flex-col p-6 overflow-hidden">
          {!isChatExpanded && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
            >
              <SheetHeader className="pb-3 border-b">
                <SheetTitle className="text-lg font-bold flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span>Support Ticket Details</span>
                  </div>
                  {ticketDetail && getStatusBadge(ticketDetail.status)}
                </SheetTitle>
                <SheetDescription className="text-xs">
                  ID: {selectedTicketId} • Manage user problem request and communicate with
                  customer.
                </SheetDescription>
              </SheetHeader>
            </motion.div>
          )}

          {isLoadingDetail ? (
            <div className="py-12 flex h-full items-center justify-center">
              <LucideLoader className="size-6 animate-spin text-primary" />
            </div>
          ) : (
            ticketDetail && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="flex-1 flex flex-col overflow-hidden space-y-4"
              >
                {/* Collapsible Meta & Controls Cards */}
                <AnimatePresence initial={false}>
                  {!isChatExpanded && (
                    <motion.div
                      key="ticket-meta-cards"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.28, ease: "easeInOut" }}
                      className="space-y-4 overflow-hidden"
                    >
                      {/* User Info Bar */}
                      <div className="bg-muted/40 p-3 rounded-lg border text-xs space-y-1">
                        <div className="flex justify-between items-center font-semibold text-sm">
                          <span>{ticketDetail.userName}</span>
                          {getPriorityBadge(ticketDetail.priority)}
                        </div>
                        <div className="flex gap-4 text-muted-foreground text-[11px]">
                          {ticketDetail.userPhone && (
                            <span className="flex items-center gap-1">
                              <Phone className="size-3" /> {ticketDetail.userPhone}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Mail className="size-3" /> {ticketDetail.userEmail}
                          </span>
                        </div>
                      </div>

                      {/* Status & Urgency Controls */}
                      <div className="grid grid-cols-2 gap-3 bg-muted/20 p-3 rounded-lg border">
                        <div className="space-y-1">
                          <Label className="text-[11px] font-medium text-muted-foreground">
                            Ticket Status
                          </Label>
                          <Select
                            value={ticketDetail.status}
                            onValueChange={(val) =>
                              updateStatusMutation.mutate({
                                ticketId: ticketDetail.id,
                                status: val as "open" | "in_progress" | "resolved" | "closed",
                              })
                            }
                          >
                            <SelectTrigger className="h-8 text-xs bg-background">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="open">Open</SelectItem>
                              <SelectItem value="in_progress">In Progress</SelectItem>
                              <SelectItem value="resolved">Resolved</SelectItem>
                              <SelectItem value="closed">Closed</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[11px] font-medium text-muted-foreground">
                            Priority Level
                          </Label>
                          <Select
                            value={ticketDetail.priority}
                            onValueChange={(val) =>
                              updateStatusMutation.mutate({
                                ticketId: ticketDetail.id,
                                priority: val as "low" | "medium" | "high" | "urgent",
                              })
                            }
                          >
                            <SelectTrigger className="h-8 text-xs bg-background">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="urgent">Urgent</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Subject & Category */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-base">{ticketDetail.subject}</h4>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setIsChatExpanded((prev) => !prev)}
                      className="h-7 px-2.5 text-xs font-medium gap-1.5 shadow-xs transition-all"
                      title={
                        isChatExpanded
                          ? "Collapse chat window to view ticket info"
                          : "Expand chat window and hide details cards"
                      }
                    >
                      {isChatExpanded ? (
                        <>
                          <Minimize2 className="size-3.5 text-muted-foreground" />
                          Collapse
                        </>
                      ) : (
                        <>
                          <Maximize2 className="size-3.5 text-muted-foreground" />
                          Expand
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Category:{" "}
                    <span className="capitalize">{ticketDetail.category.replace(/_/g, " ")}</span>
                  </p>
                </div>

                {/* Thread History */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 py-4 border-t">
                  {ticketDetail.responses.map((resp: any) => (
                    <div
                      key={resp.id}
                      className={`flex flex-col max-w-[90%] ${
                        resp.isStaff ? "ml-auto items-end" : "mr-auto items-start"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1 text-[11px] text-muted-foreground">
                        {resp.isStaff ? (
                          <>
                            <ShieldCheck className="size-3.5 text-primary" />
                            <span className="font-medium text-primary">{resp.senderName}</span>
                          </>
                        ) : (
                          <>
                            <User className="size-3.5" />
                            <span className="font-medium">{resp.senderName}</span>
                          </>
                        )}
                        <span>• {new Date(resp.createdAt).toLocaleString()}</span>
                      </div>
                      <div
                        className={`p-3 rounded-2xl text-xs leading-relaxed ${
                          resp.isStaff
                            ? "bg-primary text-primary-foreground rounded-tr-none"
                            : "bg-muted border text-foreground rounded-tl-none"
                        }`}
                      >
                        {resp.message}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Agent Reply Box */}
                {ticketDetail.status === "resolved" || ticketDetail.status === "closed" ? (
                  <div className="bg-gold/10 border border-gold/20 rounded-lg p-3 text-xs text-gold flex items-start gap-2">
                    <AlertCircle className="size-4 shrink-0 text-gold mt-0.5" />
                    <div>
                      <p className="font-semibold">
                        Replies Disabled (
                        {ticketDetail.status === "resolved" ? "Resolved" : "Closed"})
                      </p>
                      <p className="text-[11px] opacity-90 mt-0.5">
                        This ticket is currently marked as{" "}
                        <strong>
                          {ticketDetail.status === "resolved" ? "Resolved" : "Closed"}
                        </strong>
                        . To send a reply, please change the ticket status above to{" "}
                        <strong>Open</strong> or <strong>In Progress</strong>.
                      </p>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSendAgentReply} className="space-y-2">
                    <Label className="text-xs font-semibold ml-1">Reply to Customer</Label>
                    <div className="flex gap-2 p-1">
                      <Input
                        placeholder="Type official response to user..."
                        value={agentReply}
                        onChange={(e) => setAgentReply(e.target.value)}
                        disabled={agentReplyMutation.isPending}
                        className="text-xs"
                      />
                      <Button
                        type="submit"
                        disabled={agentReplyMutation.isPending || !agentReply.trim()}
                        className="gap-1 px-4 self-end"
                      >
                        {agentReplyMutation.isPending ? (
                          <LucideLoader className="size-4 animate-spin" />
                        ) : (
                          <Send className="size-4" />
                        )}
                        Send
                      </Button>
                    </div>
                  </form>
                )}
              </motion.div>
            )
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
