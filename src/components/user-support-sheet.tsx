import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  HelpCircle,
  PlusCircle,
  Send,
  Clock,
  AlertCircle,
  LucideLoader,
  User,
  ShieldCheck,
  ChevronRight,
  ArrowLeft,
  Headphones,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LexicalRichEditor } from "@/components/lexical-editor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TicketSkeleton } from "@/components/ui/skeleton-loaders";
import { useAuth } from "@/lib/auth-context";
import { useAppConfig } from "@/lib/config-context";
import {
  createSupportTicket,
  getMySupportTickets,
  getSupportTicketDetails,
  addSupportResponse,
} from "@/lib/support.functions";
import { motion } from "motion/react";
import { useUrlBooleanState, useUrlStringState } from "@/lib/use-url-search-state";

export function UserSupportDialog({
  trigger,
  defaultOpen = false,
  initialTicketId,
}: {
  trigger?: React.ReactNode;
  defaultOpen?: boolean;
  initialTicketId?: string;
}) {
  const [open, setOpen] = useUrlBooleanState("support", defaultOpen);
  const [activeTabUrl, setActiveTabUrl] = useUrlStringState("supportTab", "tickets");
  const [selectedTicketId, setSelectedTicketId] = useUrlStringState(
    "supportTicket",
    initialTicketId ?? null,
  );

  const activeTab = (activeTabUrl === "create" ? "create" : "tickets") as "tickets" | "create";
  const setActiveTab = (t: "tickets" | "create") => setActiveTabUrl(t);

  const { token } = useAuth();
  const queryClient = useQueryClient();
  const { businessName } = useAppConfig();

  const getTicketsFn = useServerFn(getMySupportTickets);
  const getTicketDetailsFn = useServerFn(getSupportTicketDetails);
  const createTicketFn = useServerFn(createSupportTicket);
  const addResponseFn = useServerFn(addSupportResponse);

  // Form states
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("loan_issue");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [message, setMessage] = useState("");
  const [replyMessage, setReplyMessage] = useState("");

  const { data: tickets, isLoading: isLoadingTickets } = useQuery({
    queryKey: ["my-support-tickets", token],
    queryFn: () => getTicketsFn({ headers: { authorization: `Bearer ${token}` } }),
    enabled: Boolean(token) && open,
  });

  const { data: ticketDetail, isLoading: isLoadingDetail } = useQuery({
    queryKey: ["support-ticket-detail", selectedTicketId, token],
    queryFn: () =>
      getTicketDetailsFn({
        data: { ticketId: selectedTicketId! },
        headers: { authorization: `Bearer ${token}` },
      }),
    enabled: Boolean(token) && Boolean(selectedTicketId) && open,
  });

  const createTicketMutation = useMutation({
    mutationFn: (data: {
      subject: string;
      category: string;
      priority: "low" | "medium" | "high" | "urgent";
      message: string;
    }) => createTicketFn({ data, headers: { authorization: `Bearer ${token}` } }),
    onSuccess: (res) => {
      toast.success("Support ticket created successfully! An agent will respond shortly.");
      setSubject("");
      setMessage("");
      void queryClient.invalidateQueries({ queryKey: ["my-support-tickets"] });
      setSelectedTicketId(res.ticketId);
      setActiveTab("tickets");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to submit support ticket."),
  });

  const replyMutation = useMutation({
    mutationFn: (data: { ticketId: string; message: string }) =>
      addResponseFn({ data, headers: { authorization: `Bearer ${token}` } }),
    onSuccess: (res: { wasReopened?: boolean }) => {
      if (res?.wasReopened) {
        toast.success("Reply sent! Your ticket has been automatically reopened as Open.");
      } else {
        toast.success("Reply sent to customer support.");
      }
      setReplyMessage("");
      void queryClient.invalidateQueries({ queryKey: ["support-ticket-detail", selectedTicketId] });
      void queryClient.invalidateQueries({ queryKey: ["my-support-tickets"] });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to send reply."),
  });

  const handleSubmitTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      toast.error("Please fill in subject and message.");
      return;
    }
    createTicketMutation.mutate({ subject, category, priority, message });
  };

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicketId || !replyMessage.trim()) return;
    replyMutation.mutate({ ticketId: selectedTicketId, message: replyMessage });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return (
          <Badge variant="secondary" className="bg-gold/10 text-amber-600 border-amber-200">
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
          <Badge variant="default" className="bg-gray-500">
            Closed
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Headphones className="size-4 text-primary" />
            Support & Help
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col p-6 overflow-y-auto">
        {selectedTicketId ? (
          /* Ticket Detailed Conversation View */
          <div className="flex-1 flex flex-col overflow-hidden pt-3 space-y-4">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedTicketId(null)}
                className="gap-1.5 text-xs text-muted-foreground"
              >
                <ArrowLeft className="size-4" /> Back to My Tickets
              </Button>
              {ticketDetail && getStatusBadge(ticketDetail.status)}
            </div>

            {isLoadingDetail ? (
              <TicketSkeleton />
            ) : (
              ticketDetail && (
                <motion.div
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                  className="flex-1 flex flex-col min-h-0 space-y-4"
                >
                  <div className="bg-muted/40 p-4 rounded-lg border space-y-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-base">{ticketDetail.subject}</h3>
                      <Badge variant="outline" className="capitalize text-[11px]">
                        {ticketDetail.category.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Ticket ID: {ticketDetail.id.slice(0, 8)} • Created{" "}
                      {new Date(ticketDetail.createdAt).toLocaleString()}
                    </p>
                  </div>

                  {/* Message Thread */}
                  <div className="flex-1 overflow-y-auto space-y-3 pr-1 py-1 border-b">
                    {ticketDetail.responses.map((resp: any) => (
                      <div
                        key={resp.id}
                        className={`flex flex-col max-w-[85%] ${
                          resp.isStaff ? "mr-auto items-start" : "ml-auto items-end"
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
                              <span>You</span>
                            </>
                          )}
                          <span>
                            •{" "}
                            {new Date(resp.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <div
                          className={`p-3 rounded-2xl text-sm leading-relaxed ${
                            resp.isStaff
                              ? "bg-muted border text-foreground rounded-tl-none"
                              : "bg-primary text-primary-foreground rounded-tr-none"
                          }`}
                        >
                          {resp.message}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Reply Box */}
                  <div className="space-y-2 px-2 pb-2">
                    {ticketDetail.status === "resolved" && (
                      <div className="bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 px-3 py-2 rounded-lg text-xs flex items-center gap-2">
                        <AlertCircle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                        <span>
                          This ticket is marked as <strong>{ticketDetail.status}</strong>. Sending a
                          message reopens it automatically as <strong>Open</strong> for support
                          agents.
                        </span>
                      </div>
                    )}
                    <form onSubmit={handleSendReply} className="flex gap-2">
                      <Input
                        placeholder="Type your response to support agent..."
                        value={replyMessage}
                        onChange={(e) => setReplyMessage(e.target.value)}
                        disabled={replyMutation.isPending || ticketDetail.status === "closed"}
                        className="flex-1 text-sm"
                      />
                      <Button
                        type="submit"
                        disabled={
                          replyMutation.isPending ||
                          !replyMessage.trim() ||
                          ticketDetail.status === "closed"
                        }
                        size="sm"
                        className="gap-1.5"
                      >
                        {replyMutation.isPending ? (
                          <LucideLoader className="size-4 animate-spin" />
                        ) : (
                          <Send className="size-4" />
                        )}
                        Send
                      </Button>
                    </form>
                  </div>
                </motion.div>
              )
            )}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
          >
            <SheetHeader className="pb-2 border-b">
              <SheetTitle className="flex items-center gap-2 text-xl font-semibold">
                <HelpCircle className="size-6 text-primary" />
                {businessName} Customer Support
              </SheetTitle>
              <SheetDescription>
                Report issues, request assistance from our support agents, or track your inquiries.
              </SheetDescription>
            </SheetHeader>

            {/* Tabs: Ticket List vs Create New Ticket */}
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as "tickets" | "create")}
              className="flex-1 flex flex-col overflow-hidden pt-2"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="tickets" className="gap-2">
                  <Clock className="size-4" />
                  My Support Tickets ({tickets?.length ?? 0})
                </TabsTrigger>
                <TabsTrigger value="create" className="gap-2">
                  <PlusCircle className="size-4" />
                  Report New Problem
                </TabsTrigger>
              </TabsList>

              <TabsContent value="tickets" className="flex-1 overflow-y-auto mt-4 pr-1">
                {isLoadingTickets ? (
                  <TicketSkeleton />
                ) : !tickets || tickets.length === 0 ? (
                  <div className="py-12 text-center space-y-3">
                    <div className="mx-auto size-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                      <HelpCircle className="size-6" />
                    </div>
                    <h4 className="font-semibold">No support requests yet</h4>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                      Have a problem with loan disbursement, guarantors, or M-Pesa? Submit a request
                      to reach our support team.
                    </p>
                    <Button size="sm" onClick={() => setActiveTab("create")} className="gap-2 mt-2">
                      <PlusCircle className="size-4" /> Report an Issue
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {tickets.map((t: any) => (
                      <Card
                        key={t.id}
                        onClick={() => setSelectedTicketId(t.id)}
                        className="p-4 border hover:border-primary/50 cursor-pointer transition-colors shadow-none"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="font-semibold text-sm hover:text-primary transition-colors">
                              {t.subject}
                            </h4>
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                              {t.message}
                            </p>
                          </div>
                          {getStatusBadge(t.status)}
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-3 mt-2 border-t">
                          <span>Category: {t.category.replace(/_/g, " ")}</span>
                          <span className="flex items-center gap-1 font-medium text-primary">
                            View details & replies <ChevronRight className="size-3" />
                          </span>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="create" className="flex-1 overflow-y-auto mt-4">
                <form onSubmit={handleSubmitTicket} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="subject" className="text-xs">
                      Issue Subject *
                    </Label>
                    <Input
                      id="subject"
                      placeholder="e.g. Loan disbursement pending after approval"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="category" className="text-xs">
                        Category
                      </Label>
                      <Select value={category} onValueChange={setCategory}>
                        <SelectTrigger id="category">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="loan_issue">Loan & Disbursement</SelectItem>
                          <SelectItem value="guarantor_issue">Guarantors & Approvals</SelectItem>
                          <SelectItem value="mpesa_issue">M-Pesa Payment / Repayment</SelectItem>
                          <SelectItem value="account_issue">
                            Account & Phone Verification
                          </SelectItem>
                          <SelectItem value="general">General Inquiry</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="priority" className="text-xs">
                        Urgency Level
                      </Label>
                      <Select
                        value={priority}
                        onValueChange={(v) =>
                          setPriority(v as "low" | "medium" | "high" | "urgent")
                        }
                      >
                        <SelectTrigger id="priority">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low - General Question</SelectItem>
                          <SelectItem value="medium">Medium - Standard Assistance</SelectItem>
                          <SelectItem value="high">High - Urgent Issue</SelectItem>
                          <SelectItem value="urgent">Urgent - Blocking Transaction</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="message" className="text-xs">
                      Describe Your Problem in Detail *
                    </Label>
                    <LexicalRichEditor
                      id="message"
                      placeholder="Please explain what happened, including any relevant phone numbers or transaction IDs..."
                      value={message}
                      mode="markdown"
                      minHeight="140px"
                      showIconPicker={false}
                      onChange={(val) => setMessage(val)}
                    />
                  </div>

                  <div className="pt-2 flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setActiveTab("tickets")}>
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={
                        createTicketMutation.isPending || !subject.trim() || !message.trim()
                      }
                      className="gap-2"
                    >
                      {createTicketMutation.isPending && (
                        <LucideLoader className="size-4 animate-spin" />
                      )}
                      Submit Problem Report
                    </Button>
                  </div>
                </form>
              </TabsContent>
            </Tabs>
          </motion.div>
        )}
      </SheetContent>
    </Sheet>
  );
}
