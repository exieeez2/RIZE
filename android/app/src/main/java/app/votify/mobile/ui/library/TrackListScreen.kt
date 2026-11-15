package app.votify.mobile.ui.library

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Shuffle
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material.icons.outlined.MoreVert
import androidx.compose.material.icons.rounded.Pause
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.DeleteOutline
import androidx.compose.material.icons.outlined.Download
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.HideImage
import androidx.compose.material.icons.outlined.History
import androidx.compose.material.icons.outlined.Image
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.QueueMusic
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.outlined.MoreVert
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.runtime.remember
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import coil.compose.SubcomposeAsyncImage
import coil.imageLoader
import coil.request.ImageRequest
import androidx.core.graphics.drawable.toBitmap
import androidx.palette.graphics.Palette
import androidx.compose.ui.platform.LocalContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.votify.mobile.R
import app.votify.mobile.data.DownloadProgress
import app.votify.mobile.data.Track
import app.votify.mobile.ui.components.Artwork
import app.votify.mobile.ui.components.resolveCoverModel
import app.votify.mobile.ui.components.CircleIconButton
import app.votify.mobile.ui.components.ConfirmDialog
import app.votify.mobile.ui.components.PillChip
import app.votify.mobile.ui.components.PlaylistNameDialog
import app.votify.mobile.ui.components.TrackRow
import app.votify.mobile.ui.components.formatDuration
import app.votify.mobile.ui.components.pluralTracks
import app.votify.mobile.ui.components.pressBounce
import androidx.compose.foundation.interaction.MutableInteractionSource
import app.votify.mobile.ui.components.rememberVotifyHaptic
import app.votify.mobile.ui.theme.VotifyColors

/** Header shared by Favorites / History / Playlist / Artist screens. */
@Composable
fun CollectionHeader(
    title: String,
    subtitle: String,
    cover: String?,
    icon: ImageVector,
    tracks: List<Track>,
    onBack: () -> Unit,
    onPlay: (List<Track>, Int) -> Unit,
    /** «Перемешать»: включает режим перемешивания без повторов и запускает список. */
    onShufflePlay: (List<Track>) -> Unit = { list -> onPlay(list, 0) },
    trailing: (@Composable () -> Unit)? = null,
) {
    Column(Modifier.fillMaxWidth().padding(horizontal = 8.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Outlined.ArrowBack, stringResource(R.string.nav_back), tint = VotifyColors.TextPrimary)
            }
            Spacer(Modifier.weight(1f))
            trailing?.invoke()
        }
        Row(Modifier.padding(horizontal = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier
                    .size(96.dp)
                    .clip(RoundedCornerShape(20.dp))
                    .background(VotifyColors.SurfaceContainer)
                    .border(1.dp, VotifyColors.BorderSubtle, RoundedCornerShape(20.dp)),
                contentAlignment = Alignment.Center,
            ) {
                if (cover.isNullOrBlank()) {
                    Icon(icon, null, tint = VotifyColors.TextPrimary, modifier = Modifier.size(40.dp))
                } else {
                    Artwork(cover, size = 96.dp, shape = RoundedCornerShape(20.dp), modifier = Modifier.fillMaxSize())
                }
            }
            Spacer(Modifier.width(16.dp))
            Column(Modifier.weight(1f)) {
                Text(title, style = MaterialTheme.typography.headlineSmall, color = VotifyColors.TextPrimary, fontWeight = FontWeight.Bold, maxLines = 2, overflow = TextOverflow.Ellipsis)
                Spacer(Modifier.height(2.dp))
                Text(subtitle, style = MaterialTheme.typography.bodySmall, color = VotifyColors.TextMuted, maxLines = 2, overflow = TextOverflow.Ellipsis)
            }
        }
        Spacer(Modifier.height(16.dp))
        Row(Modifier.padding(horizontal = 8.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(
                onClick = { if (tracks.isNotEmpty()) onPlay(tracks, 0) },
                modifier = Modifier.size(48.dp),
            ) {
                Icon(
                    imageVector = Icons.Rounded.PlayArrow,
                    contentDescription = stringResource(R.string.action_play_all),
                    tint = Color(0xFFAAAAAA),
                    modifier = Modifier.size(40.dp),
                )
            }
            PillChip(
                text = stringResource(R.string.action_shuffle_all),
                selected = false,
                // Перемешивает и запускает список сам плеер — без повторов уже игравших.
                onClick = { if (tracks.isNotEmpty()) onShufflePlay(tracks) },
                leading = { Icon(Icons.Filled.Shuffle, null, tint = VotifyColors.TextPrimary, modifier = Modifier.size(16.dp)) },
            )
        }
        Spacer(Modifier.height(8.dp))
    }
}

@Composable
fun EmptyCollection(text: String, modifier: Modifier = Modifier) {
    Box(modifier.fillMaxWidth().padding(horizontal = 32.dp, vertical = 48.dp), contentAlignment = Alignment.Center) {
        Text(text, style = MaterialTheme.typography.bodyMedium, color = VotifyColors.TextMuted, textAlign = TextAlign.Center)
    }
}

