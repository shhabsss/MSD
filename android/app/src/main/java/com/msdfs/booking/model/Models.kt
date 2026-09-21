package com.msdfs.booking.model

import kotlinx.serialization.Serializable

@Serializable
enum class SlotPeriod {
    Morning, Afternoon, Evening
}

@Serializable
enum class PaymentStatus(val displayName: String) {
    NotPaid("Not Paid"),
    AdvancePaid("Advance Paid"),
    FullyPaid("Fully Paid"),
    Pending("Pending")
}

@Serializable
enum class BookingStatus(val displayName: String) {
    New("New"),
    Pending("Pending"),
    Confirmed("Confirmed"),
    StaffAssigned("Staff Assigned"),
    InProgress("In Progress"),
    Completed("Completed"),
    Cancelled("Cancelled"),
    Rescheduled("Rescheduled")
}

@Serializable
enum class MessageDeliveryStatus {
    NotSent, Ready, Opened, Sent, Failed, NumberMissing
}

@Serializable
data class StaffMember(
    val id: String,
    val name: String,
    val mobile: String,
    val status: String = "active", // "active" or "inactive"
    val notes: String = ""
)

@Serializable
data class SlotDefinition(
    val id: String,
    val slotNumber: Int,
    val period: SlotPeriod,
    val label: String,
    val startTime: String = "",
    val endTime: String = ""
)

@Serializable
data class Booking(
    val id: String,
    val bookingRef: String,
    val bookingDate: String, // YYYY-MM-DD
    val scheduleDate: String, // YYYY-MM-DD
    val customerName: String,
    val customerMobile: String,
    val customerWhatsApp: String = "",
    val serviceType: String,
    val quantity: Int = 1,
    val serviceDescription: String = "",
    val serviceLocation: String,
    val customLocation: String = "",
    val fullAddress: String,
    val slotNumber: Int,
    val slotPeriod: SlotPeriod,
    val preferredTime: String = "",
    val staffRequired: Int = 1,
    val assignedStaffIds: List<String> = emptyList(),
    val assignedStaffNames: List<String> = emptyList(),
    val amount: Double = 0.0,
    val isAfterVisit: Boolean = false,
    val advanceAmount: Double = 0.0,
    val balanceAmount: Double = 0.0,
    val paymentStatus: PaymentStatus = PaymentStatus.Pending,
    val bookingStatus: BookingStatus = BookingStatus.New,
    val notes: String = "",
    val createdAt: String = "",
    val updatedAt: String = ""
)

@Serializable
data class CompanyInfo(
    val name: String = "MSD Facility Services",
    val address: String = "No 72, 6th Cross, JJ Nagar, Moolakulam, Puducherry - 605010",
    val mobile: String = "9042233122",
    val email: String = "msdfacilityservices@gmail.com",
    val website: String = "https://msdfs.in/"
)

@Serializable
data class AppSettings(
    val company: CompanyInfo = CompanyInfo(),
    val bookingRefPrefix: String = "MSD/PDY",
    val nextRefNumber: Int = 1032,
    val services: List<String> = emptyList(),
    val locations: List<String> = emptyList(),
    val googleSheetWebAppUrl: String = ""
)
