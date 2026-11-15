package app.votify.mobile.ui.home

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.KeyboardArrowRight
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.TrendingUp
import androidx.compose.material.icons.outlined.AccountCircle
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.rounded.Pause
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import androidx.compose.ui.platform.LocalContext
import androidx.core.graphics.drawable.toBitmap
import androidx.palette.graphics.Palette
import coil.imageLoader
import coil.request.ImageRequest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.votify.mobile.R
import app.votify.mobile.data.Track
import app.votify.mobile.ui.components.Artwork
import app.votify.mobile.ui.components.resolveCoverModel
import app.votify.mobile.ui.components.pressBounce
import androidx.compose.foundation.interaction.MutableInteractionSource
import coil.compose.SubcomposeAsyncImage
import androidx.compose.ui.layout.ContentScale
import app.votify.mobile.ui.components.CircleIconButton
import app.votify.mobile.ui.components.GlassBaseColor
import app.votify.mobile.ui.components.LocalLiquidGlass
import app.votify.mobile.ui.components.PillChip
import app.votify.mobile.ui.components.VotifyCard
import app.votify.mobile.ui.components.rememberGlassSpec
import app.votify.mobile.ui.components.votifyGlass
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.sp
import app.votify.mobile.ui.components.pluralTracks
import app.votify.mobile.ui.theme.VotifyColors
import kotlin.math.cos
import kotlin.math.sin