@Composable
private fun TrackList(
    tracks: List<Track>,
    currentTrackId: String?,
    contentPadding: PaddingValues,
    emptyText: String,
    onPlay: (List<Track>, Int) -> Unit,
    onMore: (Track) -> Unit,
    header: @Composable () -> Unit,
    downloadedIds: Set<String> = emptySet(),
    downloadProgress: Map<String, DownloadProgress> = emptyMap(),
    listState: androidx.compose.foundation.lazy.LazyListState = androidx.compose.runtime.saveable.rememberSaveable(
        saver = androidx.compose.foundation.lazy.LazyListState.Saver
    ) {
        androidx.compose.foundation.lazy.LazyListState()
    },
) {
    LazyColumn(
        state = listState,
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(
            top = contentPadding.calculateTopPadding() + 4.dp,
            bottom = contentPadding.calculateBottomPadding() + 16.dp,
        ),
    ) {
        item(key = "header") { header() }
        if (tracks.isEmpty()) {
            item(key = "empty") { EmptyCollection(emptyText) }
        }
        itemsIndexed(
            items = tracks,
            key = { i, t -> "track_${t.id}_$i" },
            contentType = { _, _ -> "track" },
        ) { i, t ->
            NumberedPlaylistTrackRow(
                index = i + 1,
                track = t,
                isCurrent = t.id == currentTrackId,
                onClick = { onPlay(tracks, i) },
                onMore = { onMore(t) },
            )
        }
    }
}

