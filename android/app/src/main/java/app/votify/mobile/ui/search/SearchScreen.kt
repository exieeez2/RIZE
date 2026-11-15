package app.votify.mobile.ui.search

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
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
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.votify.mobile.R
import app.votify.mobile.data.DeezerAlbum
import app.votify.mobile.data.DeezerArtist
import app.votify.mobile.data.Track
import app.votify.mobile.ui.components.Artwork
import app.votify.mobile.ui.components.PillChip
import app.votify.mobile.ui.components.SectionHeader
import app.votify.mobile.ui.components.TrackRow
import app.votify.mobile.ui.theme.VotifyColors
import java.text.NumberFormat
import java.util.Locale

@Composable
fun SearchScreen(
    viewModel: SearchViewModel,
    currentTrackId: String?,
    contentPadding: PaddingValues,
    onPlay: (List<Track>, Int) -> Unit,
    onMore: (Track) -> Unit,
    onOpenSettings: () -> Unit,
    onOpenArtist: (String) -> Unit = {},
    onBack: () -> Unit = {},
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val keyboard = LocalSoftwareKeyboardController.current

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(VotifyColors.SurfaceBase)
            .statusBarsPadding(),
    ) {
        // TOP BAR: Back button + Search bar pill
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            // Circular Back button
            Box(
                modifier = Modifier
                    .size(42.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.surfaceContainerHigh)
                    .clickable { onBack() },
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = Icons.AutoMirrored.Outlined.ArrowBack,
                    contentDescription = "Назад",
                    tint = VotifyColors.TextPrimary,
                    modifier = Modifier.size(20.dp),
                )
            }

            // Search pill
            var isFocused by remember { mutableStateOf(false) }
            Row(
                modifier = Modifier
                    .weight(1f)
                    .height(44.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.surfaceContainerHigh)
                    .border(
                        1.dp,
                        if (isFocused) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.25f),
                        CircleShape,
                    )
                    .padding(horizontal = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Icon(
                    imageVector = Icons.Outlined.Search,
                    contentDescription = null,
                    tint = if (isFocused) MaterialTheme.colorScheme.primary else VotifyColors.TextMuted,
                    modifier = Modifier.size(18.dp),
                )

                Box(modifier = Modifier.weight(1f)) {
                    if (state.query.isEmpty()) {
                        Text(
                            text = "Треки, авторы, альбомы...",
                            color = VotifyColors.TextMuted,
                            fontSize = 14.sp,
                        )
                    }
                    BasicTextField(
                        value = state.query,
                        onValueChange = viewModel::onQueryChange,
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                        keyboardActions = KeyboardActions(onSearch = {
                            keyboard?.hide()
                            viewModel.submit()
                        }),
                        textStyle = TextStyle(
                            color = VotifyColors.TextPrimary,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Medium,
                        ),
                        cursorBrush = SolidColor(MaterialTheme.colorScheme.primary),
                        modifier = Modifier
                            .fillMaxWidth()
                            .onFocusChanged { isFocused = it.isFocused },
                    )
                }

                if (state.query.isNotEmpty()) {
                    Box(
                        modifier = Modifier
                            .size(24.dp)
                            .clip(CircleShape)
                            .background(MaterialTheme.colorScheme.onSurface.copy(alpha = 0.12f))
                            .clickable { viewModel.clear() },
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = stringResource(R.string.search_clear),
                            tint = VotifyColors.TextPrimary,
                            modifier = Modifier.size(14.dp),
                        )
                    }
                }
            }
        }

        // Filter chips row
        LazyRow(
            contentPadding = PaddingValues(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.padding(bottom = 8.dp),
        ) {
            items(SearchFilter.values()) { f ->
                PillChip(
                    text = f.label,
                    selected = state.filter == f,
                    onClick = { viewModel.setFilter(f) },
                )
            }
        }

        // Search Content / Results
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(
                bottom = contentPadding.calculateBottomPadding() + 24.dp,
            ),
        ) {
            when {
                state.isLoading -> item {
                    Box(Modifier.fillMaxWidth().padding(vertical = 48.dp), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = VotifyColors.Primary, strokeWidth = 2.dp)
                    }
                }

                state.error != null || state.offline -> item {
                    StatusBlock(
                        title = if (state.offline) stringResource(R.string.search_no_internet_title) else stringResource(R.string.search_error),
                        subtitle = if (state.offline) stringResource(R.string.search_no_internet_sub) else (state.error ?: ""),
                        action = stringResource(R.string.search_retry),
                        onAction = viewModel::retry,
                    )
                }

                state.searched && state.results.isEmpty() && state.artistResults.isEmpty() && state.albumResults.isEmpty() -> item {
                    StatusBlock(
                        title = stringResource(R.string.search_empty),
                        subtitle = stringResource(R.string.search_empty_hint),
                    )
                }

                else -> {
                    // Artist results
                    if (state.artistResults.isNotEmpty() && (state.filter == SearchFilter.All || state.filter == SearchFilter.Artists)) {
                        item {
                            SectionHeader(
                                title = "Артисты",
                                modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp),
                            )
                            LazyRow(
                                contentPadding = PaddingValues(horizontal = 16.dp),
                                horizontalArrangement = Arrangement.spacedBy(14.dp),
                            ) {
                                items(state.artistResults) { artist ->
                                    ArtistSearchResultCard(
                                        artist = artist,
                                        onClick = { onOpenArtist(artist.name) },
                                    )
                                }
                            }
                            Spacer(Modifier.height(12.dp))
                        }
                    }

                    // Album results
                    if (state.albumResults.isNotEmpty() && (state.filter == SearchFilter.All || state.filter == SearchFilter.Albums)) {
                        item {
                            SectionHeader(
                                title = "Альбомы",
                                modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp),
                            )
                            LazyRow(
                                contentPadding = PaddingValues(horizontal = 16.dp),
                                horizontalArrangement = Arrangement.spacedBy(14.dp),
                            ) {
                                items(state.albumResults) { album ->
                                    AlbumSearchResultCard(
                                        album = album,
                                        onClick = { onOpenArtist(album.artistName) },
                                    )
                                }
                            }
                            Spacer(Modifier.height(12.dp))
                        }
                    }

                    // Track results
                    if (state.results.isNotEmpty() && (state.filter == SearchFilter.All || state.filter == SearchFilter.Tracks)) {
                        item {
                            SectionHeader(
                                title = "Треки",
                                modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp),
                            )
                        }

                        itemsIndexed(state.results, key = { i, t -> "$i-${t.id}" }) { i, t ->
                            TrackRow(
                                track = t,
                                isCurrent = t.id == currentTrackId,
                                onClick = {
                                    viewModel.addTrackToHistory(t)
                                    onPlay(state.results, i)
                                },
                                onMore = { onMore(t) },
                                modifier = Modifier.padding(horizontal = 8.dp),
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ArtistSearchResultCard(
    artist: DeezerArtist,
    onClick: () -> Unit,
) {
    Column(
        modifier = Modifier
            .width(105.dp)
            .clickable(onClick = onClick),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier = Modifier
                .size(90.dp)
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.surfaceContainerHigh)
                .border(0.5.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.25f), CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Artwork(
                url = artist.pictureBig.ifBlank { artist.picture },
                size = 90.dp,
                shape = CircleShape,
                contentDescription = artist.name,
            )
        }

        Spacer(Modifier.height(6.dp))

        Text(
            text = artist.name,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.SemiBold,
            color = VotifyColors.TextPrimary,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            textAlign = TextAlign.Center,
        )

        if (artist.nbFan > 0) {
            Text(
                text = "${NumberFormat.getNumberInstance(Locale.getDefault()).format(artist.nbFan)} фанов",
                style = MaterialTheme.typography.bodySmall.copy(fontSize = 10.sp),
                color = VotifyColors.TextMuted,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                textAlign = TextAlign.Center,
            )
        }
    }
}

