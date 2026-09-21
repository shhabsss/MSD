import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  Copy,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Link,
  RefreshCw,
  Sheet,
  ShieldCheck,
  Upload,
  UserCheck,
  Users,
} from 'lucide-react';
import React, { useState } from 'react';
import {
  exportCustomersGoogleSheetCSV,
  exportGoogleSheetCSV,
  cleanGoogleSheetDuplicates,
  getGoogleAppsScriptTemplate,
  syncAllWithGoogleSheets,
  testGoogleSheetConnection,
  pushAllBookingsWithDetailsToCloud,
} from '../services/storageService';
import { AppSettings, Booking, Customer, StaffMember, SyncStatus } from '../types';

interface GoogleSheetSyncViewProps {
  bookings?: Booking[];
  allBookings?: Booking[];
  setBookings: (bookings: Booking[]) => void;
  customers?: Customer[];
  setCustomers?: (customers: Customer[]) => void;
  allStaff?: StaffMember[];
  staffList?: StaffMember[];
  settings?: AppSettings;
  onSaveSettings: (settings: AppSettings) => void;
  globalSyncStatus?: SyncStatus;
  onTriggerGlobalSync?: () => Promise<void> | void;
  lastSyncTime?: string;
}

export const GoogleSheetSyncView: React.FC<GoogleSheetSyncViewProps> = ({
  bookings = [],
  allBookings = [],
  setBookings,
  customers = [],
  setCustomers,
  allStaff = [],
  staffList = [],
  settings,
  onSaveSettings,
  globalSyncStatus = 'synced',
  onTriggerGlobalSync,
  lastSyncTime,
}) => {
  const currentBookings = bookings && bookings.length > 0 ? bookings : allBookings;
  const currentStaff = allStaff && allStaff.length > 0 ? allStaff : staffList;
  const [webAppUrl, setWebAppUrl] = useState(settings?.googleSheetWebAppUrl || '');
  const [syncStatus, setSyncStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [importStatus, setImportStatus] = useState<string>('');
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [isCleaningDuplicates, setIsCleaningDuplicates] = useState(false);
  const [isPushingDetails, setIsPushingDetails] = useState(false);

  const scriptCode = getGoogleAppsScriptTemplate();

  const handleCopyScript = () => {
    navigator.clipboard.writeText(scriptCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 3000);
  };

  const handleSaveUrl = () => {
    onSaveSettings({
      ...settings,
      googleSheetWebAppUrl: webAppUrl.trim(),
    });
    setStatusMessage('Google Apps Script Web App URL saved!');
    setTimeout(() => setStatusMessage(''), 3000);
  };

  const handleManualFullSync = async () => {
    if (!webAppUrl.trim()) {
      alert('Please enter and save your Google Apps Script Web App URL first.');
      return;
    }

    setIsSyncingAll(true);
    setStatusMessage('Synchronizing all bookings and customer records with Google Sheet...');

    try {
      const result = await syncAllWithGoogleSheets({
        webAppUrl: webAppUrl.trim(),
        localBookings: currentBookings,
        localCustomers: customers,
      });

      if (result.success) {
        if (result.mergedBookings) setBookings(result.mergedBookings);
        if (result.mergedCustomers && setCustomers) setCustomers(result.mergedCustomers);

        setSyncStatus('success');
        setStatusMessage(
          `Bi-directional sync complete! ${result.mergedBookings?.length || currentBookings.length} bookings and ${
            result.mergedCustomers?.length || customers.length
          } customer records unified.`
        );
        onSaveSettings({
          ...settings,
          googleSheetWebAppUrl: webAppUrl.trim(),
          lastSyncedAt: new Date().toISOString(),
        });
      } else {
        setSyncStatus('error');
        setStatusMessage(result.message || 'Sync failed.');
      }
    } catch (err: any) {
      setSyncStatus('error');
      setStatusMessage(`Sync error: ${err.message}`);
    } finally {
      setIsSyncingAll(false);
    }
  };

  const handleCleanDuplicates = async () => {
    if (!webAppUrl.trim()) {
      alert('Please enter and save your Google Apps Script Web App URL first.');
      return;
    }

    setIsCleaningDuplicates(true);
    setStatusMessage('Scanning Google Sheet for duplicate entries and removing redundant rows...');

    try {
      const res = await cleanGoogleSheetDuplicates(webAppUrl.trim());
      if (res.success) {
        setSyncStatus('success');
        setStatusMessage(res.message);
        // Refresh local cache with clean data
        await handleManualFullSync();
      } else {
        setSyncStatus('error');
        setStatusMessage(res.message);
      }
    } catch (err: any) {
      setSyncStatus('error');
      setStatusMessage(`Cleanup error: ${err?.message || err}`);
    } finally {
      setIsCleaningDuplicates(false);
    }
  };

  const handlePushAllDetails = async () => {
    if (!webAppUrl.trim()) {
      alert('Please enter and save your Google Apps Script Web App URL first.');
      return;
    }

    setIsPushingDetails(true);
    setStatusMessage('Updating Google Sheet with complete Service Details and Staff Numbers for all bookings...');

    try {
      const res = await pushAllBookingsWithDetailsToCloud(currentBookings, webAppUrl.trim());
      if (res.success) {
        setSyncStatus('success');
        setStatusMessage(res.message);
      } else {
        setSyncStatus('error');
        setStatusMessage(res.message);
      }
    } catch (err: any) {
      setSyncStatus('error');
      setStatusMessage(`Update error: ${err?.message || err}`);
    } finally {
      setIsPushingDetails(false);
    }
  };

  const handleTestConnection = async () => {
    if (!webAppUrl.trim()) {
      alert('Please enter your Google Apps Script Web App URL first.');
      return;
    }

    setSyncStatus('testing');
    setStatusMessage('Connecting to Google Sheet Web App...');

    try {
      const testRes = await testGoogleSheetConnection(webAppUrl.trim());
      if (testRes.success) {
        setSyncStatus('success');
        setStatusMessage(testRes.message);
        onSaveSettings({
          ...settings,
          googleSheetWebAppUrl: webAppUrl.trim(),
          lastSyncedAt: new Date().toISOString(),
        });
      } else {
        setSyncStatus('error');
        setStatusMessage(testRes.message);
      }
    } catch (err: any) {
      setSyncStatus('error');
      setStatusMessage(
        `Unable to reach URL directly due to CORS or network error: ${err.message}. Ensure deployment is set to "Who has access: Anyone".`
      );
    }
  };

  const handleExportCSV = () => {
    const csvContent = exportGoogleSheetCSV(currentBookings, currentStaff);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `MSD_Facility_Services_Sheet_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportCustomersCSV = () => {
    const csvContent = exportCustomersGoogleSheetCSV(customers);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `MSD_Customers_Database_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length < 2) {
          setImportStatus('CSV file has no data rows.');
          return;
        }

        setImportStatus(`Successfully parsed ${lines.length - 1} rows from CSV.`);
      } catch (err: any) {
        setImportStatus(`Failed to read CSV: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-5">
      {/* Top Status Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <Sheet className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Google Sheet Central Cloud Database &amp; Multi-Device Sync
              </h2>
              <p className="text-xs text-slate-500">
                Central source of truth for Mobile &amp; Laptop devices with atomic conflict handling
              </p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>{currentBookings.length} Bookings</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-300">
              <UserCheck className="w-4 h-4 text-blue-600" />
              <span>{customers.length} Customers</span>
            </span>
            {lastSyncTime && (
              <span className="text-[11px] text-slate-500">
                Last synced: {new Date(lastSyncTime).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>

        {/* Multi-Device Architecture Guarantee */}
        <div className="mt-4 bg-blue-50/70 border border-blue-200 rounded-xl p-3.5 text-xs text-blue-900 space-y-1">
          <div className="font-bold flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <span>Multi-Device Central Cloud Database Guarantee</span>
          </div>
          <p className="text-[11px] text-blue-800 leading-relaxed">
            Your Google Sheet acts as the centralized primary database. When you create, edit, cancel, or reschedule a booking on mobile, the changes automatically sync to your laptop and vice versa. Local storage functions solely as temporary offline cache.
          </p>
        </div>
      </div>

      {/* 2-Column Grid: Webhook Connection & Script Guide */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Column 1: Live Web App Connection & Actions */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
            <Link className="w-4 h-4 text-blue-600" />
            <span>Google Apps Script Web App Connection</span>
          </div>

          <p className="text-xs text-slate-600">
            Paste your deployed Google Apps Script Web App URL below to enable automatic background
            reading and writing to your existing Google Sheet.
          </p>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              Apps Script Web App URL
            </label>
            <input
              type="url"
              value={webAppUrl}
              onChange={(e) => setWebAppUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/.../exec"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleSaveUrl}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer"
            >
              Save URL
            </button>
            <button
              type="button"
              onClick={handleManualFullSync}
              disabled={isSyncingAll}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingAll ? 'animate-spin' : ''}`} />
              <span>{isSyncingAll ? 'Syncing...' : 'Sync Mobile & Laptop Now'}</span>
            </button>
            <button
              type="button"
              onClick={handleCleanDuplicates}
              disabled={isCleaningDuplicates || isSyncingAll || isPushingDetails}
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Scan Google Sheet and remove any duplicate rows having the same Reference No"
            >
              <ShieldCheck className={`w-3.5 h-3.5 ${isCleaningDuplicates ? 'animate-spin' : ''}`} />
              <span>{isCleaningDuplicates ? 'Cleaning...' : 'Clean Duplicate Sheet Rows'}</span>
            </button>
            <button
              type="button"
              onClick={handlePushAllDetails}
              disabled={isPushingDetails || isSyncingAll || isCleaningDuplicates}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Push complete Service Details and Staff Mobile numbers for all bookings into Google Sheet"
            >
              <UserCheck className={`w-3.5 h-3.5 ${isPushingDetails ? 'animate-spin' : ''}`} />
              <span>{isPushingDetails ? 'Updating Sheet...' : 'Update Staff Mobile & Details in Sheet'}</span>
            </button>
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={syncStatus === 'testing'}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-lg text-xs border border-slate-300 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Cloud className="w-3.5 h-3.5 text-blue-600" />
              <span>Test Ping</span>
            </button>
          </div>

          {statusMessage && (
            <div
              className={`p-3 rounded-lg text-xs font-medium ${
                syncStatus === 'error'
                  ? 'bg-amber-50 text-amber-900 border border-amber-200'
                  : 'bg-emerald-50 text-emerald-900 border border-emerald-200'
              }`}
            >
              {statusMessage}
            </div>
          )}

          {/* Backup CSV actions */}
          <div className="pt-3 border-t border-slate-200 space-y-2.5">
            <div className="font-bold text-xs text-slate-800">
              Direct CSV Backup &amp; Google Sheet Import/Export
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleExportCSV}
                className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Bookings CSV</span>
              </button>

              <button
                type="button"
                onClick={handleExportCustomersCSV}
                className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Customers CSV</span>
              </button>

              <label className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-lg text-xs border border-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer">
                <Upload className="w-3.5 h-3.5 text-blue-600" />
                <span>Import CSV</span>
                <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
            {importStatus && (
              <div className="text-xs text-slate-600 font-mono bg-slate-50 p-2 rounded border border-slate-200">
                {importStatus}
              </div>
            )}
          </div>
        </div>

        {/* Column 2: 3-Step Setup Guide & Script Code */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-3 flex flex-col">
          <div className="flex items-center justify-between">
            <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Google Apps Script Setup (3 Easy Steps)</span>
            </div>
            <button
              type="button"
              onClick={handleCopyScript}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-md border border-slate-300 flex items-center gap-1 cursor-pointer"
            >
              <Copy className="w-3 h-3" />
              <span>{copiedCode ? 'Copied!' : 'Copy Script Code'}</span>
            </button>
          </div>

          <ol className="list-decimal list-inside text-xs text-slate-600 space-y-1.5 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <li>
              Open your Google Sheet and click{' '}
              <span className="font-semibold text-slate-800">Extensions &gt; Apps Script</span>.
            </li>
            <li>
              Paste the script below (it handles atomic booking IDs, customer records, and multi-device sync).
            </li>
            <li>
              Click <span className="font-semibold text-slate-800">Deploy &gt; New deployment &gt; Web App</span>, set{' '}
              <span className="font-semibold text-slate-800">Execute as: Me</span> and{' '}
              <span className="font-semibold text-slate-800">Who has access: Anyone</span>. Copy the URL here!
            </li>
          </ol>

          <div className="flex-1 min-h-[160px] bg-slate-900 text-slate-200 p-3 rounded-lg font-mono text-[10px] overflow-y-auto max-h-[220px]">
            <pre>{scriptCode}</pre>
          </div>
        </div>
      </div>
    </div>
  );
};

