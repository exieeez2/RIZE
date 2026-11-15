package app.votify.mobile.ui.library

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material.icons.outlined.FileDownload
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import app.votify.mobile.ui.theme.VotifyColors
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
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
import app.votify.mobile.ui.components.PlaylistNameDialog
import app.votify.mobile.ui.components.rememberVotifyHaptic
import app.votify.mobile.ui.components.pressBounce
import androidx.compose.foundation.interaction.MutableInteractionSource

enum class LibraryTab(val label: String) {
    ALL("Все"),
    PLAYLISTS("Плейлисты"),
    ARTISTS("Авторы")
}

@Composable
fun LibraryScreen(
    viewModel: LibraryViewModel,
    currentTrackId: String?,
    contentPadding: PaddingValues,
    onPlay: (List<Track>, Int) -> Unit,
    onOpenFavorites: () -> Unit,
    onOpenDownloaded: () -> Unit = onOpenFavorites,
    onOpenHistory: () -> Unit,
    onOpenPlaylist: (Long) -> Unit,
    onOpenSettings: () -> Unit,
    onImport: () -> Unit,
    onOpenAccount: () -> Unit = onOpenSettings,
    onOpenSearch: () -> Unit = {},
    onOpenArtist: (String) -> Unit = {},
) {
    val favorites by viewModel.favorites.collectAsStateWithLifecycle()
    val downloadedTracks by viewModel.downloadedTracks.collectAsStateWithLifecycle()
    val playlists by viewModel.playlists.collectAsStateWithLifecycle()
    val recent by viewModel.recent.collectAsStateWithLifecycle()
    val downloadedIds by viewModel.downloadedIds.collectAsStateWithLifecycle()
    val followedArtists by viewModel.followedArtists.collectAsStateWithLifecycle()
    val haptic = rememberVotifyHaptic()

    val favCovers = remember(favorites) {
        favorites.mapNotNull { it.cover.takeIf { c -> c.isNotBlank() } }.distinct().take(4)
    }
    val downloadedCovers = remember(downloadedTracks) {
        downloadedTracks.mapNotNull { it.cover.takeIf { c -> c.isNotBlank() } }
            .distinct()
            .take(4)
    }

    var activeTab by rememberSaveable { mutableStateOf(LibraryTab.ALL) }
    var creating by rememberSaveable { mutableStateOf(false) }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(VotifyColors.SurfaceBase),
    ) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(
                top = 0.dp,
                bottom = contentPadding.calculateBottomPadding() + 24.dp,
            ),
        ) {
            // 1. TOP HEADER: Import on left, Search & Add on right
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .statusBarsPadding()
                        .padding(horizontal = 18.dp, vertical = 14.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    CircleIconBtn(
                        icon = Icons.Outlined.FileDownload,
                        desc = "Импорт",
                        onClick = {
                            haptic()
                            onImport()
                        },
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        CircleIconBtn(
                            icon = Icons.Outlined.Search,
                            desc = "Поиск",
                            onClick = {
                                haptic()
                                onOpenSearch()
                            },
                        )
                        CircleIconBtn(
                            icon = Icons.Outlined.Add,
                            desc = "Создать",
                            onClick = {
                                haptic()
                                creating = true
                            },
                        )
                    }
                }
            }

            // 2. BIG TABS: Все / Плейлисты / Авторы (Single line, zero word-wrap)
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState())
                        .padding(horizontal = 18.dp, vertical = 6.dp),
                    horizontalArrangement = Arrangement.spacedBy(16.dp),
                    verticalAlignment = Alignment.Bottom,
                ) {
                    LibraryTab.entries.forEach { tab ->
                        val selected = activeTab == tab
                        Text(
                            text = tab.label,
                            color = if (selected) VotifyColors.TextPrimary else VotifyColors.TextMuted,
                            fontSize = 25.sp,
                            fontWeight = FontWeight.Bold,
                            maxLines = 1,
                            softWrap = false,
                            overflow = TextOverflow.Clip,
                            modifier = Modifier.clickable {
                                haptic()
                                activeTab = tab
                            },
                        )
                    }
                }
                Spacer(Modifier.height(10.dp))
            }

            // 3. SYSTEM COLLECTIONS: Любимые and Скачанные (when Tab is ALL or PLAYLISTS)
            if (activeTab == LibraryTab.ALL || activeTab == LibraryTab.PLAYLISTS) {
                item {
                    Text(
                        text = "Системные",
                        color = VotifyColors.TextMuted,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(horizontal = 18.dp, vertical = 6.dp),
                    )
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 18.dp),
                        horizontalArrangement = Arrangement.spacedBy(14.dp),
                    ) {
                        LibraryCard(
                            title = "Любимые",
                            sub = "${favorites.size} треков",
                            modifier = Modifier.weight(1f),
                            onClick = {
                                haptic()
                                onOpenFavorites()
                            },
                        ) {
                            SmartCollectionArt(
                                covers = favCovers,
                                emptyIcon = {
                                    Icon(
                                        imageVector = Icons.Outlined.FavoriteBorder,
                                        contentDescription = null,
                                        tint = VotifyColors.TextMuted,
                                        modifier = Modifier.size(28.dp),
                                    )
                                },
                            )
                        }

                        LibraryCard(
                            title = "Скачанные",
                            sub = "${downloadedTracks.size} треков",
                            modifier = Modifier.weight(1f),
                            onClick = {
                                haptic()
                                onOpenDownloaded()
                            },
                        ) {
                            SmartCollectionArt(
                                covers = downloadedCovers,
                                emptyIcon = {
                                    Icon(
                                        imageVector = Icons.Outlined.FileDownload,
                                        contentDescription = null,
                                        tint = VotifyColors.TextMuted,
                                        modifier = Modifier.size(28.dp),
                                    )
                                },
                            )
                        }
                    }
                    Spacer(Modifier.height(18.dp))
                }
            }

            // 4. PLAYLISTS (when Tab is ALL or PLAYLISTS)
            if (activeTab == LibraryTab.ALL || activeTab == LibraryTab.PLAYLISTS) {
                item {
                    Text(
                        text = "Плейлисты",
                        color = VotifyColors.TextMuted,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(horizontal = 18.dp, vertical = 6.dp),
                    )
                }

                if (playlists.isEmpty()) {
                    item {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 18.dp, vertical = 12.dp)
                                .clip(RoundedCornerShape(20.dp))
                                .background(MaterialTheme.colorScheme.surfaceContainerHigh)
                                .clickable { creating = true }
                                .padding(24.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(
                                text = "Нажмите чтобы создать первый плейлист",
                                color = VotifyColors.TextMuted,
                                fontSize = 14.sp,
                                textAlign = TextAlign.Center,
                            )
                        }
                    }
                } else {
                    val chunked = playlists.chunked(2)
                    items(chunked.size) { rowIndex ->
                        val row = chunked[rowIndex]
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 18.dp, vertical = 6.dp),
                            horizontalArrangement = Arrangement.spacedBy(14.dp),
                        ) {
                            row.forEach { pl ->
                                Column(
                                    modifier = Modifier
                                        .weight(1f)
                                        .clickable {
                                            haptic()
                                            onOpenPlaylist(pl.id)
                                        },
                                 ) {
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .aspectRatio(1f)
                                            .clip(RoundedCornerShape(20.dp))
                                            .background(MaterialTheme.colorScheme.surfaceContainerHigh),
                                        contentAlignment = Alignment.Center,
                                    ) {
                                        if (!pl.cover.isNullOrBlank()) {
                                            Artwork(
                                                url = pl.cover,
                                                modifier = Modifier.fillMaxSize(),
                                                contentDescription = pl.name,
                                            )
                                        } else {
                                            Text(
                                                text = pl.name.take(1).uppercase(),
                                                color = VotifyColors.TextPrimary,
                                                fontSize = 32.sp,
                                                fontWeight = FontWeight.Bold,
                                            )
                                        }
                                    }
                                    Spacer(Modifier.height(8.dp))
                                    Text(
                                        text = pl.name,
                                        color = VotifyColors.TextPrimary,
                                        fontSize = 14.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                    )
                                    Text(
                                        text = "${pl.trackCount} треков",
                                        color = VotifyColors.TextMuted,
                                        fontSize = 12.sp,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                    )
                                }
                            }
                            if (row.size == 1) {
                                Spacer(modifier = Modifier.weight(1f))
                            }
                        }
                    }
                }
                item { Spacer(Modifier.height(18.dp)) }
            }

            // 5. ARTISTS (when Tab is ALL or ARTISTS)
            if (activeTab == LibraryTab.ALL || activeTab == LibraryTab.ARTISTS) {
                item {
                    Text(
                        text = "Сохранённые авторы",
                        color = VotifyColors.TextMuted,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(horizontal = 18.dp, vertical = 6.dp),
                    )
                }

                if (followedArtists.isEmpty()) {
                    item {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 18.dp, vertical = 12.dp)
                                .clip(RoundedCornerShape(20.dp))
                                .background(MaterialTheme.colorScheme.surfaceContainerHigh)
                                .padding(24.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(
                                text = "У вас пока нет сохранённых авторов.\nНажмите на сердечко на странице автора, чтобы сохранить его в медиатеку.",
                                color = VotifyColors.TextMuted,
                                fontSize = 14.sp,
                                textAlign = TextAlign.Center,
                            )
                        }
                    }
                } else {
                    val chunked = followedArtists.chunked(2)
                    items(chunked.size) { rowIndex ->
                        val row = chunked[rowIndex]
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 18.dp, vertical = 6.dp),
                            horizontalArrangement = Arrangement.spacedBy(14.dp),
                        ) {
                            row.forEach { artistItem ->
                                Column(
                                    modifier = Modifier
                                        .weight(1f)
                                        .clickable {
                                            haptic()
                                            onOpenArtist(artistItem.name)
                                        },
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth(0.85f)
                                            .aspectRatio(1f)
                                            .clip(CircleShape)
                                            .background(MaterialTheme.colorScheme.surfaceContainerHigh),
                                        contentAlignment = Alignment.Center,
                                    ) {
                                        if (artistItem.photoUrl.isNotBlank()) {
                                            Artwork(
                                                url = artistItem.photoUrl,
                                                contentDescription = artistItem.name,
                                                shape = CircleShape,
                                                modifier = Modifier.fillMaxSize(),
                                            )
                                        } else {
                                            Text(
                                                text = artistItem.name.take(1).uppercase(),
                                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                                fontSize = 28.sp,
                                                fontWeight = FontWeight.Bold,
                                            )
                                        }
                                    }
                                    Spacer(Modifier.height(8.dp))
                                    Text(
                                        text = artistItem.name,
                                        color = VotifyColors.TextPrimary,
                                        fontSize = 14.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        textAlign = TextAlign.Center,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                    )
                                    Text(
                                        text = "Автор",
                                        color = VotifyColors.TextMuted,
                                        fontSize = 12.sp,
                                    )
                                }
                            }
                            if (row.size == 1) {
                                Spacer(modifier = Modifier.weight(1f))
                            }
                        }
                    }
                }
            }
        }
    }

    if (creating) {
        PlaylistNameDialog(
            title = stringResource(R.string.library_new_playlist),
            confirm = stringResource(R.string.action_create),
            onDismiss = { creating = false },
            onConfirm = { name ->
                creating = false
                viewModel.createPlaylist(name)
            },
        )
    }
}

