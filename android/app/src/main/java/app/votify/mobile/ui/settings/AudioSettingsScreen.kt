package app.votify.mobile.ui.settings

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Headphones
import androidx.compose.material.icons.outlined.MusicOff
import androidx.compose.material.icons.outlined.Speaker
import androidx.compose.material.icons.outlined.Timer
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.votify.mobile.R
import app.votify.mobile.data.AudioQuality

/** «Аудио»: качество, кэш, бесшовность, кроссфейд, нормализация, автоплей, очередь. */
@Composable
fun AudioSettingsScreen(
    viewModel: SettingsViewModel,
    contentPadding: PaddingValues,
    onBack: () -> Unit,
) {
    val prefs by viewModel.prefs.collectAsStateWithLifecycle()
    val settings by viewModel.settings.collectAsStateWithLifecycle()

    SettingsScaffold(stringResource(R.string.settings_audio), contentPadding, onBack) {
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(bottom = 24.dp)) {

            SettingsSectionLabel(stringResource(R.string.settings_audio))
            SettingsCard {
                SettingsToggleRow(
                    title = stringResource(R.string.settings_caching),
                    subtitle = stringResource(R.string.settings_caching_sub),
                    checked = prefs.caching,
                    onChange = { v -> viewModel.updatePrefs { it.copy(caching = v) } },
                )
                SettingsDivider()
                SettingsToggleRow(
                    title = stringResource(R.string.settings_crossfade),
                    subtitle = stringResource(R.string.settings_crossfade_sub),
                    checked = prefs.crossfade,
                    onChange = { v -> viewModel.updatePrefs { it.copy(crossfade = v) } },
                )
                // Длительность перехода видна только когда кроссфейд включён.
                if (prefs.crossfade) {
                    SettingsDivider()
                    SettingsSliderRow(
                        title = stringResource(R.string.crossfade_duration),
                        value = prefs.crossfadeSeconds.toFloat(),
                        range = 1f..12f,
                        unit = stringResource(R.string.seconds_unit),
                        onValueChange = { v -> viewModel.updatePrefs { it.copy(crossfadeSeconds = v.toInt()) } },
                    )
                }
                SettingsDivider()
                SettingsToggleRow(
                    title = stringResource(R.string.settings_normalization),
                    subtitle = stringResource(R.string.settings_normalization_sub),
                    checked = prefs.normalization,
                    onChange = { v -> viewModel.updatePrefs { it.copy(normalization = v) } },
                )
                SettingsDivider()
                SettingsValueRow(
                    title = stringResource(R.string.settings_on_notification),
                    subtitle = null,
                    value = onNotificationLabel(prefs.onNotification),
                    trailing = Icons.Outlined.Speaker,
                    options = listOf(
                        "duck" to stringResource(R.string.settings_on_notification_duck),
                        "pause" to stringResource(R.string.settings_on_notification_pause),
                        "continue" to stringResource(R.string.settings_on_notification_continue),
                    ),
                    onPick = { v -> viewModel.updatePrefs { it.copy(onNotification = v) } },
                )
            }

            SettingsSectionLabel(stringResource(R.string.settings_autoplay))
            SettingsCard {
                SettingsToggleRow(
                    title = stringResource(R.string.settings_autoplay),
                    subtitle = stringResource(R.string.settings_autoplay_sub),
                    checked = prefs.autoplay,
                    onChange = { v -> viewModel.updatePrefs { it.copy(autoplay = v) } },
                )
            }

            SettingsSectionLabel("Офлайн и экспорт")
            SettingsCard {
                SettingsToggleRow(
                    title = "Экспорт в файлы («Загрузки»)",
                    subtitle = "Сохранять в системные Загрузки (Scoped Storage) помимо внутреннего кэша",
                    checked = prefs.exportToDownloads,
                    onChange = { v -> viewModel.updatePrefs { it.copy(exportToDownloads = v) } },
                )
                SettingsDivider()
                SettingsValueRow(
                    title = "Формат скачивания",
                    subtitle = "Формат файлов при экспорте (теги и обложка вшиваются)",
                    value = when (prefs.downloadFormat) {
                        "ogg" -> "OGG (.ogg)"
                        "mp3" -> "MP3 (.mp3, 320k)"
                        "flac" -> "FLAC (.flac)"
                        else -> "Opus (.opus)"
                    },
                    trailing = Icons.Outlined.Speaker,
                    options = listOf(
                        "opus" to "Opus (.opus, приоритет качества)",
                        "ogg" to "OGG (.ogg Vorbis)",
                        "mp3" to "MP3 (.mp3, 320 kbps)",
                        "flac" to "FLAC (.flac lossless)",
                    ),
                    onPick = { v -> viewModel.updatePrefs { it.copy(downloadFormat = v) } },
                )
            }
        }
    }
}

@Composable
private fun qualityLabel(q: AudioQuality): String = stringResource(
    when (q) {
        AudioQuality.Low -> R.string.settings_quality_low
        AudioQuality.Medium -> R.string.settings_quality_medium
        AudioQuality.High -> R.string.settings_quality_high
    },
)

@Composable
private fun onNotificationLabel(v: String): String = stringResource(
    when (v) {
        "pause" -> R.string.settings_on_notification_pause
        "continue" -> R.string.settings_on_notification_continue
        else -> R.string.settings_on_notification_duck
    },
)