@Composable
fun HomeScreen(
    viewModel: HomeViewModel,
    contentPadding: PaddingValues,
    onPlay: (List<Track>, Int) -> Unit,
    playerState: app.votify.mobile.player.PlayerUiState,
    onSeek: (Float) -> Unit,
    iosSlider: Boolean,
    onOpenSearch: () -> Unit,
    onOpenHistory: () -> Unit,
    onOpenFavorites: () -> Unit,
    onOpenSettings: () -> Unit,
    onOpenAccount: () -> Unit,
    onOpenTrending: () -> Unit,
    onOpenSite: () -> Unit,
    onOpenPlaylist: (Long) -> Unit = {},
    onOpenArtist: (String) -> Unit = {},
    onPlayPause: () -> Unit = {},
    favoriteIds: Set<String> = emptySet(),
    onToggleFavorite: (Track) -> Unit = {},
    userAvatar: String? = null,
    userName: String = "exieeez",
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val recent by viewModel.recent.collectAsStateWithLifecycle()
    val favoriteCount by viewModel.favoriteCount.collectAsStateWithLifecycle()

    val scrollState = rememberScrollState()
    val scrollProgress = remember {
        derivedStateOf { (scrollState.value / 640f).coerceIn(0f, 1f) }
    }
    val continueTrack = playerState.current ?: recent.firstOrNull() ?: state.wave.firstOrNull()
    val heroPagerState = rememberPagerState(pageCount = { 2 })
    val coroutineScope = rememberCoroutineScope()

    Box(
        Modifier
            .fillMaxSize()
            .background(VotifyColors.SurfaceBase)
    ) {
        // Dynamic background ambient top glow (matching .bg-glow in rize(3).html) with smooth parallax
        HomeTopGlow(
            coverUrl = continueTrack?.cover.orEmpty(),
            depth = 600.dp,
            visibility = { 1f - (scrollProgress.value * 0.85f) },
            scrollOffset = scrollState.value.toFloat(),
            modifier = Modifier.align(Alignment.TopCenter),
        )

        Column(
            Modifier
                .fillMaxSize()
                .verticalScroll(scrollState)
                .statusBarsPadding()
                .padding(
                    bottom = contentPadding.calculateBottomPadding() + 24.dp
                ),
        ) {
            // Space for the top bar + spacer pushing hero typography into lower ambient glow
            Spacer(Modifier.height(56.dp))
            Spacer(Modifier.height(115.dp))

            // --- HERO CAROUSEL: 2 Slides ("Продолжить" & "Персональный поток") matching rize(3).html ---
            HeroContinueSection(
                continueTrack = continueTrack,
                heroPagerState = heroPagerState,
                coroutineScope = coroutineScope,
                playerState = playerState,
                recent = recent,
                wave = state.wave,
                onPlayPause = onPlayPause,
                onPlay = onPlay,
                onOpenArtist = onOpenArtist,
            )

            Spacer(Modifier.height(18.dp))

            // --- 1. SECTION: "Недавнее >" (.section-title in rize(3).html) ---
            HomeSectionHeader(
                title = stringResource(R.string.home_section_recent),
                onClick = onOpenHistory,
            )

            Spacer(Modifier.height(8.dp))

            // 2-Column Square Recent Cards (.recent-grid in rize(3).html)
            val recentCards = remember(recent, state.wave) {
                (recent + state.wave).distinctBy { it.id }.take(2)
            }

            if (recentCards.isNotEmpty()) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 18.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    recentCards.forEach { trk ->
                        Column(
                            modifier = Modifier
                                .weight(1f)
                                .clickable {
                                    val list = if (recent.isNotEmpty()) recent else state.wave
                                    val index = list.indexOfFirst { it.id == trk.id }.coerceAtLeast(0)
                                    onPlay(if (list.isNotEmpty()) list else recentCards, index)
                                },
                        ) {
                            // Square Artwork with bottom-right card-play-badge (26dp squircle)
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .aspectRatio(1f)
                                    .clip(RoundedCornerShape(26.dp))
                                    .background(MaterialTheme.colorScheme.surfaceContainerHigh),
                            ) {
                                if (trk.cover.isNotBlank()) {
                                    Artwork(
                                        url = trk.cover,
                                        size = 200.dp,
                                        shape = RoundedCornerShape(26.dp),
                                        contentDescription = trk.title,
                                        modifier = Modifier.fillMaxSize(),
                                    )
                                }

                                // Subtle dark gradient at bottom of card
                                Box(
                                    modifier = Modifier
                                        .fillMaxSize()
                                        .background(
                                            Brush.verticalGradient(
                                                listOf(
                                                    Color.Transparent,
                                                    Color.Black.copy(alpha = 0.40f)
                                                )
                                            )
                                        )
                                )

                                // Circular play badge on bottom-right (36dp, white, 16dp play arrow)
                                Surface(
                                    shape = CircleShape,
                                    color = Color.White.copy(alpha = 0.92f),
                                    shadowElevation = 4.dp,
                                    modifier = Modifier
                                        .align(Alignment.BottomEnd)
                                        .padding(10.dp)
                                        .size(36.dp),
                                ) {
                                    Box(contentAlignment = Alignment.Center) {
                                        Icon(
                                            imageVector = Icons.Filled.PlayArrow,
                                            contentDescription = null,
                                            tint = Color(0xFF0A0A0A),
                                            modifier = Modifier.size(16.dp),
                                        )
                                    }
                                }
                            }

                            Spacer(Modifier.height(8.dp))

                            Text(
                                text = trk.title,
                                style = MaterialTheme.typography.bodyMedium.copy(
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.SemiBold,
                                ),
                                color = VotifyColors.TextPrimary,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                            Spacer(Modifier.height(2.dp))
                            Text(
                                text = trk.artist,
                                style = MaterialTheme.typography.bodySmall.copy(
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Normal,
                                ),
                                color = Color(0xFF9A9A9A),
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                    }
                }
            }

            Spacer(Modifier.height(20.dp))

            // --- 2. SECTION: "Для вас >" (Recommendations row) ---
            HomeSectionHeader(
                title = stringResource(R.string.home_section_for_you),
                onClick = onOpenTrending,
            )
            val forYouTracks = state.forYouTracks.ifEmpty { state.wave }
            if (forYouTracks.isNotEmpty()) {
                LazyRow(
                    contentPadding = PaddingValues(horizontal = 18.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    modifier = Modifier.padding(top = 8.dp),
                ) {
                    itemsIndexed(forYouTracks) { index, track ->
                        TrackCard(
                            track = track,
                            onClick = { onPlay(forYouTracks, index) },
                        )
                    }
                }
            }

            Spacer(Modifier.height(20.dp))

            // --- 3. SECTION: "Плейлисты >" ---
            HomeSectionHeader(
                title = stringResource(R.string.home_section_playlists),
                onClick = onOpenFavorites,
            )
            if (state.forYouPlaylists.isNotEmpty()) {
                LazyRow(
                    contentPadding = PaddingValues(horizontal = 18.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    modifier = Modifier.padding(top = 8.dp),
                ) {
                    items(state.forYouPlaylists) { pl ->
                        PlaylistCard(
                            playlist = pl,
                            onClick = {
                                if (pl.isLocal) {
                                    onOpenPlaylist(pl.id)
                                } else {
                                    viewModel.playSearch("${pl.name} ${pl.subtitle}", onPlay)
                                }
                            },
                        )
                    }
                }
            }

            Spacer(Modifier.height(20.dp))

            // --- 4. SECTION: "Артисты >" ---
            HomeSectionHeader(
                title = stringResource(R.string.home_section_artists),
                onClick = null,
            )
            if (state.forYouArtists.isNotEmpty()) {
                LazyRow(
                    contentPadding = PaddingValues(horizontal = 18.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    modifier = Modifier.padding(top = 8.dp),
                ) {
                    items(state.forYouArtists) { artist ->
                        ArtistCard(
                            artist = artist,
                            onClick = { onOpenArtist(artist.name) },
                        )
                    }
                }
            }

            Spacer(Modifier.height(20.dp))

            // --- 5. SECTION: "Релизы >" ---
            HomeSectionHeader(
                title = stringResource(R.string.home_section_releases),
                onClick = null,
            )
            if (state.forYouReleases.isNotEmpty()) {
                LazyRow(
                    contentPadding = PaddingValues(horizontal = 18.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    modifier = Modifier.padding(top = 8.dp),
                ) {
                    items(state.forYouReleases) { release ->
                        ReleaseCard(
                            release = release,
                            onClick = {
                                if (release.track != null) {
                                    onPlay(listOf(release.track), 0)
                                } else {
                                    viewModel.playSearch("${release.artist} ${release.title}", onPlay)
                                }
                            },
                        )
                    }
                }
            }

            Spacer(Modifier.height(20.dp))
        }

        // Top Bar with smooth scroll-fade matching prototype (.top-bar in rize(3).html)
        val headerAlpha = (1f - (scrollState.value / 120f)).coerceIn(0f, 1f)
        val headerTranslateY = (-scrollState.value * 0.4f).coerceAtMost(36f)

        if (headerAlpha > 0.01f) {
            Box(
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .fillMaxWidth()
                    .statusBarsPadding()
                    .graphicsLayer {
                        alpha = headerAlpha
                        translationY = headerTranslateY
                    },
            ) {
                HomeHeader(
                    onOpenSearch = onOpenSearch,
                    onOpenSettings = onOpenSettings,
                    onOpenAccount = onOpenAccount,
                    onOpenSite = onOpenSite,
                    userAvatar = userAvatar,
                    userName = userName,
                )
            }
        }
    }
}

/** Dynamic ambient top glow matching .bg-glow in rize(3).html with smooth parallax */
@Composable
fun HomeTopGlow(
    coverUrl: String,
    depth: Dp = 600.dp,
    visibility: () -> Float = { 1f },
    scrollOffset: Float = 0f,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(depth)
            .graphicsLayer {
                alpha = visibility().coerceIn(0f, 1f)
                translationY = -scrollOffset * 0.35f
            }
    ) {
        if (coverUrl.isNotBlank()) {
            val model = remember(coverUrl) { resolveCoverModel(coverUrl) }
            SubcomposeAsyncImage(
                model = model,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .fillMaxSize()
                    .graphicsLayer {
                        alpha = 0.75f
                    },
            )
        }

        // Ambient vertical mask fading seamlessly to theme surface base (completely eliminating any seam/line)
        val baseColor = VotifyColors.SurfaceBase
        val isDarkTheme = app.votify.mobile.ui.theme.LocalVotifyPalette.current.isDark
        val overlayStart = if (isDarkTheme) Color.Black.copy(alpha = 0.20f) else Color.White.copy(alpha = 0.05f)
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        0.0f to overlayStart,
                        0.32f to baseColor.copy(alpha = 0.35f),
                        0.60f to baseColor.copy(alpha = 0.70f),
                        0.85f to baseColor,
                        1.0f to baseColor,
                    )
                )
        )
    }
}

