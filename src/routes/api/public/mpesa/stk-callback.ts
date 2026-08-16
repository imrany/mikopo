import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/mpesa/stk-callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { prisma } = await import("@/lib/prisma");
        const { recalcLoanAfterRepayment } = await import("@/lib/loans.server");

        console.log(
          `[M-Pesa STK Callback] Incoming HTTP POST received at ${new Date().toISOString()}`,
        );

        let body: Record<string, unknown> = {};
        try {
          body = (await request.json()) as Record<string, unknown>;
          console.log("[M-Pesa STK Callback Payload]:", JSON.stringify(body, null, 2));
        } catch (err) {
          console.error("[M-Pesa STK Callback] Failed to parse JSON body:", err);
          return Response.json({ ResultCode: 0, ResultDesc: "Ignored" });
        }

        // Support multiple nesting formats: Safaricom Body.stkCallback, top-level stkCallback, or flattened body
        const stkCallbackObj =
          (body["Body"] as { stkCallback?: Record<string, unknown> } | undefined)?.stkCallback ??
          (body["stkCallback"] as Record<string, unknown> | undefined) ??
          body;

        const checkoutId =
          (stkCallbackObj["CheckoutRequestID"] as string | undefined) ??
          (stkCallbackObj["checkoutRequestId"] as string | undefined) ??
          (body["CheckoutRequestID"] as string | undefined) ??
          (body["checkoutRequestId"] as string | undefined);

        const merchantId =
          (stkCallbackObj["MerchantRequestID"] as string | undefined) ??
          (stkCallbackObj["merchantRequestId"] as string | undefined) ??
          (body["MerchantRequestID"] as string | undefined);

        console.log(
          `[M-Pesa STK Callback] Extracted CheckoutRequestID: "${checkoutId ?? "NONE"}", MerchantRequestID: "${merchantId ?? "NONE"}"`,
        );

        if (!checkoutId && !merchantId) {
          console.warn(
            "[M-Pesa STK Callback] No CheckoutRequestID or MerchantRequestID found in payload. Returning Ignored.",
          );
          return Response.json({ ResultCode: 0, ResultDesc: "Ignored" });
        }

        const resultCode = String(
          stkCallbackObj["ResultCode"] ?? stkCallbackObj["resultCode"] ?? body["ResultCode"] ?? "1",
        );
        const resultDesc = String(
          stkCallbackObj["ResultDesc"] ?? stkCallbackObj["resultDesc"] ?? body["ResultDesc"] ?? "",
        );

        const items =
          (stkCallbackObj["CallbackMetadata"] as { Item?: { Name: string; Value?: unknown }[] })
            ?.Item ?? [];

        const receipt =
          (items.find((i) => i.Name === "MpesaReceiptNumber")?.Value as string | undefined) ??
          (stkCallbackObj["MpesaReceiptNumber"] as string | undefined) ??
          (stkCallbackObj["mpesaReceipt"] as string | undefined);

        const paidAmountRaw =
          items.find((i) => i.Name === "Amount")?.Value ??
          stkCallbackObj["Amount"] ??
          stkCallbackObj["amount"];
        const paidAmount = Number(paidAmountRaw || 0);

        console.log(
          `[M-Pesa STK Callback Details] ResultCode: ${resultCode}, ResultDesc: "${resultDesc}", Receipt: "${receipt ?? "NONE"}", PaidAmount: KES ${paidAmount}`,
        );

        // Lookup transaction by checkoutRequestId or merchantRequestId
        const tx = await prisma.mpesaTransaction.findFirst({
          where: {
            OR: [
              ...(checkoutId ? [{ checkoutRequestId: checkoutId }] : []),
              ...(merchantId ? [{ merchantRequestId: merchantId }] : []),
            ],
          },
          select: { id: true, loanId: true, userId: true, amount: true, status: true },
        });

        if (!tx) {
          console.warn(
            `[M-Pesa STK Callback Warning] No MpesaTransaction record found in database matching checkoutId: "${checkoutId}" or merchantId: "${merchantId}". Returning Accepted.`,
          );
          return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
        }

        console.log(
          `[M-Pesa STK Callback] Found MpesaTransaction ID: "${tx.id}", LoanID: "${tx.loanId}", Current Status: "${tx.status}"`,
        );

        if (tx.status === "success") {
          console.log(
            `[M-Pesa STK Callback] Transaction ${tx.id} is already marked as success. Avoiding duplicate repayment creation.`,
          );
          return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
        }

        const success = resultCode === "0";

        await prisma.mpesaTransaction.update({
          where: { id: tx.id },
          data: {
            status: success ? "success" : "failed",
            resultCode,
            resultDesc,
            mpesaReceipt: receipt ?? null,
            payload: (body as object) ?? {},
          },
        });

        console.log(
          `[M-Pesa STK Callback] Updated MpesaTransaction ${tx.id} status to: "${success ? "success" : "failed"}"`,
        );

        if (success && tx.loanId) {
          const targetUserId = tx.userId;
          const finalAmount = paidAmount > 0 ? paidAmount : Number(tx.amount);

          if (!targetUserId) {
            console.error(
              `[M-Pesa STK Callback Error] MpesaTransaction ${tx.id} is missing userId!`,
            );
          }

          // Check for duplicate repayment with same mpesaReceipt on this loan
          const existingRepayment = receipt
            ? await prisma.loanRepayment.findFirst({
                where: { loanId: tx.loanId, mpesaReceipt: receipt },
              })
            : null;

          if (existingRepayment) {
            console.warn(
              `[M-Pesa STK Callback] Repayment with receipt "${receipt}" already exists in DB. Skipping duplicate insertion.`,
            );
          } else if (targetUserId) {
            const repayment = await prisma.loanRepayment.create({
              data: {
                loanId: tx.loanId,
                userId: targetUserId,
                amount: finalAmount,
                mpesaReceipt: receipt ?? null,
              },
            });
            console.log(
              `[M-Pesa STK Callback SUCCESS] Created LoanRepayment ID: "${repayment.id}" for KES ${finalAmount}`,
            );

            const loan = await prisma.loan.findUnique({
              where: { id: tx.loanId },
              select: { id: true, totalDue: true, amountRepaid: true, status: true },
            });

            if (loan) {
              const newRepaid = Number(loan.amountRepaid) + finalAmount;
              await prisma.loan.update({
                where: { id: tx.loanId },
                data: { amountRepaid: newRepaid },
              });

              console.log(
                `[M-Pesa STK Callback SUCCESS] Updated Loan ${loan.id}: Previous Repaid = KES ${loan.amountRepaid}, New Total Repaid = KES ${newRepaid}, Total Due = KES ${loan.totalDue}`,
              );

              await recalcLoanAfterRepayment(tx.loanId);

              const updatedLoan = await prisma.loan.findUnique({
                where: { id: tx.loanId },
                select: { status: true },
              });
              console.log(
                `[M-Pesa STK Callback SUCCESS] Loan status after recalculation: "${updatedLoan?.status}"`,
              );

              try {
                const { notifyRepaymentReceived } = await import("@/lib/notifications.server");
                const remaining = Math.max(0, Number(loan.totalDue) - newRepaid);
                await notifyRepaymentReceived({
                  loanId: tx.loanId,
                  userId: targetUserId,
                  amount: finalAmount,
                  mpesaReceipt: receipt ?? undefined,
                  totalRemaining: remaining,
                  isFullyRepaid: remaining === 0,
                });
                console.log(
                  `[M-Pesa STK Callback] Sent repayment notification to User "${targetUserId}"`,
                );
              } catch (err) {
                console.error("[M-Pesa STK Callback Notification Error]:", err);
              }
            } else {
              console.error(
                `[M-Pesa STK Callback Error] Loan ID "${tx.loanId}" not found in database!`,
              );
            }
          }
        } else if (!success) {
          console.warn(
            `[M-Pesa STK Callback Failed] Payment was not successful. ResultCode: ${resultCode}, Message: "${resultDesc}"`,
          );
        }

        return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
      },
    },
  },
});
