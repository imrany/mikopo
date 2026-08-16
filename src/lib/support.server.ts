import { prisma } from "@/lib/prisma";

interface TicketCreateData {
  subject: string;
  category: string;
  priority: "low" | "medium" | "high" | "urgent";
  message: string;
}

interface ResponseCreateData {
  ticketId: string;
  message: string;
}

interface TicketUpdateData {
  ticketId: string;
  status?: "open" | "in_progress" | "resolved" | "closed";
  priority?: "low" | "medium" | "high" | "urgent";
  adminNotes?: string;
  assignedTo?: string;
}

interface AuthContext {
  userId: string;
  email?: string;
  roles?: string[];
}

export async function handleCreateSupportTicket({
  data,
  context,
}: {
  data: TicketCreateData;
  context: AuthContext;
}) {
  const { userId } = context;

  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { firstName: true, lastName: true, email: true },
  });

  const ticket = await prisma.supportTicket.create({
    data: {
      userId,
      subject: data.subject,
      category: data.category,
      priority: data.priority,
      message: data.message,
      status: "open",
    },
  });

  const senderName = profile
    ? `${profile.firstName} ${profile.lastName}`.trim() || profile.email
    : "User";

  await prisma.supportResponse.create({
    data: {
      ticketId: ticket.id,
      senderId: userId,
      isStaff: false,
      senderName,
      message: data.message,
    },
  });

  // Notify admins
  try {
    const { sendSystemAlertToAdmins } = await import("./notifications.server");
    await sendSystemAlertToAdmins({
      title: `New Support Request: ${data.subject}`,
      message: `User ${senderName} reported an issue: "${data.subject}" (Category: ${data.category}, Priority: ${data.priority})`,
      link: `/admin/support?ticketId=${ticket.id}`,
    });
  } catch (err) {
    console.error("[createSupportTicket alert error]:", err);
  }

  return { ok: true as const, ticketId: ticket.id };
}

