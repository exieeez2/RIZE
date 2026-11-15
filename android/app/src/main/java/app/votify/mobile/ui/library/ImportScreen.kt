package app.votify.mobile.ui.library

import android.content.ClipboardManager
import android.content.Context
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.outlined.AudioFile
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.ContentPaste
import androidx.compose.material.icons.outlined.FolderOpen
import androidx.compose.material.icons.outlined.LibraryMusic
import androidx.compose.material.icons.outlined.Link
import androidx.compose.material.icons.outlined.MusicNote
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.votify.mobile.R
import app.votify.mobile.data.Track
import app.votify.mobile.ui.components.Artwork
import app.votify.mobile.ui.components.pluralTracks
import app.votify.mobile.ui.components.pressBounce
import app.votify.mobile.ui.components.rememberVotifyHaptic

private const val PREVIEW_LIMIT = 30

enum class ImportProvider(
    val label: String,
    val subtitle: String,
    val icon: ImageVector,
    val brandColor: Color,
    val placeholder: String,
) {
    SPOTIFY(
        label = "Spotify",
        subtitle = "Плейлисты, альбомы и треки",
        icon = Icons.Outlined.LibraryMusic,
        brandColor = Color(0xFF1DB954),
        placeholder = "https://open.spotify.com/playlist/...",
    ),
    YANDEX(
        label = "Яндекс Музыка",
        subtitle = "Плейлисты, альбомы или профиль",
        icon = Icons.Outlined.MusicNote,
        brandColor = Color(0xFFFFCC00),
        placeholder = "https://music.yandex.ru/users/.../playlists/...",
    ),
    YOUTUBE(
        label = "YouTube Music",
        subtitle = "Плейлисты, видео и альбомы",
        icon = Icons.Outlined.Link,
        brandColor = Color(0xFFFF0000),
        placeholder = "https://music.youtube.com/playlist?list=...",
    ),
    SOUNDCLOUD(
        label = "SoundCloud",
        subtitle = "Сеты, альбомы и треки",
        icon = Icons.Outlined.AudioFile,
        brandColor = Color(0xFFFF5500),
        placeholder = "https://soundcloud.com/artist/sets/...",
    ),
    LOCAL(
        label = "Свои файлы",
        subtitle = "MP3, FLAC, WAV, M4A",
        icon = Icons.Outlined.FolderOpen,
        brandColor = Color(0xFFA78BFA),
        placeholder = "Выбрать аудиофайлы на устройстве",
    ),
}

