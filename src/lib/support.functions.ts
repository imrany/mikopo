import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireCustomAuth } from "@/lib/auth-middleware";

const ticketCreateSchema = z.object({
  subject: z.string().trim().min(3).max(120),
  category: z.string().trim().default("general"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  message: z.string().trim().min(5).max(2000),
});

const responseCreateSchema = z.object({
  ticketId: z.string().uuid(),
  message: z.string().trim().min(2).max(2000),
});

const ticketUpdateSchema = z.object({
  ticketId: z.string().uuid(),
  status: z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  adminNotes: z.string().trim().max(1000).optional(),
  assignedTo: z.string().trim().optional(),
});

export const createSupportTicket = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((input: unknown) => ticketCreateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { handleCreateSupportTicket } = await import("./support.server");
    return handleCreateSupportTicket({ data, context });
  });

export const getMySupportTickets = createServerFn({ method: "GET" })
  .middleware([requireCustomAuth])
  .handler(async ({ context }) => {
    const { handleGetMySupportTickets } = await import("./support.server");
    return handleGetMySupportTickets({ context });
  });

export const getSupportTicketDetails = createServerFn({ method: "GET" })
  .middleware([requireCustomAuth])
  .validator((input: unknown) => z.object({ ticketId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { handleGetSupportTicketDetails } = await import("./support.server");
    return handleGetSupportTicketDetails({ data, context });
  });

export const addSupportResponse = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((input: unknown) => responseCreateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { handleAddSupportResponse } = await import("./support.server");
    return handleAddSupportResponse({ data, context });
  });

export const adminListSupportTickets = createServerFn({ method: "GET" })
  .middleware([requireCustomAuth])
  .validator((input: unknown) =>
    z
      .object({
        status: z.string().optional(),
        priority: z.string().optional(),
        search: z.string().optional(),
      })
      .optional()
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { handleAdminListSupportTickets } = await import("./support.server");
    return handleAdminListSupportTickets({ data, context });
  });

export const adminUpdateTicketStatus = createServerFn({ method: "POST" })
  .middleware([requireCustomAuth])
  .validator((input: unknown) => ticketUpdateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { handleAdminUpdateTicketStatus } = await import("./support.server");
    return handleAdminUpdateTicketStatus({ data, context });
  });
