import React, { useState } from 'react';
import { Printer, X, FileText, CheckCircle2, QrCode } from 'lucide-react';
import { Sale } from '../../types';
import { BarcodeSvg } from '../common/BarcodeSvg';
import { QrCodeSvg } from '../common/QrCodeSvg';

interface ReceiptModalProps {
  sale: Sale;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ sale, onClose }) => {
  const [printFormat, setPrintFormat] = useState<'thermal' | 'a4'>('thermal');

  const settings = sale.settings || {
    store_name: 'Pakistan Building Materials & paint store',
    owner_name: 'Imtiaz Ali',
    address: 'Main Wholesale Market, Building Materials Boulevard, Shop #14-18',
    phone: '+92 300 1234567 / +92 42 3578901',
    email: 'sales@pakistanmaterials.pk',
    currency: 'Rs.',
    invoice_footer: 'Thank you for your business! Goods once sold can be exchanged within 7 days with original invoice.',
  };

  const handlePrint = () => {
    window.print();
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

            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-stone-100/50 flex justify-center">
          {printFormat === 'thermal' ? (
            /* ================= 80mm Thermal Receipt View ================= */
            <div
              id="printable-receipt"
              className="w-[320px] bg-white p-4 shadow-md rounded border border-stone-200 text-stone-900 font-mono text-xs leading-relaxed"
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
                  <span className="text-stone-600">Date/Time:</span>
                  <span>{new Date(sale.sale_date).toLocaleString('en-PK', { dateStyle: 'short', timeStyle: 'short' })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-600">Cashier:</span>
                  <span>{sale.cashier_name || 'Terminal'}</span>
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
                    {(sale.items || []).map((item, idx) => (
                      <tr key={idx} className="align-top">
                        <td className="py-1 pr-1">
                          <div className="font-semibold text-stone-900 leading-tight">{item.product_name}</div>
                          {item.discount > 0 && (
                            <span className="text-[9px] text-emerald-700">Disc: -Rs. {item.discount}</span>
                          )}
                        </td>
                        <td className="py-1 text-center whitespace-nowrap">
                          {item.quantity} {item.unit || ''}
                        </td>
                        <td className="py-1 text-right">{item.unit_price}</td>
                        <td className="py-1 text-right font-bold">{item.line_total.toLocaleString()}</td>
                      </tr>
                    ))}
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
                <div className="flex justify-between text-xs font-black pt-1 border-t border-stone-400 text-stone-900">
                  <span>NET TOTAL:</span>
                  <span>Rs. {sale.grand_total?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-stone-700 pt-0.5">
                  <span>Paid ({sale.payment_method}):</span>
                  <span className="font-bold">Rs. {sale.paid_amount?.toLocaleString()}</span>
                </div>
                {sale.due_amount > 0 ? (
                  <div className="flex justify-between text-rose-700 font-bold">
                    <span>Balance Due (Khata):</span>
                    <span>Rs. {sale.due_amount?.toLocaleString()}</span>
                  </div>
                ) : (
                  <div className="flex justify-between text-emerald-700 font-bold text-[10px]">
                    <span>Status:</span>
                    <span>FULL PAID</span>
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

              {/* Barcode & QR Code Section at Bottom of Receipt */}
              <div className="py-3 border-b border-dashed border-stone-400 flex flex-col items-center space-y-2">
                <div className="flex items-center space-x-3">
                  <QrCodeSvg value={`INVOICE:${sale.invoice_number}|AMT:${sale.grand_total}|DUE:${sale.due_amount}`} size={64} label="VERIFY BILL" />
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
                    <span className="text-stone-500">Cashier: </span>
                    <span className="font-medium text-stone-800">{sale.cashier_name || 'Counter'}</span>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="py-4">
                <table className="w-full text-left border border-stone-200">
                  <thead className="bg-stone-100 text-stone-700 text-[11px] font-bold uppercase border-b border-stone-200">
                    <tr>
                      <th className="py-2 px-3 w-8">#</th>
                      <th className="py-2 px-3">Item Description</th>
                      <th className="py-2 px-3 text-center">Unit</th>
                      <th className="py-2 px-3 text-center">Qty</th>
                      <th className="py-2 px-3 text-right">Unit Rate</th>
                      <th className="py-2 px-3 text-right">Discount</th>
                      <th className="py-2 px-3 text-right">Total (Rs.)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200 text-xs">
                    {(sale.items || []).map((item, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-stone-50/50'}>
                        <td className="py-2 px-3 text-stone-500">{idx + 1}</td>
                        <td className="py-2 px-3">
                          <span className="font-semibold text-stone-900">{item.product_name}</span>
                          {item.sku && <span className="text-[10px] text-stone-500 block">SKU: {item.sku}</span>}
                        </td>
                        <td className="py-2 px-3 text-center text-stone-600">{item.unit || 'Piece'}</td>
                        <td className="py-2 px-3 text-center font-bold text-stone-900">{item.quantity}</td>
                        <td className="py-2 px-3 text-right">{item.unit_price?.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right text-stone-500">
                          {item.discount > 0 ? `-${item.discount}` : '-'}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-stone-900">
                          {item.line_total?.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary Bottom Calculation */}
              <div className="grid grid-cols-2 gap-6 pt-2 pb-6 border-b border-stone-200">
                <div className="text-xs text-stone-600 space-y-2">
                  <div className="p-3 bg-stone-50 rounded-lg border border-stone-200">
                    <span className="font-bold text-stone-800 block text-[11px] mb-1">TERMS & CONDITIONS:</span>
                    <p className="text-[10px] text-stone-600">{settings.invoice_footer}</p>
                  </div>

                  <div className="p-2.5 bg-stone-50/80 rounded-lg border border-stone-200 flex items-center space-x-3">
                    <QrCodeSvg value={`INVOICE:${sale.invoice_number}|AMT:${sale.grand_total}|DUE:${sale.due_amount}`} size={56} label="BILL QR" />
                    <div className="text-[10px] text-stone-600 font-sans leading-tight">
                      <p className="font-bold text-stone-800">ELECTRONIC VERIFICATION</p>
                      <p className="text-[9px] text-stone-500 mt-0.5">Scan this QR or barcode at any POS terminal for instant bill lookup, payment clearance, or item returns.</p>
                      <div className="mt-1">
                        <BarcodeSvg value={sale.invoice_number} width={130} height={28} showText={false} />
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
                  <div className="flex justify-between text-sm font-black pt-2 border-t-2 border-stone-900 text-stone-900">
                    <span>GRAND TOTAL:</span>
                    <span>Rs. {sale.grand_total?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span>Amount Received:</span>
                    <span className="font-bold text-emerald-700">Rs. {sale.paid_amount?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-rose-700 font-bold">
                    <span>Current Due (Khata):</span>
                    <span>Rs. {sale.due_amount?.toLocaleString()}</span>
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
    </div>
  );
};