@Composable
private fun CircleIconBtn(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    desc: String,
    onClick: () -> Unit,
) {
    Box(
        modifier = Modifier
            .size(42.dp)
            .clip(CircleShape)
            .background(MaterialTheme.colorScheme.surfaceContainerHigh)
            .clickable { onClick() },
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, desc, tint = VotifyColors.TextPrimary, modifier = Modifier.size(20.dp))
    }
}

@Composable
private fun SmartCollectionArt(
    covers: List<String>,
    emptyIcon: @Composable () -> Unit,
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .clip(RoundedCornerShape(20.dp))
            .background(MaterialTheme.colorScheme.surfaceContainerHigh),
        contentAlignment = Alignment.Center,
    ) {
        when {
            covers.isEmpty() -> {
                Box(
                    modifier = Modifier
                        .size(56.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.onSurface.copy(alpha = 0.08f)),
                    contentAlignment = Alignment.Center,
                ) {
                    emptyIcon()
                }
            }
            covers.size < 4 -> {
                Artwork(
                    url = covers.first(),
                    shape = RoundedCornerShape(20.dp),
                    modifier = Modifier.fillMaxSize(),
                )
            }
            else -> {
                Column(modifier = Modifier.fillMaxSize()) {
                    Row(modifier = Modifier.weight(1f)) {
                        Artwork(url = covers[0], shape = RoundedCornerShape(0.dp), modifier = Modifier.weight(1f).fillMaxHeight())
                        Artwork(url = covers[1], shape = RoundedCornerShape(0.dp), modifier = Modifier.weight(1f).fillMaxHeight())
                    }
                    Row(modifier = Modifier.weight(1f)) {
                        Artwork(url = covers[2], shape = RoundedCornerShape(0.dp), modifier = Modifier.weight(1f).fillMaxHeight())
                        Artwork(url = covers[3], shape = RoundedCornerShape(0.dp), modifier = Modifier.weight(1f).fillMaxHeight())
                    }
                }
            }
        }
    }
}

@Composable
private fun LibraryCard(
    title: String,
    sub: String,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
    content: @Composable () -> Unit,
) {
    val interactionSource = remember { MutableInteractionSource() }
    Column(
        modifier = modifier
            .pressBounce(interactionSource, pressedScale = 0.94f)
            .clip(RoundedCornerShape(20.dp))
            .clickable(
                interactionSource = interactionSource,
                indication = null,
                onClick = onClick,
            )
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(1f)
                .clip(RoundedCornerShape(20.dp))
                .background(MaterialTheme.colorScheme.surfaceContainerHigh),
            contentAlignment = Alignment.Center,
        ) {
            content()
        }
        Spacer(Modifier.height(8.dp))
        Text(
            text = title,
            color = VotifyColors.TextPrimary,
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Text(
            text = sub,
            color = VotifyColors.TextMuted,
            fontSize = 12.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}
