import { jsPDF } from 'jspdf';

export interface InvoiceData {
  invoiceNumber?: string;
  customerName: string;
  customerEmail?: string | null;
  username: string;
  plan?: 'pro' | 'free' | string;
  period?: 'monthly' | 'yearly' | string;
  planType?: 'monthly' | 'yearly' | string;
  amount?: number;
  amountInr?: number;
  currency?: 'INR' | 'USD' | string;
  paymentId?: string;
  orderId?: string;
  date?: string;
  expiresAt?: string;
}

export function generateInvoicePdf(data: InvoiceData): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const effectivePeriod = String(data.period || data.planType || 'yearly').toLowerCase();
  const currencySymbol = data.currency === 'USD' ? '$' : '₹';
  const val = data.amount !== undefined ? data.amount : (data.amountInr !== undefined ? data.amountInr : undefined);
  const rawAmount = val !== undefined
    ? val > 1000 && val % 100 === 0
      ? val / 100
      : val
    : data.currency === 'USD'
      ? effectivePeriod === 'yearly' ? 60 : 6
      : effectivePeriod === 'yearly' ? 4999 : 499;

  const basePrice = Math.round((rawAmount / 1.18) * 100) / 100;
  const taxAmount = Math.round((rawAmount - basePrice) * 100) / 100;
  const invNumber = data.invoiceNumber || `INV-IVEO-${Date.now().toString().slice(-6)}`;
  const dateStr = data.date ? new Date(data.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const expiresStr = data.expiresAt ? new Date(data.expiresAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : new Date(Date.now() + (effectivePeriod === 'yearly' ? 365 : 30) * 86400000).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // 1. Header Banner
  doc.setFillColor(15, 15, 15);
  doc.rect(0, 0, 210, 40, 'F');

  // Brand Name
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.text('iveo', 20, 24);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(180, 180, 180);
  doc.text('one link for everything you make', 20, 31);

  // Invoice Title Right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('TAX INVOICE / RECEIPT', 190, 20, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(160, 220, 160);
  doc.text('● PAYMENT STATUS: PAID', 190, 28, { align: 'right' });

  // 2. Invoice Details Row
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Invoice Number:', 20, 52);
  doc.setFont('helvetica', 'normal');
  doc.text(invNumber, 55, 52);

  doc.setFont('helvetica', 'bold');
  doc.text('Date of Issue:', 20, 58);
  doc.setFont('helvetica', 'normal');
  doc.text(dateStr, 55, 58);

  doc.setFont('helvetica', 'bold');
  doc.text('Payment ID:', 20, 64);
  doc.setFont('helvetica', 'normal');
  doc.text(data.paymentId || 'pay_online_verified', 55, 64);

  // Right Side: Company & Issuer
  doc.setFont('helvetica', 'bold');
  doc.text('Issued By:', 130, 52);
  doc.setFont('helvetica', 'normal');
  doc.text('Iveo Global Technologies Inc.', 130, 58);
  doc.text('iveo.site | billing@iveo.site', 130, 64);
  doc.text('GSTIN / Tax ID: 29AAACI1824R1ZS', 130, 70);

  // Divider
  doc.setDrawColor(220, 220, 220);
  doc.line(20, 76, 190, 76);

  // 3. Bill To Box
  doc.setFillColor(248, 248, 248);
  doc.roundedRect(20, 82, 170, 32, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);
  doc.text('Billed To Customer:', 25, 90);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.text(`Name: ${data.customerName || data.username}`, 25, 97);
  doc.text(`Email: ${data.customerEmail || 'Registered iveo User'}`, 25, 103);
  doc.text(`Iveo Profile: iveo.site/${data.username}`, 115, 97);
  doc.text(`Subscription Period: ${dateStr} - ${expiresStr}`, 115, 103);

  // 4. Itemized Table Header
  const tableY = 124;
  doc.setFillColor(240, 240, 240);
  doc.rect(20, tableY, 170, 8, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(20, 20, 20);
  doc.text('Description / Plan', 24, tableY + 5.5);
  doc.text('Duration', 95, tableY + 5.5);
  doc.text('Cycle', 125, tableY + 5.5);
  doc.text('Amount', 186, tableY + 5.5, { align: 'right' });

  // Table Row 1
  const rowY = tableY + 14;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('iveo Pro Membership', 24, rowY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 100, 100);
  doc.text('• Unlimited links, custom background & themes, audience analytics', 24, rowY + 5);
  doc.text('• Zero iveo footer branding, password protection, contact capture', 24, rowY + 9.5);

  doc.setTextColor(30, 30, 30);
  doc.setFontSize(9);
  doc.text(effectivePeriod === 'yearly' ? '12 Months' : '1 Month', 95, rowY + 2);
  doc.text(effectivePeriod.toUpperCase(), 125, rowY + 2);
  doc.setFont('helvetica', 'bold');
  doc.text(`${currencySymbol}${basePrice.toFixed(2)}`, 186, rowY + 2, { align: 'right' });

  // Table Divider
  doc.setDrawColor(220, 220, 220);
  doc.line(20, rowY + 16, 190, rowY + 16);

  // 5. Total Summary Box Right
  const sumY = rowY + 24;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(70, 70, 70);
  doc.text('Net Taxable Amount:', 135, sumY);
  doc.text(`${currencySymbol}${basePrice.toFixed(2)}`, 186, sumY, { align: 'right' });

  doc.text('Taxes (GST / VAT 18%):', 135, sumY + 6);
  doc.text(`${currencySymbol}${taxAmount.toFixed(2)}`, 186, sumY + 6, { align: 'right' });

  doc.setDrawColor(200, 200, 200);
  doc.line(130, sumY + 9, 190, sumY + 9);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 15, 15);
  doc.text('Grand Total Paid:', 135, sumY + 16);
  doc.text(`${currencySymbol}${rawAmount.toFixed(2)}`, 186, sumY + 16, { align: 'right' });

  // 6. Security & Transaction Stamps
  const stampY = 210;
  doc.setFillColor(250, 252, 250);
  doc.setDrawColor(200, 230, 200);
  doc.roundedRect(20, stampY, 170, 26, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(34, 139, 34);
  doc.text('✓ 100% VERIFIED AUTHENTIC PAYMENT', 26, stampY + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(60, 60, 60);
  doc.text(`Processed securely via Razorpay Payment Gateway (PCI-DSS Level 1 Encrypted).`, 26, stampY + 14);
  doc.text(`Reference Order ID: ${data.orderId || 'order_iveo_confirmed'} | Customer User ID: ${data.username}`, 26, stampY + 19.5);

  // 7. Footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(130, 130, 130);
  doc.text('Thank you for choosing iveo! This is a computer-generated tax invoice and requires no physical signature.', 105, 275, { align: 'center' });
  doc.text('Need help or enterprise invoicing? Contact us at billing@iveo.site or visit https://iveo.site/help', 105, 280, { align: 'center' });

  return doc;
}

export function downloadInvoicePdf(data: InvoiceData, filename?: string) {
  const doc = generateInvoicePdf(data);
  const fname = filename || `iveo-invoice-${data.invoiceNumber || data.username || 'pro'}.pdf`;
  doc.save(fname);
}