@Composable
fun ModernCollectionScreen(
    title: String,
    rawTracks: List<Track>,
    coverUrl: String?,
    currentTrackId: String?,
    isPlaying: Boolean = false,
    contentPadding: PaddingValues,
    onBack: () -> Unit,
    onPlay: (List<Track>, Int) -> Unit,
    onShufflePlay: (List<Track>) -> Unit = { list -> onPlay(list, 0) },
    onTogglePlay: () -> Unit = {},
    downloadedIds: Set<String>,
    downloadProgress: Map<String, app.votify.mobile.data.DownloadProgress> = emptyMap(),
    favoriteIds: Set<String>,
    onToggleFavorite: (Track) -> Unit,
    onTrackMenu: (Track) -> Unit,
    onDownloadAll: (() -> Unit)? = null,
    trailingTopActions: (@Composable () -> Unit)? = null,
    emptyMessage: String = "Список пуст",
) {
    var searchQuery by rememberSaveable { mutableStateOf("") }
    var searchOpen by rememberSaveable { mutableStateOf(false) }
    val scrollState = rememberLazyListState()
    val isCurrentPlaylist = rawTracks.any { it.id == currentTrackId }

    val filteredTracks = remember(rawTracks, searchQuery) {
        if (searchQuery.isBlank()) rawTracks
        else {
            val q = searchQuery.trim().lowercase()
            rawTracks.filter { it.title.lowercase().contains(q) || it.artist.lowercase().contains(q) }
        }
    }

    val context = LocalContext.current
    var dominantColor by remember(coverUrl) { mutableStateOf<Color?>(null) }

    LaunchedEffect(coverUrl) {
        if (!coverUrl.isNullOrBlank()) {
            withContext(Dispatchers.IO) {
                try {
                    val loader = context.imageLoader
                    val req = ImageRequest.Builder(context).data(resolveCoverModel(coverUrl)).allowHardware(false).build()
                    val res = loader.execute(req)
                    val bmp = res.drawable?.toBitmap(24, 24)
                    if (bmp != null) {
                        val p = Palette.from(bmp).generate()
                        val c = p.darkMutedSwatch?.rgb ?: p.mutedSwatch?.rgb ?: p.dominantSwatch?.rgb
                        if (c != null) {
                            withContext(Dispatchers.Main) {
                                dominantColor = Color(c)
                            }
                        }
                    }
                } catch (_: Throwable) {}
            }
        }
    }

    val glowColor = dominantColor ?: Color(0xFF261D36)
    val coverAlpha by remember {
        derivedStateOf {
            if (scrollState.firstVisibleItemIndex > 0) 0f
            else (1f - (scrollState.firstVisibleItemScrollOffset / 380f)).coerceIn(0f, 1f)
        }
    }

    Box(
        Modifier
            .fillMaxSize()
            .background(VotifyColors.SurfaceBase)
    ) {
        // 1. Clean Filmic Top Ambient Background (rize(4).html .bg-glow: natural cover with filmic fade, no artificial colored tint)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(500.dp)
                .graphicsLayer {
                    alpha = coverAlpha
                    translationY = -scrollState.firstVisibleItemScrollOffset * 0.35f
                }
        ) {
            if (!coverUrl.isNullOrBlank()) {
                val bgModel = remember(coverUrl) { resolveCoverModel(coverUrl) }
                SubcomposeAsyncImage(
                    model = bgModel,
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier
                        .fillMaxSize()
                        .alpha(0.68f),
                )
            }
            val baseColor = VotifyColors.SurfaceBase
            val isDarkTheme = app.votify.mobile.ui.theme.LocalVotifyPalette.current.isDark
            val overlayStart = if (isDarkTheme) Color.Black.copy(alpha = 0.35f) else Color.White.copy(alpha = 0.05f)
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        Brush.verticalGradient(
                            0.0f to overlayStart,
                            0.45f to baseColor.copy(alpha = 0.60f),
                            0.82f to baseColor.copy(alpha = 0.94f),
                            1.0f to baseColor,
                        )
                    )
            )
        }

        // 2. Track List & Hero Content
        LazyColumn(
            state = scrollState,
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(
                top = 0.dp,
                bottom = contentPadding.calculateBottomPadding() + 20.dp,
            ),
        ) {
            item(key = "spacer_hero") {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .statusBarsPadding()
                        .padding(horizontal = 16.dp)
                ) {
                    Spacer(Modifier.height(56.dp))
                    Spacer(Modifier.height(145.dp))

                    // Hero Typography
                    Text(
                        text = title.ifBlank { "Плейлист" },
                        style = MaterialTheme.typography.headlineLarge.copy(
                            fontSize = 36.sp,
                            fontWeight = FontWeight.ExtraBold,
                            letterSpacing = (-1.2).sp,
                            lineHeight = 38.sp,
                        ),
                        color = VotifyColors.TextPrimary,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )

                    Spacer(Modifier.height(6.dp))

                    Text(
                        text = "Плейлист • ${pluralTracks(rawTracks.size)}",
                        style = MaterialTheme.typography.bodyMedium.copy(fontSize = 13.sp),
                        color = VotifyColors.TextMuted,
                    )

                    Spacer(Modifier.height(16.dp))

                    // Action Row
                    val playSource = remember { MutableInteractionSource() }
                    val shuffleSource = remember { MutableInteractionSource() }
                    val downloadSource = remember { MutableInteractionSource() }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        Surface(
                            onClick = {
                                if (rawTracks.isNotEmpty()) {
                                    if (isCurrentPlaylist) {
                                        onTogglePlay()
                                    } else {
                                        onPlay(rawTracks, 0)
                                    }
                                }
                            },
                            interactionSource = playSource,
                            shape = RoundedCornerShape(23.dp),
                            color = MaterialTheme.colorScheme.onSurface,
                            contentColor = MaterialTheme.colorScheme.surface,
                            modifier = Modifier
                                .weight(1f)
                                .height(46.dp)
                                .pressBounce(playSource, pressedScale = 0.94f),
                        ) {
                            Row(
                                modifier = Modifier.fillMaxSize(),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.Center,
                            ) {
                                val isCurrentlyPlaying = isPlaying && isCurrentPlaylist
                                Icon(
                                    imageVector = if (isCurrentlyPlaying) Icons.Filled.Pause else Icons.Filled.PlayArrow,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.surface,
                                    modifier = Modifier.size(17.dp),
                                )
                                Spacer(Modifier.width(8.dp))
                                Text(
                                    text = if (isCurrentlyPlaying) "Пауза" else "Играть",
                                    style = MaterialTheme.typography.titleMedium.copy(
                                        fontSize = 15.sp,
                                        fontWeight = FontWeight.Bold,
                                    ),
                                    color = MaterialTheme.colorScheme.surface,
                                )
                            }
                        }

                        Surface(
                            onClick = {
                                if (rawTracks.isNotEmpty()) onShufflePlay(rawTracks)
                            },
                            interactionSource = shuffleSource,
                            shape = CircleShape,
                            color = MaterialTheme.colorScheme.surfaceContainerHigh,
                            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.25f)),
                            modifier = Modifier
                                .size(46.dp)
                                .pressBounce(shuffleSource, pressedScale = 0.88f),
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(
                                    imageVector = Icons.Filled.Shuffle,
                                    contentDescription = "Перемешать",
                                    tint = VotifyColors.TextPrimary,
                                    modifier = Modifier.size(19.dp),
                                )
                            }
                        }

                        val isAnyDownloading = rawTracks.any { it.id in downloadProgress }
                        val isAllDownloaded = rawTracks.isNotEmpty() && rawTracks.all { it.id in downloadedIds }
                        Surface(
                            onClick = {
                                if (rawTracks.isNotEmpty() && onDownloadAll != null && !isAnyDownloading) {
                                    onDownloadAll()
                                }
                            },
                            interactionSource = downloadSource,
                            shape = CircleShape,
                            color = if (isAllDownloaded) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.surfaceContainerHigh,
                            border = BorderStroke(1.dp, if (isAllDownloaded) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.25f)),
                            modifier = Modifier
                                .size(46.dp)
                                .pressBounce(downloadSource, pressedScale = 0.88f),
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                if (isAnyDownloading) {
                                    androidx.compose.material3.CircularProgressIndicator(
                                        modifier = Modifier.size(20.dp),
                                        strokeWidth = 2.2.dp,
                                        color = VotifyColors.TextPrimary,
                                    )
                                } else {
                                    Icon(
                                        imageVector = if (isAllDownloaded) Icons.Filled.Check else Icons.Outlined.Download,
                                        contentDescription = "Скачать",
                                        tint = if (isAllDownloaded) MaterialTheme.colorScheme.surface else VotifyColors.TextPrimary,
                                        modifier = Modifier.size(20.dp),
                                    )
                                }
                            }
                        }
                    }

                    if (rawTracks.any { it.id in downloadProgress }) {
                        val downloadedInColl = rawTracks.count { it.id in downloadedIds }
                        val pct = if (rawTracks.isEmpty()) 0 else (downloadedInColl * 100 / rawTracks.size)
                        Spacer(Modifier.height(12.dp))
                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            color = MaterialTheme.colorScheme.surfaceContainerHigh,
                            border = BorderStroke(0.5.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.25f)),
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 14.dp, vertical = 10.dp),
                                verticalArrangement = Arrangement.spacedBy(8.dp),
                            ) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                                    ) {
                                        androidx.compose.material3.CircularProgressIndicator(
                                            modifier = Modifier.size(13.dp),
                                            strokeWidth = 1.8.dp,
                                            color = VotifyColors.TextPrimary,
                                        )
                                        Text(
                                            text = "Загрузка: $downloadedInColl из ${rawTracks.size} треков",
                                            style = MaterialTheme.typography.bodySmall.copy(
                                                fontSize = 13.sp,
                                                fontWeight = FontWeight.Medium,
                                            ),
                                            color = VotifyColors.TextPrimary,
                                        )
                                    }
                                    Text(
                                        text = "$pct%",
                                        style = MaterialTheme.typography.bodySmall.copy(
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.SemiBold,
                                        ),
                                        color = VotifyColors.TextMuted,
                                    )
                                }
                                androidx.compose.material3.LinearProgressIndicator(
                                    progress = { if (rawTracks.isEmpty()) 0f else (downloadedInColl.toFloat() / rawTracks.size) },
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(3.dp)
                                        .clip(RoundedCornerShape(2.dp)),
                                    color = VotifyColors.TextPrimary,
                                    trackColor = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.2f),
                                )
                            }
                        }
                    }

                    Spacer(Modifier.height(14.dp))

                    if (searchOpen) {
                        Surface(
                            shape = RoundedCornerShape(14.dp),
                            color = MaterialTheme.colorScheme.surfaceContainerHigh,
                            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.25f)),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(44.dp),
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .padding(horizontal = 12.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Icon(
                                    imageVector = Icons.Outlined.Search,
                                    contentDescription = null,
                                    tint = VotifyColors.TextMuted,
                                    modifier = Modifier.size(18.dp),
                                )
                                Spacer(Modifier.width(8.dp))
                                BasicTextField(
                                    value = searchQuery,
                                    onValueChange = { searchQuery = it },
                                    singleLine = true,
                                    textStyle = MaterialTheme.typography.bodyMedium.copy(
                                        color = VotifyColors.TextPrimary,
                                        fontSize = 14.sp,
                                    ),
                                    modifier = Modifier.weight(1f),
                                    decorationBox = { innerTextField ->
                                        if (searchQuery.isEmpty()) {
                                            Text(
                                                text = "Найти трек или артиста...",
                                                style = MaterialTheme.typography.bodyMedium.copy(
                                                    color = VotifyColors.TextMuted,
                                                    fontSize = 14.sp,
                                                ),
                                            )
                                        }
                                        innerTextField()
                                    },
                                )
                                if (searchQuery.isNotEmpty()) {
                                    IconButton(
                                        onClick = { searchQuery = "" },
                                        modifier = Modifier.size(28.dp),
                                    ) {
                                        Icon(
                                            imageVector = Icons.Filled.Close,
                                            contentDescription = "Очистить",
                                            tint = VotifyColors.TextMuted,
                                            modifier = Modifier.size(16.dp),
                                        )
                                    }
                                }
                            }
                        }
                        Spacer(Modifier.height(10.dp))
                    }
                }
            }

            if (filteredTracks.isEmpty()) {
                item(key = "empty") {
                    EmptyCollection(
                        if (searchQuery.isNotEmpty()) "Ничего не найдено"
                        else emptyMessage
                    )
                }
            }

            itemsIndexed(
                items = filteredTracks,
                key = { i, t -> "col_track_${t.id}_$i" },
                contentType = { _, _ -> "track" },
            ) { i, t ->
                NumberedPlaylistTrackRow(
                    index = i + 1,
                    track = t,
                    isCurrent = t.id == currentTrackId,
                    onClick = { onPlay(filteredTracks, i) },
                    onMore = { onTrackMenu(t) },
                    isFavorite = favoriteIds.contains(t.id),
                    onToggleFavorite = { onToggleFavorite(t) },
                    isDownloaded = t.id in downloadedIds,
                    isDownloading = t.id in downloadProgress,
                )
            }
        }

        // Fixed Top Bar
        Row(
            modifier = Modifier
                .align(Alignment.TopCenter)
                .fillMaxWidth()
                .statusBarsPadding()
                .height(56.dp)
                .padding(horizontal = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Surface(
                    onClick = onBack,
                    shape = CircleShape,
                    color = Color.Transparent,
                    modifier = Modifier.size(40.dp),
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Outlined.ArrowBack,
                            contentDescription = stringResource(R.string.nav_back),
                            tint = Color.White,
                            modifier = Modifier.size(22.dp),
                        )
                    }
                }

                Text(
                    text = "ПЛЕЙЛИСТ",
                    style = MaterialTheme.typography.labelSmall.copy(
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        letterSpacing = 3.sp,
                    ),
                    color = Color.White.copy(alpha = 0.78f),
                )
            }

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Surface(
                    onClick = { searchOpen = !searchOpen },
                    shape = CircleShape,
                    color = if (searchOpen) Color.White.copy(alpha = 0.16f) else Color.Transparent,
                    modifier = Modifier.size(40.dp),
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            imageVector = Icons.Outlined.Search,
                            contentDescription = "Поиск",
                            tint = Color.White,
                            modifier = Modifier.size(21.dp),
                        )
                    }
                }
                trailingTopActions?.invoke()
            }
        }
    }
}