@Composable
fun ImportScreen(
    viewModel: ImportViewModel,
    contentPadding: PaddingValues,
    onBack: () -> Unit,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val haptic = rememberVotifyHaptic()
    var selectedProvider by remember { mutableStateOf(ImportProvider.SPOTIFY) }

    val localFilePicker = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenMultipleDocuments(),
    ) { uris ->
        if (!uris.isNullOrEmpty()) {
            viewModel.importLocalTracks(uris, context)
        }
    }

    val detectedProvider = remember(state.url, selectedProvider) {
        val u = state.url.lowercase().trim()
        when {
            "spotify" in u -> ImportProvider.SPOTIFY
            "yandex" in u -> ImportProvider.YANDEX
            "youtube" in u || "youtu.be" in u -> ImportProvider.YOUTUBE
            "soundcloud" in u -> ImportProvider.SOUNDCLOUD
            else -> selectedProvider
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF090A0D))
            .verticalScroll(rememberScrollState())
            .padding(
                top = 0.dp,
                bottom = contentPadding.calculateBottomPadding() + 28.dp,
            ),
    ) {
        // 1. Top Navigation Bar
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .statusBarsPadding()
                .padding(horizontal = 14.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Surface(
                onClick = onBack,
                shape = CircleShape,
                color = Color.White.copy(alpha = 0.08f),
                modifier = Modifier.size(40.dp),
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Outlined.ArrowBack,
                        contentDescription = stringResource(R.string.nav_back),
                        tint = Color.White,
                        modifier = Modifier.size(20.dp),
                    )
                }
            }
            Spacer(Modifier.width(14.dp))
            Text(
                text = "Импорт медиатеки",
                style = MaterialTheme.typography.titleLarge.copy(
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                ),
                color = Color.White,
            )
        }

        Spacer(Modifier.height(8.dp))

        // 2. Hero Typography Card
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 18.dp),
        ) {
            Text(
                text = "Перенесите плейлисты в один клик",
                style = MaterialTheme.typography.headlineMedium.copy(
                    fontSize = 24.sp,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = (-0.5).sp,
                ),
                color = Color.White,
            )
            Spacer(Modifier.height(4.dp))
            Text(
                text = "Вставьте ссылку на публичный плейлист, альбом или выберите локальные треки с устройства",
                style = MaterialTheme.typography.bodyMedium.copy(fontSize = 13.5.sp),
                color = Color.White.copy(alpha = 0.60f),
            )
        }

        Spacer(Modifier.height(18.dp))

        // 3. Supported Services Tiles (2-column grid layout)
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 18.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            val providers = ImportProvider.entries
            for (i in 0 until providers.size step 2) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    val p1 = providers[i]
                    val isP1Selected = (detectedProvider == p1)
                    ProviderTile(
                        provider = p1,
                        isSelected = isP1Selected,
                        modifier = Modifier.weight(1f),
                        onClick = {
                            haptic()
                            selectedProvider = p1
                            if (p1 == ImportProvider.LOCAL) {
                                localFilePicker.launch(arrayOf("audio/*", "application/ogg"))
                            }
                        },
                    )

                    if (i + 1 < providers.size) {
                        val p2 = providers[i + 1]
                        val isP2Selected = (detectedProvider == p2)
                        ProviderTile(
                            provider = p2,
                            isSelected = isP2Selected,
                            modifier = Modifier.weight(1f),
                            onClick = {
                                haptic()
                                selectedProvider = p2
                                if (p2 == ImportProvider.LOCAL) {
                                    localFilePicker.launch(arrayOf("audio/*", "application/ogg"))
                                }
                            },
                        )
                    } else {
                        Spacer(Modifier.weight(1f))
                    }
                }
            }
        }

        Spacer(Modifier.height(20.dp))

        // 4. Main Link Import Section
        Surface(
            shape = RoundedCornerShape(20.dp),
            color = Color(0xFF13151B),
            border = BorderStroke(1.dp, Color.White.copy(alpha = 0.08f)),
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 18.dp),
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(18.dp),
            ) {
                // Active Service Pill & Paste button
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Surface(
                        shape = RoundedCornerShape(10.dp),
                        color = detectedProvider.brandColor.copy(alpha = 0.16f),
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                        ) {
                            Icon(
                                imageVector = detectedProvider.icon,
                                contentDescription = null,
                                tint = detectedProvider.brandColor,
                                modifier = Modifier.size(15.dp),
                            )
                            Text(
                                text = detectedProvider.label,
                                style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.SemiBold),
                                color = detectedProvider.brandColor,
                            )
                        }
                    }

                    Surface(
                        onClick = {
                            val clipMgr = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
                            val clipText = clipMgr?.primaryClip?.getItemAt(0)?.text?.toString()?.trim()
                            if (!clipText.isNullOrBlank()) {
                                haptic()
                                viewModel.onUrlChange(clipText)
                            }
                        },
                        shape = RoundedCornerShape(10.dp),
                        color = Color.White.copy(alpha = 0.08f),
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(5.dp),
                        ) {
                            Icon(
                                imageVector = Icons.Outlined.ContentPaste,
                                contentDescription = "Вставить",
                                tint = Color.White,
                                modifier = Modifier.size(14.dp),
                            )
                            Text(
                                text = "Вставить",
                                style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Medium),
                                color = Color.White,
                            )
                        }
                    }
                }

                Spacer(Modifier.height(14.dp))

                // Modern Clean Input Field
                Surface(
                    shape = RoundedCornerShape(14.dp),
                    color = Color(0xFF1B1D24),
                    border = BorderStroke(1.dp, Color.White.copy(alpha = 0.12f)),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp),
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(horizontal = 14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Icon(
                            imageVector = Icons.Outlined.Link,
                            contentDescription = null,
                            tint = Color.White.copy(alpha = 0.45f),
                            modifier = Modifier.size(18.dp),
                        )
                        BasicTextField(
                            value = state.url,
                            onValueChange = viewModel::onUrlChange,
                            singleLine = true,
                            cursorBrush = SolidColor(Color.White),
                            textStyle = MaterialTheme.typography.bodyMedium.copy(
                                fontSize = 14.sp,
                                color = Color.White,
                            ),
                            modifier = Modifier.weight(1f),
                            decorationBox = { innerTextField ->
                                if (state.url.isEmpty()) {
                                    Text(
                                        text = detectedProvider.placeholder,
                                        style = MaterialTheme.typography.bodyMedium.copy(
                                            fontSize = 14.sp,
                                            color = Color.White.copy(alpha = 0.38f),
                                        ),
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                    )
                                }
                                innerTextField()
                            },
                        )
                        if (state.url.isNotEmpty()) {
                            IconButton(
                                onClick = { viewModel.onUrlChange("") },
                                modifier = Modifier.size(24.dp),
                            ) {
                                Icon(
                                    imageVector = Icons.Filled.Close,
                                    contentDescription = "Очистить",
                                    tint = Color.White.copy(alpha = 0.6f),
                                    modifier = Modifier.size(16.dp),
                                )
                            }
                        }
                    }
                }

                Spacer(Modifier.height(14.dp))

                // CTA Button (Primary White Pill)
                val canSubmit = state.url.isNotBlank() && !state.loading
                Surface(
                    onClick = {
                        if (canSubmit) {
                            haptic()
                            viewModel.import()
                        }
                    },
                    shape = RoundedCornerShape(24.dp),
                    color = if (canSubmit) Color.White else Color.White.copy(alpha = 0.12f),
                    contentColor = if (canSubmit) Color(0xFF0A0A0A) else Color.White.copy(alpha = 0.35f),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp),
                ) {
                    Row(
                        modifier = Modifier.fillMaxSize(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center,
                    ) {
                        if (state.loading) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(18.dp),
                                strokeWidth = 2.dp,
                                color = Color(0xFF0A0A0A),
                            )
                            Spacer(Modifier.width(10.dp))
                            Text(
                                text = "Поиск и извлечение треков…",
                                style = MaterialTheme.typography.titleMedium.copy(
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Bold,
                                ),
                                color = Color(0xFF0A0A0A),
                            )
                        } else {
                            Text(
                                text = "Импортировать треки",
                                style = MaterialTheme.typography.titleMedium.copy(
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.Bold,
                                ),
                            )
                        }
                    }
                }

                if (state.error != null) {
                    Spacer(Modifier.height(10.dp))
                    Text(
                        text = state.error ?: "",
                        style = MaterialTheme.typography.bodySmall.copy(fontSize = 12.5.sp),
                        color = Color(0xFFFF5252),
                        modifier = Modifier.fillMaxWidth(),
                        textAlign = TextAlign.Center,
                    )
                }
            }
        }

        // 5. Import Preview Results
        if (state.tracks.isNotEmpty()) {
            Spacer(Modifier.height(24.dp))

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 18.dp),
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(
                        text = "Готово к импорту",
                        style = MaterialTheme.typography.titleLarge.copy(
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold,
                        ),
                        color = Color.White,
                    )
                    Surface(
                        shape = RoundedCornerShape(10.dp),
                        color = Color(0xFF1DB954).copy(alpha = 0.18f),
                    ) {
                        Text(
                            text = pluralTracks(state.tracks.size),
                            style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                            color = Color(0xFF1DB954),
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
                        )
                    }
                }

                Spacer(Modifier.height(12.dp))

                Surface(
                    shape = RoundedCornerShape(20.dp),
                    color = Color(0xFF13151B),
                    border = BorderStroke(1.dp, Color.White.copy(alpha = 0.08f)),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(18.dp),
                    ) {
                        Text(
                            text = "Название плейлиста",
                            style = MaterialTheme.typography.labelSmall.copy(fontSize = 12.sp),
                            color = Color.White.copy(alpha = 0.55f),
                            modifier = Modifier.padding(bottom = 6.dp),
                        )

                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            color = Color(0xFF1B1D24),
                            border = BorderStroke(1.dp, Color.White.copy(alpha = 0.12f)),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(44.dp),
                        ) {
                            Box(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .padding(horizontal = 12.dp),
                                contentAlignment = Alignment.CenterStart,
                            ) {
                                BasicTextField(
                                    value = state.name,
                                    onValueChange = viewModel::onNameChange,
                                    singleLine = true,
                                    cursorBrush = SolidColor(Color.White),
                                    textStyle = MaterialTheme.typography.bodyMedium.copy(
                                        fontSize = 14.sp,
                                        color = Color.White,
                                        fontWeight = FontWeight.SemiBold,
                                    ),
                                    modifier = Modifier.fillMaxWidth(),
                                )
                            }
                        }

                        Spacer(Modifier.height(14.dp))

                        // Preview Rows
                        state.tracks.take(PREVIEW_LIMIT).forEachIndexed { index, track ->
                            PreviewTrackRow(track = track)
                            if (index != state.tracks.take(PREVIEW_LIMIT).lastIndex) {
                                HorizontalDivider(
                                    color = Color.White.copy(alpha = 0.06f),
                                    thickness = 0.5.dp,
                                    modifier = Modifier.padding(vertical = 4.dp),
                                )
                            }
                        }

                        if (state.tracks.size > PREVIEW_LIMIT) {
                            Text(
                                text = "и ещё ${state.tracks.size - PREVIEW_LIMIT} треков",
                                style = MaterialTheme.typography.bodySmall.copy(fontSize = 12.sp),
                                color = Color.White.copy(alpha = 0.5f),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 10.dp),
                                textAlign = TextAlign.Center,
                            )
                        }

                        Spacer(Modifier.height(14.dp))

                        // Save Button (Primary White Pill)
                        Surface(
                            onClick = {
                                haptic()
                                viewModel.saveToLibrary()
                            },
                            enabled = !state.saving,
                            shape = RoundedCornerShape(24.dp),
                            color = Color.White,
                            contentColor = Color(0xFF0A0A0A),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(48.dp),
                        ) {
                            Row(
                                modifier = Modifier.fillMaxSize(),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.Center,
                            ) {
                                if (state.saving) {
                                    CircularProgressIndicator(
                                        modifier = Modifier.size(18.dp),
                                        strokeWidth = 2.dp,
                                        color = Color(0xFF0A0A0A),
                                    )
                                    Spacer(Modifier.width(10.dp))
                                    Text(
                                        text = "Сохранение…",
                                        style = MaterialTheme.typography.titleMedium.copy(
                                            fontSize = 14.sp,
                                            fontWeight = FontWeight.Bold,
                                        ),
                                    )
                                } else {
                                    Icon(
                                        imageVector = Icons.Outlined.Check,
                                        contentDescription = null,
                                        tint = Color(0xFF0A0A0A),
                                        modifier = Modifier.size(18.dp),
                                    )
                                    Spacer(Modifier.width(8.dp))
                                    Text(
                                        text = "Сохранить в медиатеку",
                                        style = MaterialTheme.typography.titleMedium.copy(
                                            fontSize = 15.sp,
                                            fontWeight = FontWeight.Bold,
                                        ),
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ProviderTile(
    provider: ImportProvider,
    isSelected: Boolean,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(16.dp),
        color = if (isSelected) Color(0xFF1E212B) else Color(0xFF13151B),
        border = BorderStroke(
            width = if (isSelected) 1.dp else 0.5.dp,
            color = if (isSelected) provider.brandColor.copy(alpha = 0.5f) else Color.White.copy(alpha = 0.07f),
        ),
        modifier = modifier.height(72.dp),
    ) {
        Row(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Surface(
                shape = RoundedCornerShape(10.dp),
                color = provider.brandColor.copy(alpha = if (isSelected) 0.22f else 0.12f),
                modifier = Modifier.size(36.dp),
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = provider.icon,
                        contentDescription = null,
                        tint = provider.brandColor,
                        modifier = Modifier.size(20.dp),
                    )
                }
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = provider.label,
                    style = MaterialTheme.typography.bodyMedium.copy(
                        fontSize = 13.5.sp,
                        fontWeight = FontWeight.SemiBold,
                    ),
                    color = Color.White,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    text = provider.subtitle,
                    style = MaterialTheme.typography.bodySmall.copy(fontSize = 11.sp),
                    color = Color.White.copy(alpha = 0.45f),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

@Composable
private fun PreviewTrackRow(track: Track) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Artwork(
            url = track.cover,
            size = 40.dp,
            shape = RoundedCornerShape(8.dp),
            contentDescription = track.title,
            modifier = Modifier.size(40.dp),
        )
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = track.title,
                style = MaterialTheme.typography.bodyMedium.copy(
                    fontSize = 13.5.sp,
                    fontWeight = FontWeight.SemiBold,
                ),
                color = Color.White,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = track.artist.ifBlank { "Unknown Artist" },
                style = MaterialTheme.typography.bodySmall.copy(fontSize = 12.sp),
                color = Color.White.copy(alpha = 0.55f),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}
