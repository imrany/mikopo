import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/mpesa/b2c-result")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { prisma } = await import("@/lib/prisma");

        console.log(
          `[M-Pesa B2C Callback] Incoming HTTP POST received at ${new Date().toISOString()}`,
        );

        let body: Record<string, unknown> = {};
        try {
          body = (await request.json()) as Record<string, unknown>;
          console.log("[M-Pesa B2C Callback Payload]:", JSON.stringify(body, null, 2));
        } catch (err) {
          console.error("[M-Pesa B2C Callback] Failed to parse JSON body:", err);
          return Response.json({ ResultCode: 0, ResultDesc: "Ignored" });
        }

        const result = body["Result"] as Record<string, unknown> | undefined;
        const conversationId = result?.["ConversationID"] as string | undefined;
        const originatorConversationId = result?.["OriginatorConversationID"] as string | undefined;

        console.log(
          `[M-Pesa B2C Callback] ConversationID: "${conversationId ?? "NONE"}", OriginatorConversationID: "${originatorConversationId ?? "NONE"}"`,
        );

        if (!conversationId && !originatorConversationId) {
          console.warn("[M-Pesa B2C Callback] No ConversationID found. Returning Ignored.");
          return Response.json({ ResultCode: 0, ResultDesc: "Ignored" });
        }

        const resultCode = String(result?.["ResultCode"] ?? "1");
        const success = resultCode === "0";

        const tx = await prisma.mpesaTransaction.findFirst({
          where: {
            OR: [
              ...(conversationId ? [{ conversationId }] : []),
              ...(originatorConversationId ? [{ originatorConversationId }] : []),
            ],
          },
          select: { id: true, loanId: true, status: true },
        });

        if (!tx) {
          console.warn(
            `[M-Pesa B2C Callback] No matching MpesaTransaction found. Returning Accepted.`,
          );
          return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
        }

        if (tx.status !== "pending") {
          console.log(
            `[M-Pesa B2C Callback] Transaction ${tx.id} already processed with status "${tx.status}".`,
          );
          return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
        }

        await prisma.mpesaTransaction.update({
          where: { id: tx.id },
          data: {
            status: success ? "success" : "failed",
            resultCode,
            resultDesc: String(result?.["ResultDesc"] ?? ""),
            mpesaReceipt: (result?.["TransactionID"] as string | undefined) ?? null,
            payload: (body as object) ?? {},
          },
        });

        console.log(
          `[M-Pesa B2C Callback] Updated MpesaTransaction ${tx.id} to "${success ? "success" : "failed"}"`,
        );

        if (tx.loanId) {
          if (success) {
            await prisma.loan.update({
              where: { id: tx.loanId },
              data: { status: "active", disbursedAt: new Date() },
            });
            await prisma.loanStatusEvent.create({
              data: {
                loanId: tx.loanId,
                status: "active",
                previousStatus: "disbursing",
                note: "M-Pesa B2C payout confirmed successfully.",
              },
            });
            console.log(`[M-Pesa B2C Callback SUCCESS] Loan ${tx.loanId} marked as ACTIVE.`);
          } else {
            const desc = String(result?.["ResultDesc"] ?? "Payout failed");
            await prisma.loan.update({
              where: { id: tx.loanId },
              data: { status: "approved" },
            });
            await prisma.loanStatusEvent.create({
              data: {
                loanId: tx.loanId,
                status: "approved",
                previousStatus: "disbursing",
                note: `M-Pesa B2C payout failed: ${desc}. Reverted loan status to approved for retry.`,
              },
            });
            console.warn(`[M-Pesa B2C Callback FAILED] Loan ${tx.loanId} reverted to APPROVED.`);
          }
        }

        return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
      },
    },
  },
});