@Composable
fun FavoritesScreen(
    viewModel: LibraryViewModel,
    currentTrackId: String?,
    isPlaying: Boolean = false,
    onTogglePlay: () -> Unit = {},
    contentPadding: PaddingValues,
    onBack: () -> Unit,
    onPlay: (List<Track>, Int) -> Unit,
    onShufflePlay: (List<Track>) -> Unit = { list -> onPlay(list, 0) },
) {
    val favorites by viewModel.favorites.collectAsStateWithLifecycle()
    val downloadedIds by viewModel.downloadedIds.collectAsStateWithLifecycle()
    val downloadProgress by viewModel.downloadProgress.collectAsStateWithLifecycle()
    val favoriteIds by viewModel.favoriteIds.collectAsStateWithLifecycle()
    val coverUrl = favorites.firstOrNull { it.cover.isNotBlank() }?.cover

    ModernCollectionScreen(
        title = stringResource(R.string.library_favorites),
        rawTracks = favorites,
        coverUrl = coverUrl,
        currentTrackId = currentTrackId,
        isPlaying = isPlaying,
        contentPadding = contentPadding,
        onBack = onBack,
        onPlay = onPlay,
        onShufflePlay = onShufflePlay,
        onTogglePlay = onTogglePlay,
        downloadedIds = downloadedIds,
        downloadProgress = downloadProgress,
        favoriteIds = favoriteIds,
        onToggleFavorite = { viewModel.toggleFavorite(it) },
        onTrackMenu = { viewModel.openMenu(it) },
        onDownloadAll = {
            viewModel.downloadPlaylist(favorites)
        },
        emptyMessage = stringResource(R.string.library_favorites_empty),
    )
}