export async function handleGetMySupportTickets({ context }: { context: AuthContext }) {
  const { userId } = context;

  const tickets = await prisma.supportTicket.findMany({
    where: { userId },
    include: {
      responses: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return tickets.map((t: any) => ({
    id: t.id,
    subject: t.subject,
    category: t.category,
    priority: t.priority,
    status: t.status,
    message: t.message,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    lastResponse: t.responses[0]
      ? {
          senderName: t.responses[0].senderName,
          isStaff: t.responses[0].isStaff,
          message: t.responses[0].message,
          createdAt: t.responses[0].createdAt.toISOString(),
        }
      : null,
  }));
}

export async function handleGetSupportTicketDetails({
  data,
  context,
}: {
  data: { ticketId: string };
  context: AuthContext;
}) {
  const { userId, roles = [] } = context;
  const isStaff = roles.includes("super_admin") || roles.includes("staff");

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: data.ticketId },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
      responses: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!ticket) throw new Error("Support ticket not found.");
  if (ticket.userId !== userId && !isStaff) {
    throw new Error("Forbidden: You do not have access to this support ticket.");
  }

  return {
    id: ticket.id,
    userId: ticket.userId,
    userName: ticket.user
      ? `${ticket.user.firstName} ${ticket.user.lastName}`.trim() || ticket.user.email
      : "Unknown User",
    userEmail: ticket.user?.email ?? "",
    userPhone: ticket.user?.phone ?? "",
    subject: ticket.subject,
    category: ticket.category,
    priority: ticket.priority,
    status: ticket.status,
    message: ticket.message,
    adminNotes: ticket.adminNotes,
    assignedTo: ticket.assignedTo,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    responses: ticket.responses.map((r: any) => ({
      id: r.id,
      senderId: r.senderId,
      isStaff: r.isStaff,
      senderName: r.senderName,
      message: r.message,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

export async function handleAddSupportResponse({
  data,
  context,
}: {
  data: ResponseCreateData;
  context: AuthContext;
}) {
  const { userId, roles = [] } = context;
  const isStaff = roles.includes("super_admin") || roles.includes("staff");

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: data.ticketId },
  });
  if (!ticket) throw new Error("Support ticket not found.");

  if (ticket.userId !== userId && !isStaff) {
    throw new Error("Forbidden");
  }

  if (isStaff && (ticket.status === "resolved" || ticket.status === "closed")) {
    throw new Error(
      `This ticket is marked as ${ticket.status}. Please change the status to Open or In Progress before replying.`,
    );
  }

  const senderProfile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { firstName: true, lastName: true, email: true },
  });

  const senderName = isStaff
    ? `Support Agent (${senderProfile?.firstName || "Staff"})`
    : `${senderProfile?.firstName} ${senderProfile?.lastName}`.trim() ||
      senderProfile?.email ||
      "User";

  const newResponse = await prisma.supportResponse.create({
    data: {
      ticketId: data.ticketId,
      senderId: userId,
      isStaff,
      senderName,
      message: data.message,
    },
  });

  const wasResolvedOrClosed = ticket.status === "resolved" || ticket.status === "closed";

  let newStatus = ticket.status;
  if (isStaff && ticket.status === "open") {
    newStatus = "in_progress";
  } else if (!isStaff && wasResolvedOrClosed) {
    newStatus = "open";
  }

  await prisma.supportTicket.update({
    where: { id: data.ticketId },
    data: {
      status: newStatus,
      updatedAt: new Date(),
    },
  });

  if (!isStaff && wasResolvedOrClosed) {
    try {
      await prisma.auditLog.create({
        data: {
          actorId: userId,
          action: "support.ticket_reopened",
          targetType: "support_ticket",
          targetId: data.ticketId,
          details: {
            previousStatus: ticket.status,
            newStatus: "open",
            reason: "User replied to resolved/closed support ticket",
          },
        },
      });
    } catch (err) {
      console.error("[addSupportResponse audit log error]:", err);
    }
  }

  // Notify recipient
  if (isStaff) {
    await prisma.notification.create({
      data: {
        userId: ticket.userId,
        title: `Support Agent Responded to: ${ticket.subject}`,
        message: `A support representative replied to your ticket: "${data.message.slice(0, 100)}..."`,
        type: "info",
        link: `/dashboard?supportTicket=${ticket.id}`,
      },
    });
  } else {
    try {
      const { notifyAdminSupportReply } = await import("./notifications.server");
      await notifyAdminSupportReply({
        ticketId: ticket.id,
        subject: ticket.subject,
        userName: senderName,
        message: data.message,
        isReopened: wasResolvedOrClosed,
        previousStatus: ticket.status,
      });
    } catch (err) {
      console.error("[addSupportResponse alert error]:", err);
    }
  }

  return {
    id: newResponse.id,
    ticketId: newResponse.ticketId,
    senderId: newResponse.senderId,
    isStaff: newResponse.isStaff,
    senderName: newResponse.senderName,
    message: newResponse.message,
    createdAt: newResponse.createdAt.toISOString(),
    ticketStatus: newStatus,
    wasReopened: !isStaff && wasResolvedOrClosed,
  };
}

export async function handleAdminListSupportTickets({
  data,
  context,
}: {
  data?: { status?: string; priority?: string; search?: string };
  context: AuthContext;
}) {
  const { roles = [] } = context;
  if (!roles.includes("super_admin") && !roles.includes("staff")) {
    throw new Error("Forbidden");
  }

  const where: Record<string, unknown> = {};
  if (data?.status && data.status !== "all") {
    where.status = data.status;
  }
  if (data?.priority && data.priority !== "all") {
    where.priority = data.priority;
  }

  const tickets = await prisma.supportTicket.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
      responses: {
        select: { id: true, createdAt: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  let filtered = tickets;
  if (data?.search && data.search.trim()) {
    const q = data.search.trim().toLowerCase();
    filtered = tickets.filter(
      (t: any) =>
        t.subject.toLowerCase().includes(q) ||
        t.message.toLowerCase().includes(q) ||
        t.user?.firstName.toLowerCase().includes(q) ||
        t.user?.lastName.toLowerCase().includes(q) ||
        t.user?.email.toLowerCase().includes(q) ||
        t.user?.phone?.includes(q),
    );
  }

  return filtered.map((t: any) => ({
    id: t.id,
    subject: t.subject,
    category: t.category,
    priority: t.priority,
    status: t.status,
    message: t.message,
    adminNotes: t.adminNotes,
    assignedTo: t.assignedTo,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    responseCount: t.responses.length,
    user: t.user
      ? {
          id: t.user.id,
          name: `${t.user.firstName} ${t.user.lastName}`.trim() || t.user.email,
          email: t.user.email,
          phone: t.user.phone,
        }
      : null,
  }));
}

export async function handleAdminUpdateTicketStatus({
  data,
  context,
}: {
  data: TicketUpdateData;
  context: AuthContext;
}) {
  const { userId, roles = [] } = context;
  if (!roles.includes("super_admin") && !roles.includes("staff")) {
    throw new Error("Forbidden");
  }

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: data.ticketId },
  });
  if (!ticket) throw new Error("Support ticket not found.");

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (data.status) updateData.status = data.status;
  if (data.priority) updateData.priority = data.priority;
  if (data.adminNotes !== undefined) updateData.adminNotes = data.adminNotes;
  if (data.assignedTo !== undefined) updateData.assignedTo = data.assignedTo;

  await prisma.supportTicket.update({
    where: { id: data.ticketId },
    data: updateData,
  });

  await prisma.auditLog.create({
    data: {
      actorId: userId,
      action: "support.ticket_updated",
      targetType: "support_ticket",
      targetId: data.ticketId,
      details: { status: data.status, priority: data.priority },
    },
  });

  if (data.status && data.status !== ticket.status) {
    const statusLabels: Record<string, string> = {
      open: "Open",
      in_progress: "In Progress",
      resolved: "Resolved",
      closed: "Closed",
    };
    await prisma.notification.create({
      data: {
        userId: ticket.userId,
        title: `Support Ticket Updated: ${ticket.subject}`,
        message: `Your ticket status has been changed to "${statusLabels[data.status] || data.status}".`,
        type: data.status === "resolved" ? "success" : "info",
        link: `/dashboard?supportTicket=${ticket.id}`,
      },
    });
  }

  return { ok: true as const };
}
