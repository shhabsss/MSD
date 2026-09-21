import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  MapPin,
  MessageCircle,
  Phone,
  User,
  Users,
} from 'lucide-react';
import React, { useState } from 'react';
import {
  formatLongDisplayDate,
  getLocalDateString,
  isSameDay,
  normalizeDateString,
} from '../utils/dateUtils';
import {
  createWhatsAppWebUrl,
  formatStaffWhatsAppMessage,
} from '../services/storageService';
import {
  AppSettings,
  Booking,
  SlotDefinition,
  SlotPeriod,
  StaffMember,
} from '../types';

interface StaffScheduleViewProps {
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  allStaff?: StaffMember[];
  staffList?: StaffMember[];
  allSlots?: SlotDefinition[];
  slots?: SlotDefinition[];
  allBookings?: Booking[];
  bookings?: Booking[];
  onViewBooking: (booking: Booking) => void;
  onEditBooking: (booking: Booking) => void;
  settings?: AppSettings;
}

export const StaffScheduleView: React.FC<StaffScheduleViewProps> = ({
  selectedDate,
  setSelectedDate,
  allStaff = [],
  staffList,
  allSlots = [],
  slots,
  allBookings = [],
  bookings,
  onViewBooking,
  onEditBooking,
  settings,
}) => {
  const currentStaff = allStaff && allStaff.length > 0 ? allStaff : staffList || [];
  const currentSlots = allSlots && allSlots.length > 0 ? allSlots : slots || [];
  const currentBookings = allBookings && allBookings.length > 0 ? allBookings : bookings || [];

  const [selectedStaffFilter, setSelectedStaffFilter] = useState<string>('all');

  // Filter bookings for this date (excluding cancelled)
  const bookingsForDate = currentBookings.filter(
    (b) => isSameDay(b.scheduleDate || b.bookingDate, selectedDate) && b.bookingStatus !== 'Cancelled'
  );

  // Date manipulation
  const handlePrevDay = () => {
    const norm = normalizeDateString(selectedDate) || getLocalDateString();
    const [y, m, d] = norm.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    dateObj.setDate(dateObj.getDate() - 1);
    setSelectedDate(getLocalDateString(dateObj));
  };

  const handleNextDay = () => {
    const norm = normalizeDateString(selectedDate) || getLocalDateString();
    const [y, m, d] = norm.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    dateObj.setDate(dateObj.getDate() + 1);
    setSelectedDate(getLocalDateString(dateObj));
  };

  const formattedDate = formatLongDisplayDate(selectedDate);

  // Calculate workload per staff member for this date
  const staffWorkload = currentStaff.map((staff) => {
    const assignedBookings = bookingsForDate.filter((b) =>
      b.assignedStaffIds?.includes(staff.id)
    );

    // Check for overlapping slots
    const slotCounts: Record<number, number> = {};
    let hasOverlap = false;
    assignedBookings.forEach((b) => {
      slotCounts[b.slotNumber] = (slotCounts[b.slotNumber] || 0) + 1;
      if (slotCounts[b.slotNumber] > 1) {
        hasOverlap = true;
      }
    });

    return {
      staff,
      count: assignedBookings.length,
      bookings: assignedBookings,
      hasOverlap,
    };
  });

  const displayedStaffWorkload =
    selectedStaffFilter === 'all'
      ? staffWorkload
      : staffWorkload.filter((w) => w.staff.id === selectedStaffFilter);

  // Helper to get bookings by period for a staff member
  const getPeriodBookings = (bookings: Booking[], period: SlotPeriod) => {
    return bookings.filter((b) => b.slotPeriod === period);
  };

  const handleSendWhatsAppToStaff = (staff: StaffMember, booking: Booking) => {
    if (!staff.mobile) {
      alert(`No mobile number recorded for ${staff.name}`);
      return;
    }
    const template = settings?.whatsappTemplates?.staffTemplate;
    const msg = formatStaffWhatsAppMessage(
      booking,
      staff,
      template
    );
    const url = createWhatsAppWebUrl(staff.mobile, msg);
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-4">
      {/* Header & Date Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button
                onClick={handlePrevDay}
                className="p-1 rounded hover:bg-white text-slate-700 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="px-3 flex items-center gap-2 font-bold text-slate-900 text-sm sm:text-base">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span>{formattedDate}</span>
              </div>
              <button
                onClick={handleNextDay}
                className="p-1 rounded hover:bg-white text-slate-700 transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-500 font-medium">
              Daily Staff Schedule &bull; "Which staff member is going to which customer?"
            </div>
          </div>

          {/* Filter staff */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">Filter Staff:</span>
            <select
              value={selectedStaffFilter}
              onChange={(e) => setSelectedStaffFilter(e.target.value)}
              className="text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">All Staff ({currentStaff.length})</option>
              {currentStaff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Section 17: Staff Workload Counter Ribbon */}
        <div className="mt-4 pt-3 border-t border-slate-100">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Staff Workload for {selectedDate}</span>
            <span className="text-[11px] font-normal text-slate-500">
              Target: Balanced allocation &bull; 0 overlaps
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {staffWorkload.map(({ staff, count, hasOverlap }) => (
              <button
                key={staff.id}
                onClick={() =>
                  setSelectedStaffFilter(
                    selectedStaffFilter === staff.id ? 'all' : staff.id
                  )
                }
                className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                  selectedStaffFilter === staff.id
                    ? 'ring-2 ring-blue-600 border-transparent bg-blue-50/70'
                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-xs truncate">
                    {staff.name.replace(/^Mr\.\s*/, '')}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.2 rounded-full font-bold ${
                      count === 0
                        ? 'bg-slate-200 text-slate-600'
                        : count >= 4
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {count} {count === 1 ? 'job' : 'jobs'}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1 truncate">
                  {staff.mobile || 'No mobile'}
                </div>
                {hasOverlap && (
                  <div className="text-[10px] text-rose-600 font-bold mt-0.5 flex items-center gap-0.5">
                    <AlertTriangle className="w-3 h-3" />
                    <span>Overlapping slots!</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Staff Daily Timeline Cards (Section 6 & 16) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {displayedStaffWorkload.map(({ staff, count, bookings, hasOverlap }) => {
          const morningBookings = getPeriodBookings(bookings, 'Morning');
          const afternoonBookings = getPeriodBookings(bookings, 'Afternoon');
          const eveningBookings = getPeriodBookings(bookings, 'Evening');

          return (
            <div
              key={staff.id}
              className={`bg-white rounded-xl border transition-shadow shadow-2xs overflow-hidden ${
                hasOverlap ? 'border-rose-300 ring-1 ring-rose-200' : 'border-slate-200'
              }`}
            >
              {/* Staff Card Header */}
              <div className="bg-slate-900 text-white p-3.5 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center font-bold text-xs">
                      {staff.name.replace('Mr. ', '')[0]}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-white tracking-tight">
                        {staff.name}
                      </h3>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                        {staff.mobile ? (
                          <a
                            href={`tel:${staff.mobile}`}
                            className="hover:text-blue-300 flex items-center gap-1"
                          >
                            <Phone className="w-3 h-3" />
                            {staff.mobile}
                          </a>
                        ) : (
                          <span>Mobile not added</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                      count > 0 ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {count} {count === 1 ? 'Booking' : 'Bookings'}
                  </span>
                  {hasOverlap && (
                    <div className="text-[10px] text-rose-300 font-semibold mt-0.5">
                      ⚠️ Conflict
                    </div>
                  )}
                </div>
              </div>

              {/* Staff Periods Breakdown */}
              <div className="p-3.5 space-y-3 text-xs">
                {/* 1. Morning Period */}
                <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50/50">
                  <div className="flex items-center justify-between font-bold text-slate-700 text-[11px] mb-1.5">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      <span>MORNING (Slots 1 - 3)</span>
                    </span>
                    <span className="text-slate-400 font-normal">08:00 AM - 12:30 PM</span>
                  </div>

                  {morningBookings.length > 0 ? (
                    <div className="space-y-1.5">
                      {morningBookings.map((b) => (
                        <div
                          key={b.id}
                          className="bg-white border border-blue-200 rounded-lg p-2 hover:border-blue-400 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-blue-700 text-xs">
                              {b.bookingRef}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 bg-blue-50 text-blue-800 rounded font-medium">
                              Slot {b.slotNumber}
                            </span>
                          </div>
                          <div className="font-bold text-slate-900 mt-1">
                            {b.customerName}
                          </div>
                          <div className="text-[11px] text-slate-600 truncate">
                            {b.serviceType}
                          </div>
                          <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-red-500 shrink-0" />
                            <span className="truncate">
                              {b.serviceLocation} - {b.fullAddress}
                            </span>
                          </div>

                          <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between">
                            <button
                              onClick={() => onViewBooking(b)}
                              className="text-blue-600 hover:underline text-[11px] font-medium cursor-pointer"
                            >
                              View Details
                            </button>
                            <button
                              onClick={() => handleSendWhatsAppToStaff(staff, b)}
                              className="text-emerald-700 hover:text-emerald-800 text-[11px] font-semibold flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded cursor-pointer"
                            >
                              <MessageCircle className="w-3 h-3" />
                              <span>Dispatch</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-slate-400 italic text-[11px] bg-white rounded p-1.5 border border-dashed border-slate-200 text-center">
                      Available (No bookings)
                    </div>
                  )}
                </div>

                {/* 2. Afternoon Period */}
                <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50/50">
                  <div className="flex items-center justify-between font-bold text-slate-700 text-[11px] mb-1.5">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-orange-500" />
                      <span>AFTERNOON (Slots 4 - 7)</span>
                    </span>
                    <span className="text-slate-400 font-normal">01:00 PM - 06:30 PM</span>
                  </div>

                  {afternoonBookings.length > 0 ? (
                    <div className="space-y-1.5">
                      {afternoonBookings.map((b) => (
                        <div
                          key={b.id}
                          className="bg-white border border-blue-200 rounded-lg p-2 hover:border-blue-400 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-blue-700 text-xs">
                              {b.bookingRef}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 bg-blue-50 text-blue-800 rounded font-medium">
                              Slot {b.slotNumber}
                            </span>
                          </div>
                          <div className="font-bold text-slate-900 mt-1">
                            {b.customerName}
                          </div>
                          <div className="text-[11px] text-slate-600 truncate">
                            {b.serviceType}
                          </div>
                          <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-red-500 shrink-0" />
                            <span className="truncate">
                              {b.serviceLocation} - {b.fullAddress}
                            </span>
                          </div>

                          <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between">
                            <button
                              onClick={() => onViewBooking(b)}
                              className="text-blue-600 hover:underline text-[11px] font-medium cursor-pointer"
                            >
                              View Details
                            </button>
                            <button
                              onClick={() => handleSendWhatsAppToStaff(staff, b)}
                              className="text-emerald-700 hover:text-emerald-800 text-[11px] font-semibold flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded cursor-pointer"
                            >
                              <MessageCircle className="w-3 h-3" />
                              <span>Dispatch</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-slate-400 italic text-[11px] bg-white rounded p-1.5 border border-dashed border-slate-200 text-center">
                      Available (No bookings)
                    </div>
                  )}
                </div>

                {/* 3. Evening Period */}
                <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50/50">
                  <div className="flex items-center justify-between font-bold text-slate-700 text-[11px] mb-1.5">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-indigo-500" />
                      <span>EVENING (Slots 8 - 10)</span>
                    </span>
                    <span className="text-slate-400 font-normal">06:30 PM - 09:30 PM</span>
                  </div>

                  {eveningBookings.length > 0 ? (
                    <div className="space-y-1.5">
                      {eveningBookings.map((b) => (
                        <div
                          key={b.id}
                          className="bg-white border border-blue-200 rounded-lg p-2 hover:border-blue-400 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-blue-700 text-xs">
                              {b.bookingRef}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 bg-blue-50 text-blue-800 rounded font-medium">
                              Slot {b.slotNumber}
                            </span>
                          </div>
                          <div className="font-bold text-slate-900 mt-1">
                            {b.customerName}
                          </div>
                          <div className="text-[11px] text-slate-600 truncate">
                            {b.serviceType}
                          </div>
                          <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-red-500 shrink-0" />
                            <span className="truncate">
                              {b.serviceLocation} - {b.fullAddress}
                            </span>
                          </div>

                          <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between">
                            <button
                              onClick={() => onViewBooking(b)}
                              className="text-blue-600 hover:underline text-[11px] font-medium cursor-pointer"
                            >
                              View Details
                            </button>
                            <button
                              onClick={() => handleSendWhatsAppToStaff(staff, b)}
                              className="text-emerald-700 hover:text-emerald-800 text-[11px] font-semibold flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded cursor-pointer"
                            >
                              <MessageCircle className="w-3 h-3" />
                              <span>Dispatch</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-slate-400 italic text-[11px] bg-white rounded p-1.5 border border-dashed border-slate-200 text-center">
                      Available (No bookings)
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