@Composable
fun DownloadedScreen(
    viewModel: LibraryViewModel,
    currentTrackId: String?,
    isPlaying: Boolean = false,
    onTogglePlay: () -> Unit = {},
    contentPadding: PaddingValues,
    onBack: () -> Unit,
    onPlay: (List<Track>, Int) -> Unit,
    onShufflePlay: (List<Track>) -> Unit = { list -> onPlay(list, 0) },
    onOpenArtist: (String) -> Unit = {},
) {
    val downloadedTracks by viewModel.downloadedTracks.collectAsStateWithLifecycle()
    val downloadedIds by viewModel.downloadedIds.collectAsStateWithLifecycle()
    val downloadProgress by viewModel.downloadProgress.collectAsStateWithLifecycle()
    val favoriteIds by viewModel.favoriteIds.collectAsStateWithLifecycle()
    val coverUrl = downloadedTracks.firstOrNull { it.cover.isNotBlank() }?.cover

    ModernCollectionScreen(
        title = "Скачанные",
        rawTracks = downloadedTracks,
        coverUrl = coverUrl,
        currentTrackId = currentTrackId,
        isPlaying = isPlaying,
        contentPadding = contentPadding,
        onBack = onBack,
        onPlay = onPlay,
        onShufflePlay = onShufflePlay,
        onTogglePlay = onTogglePlay,
        downloadedIds = downloadedIds,
        downloadProgress = downloadProgress,
        favoriteIds = favoriteIds,
        onToggleFavorite = { viewModel.toggleFavorite(it) },
        onTrackMenu = { viewModel.openMenu(it) },
        onDownloadAll = null,
        emptyMessage = "Нет скачанных треков для офлайна",
    )
}

@Composable
fun HistoryScreen(
    viewModel: LibraryViewModel,
    currentTrackId: String?,
    contentPadding: PaddingValues,
    onBack: () -> Unit,
    onPlay: (List<Track>, Int) -> Unit,
    onShufflePlay: (List<Track>) -> Unit = { list -> onPlay(list, 0) },
) {
    val recent by viewModel.recent.collectAsStateWithLifecycle()
    val downloadedIds by viewModel.downloadedIds.collectAsStateWithLifecycle()
    val downloadProgress by viewModel.downloadProgress.collectAsStateWithLifecycle()
    var confirmClear by rememberSaveable { mutableStateOf(false) }

    TrackList(
        tracks = recent,
        currentTrackId = currentTrackId,
        contentPadding = contentPadding,
        emptyText = stringResource(R.string.library_history_empty),
        onPlay = onPlay,
        onMore = { viewModel.openMenu(it) },
        downloadedIds = downloadedIds,
        downloadProgress = downloadProgress,
        header = {
            CollectionHeader(
                title = stringResource(R.string.library_history),
                subtitle = pluralTracks(recent.size),
                cover = recent.firstOrNull()?.cover,
                icon = Icons.Outlined.History,
                tracks = recent,
                onBack = onBack,
                onPlay = onPlay,
                onShufflePlay = onShufflePlay,
                trailing = {
                    if (recent.isNotEmpty()) {
                        IconButton(onClick = { confirmClear = true }) {
                            Icon(Icons.Outlined.DeleteOutline, stringResource(R.string.library_history_clear), tint = VotifyColors.TextSecondary)
                        }
                    }
                },
            )
        },
    )

    if (confirmClear) {
        ConfirmDialog(
            text = stringResource(R.string.dialog_clear_history),
            confirm = stringResource(R.string.action_delete),
            onDismiss = { confirmClear = false },
            onConfirm = {
                confirmClear = false
                viewModel.clearHistory()
            },
        )
    }
}

