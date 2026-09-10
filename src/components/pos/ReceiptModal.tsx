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
    phone: '+92 300 5936652 / +92 300 1801818',
    email: 'imtayazautos@gmail.com',
    currency: 'Rs.',
    invoice_footer: 'Thank you for your business! Goods once sold can be exchanged within 7 days with original invoice.',
  };

  // Financial calculations for returns & Net Payable Amount
  const returnedAmount = Number(sale.returned_amount || 0);
  const hasReturns = returnedAmount > 0;
  const originalGrandTotal = Number(sale.original_grand_total || (sale.grand_total + returnedAmount));
  const netPayableTotal = Number(sale.net_total !== undefined ? sale.net_total : (hasReturns ? originalGrandTotal - returnedAmount : sale.grand_total));

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
  const qrString = `INVOICE:${sale.invoice_number}|AMT:${netPayableTotal}|DUE:${sale.due_amount}`;

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
                  <span className="font-bold">{sale.cashier_name || 'Terminal'}</span>
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
                {hasReturns ? (
                  <>
                    <div className="flex justify-between text-stone-600 pt-1 border-t border-dotted border-stone-300">
                      <span>Original Total:</span>
                      <span className="font-semibold">Rs. {originalGrandTotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-rose-700 font-bold">
                      <span>Less Returns / Refunds:</span>
                      <span>- Rs. {returnedAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-xs font-black pt-1 border-t border-stone-400 text-stone-900">
                      <span>FINAL NET TOTAL:</span>
                      <span className="text-sm">Rs. {netPayableTotal.toLocaleString()}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between text-xs font-black pt-1 border-t border-stone-400 text-stone-900">
                    <span>NET TOTAL:</span>
                    <span>Rs. {sale.grand_total?.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-stone-700 pt-0.5">
                  <span>Paid ({sale.payment_method}):</span>
                  <span className="font-bold text-emerald-700">Rs. {sale.paid_amount?.toLocaleString()}</span>
                </div>
                {sale.due_amount > 0 ? (
                  <div className="flex justify-between text-rose-700 font-bold">
                    <span>Balance Due (Khata):</span>
                    <span>Rs. {sale.due_amount?.toLocaleString()}</span>
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
                    <span className="font-bold text-stone-900">{sale.cashier_name || 'Terminal Cashier'}</span>
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
                  {hasReturns ? (
                    <>
                      <div className="flex justify-between text-stone-600 pt-1.5 border-t border-stone-200">
                        <span>Original Invoice Total:</span>
                        <span className="font-semibold">Rs. {originalGrandTotal.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-rose-700 font-bold">
                        <span>Less Returns / Refunds:</span>
                        <span>- Rs. {returnedAmount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm font-black pt-2 border-t-2 border-stone-900 text-stone-900">
                        <span>FINAL NET TOTAL:</span>
                        <span className="text-base text-amber-900 font-black">Rs. {netPayableTotal.toLocaleString()}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between text-sm font-black pt-2 border-t-2 border-stone-900 text-stone-900">
                      <span>GRAND TOTAL:</span>
                      <span>Rs. {sale.grand_total?.toLocaleString()}</span>
                    </div>
                  )}
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
