import {
  AlertTriangle,
  Building2,
  Check,
  Clock,
  Database,
  Download,
  Edit2,
  FileCode,
  MapPin,
  MessageCircle,
  Plus,
  RotateCcw,
  Save,
  ShieldAlert,
  Smartphone,
  Trash2,
  UserCheck,
  Users,
  Wrench,
} from 'lucide-react';
import React, { useState } from 'react';
import {
  DEFAULT_SERVICES,
  DEFAULT_SLOTS,
  DEFAULT_STAFF,
  PUDUCHERRY_LOCATIONS,
  WEBSITE_MSDFS_SERVICES,
} from '../data/initialData';
import {
  AppSettings,
  Booking,
  CompanyInfo,
  SlotDefinition,
  SlotPeriod,
  StaffMember,
} from '../types';
import { exportBookingsGoogleSheetCSV } from '../services/syncService';

interface SettingsViewProps {
  companyInfo?: CompanyInfo;
  onSaveCompanyInfo?: (info: CompanyInfo) => void;
  staffList?: StaffMember[];
  allStaff?: StaffMember[];
  onSaveStaffList?: (staff: StaffMember[]) => void;
  slots?: SlotDefinition[];
  allSlots?: SlotDefinition[];
  onSaveSlots?: (slots: SlotDefinition[]) => void;
  settings?: AppSettings;
  onSaveSettings?: (settings: AppSettings) => void;
  totalBookingsCount?: number;
  allBookings?: Booking[];
  onClearAllBookings?: () => void;
  onResetToSampleData?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  companyInfo = {
    name: 'MSD Facility Services',
    address: 'No 72, 6th Cross, JJ Nagar, Moolakulam, Puducherry - 605010',
    mobile: '9042233122',
    email: 'msdfacilityservices@gmail.com',
    website: 'www.msdfs.in',
  },
  onSaveCompanyInfo,
  staffList,
  allStaff,
  onSaveStaffList,
  slots,
  allSlots,
  onSaveSlots,
  settings,
  onSaveSettings,
  totalBookingsCount,
  allBookings,
  onClearAllBookings,
  onResetToSampleData,
}) => {
  const currentStaffList = staffList && staffList.length > 0 ? staffList : (allStaff || DEFAULT_STAFF);
  const currentSlots = slots && slots.length > 0 ? slots : (allSlots || DEFAULT_SLOTS);
  const currentServices = settings?.services || DEFAULT_SERVICES;
  const currentLocations = settings?.locations || PUDUCHERRY_LOCATIONS;

  const [activeTab, setActiveTab] = useState<
    'company' | 'staff' | 'slots' | 'services' | 'whatsapp' | 'android' | 'data'
  >('company');
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<string | null>(null);
  const [isDeletingAllOpen, setIsDeletingAllOpen] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');

  // Company info state
  const [compName, setCompName] = useState(companyInfo?.name || 'MSD Facility Services');
  const [compAddress, setCompAddress] = useState(companyInfo?.address || '');
  const [compMobile, setCompMobile] = useState(companyInfo?.mobile || '');
  const [compEmail, setCompEmail] = useState(companyInfo?.email || '');
  const [compWebsite, setCompWebsite] = useState(companyInfo?.website || '');

  // New Staff state
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffMobile, setNewStaffMobile] = useState('');

  // New Service state
  const [newService, setNewService] = useState('');
  // New Location state
  const [newLocation, setNewLocation] = useState('');
  const [locationSearch, setLocationSearch] = useState('');

  // WhatsApp templates state
  const [customerTemplate, setCustomerTemplate] = useState(
    settings?.whatsappTemplates?.customerTemplate || ''
  );
  const [staffTemplate, setStaffTemplate] = useState(
    settings?.whatsappTemplates?.staffTemplate || ''
  );

  const showNotice = (msg: string) => {
    setSaveSuccessNotice(msg);
    setTimeout(() => setSaveSuccessNotice(null), 3000);
  };

  // 1. Save Company Info
  const handleSaveCompany = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveCompanyInfo({
      name: compName.trim(),
      address: compAddress.trim(),
      mobile: compMobile.trim(),
      email: compEmail.trim(),
      website: compWebsite.trim(),
    });
    showNotice('Company information updated successfully!');
  };

  // 2. Staff Management
  const handleAddStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName.trim()) return;
    const newMember: StaffMember = {
      id: `staff-${Date.now()}`,
      name: newStaffName.trim(),
      mobile: newStaffMobile.trim(),
      status: 'active',
      notes: 'Cleaning Specialist',
    };
    onSaveStaffList([...staffList, newMember]);
    setNewStaffName('');
    setNewStaffMobile('');
    showNotice(`Added staff member: ${newMember.name}`);
  };

  const handleToggleStaffStatus = (id: string) => {
    const updated = staffList.map((s) =>
      s.id === id ? { ...s, status: s.status === 'active' ? ('inactive' as const) : ('active' as const) } : s
    );
    onSaveStaffList(updated);
  };

  const handleDeleteStaff = (id: string, name: string) => {
    if (confirm(`Are you sure you want to remove staff member: ${name}?`)) {
      onSaveStaffList(staffList.filter((s) => s.id !== id));
      showNotice(`Removed ${name}`);
    }
  };

  const handleResetDefaultStaff = () => {
    if (confirm('Reset staff list to default 6 MSD staff members?')) {
      onSaveStaffList(DEFAULT_STAFF);
      showNotice('Staff reset to default 6 members');
    }
  };

  // 3. Time Slots
  const handleUpdateSlot = (slotId: string, field: keyof SlotDefinition, value: any) => {
    const updated = currentSlots.map((s) => (s.id === slotId ? { ...s, [field]: value } : s));
    if (onSaveSlots) onSaveSlots(updated);
  };

  const handleResetSlots = () => {
    if (confirm('Reset slots to standard 10 time slots?')) {
      if (onSaveSlots) onSaveSlots(DEFAULT_SLOTS);
      showNotice('Slots reset to default schedule');
    }
  };

  // Helper to persist updated settings
  const persistSettings = (partial: Partial<AppSettings>) => {
    if (!onSaveSettings) return;
    const base: AppSettings = settings || {
      autoGenerateRef: true,
      lastReferenceNumber: 10,
      services: currentServices,
      locations: currentLocations,
      googleSheetWebAppUrl: '',
      whatsappTemplates: {
        customerTemplate: customerTemplate,
        staffTemplate: staffTemplate,
      },
    };
    onSaveSettings({ ...base, ...partial });
  };

  // 4. Services
  const handleAddService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newService.trim()) return;
    if (currentServices.includes(newService.trim())) {
      alert('This service is already in the list.');
      return;
    }
    const updated = [...currentServices, newService.trim()];
    persistSettings({ services: updated });
    setNewService('');
    showNotice('Service added');
  };

  const handleDeleteService = (srv: string) => {
    const updated = currentServices.filter((s) => s !== srv);
    persistSettings({ services: updated });
    showNotice(`Removed service: ${srv}`);
  };

  const handleSyncWebsiteServices = () => {
    const isUnwantedBathroomVariant = (s: string) => {
      const lower = s.trim().toLowerCase();
      return lower.includes('bathroom') && lower !== 'bathroom cleaning';
    };
    let updated = currentServices.filter((s) => !isUnwantedBathroomVariant(s));
    if (!updated.includes('Bathroom Cleaning')) {
      updated.push('Bathroom Cleaning');
    }
    let addedCount = 0;
    for (const srv of WEBSITE_MSDFS_SERVICES) {
      if (!updated.includes(srv)) {
        updated.push(srv);
        addedCount++;
      }
    }
    persistSettings({ services: updated });
    showNotice('Services synced with msdfs.in catalog (Bathroom Cleaning cleaned)');
  };

  // 5. Locations
  const handleAddLocation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocation.trim()) return;
    if (currentLocations.includes(newLocation.trim())) {
      alert('This location is already in the list.');
      return;
    }
    const updated = [...currentLocations, newLocation.trim()];
    persistSettings({ locations: updated });
    setNewLocation('');
    showNotice('Location added');
  };

  const handleDeleteLocation = (loc: string) => {
    const updated = currentLocations.filter((l) => l !== loc);
    persistSettings({ locations: updated });
    showNotice(`Removed location: ${loc}`);
  };

  const handleResetToStandardLocations = () => {
    if (confirm('Reset service locations to the official 64 Pondicherry areas?')) {
      persistSettings({ locations: PUDUCHERRY_LOCATIONS });
      showNotice('Reset to 64 official Pondicherry locations');
    }
  };

  // 6. WhatsApp Templates
  const handleSaveWhatsAppTemplates = (e: React.FormEvent) => {
    e.preventDefault();
    persistSettings({
      whatsappTemplates: {
        customerTemplate,
        staffTemplate,
      },
    });
    showNotice('WhatsApp message templates saved!');
  };

  // 7. Backup & Data Helpers
  const handleDownloadBackupJSON = () => {
    if (!allBookings || allBookings.length === 0) {
      alert('No booking records found to backup.');
      return;
    }
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(allBookings, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    const dateStr = new Date().toISOString().split('T')[0];
    downloadAnchor.setAttribute('download', `msd_facility_bookings_backup_${dateStr}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showNotice('Full backup JSON downloaded successfully!');
  };

  const handleExportCSVBackup = () => {
    if (!allBookings || allBookings.length === 0) {
      alert('No booking records found to export.');
      return;
    }
    const csvContent = exportBookingsGoogleSheetCSV(allBookings);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const dateStr = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `msd_facility_bookings_export_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showNotice('Bookings CSV exported successfully!');
  };

  return (
    <div className="space-y-4">
      {/* Settings Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Admin Settings &bull; MSD Facility Services</h2>
          <p className="text-xs text-slate-500">Configure company info, staff roster, daily slots, services, and dispatch templates</p>
        </div>

        {saveSuccessNotice && (
          <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs px-3 py-1.5 rounded-lg font-semibold animate-in fade-in flex items-center gap-1.5">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{saveSuccessNotice}</span>
          </div>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 bg-white rounded-xl px-2 shadow-2xs overflow-x-auto text-xs font-semibold">
        <button
          onClick={() => setActiveTab('company')}
          className={`py-3 px-4 flex items-center gap-2 border-b-2 whitespace-nowrap cursor-pointer transition-colors ${
            activeTab === 'company'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Company Profile</span>
        </button>

        <button
          onClick={() => setActiveTab('staff')}
          className={`py-3 px-4 flex items-center gap-2 border-b-2 whitespace-nowrap cursor-pointer transition-colors ${
            activeTab === 'staff'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Staff Roster ({staffList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('slots')}
          className={`py-3 px-4 flex items-center gap-2 border-b-2 whitespace-nowrap cursor-pointer transition-colors ${
            activeTab === 'slots'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Daily Slots ({slots.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('services')}
          className={`py-3 px-4 flex items-center gap-2 border-b-2 whitespace-nowrap cursor-pointer transition-colors ${
            activeTab === 'services'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Wrench className="w-4 h-4" />
          <span>Services &amp; Locations</span>
        </button>

        <button
          onClick={() => setActiveTab('whatsapp')}
          className={`py-3 px-4 flex items-center gap-2 border-b-2 whitespace-nowrap cursor-pointer transition-colors ${
            activeTab === 'whatsapp'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <MessageCircle className="w-4 h-4" />
          <span>WhatsApp Templates</span>
        </button>

        <button
          onClick={() => setActiveTab('android')}
          className={`py-3 px-4 flex items-center gap-2 border-b-2 whitespace-nowrap cursor-pointer transition-colors ${
            activeTab === 'android'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Smartphone className="w-4 h-4 text-emerald-600" />
          <span className="font-bold text-emerald-700">Native Android App (ZIP)</span>
        </button>

        <button
          onClick={() => setActiveTab('data')}
          className={`py-3 px-4 flex items-center gap-2 border-b-2 whitespace-nowrap cursor-pointer transition-colors ${
            activeTab === 'data'
              ? 'border-rose-600 text-rose-600 bg-rose-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Database className="w-4 h-4 text-rose-500" />
          <span className="font-bold text-rose-700">Data &amp; Danger Zone</span>
        </button>
      </div>

      {/* Tab 1: Company Profile */}
      {activeTab === 'company' && (
        <form onSubmit={handleSaveCompany} className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4 max-w-2xl text-xs">
          <div className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-2">
            Company Contact Information
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Company Name</label>
              <input
                type="text"
                value={compName}
                onChange={(e) => setCompName(e.target.value)}
                required
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-semibold"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Mobile / WhatsApp</label>
              <input
                type="text"
                value={compMobile}
                onChange={(e) => setCompMobile(e.target.value)}
                required
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Address</label>
            <input
              type="text"
              value={compAddress}
              onChange={(e) => setCompAddress(e.target.value)}
              required
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                value={compEmail}
                onChange={(e) => setCompEmail(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Website URL</label>
              <input
                type="text"
                value={compWebsite}
                onChange={(e) => setCompWebsite(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save Company Details</span>
            </button>
          </div>
        </form>
      )}

      {/* Tab 2: Staff Roster */}
      {activeTab === 'staff' && (
        <div className="space-y-4">
          {/* Add Staff Bar */}
          <form onSubmit={handleAddStaff} className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-wrap items-end gap-3 text-xs">
            <div className="flex-1 min-w-[180px]">
              <label className="block font-semibold text-slate-700 mb-1">Staff Name</label>
              <input
                type="text"
                placeholder="e.g. Mr. Sankar"
                value={newStaffName}
                onChange={(e) => setNewStaffName(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-medium"
              />
            </div>

            <div className="w-48">
              <label className="block font-semibold text-slate-700 mb-1">Mobile (for WhatsApp)</label>
              <input
                type="tel"
                placeholder="e.g. 9876543210"
                value={newStaffMobile}
                onChange={(e) => setNewStaffMobile(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-mono"
              />
            </div>

            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Staff</span>
            </button>

            <button
              type="button"
              onClick={handleResetDefaultStaff}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-300 flex items-center gap-1 cursor-pointer ml-auto"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset 6 Default Staff</span>
            </button>
          </form>

          {/* Staff Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Staff Member</th>
                  <th className="py-2.5 px-4">Mobile Number</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {staffList.map((staff) => (
                  <tr key={staff.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-bold text-slate-900">{staff.name}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-600">{staff.mobile || '—'}</td>
                    <td className="py-2.5 px-4">
                      <button
                        onClick={() => handleToggleStaffStatus(staff.id)}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-colors ${
                          staff.status === 'active'
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                        }`}
                      >
                        {staff.status.toUpperCase()}
                      </button>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        onClick={() => handleDeleteStaff(staff.id, staff.name)}
                        className="text-rose-600 hover:text-rose-800 p-1 cursor-pointer"
                        title="Delete staff"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Daily Slots */}
      {activeTab === 'slots' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4 text-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <div className="font-bold text-slate-900 text-sm">Configured Daily Slots (1 to 10)</div>
              <p className="text-slate-500">
                Each day supports up to 10 standard slots across Morning, Afternoon, and Evening.
              </p>
            </div>
            <button
              onClick={handleResetSlots}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-300 flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset to Defaults</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {slots.map((slot) => (
              <div key={slot.id} className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">
                    {slot.slotNumber}
                  </span>
                  <div>
                    <span className="font-bold text-slate-800 text-xs">Slot {slot.slotNumber}</span>
                    <div className="text-[11px] text-slate-500 font-sans">{slot.period} Period</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-slate-500 text-xs">Period:</span>
                  <select
                    value={slot.period}
                    onChange={(e) => handleUpdateSlot(slot.id, 'period', e.target.value as SlotPeriod)}
                    className="bg-white border border-slate-300 rounded px-2.5 py-1 text-xs font-medium text-slate-700"
                  >
                    <option value="Morning">Morning</option>
                    <option value="Afternoon">Afternoon</option>
                    <option value="Evening">Evening</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Services & Locations */}
      {activeTab === 'services' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Services */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <div className="font-bold text-slate-900 text-sm">Service Catalog</div>
                <p className="text-[11px] text-slate-500">
                  Services list aligned with{' '}
                  <a
                    href="https://msdfs.in/services/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline font-semibold"
                  >
                    msdfs.in/services/
                  </a>
                </p>
              </div>
              <button
                type="button"
                onClick={handleSyncWebsiteServices}
                className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg border border-blue-200 font-semibold text-[11px] flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                title="Sync all official services from https://msdfs.in/services/"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Sync msdfs.in Services</span>
              </button>
            </div>

            <form onSubmit={handleAddService} className="flex gap-2">
              <input
                type="text"
                placeholder="New service name..."
                value={newService}
                onChange={(e) => setNewService(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg cursor-pointer"
              >
                Add
              </button>
            </form>

            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
              {currentServices.map((srv, idx) => {
                const isFromWebsite = WEBSITE_MSDFS_SERVICES.includes(srv);
                return (
                  <div key={idx} className="py-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium text-slate-800">{srv}</span>
                      {isFromWebsite && (
                        <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium px-1.5 py-0.2 rounded">
                          msdfs.in
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteService(srv)}
                      className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                      title="Delete service"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Locations */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-900 text-sm">
                  Pondicherry Service Locations ({currentLocations.length})
                </div>
                <div className="text-[11px] text-slate-500">
                  Comprehensive coverage of 64 Pondicherry areas &amp; custom localities
                </div>
              </div>
              <button
                type="button"
                onClick={handleResetToStandardLocations}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                title="Reset to 64 standard Pondicherry areas"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset to 64 Areas</span>
              </button>
            </div>

            <form onSubmit={handleAddLocation} className="flex gap-2">
              <input
                type="text"
                placeholder="Add custom location area..."
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg cursor-pointer text-xs"
              >
                Add Area
              </button>
            </form>

            {/* Quick Filter */}
            <div className="pt-1">
              <input
                type="text"
                placeholder="Search / filter locations..."
                value={locationSearch}
                onChange={(e) => setLocationSearch(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-md px-2.5 py-1 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto pr-1">
              {currentLocations
                .filter((loc) => loc.toLowerCase().includes(locationSearch.toLowerCase().trim()))
                .map((loc, idx) => (
                  <div key={idx} className="py-2 flex items-center justify-between text-xs hover:bg-slate-50 px-1 rounded">
                    <span className="font-medium text-slate-800">{loc}</span>
                    {loc !== 'Other' && (
                      <button
                        onClick={() => handleDeleteLocation(loc)}
                        className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer transition-colors"
                        title={`Remove ${loc}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: WhatsApp Templates */}
      {activeTab === 'whatsapp' && (
        <form onSubmit={handleSaveWhatsAppTemplates} className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4 text-xs">
          <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
            <div>
              <div className="font-bold text-slate-900 text-sm">Custom WhatsApp Message Templates</div>
              <p className="text-slate-500">
                Variables supported: [Customer Name], [Booking Reference], [Schedule Date], [Time Slot], [Service Name], [Work Description], [Service Location], [Full Address], [Staff Name], [Staff Phone], [Team Members], [Total Amount], [Advance Paid], [Balance Due]
              </p>
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save Templates</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Customer Confirmation Template
              </label>
              <textarea
                rows={12}
                value={customerTemplate}
                onChange={(e) => setCustomerTemplate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-mono text-xs leading-relaxed"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Staff Assignment Dispatch Template
              </label>
              <textarea
                rows={12}
                value={staffTemplate}
                onChange={(e) => setStaffTemplate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-mono text-xs leading-relaxed"
              />
            </div>
          </div>
        </form>
      )}

      {/* Tab 7: Native Android App Package & Source */}
      {activeTab === 'android' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-5 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-emerald-600" />
                <span>MSDFS Native Android Application Package</span>
              </h3>
              <p className="text-slate-500 mt-0.5">
                Built with Kotlin, Jetpack Compose, Material 3, and DataStore sync
              </p>
            </div>
            <a
              href="/msdfs-android-project.zip"
              download="msdfs-android-project.zip"
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs shadow-sm transition-colors cursor-pointer"
              id="btn-download-android-zip"
            >
              <Download className="w-4 h-4" />
              <span>Download Android Studio Project (.ZIP)</span>
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-slate-200 rounded-lg p-3.5 bg-slate-50 space-y-2">
              <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <FileCode className="w-4 h-4 text-blue-600" />
                <span>1. Generate Debug APK</span>
              </h4>
              <p className="text-slate-600 leading-relaxed">
                Extract the ZIP file and open the folder in Android Studio or run directly via terminal:
              </p>
              <div className="bg-slate-900 text-slate-100 font-mono text-[11px] p-2.5 rounded-md overflow-x-auto select-all">
                ./gradlew assembleDebug
              </div>
              <p className="text-slate-500 text-[11px]">
                Generated APK location: <code className="text-slate-700 bg-slate-200 px-1 py-0.5 rounded font-mono">app/build/outputs/apk/debug/app-debug.apk</code>
              </p>
            </div>

            <div className="border border-slate-200 rounded-lg p-3.5 bg-slate-50 space-y-2">
              <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>2. Generate Release APK &amp; AAB</span>
              </h4>
              <p className="text-slate-600 leading-relaxed">
                For production distribution and Google Play Store:
              </p>
              <div className="bg-slate-900 text-slate-100 font-mono text-[11px] p-2.5 rounded-md overflow-x-auto select-all space-y-1">
                <div>./gradlew assembleRelease</div>
                <div>./gradlew bundleRelease</div>
              </div>
              <p className="text-slate-500 text-[11px]">
                Generated AAB bundle location: <code className="text-slate-700 bg-slate-200 px-1 py-0.5 rounded font-mono">app/build/outputs/bundle/release/app-release.aab</code>
              </p>
            </div>
          </div>

          <div className="border border-amber-200 bg-amber-50/70 rounded-lg p-4 space-y-2 text-slate-700">
            <h4 className="font-bold text-amber-900 text-xs">
              Release Signing Requirements for Google Play Store
            </h4>
            <ol className="list-decimal list-inside space-y-1 text-[11px] text-amber-900 leading-relaxed">
              <li>
                <strong>Generate your keystore:</strong> Run <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">keytool -genkey -v -keystore my-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias my-alias</code>
              </li>
              <li>
                <strong>In Android Studio:</strong> Go to <em>Build &gt; Generate Signed Bundle / APK</em>, select your keystore file and key alias, then choose <em>Release</em>.
              </li>
              <li>
                <strong>Google Play App Signing:</strong> When uploading to Google Play Console, Play App Signing manages the final signing key automatically.
              </li>
            </ol>
          </div>
        </div>
      )}

      {/* Tab 7: Data Management & Danger Zone */}
      {activeTab === 'data' && (
        <div className="space-y-6 max-w-3xl text-xs">
          {/* Card 1: Data Overview & Safe Backup */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Booking Storage &amp; Offline Backup</h3>
                  <p className="text-slate-500 text-[11px]">
                    Manage local database records and create offline backups
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 bg-blue-50 text-blue-800 font-bold rounded-full text-xs border border-blue-200 shadow-2xs">
                {totalBookingsCount ?? (allBookings ? allBookings.length : 0)} Bookings Stored
              </span>
            </div>

            <p className="text-slate-600 leading-relaxed text-[11px]">
              All your bookings are stored locally in your browser storage and automatically synced to your central Google Sheet. We strongly recommend downloading an offline backup periodically before performing any reset or clearing operations.
            </p>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={handleDownloadBackupJSON}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors cursor-pointer shadow-2xs"
              >
                <Download className="w-4 h-4" />
                <span>Download Full Backup (JSON)</span>
              </button>

              <button
                type="button"
                onClick={handleExportCSVBackup}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs border border-slate-300 transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4 text-emerald-600" />
                <span>Export Bookings as CSV</span>
              </button>
            </div>
          </div>

          {/* Card 2: Danger Zone */}
          <div className="bg-rose-50/50 rounded-xl border-2 border-rose-200 p-5 shadow-2xs space-y-5">
            <div className="flex items-center gap-2.5 border-b border-rose-200 pb-3">
              <div className="p-2 rounded-lg bg-rose-100 text-rose-700">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-rose-900 text-sm">Danger Zone (सुरक्षित डेटा प्रबंधन व रिसेट)</h3>
                <p className="text-rose-700 text-[11px]">
                  These destructive actions are placed here safely with verification to prevent accidental clicks on the daily board
                </p>
              </div>
            </div>

            {/* Action 1: Restore Sample Bookings */}
            <div className="bg-white rounded-lg border border-rose-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1 max-w-lg">
                <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                  <RotateCcw className="w-4 h-4 text-amber-600" />
                  <span>Restore Sample Bookings</span>
                </h4>
                <p className="text-slate-500 text-[11px] leading-relaxed">
                  Resets the database back to the initial 22 sample bookings from MSD Facility Services. Useful if you want to test demo data.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (onResetToSampleData) {
                    onResetToSampleData();
                    showNotice('Database restored to 22 sample bookings.');
                  }
                }}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold text-xs border border-amber-300 transition-colors cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-4 h-4 text-amber-700" />
                <span>Restore Sample Data</span>
              </button>
            </div>

            {/* Action 2: Delete All Bookings (Guarded with Verification) */}
            <div className="bg-white rounded-lg border border-rose-300 p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1 max-w-lg">
                  <h4 className="font-bold text-rose-900 text-xs flex items-center gap-1.5">
                    <Trash2 className="w-4 h-4 text-rose-600" />
                    <span>Delete All Bookings Permanently ({totalBookingsCount ?? (allBookings ? allBookings.length : 0)})</span>
                  </h4>
                  <p className="text-slate-500 text-[11px] leading-relaxed">
                    Permanently clears all booking records from local storage. This allows you to start completely fresh with 0 bookings.
                  </p>
                </div>
                {!isDeletingAllOpen && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsDeletingAllOpen(true);
                      setDeleteConfirmationText('');
                    }}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-2xs transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete All Bookings</span>
                  </button>
                )}
              </div>

              {/* Safety Lock Box */}
              {isDeletingAllOpen && (
                <div className="bg-rose-100/70 border border-rose-300 rounded-lg p-3.5 space-y-3 mt-3 animate-in fade-in">
                  <div className="flex items-start gap-2 text-rose-900 font-semibold text-xs">
                    <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
                    <div>
                      <p>Accidental Click Protection:</p>
                      <p className="font-normal text-[11px] text-rose-800 mt-0.5">
                        This action CANNOT be undone. All {totalBookingsCount ?? (allBookings ? allBookings.length : 0)} bookings will be erased immediately.
                        To confirm deletion, please type <strong className="text-rose-950 font-bold bg-white px-1.5 py-0.5 rounded border border-rose-300">DELETE</strong> in the box below:
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <input
                      type="text"
                      value={deleteConfirmationText}
                      onChange={(e) => setDeleteConfirmationText(e.target.value)}
                      placeholder="Type DELETE to confirm"
                      className="px-3 py-1.5 bg-white border border-rose-300 rounded-md text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500 w-48 uppercase"
                    />
                    <button
                      type="button"
                      disabled={deleteConfirmationText.trim().toUpperCase() !== 'DELETE'}
                      onClick={() => {
                        if (deleteConfirmationText.trim().toUpperCase() === 'DELETE') {
                          if (onClearAllBookings) {
                            onClearAllBookings();
                          }
                          setIsDeletingAllOpen(false);
                          setDeleteConfirmationText('');
                          showNotice('All bookings deleted successfully. Database is now clean.');
                        }
                      }}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md font-bold text-xs transition-all ${
                        deleteConfirmationText.trim().toUpperCase() === 'DELETE'
                          ? 'bg-rose-700 hover:bg-rose-800 text-white cursor-pointer shadow-sm'
                          : 'bg-rose-300 text-rose-100 cursor-not-allowed'
                      }`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Confirm Wipe Database</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsDeletingAllOpen(false);
                        setDeleteConfirmationText('');
                      }}
                      className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-semibold rounded-md text-xs transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
