import {
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  Edit2,
  FileText,
  MapPin,
  MessageCircle,
  Phone,
  Printer,
  Receipt,
  Send,
  Share2,
  User,
  Users,
  X,
} from 'lucide-react';
import React, { useState } from 'react';
import {
  createWhatsAppWebUrl,
  formatCustomerWhatsAppMessage,
  formatStaffWhatsAppMessage,
} from '../services/storageService';
import {
  AppSettings,
  Booking,
  BookingStatus,
  CompanyInfo,
  PaymentStatus,
  StaffMember,
} from '../types';

interface BookingDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  onEdit: (booking: Booking) => void;
  onStatusChange: (bookingId: string, status: BookingStatus) => void;
  onPaymentStatusChange?: (bookingId: string, status: PaymentStatus) => void;
  onOpenMessageModal?: (booking: Booking) => void;
  onOpenCompleteModal?: (booking: Booking) => void;
  companyInfo?: CompanyInfo;
  allStaff?: StaffMember[];
  settings?: AppSettings;
}

export const BookingDetailModal: React.FC<BookingDetailModalProps> = ({
  isOpen,
  onClose,
  booking,
  onEdit,
  onStatusChange,
  onPaymentStatusChange,
  onOpenMessageModal,
  onOpenCompleteModal,
  companyInfo,
  allStaff = [],
  settings,
}) => {
  const [selectedStaffForWhatsApp, setSelectedStaffForWhatsApp] = useState<string>('');
  const [copiedNotice, setCopiedNotice] = useState<string | null>(null);

  if (!isOpen || !booking) return null;

  const resolvedCompanyName = companyInfo?.name || 'MSD Facility Services';

  const locationDisplay =
    booking.serviceLocation === 'Other' && booking.customLocation
      ? booking.customLocation
      : booking.serviceLocation;

  const formattedAmount =
    typeof booking.amount === 'number'
      ? `₹${booking.amount.toLocaleString('en-IN')}`
      : `${booking.amount}`;

  // WhatsApp formatted messages
  const customerMsg = formatCustomerWhatsAppMessage(
    booking,
    settings?.whatsappTemplates?.customerTemplate,
    allStaff,
    companyInfo
  );

  const handleSendCustomerWhatsApp = () => {
    const phone = booking.customerWhatsApp || booking.customerMobile;
    const url = createWhatsAppWebUrl(phone, customerMsg);
    window.open(url, '_blank');
  };

  const handleSendStaffWhatsApp = (staffId: string) => {
    const staff = (allStaff || []).find((s) => s.id === staffId);
    if (!staff || !staff.mobile) {
      alert(`No valid mobile number configured for ${staff?.name || 'this staff member'}.`);
      return;
    }
    const staffMsg = formatStaffWhatsAppMessage(
      booking,
      staff,
      settings?.whatsappTemplates?.staffTemplate,
      companyInfo
    );
    const url = createWhatsAppWebUrl(staff.mobile, staffMsg);
    window.open(url, '_blank');
  };

  const handleCopyCustomerMsg = () => {
    navigator.clipboard.writeText(customerMsg);
    setCopiedNotice('Customer message copied to clipboard!');
    setTimeout(() => setCopiedNotice(null), 2500);
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  const handleShare = () => {
    const summary = `${resolvedCompanyName} - Booking #${booking.bookingRef}
Customer: ${booking.customerName} (${booking.customerMobile})
Date: ${booking.scheduleDate} | ${booking.preferredTime}
Service: ${booking.serviceType}
Location: ${locationDisplay} - ${booking.fullAddress}
Staff: ${booking.assignedStaffNames?.join(', ') || 'None'}
Amount: ${formattedAmount} (Status: ${booking.bookingStatus})`;

    if (navigator.share) {
      navigator
        .share({
          title: `MSD Booking ${booking.bookingRef}`,
          text: summary,
        })
        .catch(() => {
          navigator.clipboard.writeText(summary);
          setCopiedNotice('Booking summary copied to clipboard!');
          setTimeout(() => setCopiedNotice(null), 2500);
        });
    } else {
      navigator.clipboard.writeText(summary);
      setCopiedNotice('Booking summary copied to clipboard!');
      setTimeout(() => setCopiedNotice(null), 2500);
    }
  };

  // Determine assigned staff objects
  const assignedStaffObjects = (allStaff || []).filter((s) =>
    booking.assignedStaffIds?.includes(s.id)
  );

  const getStatusBadgeConfig = (status: BookingStatus) => {
    switch (status) {
      case 'New':
        return { badge: 'bg-blue-100 text-blue-800 border-blue-300', dot: 'bg-blue-500' };
      case 'Pending':
        return { badge: 'bg-amber-100 text-amber-900 border-amber-300', dot: 'bg-amber-500' };
      case 'Confirmed':
        return { badge: 'bg-emerald-100 text-emerald-800 border-emerald-300', dot: 'bg-emerald-500' };
      case 'Staff Assigned':
        return { badge: 'bg-indigo-100 text-indigo-800 border-indigo-300', dot: 'bg-indigo-500' };
      case 'In Progress':
        return { badge: 'bg-cyan-100 text-cyan-800 border-cyan-300', dot: 'bg-cyan-500' };
      case 'Completed':
        return { badge: 'bg-emerald-600 text-white border-emerald-700', dot: 'bg-white' };
      case 'Rescheduled':
        return { badge: 'bg-purple-100 text-purple-800 border-purple-300', dot: 'bg-purple-500' };
      case 'Cancelled':
        return { badge: 'bg-rose-100 text-rose-800 border-rose-300', dot: 'bg-rose-500' };
      default:
        return { badge: 'bg-slate-100 text-slate-800 border-slate-300', dot: 'bg-slate-500' };
    }
  };

  const statusVisual = getStatusBadgeConfig(booking.bookingStatus);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 print:p-0 print:bg-white">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[94vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 print:border-none print:shadow-none print:max-h-none print:w-full">
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 print:bg-white print:text-black print:border-b-2 print:border-slate-900">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-sm text-white shadow-xs print:hidden">
              MSD
            </div>
            <div>
              <div className="text-xs uppercase font-semibold text-blue-400 print:text-slate-600">
                {resolvedCompanyName}
              </div>
              <h2 className="text-base font-bold tracking-tight text-white print:text-black">
                Booking Details &bull; <span className="font-mono">{booking.bookingRef}</span>
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer print:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {copiedNotice && (
            <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{copiedNotice}</span>
            </div>
          )}

          {/* Company Banner (Printable) */}
          <div className="border-b border-slate-200 pb-3 text-slate-600 space-y-0.5">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-base font-bold text-slate-900">{resolvedCompanyName}</h1>
                {companyInfo?.address && <p className="text-[11px] text-slate-500">{companyInfo.address}</p>}
                <p className="text-[11px] text-slate-500">
                  {companyInfo?.mobile && <>Mobile: <span className="font-semibold text-slate-800">{companyInfo.mobile}</span></>}
                  {companyInfo?.email && <> | Email: {companyInfo.email}</>}
                </p>
              </div>
              <div className="text-right space-y-1">
                <div className="flex items-center justify-end gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusVisual.dot}`} />
                  <select
                    value={booking.bookingStatus}
                    onChange={(e) => {
                      const newStatus = e.target.value as BookingStatus;
                      const cleanAmt = typeof booking.amount === 'number'
                        ? booking.amount
                        : parseFloat(String(booking.amount).replace(/[^\d.]/g, '')) || 0;

                      if (newStatus === 'Completed') {
                        if (cleanAmt <= 0 && onOpenCompleteModal) {
                          onOpenCompleteModal(booking);
                          return;
                        }
                      }
                      onStatusChange(booking.id, newStatus);
                    }}
                    className={`text-xs font-bold rounded-lg px-2.5 py-1 border shadow-2xs cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500 ${statusVisual.badge}`}
                    title="Change booking status"
                  >
                    <option value="New">New</option>
                    <option value="Pending">Pending</option>
                    <option value="Confirmed">Confirmed</option>
                    <option value="Staff Assigned">Staff Assigned</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="Rescheduled">Rescheduled</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
                <div className="flex items-center justify-end gap-1.5 text-[11px] text-slate-500">
                  <span>Payment:</span>
                  {onPaymentStatusChange ? (
                    <select
                      value={booking.paymentStatus || (booking.bookingStatus === 'Cancelled' ? 'Cancelled' : 'Pending')}
                      onChange={(e) => onPaymentStatusChange(booking.id, e.target.value as PaymentStatus)}
                      className="text-[11px] font-semibold rounded px-1.5 py-0.5 border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value="Paid">Paid</option>
                      <option value="Pending">Pending</option>
                      <option value="Advance Paid">Advance Paid</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  ) : (
                    <span className="font-semibold text-slate-700">{booking.paymentStatus || 'Pending'}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Schedule & Slot */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <div className="text-[11px] text-slate-500 font-medium">Schedule Date</div>
              <div className="font-bold text-slate-900 text-sm mt-0.5">
                {booking.scheduleDate}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500 font-medium">Daily Slot</div>
              <div className="font-bold text-blue-700 text-sm mt-0.5">
                Slot {booking.slotNumber} ({booking.slotPeriod})
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500 font-medium">Time Window</div>
              <div className="font-medium text-slate-800 text-xs mt-0.5">
                {booking.preferredTime}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500 font-medium">Booking Date</div>
              <div className="text-slate-600 text-xs mt-0.5">{booking.bookingDate}</div>
            </div>
          </div>

          {/* Customer & Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1.5">
              <div className="font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-1">
                <User className="w-3.5 h-3.5 text-blue-600" />
                <span>Customer Details</span>
              </div>
              <div>
                <div className="text-slate-400 text-[11px]">Name:</div>
                <div className="font-bold text-slate-900 text-sm">{booking.customerName}</div>
              </div>
              <div className="flex items-center gap-3 pt-1">
                <div>
                  <div className="text-slate-400 text-[11px]">Mobile:</div>
                  <a
                    href={`tel:${booking.customerMobile}`}
                    className="font-mono text-blue-600 hover:underline font-semibold flex items-center gap-1"
                  >
                    <Phone className="w-3 h-3" />
                    {booking.customerMobile}
                  </a>
                </div>
                {booking.customerWhatsApp && (
                  <div>
                    <div className="text-slate-400 text-[11px]">WhatsApp:</div>
                    <span className="font-mono text-slate-700 font-semibold">
                      {booking.customerWhatsApp}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1.5">
              <div className="font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-1">
                <MapPin className="w-3.5 h-3.5 text-red-500" />
                <span>Service &amp; Location</span>
              </div>
              <div>
                <div className="text-slate-400 text-[11px]">Service Requested:</div>
                <div className="font-bold text-slate-900 text-xs">
                  {booking.serviceType}
                </div>
              </div>
              {booking.serviceDescription && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 mt-1.5">
                  <div className="text-amber-900 font-bold text-[11px] flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-amber-700" />
                    <span>Work Description / Scope:</span>
                  </div>
                  <div className="text-slate-800 text-xs mt-1 whitespace-pre-wrap leading-relaxed">
                    {booking.serviceDescription}
                  </div>
                </div>
              )}
              <div>
                <div className="text-slate-400 text-[11px]">Location Area:</div>
                <div className="font-semibold text-slate-800">{locationDisplay}</div>
              </div>
              {booking.fullAddress && (
                <div>
                  <div className="text-slate-400 text-[11px]">Full Address:</div>
                  <div className="text-slate-600">{booking.fullAddress}</div>
                </div>
              )}
            </div>
          </div>

          {/* Assigned Staff Members */}
          <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-200 space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-bold text-blue-950 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-600" />
                <span>
                  Assigned Staff Team ({booking.assignedStaffNames?.length || 0} Staff)
                </span>
              </div>
              <button
                onClick={() => onEdit(booking)}
                className="text-blue-700 hover:text-blue-900 font-semibold text-[11px] print:hidden cursor-pointer"
              >
                Change Assignment
              </button>
            </div>

            {assignedStaffObjects.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {assignedStaffObjects.map((staff) => (
                  <div
                    key={staff.id}
                    className="bg-white p-2 rounded-lg border border-blue-200 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-slate-900">{staff.name}</div>
                      <div className="text-[11px] text-slate-500">
                        {staff.mobile ? (
                          <a href={`tel:${staff.mobile}`} className="hover:text-blue-600">
                            Mobile: {staff.mobile}
                          </a>
                        ) : (
                          'No mobile recorded'
                        )}
                      </div>
                    </div>
                    {staff.mobile && (
                      <button
                        onClick={() => handleSendStaffWhatsApp(staff.id)}
                        title={`Send assignment details to ${staff.name} on WhatsApp`}
                        className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-md font-semibold text-[10px] flex items-center gap-1 border border-emerald-200 print:hidden cursor-pointer"
                      >
                        <MessageCircle className="w-3 h-3" />
                        <span>WhatsApp</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white p-3 rounded-lg border border-dashed border-amber-300 text-amber-800 text-center">
                No staff members currently assigned to this booking.
              </div>
            )}
          </div>

          {/* Payment Breakdown */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-1">
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                <span>Billing &amp; Payment Breakdown</span>
              </div>
              {onOpenCompleteModal && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenCompleteModal(booking);
                  }}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer shadow-2xs print:hidden"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>
                    {booking.bookingStatus === 'Completed'
                      ? 'Invoice / Bill Details'
                      : 'Complete Service & Bill'}
                  </span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-white p-2 rounded-lg border border-slate-200">
                <div className="text-[11px] text-slate-500">
                  {booking.bookingStatus === 'Completed' ? 'Final Paid Amount' : 'Total Booking Amount'}
                </div>
                <div className="text-base font-bold text-slate-900 mt-0.5">
                  {booking.bookingStatus === 'Completed'
                    ? `₹${(Number(booking.finalCollectedAmount ?? booking.amount) || 0).toLocaleString('en-IN')}`
                    : formattedAmount}
                </div>
                {booking.paymentMode && (
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 inline-block mt-0.5">
                    {booking.paymentMode}
                  </span>
                )}
              </div>
              <div className="bg-white p-2 rounded-lg border border-slate-200">
                <div className="text-[11px] text-slate-500">Advance Received</div>
                <div className="text-base font-bold text-emerald-700 mt-0.5">
                  ₹{(booking.advanceAmount || 0).toLocaleString('en-IN')}
                </div>
              </div>
              <div className="bg-white p-2 rounded-lg border border-slate-200">
                <div className="text-[11px] text-slate-500">Balance Pending</div>
                <div className="text-base font-bold text-amber-700 mt-0.5">
                  ₹{(booking.balanceAmount || 0).toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            {/* Extra On-Site Add-ons / Discounts if Completed */}
            {booking.addOnServices && booking.addOnServices.length > 0 && (
              <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-lg space-y-1">
                <div className="font-bold text-emerald-900 text-[11px]">
                  On-Site Extra Work Added:
                </div>
                <div className="space-y-0.5">
                  {booking.addOnServices.map((addon) => (
                    <div
                      key={addon.id}
                      className="flex items-center justify-between text-xs text-emerald-800"
                    >
                      <span>
                        &bull; {addon.name} {addon.quantity > 1 ? `(Qty: ${addon.quantity})` : ''}
                      </span>
                      <span className="font-mono font-semibold">
                        +₹{Number(addon.amount).toLocaleString('en-IN')}
                      </span>
                    </div>
                  ))}
                </div>
                {booking.discountAmount && booking.discountAmount > 0 ? (
                  <div className="flex items-center justify-between text-xs text-amber-800 font-bold border-t border-emerald-200/60 pt-1 mt-1">
                    <span>Discount Deducted:</span>
                    <span className="font-mono">-₹{booking.discountAmount.toLocaleString('en-IN')}</span>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {/* Notes */}
          {booking.notes && (
            <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-200">
              <div className="font-semibold text-amber-900 text-xs mb-0.5">
                Special Instructions / Notes:
              </div>
              <p className="text-amber-800 text-[11px]">{booking.notes}</p>
            </div>
          )}

          {/* Automatic Booking Message Status & Dispatch Section */}
          <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-200 space-y-3 print:hidden shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold">
                  <MessageCircle className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-emerald-950 text-xs">
                    Automatic WhatsApp Messaging System
                  </div>
                  <div className="text-[11px] text-emerald-800">
                    Track delivery status &amp; send instant confirmations
                  </div>
                </div>
              </div>

              {onOpenMessageModal && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenMessageModal(booking);
                  }}
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Open Message Manager</span>
                </button>
              )}
            </div>

            {/* Customer Status Row */}
            <div className="bg-white p-3 rounded-lg border border-emerald-200 flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-800 text-xs">Customer Message:</span>
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      booking.customerMessageStatus === 'Sent'
                        ? 'bg-emerald-100 text-emerald-800'
                        : booking.customerMessageStatus === 'Opened'
                        ? 'bg-blue-100 text-blue-800'
                        : !booking.customerMobile
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-amber-100 text-amber-900'
                    }`}
                  >
                    {booking.customerMessageStatus || (!booking.customerMobile ? 'Number Missing' : 'Ready to Send')}
                  </span>
                </div>
                <div className="text-[11px] text-slate-600">
                  {booking.customerName} &bull; {booking.customerMobile || <span className="text-rose-600 font-bold">No mobile</span>}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleCopyCustomerMsg}
                  className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                  title="Copy Customer Message"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleSendCustomerWhatsApp}
                  className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                >
                  <Send className="w-3 h-3" />
                  <span>
                    {booking.customerMessageStatus === 'Sent' || booking.customerMessageStatus === 'Opened'
                      ? 'Resend Customer'
                      : 'Send to Customer'}
                  </span>
                </button>
              </div>
            </div>

            {/* Staff Messages Row */}
            <div className="space-y-2">
              <div className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                <span>Staff Messages Status:</span>
                <span className="text-slate-500 font-normal">
                  {assignedStaffObjects.length} Assigned Staff
                </span>
              </div>

              {assignedStaffObjects.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {assignedStaffObjects.map((staff) => {
                    const stStatus = booking.staffMessageStatuses?.[staff.id]?.status || (staff.mobile ? 'Ready' : 'Number Missing');
                    return (
                      <div
                        key={staff.id}
                        className="bg-white p-2.5 rounded-lg border border-emerald-200 flex items-center justify-between gap-2"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-800 text-xs truncate">
                              {staff.name}
                            </span>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                                stStatus === 'Sent'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : stStatus === 'Opened'
                                  ? 'bg-blue-100 text-blue-800'
                                  : !staff.mobile
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-900'
                              }`}
                            >
                              {stStatus}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 truncate">
                            {staff.mobile || <span className="text-rose-600 font-medium">No mobile number</span>}
                          </div>
                        </div>

                        {staff.mobile ? (
                          <button
                            type="button"
                            onClick={() => handleSendStaffWhatsApp(staff.id)}
                            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-bold text-[10px] flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs"
                          >
                            <Send className="w-2.5 h-2.5" />
                            <span>{stStatus === 'Sent' || stStatus === 'Opened' ? 'Resend' : 'Send'}</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">No phone</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-white/80 p-2.5 rounded-lg border border-dashed border-amber-300 text-amber-800 text-[11px] text-center">
                  No staff members currently assigned. Assign staff to dispatch WhatsApp job details.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer (Controls) */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 print:hidden">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrintReceipt}
              className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Print Receipt</span>
            </button>
            <button
              onClick={handleShare}
              className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5 text-slate-500" />
              <span>Share</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {onOpenCompleteModal && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCompleteModal(booking);
                }}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>
                  {booking.bookingStatus === 'Completed'
                    ? 'Invoice & Bill'
                    : 'Complete Service & Bill'}
                </span>
              </button>
            )}
            <button
              onClick={() => {
                onClose();
                onEdit(booking);
              }}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Edit Booking</span>
            </button>
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-semibold transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
