import {
  BarChart3,
  Calendar,
  CalendarDays,
  CheckCircle2,
  FileSpreadsheet,
  MapPin,
  Phone,
  Plus,
  Search,
  Settings,
  Sheet,
  Users,
  X,
} from 'lucide-react';
import React, { useEffect } from 'react';
import { CompanyInfo } from '../types';
import { NavViewType } from './Navbar';
import { PWAInstallButton } from './PWAInstallButton';

interface SidebarDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentTab: NavViewType;
  setCurrentTab: (view: any) => void;
  onNewBooking: () => void;
  companyInfo: CompanyInfo;
  totalBookingsCount?: number;
  searchQuery?: string;
  setSearchQuery?: (val: string) => void;
}

export const SidebarDrawer: React.FC<SidebarDrawerProps> = ({
  isOpen,
  onClose,
  currentTab,
  setCurrentTab,
  onNewBooking,
  companyInfo,
  totalBookingsCount = 0,
  searchQuery,
  setSearchQuery,
}) => {
  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when drawer is open on mobile
  useEffect(() => {
    if (isOpen) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [isOpen]);

  const navItems: {
    id: NavViewType;
    label: string;
    icon: React.ReactNode;
    badge?: string | number;
  }[] = [
    {
      id: 'board',
      label: 'Daily Booking Board',
      icon: <CalendarDays className="w-5 h-5 shrink-0" />,
    },
    {
      id: 'staff-schedule',
      label: 'Staff Schedule & Workload',
      icon: <Users className="w-5 h-5 shrink-0" />,
    },
    {
      id: 'calendar',
      label: 'Calendar View',
      icon: <Calendar className="w-5 h-5 shrink-0" />,
    },
    {
      id: 'all-bookings',
      label: 'All Bookings',
      icon: <FileSpreadsheet className="w-5 h-5 shrink-0" />,
      badge: totalBookingsCount,
    },
    {
      id: 'reports',
      label: 'Reports & Analytics',
      icon: <BarChart3 className="w-5 h-5 shrink-0 text-emerald-400" />,
    },
    {
      id: 'google-sheets',
      label: 'Google Sheet Sync',
      icon: <Sheet className="w-5 h-5 shrink-0 text-emerald-400" />,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings className="w-5 h-5 shrink-0" />,
    },
  ];

  const handleSelect = (tabId: NavViewType) => {
    setCurrentTab(tabId);
    onClose();
  };

  const handleNewBookingClick = () => {
    onClose();
    onNewBooking();
  };

  const isTabActive = (key: string) => {
    if (key === 'board') return currentTab === 'board';
    if (key === 'staff-schedule' || key === 'staff')
      return currentTab === 'staff-schedule' || currentTab === 'staff';
    if (key === 'calendar') return currentTab === 'calendar';
    if (key === 'all-bookings' || key === 'all')
      return currentTab === 'all-bookings' || currentTab === 'all';
    if (key === 'reports' || key === 'analytics')
      return currentTab === 'reports' || currentTab === 'analytics';
    if (key === 'google-sheets' || key === 'sync')
      return currentTab === 'google-sheets' || currentTab === 'sync';
    if (key === 'settings') return currentTab === 'settings';
    return false;
  };

  return (
    <div
      className={`fixed inset-0 z-50 transition-visibility duration-300 ${
        isOpen ? 'pointer-events-auto visible' : 'pointer-events-none invisible'
      }`}
      id="sidebar-drawer-container"
      aria-hidden={!isOpen}
      role="dialog"
      aria-modal="true"
      aria-label="Navigation drawer"
    >
      {/* Backdrop overlay */}
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-slate-950/75 backdrop-blur-xs transition-opacity duration-300 ease-in-out ${
          isOpen ? 'opacity-100' : 'opacity-0'
        }`}
        id="sidebar-drawer-backdrop"
      />

      {/* Drawer slide-in panel */}
      <aside
        className={`fixed inset-y-0 left-0 w-80 max-w-[85vw] bg-slate-900 text-slate-100 shadow-2xl flex flex-col border-r border-slate-800 transform transition-transform duration-300 ease-out z-10 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        id="sidebar-drawer-panel"
      >
        {/* Drawer Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/logo1.png"
              alt="MSD Facility Services"
              className="h-9 w-auto max-w-[130px] object-contain shrink-0"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = '/logo1.svg';
              }}
            />
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-white truncate tracking-tight">
                {companyInfo.name}
              </h2>
              <div className="flex items-center gap-1.5 text-xs text-slate-400 truncate">
                <MapPin className="w-3 h-3 shrink-0 text-blue-400" />
                <span className="truncate">Puducherry</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            type="button"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
            id="btn-close-drawer"
            aria-label="Close navigation drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Action: New Booking & Install */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-900 space-y-2.5">
          <button
            onClick={handleNewBookingClick}
            type="button"
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shadow-md transition-colors cursor-pointer"
            id="drawer-btn-new-booking"
          >
            <Plus className="w-4 h-4" />
            <span>+ Create New Booking</span>
          </button>

          <div className="flex justify-center">
            <PWAInstallButton />
          </div>

          {/* Quick Search on Mobile */}
          {setSearchQuery && (
            <div className="mt-3 relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery || ''}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search bookings or staff..."
                className="w-full bg-slate-800 text-slate-100 placeholder-slate-400 text-xs rounded-lg pl-9 pr-8 py-2 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                id="drawer-search-input"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-white text-xs font-semibold"
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
          )}
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Navigation Menu
          </p>
          {navItems.map((item) => {
            const active = isTabActive(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
                id={`drawer-tab-${item.id}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                      active
                        ? 'bg-blue-700 text-white'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Drawer Footer info */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 text-xs text-slate-400 space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-emerald-300 font-medium">Google Sheet Synchronized</span>
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <Phone className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="truncate">Support: {companyInfo.mobile}</span>
          </div>
        </div>
      </aside>
    </div>
  );
};
