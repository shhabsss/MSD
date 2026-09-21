import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  UserCheck,
} from 'lucide-react';
import React, { useState } from 'react';
import {
  formatLongDisplayDate,
  getLocalDateString,
  getTomorrowDateString,
  isSameDay,
  normalizeDateString,
} from '../utils/dateUtils';
import { Booking, StaffMember } from '../types';

interface CalendarViewProps {
  selectedDate: string; // YYYY-MM-DD
  setSelectedDate: (date: string) => void;
  allBookings?: Booking[];
  bookings?: Booking[];
  allStaff?: StaffMember[];
  onViewBooking: (booking: Booking) => void;
  onEditBooking: (booking: Booking) => void;
  onNewBookingForDate?: (date: string) => void;
  onNewBooking?: (date?: string) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  selectedDate,
  setSelectedDate,
  allBookings = [],
  bookings,
  allStaff = [],
  onViewBooking,
  onEditBooking,
  onNewBookingForDate,
  onNewBooking,
}) => {
  const currentBookings = allBookings && allBookings.length > 0 ? allBookings : bookings || [];
  // Calendar month state (defaults to month of selectedDate or current)
  const initialDate = selectedDate ? new Date(selectedDate + 'T00:00:00') : new Date();
  const [currentYear, setCurrentYear] = useState(
    isNaN(initialDate.getTime()) ? new Date().getFullYear() : initialDate.getFullYear()
  );
  const [currentMonth, setCurrentMonth] = useState(
    isNaN(initialDate.getTime()) ? new Date().getMonth() : initialDate.getMonth()
  ); // 0-indexed

  const handleCreateBooking = (date: string) => {
    if (onNewBookingForDate) onNewBookingForDate(date);
    else if (onNewBooking) onNewBooking(date);
  };

  // Booking counts map: "YYYY-MM-DD" -> count
  const bookingsCountByDate: Record<string, number> = {};
  currentBookings.forEach((b) => {
    if (b.bookingStatus !== 'Cancelled') {
      const normDate = normalizeDateString(b.scheduleDate || b.bookingDate);
      if (normDate) {
        bookingsCountByDate[normDate] = (bookingsCountByDate[normDate] || 0) + 1;
      }
    }
  });

  // Calendar month helpers
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  // Quick Preset Filters: Today, Tomorrow, This Week, This Month
  const handleSelectToday = () => {
    const today = getLocalDateString();
    setSelectedDate(today);
    const d = new Date();
    setCurrentYear(d.getFullYear());
    setCurrentMonth(d.getMonth());
  };

  const handleSelectTomorrow = () => {
    const tmrw = getTomorrowDateString();
    setSelectedDate(tmrw);
    const d = new Date();
    d.setDate(d.getDate() + 1);
    setCurrentYear(d.getFullYear());
    setCurrentMonth(d.getMonth());
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const bookingsOnSelectedDate = currentBookings.filter(
    (b) => isSameDay(b.scheduleDate || b.bookingDate, selectedDate)
  );

  const formattedSelectedDate = formatLongDisplayDate(selectedDate);

  return (
    <div className="space-y-4">
      {/* Top Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-blue-600" />
          <h2 className="font-bold text-slate-800 text-sm sm:text-base">
            Calendar &bull; Daily Booking Overview
          </h2>
        </div>

        {/* Quick presets */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={handleSelectToday}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-colors cursor-pointer"
          >
            Today
          </button>
          <button
            onClick={handleSelectTomorrow}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
          >
            Tomorrow
          </button>
          <button
            onClick={() => {
              // Jump to September 2026 where seed bookings are
              setCurrentYear(2026);
              setCurrentMonth(8); // Sep
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
          >
            September 2026
          </button>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              if (e.target.value) {
                setSelectedDate(e.target.value);
                const p = new Date(e.target.value + 'T00:00:00');
                setCurrentYear(p.getFullYear());
                setCurrentMonth(p.getMonth());
              }
            }}
            className="text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-slate-800 focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Calendar Grid (7 columns) */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
          {/* Month Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="font-bold text-slate-900 text-base flex items-center gap-2">
              <span>{monthNames[currentMonth]} {currentYear}</span>
            </div>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              <button
                onClick={handlePrevMonth}
                className="p-1.5 rounded hover:bg-white text-slate-700 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={handleNextMonth}
                className="p-1.5 rounded hover:bg-white text-slate-700 transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 text-center font-bold text-[11px] text-slate-500 uppercase tracking-wider mb-2">
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>

          {/* Calendar Days Cells */}
          <div className="grid grid-cols-7 gap-1">
            {/* Blank leading days */}
            {Array.from({ length: firstDayOfMonth }).map((_, idx) => (
              <div
                key={`empty-${idx}`}
                className="h-16 sm:h-20 bg-slate-50/50 rounded-lg border border-transparent"
              />
            ))}

            {/* Days in current month */}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const dayNum = idx + 1;
              const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(
                dayNum
              ).padStart(2, '0')}`;
              const count = bookingsCountByDate[dateStr] || 0;
              const isSelected = dateStr === selectedDate;
              const todayStr = new Date().toISOString().split('T')[0];
              const isToday = dateStr === todayStr;

              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDate(dateStr)}
                  className={`h-16 sm:h-20 p-1.5 rounded-lg border text-left transition-all flex flex-col justify-between cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-400 font-bold shadow-xs'
                      : isToday
                      ? 'bg-amber-50/50 border-amber-300'
                      : count > 0
                      ? 'bg-white hover:bg-slate-50 border-slate-200'
                      : 'bg-white/70 hover:bg-slate-50 border-slate-100 text-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span
                      className={`text-xs font-bold ${
                        isSelected
                          ? 'text-blue-900'
                          : isToday
                          ? 'text-amber-800'
                          : 'text-slate-800'
                      }`}
                    >
                      {dayNum}
                    </span>
                    {isToday && (
                      <span className="text-[9px] bg-amber-200 text-amber-900 px-1 rounded font-semibold">
                        Today
                      </span>
                    )}
                  </div>

                  {count > 0 ? (
                    <div className="w-full">
                      <span className="inline-block w-full text-center py-0.5 px-1 rounded bg-blue-600 text-white font-bold text-[10px] shadow-2xs">
                        {count} {count === 1 ? 'job' : 'jobs'}
                      </span>
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-300 italic">—</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Date Bookings Detail Panel (5 columns) */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Bookings for {formattedSelectedDate}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {bookingsOnSelectedDate.length} Bookings Scheduled
              </p>
            </div>
            <button
              onClick={() => handleCreateBooking(selectedDate)}
              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Book Date</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[500px] pr-1">
            {bookingsOnSelectedDate.length > 0 ? (
              bookingsOnSelectedDate.map((booking) => {
                const formattedAmount =
                  typeof booking.amount === 'number'
                    ? `₹${booking.amount.toLocaleString('en-IN')}`
                    : `${booking.amount}`;

                return (
                  <div
                    key={booking.id}
                    className="p-3 rounded-lg border border-slate-200 hover:border-blue-300 transition-colors bg-slate-50/50 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded font-bold text-[11px]">
                            Slot {booking.slotNumber}
                          </span>
                          <span className="font-mono text-xs font-bold text-blue-700">
                            {booking.bookingRef}
                          </span>
                        </div>
                        <div className="font-bold text-slate-900 text-xs mt-1">
                          {booking.customerName}
                        </div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-white border border-slate-200 text-slate-700">
                        {booking.bookingStatus}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-600">
                      <div>{booking.serviceType}</div>
                      <div className="text-slate-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-red-500 shrink-0" />
                        <span className="truncate">{booking.serviceLocation}</span>
                      </div>
                    </div>

                    {/* Staff Assigned */}
                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/80">
                      <div className="text-slate-500">
                        Staff:{' '}
                        <span className="font-semibold text-slate-800">
                          {booking.assignedStaffNames?.join(', ') || 'None'}
                        </span>
                      </div>
                      <div className="font-bold text-slate-900">{formattedAmount}</div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        onClick={() => onViewBooking(booking)}
                        className="text-xs text-blue-600 hover:underline font-semibold cursor-pointer"
                      >
                        View &amp; Dispatch
                      </button>
                      <button
                        onClick={() => onEditBooking(booking)}
                        className="text-xs text-slate-600 hover:text-slate-900 font-medium cursor-pointer"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12 text-slate-400">
                <CalendarIcon className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="font-medium text-xs">No bookings on this date</p>
                <button
                  onClick={() => handleCreateBooking(selectedDate)}
                  className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Booking on this Date</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
