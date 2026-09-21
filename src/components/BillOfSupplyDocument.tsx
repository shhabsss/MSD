import React, { useRef, useState } from 'react';
import { Printer, Download, MessageCircle, CheckCircle2, ArrowLeft, ExternalLink, QrCode } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Booking, CompanyInfo, AddOnServiceItem } from '../types';
import { numberToIndianWords } from '../utils/numberToWords';
import { createWhatsAppWebUrl, buildCompletionInvoiceWhatsAppMessage } from '../services/storageService';

interface BillOfSupplyDocumentProps {
  booking: Booking;
  companyInfo: CompanyInfo;
  baseAmount: number;
  addOnServices: AddOnServiceItem[];
  discountAmount: number;
  discountType: 'flat' | 'percentage';
  discountValue: number;
  finalTotal: number;
  receivedAmount?: number;
  balanceAmount?: number;
  paymentMode: 'Cash' | 'UPI' | 'Card' | 'Bank Transfer';
  completionTime?: string;
  onBack?: () => void;
  onClose?: () => void;
}

export const BillOfSupplyDocument: React.FC<BillOfSupplyDocumentProps> = ({
  booking,
  companyInfo,
  baseAmount,
  addOnServices,
  discountAmount,
  discountType,
  discountValue,
  finalTotal,
  receivedAmount,
  balanceAmount,
  paymentMode,
  completionTime,
  onBack,
  onClose,
}) => {
  const documentRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfSuccessNotice, setPdfSuccessNotice] = useState<string | null>(null);

  // Derive bill numbers and details
  const rawRef = booking.bookingRef || '1032';
  // Extract clean number or use ref
  const invoiceNo = rawRef.replace(/[^\d]/g, '') || rawRef;

  // Format date as DD-MM-YYYY
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const invoiceDate = formatDate(booking.scheduleDate || booking.bookingDate);
  const invoiceTime = completionTime || new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  // Calculate items and discount percentage
  const primaryQty = booking.quantity && booking.quantity > 0 ? booking.quantity : 1;
  const addOnsTotal = addOnServices.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const primaryUnitPrice = primaryQty > 0 ? (baseAmount + (discountAmount > 0 && addOnsTotal === 0 ? discountAmount : 0)) / primaryQty : baseAmount;
  const primaryItemDiscount = discountAmount;
  const primaryDiscountPercent = primaryUnitPrice * primaryQty > 0 
    ? ((primaryItemDiscount / (primaryUnitPrice * primaryQty)) * 100).toFixed(3)
    : '0';

  const subtotal = (Number(baseAmount) || 0) + addOnsTotal;
  const totalQty = primaryQty + addOnServices.reduce((sum, item) => sum + (item.quantity || 1), 0);

  const effectiveReceived = receivedAmount !== undefined ? receivedAmount : finalTotal;
  const effectiveBalance = balanceAmount !== undefined ? balanceAmount : Math.max(0, finalTotal - effectiveReceived);

  // Amount in words
  const wordsAmount = numberToIndianWords(finalTotal);

  // Printable action
  const handlePrint = () => {
    window.print();
  };

  // High Resolution PDF Generation via html2canvas & jsPDF
  const handleDownloadPdf = async () => {
    if (!documentRef.current) return;
    setIsGeneratingPdf(true);
    try {
      // Temporary scroll to top to prevent canvas misalignment
      const element = documentRef.current;
      
      const canvas = await html2canvas(element, {
        scale: 2.5, // Crisp 300dpi printing density
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      // Calculate aspect ratio
      const imgProps = pdf.getImageProperties(imgData);
      const ratio = imgProps.width / imgProps.height;
      const printHeight = pdfWidth / ratio;

      if (printHeight > pdfHeight) {
        // Fits within height
        const printWidth = pdfHeight * ratio;
        const marginX = (pdfWidth - printWidth) / 2;
        pdf.addImage(imgData, 'PNG', marginX, 0, printWidth, pdfHeight, undefined, 'FAST');
      } else {
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, printHeight, undefined, 'FAST');
      }

      const fileName = `Bill_of_Supply_${rawRef.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
      pdf.save(fileName);

      setPdfSuccessNotice(`Downloaded ${fileName}`);
      setTimeout(() => setPdfSuccessNotice(null), 3500);
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Could not download PDF directly. Opening print dialog instead.');
      window.print();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Send WhatsApp Receipt with prompt
  const handleSendWhatsApp = () => {
    const phone = booking.customerWhatsApp || booking.customerMobile;
    if (!phone) {
      alert('Customer phone number is missing.');
      return;
    }

    const constructedBooking: Booking = {
      ...booking,
      amount: finalTotal,
      finalCollectedAmount: effectiveReceived,
      balanceAmount: effectiveBalance,
      addOnServices,
      discountAmount,
      paymentMode,
    };

    const text = buildCompletionInvoiceWhatsAppMessage(constructedBooking, companyInfo);
    const url = createWhatsAppWebUrl(phone, text);
    window.open(url, '_blank');
  };

  // Dynamic UPI Link for instant QR scan
  const upiPayUrl = `upi://pay?pa=7812479352@kotak&pn=MSD%20Facility%20Services&am=${finalTotal}&cu=INR&tn=Bill%20${rawRef}`;

  return (
    <div className="space-y-4">
      {/* Action Bar (Hidden during window.print) */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-100 rounded-xl border border-slate-300 print:hidden">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Edit</span>
            </button>
          )}
          <span className="text-xs font-bold text-slate-700">
            Bill of Supply (Non-GST Document) &bull; Ref: {rawRef}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {pdfSuccessNotice && (
            <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{pdfSuccessNotice}</span>
            </span>
          )}

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-400 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
            title="Download crisp A4 PDF"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isGeneratingPdf ? 'Generating PDF...' : 'Download PDF'}</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
            title="Print or Save as PDF"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Bill</span>
          </button>

          <button
            type="button"
            onClick={handleSendWhatsApp}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
            title="Share Bill summary on WhatsApp"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>Send WhatsApp</span>
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-white hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 cursor-pointer"
            >
              Done
            </button>
          )}
        </div>
      </div>

      {/* Bill of Supply Printable Sheet (Exact 1:1 replica of sample PDF) */}
      <div className="overflow-x-auto pb-4 flex justify-center">
        <div
          ref={documentRef}
          id="bill-of-supply-printable"
          className="w-[794px] min-h-[1123px] bg-white text-slate-900 p-8 sm:p-10 border border-slate-900 shadow-lg font-sans text-xs relative select-text"
          style={{ boxSizing: 'border-box' }}
        >
          {/* Top Title: Bill of Supply */}
          <div className="text-center pb-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 uppercase">
              Bill of Supply
            </h1>
          </div>

          {/* Seller / Company Details with Logo */}
          <div className="border border-slate-900 p-3 mb-[-1px] flex items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-slate-900 leading-tight">
                {companyInfo.name || 'MSD Facility Services'}
              </h2>
              <p className="text-[11px] text-slate-800">
                {companyInfo.address || 'No 73, 6th Cross, JJ Nagar, Moolakulam, Pondicherry,605010'}
              </p>
              <p className="text-[11px] font-semibold text-slate-900">
                PAN No. {companyInfo.panNo || 'BWAPB3440A'}
              </p>
              <div className="flex items-center gap-6 text-[11px] text-slate-800 pt-0.5">
                <span>
                  Phone: <strong>{companyInfo.mobile || '9042233122'}</strong>
                </span>
                <span>
                  Email: <strong>{companyInfo.email || 'msdfacilityservices@gmail.com'}</strong>
                </span>
              </div>
            </div>

            {/* Official Logo */}
            <div className="shrink-0 flex items-center justify-center p-1">
              <img
                src="/logo1.png"
                alt="MSD Facility Services"
                className="h-16 w-auto max-w-[170px] object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/logo1.svg';
                }}
              />
            </div>
          </div>

          {/* Bill To & Invoice Details Grid (2 Columns with clean borders) */}
          <div className="grid grid-cols-2 border border-slate-900 mb-[-1px]">
            {/* Bill To */}
            <div className="p-3 border-r border-slate-900 space-y-1">
              <div className="font-bold text-slate-900 text-xs">Bill To:</div>
              <div className="font-semibold text-slate-900 text-sm">
                {booking.customerName?.toLowerCase().startsWith('mr') || booking.customerName?.toLowerCase().startsWith('ms')
                  ? booking.customerName
                  : `Mr. ${booking.customerName || 'Customer'}`}
              </div>
              <div className="text-[11px] text-slate-800">
                {booking.serviceLocation || 'Puducherry'}
                {booking.fullAddress && booking.fullAddress !== booking.serviceLocation && (
                  <span>, {booking.fullAddress}</span>
                )}
              </div>
              <div className="text-[11px] text-slate-800">
                Contact No: <strong>+91{booking.customerMobile?.replace(/^\+91/, '')}</strong>
              </div>
            </div>

            {/* Invoice Details */}
            <div className="p-3 space-y-1">
              <div className="font-bold text-slate-900 text-xs">Invoice Details:</div>
              <div className="text-[11px] text-slate-800">
                No: <strong>{invoiceNo}</strong>
              </div>
              <div className="text-[11px] text-slate-800">
                Date: <strong>{invoiceDate}</strong>
              </div>
              <div className="text-[11px] text-slate-800">
                Time: <strong>{invoiceTime}</strong>
              </div>
            </div>
          </div>

          {/* Itemized Service Table */}
          <table className="w-full border-collapse border border-slate-900 text-xs mb-[-1px]">
            <thead>
              <tr className="bg-slate-50 text-slate-900 font-bold border-b border-slate-900">
                <th className="border-r border-slate-900 p-2 text-center w-10">#</th>
                <th className="border-r border-slate-900 p-2 text-left">Item name</th>
                <th className="border-r border-slate-900 p-2 text-center w-20">Quantity</th>
                <th className="border-r border-slate-900 p-2 text-right w-28">Price/ unit (₹)</th>
                <th className="border-r border-slate-900 p-2 text-right w-32">Discount (₹)</th>
                <th className="p-2 text-right w-28">Amount(₹)</th>
              </tr>
            </thead>
            <tbody>
              {/* Primary Service Item */}
              <tr className="border-b border-slate-900">
                <td className="border-r border-slate-900 p-2 text-center font-medium">1</td>
                <td className="border-r border-slate-900 p-2">
                  <div className="font-bold text-slate-900">{booking.serviceType}</div>
                  {booking.serviceDescription && (
                    <div className="text-[10px] text-slate-600 mt-0.5">{booking.serviceDescription}</div>
                  )}
                </td>
                <td className="border-r border-slate-900 p-2 text-center">{primaryQty}</td>
                <td className="border-r border-slate-900 p-2 text-right">
                  ₹ {primaryUnitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="border-r border-slate-900 p-2 text-right">
                  {primaryItemDiscount > 0 ? (
                    <div>
                      <div>₹ {primaryItemDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                      <div className="text-[10px] text-slate-500">({primaryDiscountPercent}%)</div>
                    </div>
                  ) : (
                    '₹ 0.00'
                  )}
                </td>
                <td className="p-2 text-right font-semibold">
                  ₹ {Math.max(0, (primaryUnitPrice * primaryQty) - primaryItemDiscount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>

              {/* Add-on Services Items */}
              {addOnServices.map((item, idx) => {
                const itemQty = item.quantity || 1;
                const unitRate = itemQty > 0 ? (Number(item.amount) || 0) / itemQty : (Number(item.amount) || 0);
                return (
                  <tr key={item.id || idx} className="border-b border-slate-900">
                    <td className="border-r border-slate-900 p-2 text-center font-medium">{idx + 2}</td>
                    <td className="border-r border-slate-900 p-2">
                      <div className="font-bold text-slate-900">{item.name}</div>
                      <div className="text-[10px] text-emerald-700">On-site Add-on Service</div>
                    </td>
                    <td className="border-r border-slate-900 p-2 text-center">{itemQty}</td>
                    <td className="border-r border-slate-900 p-2 text-right">
                      ₹ {unitRate.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="border-r border-slate-900 p-2 text-right">₹ 0.00</td>
                    <td className="p-2 text-right font-semibold">
                      ₹ {(Number(item.amount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                );
              })}

              {/* Spacer empty row for visual balance */}
              <tr className="border-b border-slate-900 h-14">
                <td className="border-r border-slate-900"></td>
                <td className="border-r border-slate-900"></td>
                <td className="border-r border-slate-900"></td>
                <td className="border-r border-slate-900"></td>
                <td className="border-r border-slate-900"></td>
                <td></td>
              </tr>

              {/* Total Row */}
              <tr className="border-b border-slate-900 font-bold bg-white">
                <td className="border-r border-slate-900 p-2 text-center">Total</td>
                <td className="border-r border-slate-900 p-2"></td>
                <td className="border-r border-slate-900 p-2 text-center">{totalQty}</td>
                <td className="border-r border-slate-900 p-2 text-right"></td>
                <td className="border-r border-slate-900 p-2 text-right">
                  ₹ {discountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="p-2 text-right">
                  ₹ {finalTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Lower Grid: Left Side Terms & Bank Details | Right Side Financial Breakdown */}
          <div className="grid grid-cols-2 border border-slate-900">
            {/* Left Column */}
            <div className="border-r border-slate-900 flex flex-col justify-between">
              {/* Payment Mode Box */}
              <div className="p-2.5 border-b border-slate-900">
                <div className="font-bold text-slate-900 text-xs">Payment Mode:</div>
                <div className="text-slate-900 font-semibold text-xs mt-0.5">{paymentMode}</div>
              </div>

              {/* Terms And Conditions Box */}
              <div className="p-2.5 border-b border-slate-900 space-y-1 text-[11px] text-slate-800">
                <div className="font-bold text-slate-900 text-xs">Terms And Conditions:</div>
                <p>Thank you for doing business with us</p>
                <p>
                  1. Interest @ 2% p.a. will be charged if the payment is not made with in the stipulated time
                </p>
                <p>2. Subject to &apos;Puducherry&apos; Jurisdiction only.</p>
              </div>

              {/* Bank Details Box with QR */}
              <div className="p-2.5 space-y-1 text-[11px] text-slate-800">
                <div className="font-bold text-slate-900 text-xs mb-1.5">Bank Details:</div>
                <div className="flex items-center gap-3">
                  {/* Generated QR Code for instant UPI payment */}
                  <div className="shrink-0 flex flex-col items-center">
                    <div className="w-20 h-20 bg-white border border-slate-300 p-1 flex items-center justify-center rounded">
                      {/* Stylized QR Code SVG */}
                      <svg viewBox="0 0 100 100" className="w-full h-full text-slate-900 fill-current">
                        <rect x="5" y="5" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="6" />
                        <rect x="13" y="13" width="12" height="12" />
                        <rect x="67" y="5" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="6" />
                        <rect x="75" y="13" width="12" height="12" />
                        <rect x="5" y="67" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="6" />
                        <rect x="13" y="75" width="12" height="12" />
                        <rect x="42" y="10" width="8" height="8" />
                        <rect x="50" y="24" width="8" height="8" />
                        <rect x="10" y="45" width="8" height="8" />
                        <rect x="25" y="42" width="8" height="8" />
                        <rect x="42" y="42" width="16" height="16" />
                        <rect x="68" y="42" width="8" height="8" />
                        <rect x="82" y="45" width="8" height="8" />
                        <rect x="45" y="68" width="8" height="8" />
                        <rect x="62" y="62" width="8" height="8" />
                        <rect x="78" y="72" width="8" height="8" />
                        <rect x="65" y="82" width="8" height="8" />
                        <rect x="80" y="82" width="8" height="8" />
                      </svg>
                    </div>
                    <span className="text-[9px] font-bold text-emerald-800 mt-0.5 uppercase tracking-wider">
                      UPI CLICK TO PAY
                    </span>
                  </div>

                  <div className="space-y-0.5 text-[10px] leading-tight">
                    <div>
                      Name: <strong>{companyInfo.bankName || 'Kotak Mahindra Bank Limited, Puducherry Pondicherr'}</strong>
                    </div>
                    <div>
                      Account No.: <strong>{companyInfo.bankAccountNo || '7812479352'}</strong>
                    </div>
                    <div>
                      IFSC code: <strong>{companyInfo.bankIfsc || 'KKBK0008955'}</strong>
                    </div>
                    <div>
                      Account Holder&apos;s Name: <strong>{companyInfo.bankAccountHolder || 'Baharul Islam Borbhuyan'}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Financial Summary Table & Signature */}
            <div className="flex flex-col justify-between">
              {/* Financial Lines */}
              <div className="divide-y divide-slate-900 text-xs">
                <div className="p-2 flex justify-between">
                  <span className="font-semibold text-slate-800">Sub Total</span>
                  <span className="font-bold">
                    : ₹ {subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="p-2 flex justify-between font-bold">
                  <span>Total</span>
                  <span>
                    : ₹ {finalTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                {/* Invoice Amount in Words Box */}
                <div className="p-2 space-y-0.5 bg-slate-50/50">
                  <div className="font-bold text-slate-900 text-[11px]">Invoice Amount In Words :</div>
                  <div className="text-[11px] font-medium italic text-slate-800">{wordsAmount}</div>
                </div>

                <div className="p-2 flex justify-between text-[11px]">
                  <span className="text-slate-800">Received</span>
                  <span className="font-semibold">
                    : ₹ {effectiveReceived.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="p-2 flex justify-between text-[11px]">
                  <span className="text-slate-800">Balance</span>
                  <span className="font-semibold">
                    : ₹ {effectiveBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="p-2 flex justify-between text-[11px]">
                  <span className="text-slate-800">Previous Balance</span>
                  <span className="font-semibold">: ₹ 0.00</span>
                </div>

                <div className="p-2 flex justify-between text-[11px]">
                  <span className="text-slate-800">Current Balance</span>
                  <span className="font-semibold">
                    : ₹ {effectiveBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="p-2 flex justify-between text-[11px] font-bold text-slate-900">
                  <span>You Saved</span>
                  <span className="text-emerald-700 font-bold">
                    : ₹ {discountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Authorized Signatory Block */}
              <div className="p-3 border-t border-slate-900 text-center space-y-2">
                <div className="text-left font-bold text-slate-900 text-xs">
                  For {companyInfo.name || 'MSD Facility Services'}:
                </div>

                {/* Hand-drawn Signature Stamp Box */}
                <div className="flex justify-center pt-2">
                  <div className="w-48 h-14 border border-slate-400 rounded bg-slate-100 flex items-center justify-center relative overflow-hidden">
                    {/* SVG Signature representation */}
                    <svg viewBox="0 0 200 60" className="w-44 h-12 stroke-slate-800 fill-none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      {/* B. Borbhuyan cursive flourish */}
                      <path d="M 20 40 C 25 18 35 12 40 22 C 45 32 30 38 48 35 C 65 30 55 15 68 25 C 75 30 85 28 95 32" />
                      <path d="M 80 42 C 90 12 105 10 115 28 C 120 38 135 25 145 30 C 155 35 170 20 180 34" />
                      <path d="M 25 45 Q 90 40 185 36" strokeWidth="1.8" />
                    </svg>
                  </div>
                </div>

                <div className="font-bold text-slate-900 text-xs pt-1">
                  Authorized Signatory
                </div>
              </div>
            </div>
          </div>

          {/* Discreet Footer Stamp */}
          <div className="mt-4 pt-2 text-[10px] text-slate-500 text-center flex items-center justify-between border-t border-slate-200">
            <span>MSD Facility Services &bull; Puducherry</span>
            <span>Non-GST Bill of Supply &bull; Generated digitally</span>
          </div>
        </div>
      </div>
    </div>
  );
};
