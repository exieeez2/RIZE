package app.votify.mobile.ui.library

import android.content.ClipboardManager
import android.content.Context
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.tween
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
import androidx.compose.foundation.layout.offset
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
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.ContentPaste
import androidx.compose.material.icons.outlined.FolderOpen
import androidx.compose.material.icons.outlined.MusicNote
import androidx.compose.material.icons.outlined.Sync
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.votify.mobile.data.Track
import app.votify.mobile.data.local.PlaylistSummary
import app.votify.mobile.ui.components.Artwork
import app.votify.mobile.ui.components.pluralTracks
import app.votify.mobile.ui.components.pressBounce
import app.votify.mobile.ui.components.rememberVotifyHaptic

private const val PREVIEW_LIMIT = 25

private fun detectSourceLabel(url: String): String {
    val clean = url.trim().lowercase()
    return when {
        "spotify.com" in clean -> "SPOTIFY"
        "music.yandex" in clean || "yandex.ru" in clean -> "ЯНДЕКС"
        "youtube.com" in clean || "youtu.be" in clean -> "YOUTUBE"
        "soundcloud.com" in clean -> "SOUNDCLOUD"
        "apple.com" in clean -> "APPLE MUSIC"
        "deezer.com" in clean -> "DEEZER"
        "vk.com" in clean -> "VK"
        clean.startsWith("local:") -> "ФАЙЛЫ"
        clean.isNotEmpty() -> "URL"
        else -> "URL"
    }
}