@Composable
fun NumberedPlaylistTrackRow(
    index: Int,
    track: Track,
    isCurrent: Boolean,
    onClick: () -> Unit,
    onMore: (() -> Unit)? = null,
    isFavorite: Boolean = false,
    onToggleFavorite: (() -> Unit)? = null,
    isDownloaded: Boolean = false,
    isDownloading: Boolean = false,
) {
    val haptic = rememberVotifyHaptic()
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .clickable {
                haptic()
                onClick()
            }
            .padding(horizontal = 14.dp, vertical = 7.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // Thumbnail (50dp x 50dp, rounded 12dp) with playing overlay if active
        Box(
            modifier = Modifier
                .size(50.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(MaterialTheme.colorScheme.surfaceContainerHigh),
            contentAlignment = Alignment.Center,
        ) {
            Artwork(
                url = track.cover,
                size = 50.dp,
                shape = RoundedCornerShape(12.dp),
                contentDescription = track.title,
                modifier = Modifier.fillMaxSize(),
            )
            if (isCurrent) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color.Black.copy(alpha = 0.45f)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = Icons.Filled.PlayArrow,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(20.dp),
                    )
                }
            }
        }

        // Title and artist
        Column(
            modifier = Modifier
                .weight(1f)
                .padding(end = 4.dp),
        ) {
            Text(
                text = track.title,
                style = MaterialTheme.typography.bodyLarge.copy(
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                ),
                color = VotifyColors.TextPrimary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Spacer(Modifier.height(2.dp))
            Text(
                text = track.artist.ifBlank { "Unknown Artist" },
                style = MaterialTheme.typography.bodySmall.copy(
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Normal,
                ),
                color = VotifyColors.TextMuted,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }

        // Download status (loading spinner or minimal offline badge)
        if (isDownloading) {
            androidx.compose.material3.CircularProgressIndicator(
                modifier = Modifier.size(13.dp),
                strokeWidth = 1.6.dp,
                color = VotifyColors.TextPrimary,
            )
        } else if (isDownloaded) {
            Icon(
                painter = painterResource(R.drawable.ic_offline),
                contentDescription = "Скачано",
                tint = VotifyColors.TextMuted,
                modifier = Modifier.size(14.dp),
            )
        }

        // Duration (12sp, tabular nums)
        if (track.duration > 0) {
            Text(
                text = formatDuration(track.duration * 1000L),
                style = MaterialTheme.typography.bodySmall.copy(
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Normal,
                ),
                color = VotifyColors.TextMuted,
            )
        }

        // Like button
        if (onToggleFavorite != null) {
            IconButton(
                onClick = {
                    haptic()
                    onToggleFavorite()
                },
                modifier = Modifier.size(36.dp),
            ) {
                Icon(
                    imageVector = if (isFavorite) Icons.Filled.Favorite else Icons.Outlined.FavoriteBorder,
                    contentDescription = "Нравится",
                    tint = if (isFavorite) Color(0xFFFF3B5C) else VotifyColors.TextMuted,
                    modifier = Modifier.size(18.dp),
                )
            }
        }

        // More button
        if (onMore != null) {
            IconButton(
                onClick = {
                    haptic()
                    onMore()
                },
                modifier = Modifier.size(36.dp),
            ) {
                Icon(
                    imageVector = Icons.Outlined.MoreVert,
                    contentDescription = "Опции",
                    tint = VotifyColors.TextMuted,
                    modifier = Modifier.size(18.dp),
                )
            }
        }
    }
}

/**
 * Modern Playlist Detail Header matching Screenshot 5.
 * Perspective cover, soft shadow, large title, creator pill, blue "▶ Слушать" pill, shuffle & add.
 */