/** Clean Header: RIZE brand pill on left, Account / Search / Settings discs on right (.top-bar). */
@Composable
private fun HomeHeader(
    onOpenSearch: () -> Unit,
    onOpenSettings: () -> Unit,
    onOpenAccount: () -> Unit,
    onOpenSite: () -> Unit,
    userAvatar: String? = null,
    userName: String = "exieeez",
) {
    Row(
        Modifier
            .fillMaxWidth()
            .height(64.dp)
            .padding(horizontal = 18.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        // Left: Clean RIZE brand title matching .brand in rize(3).html
        Text(
            text = "RIZE",
            style = MaterialTheme.typography.titleMedium.copy(
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 5.5.sp,
            ),
            color = VotifyColors.TextPrimary,
            modifier = Modifier.clickable(onClick = onOpenSite),
        )

        // Right action buttons matching .top-actions in rize(3).html: Search button + Avatar disc
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Surface(
                onClick = onOpenSearch,
                shape = CircleShape,
                color = Color.Transparent,
                modifier = Modifier.size(40.dp),
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = Icons.Outlined.Search,
                        contentDescription = stringResource(R.string.nav_search),
                        tint = VotifyColors.TextPrimary,
                        modifier = Modifier.size(24.dp),
                    )
                }
            }

            Surface(
                onClick = onOpenAccount,
                shape = CircleShape,
                color = if (!userAvatar.isNullOrBlank()) Color.Transparent else MaterialTheme.colorScheme.surfaceContainerHigh,
                border = BorderStroke(1.2.dp, VotifyColors.TextPrimary.copy(alpha = 0.18f)),
                modifier = Modifier.size(38.dp),
            ) {
                Box(contentAlignment = Alignment.Center) {
                    if (!userAvatar.isNullOrBlank()) {
                        Artwork(
                            url = userAvatar,
                            size = 38.dp,
                            shape = CircleShape,
                            contentDescription = userName,
                            modifier = Modifier.fillMaxSize(),
                        )
                    } else {
                        val initial = userName.trim().firstOrNull()?.uppercaseChar()?.toString() ?: "E"
                        Text(
                            text = initial,
                            style = MaterialTheme.typography.titleMedium.copy(
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Bold,
                            ),
                            color = VotifyColors.TextPrimary,
                        )
                    }
                }
            }
        }
    }
}

