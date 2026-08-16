import { jsPDF } from "jspdf";

export interface RepaymentReceipt {
  receiptId: string;
  loanId: string;
  borrowerName: string;
  borrowerPhone: string;
  amount: number;
  mpesaReceipt: string;
  paidAt: string;
  businessName: string;
  shortcode: string;
}

export function generateReceiptPDF(r: RepaymentReceipt): void {
  const doc = new jsPDF({ unit: "pt", format: "a5" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 32;

  doc.setFillColor(20, 60, 50);
  doc.rect(0, 0, pageWidth, 64, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(r.businessName, margin, 30);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Loan Repayment Receipt", margin, 48);

  doc.setTextColor(30, 30, 30);
  let y = 96;

  function field(label: string, value: string) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(label.toUpperCase(), margin, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(30, 30, 30);
    doc.text(value, margin, y + 16);
    y += 32;
  }

  field("Receipt No", r.receiptId);
  field("Loan Ref", r.loanId);
  field("Borrower", r.borrowerName);
  field("Phone", r.borrowerPhone);
  field("M-Pesa Ref", r.mpesaReceipt);

  const paidDate = new Date(r.paidAt).toLocaleString("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  field("Date Paid", paidDate);

  y += 8;
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, pageWidth - margin, y);
  y += 28;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text("AMOUNT PAID", margin, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(20, 100, 60);
  doc.text(`KES ${r.amount.toLocaleString("en-KE")}`, margin, y + 22);

  y += 52;
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, pageWidth - margin, y);
  y += 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`Paybill ${r.shortcode} - Keep this receipt for your records.`, margin, y);
  doc.text(`Generated ${new Date().toLocaleString("en-KE")}`, margin, y + 12);

  doc.save(`receipt-${r.receiptId}.pdf`);
}