@Composable
private fun AlbumSearchResultCard(
    album: DeezerAlbum,
    onClick: () -> Unit,
) {
    Column(
        modifier = Modifier
            .width(120.dp)
            .clickable(onClick = onClick),
    ) {
        Artwork(
            url = album.coverBig.ifBlank { album.cover },
            size = 120.dp,
            shape = RoundedCornerShape(12.dp),
            contentDescription = album.title,
        )

        Spacer(Modifier.height(6.dp))

        Text(
            text = album.title,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.SemiBold,
            color = VotifyColors.TextPrimary,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )

        Text(
            text = album.artistName,
            style = MaterialTheme.typography.bodySmall,
            color = VotifyColors.TextMuted,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

@Composable
private fun StatusBlock(
    title: String,
    subtitle: String,
    action: String? = null,
    onAction: (() -> Unit)? = null,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 32.dp, vertical = 48.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
            color = VotifyColors.TextPrimary,
            textAlign = TextAlign.Center,
        )
        if (subtitle.isNotBlank()) {
            Spacer(Modifier.height(6.dp))
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodyMedium,
                color = VotifyColors.TextMuted,
                textAlign = TextAlign.Center,
            )
        }
        if (action != null && onAction != null) {
            Spacer(Modifier.height(16.dp))
            PillChip(text = action, selected = true, onClick = onAction)
        }
    }
}
