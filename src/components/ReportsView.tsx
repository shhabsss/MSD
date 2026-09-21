import {
  AlertCircle,
  ArrowUpDown,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  IndianRupee,
  Layers,
  Phone,
  Printer,
  RefreshCw,
  Search,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatBookingAmount } from '../services/storageService';
import { normalizeDateString } from '../utils/dateUtils';
import { Booking, BookingStatus, CompanyInfo, StaffMember } from '../types';

interface ReportsViewProps {
  bookings: Booking[];
  allStaff: StaffMember[];
  companyInfo: CompanyInfo;
  onViewBooking?: (booking: Booking) => void;
  onEditBooking?: (booking: Booking) => void;
}

type DateRangePreset =
  | 'today'
  | 'this_week'
  | 'this_month'
  | 'last_30_days'
  | 'this_year'
  | 'all_time'
  | 'custom';

type StatusFilterOption = 'all' | 'completed' | 'pending' | 'cancelled' | BookingStatus;

const COLORS = [
  '#2563eb', // blue-600
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#06b6d4', // cyan-500
  '#f97316', // orange-500
  '#64748b', // slate-500
  '#14b8a6', // teal-500
  '#6366f1', // indigo-500
];

export const ReportsView: React.FC<ReportsViewProps> = ({
  bookings,
  allStaff,
  companyInfo,
  onViewBooking,
  onEditBooking,
}) => {
  // 1. Date filter state
  const [datePreset, setDatePreset] = useState<DateRangePreset>('this_month');

  // Helper to compute date range strings
  const computeInitialDates = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      from: firstDay.toISOString().split('T')[0],
      to: lastDay.toISOString().split('T')[0],
    };
  };

  const initialDates = computeInitialDates();
  const [fromDate, setFromDate] = useState<string>(initialDates.from);
  const [toDate, setToDate] = useState<string>(initialDates.to);

  // 2. Status filter state
  const [statusFilter, setStatusFilter] = useState<StatusFilterOption>('all');

  // 3. Service filter state
  const [serviceFilter, setServiceFilter] = useState<string>('all');

  // 4. Payment filter state
  const [paymentFilter, setPaymentFilter] = useState<string>('all');

  // 5. Search query state
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 6. Chart display toggles
  const [chartMetricView, setChartMetricView] = useState<'both' | 'revenue' | 'bookings'>('both');
  const [chartGranularity, setChartGranularity] = useState<'daily' | 'monthly'>('daily');
  const [activeTab, setActiveTab] = useState<'overview' | 'trends' | 'services' | 'table'>('overview');

  // 7. Table pagination & sorting state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(15);
  const [sortField, setSortField] = useState<'scheduleDate' | 'amount' | 'customerName' | 'bookingRef'>(
    'scheduleDate'
  );
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Handler to set preset dates
  const handlePresetSelect = (preset: DateRangePreset) => {
    setDatePreset(preset);
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (preset === 'today') {
      setFromDate(todayStr);
      setToDate(todayStr);
    } else if (preset === 'this_week') {
      const day = now.getDay();
      const diffToMonday = (day === 0 ? -6 : 1) - day;
      const monday = new Date(now);
      monday.setDate(now.getDate() + diffToMonday);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      setFromDate(monday.toISOString().split('T')[0]);
      setToDate(sunday.toISOString().split('T')[0]);
    } else if (preset === 'this_month') {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setFromDate(first.toISOString().split('T')[0]);
      setToDate(last.toISOString().split('T')[0]);
    } else if (preset === 'last_30_days') {
      const past = new Date(now);
      past.setDate(now.getDate() - 29);
      setFromDate(past.toISOString().split('T')[0]);
      setToDate(todayStr);
    } else if (preset === 'this_year') {
      const first = new Date(now.getFullYear(), 0, 1);
      const last = new Date(now.getFullYear(), 11, 31);
      setFromDate(first.toISOString().split('T')[0]);
      setToDate(last.toISOString().split('T')[0]);
    } else if (preset === 'all_time') {
      setFromDate('');
      setToDate('');
    }
    setCurrentPage(1);
  };

  // Reset all filters to default
  const handleResetFilters = () => {
    handlePresetSelect('this_month');
    setStatusFilter('all');
    setServiceFilter('all');
    setPaymentFilter('all');
    setSearchQuery('');
    setCurrentPage(1);
  };

  // Unique list of services from bookings
  const availableServices = useMemo(() => {
    const set = new Set<string>();
    bookings.forEach((b) => {
      if (b.serviceType && b.serviceType.trim()) {
        set.add(b.serviceType.trim());
      }
    });
    return Array.from(set).sort();
  }, [bookings]);

  // Main filtered bookings collection
  const filteredBookings = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return bookings.filter((b) => {
      const rawDate = b.scheduleDate || b.bookingDate || '';
      const date = normalizeDateString(rawDate);
      const normFrom = normalizeDateString(fromDate);
      const normTo = normalizeDateString(toDate);

      // 1. Date Range Check
      if (normFrom && date && date < normFrom) return false;
      if (normTo && date && date > normTo) return false;

      // 2. Status Filter
      if (statusFilter === 'completed') {
        if (b.bookingStatus !== 'Completed') return false;
      } else if (statusFilter === 'pending') {
        // Pending encompasses New, Pending, Confirmed, Staff Assigned, In Progress
        const pendingStatuses: BookingStatus[] = [
          'New',
          'Pending',
          'Confirmed',
          'Staff Assigned',
          'In Progress',
          'Rescheduled',
        ];
        if (!pendingStatuses.includes(b.bookingStatus) && b.paymentStatus !== 'Pending') {
          return false;
        }
      } else if (statusFilter === 'cancelled') {
        if (b.bookingStatus !== 'Cancelled') return false;
      } else if (statusFilter !== 'all') {
        if (b.bookingStatus !== statusFilter) return false;
      }

      // 3. Service Filter
      if (serviceFilter !== 'all' && b.serviceType !== serviceFilter) {
        return false;
      }

      // 4. Payment Filter
      if (paymentFilter !== 'all' && b.paymentStatus !== paymentFilter) {
        return false;
      }

      // 5. Search text filter
      if (q) {
        const staff = (b.assignedStaffNames || []).join(' ').toLowerCase();
        const ref = (b.bookingRef || '').toLowerCase();
        const cust = (b.customerName || '').toLowerCase();
        const phone = (b.customerMobile || '').toLowerCase();
        const srv = (b.serviceType || '').toLowerCase();
        const loc = (b.serviceLocation || '').toLowerCase();
        const desc = (b.serviceDescription || '').toLowerCase();

        if (
          !ref.includes(q) &&
          !cust.includes(q) &&
          !phone.includes(q) &&
          !srv.includes(q) &&
          !loc.includes(q) &&
          !desc.includes(q) &&
          !staff.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [bookings, fromDate, toDate, statusFilter, serviceFilter, paymentFilter, searchQuery]);

  // Key KPI Metrics Calculations
  const kpis = useMemo(() => {
    let totalRevenue = 0;
    let totalAdvance = 0;
    let totalBalance = 0;
    let completedCount = 0;
    let pendingCount = 0;
    let cancelledCount = 0;
    let afterVisitCount = 0;
    let fixedPriceCount = 0;

    filteredBookings.forEach((b) => {
      // Status breakdown
      if (b.bookingStatus === 'Completed') {
        completedCount++;
      } else if (b.bookingStatus === 'Cancelled') {
        cancelledCount++;
      } else {
        pendingCount++;
      }

      // Skip cancelled bookings from revenue earnings
      if (b.bookingStatus !== 'Cancelled') {
        const { isAfterVisit } = formatBookingAmount(b.amount);
        const cleanAmt =
          typeof b.amount === 'number'
            ? b.amount
            : parseFloat(String(b.amount).replace(/[^\d.]/g, '')) || 0;
        const adv = Number(b.advanceAmount) || 0;
        const bal =
          b.balanceAmount !== undefined && b.balanceAmount !== null && !isNaN(Number(b.balanceAmount))
            ? Number(b.balanceAmount)
            : Math.max(0, cleanAmt - adv);

        if (isAfterVisit) {
          afterVisitCount++;
          totalAdvance += adv;
        } else {
          fixedPriceCount++;
          totalRevenue += cleanAmt;
          totalAdvance += adv;
          totalBalance += bal;
        }
      }
    });

    const totalCount = filteredBookings.length;
    const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    const collectionRate = totalRevenue > 0 ? Math.round((totalAdvance / totalRevenue) * 100) : 0;
    const averageOrderValue = fixedPriceCount > 0 ? Math.round(totalRevenue / fixedPriceCount) : 0;

    return {
      totalCount,
      completedCount,
      pendingCount,
      cancelledCount,
      totalRevenue,
      totalAdvance,
      totalBalance,
      afterVisitCount,
      fixedPriceCount,
      completionRate,
      collectionRate,
      averageOrderValue,
    };
  }, [filteredBookings]);

  // Timeline & Trend Chart Aggregation
  const trendChartData = useMemo(() => {
    // Group records by day or month
    const map = new Map<string, { date: string; bookings: number; revenue: number; completed: number }>();

    filteredBookings.forEach((b) => {
      const rawDate = b.scheduleDate || b.bookingDate;
      if (!rawDate) return;

      const key = chartGranularity === 'monthly' ? rawDate.slice(0, 7) : rawDate;

      const cleanAmt =
        b.bookingStatus !== 'Cancelled'
          ? typeof b.amount === 'number'
            ? b.amount
            : parseFloat(String(b.amount).replace(/[^\d.]/g, '')) || 0
          : 0;

      const isCompleted = b.bookingStatus === 'Completed' ? 1 : 0;

      if (!map.has(key)) {
        map.set(key, { date: key, bookings: 0, revenue: 0, completed: 0 });
      }

      const item = map.get(key)!;
      item.bookings += 1;
      item.revenue += cleanAmt;
      item.completed += isCompleted;
    });

    // Sort chronologically
    return Array.from(map.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((item) => {
        let label = item.date;
        try {
          if (chartGranularity === 'monthly') {
            const [y, m] = item.date.split('-');
            const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
            label = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
          } else {
            const d = new Date(item.date + 'T00:00:00');
            label = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
          }
        } catch (_) {}
        return {
          ...item,
          displayDate: label,
        };
      });
  }, [filteredBookings, chartGranularity]);

  // Service Type Breakdown Aggregation
  const serviceBreakdown = useMemo(() => {
    const map = new Map<
      string,
      { service: string; count: number; revenue: number; completed: number }
    >();

    filteredBookings.forEach((b) => {
      const srv = b.serviceType?.trim() || 'General Service';
      const cleanAmt =
        b.bookingStatus !== 'Cancelled'
          ? typeof b.amount === 'number'
            ? b.amount
            : parseFloat(String(b.amount).replace(/[^\d.]/g, '')) || 0
          : 0;
      const isCompleted = b.bookingStatus === 'Completed' ? 1 : 0;

      if (!map.has(srv)) {
        map.set(srv, { service: srv, count: 0, revenue: 0, completed: 0 });
      }

      const item = map.get(srv)!;
      item.count += 1;
      item.revenue += cleanAmt;
      item.completed += isCompleted;
    });

    const totalB = filteredBookings.length || 1;

    return Array.from(map.values())
      .map((item) => ({
        ...item,
        percentage: Math.round((item.count / totalB) * 100),
      }))
      .sort((a, b) => b.count - a.count);
  }, [filteredBookings]);

  // Sorted and Paginated Table Records
  const sortedBookings = useMemo(() => {
    return [...filteredBookings].sort((a, b) => {
      let valA: any = a[sortField] || '';
      let valB: any = b[sortField] || '';

      if (sortField === 'amount') {
        valA =
          typeof a.amount === 'number'
            ? a.amount
            : parseFloat(String(a.amount).replace(/[^\d.]/g, '')) || 0;
        valB =
          typeof b.amount === 'number'
            ? b.amount
            : parseFloat(String(b.amount).replace(/[^\d.]/g, '')) || 0;
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredBookings, sortField, sortDirection]);

  const totalPages = Math.ceil(sortedBookings.length / pageSize) || 1;
  const paginatedBookings = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedBookings.slice(start, start + pageSize);
  }, [sortedBookings, currentPage, pageSize]);

  // Sorting helper
  const toggleSort = (field: 'scheduleDate' | 'amount' | 'customerName' | 'bookingRef') => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'scheduleDate' || field === 'amount' ? 'desc' : 'asc');
    }
  };

  // CSV Export
  const handleExportCSV = () => {
    if (filteredBookings.length === 0) {
      alert('No booking records match the current filters to export.');
      return;
    }

    const headers = [
      'Booking Ref',
      'Client Name',
      'Mobile Number',
      'Service Type',
      'Work Scope',
      'Schedule Date',
      'Slot',
      'Location',
      'Full Address',
      'Total Amount (INR)',
      'Advance Amount (INR)',
      'Balance Amount (INR)',
      'Payment Status',
      'Booking Status',
      'Assigned Staff',
      'Created Date',
    ];

    const rows = filteredBookings.map((b) => {
      const cleanAmt =
        typeof b.amount === 'number' ? b.amount : parseFloat(String(b.amount)) || 'After Visit';
      return [
        b.bookingRef || '',
        `"${(b.customerName || '').replace(/"/g, '""')}"`,
        `"${b.customerMobile || ''}"`,
        `"${(b.serviceType || '').replace(/"/g, '""')}"`,
        `"${(b.serviceDescription || '').replace(/"/g, '""')}"`,
        b.scheduleDate || '',
        `"${b.slotPeriod || ''} (Slot ${b.slotNumber || ''})"`,
        `"${b.serviceLocation || ''}"`,
        `"${(b.fullAddress || '').replace(/"/g, '""')}"`,
        cleanAmt,
        b.advanceAmount || 0,
        b.balanceAmount || 0,
        b.paymentStatus || '',
        b.bookingStatus || '',
        `"${(b.assignedStaffNames || []).join(', ')}"`,
        b.bookingDate || '',
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const rangeName = fromDate && toDate ? `${fromDate}_to_${toDate}` : 'all_time';
    link.setAttribute('href', url);
    link.setAttribute('download', `MSD_Bookings_Report_${rangeName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Excel (.xls HTML table) Export
  const handleExportExcel = () => {
    if (filteredBookings.length === 0) {
      alert('No booking records to export.');
      return;
    }

    const tableRowsHtml = filteredBookings
      .map(
        (b) => `<tr>
        <td style="font-weight:bold;">${b.bookingRef || ''}</td>
        <td>${b.customerName || ''}</td>
        <td style="mso-number-format:'\\@';">${b.customerMobile || ''}</td>
        <td>${b.serviceType || ''}</td>
        <td>${b.scheduleDate || ''}</td>
        <td>${b.slotPeriod || ''} (Slot ${b.slotNumber || ''})</td>
        <td>${b.serviceLocation || ''}</td>
        <td style="text-align:right;">${b.amount || '0'}</td>
        <td style="text-align:right;">${b.advanceAmount || '0'}</td>
        <td style="text-align:right;">${b.balanceAmount || '0'}</td>
        <td>${b.paymentStatus || ''}</td>
        <td style="font-weight:bold;">${b.bookingStatus || ''}</td>
        <td>${(b.assignedStaffNames || []).join(', ')}</td>
      </tr>`
      )
      .join('');

    const excelHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
          <!--[if gte mso 9]>
          <xml>
            <x:ExcelWorkbook>
              <x:ExcelWorksheets>
                <x:ExcelWorksheet>
                  <x:Name>Bookings Report</x:Name>
                  <x:WorksheetOptions>
                    <x:DisplayGridlines/>
                  </x:WorksheetOptions>
                </x:ExcelWorksheet>
              </x:ExcelWorksheets>
            </x:ExcelWorkbook>
          </xml>
          <![endif]-->
          <style>
            table { border-collapse: collapse; font-family: Calibri, Arial, sans-serif; font-size: 11pt; }
            th { background-color: #1e3a8a; color: #ffffff; font-weight: bold; border: 1px solid #000000; padding: 6px; }
            td { border: 1px solid #d1d5db; padding: 5px; }
            .header-info { margin-bottom: 12px; }
          </style>
        </head>
        <body>
          <div class="header-info">
            <h2>${companyInfo.name} - Bookings &amp; Financial Report</h2>
            <p>Generated on: ${new Date().toLocaleString('en-IN')} | Period: ${fromDate || 'Start'} to ${toDate || 'Present'}</p>
            <p>Total Bookings: ${kpis.totalCount} | Completed: ${kpis.completedCount} | Total Revenue: ₹${kpis.totalRevenue.toLocaleString('en-IN')}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Booking Ref</th>
                <th>Customer Name</th>
                <th>Mobile</th>
                <th>Service Type</th>
                <th>Schedule Date</th>
                <th>Slot</th>
                <th>Location</th>
                <th>Amount (₹)</th>
                <th>Advance (₹)</th>
                <th>Balance (₹)</th>
                <th>Payment</th>
                <th>Status</th>
                <th>Assigned Staff</th>
              </tr>
            </thead>
            <tbody>
              ${tableRowsHtml}
            </tbody>
            <tfoot>
              <tr style="font-weight:bold; background-color:#f1f5f9;">
                <td colspan="7">TOTALS (${kpis.totalCount} Bookings)</td>
                <td style="text-align:right;">₹${kpis.totalRevenue.toLocaleString('en-IN')}</td>
                <td style="text-align:right;">₹${kpis.totalAdvance.toLocaleString('en-IN')}</td>
                <td style="text-align:right;">₹${kpis.totalBalance.toLocaleString('en-IN')}</td>
                <td colspan="3"></td>
              </tr>
            </tfoot>
          </table>
        </body>
      </html>
    `;

    const blob = new Blob([excelHtml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const rangeName = fromDate && toDate ? `${fromDate}_to_${toDate}` : 'all_time';
    link.setAttribute('href', url);
    link.setAttribute('download', `MSD_Report_${rangeName}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Print Handler
  const handlePrint = () => {
    window.print();
  };

  // Helper for Status Badge
  const getStatusBadge = (status: BookingStatus) => {
    switch (status) {
      case 'Completed':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'Confirmed':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Staff Assigned':
        return 'bg-indigo-100 text-indigo-800 border-indigo-300';
      case 'In Progress':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'Pending':
      case 'New':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'Cancelled':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'Rescheduled':
        return 'bg-slate-200 text-slate-800 border-slate-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Quick Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-600 text-white shadow-xs">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                Reports &amp; Analytics
              </h2>
              <p className="text-xs text-slate-500">
                Business intelligence, booking metrics, revenue trends, and data export for {companyInfo.name}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons: CSV, Excel, Print */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-300 transition-colors shadow-2xs cursor-pointer"
            title="Download report as CSV file"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-300 transition-colors shadow-2xs cursor-pointer"
            title="Download report as formatted Excel (.xls) spreadsheet"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export Excel</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300 transition-colors cursor-pointer"
            title="Print this report"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Print</span>
          </button>
        </div>
      </div>

      {/* Filter Control Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
            <Filter className="w-4 h-4 text-blue-600" />
            <span>Report Filters</span>
          </div>

          {(statusFilter !== 'all' ||
            datePreset !== 'this_month' ||
            serviceFilter !== 'all' ||
            paymentFilter !== 'all' ||
            searchQuery) && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>

        {/* Date Presets Ribbon */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-slate-500 font-medium mr-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              Date Range:
            </span>
            <button
              type="button"
              onClick={() => handlePresetSelect('today')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                datePreset === 'today'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => handlePresetSelect('this_week')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                datePreset === 'this_week'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              This Week
            </button>
            <button
              type="button"
              onClick={() => handlePresetSelect('this_month')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                datePreset === 'this_month'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => handlePresetSelect('last_30_days')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                datePreset === 'last_30_days'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Last 30 Days
            </button>
            <button
              type="button"
              onClick={() => handlePresetSelect('this_year')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                datePreset === 'this_year'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              This Year
            </button>
            <button
              type="button"
              onClick={() => handlePresetSelect('all_time')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                datePreset === 'all_time'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              All Time
            </button>
            <button
              type="button"
              onClick={() => setDatePreset('custom')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                datePreset === 'custom'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Custom Range
            </button>
          </div>

          {/* Custom Date Pickers & Status Multi-Filter */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
            {/* From Date */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                From Date:
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setDatePreset('custom');
                  setCurrentPage(1);
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
              />
            </div>

            {/* To Date */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                To Date:
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setDatePreset('custom');
                  setCurrentPage(1);
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
              />
            </div>

            {/* Status Filter (All, Completed, Pending, Cancelled) */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Booking Status:
              </label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as StatusFilterOption);
                  setCurrentPage(1);
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
              >
                <option value="all">All Statuses</option>
                <option value="completed">Completed Services</option>
                <option value="pending">Pending / In Progress / Upcoming</option>
                <option value="cancelled">Cancelled</option>
                <optgroup label="Specific Status">
                  <option value="Confirmed">Confirmed</option>
                  <option value="Staff Assigned">Staff Assigned</option>
                  <option value="In Progress">In Progress</option>
                  <option value="New">New</option>
                  <option value="Rescheduled">Rescheduled</option>
                </optgroup>
              </select>
            </div>

            {/* Service Type Filter */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Service Type:
              </label>
              <select
                value={serviceFilter}
                onChange={(e) => {
                  setServiceFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white truncate"
              >
                <option value="all">All Services ({availableServices.length})</option>
                {availableServices.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Quick Search & Payment Filter Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex-1 min-w-[240px] max-w-md relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search ref, customer name, mobile, staff, or work details..."
              className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-8 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">Payment:</span>
              <select
                value={paymentFilter}
                onChange={(e) => {
                  setPaymentFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-slate-50 border border-slate-300 rounded-md px-2 py-1 text-xs text-slate-700"
              >
                <option value="all">All Payments</option>
                <option value="Fully Paid">Fully Paid</option>
                <option value="Advance Paid">Advance Paid</option>
                <option value="Not Paid">Not Paid</option>
                <option value="Pending">Pending</option>
              </select>
            </div>

            <div className="text-slate-500 font-medium">
              Matches: <strong className="text-slate-900">{kpis.totalCount}</strong> bookings
            </div>
          </div>
        </div>
      </div>

      {/* 1. Overview KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Bookings */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Bookings</span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-slate-900 tracking-tight">
              {kpis.totalCount.toLocaleString('en-IN')}
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
              <span>Selected period volume</span>
              <span className="font-semibold text-slate-700">
                {kpis.cancelledCount > 0 ? `${kpis.cancelledCount} cancelled` : '0 cancelled'}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Completed Services */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-700">Completed Services</span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-emerald-700 tracking-tight">
              {kpis.completedCount.toLocaleString('en-IN')}
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
              <span>Completion Rate</span>
              <span className="font-bold text-emerald-600">{kpis.completionRate}%</span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1.5">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${kpis.completionRate}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 3: Pending / Upcoming Bookings */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-700">Pending / Upcoming</span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600 border border-amber-100">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-amber-700 tracking-tight">
              {kpis.pendingCount.toLocaleString('en-IN')}
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
              <span>Active pipeline</span>
              <span className="font-semibold text-amber-800">
                {kpis.totalCount > 0 ? Math.round((kpis.pendingCount / kpis.totalCount) * 100) : 0}% of total
              </span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1.5">
              <div
                className="bg-amber-500 h-full rounded-full transition-all duration-300"
                style={{
                  width: `${
                    kpis.totalCount > 0 ? Math.round((kpis.pendingCount / kpis.totalCount) * 100) : 0
                  }%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Card 4: Total Revenue / Earnings */}
        <div className="bg-slate-900 text-white rounded-xl border border-slate-800 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-400">Total Revenue</span>
            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-emerald-400 tracking-tight">
              ₹{kpis.totalRevenue.toLocaleString('en-IN')}
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <Wallet className="w-3 h-3 text-blue-400" />
                Adv: ₹{kpis.totalAdvance.toLocaleString('en-IN')}
              </span>
              <span className="text-amber-300 font-medium">
                Bal: ₹{kpis.totalBalance.toLocaleString('en-IN')}
              </span>
            </div>
            {kpis.afterVisitCount > 0 && (
              <div className="text-[10px] text-slate-400 mt-1">
                +{kpis.afterVisitCount} &ldquo;After Visit&rdquo; quotes
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Secondary Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs text-xs">
        <div className="border-r border-slate-100 pr-3">
          <div className="text-slate-500 font-medium">Average Order Value</div>
          <div className="text-base font-bold text-slate-800 mt-0.5">
            ₹{kpis.averageOrderValue.toLocaleString('en-IN')}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Across fixed bookings</div>
        </div>

        <div className="border-r border-slate-100 pr-3">
          <div className="text-slate-500 font-medium">Payment Collection Rate</div>
          <div className="text-base font-bold text-blue-700 mt-0.5">
            {kpis.collectionRate}%
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Advance collected ratio</div>
        </div>

        <div className="border-r border-slate-100 pr-3">
          <div className="text-slate-500 font-medium">Active Services Catalog</div>
          <div className="text-base font-bold text-slate-800 mt-0.5">
            {serviceBreakdown.length} Services
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Booked in this range</div>
        </div>

        <div>
          <div className="text-slate-500 font-medium">Current Date Range</div>
          <div className="text-base font-bold text-slate-800 mt-0.5 truncate">
            {fromDate && toDate ? `${fromDate} to ${toDate}` : 'All Time History'}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            {kpis.totalCount} records analyzed
          </div>
        </div>
      </div>

      {/* 3. Visual Breakdown Section: Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart: Trend Over Time (Bookings & Revenue) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Bookings &amp; Revenue Trends</span>
              </h3>
              <p className="text-xs text-slate-500">
                Timeline visualization of volume and earnings
              </p>
            </div>

            {/* Controls for Chart */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {/* Metric Selector */}
              <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setChartMetricView('both')}
                  className={`px-2 py-1 rounded-md font-medium transition-all cursor-pointer ${
                    chartMetricView === 'both' ? 'bg-white text-blue-700 shadow-2xs font-semibold' : 'text-slate-600'
                  }`}
                >
                  Both
                </button>
                <button
                  type="button"
                  onClick={() => setChartMetricView('revenue')}
                  className={`px-2 py-1 rounded-md font-medium transition-all cursor-pointer ${
                    chartMetricView === 'revenue' ? 'bg-white text-blue-700 shadow-2xs font-semibold' : 'text-slate-600'
                  }`}
                >
                  Revenue
                </button>
                <button
                  type="button"
                  onClick={() => setChartMetricView('bookings')}
                  className={`px-2 py-1 rounded-md font-medium transition-all cursor-pointer ${
                    chartMetricView === 'bookings' ? 'bg-white text-blue-700 shadow-2xs font-semibold' : 'text-slate-600'
                  }`}
                >
                  Bookings
                </button>
              </div>

              {/* Granularity Toggle */}
              <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setChartGranularity('daily')}
                  className={`px-2 py-1 rounded-md font-medium transition-all cursor-pointer ${
                    chartGranularity === 'daily' ? 'bg-white text-blue-700 shadow-2xs font-semibold' : 'text-slate-600'
                  }`}
                >
                  Daily
                </button>
                <button
                  type="button"
                  onClick={() => setChartGranularity('monthly')}
                  className={`px-2 py-1 rounded-md font-medium transition-all cursor-pointer ${
                    chartGranularity === 'monthly' ? 'bg-white text-blue-700 shadow-2xs font-semibold' : 'text-slate-600'
                  }`}
                >
                  Monthly
                </button>
              </div>
            </div>
          </div>

          {/* Recharts Container */}
          <div className="h-[280px] w-full">
            {trendChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={trendChartData}
                  margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="displayDate"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={false}
                  />
                  {(chartMetricView === 'both' || chartMetricView === 'bookings') && (
                    <YAxis
                      yAxisId="left"
                      orientation="left"
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: '#2563eb' }}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tickLine={false}
                    />
                  )}
                  {(chartMetricView === 'both' || chartMetricView === 'revenue') && (
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tickFormatter={(v) => `₹${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`}
                      tick={{ fontSize: 11, fill: '#10b981' }}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tickLine={false}
                    />
                  )}
                  <Tooltip
                    formatter={(value: any, name: any) => {
                      if (name === 'Revenue') return [`₹${Number(value).toLocaleString('en-IN')}`, 'Total Revenue'];
                      if (name === 'Bookings') return [value, 'Total Bookings'];
                      if (name === 'Completed') return [value, 'Completed Services'];
                      return [value, name];
                    }}
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '12px',
                      border: 'none',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                    itemStyle={{ color: '#ffffff', padding: '2px 0' }}
                  />
                  <Legend
                    verticalAlign="top"
                    height={36}
                    wrapperStyle={{ fontSize: '11px', paddingTop: '0px' }}
                  />
                  {(chartMetricView === 'both' || chartMetricView === 'revenue') && (
                    <Area
                      yAxisId="right"
                      type="monotone"
                      dataKey="revenue"
                      name="Revenue"
                      fill="#d1fae5"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      fillOpacity={0.6}
                    />
                  )}
                  {(chartMetricView === 'both' || chartMetricView === 'bookings') && (
                    <Bar
                      yAxisId="left"
                      dataKey="bookings"
                      name="Bookings"
                      fill="#3b82f6"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={40}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs">
                <Calendar className="w-8 h-8 text-slate-300 mb-2" />
                <span>No trend data available for the selected filters.</span>
              </div>
            )}
          </div>
        </div>

        {/* Side Chart: Breakdown by Service Type */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-col">
          <div className="mb-3 pb-3 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Service Breakdown</h3>
              <p className="text-xs text-slate-500">Volume and revenue by category</p>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              {serviceBreakdown.length} types
            </span>
          </div>

          {/* Donut Chart */}
          <div className="h-[150px] w-full flex items-center justify-center relative">
            {serviceBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={serviceBreakdown.slice(0, 6)}
                    dataKey="count"
                    nameKey="service"
                    cx="50%"
                    cy="50%"
                    innerRadius={42}
                    outerRadius={65}
                    paddingAngle={3}
                  >
                    {serviceBreakdown.slice(0, 6).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any, name: any, item: any) => [
                      `${val} bookings (${item?.payload?.percentage || 0}%)`,
                      name,
                    ]}
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '11px',
                      border: 'none',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-slate-400 text-xs">No service data</div>
            )}
          </div>

          {/* Service List with Progress Meters */}
          <div className="flex-1 overflow-y-auto max-h-[160px] space-y-2 mt-2 pr-1 no-scrollbar text-xs">
            {serviceBreakdown.slice(0, 8).map((srv, idx) => (
              <div key={srv.service} className="space-y-1">
                <div className="flex items-center justify-between font-medium">
                  <div className="flex items-center gap-1.5 truncate max-w-[180px]">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                    />
                    <span className="text-slate-800 truncate" title={srv.service}>
                      {srv.service}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-bold text-slate-900">{srv.count}</span>
                    <span className="text-slate-400 text-[10px] ml-1">({srv.percentage}%)</span>
                  </div>
                </div>
                <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${srv.percentage}%`,
                      backgroundColor: COLORS[idx % COLORS.length],
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Detailed Data Table Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-blue-600" />
              <span>Detailed Report Records</span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
                {sortedBookings.length} records
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Filtered bookings with financial breakdown, customer details, and live status
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Page Size Selector */}
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <span>Show:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-800 focus:outline-none"
              >
                <option value={10}>10 rows</option>
                <option value={15}>15 rows</option>
                <option value={25}>25 rows</option>
                <option value={50}>50 rows</option>
                <option value={100}>100 rows</option>
              </select>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1 rounded bg-white border border-slate-300 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-slate-600 px-2 font-medium">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1 rounded bg-white border border-slate-300 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Responsive Table Container */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <th
                  onClick={() => toggleSort('bookingRef')}
                  className="py-3 px-3.5 border-r border-slate-200 cursor-pointer hover:bg-slate-200/70 select-none whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    <span>Booking ID</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('customerName')}
                  className="py-3 px-3.5 border-r border-slate-200 cursor-pointer hover:bg-slate-200/70 select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>Client Name &amp; Mobile</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-3.5 border-r border-slate-200">Service &amp; Scope</th>
                <th
                  onClick={() => toggleSort('scheduleDate')}
                  className="py-3 px-3.5 border-r border-slate-200 cursor-pointer hover:bg-slate-200/70 select-none whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    <span>Schedule Date &amp; Slot</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('amount')}
                  className="py-3 px-3.5 border-r border-slate-200 text-right cursor-pointer hover:bg-slate-200/70 select-none whitespace-nowrap"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Amount (₹)</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-3.5 border-r border-slate-200 text-center">Payment</th>
                <th className="py-3 px-3.5 border-r border-slate-200 text-center">Status</th>
                <th className="py-3 px-3.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {paginatedBookings.length > 0 ? (
                paginatedBookings.map((b) => {
                  const { isAfterVisit, display: amtDisplay } = formatBookingAmount(b.amount);
                  const adv = Number(b.advanceAmount) || 0;
                  const bal =
                    b.balanceAmount !== undefined && b.balanceAmount !== null
                      ? Number(b.balanceAmount)
                      : 0;

                  return (
                    <tr
                      key={b.id}
                      className="hover:bg-blue-50/40 transition-colors group text-slate-800"
                    >
                      {/* Booking ID */}
                      <td className="py-3 px-3.5 border-r border-slate-200 font-mono font-bold text-blue-700 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onViewBooking && onViewBooking(b)}
                          className="hover:underline text-left cursor-pointer"
                        >
                          {b.bookingRef}
                        </button>
                      </td>

                      {/* Client Name & Mobile */}
                      <td className="py-3 px-3.5 border-r border-slate-200">
                        <div className="font-bold text-slate-900">{b.customerName}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <a
                            href={`tel:${b.customerMobile}`}
                            className="hover:text-blue-600 font-mono"
                          >
                            {b.customerMobile}
                          </a>
                        </div>
                      </td>

                      {/* Service & Scope */}
                      <td className="py-3 px-3.5 border-r border-slate-200">
                        <div className="font-semibold text-slate-900">{b.serviceType}</div>
                        {b.serviceDescription && (
                          <div
                            className="text-[11px] text-slate-500 truncate max-w-[220px] mt-0.5"
                            title={b.serviceDescription}
                          >
                            {b.serviceDescription}
                          </div>
                        )}
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          📍 {b.serviceLocation || 'Puducherry'}
                        </div>
                      </td>

                      {/* Date & Slot */}
                      <td className="py-3 px-3.5 border-r border-slate-200 whitespace-nowrap">
                        <div className="font-semibold text-slate-900">{b.scheduleDate}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-medium">
                            Slot {b.slotNumber}
                          </span>
                          <span>{b.slotPeriod}</span>
                        </div>
                      </td>

                      {/* Amount & Advance/Balance breakdown */}
                      <td className="py-3 px-3.5 border-r border-slate-200 text-right whitespace-nowrap">
                        <div className="font-bold text-slate-900">{amtDisplay}</div>
                        {!isAfterVisit && (
                          <div className="text-[10px] text-slate-500 mt-0.5 flex items-center justify-end gap-1.5">
                            {adv > 0 && (
                              <span className="text-emerald-700">Adv: ₹{adv.toLocaleString('en-IN')}</span>
                            )}
                            {bal > 0 ? (
                              <span className="text-amber-700 font-semibold">
                                Bal: ₹{bal.toLocaleString('en-IN')}
                              </span>
                            ) : (
                              <span className="text-emerald-600 font-semibold">Cleared</span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Payment Status */}
                      <td className="py-3 px-3.5 border-r border-slate-200 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                            b.paymentStatus === 'Fully Paid'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                              : b.paymentStatus === 'Advance Paid'
                              ? 'bg-blue-50 text-blue-700 border-blue-300'
                              : b.paymentStatus === 'Not Paid'
                              ? 'bg-rose-50 text-rose-700 border-rose-300'
                              : 'bg-amber-50 text-amber-700 border-amber-300'
                          }`}
                        >
                          {b.paymentStatus || 'Pending'}
                        </span>
                      </td>

                      {/* Booking Status Badge */}
                      <td className="py-3 px-3.5 border-r border-slate-200 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${getStatusBadge(
                            b.bookingStatus
                          )}`}
                        >
                          {b.bookingStatus}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-3.5 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onViewBooking && onViewBooking(b)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-xs font-semibold transition-colors cursor-pointer border border-slate-200 hover:border-blue-300"
                          title="View Full Booking Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <div className="max-w-md mx-auto space-y-2">
                      <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
                      <div className="font-semibold text-slate-800 text-sm">
                        No bookings match your selected report filters
                      </div>
                      <p className="text-xs text-slate-500">
                        Try expanding your date range, adjusting the status filter, or clearing your search query.
                      </p>
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 font-semibold text-xs border border-blue-200 hover:bg-blue-100 transition-colors cursor-pointer"
                      >
                        Reset All Filters
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
            {/* Totals Summary Footer */}
            {paginatedBookings.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100/90 font-bold text-slate-900 border-t-2 border-slate-300 text-xs">
                  <td colSpan={4} className="py-3 px-3.5 border-r border-slate-200">
                    TOTALS (Across all {kpis.totalCount} filtered bookings):
                  </td>
                  <td className="py-3 px-3.5 border-r border-slate-200 text-right font-black text-emerald-800 whitespace-nowrap">
                    ₹{kpis.totalRevenue.toLocaleString('en-IN')}
                    <div className="text-[10px] font-normal text-slate-500">
                      Adv: ₹{kpis.totalAdvance.toLocaleString('en-IN')} | Bal: ₹
                      {kpis.totalBalance.toLocaleString('en-IN')}
                    </div>
                  </td>
                  <td colSpan={3} className="py-3 px-3.5 text-slate-600 text-center">
                    {kpis.completedCount} Completed &bull; {kpis.pendingCount} Pending &bull;{' '}
                    {kpis.cancelledCount} Cancelled
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Table Pagination Footer */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
          <div>
            Showing{' '}
            <strong className="text-slate-900">
              {sortedBookings.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}
            </strong>{' '}
            to{' '}
            <strong className="text-slate-900">
              {Math.min(currentPage * pageSize, sortedBookings.length)}
            </strong>{' '}
            of <strong className="text-slate-900">{sortedBookings.length}</strong> filtered records
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-2.5 py-1 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-medium cursor-pointer"
            >
              Previous
            </button>

            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum = i + 1;
              if (totalPages > 5 && currentPage > 3) {
                pageNum = currentPage - 2 + i;
                if (pageNum > totalPages) pageNum = totalPages - (4 - i);
              }
              return (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-7 h-7 rounded text-xs font-semibold transition-colors cursor-pointer ${
                    currentPage === pageNum
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="px-2.5 py-1 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-medium cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