@Composable
fun ModernPlaylistHeader(
    title: String,
    author: String? = null,
    tracks: List<Track>,
    coverUrl: String?,
    isPlaying: Boolean,
    isCurrentPlaylist: Boolean,
    topPadding: androidx.compose.ui.unit.Dp,
    onBack: () -> Unit,
    onPlayAll: () -> Unit,
    onShuffle: () -> Unit,
    isFavorite: Boolean = false,
    onToggleFavorite: (() -> Unit)? = null,
    onMore: (() -> Unit)? = null,
    onAdd: (() -> Unit)? = null,
    trailingActions: @Composable () -> Unit = {},
) {
    val haptic = rememberVotifyHaptic()

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = topPadding + 4.dp, bottom = 16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        // 1. Top bar: Circular frosted back button `<` on left, trailingActions on right
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Surface(
                onClick = {
                    haptic()
                    onBack()
                },
                shape = CircleShape,
                color = Color.White.copy(alpha = 0.12f),
                border = BorderStroke(0.6.dp, Color.White.copy(alpha = 0.18f)),
                modifier = Modifier.size(46.dp),
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

            trailingActions()
        }

        Spacer(Modifier.height(16.dp))

        // 2. Centered Cover Artwork with perspective / soft shadow
        Surface(
            shape = RoundedCornerShape(14.dp),
            shadowElevation = 24.dp,
            color = Color(0xFF1E2028),
            modifier = Modifier
                .size(210.dp)
                .clickable {
                    haptic()
                    onPlayAll()
                },
        ) {
            if (!coverUrl.isNullOrBlank()) {
                SubcomposeAsyncImage(
                    model = coverUrl,
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
                )
            } else {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = Icons.Outlined.QueueMusic,
                        contentDescription = null,
                        tint = Color.White.copy(alpha = 0.4f),
                        modifier = Modifier.size(72.dp),
                    )
                }
            }
        }

        Spacer(Modifier.height(20.dp))

        // 3. Title: Large Bold Playlist Title (e.g. "Подарок")
        Text(
            text = title.ifBlank { "Плейлист" },
            style = MaterialTheme.typography.headlineMedium.copy(
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold,
            ),
            color = Color.White,
            textAlign = TextAlign.Center,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(horizontal = 24.dp),
        )

        Spacer(Modifier.height(6.dp))

        // 4. Author Row: Small Avatar + Author Name
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center,
            modifier = Modifier.padding(horizontal = 24.dp),
        ) {
            Surface(
                shape = CircleShape,
                color = Color(0xFF2E303A),
                modifier = Modifier.size(22.dp),
            ) {
                if (!coverUrl.isNullOrBlank()) {
                    SubcomposeAsyncImage(
                        model = coverUrl,
                        contentDescription = null,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize(),
                    )
                } else {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            Icons.Outlined.Person,
                            contentDescription = null,
                            tint = Color.White.copy(alpha = 0.6f),
                            modifier = Modifier.size(14.dp),
                        )
                    }
                }
            }
            Spacer(Modifier.width(8.dp))
            val authorDisplay = author?.takeIf { it.isNotBlank() } ?: tracks.firstOrNull()?.artist ?: "Votify"
            Text(
                text = authorDisplay,
                style = MaterialTheme.typography.bodyMedium.copy(
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Medium,
                ),
                color = Color.White.copy(alpha = 0.8f),
            )
        }

        Spacer(Modifier.height(22.dp))

        // 5. Action Row: Large Blue "▶ Слушать" Pill + Circular Shuffle + Circular Plus
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            // Blue Play Pill (▶ Слушать)
            Surface(
                onClick = {
                    haptic()
                    onPlayAll()
                },
                shape = RoundedCornerShape(26.dp),
                color = Color(0xFF4C8DFF), // Flagship Blue
                modifier = Modifier
                    .weight(1f)
                    .height(52.dp),
            ) {
                Row(
                    modifier = Modifier.fillMaxSize(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.Center,
                ) {
                    Icon(
                        imageVector = if (isPlaying && isCurrentPlaylist) Icons.Filled.Pause else Icons.Filled.PlayArrow,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(24.dp),
                    )
                    Spacer(Modifier.width(8.dp))
                    Text(
                        text = if (isPlaying && isCurrentPlaylist) "Пауза" else "Слушать",
                        style = MaterialTheme.typography.titleMedium.copy(
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                        ),
                        color = Color.White,
                    )
                }
            }

            // Circular Shuffle Button
            Surface(
                onClick = {
                    haptic()
                    onShuffle()
                },
                shape = CircleShape,
                color = Color.White.copy(alpha = 0.12f),
                border = BorderStroke(0.6.dp, Color.White.copy(alpha = 0.18f)),
                modifier = Modifier.size(50.dp),
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = Icons.Filled.Shuffle,
                        contentDescription = "Перемешать",
                        tint = Color.White,
                        modifier = Modifier.size(22.dp),
                    )
                }
            }

            // Circular Heart / Favorite Button
            Surface(
                onClick = {
                    haptic()
                    onToggleFavorite?.invoke()
                },
                shape = CircleShape,
                color = if (isFavorite) Color(0xFFFF3B5C).copy(alpha = 0.20f) else Color.White.copy(alpha = 0.12f),
                border = BorderStroke(0.6.dp, if (isFavorite) Color(0xFFFF3B5C).copy(alpha = 0.40f) else Color.White.copy(alpha = 0.18f)),
                modifier = Modifier.size(50.dp),
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = if (isFavorite) Icons.Filled.Favorite else Icons.Outlined.FavoriteBorder,
                        contentDescription = "В избранное",
                        tint = if (isFavorite) Color(0xFFFF3B5C) else Color.White,
                        modifier = Modifier.size(22.dp),
                    )
                }
            }

            // Circular 3-Dots / Options Menu Button
            Surface(
                onClick = {
                    haptic()
                    onMore?.invoke() ?: onAdd?.invoke()
                },
                shape = CircleShape,
                color = Color.White.copy(alpha = 0.12f),
                border = BorderStroke(0.6.dp, Color.White.copy(alpha = 0.18f)),
                modifier = Modifier.size(50.dp),
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = Icons.Outlined.MoreVert,
                        contentDescription = "Опции",
                        tint = Color.White,
                        modifier = Modifier.size(22.dp),
                    )
                }
            }
        }
    }
}

/** Backward-compatible alias for PlaylistVinylHeader */
@Composable
fun PlaylistVinylHeader(
    title: String,
    tracks: List<Track>,
    coverUrl: String?,
    isPlaying: Boolean,
    isCurrentPlaylist: Boolean,
    topPadding: androidx.compose.ui.unit.Dp,
    onBack: () -> Unit,
    onPlayAll: () -> Unit,
    onShuffle: () -> Unit,
    isFavorite: Boolean = false,
    onToggleFavorite: (() -> Unit)? = null,
    onMore: (() -> Unit)? = null,
    onDownloadAll: (() -> Unit)? = null,
    trailingActions: @Composable () -> Unit = {},
) {
    ModernPlaylistHeader(
        title = title,
        tracks = tracks,
        coverUrl = coverUrl,
        isPlaying = isPlaying,
        isCurrentPlaylist = isCurrentPlaylist,
        topPadding = topPadding,
        onBack = onBack,
        onPlayAll = onPlayAll,
        onShuffle = onShuffle,
        isFavorite = isFavorite,
        onToggleFavorite = onToggleFavorite,
        onMore = onMore,
        onAdd = onDownloadAll,
        trailingActions = trailingActions,
    )
}

