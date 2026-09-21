package com.msdfs.booking.data

import com.msdfs.booking.model.AppSettings
import com.msdfs.booking.model.CompanyInfo
import com.msdfs.booking.model.SlotDefinition
import com.msdfs.booking.model.SlotPeriod
import com.msdfs.booking.model.StaffMember

object InitialData {
    val INITIAL_STAFF = listOf(
        StaffMember("staff-1", "Mr. Saidul", "8822393257", "active", "Team Lead - Experienced in Deep House & Water Tank Cleaning"),
        StaffMember("staff-2", "Mr. Farhad", "9395065024", "active", "Team Lead - Specialist in Bathroom & Floor Cleaning"),
        StaffMember("staff-3", "Mr. Rejaul", "6000320989", "active", "Team Lead - Water Tank & Deep Cleaning Specialist"),
        StaffMember("staff-4", "Mr. Fahim", "9600772693", "active", "Cleaning Specialist"),
        StaffMember("staff-5", "Mr. Shahid", "8453864852", "active", "Cleaning Specialist"),
        StaffMember("staff-6", "Mr. Nizam", "", "active", "Cleaning Specialist - Mobile pending verification")
    )

    val INITIAL_SLOTS = listOf(
        SlotDefinition("slot-1", 1, SlotPeriod.Morning, "Slot 1 (Morning)"),
        SlotDefinition("slot-2", 2, SlotPeriod.Morning, "Slot 2 (Morning)"),
        SlotDefinition("slot-3", 3, SlotPeriod.Morning, "Slot 3 (Morning)"),
        SlotDefinition("slot-4", 4, SlotPeriod.Afternoon, "Slot 4 (Afternoon)"),
        SlotDefinition("slot-5", 5, SlotPeriod.Afternoon, "Slot 5 (Afternoon)"),
        SlotDefinition("slot-6", 6, SlotPeriod.Afternoon, "Slot 6 (Afternoon)"),
        SlotDefinition("slot-7", 7, SlotPeriod.Afternoon, "Slot 7 (Afternoon)"),
        SlotDefinition("slot-8", 8, SlotPeriod.Evening, "Slot 8 (Evening)"),
        SlotDefinition("slot-9", 9, SlotPeriod.Evening, "Slot 9 (Evening)"),
        SlotDefinition("slot-10", 10, SlotPeriod.Evening, "Slot 10 (Evening)")
    )

    val WEBSITE_SERVICES = listOf(
        "Housekeeping",
        "Commercial Deep Cleaning Services",
        "Residential Deep Cleaning Services",
        "Office Deep Cleaning Services",
        "Home Deep Cleaning Services",
        "Kitchen Cleaning Services",
        "Chair Cleaning",
        "Sofa Cleaning",
        "Carpet Cleaning",
        "Floor Deep Cleaning",
        "Bathroom Cleaning",
        "Water Tank Cleaning",
        "1 BHK Cleaning",
        "2 BHK Cleaning",
        "3 BHK Cleaning",
        "Full House Cleaning",
        "Deep House Cleaning",
        "Basic Deep Cleaning",
        "Floor sweeping & mopping",
        "Sofa & Carpet Cleaning"
    )

    val LOCATIONS = listOf(
        "Puducherry", "Moolakulam", "Lawspet", "White Town", "Reddiarpalayam",
        "Villianur", "Ariyankuppam", "Mudaliarpet", "Rainbow nagar", "Aziz Nagar",
        "Kamban Nagar", "Shanmugapuram", "Jayanagar", "Kamraj Nagar", "Old Bus Stand",
        "Thavalakupam", "Other"
    )

    val INITIAL_SETTINGS = AppSettings(
        company = CompanyInfo(),
        bookingRefPrefix = "MSD/PDY",
        nextRefNumber = 1032,
        services = WEBSITE_SERVICES,
        locations = LOCATIONS,
        googleSheetWebAppUrl = ""
    )
}
