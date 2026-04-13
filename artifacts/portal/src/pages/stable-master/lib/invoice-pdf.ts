import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface InvoiceLineItem {
  description: string;
  horseName: string;
  billDate: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  amount: number;
}

interface InvoiceDetails {
  id: string;
  invoiceDate: string;
  billingMonth: string | null;
  totalAmount: string;
  customerName: string;
  customerNumber: string;
  lineItems: InvoiceLineItem[];
}

function formatBillingMonth(billingMonth: string | null): string {
  if (!billingMonth) return "";
  const [y, m] = billingMonth.split("-");
  const date = new Date(parseInt(y), parseInt(m) - 1);
  return date.toLocaleString("en-US", { month: "long", year: "numeric" });
}

function formatBillingMonthShort(billingMonth: string | null): string {
  if (!billingMonth) return "";
  const [y, m] = billingMonth.split("-");
  const date = new Date(parseInt(y), parseInt(m) - 1);
  return `${date.toLocaleString("en-US", { month: "long" })}/${y}`;
}

const VAT_PERCENT = 5;

export function generateInvoicePDF(invoice: InvoiceDetails): jsPDF {
  const doc = new jsPDF("p", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const rightCol = pageWidth - margin;

  const monthLabel = formatBillingMonthShort(invoice.billingMonth);

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("ABU DHABI", margin, 20);
  doc.setFontSize(14);
  doc.text("EQUESTRIAN CLUB", margin, 26);

  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("Invoice Batch", rightCol, 20, { align: "right" });
  if (monthLabel) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`[${monthLabel}]`, rightCol, 28, { align: "right" });
  }

  const totalAmount = parseFloat(invoice.totalAmount);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("United Arab Emirates", margin, 40);
  doc.text("Al Mushrif West, Abu Dhabi", margin, 45);
  doc.text("PO Box 590, Abu Dhabi UAE", margin, 50);

  doc.setFillColor(200, 30, 30);
  doc.rect(pageWidth / 2 + 10, 36, rightCol - pageWidth / 2 - 10, 18, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text("Total Amount", pageWidth / 2 + 15, 43);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(`AED ${totalAmount.toFixed(2)}`, pageWidth / 2 + 15, 51);
  doc.setTextColor(0, 0, 0);

  let y = 62;
  doc.setFillColor(200, 30, 30);
  doc.rect(margin, y, pageWidth / 2 - margin - 5, 7, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Customer Information", margin + 2, y + 5);
  doc.setTextColor(0, 0, 0);

  doc.setFillColor(200, 30, 30);
  doc.rect(pageWidth / 2 + 10, y, rightCol - pageWidth / 2 - 10, 7, "F");
  doc.setTextColor(255, 255, 255);
  doc.text("Issuer Information", pageWidth / 2 + 12, y + 5);
  doc.setTextColor(0, 0, 0);

  y += 12;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Customer Number:", margin, y);
  doc.setFont("helvetica", "bold");
  doc.text(invoice.customerNumber || "-", margin + 40, y);

  doc.setFont("helvetica", "normal");
  doc.text("Company:", pageWidth / 2 + 10, y);
  doc.setFont("helvetica", "bold");
  doc.text("Abu Dhabi Equestrian Club", pageWidth / 2 + 30, y);

  y += 7;
  doc.setFont("helvetica", "normal");
  doc.text("Customer Name:", margin, y);
  doc.setFont("helvetica", "bold");
  doc.text(invoice.customerName, margin + 40, y);

  y += 7;
  doc.setFont("helvetica", "normal");
  doc.text("VAT Reg. Number:", margin, y);

  y += 12;

  const subtotal = invoice.lineItems.reduce((sum, li) => sum + li.amount, 0);
  const vatAmount = subtotal * (VAT_PERCENT / 100);
  const grandTotal = subtotal + vatAmount;

  const tableBody = invoice.lineItems.map((li, idx) => [
    (idx + 1).toString(),
    li.description,
    li.horseName,
    li.billDate || "",
    li.quantity.toFixed(4),
    li.unit,
    li.unitPrice.toFixed(2),
    (li.amount * VAT_PERCENT / 100).toFixed(2),
    (li.amount + li.amount * VAT_PERCENT / 100).toFixed(2),
  ]);

  autoTable(doc, {
    startY: y,
    head: [["#", "Ln. Description", "Horse", "Bill Date", "Qty", "Unit", "Amount", "Vat Amount", "Net Amount"]],
    body: tableBody,
    theme: "grid",
    headStyles: {
      fillColor: [80, 80, 80],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: "bold",
    },
    bodyStyles: {
      fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 40 },
      2: { cellWidth: 30 },
      3: { cellWidth: 22 },
      4: { cellWidth: 15, halign: "right" },
      5: { cellWidth: 15 },
      6: { cellWidth: 20, halign: "right" },
      7: { cellWidth: 20, halign: "right" },
      8: { cellWidth: 20, halign: "right" },
    },
    margin: { left: margin, right: margin },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || y + 40;
  let totalsY = finalY + 15;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");

  const labelX = pageWidth / 2;
  const valueX = rightCol;

  doc.text("Total (exc. VAT)", labelX, totalsY);
  doc.text(`AED ${subtotal.toFixed(2)}`, valueX, totalsY, { align: "right" });

  totalsY += 8;
  doc.text("Vat Percent", labelX, totalsY);
  doc.setFont("helvetica", "normal");
  doc.text(`${VAT_PERCENT}%`, valueX, totalsY, { align: "right" });

  totalsY += 8;
  doc.setFont("helvetica", "bold");
  doc.text("Vat Total", labelX, totalsY);
  doc.text(`AED ${vatAmount.toFixed(2)}`, valueX, totalsY, { align: "right" });

  totalsY += 8;
  doc.setFillColor(200, 30, 30);
  doc.rect(labelX - 2, totalsY - 5, rightCol - labelX + 4, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.text("Total Amount", labelX, totalsY);
  doc.text(`AED ${grandTotal.toFixed(2)}`, valueX, totalsY, { align: "right" });
  doc.setTextColor(0, 0, 0);

  const footerY = pageHeight - 25;
  doc.setDrawColor(200, 30, 30);
  doc.setLineWidth(0.5);
  doc.line(margin, footerY - 5, rightCol, footerY - 5);

  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("Abu Dhabi Equestrian Club", margin, footerY);
  doc.setFont("helvetica", "normal");
  doc.text("Al Mushrif - Abu Dhabi", margin, footerY + 4);
  doc.text("United Arab Emirates", margin, footerY + 8);

  doc.text("Tel: +971 2 445 5500", pageWidth / 3, footerY);
  doc.text("Fax: 02 445 5500", pageWidth / 3, footerY + 4);
  doc.setTextColor(0, 0, 200);
  doc.text("www.adec.ae/", pageWidth / 3, footerY + 8);
  doc.setTextColor(0, 0, 0);

  if (monthLabel) {
    doc.setFontSize(7);
    doc.text(`[${monthLabel}]`, margin, pageHeight - 8);
  }
  doc.text("1/1", rightCol, pageHeight - 8, { align: "right" });

  return doc;
}

export function viewInvoicePDF(invoice: InvoiceDetails) {
  const doc = generateInvoicePDF(invoice);
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
}

export function downloadInvoicePDF(invoice: InvoiceDetails) {
  const doc = generateInvoicePDF(invoice);
  const monthLabel = formatBillingMonthShort(invoice.billingMonth);
  const fileName = `Invoice_${invoice.customerName.replace(/\s+/g, "_")}_${monthLabel || invoice.invoiceDate}.pdf`;
  doc.save(fileName);
}
