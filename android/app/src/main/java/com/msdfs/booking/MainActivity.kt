package com.msdfs.booking

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.EventNote
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.lifecycle.lifecycleScope
import com.msdfs.booking.data.BookingRepository
import com.msdfs.booking.model.Booking
import com.msdfs.booking.ui.screens.BookingEditScreen
import com.msdfs.booking.ui.screens.BookingsScreen
import com.msdfs.booking.ui.screens.SettingsScreen
import com.msdfs.booking.ui.screens.StaffScreen
import com.msdfs.booking.ui.theme.BluePrimary
import com.msdfs.booking.ui.theme.MSDFSTheme
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {

    private lateinit var repository: BookingRepository

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        repository = BookingRepository(applicationContext)

        setContent {
            MSDFSTheme {
                val bookings by repository.bookingsFlow.collectAsState(initial = emptyList())
                val staffList by repository.staffFlow.collectAsState(initial = emptyList())
                val settings by repository.settingsFlow.collectAsState(initial = com.msdfs.booking.data.InitialData.INITIAL_SETTINGS)

                var currentTab by remember { mutableStateOf(0) }
                var searchQuery by remember { mutableStateOf("") }
                var editingBooking by remember { mutableStateOf<Booking?>(null) }
                var isEditingScreenOpen by remember { mutableStateOf(false) }

                if (isEditingScreenOpen) {
                    BookingEditScreen(
                        initialBooking = editingBooking,
                        staffList = staffList,
                        onSave = { booking ->
                            lifecycleScope.launch {
                                repository.addOrUpdateBooking(booking)
                            }
                        },
                        onDelete = { id ->
                            lifecycleScope.launch {
                                repository.deleteBooking(id)
                            }
                        },
                        onBack = {
                            isEditingScreenOpen = false
                            editingBooking = null
                        }
                    )
                } else {
                    Scaffold(
                        bottomBar = {
                            NavigationBar(containerColor = Color.White) {
                                NavigationBarItem(
                                    selected = currentTab == 0,
                                    onClick = { currentTab = 0 },
                                    icon = { Icon(Icons.Default.EventNote, contentDescription = "Bookings") },
                                    label = { Text("Bookings") },
                                    colors = NavigationBarItemDefaults.colors(selectedIconColor = BluePrimary)
                                )
                                NavigationBarItem(
                                    selected = currentTab == 1,
                                    onClick = { currentTab = 1 },
                                    icon = { Icon(Icons.Default.Group, contentDescription = "Staff") },
                                    label = { Text("Staff Team") },
                                    colors = NavigationBarItemDefaults.colors(selectedIconColor = BluePrimary)
                                )
                                NavigationBarItem(
                                    selected = currentTab == 2,
                                    onClick = { currentTab = 2 },
                                    icon = { Icon(Icons.Default.Settings, contentDescription = "Settings") },
                                    label = { Text("Settings") },
                                    colors = NavigationBarItemDefaults.colors(selectedIconColor = BluePrimary)
                                )
                            }
                        }
                    ) { innerPadding ->
                        when (currentTab) {
                            0 -> BookingsScreen(
                                bookings = bookings,
                                searchQuery = searchQuery,
                                onSearchChange = { searchQuery = it },
                                onNewBookingClick = {
                                    editingBooking = null
                                    isEditingScreenOpen = true
                                },
                                onBookingClick = { booking ->
                                    editingBooking = booking
                                    isEditingScreenOpen = true
                                },
                                modifier = Modifier.padding(innerPadding)
                            )
                            1 -> StaffScreen(
                                staffList = staffList,
                                onSaveStaff = { updated ->
                                    lifecycleScope.launch {
                                        repository.saveStaff(updated)
                                    }
                                }
                            )
                            2 -> SettingsScreen(
                                settings = settings,
                                onSaveSettings = { updated ->
                                    lifecycleScope.launch {
                                        repository.saveSettings(updated)
                                    }
                                },
                                onTestSync = {
                                    lifecycleScope.launch {
                                        if (settings.googleSheetWebAppUrl.isNotBlank()) {
                                            repository.fetchFromGoogleSheet(settings.googleSheetWebAppUrl)
                                        }
                                    }
                                }
                            )
                        }
                    }
                }
            }
        }
    }
}