@Composable
fun ImportScreen(
    viewModel: ImportViewModel,
    onBack: () -> Unit,
    contentPadding: PaddingValues = PaddingValues(0.dp),
    onOpenPlaylist: (Long) -> Unit = {},
    modifier: Modifier = Modifier,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val playlists by viewModel.playlists.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val haptic = rememberVotifyHaptic()

    LaunchedEffect(Unit) {
        viewModel.events.collect { event ->
            when (event) {
                is ImportEvent.Imported -> onOpenPlaylist(event.playlistId)
            }
        }
    }

    val filePickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenMultipleDocuments()
    ) { uris ->
        if (uris.isNotEmpty()) {
            haptic()
            viewModel.importLocalTracks(uris, context)
        }
    }

    val detectedSource = remember(state.url) { detectSourceLabel(state.url) }

    Surface(
        color = Color(0xFF000000),
        modifier = modifier.fillMaxSize(),
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
        ) {
            // Header
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    IconButton(
                        onClick = {
                            haptic()
                            onBack()
                        },
                        modifier = Modifier
                            .size(40.dp)
                            .clip(CircleShape)
                            .background(Color(0xFF0D0D0D)),
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Outlined.ArrowBack,
                            contentDescription = "Назад",
                            tint = Color.White,
                            modifier = Modifier.size(20.dp),
                        )
                    }
                    Text(
                        text = "Импорт медиатеки",
                        style = TextStyle(
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 20.sp,
                            color = Color.White,
                            letterSpacing = (-0.5).sp,
                        ),
                    )
                }

                // Dynamic Source Badge (Monochrome Pill)
                Surface(
                    shape = RoundedCornerShape(999.dp),
                    color = Color(0xFF080808),
                    border = BorderStroke(1.dp, Color(0xFF333333)),
                ) {
                    Text(
                        text = detectedSource,
                        style = TextStyle(
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Medium,
                            fontSize = 11.sp,
                            color = Color(0xFFD4D4D4),
                            letterSpacing = 1.sp,
                        ),
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                    )
                }
            }

            // Scrollable Content
            Column(
                modifier = Modifier
                    .weight(1f)
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 8.dp)
                    .padding(bottom = contentPadding.calculateBottomPadding() + 32.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                // 1. Main Minimalist Monochrome Card (matching ui.html)
                Surface(
                    shape = RoundedCornerShape(24.dp),
                    color = Color(0xFF050505),
                    border = BorderStroke(1.dp, Color(0xFF262626)),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(14.dp),
                    ) {
                        // URL Input Row
                        var isFocused by remember { mutableStateOf(false) }
                        Surface(
                            shape = RoundedCornerShape(16.dp),
                            color = Color.Black,
                            border = BorderStroke(
                                1.dp,
                                if (isFocused) Color.White else Color(0xFF383838),
                            ),
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 12.dp, vertical = 10.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                            ) {
                                BasicTextField(
                                    value = state.url,
                                    onValueChange = viewModel::onUrlChange,
                                    textStyle = TextStyle(
                                        fontFamily = FontFamily.Monospace,
                                        fontSize = 14.sp,
                                        color = Color.White,
                                    ),
                                    cursorBrush = SolidColor(Color.White),
                                    singleLine = true,
                                    modifier = Modifier
                                        .weight(1f)
                                        .onFocusChanged { isFocused = it.isFocused },
                                    decorationBox = { innerTextField ->
                                        if (state.url.isEmpty()) {
                                            Text(
                                                text = "https://...",
                                                style = TextStyle(
                                                    fontFamily = FontFamily.Monospace,
                                                    fontSize = 14.sp,
                                                    color = Color(0xFF525252),
                                                ),
                                            )
                                        }
                                        innerTextField()
                                    },
                                )

                                if (state.url.isNotEmpty()) {
                                    IconButton(
                                        onClick = {
                                            haptic()
                                            viewModel.clearUrl()
                                        },
                                        modifier = Modifier.size(28.dp),
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.Close,
                                            contentDescription = "Очистить",
                                            tint = Color(0xFF737373),
                                            modifier = Modifier.size(16.dp),
                                        )
                                    }
                                }

                                // Paste Button Pill
                                Surface(
                                    shape = RoundedCornerShape(11.dp),
                                    color = Color(0xFF0D0D0D),
                                    border = BorderStroke(1.dp, Color(0xFF404040)),
                                    modifier = Modifier
                                        
                                        .clickable {
                                            haptic()
                                            val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
                                            val clip = clipboard?.primaryClip?.getItemAt(0)?.text?.toString().orEmpty().trim()
                                            if (clip.isNotEmpty()) {
                                                viewModel.onUrlChange(clip)
                                            }
                                        },
                                ) {
                                    Row(
                                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                                    ) {
                                        Icon(
                                            imageVector = Icons.Outlined.ContentPaste,
                                            contentDescription = null,
                                            tint = Color(0xFFD4D4D4),
                                            modifier = Modifier.size(14.dp),
                                        )
                                        Text(
                                            text = "Вставить",
                                            style = TextStyle(
                                                fontSize = 12.sp,
                                                fontWeight = FontWeight.Medium,
                                                color = Color.White,
                                            ),
                                        )
                                    }
                                }
                            }
                        }

                        // Auto-Update Row with Minimalist Slide Switch
                        Surface(
                            shape = RoundedCornerShape(16.dp),
                            color = Color.Black,
                            border = BorderStroke(1.dp, Color(0xFF262626)),
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    haptic()
                                    viewModel.toggleAutoUpdate()
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
                                    Icon(
                                        imageVector = Icons.Outlined.Sync,
                                        contentDescription = null,
                                        tint = if (state.autoUpdate) Color.White else Color(0xFF737373),
                                        modifier = Modifier.size(20.dp),
                                    )
                                    Column {
                                        Text(
                                            text = "Автообновление",
                                            style = TextStyle(
                                                fontSize = 15.sp,
                                                fontWeight = FontWeight.Medium,
                                                color = Color.White,
                                            ),
                                        )
                                        Text(
                                            text = if (state.autoUpdate) "Синхронизация новых треков включена" else "Синхронизация новых треков выключена",
                                            style = TextStyle(
                                                fontSize = 11.sp,
                                                color = Color(0xFF737373),
                                            ),
                                        )
                                    }
                                }

                                // Custom Monochrome Switch
                                val thumbOffset by animateDpAsState(
                                    targetValue = if (state.autoUpdate) 22.dp else 2.dp,
                                    animationSpec = tween(durationMillis = 200),
                                    label = "switchThumbOffset",
                                )
                                Box(
                                    modifier = Modifier
                                        .size(width = 46.dp, height = 26.dp)
                                        .clip(RoundedCornerShape(999.dp))
                                        .background(if (state.autoUpdate) Color.White else Color(0xFF1E1E1E))
                                        .border(
                                            1.dp,
                                            if (state.autoUpdate) Color.White else Color(0xFF383838),
                                            RoundedCornerShape(999.dp),
                                        ),
                                    contentAlignment = Alignment.CenterStart,
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .offset(x = thumbOffset)
                                            .size(20.dp)
                                            .clip(CircleShape)
                                            .background(if (state.autoUpdate) Color.Black else Color.White)
                                    )
                                }
                            }
                        }

                        // High-Contrast Primary Import Button
                        Surface(
                            onClick = {
                                haptic()
                                viewModel.import()
                            },
                            enabled = state.url.isNotBlank() && !state.loading,
                            shape = RoundedCornerShape(16.dp),
                            color = if (state.url.isNotBlank() && !state.loading) Color.White else Color(0xFF1A1A1A),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(52.dp)
                                ,
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                if (state.loading) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                                    ) {
                                        CircularProgressIndicator(
                                            modifier = Modifier.size(18.dp),
                                            color = Color.Black,
                                            strokeWidth = 2.dp,
                                        )
                                        Text(
                                            text = "Синхронизация...",
                                            style = TextStyle(
                                                fontSize = 15.sp,
                                                fontWeight = FontWeight.SemiBold,
                                                color = Color.Black,
                                            ),
                                        )
                                    }
                                } else {
                                    Text(
                                        text = "Импортировать треки",
                                        style = TextStyle(
                                            fontSize = 15.sp,
                                            fontWeight = FontWeight.SemiBold,
                                            color = if (state.url.isNotBlank()) Color.Black else Color(0xFF666666),
                                        ),
                                    )
                                }
                            }
                        }

                        // Progress and Status Indicator
                        AnimatedVisibility(
                            visible = state.loading || state.statusMessage.isNotEmpty(),
                            enter = fadeIn(),
                            exit = fadeOut(),
                        ) {
                            Column(
                                modifier = Modifier.fillMaxWidth(),
                                verticalArrangement = Arrangement.spacedBy(6.dp),
                            ) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                ) {
                                    Text(
                                        text = state.statusMessage.ifBlank { "Синхронизация плейлиста..." },
                                        style = TextStyle(
                                            fontFamily = FontFamily.Monospace,
                                            fontSize = 11.sp,
                                            color = Color(0xFFA3A3A3),
                                        ),
                                    )
                                    Text(
                                        text = "${(state.progress * 100).toInt()}%",
                                        style = TextStyle(
                                            fontFamily = FontFamily.Monospace,
                                            fontSize = 11.sp,
                                            color = Color(0xFFA3A3A3),
                                        ),
                                    )
                                }
                                LinearProgressIndicator(
                                    progress = { state.progress },
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(4.dp)
                                        .clip(RoundedCornerShape(2.dp)),
                                    color = Color.White,
                                    trackColor = Color(0xFF1F1F1F),
                                )
                            }
                        }

                        // Error Message
                        AnimatedVisibility(
                            visible = state.error != null,
                            enter = fadeIn(),
                            exit = fadeOut(),
                        ) {
                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = Color(0xFF140808),
                                border = BorderStroke(1.dp, Color(0xFF401818)),
                                modifier = Modifier.fillMaxWidth(),
                            ) {
                                Text(
                                    text = state.error.orEmpty(),
                                    style = TextStyle(
                                        fontSize = 12.sp,
                                        color = Color(0xFFFF6B6B),
                                    ),
                                    modifier = Modifier.padding(12.dp),
                                )
                            }
                        }
                    }
                }

                // 2. Presets & Local Files Options
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        text = "ПРИМЕРЫ ССЫЛОК ДЛЯ ТЕСТА",
                        style = TextStyle(
                            fontFamily = FontFamily.Monospace,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Medium,
                            color = Color(0xFF737373),
                            letterSpacing = 0.8.sp,
                        ),
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        SampleChip(
                            label = "spotify.com/...",
                            url = "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
                            onSelect = viewModel::onUrlChange,
                            modifier = Modifier.weight(1f),
                        )
                        SampleChip(
                            label = "youtube.com/...",
                            url = "https://music.youtube.com/playlist?list=PL4fGSI1pDJn6puJdseH2Rt9sMvt9E2M4i",
                            onSelect = viewModel::onUrlChange,
                            modifier = Modifier.weight(1f),
                        )
                        SampleChip(
                            label = "soundcloud/...",
                            url = "https://soundcloud.com/discover/sets/charts-top:all-music",
                            onSelect = viewModel::onUrlChange,
                            modifier = Modifier.weight(1f),
                        )
                    }

                    // Local Audio Files Option
                    Surface(
                        shape = RoundedCornerShape(14.dp),
                        color = Color(0xFF080808),
                        border = BorderStroke(1.dp, Color(0xFF262626)),
                        modifier = Modifier
                            .fillMaxWidth()
                            
                            .clickable {
                                haptic()
                                filePickerLauncher.launch(
                                    arrayOf(
                                        "audio/*",
                                        "application/ogg",
                                        "application/x-flac",
                                    )
                                )
                            },
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                        ) {
                            Icon(
                                imageVector = Icons.Outlined.FolderOpen,
                                contentDescription = null,
                                tint = Color.White,
                                modifier = Modifier.size(18.dp),
                            )
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = "Выбрать локальные файлы на устройстве",
                                    style = TextStyle(
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.Medium,
                                        color = Color.White,
                                    ),
                                )
                                Text(
                                    text = ".mp3, .flac, .wav, .m4a с автоподбором обложек",
                                    style = TextStyle(
                                        fontSize = 11.sp,
                                        color = Color(0xFF737373),
                                    ),
                                )
                            }
                        }
                    }
                }

                // 3. Track Preview & Save to Library (When tracks are loaded)
                AnimatedVisibility(
                    visible = state.tracks.isNotEmpty(),
                    enter = fadeIn(),
                    exit = fadeOut(),
                ) {
                    Surface(
                        shape = RoundedCornerShape(20.dp),
                        color = Color(0xFF070707),
                        border = BorderStroke(1.dp, Color(0xFF262626)),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Column(
                            modifier = Modifier.padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Text(
                                    text = "ГОТОВО К СОХРАНЕНИЮ",
                                    style = TextStyle(
                                        fontFamily = FontFamily.Monospace,
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        color = Color(0xFFD4D4D4),
                                        letterSpacing = 1.sp,
                                    ),
                                )
                                Surface(
                                    shape = RoundedCornerShape(999.dp),
                                    color = Color.White,
                                ) {
                                    Text(
                                        text = "${state.tracks.size} треков",
                                        style = TextStyle(
                                            fontFamily = FontFamily.Monospace,
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = Color.Black,
                                        ),
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                                    )
                                }
                            }

                            // Editable Name Field
                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = Color.Black,
                                border = BorderStroke(1.dp, Color(0xFF333333)),
                                modifier = Modifier.fillMaxWidth(),
                            ) {
                                BasicTextField(
                                    value = state.name,
                                    onValueChange = viewModel::onNameChange,
                                    textStyle = TextStyle(
                                        fontSize = 14.sp,
                                        fontWeight = FontWeight.Medium,
                                        color = Color.White,
                                    ),
                                    cursorBrush = SolidColor(Color.White),
                                    singleLine = true,
                                    modifier = Modifier.padding(12.dp),
                                    decorationBox = { innerTextField ->
                                        if (state.name.isEmpty()) {
                                            Text(
                                                text = "Название плейлиста...",
                                                style = TextStyle(
                                                    fontSize = 14.sp,
                                                    color = Color(0xFF525252),
                                                ),
                                            )
                                        }
                                        innerTextField()
                                    },
                                )
                            }

                            // Preview items (up to PREVIEW_LIMIT)
                            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                state.tracks.take(PREVIEW_LIMIT).forEach { track ->
                                    PreviewTrackRow(track)
                                }
                                if (state.tracks.size > PREVIEW_LIMIT) {
                                    Text(
                                        text = "+ ещё ${state.tracks.size - PREVIEW_LIMIT} треков...",
                                        style = TextStyle(
                                            fontFamily = FontFamily.Monospace,
                                            fontSize = 11.sp,
                                            color = Color(0xFF737373),
                                        ),
                                        modifier = Modifier.padding(vertical = 4.dp),
                                    )
                                }
                            }

                            // Save Button
                            Surface(
                                onClick = {
                                    haptic()
                                    viewModel.saveToLibrary()
                                },
                                enabled = !state.saving,
                                shape = RoundedCornerShape(14.dp),
                                color = Color.White,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(48.dp)
                                    ,
                            ) {
                                Row(
                                    horizontalArrangement = Arrangement.Center,
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier.fillMaxSize(),
                                ) {
                                    Icon(
                                        imageVector = Icons.Outlined.Check,
                                        contentDescription = null,
                                        tint = Color.Black,
                                        modifier = Modifier.size(18.dp),
                                    )
                                    Spacer(Modifier.width(8.dp))
                                    Text(
                                        text = if (state.saving) "Сохранение..." else "Сохранить в медиатеку",
                                        style = TextStyle(
                                            fontSize = 14.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = Color.Black,
                                        ),
                                    )
                                }
                            }
                        }
                    }
                }

                // 4. Imported Playlists Section
                if (playlists.isNotEmpty()) {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                text = "ИМПОРТИРОВАНО",
                                style = TextStyle(
                                    fontFamily = FontFamily.Monospace,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Medium,
                                    color = Color(0xFF737373),
                                    letterSpacing = 0.8.sp,
                                ),
                            )
                            Text(
                                text = "${playlists.size}",
                                style = TextStyle(
                                    fontFamily = FontFamily.Monospace,
                                    fontSize = 11.sp,
                                    color = Color(0xFFD4D4D4),
                                ),
                            )
                        }

                        playlists.forEach { pl ->
                            Surface(
                                shape = RoundedCornerShape(16.dp),
                                color = Color(0xFF080808),
                                border = BorderStroke(1.dp, Color(0xFF262626)),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable {
                                        haptic()
                                        onOpenPlaylist(pl.id)
                                    },
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(12.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                                ) {
                                    Surface(
                                        shape = RoundedCornerShape(8.dp),
                                        color = Color(0xFF141414),
                                        border = BorderStroke(1.dp, Color(0xFF2E2E2E)),
                                        modifier = Modifier.size(40.dp),
                                    ) {
                                        Box(contentAlignment = Alignment.Center) {
                                            Icon(
                                                imageVector = Icons.Outlined.MusicNote,
                                                contentDescription = null,
                                                tint = Color.White,
                                                modifier = Modifier.size(20.dp),
                                            )
                                        }
                                    }

                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = pl.name,
                                            style = TextStyle(
                                                fontSize = 14.sp,
                                                fontWeight = FontWeight.SemiBold,
                                                color = Color.White,
                                            ),
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis,
                                        )
                                        Text(
                                            text = pluralTracks(pl.trackCount),
                                            style = TextStyle(
                                                fontFamily = FontFamily.Monospace,
                                                fontSize = 11.sp,
                                                color = Color(0xFF737373),
                                            ),
                                        )
                                    }

                                    IconButton(
                                        onClick = {
                                            haptic()
                                            viewModel.deletePlaylist(pl.id)
                                        },
                                        modifier = Modifier.size(32.dp),
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.Close,
                                            contentDescription = "Удалить",
                                            tint = Color(0xFF737373),
                                            modifier = Modifier.size(16.dp),
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
}

@Composable
private fun SampleChip(
    label: String,
    url: String,
    onSelect: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(
        shape = RoundedCornerShape(10.dp),
        color = Color(0xFF080808),
        border = BorderStroke(1.dp, Color(0xFF262626)),
        modifier = modifier
            
            .clickable { onSelect(url) },
    ) {
        Box(
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 8.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = label,
                style = TextStyle(
                    fontFamily = FontFamily.Monospace,
                    fontSize = 11.sp,
                    color = Color(0xFFA3A3A3),
                ),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

@Composable
private fun PreviewTrackRow(track: Track) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Artwork(
            url = track.cover,
            size = 38.dp,
            shape = RoundedCornerShape(8.dp),
            contentDescription = track.title,
            modifier = Modifier.size(38.dp),
        )
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = track.title,
                style = TextStyle(
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Color.White,
                ),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = track.artist.ifBlank { "Unknown Artist" },
                style = TextStyle(
                    fontSize = 11.5.sp,
                    color = Color(0xFF888888),
                ),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}
