import React, { useState } from 'react';
import { Printer, X, CheckCircle2, FileDown, Share2, Copy, Check, ExternalLink } from 'lucide-react';
import { Sale } from '../../types';
import { BarcodeSvg } from '../common/BarcodeSvg';
import { QrCodeSvg } from '../common/QrCodeSvg';
import { generateBarcodeBase64Png, generateQrCodeBase64Png } from '../../utils/receiptBarcodeGenerator';
import { apiRequest } from '../../services/api';

interface ReceiptModalProps {
  sale: Sale;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ sale, onClose }) => {
  const [printFormat, setPrintFormat] = useState<'thermal' | 'a4'>('thermal');
  const [loadingFee, setLoadingFee] = useState<number>(Number(sale.loading_fee || 0));
  const [isSavingFee, setIsSavingFee] = useState(false);
  const [showCopiedToast, setShowCopiedToast] = useState(false);
  const [pdfNotification, setPdfNotification] = useState<string | null>(null);
  const [downloadNotification, setDownloadNotification] = useState<{
    isOpen: boolean;
    message: string;
    fileName: string;
    htmlContent: string;
  } | null>(null);

  const settings = sale.settings || {
    store_name: 'Pakistan Building Materials & paint store',
    owner_name: 'Imtiaz Ali',
    address: 'Main Wholesale Market, Building Materials Boulevard, Shop #14-18',
    phone: '+92 300 5936652 / +92 300 1801818',
    email: 'imtayazautos@gmail.com',
    currency: 'Rs.',
    invoice_footer: 'Thank you for your business! Goods once sold can be exchanged within 7 days with original invoice.',
  };

  // Financial calculations for returns & Net Payable Amount
  const returnedAmount = Number(sale.returned_amount || 0);
  const hasReturns = returnedAmount > 0;

  // Track initial fee from invoice so fee adjustments calculate difference accurately
  const initialLoadingFee = Number(sale.loading_fee || 0);
  const feeDelta = (Number(loadingFee) || 0) - initialLoadingFee;

  const originalGrandTotal = Number(sale.original_grand_total || (sale.grand_total + returnedAmount));
  const baseNetPayableTotal = Number(
    sale.net_total !== undefined
      ? sale.net_total
      : hasReturns
      ? originalGrandTotal - returnedAmount
      : sale.grand_total
  );

  // Dynamic real-time totals with Loading / Unloading fee included
  const effectiveGrandTotal = Math.max(0, Math.round((Number(sale.grand_total || 0) + feeDelta) * 100) / 100);
  const effectiveNetTotal = Math.max(0, Math.round((baseNetPayableTotal + feeDelta) * 100) / 100);
  const effectiveDueAmount = Math.max(0, Math.round((Number(sale.due_amount || 0) + feeDelta) * 100) / 100);

  // Delivery status calculation
  const totalPurchasedQty = sale.total_purchased_qty !== undefined
    ? Number(sale.total_purchased_qty)
    : (sale.items || []).reduce((sum, it) => sum + Number(it.quantity || 0), 0);

  const totalDeliveredQty = sale.total_delivered_qty !== undefined
    ? Number(sale.total_delivered_qty)
    : (sale.items || []).reduce((sum, it) => sum + Number(it.delivered_quantity !== undefined ? it.delivered_quantity : it.quantity), 0);

  const totalRemainingDelivery = Math.max(0, totalPurchasedQty - totalDeliveredQty);

  const deliveryStatus = sale.delivery_status || (
    totalRemainingDelivery === 0 ? 'DELIVERED' : totalDeliveredQty > 0 ? 'PARTIAL' : 'PENDING'
  );

  // Barcode / QR Code encodes the updated Net Payable amount
  const qrString = `INVOICE:${sale.invoice_number}|AMT:${effectiveNetTotal}|DUE:${effectiveDueAmount}`;

  // Build clean, standalone HTML document for printing / PDF saving (0 dependencies, 100% reliable)
  const generateReceiptHtml = (format: 'thermal' | 'a4') => {
    const storeName = settings.store_name || 'Pakistan Building Materials & Paint Store';
    const ownerName = settings.owner_name || 'Imtiaz Ali';
    const address = settings.address || '';
    const phone = settings.phone || '+92 300 5936652';
    const email = settings.email || '';
    const footer = settings.invoice_footer || 'Thank you for your business! Goods once sold can be exchanged within 7 days with original invoice.';
    const saleDateObj = new Date(sale.sale_date);
    const invoiceDate = saleDateObj.toLocaleDateString('en-PK', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    const invoiceTime = saleDateObj.toLocaleTimeString('en-PK', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    const fullDateTime = `${invoiceDate} ${invoiceTime}`;

    // Generate crisp Base64 PNG data URLs so barcodes and QR codes are 100% visible in print/PDF
    const barcodeBase64A4 = generateBarcodeBase64Png(sale.invoice_number, 170, 40);
    const qrBase64A4 = generateQrCodeBase64Png(qrString, 72);
    const barcodeBase64Thermal = generateBarcodeBase64Png(sale.invoice_number, 185, 42);
    const qrBase64Thermal = generateQrCodeBase64Png(qrString, 68);

    if (format === 'a4') {
      const itemsHtml = (sale.items || []).map((it, idx) => {
        const delivered = it.delivered_quantity !== undefined ? it.delivered_quantity : it.quantity;
        const returned = Number(it.returned_quantity || 0);
        const remaining = Math.max(0, it.quantity - returned - delivered);
        const delNote = remaining > 0 
          ? `<br><span style="font-size: 10px; color: #b45309; font-weight: bold;">(Delivered: ${delivered} | ⚠️ Pending Pickup: ${remaining} ${it.unit || 'pcs'})</span>` 
          : `<br><span style="font-size: 10px; color: #047857;">(Delivered: ${delivered})</span>`;
        return `
          <tr>
            <td style="border: 1px solid #9ca3af; padding: 6px 8px; text-align: center;">${idx + 1}</td>
            <td style="border: 1px solid #9ca3af; padding: 6px 8px;"><strong>${it.product_name}</strong>${delNote}</td>
            <td style="border: 1px solid #9ca3af; padding: 6px 8px; text-align: center;">${it.quantity} ${it.unit || 'pcs'}</td>
            <td style="border: 1px solid #9ca3af; padding: 6px 8px; text-align: right;">Rs. ${(it.unit_price || 0).toLocaleString()}</td>
            <td style="border: 1px solid #9ca3af; padding: 6px 8px; text-align: right; font-weight: bold;">Rs. ${(it.line_total || 0).toLocaleString()}</td>
          </tr>
        `;
      }).join('');

      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invoice #${sale.invoice_number} - ${storeName}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 10mm 15mm 10mm;
      @bottom-right {
        content: "Page " counter(page) " of " counter(pages);
        font-size: 10px;
        color: #4b5563;
      }
      @bottom-left {
        content: "Printed: " "${fullDateTime}";
        font-size: 9px;
        color: #6b7280;
      }
    }
    * {
      box-sizing: border-box;
    }
    body {
      margin: 0;
      padding: 10mm;
      background: #ffffff !important;
      color: #000000 !important;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 12px;
      line-height: 1.4;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    img, svg {
      display: block !important;
      visibility: visible !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    .header-tbl {
      border-bottom: 2px solid #000000;
      padding-bottom: 8px;
      margin-bottom: 12px;
    }
    .header-tbl td {
      border: none;
      vertical-align: top;
    }
    .store-title {
      font-size: 18px;
      font-weight: 900;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .meta-box {
      border: 1px solid #d1d5db;
      background: #f9fafb !important;
      padding: 8px 12px;
      margin-bottom: 12px;
      border-radius: 4px;
    }
    .meta-box td {
      border: none;
      padding: 3px 6px;
      font-size: 11.5px;
    }
    .items-table th {
      border: 1px solid #9ca3af;
      background-color: #f3f4f6 !important;
      font-weight: bold;
      font-size: 11px;
      text-transform: uppercase;
      padding: 6px 8px;
    }
    .totals-tbl {
      width: 320px;
      margin-left: auto;
      margin-top: 10px;
    }
    .totals-tbl td {
      border: none;
      padding: 4px 6px;
      font-size: 12px;
    }
    .grand-row td {
      border-top: 2px solid #000 !important;
      border-bottom: 2px solid #000 !important;
      font-weight: 900;
      font-size: 14px;
    }
    .due-row td {
      color: #b91c1c;
      font-weight: bold;
    }
    .delivery-alert {
      margin-top: 12px;
      padding: 8px 12px;
      border: 1px solid #f59e0b;
      background-color: #fffbeb !important;
      border-radius: 4px;
      font-size: 11px;
    }
    .signatures {
      margin-top: 35px;
    }
    .signatures td {
      border: none;
      width: 50%;
      text-align: center;
      padding: 0 30px;
    }
    .sign-line {
      border-top: 1px solid #4b5563;
      padding-top: 5px;
      font-size: 11px;
      color: #374151;
    }
    .footer {
      margin-top: 20px;
      text-align: center;
      font-size: 10.5px;
      color: #4b5563;
      border-top: 1px dashed #d1d5db;
      padding-top: 8px;
    }
    @media print {
      body {
        padding: 0;
      }
      img, svg {
        display: block !important;
        visibility: visible !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }
  </style>
</head>
<body>
  <table class="header-tbl">
    <tr>
      <td>
        <div class="store-title">${storeName}</div>
        <div><strong>Proprietor:</strong> ${ownerName}</div>
        <div>Hardware, Sanitary, Pipes, Paints & Building Materials</div>
        <div>${address}</div>
        <div>Phone: ${phone} ${email ? `| Email: ${email}` : ''}</div>
      </td>
      <td style="text-align: right;">
        <div style="display: inline-block; background: #000; color: #fff; padding: 4px 10px; font-weight: bold; font-size: 11px; text-transform: uppercase; margin-bottom: 4px;">
          SALES TAX INVOICE
        </div>
        <div style="font-size: 15px; font-weight: bold;">${sale.invoice_number}</div>
        <div style="color: #4b5563; font-size: 11px;">Date: <strong>${invoiceDate}</strong></div>
        <div style="color: #4b5563; font-size: 11px;">Time: <strong>${invoiceTime}</strong></div>
      </td>
    </tr>
  </table>

  <div class="meta-box">
    <table>
      <tr>
        <td style="width: 50%;"><strong>Customer:</strong> ${sale.customer_name || 'Walk-in Customer'}</td>
        <td style="width: 50%;"><strong>Payment Method:</strong> ${sale.payment_method}</td>
      </tr>
      <tr>
        <td><strong>Phone:</strong> ${sale.customer_phone || 'N/A'}</td>
        <td><strong>Cashier:</strong> ${sale.cashier_name || 'Imtiaz Ali'}</td>
      </tr>
      <tr>
        <td><strong>Delivery Status:</strong> ${deliveryStatus}</td>
        <td><strong>Branch:</strong> ${sale.branch_name || 'Main Store'}</td>
      </tr>
    </table>
  </div>

  <table class="items-table">
    <thead>
      <tr>
        <th style="width: 5%; text-align: center;">#</th>
        <th style="width: 45%; text-align: left;">Item Description</th>
        <th style="width: 15%; text-align: center;">Quantity</th>
        <th style="width: 15%; text-align: right;">Rate (Rs.)</th>
        <th style="width: 20%; text-align: right;">Line Total (Rs.)</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
  </table>

  <table class="totals-tbl">
    <tr>
      <td>Subtotal:</td>
      <td style="text-align: right;">Rs. ${(sale.subtotal || 0).toLocaleString()}</td>
    </tr>
    ${sale.discount_amount > 0 ? `
    <tr style="color: #047857;">
      <td>Discount:</td>
      <td style="text-align: right;">-Rs. ${sale.discount_amount.toLocaleString()}</td>
    </tr>` : ''}
    ${sale.tax_amount > 0 ? `
    <tr>
      <td>Tax:</td>
      <td style="text-align: right;">Rs. ${sale.tax_amount.toLocaleString()}</td>
    </tr>` : ''}
    ${loadingFee > 0 ? `
    <tr style="font-weight: bold;">
      <td>Loading / Unloading Fee:</td>
      <td style="text-align: right;">Rs. ${loadingFee.toLocaleString()}</td>
    </tr>` : ''}
    <tr class="grand-row">
      <td>GRAND TOTAL:</td>
      <td style="text-align: right;">Rs. ${effectiveGrandTotal.toLocaleString()}</td>
    </tr>
    <tr>
      <td>Paid Amount:</td>
      <td style="text-align: right;">Rs. ${(sale.paid_amount || 0).toLocaleString()}</td>
    </tr>
    ${effectiveDueAmount > 0 ? `
    <tr class="due-row">
      <td>Current Balance Due:</td>
      <td style="text-align: right;">Rs. ${effectiveDueAmount.toLocaleString()}</td>
    </tr>` : `
    <tr style="color: #047857; font-weight: bold;">
      <td>Payment Status:</td>
      <td style="text-align: right;">FULL PAID</td>
    </tr>`}
  </table>

  ${totalRemainingDelivery > 0 ? `
  <div class="delivery-alert">
    <strong>📦 Pending Pickup:</strong> ${totalRemainingDelivery} units pending collection by customer.
  </div>` : ''}

  <!-- Barcode & QR Code Electronic Verification Section -->
  <table style="width: 100%; margin-top: 18px; border-top: 1px dashed #9ca3af; padding-top: 10px;">
    <tr>
      <td style="vertical-align: middle; width: 62%; border: none; padding: 0;">
        <table style="border: none; border-collapse: collapse;">
          <tr>
            <td style="border: none; vertical-align: middle; padding-right: 12px; width: 74px;">
              ${qrBase64A4 ? `<img src="${qrBase64A4}" width="68" height="68" alt="Invoice QR" style="display: block; border: 1px solid #9ca3af; padding: 2px; background: #ffffff;" />` : ''}
            </td>
            <td style="border: none; vertical-align: middle;">
              <div style="font-weight: bold; text-transform: uppercase; font-size: 11px; color: #111827;">Electronic Verification</div>
              <div style="color: #6b7280; font-size: 9.5px; margin-top: 1px;">Scan QR or barcode at POS terminal for instant bill lookup & balance settlement.</div>
              <div style="margin-top: 5px;">
                ${barcodeBase64A4 ? `<img src="${barcodeBase64A4}" width="160" height="38" alt="Barcode ${sale.invoice_number}" style="display: block;" />` : ''}
              </div>
            </td>
          </tr>
        </table>
      </td>
      <td style="vertical-align: middle; width: 38%; text-align: right; border: none; padding: 0;">
        <div style="font-size: 12px; font-weight: bold; color: #111827;">INVOICE: ${sale.invoice_number}</div>
        <div style="font-size: 10px; color: #6b7280; margin-top: 2px;">Pakistan Building Materials & Paint Store</div>
        <div style="font-size: 9.5px; color: #047857; font-weight: bold; margin-top: 2px;">✓ Verified Genuine Digital Receipt</div>
      </td>
    </tr>
  </table>

  <table class="signatures">
    <tr>
      <td><div class="sign-line">Customer Signature</div></td>
      <td><div class="sign-line">Authorized Store Stamp</div></td>
    </tr>
  </table>

  <div class="footer">
    ${footer}<br>
    Store Helpline: ${phone} • Generated on ${fullDateTime}
    <div style="font-size: 9.5px; color: #6b7280; margin-top: 4px;">Page 1 of 1 • Official Business Copy</div>
  </div>
</body>
</html>`;
    } else {
      // 80mm Thermal Slip format
      const thermalItemsHtml = (sale.items || []).map((it) => {
        const delivered = it.delivered_quantity !== undefined ? it.delivered_quantity : it.quantity;
        const returned = Number(it.returned_quantity || 0);
        const rem = it.quantity - returned - delivered;
        const remText = rem > 0 ? ` [Rem: ${rem}]` : '';
        return `
          <tr>
            <td colspan="2" style="padding-top: 3px; font-weight: bold;">${it.product_name}${remText}</td>
          </tr>
          <tr>
            <td style="color: #555; font-size: 10px;">${it.quantity} ${it.unit || 'pcs'} @ ${it.unit_price}</td>
            <td style="text-align: right; font-weight: bold; font-size: 11px;">Rs. ${(it.line_total || 0).toLocaleString()}</td>
          </tr>
        `;
      }).join('');

      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Receipt #${sale.invoice_number}</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 2mm;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0 auto;
      padding: 3mm 2mm;
      width: 76mm;
      max-width: 76mm;
      background: #ffffff !important;
      color: #000000 !important;
      font-family: 'Courier New', Courier, monospace, Arial, sans-serif;
      font-size: 11px;
      line-height: 1.3;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    img, svg {
      display: block !important;
      visibility: visible !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .center { text-align: center; }
    .store-name { font-size: 13px; font-weight: 900; text-transform: uppercase; margin-bottom: 2px; }
    .divider { border-top: 1px dashed #000; margin: 5px 0; }
    table { width: 100%; border-collapse: collapse; }
    td { vertical-align: top; }
    .bold { font-weight: bold; }
    .right { text-align: right; }
    @media print {
      body { padding: 0; }
      img, svg {
        display: block !important;
        visibility: visible !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }
  </style>
</head>
<body>
  <div class="center">
    <div class="store-name">${storeName}</div>
    <div style="font-size: 10px;">${address}</div>
    <div style="font-size: 10px;">Tel: ${phone}</div>
    <div style="display: inline-block; background: #000; color: #fff; padding: 1px 5px; font-weight: bold; font-size: 9px; margin-top: 3px;">
      CASH / SALES MEMO
    </div>
  </div>

  <div class="divider"></div>

  <table>
    <tr><td>Inv #: <span class="bold">${sale.invoice_number}</span></td><td class="right">${invoiceDate}</td></tr>
    <tr><td>Time: <span class="bold">${invoiceTime}</span></td><td class="right">${sale.payment_method}</td></tr>
    <tr><td>Cust: <span class="bold">${sale.customer_name || 'Walk-in'}</span></td><td class="right">${sale.customer_phone || ''}</td></tr>
    <tr><td>Cashier: ${sale.cashier_name || 'Imtiaz Ali'}</td><td class="right">${sale.branch_name || 'Main Store'}</td></tr>
  </table>

  <div class="divider"></div>

  <table>
    ${thermalItemsHtml}
  </table>

  <div class="divider"></div>

  <table>
    <tr><td>Subtotal:</td><td class="right">Rs. ${(sale.subtotal || 0).toLocaleString()}</td></tr>
    ${sale.discount_amount > 0 ? `<tr><td>Discount:</td><td class="right">-Rs. ${sale.discount_amount.toLocaleString()}</td></tr>` : ''}
    ${sale.tax_amount > 0 ? `<tr><td>Tax:</td><td class="right">Rs. ${sale.tax_amount.toLocaleString()}</td></tr>` : ''}
    ${loadingFee > 0 ? `<tr><td class="bold">Loading Fee:</td><td class="right bold">Rs. ${loadingFee.toLocaleString()}</td></tr>` : ''}
    <tr style="font-size: 12.5px; font-weight: 900;"><td>GRAND TOTAL:</td><td class="right">Rs. ${effectiveGrandTotal.toLocaleString()}</td></tr>
    <tr><td>Paid:</td><td class="right">Rs. ${(sale.paid_amount || 0).toLocaleString()}</td></tr>
    ${effectiveDueAmount > 0 ? `<tr class="bold" style="color: #b91c1c;"><td>DUE BALANCE:</td><td class="right">Rs. ${effectiveDueAmount.toLocaleString()}</td></tr>` : `<tr><td class="bold">STATUS:</td><td class="right bold">FULL PAID</td></tr>`}
  </table>

  ${totalRemainingDelivery > 0 ? `
  <div class="divider"></div>
  <div style="font-size: 10px; text-align: center; font-weight: bold;">
    ⚠️ PENDING PICKUP: ${totalRemainingDelivery} units
  </div>` : ''}

  <!-- Barcode & QR Code Verification on Thermal Receipt -->
  <div class="divider"></div>

  <div class="center" style="margin: 8px 0;">
    <table style="width: 100%; border: none; border-collapse: collapse; margin-bottom: 6px;">
      <tr>
        <td style="width: 66px; vertical-align: middle; text-align: center; border: none; padding: 0 4px 0 0;">
          ${qrBase64Thermal ? `<img src="${qrBase64Thermal}" width="60" height="60" alt="QR" style="display: inline-block; border: 1px solid #000000; padding: 2px; background: #ffffff;" />` : ''}
        </td>
        <td style="vertical-align: middle; text-align: left; font-size: 8.5px; line-height: 1.25; border: none; padding: 0;">
          <strong>DIGITAL RECEIPT VERIFIED</strong><br>
          Scan barcode or QR at counter for instant item clearance & Khata settlement.
        </td>
      </tr>
    </table>
    <div style="margin-top: 4px; text-align: center;">
      ${barcodeBase64Thermal ? `<img src="${barcodeBase64Thermal}" width="180" height="40" alt="Barcode ${sale.invoice_number}" style="display: block; margin: 0 auto;" />` : ''}
    </div>
  </div>

  <div class="divider"></div>

  <div class="center" style="font-size: 9.5px;">
    ${footer}<br>
    Printed: ${fullDateTime}<br>
    *** THANK YOU ***
  </div>
</body>
</html>`;
    }
  };

  // Direct Hidden Clean Print-Window / Iframe Engine (Zero dependencies, 100% reliable on mobile and laptop)
  const executeCleanPrint = (format: 'thermal' | 'a4') => {
    setPdfNotification('Opening Print & PDF engine...');
    const htmlContent = generateReceiptHtml(format);

    try {
      // 1. Clean up any existing print iframe
      const existingIframe = document.getElementById('receipt-hidden-frame');
      if (existingIframe) {
        existingIframe.remove();
      }

      // 2. Create invisible isolated iframe
      const iframe = document.createElement('iframe');
      iframe.id = 'receipt-hidden-frame';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      iframe.style.visibility = 'hidden';
      document.body.appendChild(iframe);

      const frameDoc = iframe.contentWindow?.document || iframe.contentDocument;
      if (!frameDoc || !iframe.contentWindow) {
        throw new Error('Iframe context inaccessible');
      }

      frameDoc.open();
      frameDoc.write(htmlContent);
      frameDoc.close();

      let isTriggered = false;
      const doPrint = async () => {
        if (isTriggered) return;
        isTriggered = true;
        try {
          // Ensure all barcode/QR images are completely loaded in the iframe DOM before printing
          const images = Array.from(frameDoc.images || []);
          if (images.length > 0) {
            await Promise.all(
              images.map(img => {
                if (img.complete && img.naturalWidth > 0) return Promise.resolve();
                return new Promise<void>(res => {
                  img.onload = () => res();
                  img.onerror = () => res();
                  setTimeout(res, 300);
                });
              })
            );
          }
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          setPdfNotification('✓ Print / Save PDF ready!');
        } catch (err) {
          console.warn('Iframe print restricted, opening dedicated print window:', err);
          openPrintWindowFallback(htmlContent);
        } finally {
          setTimeout(() => {
            try {
              iframe.remove();
            } catch (e) {}
            setPdfNotification(null);
          }, 45000);
        }
      };

      // Trigger as soon as document renders
      iframe.onload = () => {
        setTimeout(doPrint, 150);
      };

      // Fallback timer in case onload already fired
      setTimeout(doPrint, 350);
    } catch (err) {
      console.warn('Iframe print error, falling back to window popup:', err);
      openPrintWindowFallback(htmlContent);
    }
  };

  // Clean popup window fallback (for environments that strictly restrict iframe printing)
  const openPrintWindowFallback = async (htmlContent: string) => {
    const printWin = window.open('', '_blank', 'width=850,height=950,menubar=no,toolbar=no,location=no');
    if (printWin) {
      printWin.document.open();
      printWin.document.write(htmlContent);
      printWin.document.close();
      printWin.focus();

      // Ensure all images are loaded before printing
      const images = Array.from(printWin.document.images || []);
      if (images.length > 0) {
        await Promise.all(
          images.map(img => {
            if (img.complete && img.naturalWidth > 0) return Promise.resolve();
            return new Promise<void>(res => {
              img.onload = () => res();
              img.onerror = () => res();
              setTimeout(res, 300);
            });
          })
        );
      }

      setTimeout(() => {
        try {
          printWin.print();
        } catch (e) {}
      }, 200);
      setPdfNotification('✓ Clean receipt window opened!');
      setTimeout(() => setPdfNotification(null), 3500);
    } else {
      setPdfNotification('Popup blocked. Please allow popups to print/save bill.');
      setTimeout(() => setPdfNotification(null), 4000);
    }
  };

  // Open receipt HTML in new tab
  const handleOpenReceiptTab = (htmlContent: string) => {
    const win = window.open('', '_blank');
    if (win) {
      win.document.open();
      win.document.write(htmlContent);
      win.document.close();
      win.focus();
    }
  };

  // Standard Print Trigger
  const handlePrint = () => {
    executeCleanPrint(printFormat);
  };

  // Save as PDF / Download Receipt with Save As Picker & Downloads folder fallback
  const handleSaveAsPdf = async () => {
    const htmlContent = generateReceiptHtml('a4');
    const fileName = `Invoice-${sale.invoice_number || 'receipt'}.html`;
    let chosenLocationMsg = "aapke device ke 'Downloads' folder";
    let savedViaPicker = false;

    // Check for File System Access API (Desktop Chrome / Edge / Opera)
    if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: fileName,
          types: [
            {
              description: 'HTML Bill / Receipt (Printable to PDF)',
              accept: { 'text/html': ['.html', '.htm'] },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(htmlContent);
        await writable.close();
        chosenLocationMsg = handle.name ? `aapki muntakhib karda location ('${handle.name}')` : "aapke device";
        savedViaPicker = true;
      } catch (err: any) {
        if (err.name === 'AbortError') {
          // User cancelled save dialog
          return;
        }
        console.warn('File picker dismissed or unsupported:', err);
      }
    }

    // Default download to browser's Downloads folder
    if (!savedViaPicker) {
      try {
        const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(blobUrl);
        }, 1000);
        chosenLocationMsg = "aapke device ke 'Downloads' folder";
      } catch (err) {
        console.error('Download trigger error:', err);
      }
    }

    // Trigger print/save PDF dialog as well so user has native PDF option immediately
    executeCleanPrint('a4');

    // Show the requested Confirmation Notification
    setDownloadNotification({
      isOpen: true,
      message: `Receipt download ho chuki hai! File ${chosenLocationMsg} mein save hui hai.`,
      fileName: fileName,
      htmlContent: htmlContent,
    });
  };

  // Persist loading fee change to server in real time
  const handleLoadingFeeChange = async (val: number) => {
    const cleanVal = Math.max(0, isNaN(val) ? 0 : val);
    setLoadingFee(cleanVal);

    try {
      setIsSavingFee(true);
      await apiRequest(`/api/sales/${sale.id}/loading-fee`, {
        method: 'PATCH',
        body: JSON.stringify({ loading_fee: cleanVal }),
      });
      sale.loading_fee = cleanVal;
    } catch (err) {
      console.error('Failed to sync loading fee:', err);
    } finally {
      setIsSavingFee(false);
    }
  };

  // Generate formatted invoice summary for WhatsApp
  const generateWhatsAppMessage = () => {
    const storeName = settings.store_name || 'Pakistan Building Materials & Paint Store';
    const storePhone = settings.phone || '+92 300 5936652';
    const invoiceNum = sale.invoice_number;
    const customerName = sale.customer_name || 'Valued Customer';
    const customerPhone = sale.customer_phone || '';
    const dateFormatted = new Date(sale.sale_date).toLocaleDateString('en-PK', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    // Build items list
    const itemsLines = (sale.items || []).map((it, idx) => {
      const delivered = it.delivered_quantity !== undefined ? it.delivered_quantity : it.quantity;
      const returned = Number(it.returned_quantity || 0);
      const remaining = Math.max(0, it.quantity - returned - delivered);
      const deliveryStatusTag = remaining > 0 
        ? `[Delivered: ${delivered} | ⚠️ Pending Pickup: ${remaining}]` 
        : `[Delivered: ${delivered}]`;
      return `${idx + 1}. *${it.product_name}*\n   Qty: ${it.quantity} ${it.unit || 'pcs'} ${deliveryStatusTag}\n   Rate: Rs. ${it.unit_price?.toLocaleString()} | Total: Rs. ${it.line_total?.toLocaleString()}`;
    }).join('\n');

    // Financial lines
    const feeLine = loadingFee > 0 
      ? `*Loading / Unloading Fee:* Rs. ${loadingFee.toLocaleString()}\n` 
      : '';
    const discountLine = sale.discount_amount > 0 
      ? `*Discount:* -Rs. ${sale.discount_amount.toLocaleString()}\n` 
      : '';
    const taxLine = sale.tax_amount > 0 
      ? `*Tax:* Rs. ${sale.tax_amount.toLocaleString()}\n` 
      : '';
    const dueLine = effectiveDueAmount > 0 
      ? `*Pending Balance (Khata):* Rs. ${effectiveDueAmount.toLocaleString()}\n` 
      : `*Payment Status:* FULL PAID / SETTLED\n`;

    // Remaining stock summary
    const remainingItemsSummary = (sale.items || [])
      .filter((it) => {
        const delivered = it.delivered_quantity !== undefined ? it.delivered_quantity : it.quantity;
        return it.quantity - (it.returned_quantity || 0) - delivered > 0;
      })
      .map((it) => {
        const delivered = it.delivered_quantity !== undefined ? it.delivered_quantity : it.quantity;
        const rem = it.quantity - (it.returned_quantity || 0) - delivered;
        return `• ${it.product_name}: ${rem} ${it.unit || 'pcs'} pending pickup`;
      });

    const remainingStockSection = remainingItemsSummary.length > 0
      ? `\n*📦 REMAINING STOCK TO PICKUP (${totalRemainingDelivery} units total):*\n${remainingItemsSummary.join('\n')}\n`
      : `\n*📦 DELIVERY STATUS:* All items picked up / delivered in full.\n`;

    return `*🧾 ${storeName.toUpperCase()}*
━━━━━━━━━━━━━━━━━━━━
*Sales Invoice:* #${invoiceNum}
*Date:* ${dateFormatted}
*Customer:* ${customerName}${customerPhone ? ` (${customerPhone})` : ''}
*Cashier:* ${sale.cashier_name || 'Imtiaz Ali'} | *Branch:* ${sale.branch_name || 'Main Store'}
━━━━━━━━━━━━━━━━━━━━
*ITEMS LIST:*
${itemsLines}
━━━━━━━━━━━━━━━━━━━━
*Subtotal:* Rs. ${sale.subtotal?.toLocaleString()}
${discountLine}${taxLine}${feeLine}*GRAND TOTAL:* Rs. ${effectiveGrandTotal.toLocaleString()}
*Paid:* Rs. ${sale.paid_amount?.toLocaleString()} (${sale.payment_method})
${dueLine}━━━━━━━━━━━━━━━━━━━━${remainingStockSection}━━━━━━━━━━━━━━━━━━━━
_Thank you for your business!_
_${settings.invoice_footer || 'Goods once sold can be exchanged within 7 days.'}_
_Store Contact: ${storePhone}_`;
  };

  // Instant, zero-crash WhatsApp share
  const handleShareWhatsApp = async () => {
    const message = generateWhatsAppMessage();

    // Copy to clipboard for easy pasting
    if (navigator.clipboard) {
      navigator.clipboard.writeText(message).catch(() => {});
      setShowCopiedToast(true);
      setTimeout(() => setShowCopiedToast(false), 3000);
    }

    let customerPhone = (sale.customer_phone || '').replace(/[^\d+]/g, '');
    if (customerPhone.startsWith('03')) {
      customerPhone = '92' + customerPhone.substring(1);
    } else if (customerPhone.startsWith('+')) {
      customerPhone = customerPhone.substring(1);
    }

    const whatsappUrl = customerPhone.length >= 10
      ? `https://api.whatsapp.com/send?phone=${customerPhone}&text=${encodeURIComponent(message)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;

    // Try Web Share API (native sheet) if supported
    if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare && navigator.canShare({ text: message })) {
      try {
        await navigator.share({
          title: `Invoice #${sale.invoice_number} - ${settings.store_name}`,
          text: message,
        });
        setPdfNotification('✓ Shared to WhatsApp successfully!');
        setTimeout(() => setPdfNotification(null), 3000);
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return;
      }
    }

    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    setPdfNotification('✓ WhatsApp opened with invoice details!');
    setTimeout(() => setPdfNotification(null), 3000);
  };

  const handleCopyWhatsAppText = () => {
    const message = generateWhatsAppMessage();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(message).then(() => {
        setShowCopiedToast(true);
        setTimeout(() => setShowCopiedToast(false), 3000);
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Top Bar */}
        <div className="bg-stone-900 text-white px-5 py-3 flex items-center justify-between shrink-0 no-print">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span className="font-bold text-sm tracking-wide">Sale Invoice: {sale.invoice_number}</span>
          </div>

          <div className="flex items-center space-x-2">
            {/* Format Toggle */}
            <div className="flex bg-stone-800 rounded-lg p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setPrintFormat('thermal')}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  printFormat === 'thermal' ? 'bg-amber-600 text-white' : 'text-stone-300 hover:text-white'
                }`}
              >
                80mm Thermal Slip
              </button>
              <button
                type="button"
                onClick={() => setPrintFormat('a4')}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  printFormat === 'a4' ? 'bg-amber-600 text-white' : 'text-stone-300 hover:text-white'
                }`}
              >
                A4 Standard Bill
              </button>
            </div>

            {/* Quick Save PDF in Header */}
            <button
              type="button"
              onClick={handleSaveAsPdf}
              className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-amber-300 rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition-colors cursor-pointer"
              title="Save Bill as A4 PDF"
            >
              <FileDown className="w-3.5 h-3.5 text-amber-400" />
              <span>Save PDF</span>
            </button>

            {/* Quick WhatsApp Bill in Header */}
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="px-3 py-1.5 bg-[#25D366] hover:bg-[#20ba59] text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition-colors cursor-pointer"
              title="Share invoice summary on WhatsApp"
            >
              <Share2 className="w-3.5 h-3.5 text-white" />
              <span>WhatsApp Bill</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition-colors cursor-pointer"
              title="Print receipt or standard invoice"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Area - Centered bill container with explicit ID #invoice-container */}
        <div className="flex-1 overflow-y-auto p-6 bg-stone-100/50 flex justify-center">
          <div id="invoice-container" className="bg-white rounded-md shadow-md border border-stone-200 inline-block overflow-visible">
            {printFormat === 'thermal' ? (
              /* ================= 80mm Thermal Receipt View ================= */
              <div
                id="printable-receipt"
                className="w-[320px] bg-white p-4 text-stone-900 font-mono text-xs leading-relaxed"
              >
              {/* Header */}
              <div className="text-center pb-3 border-b border-dashed border-stone-400 space-y-1">
                <h2 className="text-sm font-black uppercase tracking-tight text-stone-900">
                  {settings.store_name}
                </h2>
                <p className="text-[10px] text-stone-600 font-sans leading-tight">
                  {settings.address}
                </p>
                <p className="text-[10px] text-stone-600 font-sans">
                  Tel: {settings.phone}
                </p>
                <div className="inline-block mt-1 px-2 py-0.5 bg-stone-900 text-white text-[10px] font-bold rounded uppercase">
                  Cash Memo / Sales Invoice
                </div>

                {/* Cashier & Branch Badge on Slip */}
                <div className="mt-1.5 py-1 px-2 bg-stone-100 rounded border border-stone-200 text-[10px] font-sans">
                  <span className="font-bold text-stone-900">Served by: {sale.cashier_name || 'Ali'}</span>
                  <span className="text-stone-400 mx-1.5">•</span>
                  <span className="font-medium text-stone-700">Branch: {sale.branch_name || 'Main Store'}</span>
                </div>

                {/* Top Receipt Barcode */}
                <div className="pt-2 flex flex-col items-center">
                  <BarcodeSvg value={sale.invoice_number} width={180} height={42} showText={false} />
                  <span className="text-[9px] font-bold tracking-wider text-stone-700 mt-0.5">
                    *{sale.invoice_number}*
                  </span>
                </div>
              </div>

              {/* Meta Info */}
              <div className="py-2 border-b border-dashed border-stone-300 space-y-0.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-stone-600">Invoice #:</span>
                  <span className="font-bold">{sale.invoice_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-600">Branch:</span>
                  <span className="font-bold text-right truncate max-w-[170px]">{sale.branch_name || 'Main Store'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-600">Date/Time:</span>
                  <span>{new Date(sale.sale_date).toLocaleString('en-PK', { dateStyle: 'short', timeStyle: 'short' })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-600">Cashier:</span>
                  <span className="font-bold">{sale.cashier_name || 'Imtiaz Ali'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-600">Customer:</span>
                  <span className="font-bold truncate max-w-[170px] text-right">{sale.customer_name}</span>
                </div>
                {sale.customer_phone && (
                  <div className="flex justify-between text-[10px]">
                    <span className="text-stone-600">Phone:</span>
                    <span>{sale.customer_phone}</span>
                  </div>
                )}
              </div>

              {/* Delivery & Payment Status Strip */}
              <div className="py-1.5 px-2.5 my-1.5 bg-stone-50 rounded border border-stone-300 text-[10px] space-y-1 font-sans">
                <div className="flex justify-between items-center font-bold">
                  <span className="text-stone-600 uppercase text-[9px]">Bill Payment:</span>
                  <span className={sale.payment_status === 'PAID' ? 'text-emerald-700' : 'text-rose-700'}>
                    {sale.payment_status === 'PAID' ? 'PAID IN FULL' : sale.payment_status === 'PARTIAL' ? 'PARTIAL PAID' : 'UNPAID / KHATA'}
                  </span>
                </div>
                <div className="flex justify-between items-center font-bold pt-0.5 border-t border-stone-200">
                  <span className="text-stone-600 uppercase text-[9px]">Delivery Status:</span>
                  <span className={deliveryStatus === 'DELIVERED' ? 'text-emerald-700' : 'text-amber-800 font-black'}>
                    {deliveryStatus === 'DELIVERED'
                      ? `Fully Delivered (${totalPurchasedQty} units)`
                      : deliveryStatus === 'PARTIAL'
                      ? `Partial (Delivered: ${totalDeliveredQty} | Remaining: ${totalRemainingDelivery})`
                      : `Pending Pickup (${totalRemainingDelivery} units)`}
                  </span>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="py-2 border-b border-dashed border-stone-300">
                <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="border-b border-stone-400 text-[10px] uppercase font-bold text-stone-700">
                      <th className="pb-1 text-left">Item</th>
                      <th className="pb-1 text-center">Qty</th>
                      <th className="pb-1 text-right">Rate</th>
                      <th className="pb-1 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dotted divide-stone-200">
                    {(sale.items || []).map((item, idx) => {
                      const returnedQty = Number(item.returned_quantity || 0);
                      const remainingQty = item.remaining_quantity !== undefined 
                        ? Number(item.remaining_quantity) 
                        : Math.max(0, Number(item.quantity) - returnedQty);
                      const isFullyReturned = returnedQty >= item.quantity && item.quantity > 0;
                      const isPartiallyReturned = returnedQty > 0 && !isFullyReturned;
                      const activeLineTotal = isFullyReturned 
                        ? 0 
                        : isPartiallyReturned 
                        ? Math.max(0, Math.round((item.unit_price * remainingQty - (item.discount || 0) * (remainingQty / item.quantity)) * 100) / 100)
                        : item.line_total;

                      const itemDelivered = item.delivered_quantity !== undefined ? Number(item.delivered_quantity) : Number(item.quantity);
                      const itemRemaining = Math.max(0, Number(item.quantity) - itemDelivered);

                      return (
                        <tr key={idx} className={`align-top ${isFullyReturned ? 'opacity-70 bg-stone-50/50' : ''}`}>
                          <td className="py-1 pr-1">
                            <div className={`font-semibold leading-tight ${isFullyReturned ? 'line-through text-stone-400' : 'text-stone-900'}`}>
                              {item.product_name}
                            </div>
                            {isFullyReturned && (
                              <span className="inline-block px-1 py-0.2 bg-rose-100 text-rose-800 text-[8px] font-bold rounded uppercase mt-0.5">
                                [RETURNED / REFUNDED]
                              </span>
                            )}
                            {isPartiallyReturned && (
                              <span className="inline-block px-1 py-0.2 bg-amber-100 text-amber-900 text-[8px] font-bold rounded mt-0.5">
                                [PARTIAL: {returnedQty} Ret.]
                              </span>
                            )}
                            {item.discount > 0 && !isFullyReturned && (
                              <span className="text-[9px] text-emerald-700 block">Disc: -Rs. {item.discount}</span>
                            )}
                            {/* Item Delivery Breakdown */}
                            <div className="text-[8px] mt-0.5">
                              {itemRemaining === 0 ? (
                                <span className="text-emerald-700 font-semibold">Delivered: {itemDelivered} (Full)</span>
                              ) : itemDelivered > 0 ? (
                                <span className="text-amber-800 font-bold bg-amber-50 px-1 rounded inline-block">
                                  Delivered: {itemDelivered} | Rem: {itemRemaining}
                                </span>
                              ) : (
                                <span className="text-rose-700 font-bold bg-rose-50 px-1 rounded inline-block">
                                  Pending Pickup: {itemRemaining} rem.
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-1 text-center whitespace-nowrap">
                            {isFullyReturned ? (
                              <div>
                                <span className="line-through text-stone-400 text-[10px]">{item.quantity}</span>
                                <span className="block text-[9px] font-bold text-rose-700">0 {item.unit || ''}</span>
                              </div>
                            ) : isPartiallyReturned ? (
                              <div>
                                <span className="font-bold text-stone-900">{remainingQty} {item.unit || ''}</span>
                                <span className="block text-[8px] text-stone-400 line-through">Orig: {item.quantity}</span>
                              </div>
                            ) : (
                              <span>{item.quantity} {item.unit || ''}</span>
                            )}
                          </td>
                          <td className="py-1 text-right">{item.unit_price}</td>
                          <td className="py-1 text-right font-bold">
                            {isFullyReturned ? (
                              <div>
                                <span className="line-through text-stone-400 font-normal text-[10px]">
                                  Rs. {item.line_total?.toLocaleString()}
                                </span>
                                <span className="block text-[9px] text-rose-700 font-black">Rs. 0</span>
                              </div>
                            ) : isPartiallyReturned ? (
                              <div>
                                <span className="text-stone-900 font-bold">Rs. {activeLineTotal.toLocaleString()}</span>
                                <span className="block text-[8px] text-stone-400 line-through font-normal">
                                  Orig: Rs. {item.line_total?.toLocaleString()}
                                </span>
                              </div>
                            ) : (
                              <span>Rs. {item.line_total?.toLocaleString()}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Financial Calculation */}
              <div className="py-2 space-y-1 text-[11px] border-b border-dashed border-stone-400">
                <div className="flex justify-between">
                  <span className="text-stone-600">Subtotal:</span>
                  <span>Rs. {sale.subtotal?.toLocaleString()}</span>
                </div>
                {sale.discount_amount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Discount:</span>
                    <span>-Rs. {sale.discount_amount?.toLocaleString()}</span>
                  </div>
                )}
                {sale.tax_amount > 0 && (
                  <div className="flex justify-between text-stone-600">
                    <span>Tax:</span>
                    <span>Rs. {sale.tax_amount?.toLocaleString()}</span>
                  </div>
                )}
                {loadingFee > 0 && (
                  <div className="flex justify-between text-stone-800 font-semibold">
                    <span>Loading / Unloading Fee:</span>
                    <span>+Rs. {loadingFee.toLocaleString()}</span>
                  </div>
                )}
                {hasReturns ? (
                  <>
                    <div className="flex justify-between text-stone-600 pt-1 border-t border-dotted border-stone-300">
                      <span>Original Total:</span>
                      <span className="font-semibold">Rs. {(originalGrandTotal + feeDelta).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-rose-700 font-bold">
                      <span>Less Returns / Refunds:</span>
                      <span>- Rs. {returnedAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-xs font-black pt-1 border-t border-stone-400 text-stone-900">
                      <span>FINAL NET TOTAL:</span>
                      <span className="text-sm">Rs. {effectiveNetTotal.toLocaleString()}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between text-xs font-black pt-1 border-t border-stone-400 text-stone-900">
                    <span>NET TOTAL:</span>
                    <span>Rs. {effectiveGrandTotal.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-stone-700 pt-0.5">
                  <span>Paid ({sale.payment_method}):</span>
                  <span className="font-bold text-emerald-700">Rs. {sale.paid_amount?.toLocaleString()}</span>
                </div>
                {effectiveDueAmount > 0 ? (
                  <div className="flex justify-between text-rose-700 font-bold">
                    <span>Balance Due (Khata):</span>
                    <span>Rs. {effectiveDueAmount.toLocaleString()}</span>
                  </div>
                ) : (
                  <div className="flex justify-between text-emerald-700 font-bold text-[10px]">
                    <span>Status:</span>
                    <span>FULL PAID / SETTLED</span>
                  </div>
                )}

                {/* Previous Khata Balance (if contractor) */}
                {sale.customer_current_balance !== undefined && !sale.is_walk_in && (
                  <div className="mt-2 pt-1 border-t border-dotted border-stone-300 text-[10px] text-stone-600">
                    <div className="flex justify-between font-medium">
                      <span>Total Customer Due:</span>
                      <span className="font-bold text-stone-900">Rs. {sale.customer_current_balance?.toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Delivery Balance Summary Card on Thermal Slip */}
              <div className="py-2 px-2.5 my-2 bg-amber-50/80 border border-amber-300 rounded text-[10px] space-y-1 font-sans">
                <div className="flex justify-between font-bold text-amber-950">
                  <span className="uppercase text-[9px]">Item Delivery Status:</span>
                  <span className={deliveryStatus === 'DELIVERED' ? 'text-emerald-700' : 'text-amber-900 font-black'}>
                    {deliveryStatus === 'DELIVERED' ? 'FULL DELIVERED' : 'PARTIAL DELIVERED'}
                  </span>
                </div>
                <div className="flex justify-between text-stone-700">
                  <span>Total Purchased (Billed):</span>
                  <span className="font-bold">{totalPurchasedQty} units</span>
                </div>
                <div className="flex justify-between text-stone-700">
                  <span>Delivered / Handed Over:</span>
                  <span className="font-bold text-emerald-700">{totalDeliveredQty} units</span>
                </div>
                <div className="flex justify-between text-amber-900 font-bold pt-0.5 border-t border-amber-200">
                  <span>REMAINING PICKUP BALANCE:</span>
                  <span className="text-xs font-black text-amber-950">{totalRemainingDelivery} units</span>
                </div>
                {totalRemainingDelivery > 0 ? (
                  <p className="text-[8px] text-amber-800 italic pt-0.5">
                    * Customer can pick up remaining {totalRemainingDelivery} units anytime against invoice #{sale.invoice_number}.
                  </p>
                ) : (
                  <p className="text-[8px] text-emerald-700 font-medium pt-0.5">
                    ✓ All purchased stock has been delivered to customer.
                  </p>
                )}
              </div>

              {/* Barcode & QR Code Section at Bottom of Receipt */}
              <div className="py-3 border-b border-dashed border-stone-400 flex flex-col items-center space-y-2">
                <div className="flex items-center space-x-3">
                  <QrCodeSvg value={qrString} size={64} label="VERIFY BILL" />
                  <div className="text-[9px] text-stone-600 text-left font-sans leading-tight max-w-[170px]">
                    <p className="font-bold text-stone-800">DIGITAL RECEIPT VERIFIED</p>
                    <p>Scan barcode with cashier scanner gun to pull up bill, settle pending Khata, or process item returns.</p>
                  </div>
                </div>
                <div className="pt-1 flex flex-col items-center">
                  <BarcodeSvg value={sale.invoice_number} width={190} height={42} showText={true} />
                </div>
              </div>

              {/* Footer Notice */}
              <div className="pt-3 text-center text-[9px] text-stone-600 font-sans space-y-1">
                <p className="italic">{settings.invoice_footer}</p>
                <p className="text-[8px] text-stone-400">Software by Hardware Shop Management</p>
              </div>
            </div>
          ) : (
            /* ================= A4 Standard Commercial Bill ================= */
            <div
              id="printable-a4"
              className="w-[600px] bg-white p-8 shadow-md rounded border border-stone-200 text-stone-900 font-sans text-xs leading-normal"
            >
              {/* Header */}
              <div className="flex justify-between items-start border-b-2 border-stone-900 pb-4">
                <div>
                  <h1 className="text-xl font-black uppercase text-stone-900 tracking-tight">
                    {settings.store_name}
                  </h1>
                  <p className="text-stone-700 text-xs font-semibold mt-0.5">
                    Proprietor: {settings.owner_name || 'Imtiaz Ali'}
                  </p>
                  <p className="text-stone-600 text-xs mt-0.5">Hardware, Sanitary, Pipes, Paints & Building Materials</p>
                  <p className="text-stone-500 text-xs mt-0.5">{settings.address}</p>
                  <p className="text-stone-600 text-xs font-semibold mt-0.5">Phone: {settings.phone} | Email: {settings.email}</p>
                </div>
                <div className="text-right">
                  <span className="inline-block px-3 py-1 bg-stone-900 text-white font-bold text-xs uppercase tracking-wider rounded">
                    SALES TAX INVOICE
                  </span>
                  <div className="mt-2 text-right text-xs">
                    <div className="font-bold text-stone-900 text-sm">{sale.invoice_number}</div>
                    <div className="text-stone-500">
                      Date: {new Date(sale.sale_date).toLocaleDateString('en-PK')}
                    </div>
                    <div className="mt-1 flex justify-end">
                      <BarcodeSvg value={sale.invoice_number} width={150} height={36} showText={false} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Customer & Bill Details */}
              <div className="grid grid-cols-2 gap-4 py-4 border-b border-stone-200">
                <div>
                  <span className="text-[10px] uppercase font-bold text-stone-500 tracking-wider">Bill To:</span>
                  <div className="font-bold text-sm text-stone-900">{sale.customer_name}</div>
                  {sale.customer_phone && <div className="text-stone-600 text-xs">Phone: {sale.customer_phone}</div>}
                  {sale.customer_address && <div className="text-stone-600 text-xs">Address: {sale.customer_address}</div>}
                  
                  {/* Branch Details */}
                  <div className="mt-2 text-xs text-stone-600">
                    <span className="font-semibold text-stone-700">Billing Branch: </span>
                    <span className="font-bold text-stone-900">{sale.branch_name || 'Main Store & Central Warehouse'}</span>
                    {sale.branch_code && <span className="text-stone-500"> ({sale.branch_code})</span>}
                  </div>
                </div>
                <div className="text-right text-xs space-y-1">
                  <div>
                    <span className="text-stone-500">Payment Terms: </span>
                    <span className="font-bold">{sale.payment_method}</span>
                  </div>
                  <div>
                    <span className="text-stone-500">Payment Status: </span>
                    <span
                      className={`font-bold px-1.5 py-0.5 rounded text-[11px] ${
                        sale.payment_status === 'PAID'
                          ? 'bg-emerald-100 text-emerald-800'
                          : sale.payment_status === 'PARTIAL'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {sale.payment_status}
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-500">Delivery Status: </span>
                    <span
                      className={`font-bold px-1.5 py-0.5 rounded text-[11px] ${
                        deliveryStatus === 'DELIVERED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : deliveryStatus === 'PARTIAL'
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {deliveryStatus === 'DELIVERED'
                        ? `Fully Delivered (${totalPurchasedQty} units)`
                        : deliveryStatus === 'PARTIAL'
                        ? `Partial Delivered (${totalDeliveredQty} / ${totalPurchasedQty})`
                        : `Pending Pickup (${totalRemainingDelivery} units)`}
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-500">Served by (Cashier): </span>
                    <span className="font-bold text-stone-900">{sale.cashier_name || 'Imtiaz Ali'}</span>
                  </div>
                  <div>
                    <span className="text-stone-500">Branch Location: </span>
                    <span className="font-medium text-stone-800">{sale.branch_name || 'Main Store'}</span>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="py-4">
                <table className="w-full text-left border border-stone-200">
                  <thead className="bg-stone-100 text-stone-700 text-[11px] font-bold uppercase border-b border-stone-200">
                    <tr>
                      <th className="py-2 px-2.5 w-7">#</th>
                      <th className="py-2 px-2.5">Item Description</th>
                      <th className="py-2 px-2 text-center">Unit</th>
                      <th className="py-2 px-2 text-center">Purchased (Paid)</th>
                      <th className="py-2 px-2 text-center">Delivered</th>
                      <th className="py-2 px-2 text-center">Remaining Balance</th>
                      <th className="py-2 px-2.5 text-right">Unit Rate</th>
                      <th className="py-2 px-2.5 text-right">Discount</th>
                      <th className="py-2 px-2.5 text-right">Total (Rs.)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200 text-xs">
                    {(sale.items || []).map((item, idx) => {
                      const returnedQty = Number(item.returned_quantity || 0);
                      const remainingQty = item.remaining_quantity !== undefined 
                        ? Number(item.remaining_quantity) 
                        : Math.max(0, Number(item.quantity) - returnedQty);
                      const isFullyReturned = returnedQty >= item.quantity && item.quantity > 0;
                      const isPartiallyReturned = returnedQty > 0 && !isFullyReturned;
                      
                      const activeLineTotal = isFullyReturned 
                        ? 0 
                        : isPartiallyReturned 
                        ? Math.max(0, Math.round((item.unit_price * remainingQty - (item.discount || 0) * (remainingQty / item.quantity)) * 100) / 100)
                        : item.line_total;

                      const itemDelivered = item.delivered_quantity !== undefined ? Number(item.delivered_quantity) : Number(item.quantity);
                      const itemRemaining = Math.max(0, Number(item.quantity) - itemDelivered);

                      return (
                        <tr key={idx} className={isFullyReturned ? 'bg-rose-50/40 opacity-75' : (idx % 2 === 0 ? 'bg-white' : 'bg-stone-50/50')}>
                          <td className="py-2 px-2.5 text-stone-500">{idx + 1}</td>
                          <td className="py-2 px-2.5">
                            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                              <span className={`font-semibold ${isFullyReturned ? 'line-through text-stone-400' : 'text-stone-900'}`}>
                                {item.product_name}
                              </span>
                              {isFullyReturned && (
                                <span className="px-1.5 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-bold rounded uppercase">
                                  Returned
                                </span>
                              )}
                              {isPartiallyReturned && (
                                <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded">
                                  {returnedQty} Returned
                                </span>
                              )}
                            </div>
                            {item.sku && <span className="text-[10px] text-stone-500 block mt-0.5">SKU: {item.sku}</span>}
                          </td>
                          <td className="py-2 px-2 text-center text-stone-600">{item.unit || 'Piece'}</td>
                          <td className="py-2 px-2 text-center">
                            {isFullyReturned ? (
                              <div>
                                <span className="line-through text-stone-400 text-xs mr-1">{item.quantity}</span>
                                <span className="font-bold text-rose-700 text-xs">0 (Ret: {returnedQty})</span>
                              </div>
                            ) : isPartiallyReturned ? (
                              <div>
                                <span className="font-bold text-stone-900 text-xs">{remainingQty}</span>
                                <span className="text-[10px] text-stone-500 block">(Orig: {item.quantity})</span>
                              </div>
                            ) : (
                              <span className="font-bold text-stone-900">{item.quantity}</span>
                            )}
                          </td>
                          <td className="py-2 px-2 text-center font-bold text-emerald-700">
                            {itemDelivered}
                          </td>
                          <td className="py-2 px-2 text-center font-bold">
                            {itemRemaining === 0 ? (
                              <span className="text-stone-400 font-semibold text-[11px]">0 (Complete)</span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-black text-xs">
                                {itemRemaining} {item.unit || ''}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-2.5 text-right">{item.unit_price?.toLocaleString()}</td>
                          <td className="py-2 px-2.5 text-right text-stone-500">
                            {isFullyReturned ? (
                              <span className="line-through text-stone-300">-</span>
                            ) : item.discount > 0 ? (
                              `-${item.discount}`
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="py-2 px-2.5 text-right font-bold text-stone-900">
                            {isFullyReturned ? (
                              <div>
                                <span className="line-through text-stone-400 font-normal text-xs mr-1">
                                  Rs. {item.line_total?.toLocaleString()}
                                </span>
                                <span className="text-rose-700 font-bold block text-xs">Rs. 0</span>
                              </div>
                            ) : isPartiallyReturned ? (
                              <div>
                                <span className="text-stone-900 font-bold">Rs. {activeLineTotal.toLocaleString()}</span>
                                <span className="text-[10px] text-stone-400 line-through block font-normal">
                                  Orig: Rs. {item.line_total?.toLocaleString()}
                                </span>
                              </div>
                            ) : (
                              <span>Rs. {item.line_total?.toLocaleString()}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Summary Bottom Calculation */}
              <div className="grid grid-cols-2 gap-6 pt-2 pb-6 border-b border-stone-200">
                <div className="text-xs text-stone-600 space-y-2">
                  {/* Delivery & Pickup Balance Box */}
                  <div className="p-3 bg-amber-50/90 rounded-lg border border-amber-300">
                    <span className="font-bold text-amber-950 block text-[11px] mb-1 uppercase tracking-wide">
                      ITEM STOCK & PICKUP BALANCE:
                    </span>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between text-stone-700">
                        <span>Total Items Purchased (Paid):</span>
                        <span className="font-bold text-stone-900">{totalPurchasedQty} units</span>
                      </div>
                      <div className="flex justify-between text-stone-700">
                        <span>Total Delivered / Picked Up:</span>
                        <span className="font-bold text-emerald-700">{totalDeliveredQty} units</span>
                      </div>
                      <div className="flex justify-between text-amber-950 font-black pt-1 border-t border-amber-200">
                        <span>REMAINING BALANCE TO DELIVER:</span>
                        <span className="text-sm font-black text-amber-900">{totalRemainingDelivery} units</span>
                      </div>
                      <p className="text-[10px] text-amber-800 italic pt-0.5">
                        {totalRemainingDelivery > 0
                          ? `* Customer has ${totalRemainingDelivery} units pending pickup against this bill. Bring invoice or scan barcode for pickup clearance.`
                          : '✓ All purchased items have been picked up and handed over in full.'}
                      </p>
                    </div>
                  </div>

                  <div className="p-2.5 bg-stone-50 rounded-lg border border-stone-200">
                    <span className="font-bold text-stone-800 block text-[10px] mb-0.5">TERMS & CONDITIONS:</span>
                    <p className="text-[9px] text-stone-600">{settings.invoice_footer}</p>
                  </div>

                  <div className="p-2 bg-stone-50/80 rounded-lg border border-stone-200 flex items-center space-x-3">
                    <QrCodeSvg value={qrString} size={50} label="BILL QR" />
                    <div className="text-[10px] text-stone-600 font-sans leading-tight">
                      <p className="font-bold text-stone-800">ELECTRONIC VERIFICATION</p>
                      <p className="text-[9px] text-stone-500 mt-0.5">Scan this QR or barcode at POS terminal for instant bill lookup, item pickup clearance, or ledger settlement.</p>
                      <div className="mt-1">
                        <BarcodeSvg value={sale.invoice_number} width={130} height={26} showText={false} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-stone-700">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span className="font-medium">Rs. {sale.subtotal?.toLocaleString()}</span>
                  </div>
                  {sale.discount_amount > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Invoice Discount:</span>
                      <span className="font-medium">-Rs. {sale.discount_amount?.toLocaleString()}</span>
                    </div>
                  )}
                  {sale.tax_amount > 0 && (
                    <div className="flex justify-between">
                      <span>Sales Tax:</span>
                      <span className="font-medium">Rs. {sale.tax_amount?.toLocaleString()}</span>
                    </div>
                  )}
                  {loadingFee > 0 && (
                    <div className="flex justify-between text-stone-800 font-semibold py-0.5">
                      <span>Loading / Unloading Fee:</span>
                      <span className="font-bold text-stone-900">+Rs. {loadingFee.toLocaleString()}</span>
                    </div>
                  )}
                  {hasReturns ? (
                    <>
                      <div className="flex justify-between text-stone-600 pt-1.5 border-t border-stone-200">
                        <span>Original Invoice Total:</span>
                        <span className="font-semibold">Rs. {(originalGrandTotal + feeDelta).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-rose-700 font-bold">
                        <span>Less Returns / Refunds:</span>
                        <span>- Rs. {returnedAmount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm font-black pt-2 border-t-2 border-stone-900 text-stone-900">
                        <span>FINAL NET TOTAL:</span>
                        <span className="text-base text-amber-900 font-black">Rs. {effectiveNetTotal.toLocaleString()}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between text-sm font-black pt-2 border-t-2 border-stone-900 text-stone-900">
                      <span>GRAND TOTAL:</span>
                      <span className="text-base text-amber-600 font-black">Rs. {effectiveGrandTotal.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-1">
                    <span>Amount Received:</span>
                    <span className="font-bold text-emerald-700">Rs. {sale.paid_amount?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-rose-700 font-bold">
                    <span>Current Due (Khata):</span>
                    <span>Rs. {effectiveDueAmount.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Signatures */}
              <div className="pt-8 flex justify-between text-center text-xs text-stone-600">
                <div className="w-40 border-t border-stone-400 pt-1">Customer Signature</div>
                <div className="w-40 border-t border-stone-400 pt-1">Authorized Store Stamp</div>
              </div>
            </div>
          )}
          </div>
        </div>

        {/* Modal Bottom Actions Bar */}
        <div className="bg-stone-50 border-t border-stone-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0 no-print">
          {/* Left: Loading / Unloading Fee quick editor */}
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-stone-700">Loading / Unloading Fee:</span>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 text-xs font-bold">Rs.</span>
              <input
                type="number"
                min="0"
                placeholder="0 (Optional)"
                value={loadingFee || ''}
                onChange={(e) => handleLoadingFeeChange(Number(e.target.value))}
                className="w-32 pl-8 pr-2.5 py-1.5 text-xs font-bold border border-stone-300 rounded-lg focus:ring-1 focus:ring-amber-500 bg-white"
              />
            </div>
            {loadingFee > 0 && (
              <span className="text-[11px] font-bold text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded-md">
                +Rs. {loadingFee.toLocaleString()} added
              </span>
            )}
            {isSavingFee && <span className="text-[10px] text-stone-400 italic">Saving...</span>}
          </div>

          {/* Right: Two primary requested action buttons + Print & Close */}
          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
            {pdfNotification && (
              <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-lg text-xs font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span>{pdfNotification}</span>
              </div>
            )}

            {/* a) Save as PDF */}
            <button
              type="button"
              onClick={handleSaveAsPdf}
              className="px-3.5 py-2 bg-stone-900 hover:bg-black text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              title="Save or Print A4 PDF with clean layout"
            >
              <FileDown className="w-4 h-4 text-amber-400" />
              <span>Save as PDF</span>
            </button>

            {/* b) Share on WhatsApp */}
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="px-3.5 py-2 bg-[#25D366] hover:bg-[#20ba59] text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              title="Share invoice summary on WhatsApp"
            >
              <Share2 className="w-4 h-4" />
              <span>Share on WhatsApp</span>
            </button>

            {/* Copy WhatsApp Text */}
            <button
              type="button"
              onClick={handleCopyWhatsAppText}
              className="px-3 py-2 bg-white border border-stone-300 hover:bg-stone-100 text-stone-700 rounded-xl text-xs font-semibold flex items-center space-x-1 transition-colors cursor-pointer"
              title="Copy formatted invoice text to clipboard"
            >
              {showCopiedToast ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-bold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-stone-500" />
                  <span>Copy Text</span>
                </>
              )}
            </button>

            {/* Print */}
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-2 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-xl text-xs font-semibold flex items-center space-x-1 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 bg-stone-200 hover:bg-stone-300 text-stone-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* 1. Save Path / Confirmation Notification Toast/Modal */}
      {downloadNotification && downloadNotification.isOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 max-w-md w-full p-6 text-stone-900 relative">
            <button
              type="button"
              onClick={() => setDownloadNotification(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
              title="Close notification"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-start space-x-3.5">
              <div className="p-3 bg-emerald-100 text-emerald-700 rounded-xl shrink-0 mt-0.5">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0 pr-4">
                <h3 className="text-sm font-bold text-stone-900 tracking-tight">
                  Receipt Downloaded!
                </h3>
                <p className="text-xs text-stone-600 mt-1 font-medium leading-relaxed">
                  {downloadNotification.message}
                </p>
                <div className="mt-3 px-2.5 py-1.5 bg-stone-50 rounded-lg border border-stone-200 flex items-center justify-between text-[11px] text-stone-600">
                  <span className="font-mono truncate font-semibold text-stone-800">{downloadNotification.fileName}</span>
                  <span className="text-[10px] text-emerald-700 font-bold ml-2 shrink-0 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">Saved</span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end space-x-2.5 pt-3 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setDownloadNotification(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors cursor-pointer"
              >
                Dismiss / Close
              </button>
              <button
                type="button"
                onClick={() => {
                  handleOpenReceiptTab(downloadNotification.htmlContent);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open / View Receipt</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
