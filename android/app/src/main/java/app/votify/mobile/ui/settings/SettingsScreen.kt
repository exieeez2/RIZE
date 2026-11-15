package app.votify.mobile.ui.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.KeyboardArrowRight
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.outlined.Language
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.Palette
import androidx.compose.material.icons.outlined.PictureInPicture
import androidx.compose.material.icons.outlined.PlayCircleOutline
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.Storage
import androidx.compose.material.icons.outlined.Storefront
import androidx.compose.material.icons.outlined.TouchApp
import androidx.compose.material.icons.outlined.VolumeUp
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import app.votify.mobile.BuildConfig
import app.votify.mobile.R
import app.votify.mobile.VotifyApp
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.TextButton
import app.votify.mobile.data.AppLocale
import app.votify.mobile.ui.theme.VotifyColors
import app.votify.mobile.ui.components.LocalLiquidGlass
import app.votify.mobile.ui.components.rememberGlassSpec
import app.votify.mobile.ui.components.rememberVotifyHaptic
import app.votify.mobile.ui.components.votifyGlass

/**
 * Modern grouped Settings Screen matching the flagship UI (Screenshot 2).
 * Sections: «Приложение» and «Интерфейс».
 */
@Composable
fun SettingsScreen(
    contentPadding: PaddingValues,
    onBack: () -> Unit,
    onOpenGeneral: () -> Unit,
    onOpenAudio: () -> Unit,
    onOpenStorage: () -> Unit,
    onOpenInterface: () -> Unit,
    onOpenPlayer: () -> Unit,
    onOpenArtwork: () -> Unit,
    onOpenAppIcon: () -> Unit,
    onOpenBackgrounds: () -> Unit,
    onOpenPresets: () -> Unit,
    onOpenWorkshop: () -> Unit,
    onOpenProxy: () -> Unit,
    onOpenSwipes: () -> Unit = {},
) {
    val context = LocalContext.current
    val haptic = rememberVotifyHaptic()
    val coroutineScope = rememberCoroutineScope()
    val app = VotifyApp.instance

    val currentLang = AppLocale.language(context)
    var showLanguageDialog by remember { mutableStateOf(false) }

    if (showLanguageDialog) {
        val languages = listOf(
            Triple("ru", "Русский", "🇷🇺"),
            Triple("en", "English", "🇬🇧"),
            Triple("uk", "Українська", "🇺🇦"),
        )
        AlertDialog(
            onDismissRequest = { showLanguageDialog = false },
            title = {
                Text(
                    text = stringResource(R.string.settings_language),
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                )
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    languages.forEach { (code, name, flag) ->
                        val isSelected = code == currentLang
                        Surface(
                            shape = RoundedCornerShape(14.dp),
                            color = if (isSelected) MaterialTheme.colorScheme.surfaceContainerHigh else Color.Transparent,
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    showLanguageDialog = false
                                    if (code != currentLang) {
                                        AppLocale.setLanguage(context, code)
                                        (context as? android.app.Activity)?.recreate()
                                    }
                                },
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 14.dp, vertical = 12.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween,
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                                ) {
                                    Text(text = flag, fontSize = 20.sp)
                                    Text(
                                        text = name,
                                        style = MaterialTheme.typography.bodyLarge,
                                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                        color = MaterialTheme.colorScheme.onSurface,
                                    )
                                }
                                if (isSelected) {
                                    Icon(
                                        imageVector = Icons.Default.Check,
                                        contentDescription = null,
                                        tint = MaterialTheme.colorScheme.primary,
                                        modifier = Modifier.size(20.dp),
                                    )
                                }
                            }
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { showLanguageDialog = false }) {
                    Text(text = stringResource(R.string.action_cancel))
                }
            },
            containerColor = MaterialTheme.colorScheme.surfaceContainer,
            shape = RoundedCornerShape(24.dp),
        )
    }

    Column(
        Modifier
            .fillMaxSize()
            .background(VotifyColors.SurfaceBase)
            .verticalScroll(rememberScrollState())
            .padding(
                top = contentPadding.calculateTopPadding(),
                bottom = contentPadding.calculateBottomPadding() + 24.dp
            ),
    ) {
        // Top Header Bar
        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(
                onClick = {
                    haptic()
                    onBack()
                },
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.surfaceContainerHigh.copy(alpha = 0.5f))
            ) {
                Icon(
                    Icons.AutoMirrored.Outlined.ArrowBack,
                    contentDescription = stringResource(R.string.nav_back),
                    tint = MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.size(20.dp)
                )
            }
            Spacer(Modifier.width(12.dp))
            Text(
                text = stringResource(R.string.settings_title),
                style = MaterialTheme.typography.titleLarge,
                color = MaterialTheme.colorScheme.onSurface,
                fontWeight = FontWeight.Bold,
            )
        }

        Spacer(Modifier.height(12.dp))

        // SECTION 1: Приложение
        SettingsSectionHeader(title = stringResource(R.string.settings_app_section))
        SettingsContainerCard {
            SettingsModernRow(
                icon = Icons.Outlined.Settings,
                title = stringResource(R.string.settings_nav_general),
                onClick = onOpenGeneral,
            )
            SettingsContainerDivider()
            SettingsModernRow(
                icon = Icons.Outlined.VolumeUp,
                title = stringResource(R.string.settings_nav_audio),
                onClick = onOpenAudio,
            )
            SettingsContainerDivider()
            SettingsModernRow(
                icon = Icons.Outlined.Storage,
                title = stringResource(R.string.settings_nav_cache),
                onClick = onOpenStorage,
            )
            SettingsContainerDivider()
            SettingsModernRow(
                icon = Icons.Outlined.Language,
                title = stringResource(R.string.settings_nav_language),
                trailing = {
                    val langBadge = when (currentLang) {
                        "en" -> "🇬🇧 EN"
                        "uk" -> "🇺🇦 UK"
                        else -> "🇷🇺 RU"
                    }
                    Text(
                        text = langBadge,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                },
                onClick = {
                    haptic()
                    showLanguageDialog = true
                },
            )
            SettingsContainerDivider()
            SettingsModernRow(
                icon = Icons.Outlined.Info,
                title = stringResource(R.string.settings_nav_version),
                trailing = {
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = MaterialTheme.colorScheme.surfaceContainerHigh.copy(alpha = 0.7f),
                    ) {
                        Text(
                            text = "v${BuildConfig.VERSION_NAME}",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                        )
                    }
                },
                onClick = {
                    app.updateManager.checkForUpdate(force = true)
                },
            )
        }

        Spacer(Modifier.height(24.dp))

        // SECTION 2: Интерфейс
        SettingsSectionHeader(title = stringResource(R.string.settings_interface_section))
        SettingsContainerCard {
            SettingsModernRow(
                icon = Icons.Outlined.AutoAwesome,
                title = stringResource(R.string.settings_nav_appearance),
                onClick = onOpenInterface,
            )
        }
    }
}

