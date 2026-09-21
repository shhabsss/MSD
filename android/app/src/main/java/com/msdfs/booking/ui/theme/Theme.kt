package com.msdfs.booking.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val BluePrimary = Color(0xFF1E3A8A)
val BlueSecondary = Color(0xFF2563EB)
val EmeraldAccent = Color(0xFF059669)
val AmberAccent = Color(0xFFD97706)
val RedAccent = Color(0xFFDC2626)
val SlateDark = Color(0xFF0F172A)
val SlateBackground = Color(0xFFF8FAFC)
val SlateSurface = Color(0xFFFFFFFF)
val SlateBorder = Color(0xFFE2E8F0)

private val LightColorScheme = lightColorScheme(
    primary = BluePrimary,
    onPrimary = Color.White,
    secondary = BlueSecondary,
    onSecondary = Color.White,
    tertiary = EmeraldAccent,
    background = SlateBackground,
    surface = SlateSurface,
    onBackground = SlateDark,
    onSurface = SlateDark
)

@Composable
fun MSDFSTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = LightColorScheme,
        content = content
    )
}