@Composable
fun PlaylistScreen(
    viewModel: LibraryViewModel,
    playlistId: Long,
    currentTrackId: String?,
    isPlaying: Boolean = false,
    onTogglePlay: () -> Unit = {},
    contentPadding: PaddingValues,
    onBack: () -> Unit,
    onPlay: (List<Track>, Int) -> Unit,
    onShufflePlay: (List<Track>) -> Unit = { list -> onPlay(list, 0) },
) {
    LaunchedEffect(playlistId) { viewModel.openPlaylist(playlistId) }

    val playlist by viewModel.openedPlaylist.collectAsStateWithLifecycle()
    val rawTracks by viewModel.openedPlaylistTracks.collectAsStateWithLifecycle()
    val downloadedIds by viewModel.downloadedIds.collectAsStateWithLifecycle()
    val downloadProgress by viewModel.downloadProgress.collectAsStateWithLifecycle()
    val favoriteIds by viewModel.favoriteIds.collectAsStateWithLifecycle()
    var renaming by rememberSaveable { mutableStateOf(false) }
    var confirmDelete by rememberSaveable { mutableStateOf(false) }
    var menuExpanded by remember { mutableStateOf(false) }

    val name = playlist?.name ?: ""
    val coverPicker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        uri?.let { viewModel.setPlaylistCover(playlistId, it) }
    }
    val coverUrl = playlist?.customCover?.takeIf { it.isNotBlank() }
        ?: rawTracks.firstOrNull { !it.cover.isNullOrBlank() }?.cover

    ModernCollectionScreen(
        title = name.ifBlank { "Плейлист" },
        rawTracks = rawTracks,
        coverUrl = coverUrl,
        currentTrackId = currentTrackId,
        isPlaying = isPlaying,
        contentPadding = contentPadding,
        onBack = onBack,
        onPlay = onPlay,
        onShufflePlay = onShufflePlay,
        onTogglePlay = onTogglePlay,
        downloadedIds = downloadedIds,
        downloadProgress = downloadProgress,
        favoriteIds = favoriteIds,
        onToggleFavorite = { viewModel.toggleFavorite(it) },
        onTrackMenu = { viewModel.openMenu(it, playlistId = playlistId) },
        onDownloadAll = {
            if (rawTracks.isNotEmpty()) viewModel.downloadPlaylist(rawTracks)
        },
        trailingTopActions = {
            Box {
                Surface(
                    onClick = { menuExpanded = true },
                    shape = CircleShape,
                    color = Color.Transparent,
                    modifier = Modifier.size(40.dp),
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            imageVector = Icons.Outlined.MoreVert,
                            contentDescription = "Ещё",
                            tint = Color.White,
                            modifier = Modifier.size(21.dp),
                        )
                    }
                }

                DropdownMenu(
                    expanded = menuExpanded,
                    onDismissRequest = { menuExpanded = false },
                ) {
                    DropdownMenuItem(
                        text = { Text(stringResource(R.string.action_change_cover)) },
                        leadingIcon = { Icon(Icons.Outlined.Image, null) },
                        onClick = {
                            menuExpanded = false
                            coverPicker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
                        },
                    )
                    if (!playlist?.customCover.isNullOrBlank()) {
                        DropdownMenuItem(
                            text = { Text(stringResource(R.string.action_remove_cover)) },
                            leadingIcon = { Icon(Icons.Outlined.HideImage, null) },
                            onClick = {
                                menuExpanded = false
                                viewModel.removePlaylistCover(playlistId)
                            },
                        )
                    }
                    DropdownMenuItem(
                        text = { Text(stringResource(R.string.action_download_playlist)) },
                        leadingIcon = { Icon(Icons.Outlined.Download, null) },
                        onClick = {
                            menuExpanded = false
                            viewModel.downloadPlaylist(rawTracks)
                        },
                    )
                    DropdownMenuItem(
                        text = { Text(stringResource(R.string.action_rename)) },
                        leadingIcon = { Icon(Icons.Outlined.Edit, null) },
                        onClick = {
                            menuExpanded = false
                            renaming = true
                        },
                    )
                    DropdownMenuItem(
                        text = { Text(stringResource(R.string.action_delete)) },
                        leadingIcon = { Icon(Icons.Outlined.DeleteOutline, null) },
                        onClick = {
                            menuExpanded = false
                            confirmDelete = true
                        },
                    )
                }
            }
        },
        emptyMessage = stringResource(R.string.library_playlist_empty),
    )

    if (renaming) {
        PlaylistNameDialog(
            title = stringResource(R.string.action_rename),
            confirm = stringResource(R.string.action_save),
            initial = name,
            onDismiss = { renaming = false },
            onConfirm = {
                renaming = false
                viewModel.renamePlaylist(playlistId, it)
            },
        )
    }
    if (confirmDelete) {
        ConfirmDialog(
            text = stringResource(R.string.dialog_delete_playlist, name),
            confirm = stringResource(R.string.action_delete),
            onDismiss = { confirmDelete = false },
            onConfirm = {
                confirmDelete = false
                viewModel.deletePlaylist(playlistId)
                onBack()
            },
        )
    }
}