@Composable
private fun SettingsSectionHeader(title: String) {
    Text(
        text = title,
        style = MaterialTheme.typography.titleMedium,
        fontWeight = FontWeight.SemiBold,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(horizontal = 24.dp, vertical = 8.dp),
    )
}

@Composable
private fun SettingsContainerCard(
    content: @Composable ColumnScope.() -> Unit,
) {
    val isGlass = LocalLiquidGlass.current
    val spec = rememberGlassSpec()
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp)
            .then(if (isGlass) Modifier.votifyGlass(shape = RoundedCornerShape(22.dp), baseColor = MaterialTheme.colorScheme.surfaceContainer, spec = spec) else Modifier),
        shape = RoundedCornerShape(22.dp),
        color = if (isGlass) Color.Transparent else MaterialTheme.colorScheme.surfaceContainer,
        tonalElevation = 1.dp,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 4.dp),
            content = content,
        )
    }
}

@Composable
private fun SettingsContainerDivider() {
    HorizontalDivider(
        modifier = Modifier.padding(horizontal = 16.dp),
        thickness = 0.5.dp,
        color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.25f),
    )
}

@Composable
private fun SettingsModernRow(
    icon: ImageVector,
    title: String,
    trailing: @Composable (() -> Unit)? = null,
    onClick: () -> Unit,
) {
    val haptic = rememberVotifyHaptic()
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable {
                haptic()
                onClick()
            }
            .padding(horizontal = 16.dp, vertical = 13.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.85f),
            modifier = Modifier.size(22.dp),
        )
        Spacer(Modifier.width(16.dp))
        Text(
            text = title,
            style = MaterialTheme.typography.bodyLarge,
            fontWeight = FontWeight.Medium,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.weight(1f),
        )
        if (trailing != null) {
            trailing()
            Spacer(Modifier.width(8.dp))
        }
        Icon(
            imageVector = Icons.AutoMirrored.Outlined.KeyboardArrowRight,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f),
            modifier = Modifier.size(18.dp),
        )
    }
}

@Composable
private fun SettingsModernToggleRow(
    icon: ImageVector,
    title: String,
    checked: Boolean,
    onChange: (Boolean) -> Unit,
) {
    val haptic = rememberVotifyHaptic()
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable {
                haptic()
                onChange(!checked)
            }
            .padding(horizontal = 16.dp, vertical = 9.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.85f),
            modifier = Modifier.size(22.dp),
        )
        Spacer(Modifier.width(16.dp))
        Text(
            text = title,
            style = MaterialTheme.typography.bodyLarge,
            fontWeight = FontWeight.Medium,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.weight(1f),
        )
        Switch(
            checked = checked,
            onCheckedChange = {
                haptic()
                onChange(it)
            },
            colors = SwitchDefaults.colors(
                checkedThumbColor = MaterialTheme.colorScheme.primary,
                checkedTrackColor = MaterialTheme.colorScheme.primaryContainer,
            ),
        )
    }
}