/**
 * Hero Continue Section with 2-slide carousel and indicator dots matching rize(3).html.
 */
@Composable
private fun HeroContinueSection(
    continueTrack: Track?,
    heroPagerState: androidx.compose.foundation.pager.PagerState,
    coroutineScope: kotlinx.coroutines.CoroutineScope,
    playerState: app.votify.mobile.player.PlayerUiState,
    recent: List<Track>,
    wave: List<Track>,
    onPlayPause: () -> Unit,
    onPlay: (List<Track>, Int) -> Unit,
    onOpenArtist: (String) -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        HorizontalPager(
            state = heroPagerState,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 18.dp),
            contentPadding = PaddingValues(0.dp),
            pageSpacing = 0.dp,
        ) { page ->
            if (page == 0) {
                // Slide 0: "Продолжить"
                Column(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        text = stringResource(R.string.home_continue),
                        style = MaterialTheme.typography.titleSmall.copy(
                            fontSize = 15.sp,
                            fontWeight = FontWeight.SemiBold,
                        ),
                        color = Color(0xFFCFD8D6),
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        text = continueTrack?.title ?: "Dead Inside (Slowed + Reverb)",
                        style = MaterialTheme.typography.headlineLarge.copy(
                            fontSize = 38.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = (-1.5).sp,
                            lineHeight = 40.sp,
                        ),
                        color = VotifyColors.TextPrimary,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Spacer(Modifier.height(2.dp))
                    Text(
                        text = continueTrack?.artist ?: "АДЛИН",
                        style = MaterialTheme.typography.titleMedium.copy(
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Normal,
                        ),
                        color = VotifyColors.TextMuted,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.clickable {
                            if (continueTrack != null) onOpenArtist(continueTrack.artist)
                        },
                    )
                    Spacer(Modifier.height(14.dp))
                    val heroPlaySource0 = remember { MutableInteractionSource() }
                    Surface(
                        onClick = {
                            if (continueTrack != null) {
                                if (playerState.current?.id == continueTrack.id) {
                                    onPlayPause()
                                } else {
                                    val list = listOf(continueTrack) + (recent + wave).filter { it.id != continueTrack.id }
                                    onPlay(list, 0)
                                }
                            }
                        },
                        interactionSource = heroPlaySource0,
                        shape = RoundedCornerShape(26.dp),
                        color = MaterialTheme.colorScheme.onSurface,
                        modifier = Modifier
                            .height(52.dp)
                            .pressBounce(heroPlaySource0, pressedScale = 0.94f),
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 28.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                        ) {
                            val isContinuePlaying = playerState.isPlaying && playerState.current?.id == continueTrack?.id
                            Icon(
                                imageVector = if (isContinuePlaying) Icons.Filled.Pause else Icons.Filled.PlayArrow,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.surface,
                                modifier = Modifier.size(18.dp),
                            )
                            Text(
                                text = if (isContinuePlaying) stringResource(R.string.home_pause_btn) else stringResource(R.string.home_play_btn),
                                style = MaterialTheme.typography.titleMedium.copy(
                                    fontSize = 17.sp,
                                    fontWeight = FontWeight.SemiBold,
                                ),
                                color = MaterialTheme.colorScheme.surface,
                            )
                        }
                    }
                }
            } else {
                // Slide 1: "Персональный поток / Моя волна"
                Column(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        text = stringResource(R.string.home_personal_flow),
                        style = MaterialTheme.typography.titleSmall.copy(
                            fontSize = 15.sp,
                            fontWeight = FontWeight.SemiBold,
                        ),
                        color = VotifyColors.TextMuted,
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        text = stringResource(R.string.home_wave_title),
                        style = MaterialTheme.typography.headlineLarge.copy(
                            fontSize = 38.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = (-1.5).sp,
                            lineHeight = 40.sp,
                        ),
                        color = VotifyColors.TextPrimary,
                        maxLines = 1,
                    )
                    Spacer(Modifier.height(2.dp))
                    Text(
                        text = stringResource(R.string.home_wave_sub),
                        style = MaterialTheme.typography.titleMedium.copy(
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Normal,
                        ),
                        color = VotifyColors.TextMuted,
                        maxLines = 1,
                    )
                    Spacer(Modifier.height(14.dp))
                    val heroPlaySource1 = remember { MutableInteractionSource() }
                    Surface(
                        onClick = {
                            if (wave.isNotEmpty()) {
                                onPlay(wave, 0)
                            }
                        },
                        interactionSource = heroPlaySource1,
                        shape = RoundedCornerShape(26.dp),
                        color = MaterialTheme.colorScheme.onSurface,
                        modifier = Modifier
                            .height(52.dp)
                            .pressBounce(heroPlaySource1, pressedScale = 0.94f),
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 28.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                        ) {
                            Icon(
                                imageVector = Icons.Filled.PlayArrow,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.surface,
                                modifier = Modifier.size(18.dp),
                            )
                            Text(
                                text = stringResource(R.string.home_listen_wave),
                                style = MaterialTheme.typography.titleMedium.copy(
                                    fontSize = 17.sp,
                                    fontWeight = FontWeight.SemiBold,
                                ),
                                color = MaterialTheme.colorScheme.surface,
                            )
                        }
                    }
                }
            }
        }

        Spacer(Modifier.height(12.dp))

        // Hero Dots (.hero-dots in rize(3).html)
        Row(
            modifier = Modifier.padding(horizontal = 18.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            (0..1).forEach { index ->
                val isActive = heroPagerState.currentPage == index
                val width by animateDpAsState(
                    targetValue = if (isActive) 18.dp else 6.dp,
                    animationSpec = tween(durationMillis = 250),
                    label = "heroDotWidth$index"
                )
                Box(
                    modifier = Modifier
                        .size(width = width, height = 6.dp)
                        .clip(RoundedCornerShape(999.dp))
                        .background(if (isActive) VotifyColors.TextPrimary else VotifyColors.TextPrimary.copy(alpha = 0.28f))
                        .clickable {
                            coroutineScope.launch {
                                heroPagerState.animateScrollToPage(index)
                            }
                        }
                )
            }
        }
    }
}

