export interface StaffMember {
  id: string;
  name: string;
  mobile: string;
  status: 'active' | 'inactive';
  notes?: string;
}

export type SlotPeriod = 'Morning' | 'Afternoon' | 'Evening';

export interface SlotDefinition {
  id: string;
  slotNumber: number;
  period: SlotPeriod;
  label: string;
  startTime: string;
  endTime: string;
}

export type PaymentStatus = 'Not Paid' | 'Advance Paid' | 'Fully Paid' | 'Pending' | 'Paid' | 'Cancelled';

export type BookingStatus =
  | 'New'
  | 'Pending'
  | 'Confirmed'
  | 'Staff Assigned'
  | 'In Progress'
  | 'Completed'
  | 'Cancelled'
  | 'Rescheduled'
  | 'Postponed';

export type MessageDeliveryStatus =
  | 'Not Sent'
  | 'Ready'
  | 'Opened'
  | 'Sent'
  | 'Failed'
  | 'Number Missing';

export interface StaffMessageStatus {
  staffId: string;
  staffName: string;
  phone: string;
  status: MessageDeliveryStatus;
  sentAt?: string;
  openedAt?: string;
  failureReason?: string;
}

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error';

export interface Customer {
  id: string;
  name: string;
  mobile: string; // Normalized 10-digit phone
  alternateMobile?: string;
  email?: string;
  location: string;
  fullAddress: string;
  totalBookings: number;
  lastBookingDate?: string;
  lastService?: string;
  lastAmount?: number | string;
  createdAt: string;
  updatedAt: string;
}

export interface AddOnServiceItem {
  id: string;
  name: string;
  quantity: number;
  amount: number;
}

export interface Booking {
  id: string;
  bookingRef: string;
  bookingDate: string; // YYYY-MM-DD
  scheduleDate: string; // YYYY-MM-DD
  customerName: string;
  customerMobile: string;
  alternateMobile?: string; // WhatsApp or secondary phone
  customerWhatsApp?: string;
  serviceType: string;
  quantity?: number; // QTY (e.g. 1, 2, 3...)
  serviceDescription?: string; // Detailed description of work / scope of work
  serviceDetails?: string; // Unified service details with quantity & scope
  serviceLocation: string;
  customLocation?: string;
  fullAddress: string;
  slotNumber: number; // 1 to 10
  slotPeriod: SlotPeriod;
  preferredTime: string;
  staffRequired: number;
  assignedStaffIds: string[];
  assignedStaffNames: string[];
  staffMobile?: string;
  team?: string;
  amount: number | string;
  advanceAmount: number;
  balanceAmount: number;
  paymentStatus: PaymentStatus;
  bookingStatus: BookingStatus;
  notes: string;
  createdBy?: string;
  createdDevice?: string;
  lastSync?: string;
  createdAt: string;
  updatedAt: string;
  // WhatsApp Message Status Tracking
  customerMessageStatus?: MessageDeliveryStatus;
  customerMessageSentAt?: string;
  customerMessageOpenedAt?: string;
  staffMessageStatuses?: Record<string, StaffMessageStatus>;
  staffMessageSentAt?: string;
  // On-Site Add-Ons, Discounts & Completion Invoicing
  addOnServices?: AddOnServiceItem[];
  discountAmount?: number;
  discountType?: 'flat' | 'percentage';
  discountValue?: number;
  originalBookingAmount?: number | string;
  finalCollectedAmount?: number;
  paymentMode?: 'Cash' | 'UPI' | 'Card' | 'Bank Transfer' | 'Credit';
  completionNotes?: string;
  completedAt?: string;
  invoiceGenerated?: boolean;
  // Raw columns preservation from original Google Sheet
  rawSheetExtra?: Record<string, string>;
}

export interface CompanyInfo {
  name: string;
  address: string;
  mobile: string;
  email: string;
  website: string;
  panNo?: string;
  bankName?: string;
  bankAccountNo?: string;
  bankIfsc?: string;
  bankAccountHolder?: string;
  logoUrl?: string;
}

export interface WhatsAppTemplate {
  customerTemplate: string;
  staffTemplate: string;
}

export interface AppSettings {
  company: CompanyInfo;
  bookingRefPrefix: string;
  nextRefNumber: number;
  services: string[];
  locations: string[];
  googleSheetUrl?: string;
  googleSheetWebAppUrl?: string;
  lastSyncedAt?: string;
  lastSyncError?: string;
  autoSyncEnabled?: boolean;
  syncIntervalSeconds?: number;
  whatsappTemplates: WhatsAppTemplate;
}

export interface ConflictWarning {
  staffId: string;
  staffName: string;
  conflictingBookingRef: string;
  customerName: string;
  timeSlot: string;
}