/** Reusable section header matching .section-title in rize(3).html with inline chevron */
@Composable
private fun HomeSectionHeader(
    title: String,
    onClick: (() -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
            .padding(horizontal = 18.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.titleMedium.copy(
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = (-0.4).sp,
            ),
            color = VotifyColors.TextPrimary,
        )
        Icon(
            imageVector = Icons.AutoMirrored.Outlined.KeyboardArrowRight,
            contentDescription = null,
            tint = VotifyColors.TextMuted,
            modifier = Modifier.size(18.dp),
        )
    }
}

@Composable
private fun TrackCard(
    track: Track,
    onClick: () -> Unit,
) {
    val interactionSource = remember { MutableInteractionSource() }
    Column(
        modifier = Modifier
            .width(138.dp)
            .pressBounce(interactionSource, pressedScale = 0.94f)
            .clickable(
                interactionSource = interactionSource,
                indication = null,
                onClick = onClick,
            ),
    ) {
        Box(
            modifier = Modifier
                .size(138.dp)
                .clip(RoundedCornerShape(26.dp))
                .background(MaterialTheme.colorScheme.surfaceContainerHigh),
        ) {
            Artwork(
                url = track.cover,
                size = 138.dp,
                shape = RoundedCornerShape(26.dp),
                contentDescription = track.title,
                modifier = Modifier.fillMaxSize(),
            )
            // Circular play badge
            Surface(
                shape = CircleShape,
                color = Color.White.copy(alpha = 0.92f),
                shadowElevation = 4.dp,
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(8.dp)
                    .size(36.dp),
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = Icons.Filled.PlayArrow,
                        contentDescription = null,
                        tint = Color(0xFF0A0A0A),
                        modifier = Modifier.size(16.dp),
                    )
                }
            }
        }
        Spacer(Modifier.height(8.dp))
        Text(
            text = track.title,
            style = MaterialTheme.typography.bodyMedium.copy(fontSize = 14.sp),
            fontWeight = FontWeight.SemiBold,
            color = VotifyColors.TextPrimary,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Spacer(Modifier.height(2.dp))
        Text(
            text = track.artist,
            style = MaterialTheme.typography.bodySmall.copy(fontSize = 12.sp),
            color = Color(0xFF9A9A9A),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

@Composable
private fun PlaylistCard(
    playlist: HomePlaylistItem,
    onClick: () -> Unit,
) {
    val interactionSource = remember { MutableInteractionSource() }
    Column(
        modifier = Modifier
            .width(138.dp)
            .pressBounce(interactionSource, pressedScale = 0.94f)
            .clickable(
                interactionSource = interactionSource,
                indication = null,
                onClick = onClick,
            ),
    ) {
        Box(
            modifier = Modifier
                .size(138.dp)
                .clip(RoundedCornerShape(26.dp))
                .background(MaterialTheme.colorScheme.surfaceContainerHigh),
        ) {
            Artwork(
                url = playlist.cover,
                size = 138.dp,
                shape = RoundedCornerShape(26.dp),
                contentDescription = playlist.name,
                modifier = Modifier.fillMaxSize(),
            )
            // Circular play badge
            Surface(
                shape = CircleShape,
                color = Color.White.copy(alpha = 0.92f),
                shadowElevation = 4.dp,
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(8.dp)
                    .size(36.dp),
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = Icons.Filled.PlayArrow,
                        contentDescription = null,
                        tint = Color(0xFF0A0A0A),
                        modifier = Modifier.size(16.dp),
                    )
                }
            }
        }
        Spacer(Modifier.height(8.dp))
        Text(
            text = playlist.name,
            style = MaterialTheme.typography.bodyMedium.copy(fontSize = 14.sp),
            fontWeight = FontWeight.SemiBold,
            color = VotifyColors.TextPrimary,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Spacer(Modifier.height(2.dp))
        Text(
            text = playlist.subtitle,
            style = MaterialTheme.typography.bodySmall.copy(fontSize = 12.sp),
            color = Color(0xFF9A9A9A),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

@Composable
private fun ArtistCard(
    artist: HomeArtistItem,
    onClick: () -> Unit,
) {
    val interactionSource = remember { MutableInteractionSource() }
    Column(
        modifier = Modifier
            .width(138.dp)
            .pressBounce(interactionSource, pressedScale = 0.94f)
            .clickable(
                interactionSource = interactionSource,
                indication = null,
                onClick = onClick,
            ),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier = Modifier
                .size(138.dp)
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.surfaceContainerHigh),
            contentAlignment = Alignment.Center,
        ) {
            Artwork(
                url = artist.avatarUrl,
                size = 138.dp,
                shape = CircleShape,
                contentDescription = artist.name,
                modifier = Modifier.fillMaxSize(),
            )
        }
        Spacer(Modifier.height(8.dp))
        Text(
            text = artist.name,
            style = MaterialTheme.typography.bodyMedium.copy(fontSize = 14.sp),
            fontWeight = FontWeight.SemiBold,
            color = VotifyColors.TextPrimary,
            textAlign = TextAlign.Center,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(2.dp))
        Text(
            text = stringResource(R.string.home_author_label),
            style = MaterialTheme.typography.bodySmall.copy(fontSize = 12.sp),
            color = VotifyColors.TextMuted,
            textAlign = TextAlign.Center,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

@Composable
private fun ReleaseCard(
    release: HomeReleaseItem,
    onClick: () -> Unit,
) {
    Column(
        modifier = Modifier
            .width(138.dp)
            .clickable(onClick = onClick),
    ) {
        Box(
            modifier = Modifier
                .size(138.dp)
                .clip(RoundedCornerShape(26.dp))
                .background(MaterialTheme.colorScheme.surfaceContainerHigh),
        ) {
            Artwork(
                url = release.cover,
                size = 138.dp,
                shape = RoundedCornerShape(26.dp),
                contentDescription = release.title,
                modifier = Modifier.fillMaxSize(),
            )
            // Circular play badge
            Surface(
                shape = CircleShape,
                color = Color.White.copy(alpha = 0.92f),
                shadowElevation = 4.dp,
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(8.dp)
                    .size(36.dp),
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = Icons.Filled.PlayArrow,
                        contentDescription = null,
                        tint = Color(0xFF0A0A0A),
                        modifier = Modifier.size(16.dp),
                    )
                }
            }
        }
        Spacer(Modifier.height(8.dp))
        Text(
            text = release.title,
            style = MaterialTheme.typography.bodyMedium.copy(fontSize = 14.sp),
            fontWeight = FontWeight.SemiBold,
            color = VotifyColors.TextPrimary,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Spacer(Modifier.height(2.dp))
        Text(
            text = release.artist,
            style = MaterialTheme.typography.bodySmall.copy(fontSize = 12.sp),
            color = Color(0xFF9A9A9A),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

/** Spotify green circular badge for tracks. */
@Composable
private fun SpotifyBadge(modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .size(24.dp)
            .clip(CircleShape)
            .background(Color(0xFF1DB954))
            .border(0.5.dp, Color.White.copy(alpha = 0.25f), CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Canvas(modifier = Modifier.size(14.dp)) {
            val stroke = Stroke(
                width = 1.8.dp.toPx(),
                cap = StrokeCap.Round,
            )
            val w = size.width
            val h = size.height
            // Top arc
            val p1 = Path().apply {
                moveTo(w * 0.18f, h * 0.38f)
                quadraticTo(w * 0.52f, h * 0.22f, w * 0.82f, h * 0.32f)
            }
            drawPath(p1, Color.Black, style = stroke)
            // Middle arc
            val p2 = Path().apply {
                moveTo(w * 0.24f, h * 0.56f)
                quadraticTo(w * 0.52f, h * 0.44f, w * 0.76f, h * 0.52f)
            }
            drawPath(p2, Color.Black, style = stroke)
            // Bottom arc
            val p3 = Path().apply {
                moveTo(w * 0.30f, h * 0.74f)
                quadraticTo(w * 0.52f, h * 0.64f, w * 0.70f, h * 0.70f)
            }
            drawPath(p3, Color.Black, style = stroke)
        }
    }
}

/** Release badge (vinyl disc icon). */
@Composable
private fun ReleaseBadge(modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .size(24.dp)
            .clip(CircleShape)
            .background(Color(0xFF181818))
            .border(0.5.dp, Color.White.copy(alpha = 0.25f), CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Canvas(modifier = Modifier.size(13.dp)) {
            val stroke = Stroke(width = 1.2.dp.toPx())
            drawCircle(Color.White, radius = size.minDimension * 0.45f, style = stroke)
            drawCircle(Color.White, radius = size.minDimension * 0.15f)
        }
    }
}

@Composable
private fun QuickTile(
    title: String,
    subtitle: String,
    icon: ImageVector,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    VotifyCard(modifier.aspectRatio(1.55f), onClick = onClick, contentPadding = PaddingValues(14.dp)) {
        Box(Modifier.fillMaxSize()) {
            Icon(icon, null, tint = VotifyColors.TextMuted.copy(alpha = 0.35f), modifier = Modifier.align(Alignment.TopEnd).size(28.dp))
            Column(Modifier.align(Alignment.BottomStart)) {
                Text(title, style = MaterialTheme.typography.titleSmall, color = VotifyColors.TextPrimary, fontWeight = FontWeight.SemiBold)
                Text(subtitle, style = MaterialTheme.typography.bodySmall, color = VotifyColors.TextMuted)
            }
        }
    }
}


