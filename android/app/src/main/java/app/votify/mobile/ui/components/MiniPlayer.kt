package app.votify.mobile.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.ui.unit.sp
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import kotlinx.coroutines.launch
import kotlin.math.abs
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.core.graphics.drawable.toBitmap
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import app.votify.mobile.R
import app.votify.mobile.player.PlayerUiState
import app.votify.mobile.ui.components.rememberGlassSpec
import app.votify.mobile.ui.components.votifyGlass
import app.votify.mobile.ui.theme.VotifyColors

/** Visual style of the mini-player (Плеер → Мини-плеер settings). */
data class MiniStyle(
    val pillShape: Boolean = true,
    val cornerRadiusDp: Dp? = null,
    val roundCover: Boolean = false,
    val ringProgress: Boolean = false,
    val barProgress: Boolean = true,
    val showLike: Boolean = true,
    val filledPlay: Boolean = true,
    val artworkTint: Boolean = false,
)

private enum class MiniDragDirection { NONE, HORIZONTAL, VERTICAL_DOWN, VERTICAL_UP }

/**
 * Docked mini-player from the design: 64dp tall, 8dp side margins, #1E1E1E @ 90% with a
 * #383838 hairline, 44dp artwork, title/artist, ♥ and a 36dp white play/pause disc,
 * 2px progress track along the bottom edge.
 */
@Composable
fun MiniPlayer(
    state: PlayerUiState,
    isFavorite: Boolean,
    onClick: () -> Unit,
    onPlayPause: () -> Unit,
    onToggleFavorite: () -> Unit,
    onSwipeLeft: () -> Unit = {},
    onSwipeRight: () -> Unit = {},
    onDismiss: () -> Unit = {},
    style: MiniStyle = MiniStyle(),
    /** Источник размытия: по умолчанию фон; передаётся состояние контента, как у панели. */
    hazeState: dev.chrisbanes.haze.HazeState? = null,
    modifier: Modifier = Modifier,
) {
    val track = state.current ?: return
    val shape = if (style.cornerRadiusDp != null) RoundedCornerShape(style.cornerRadiusDp) else RoundedCornerShape(999.dp)
    val tint = if (style.artworkTint) rememberDominantTint(track.cover) else null

    val density = LocalDensity.current
    val scope = rememberCoroutineScope()
    val offsetY = remember { Animatable(0f) }
    val dismissThresholdPx = with(density) { 30.dp.toPx() }

    val coverScale = remember { Animatable(1f) }
    LaunchedEffect(track.id, state.isPlaying) {
        if (state.isPlaying) {
            coverScale.snapTo(0.88f)
            coverScale.animateTo(1f, spring(dampingRatio = 0.52f, stiffness = 420f))
        }
    }

    val infiniteTransition = rememberInfiniteTransition(label = "miniCoverSpin")
    val coverRotation by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 16000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart,
        ),
        label = "miniCoverRotation",
    )

    val playScale by animateFloatAsState(
        targetValue = if (state.isPlaying) 1.0f else 0.92f,
        animationSpec = spring(dampingRatio = 0.5f, stiffness = 500f),
        label = "miniPlayScale",
    )

    LaunchedEffect(track.id) {
        offsetY.snapTo(0f)
    }

    // Единая формула стекла: та же, что у нижней панели.
    val spec = rememberGlassSpec()
    val isGlass = spec.enabled
    val isTransparent = isGlass
    val alphaFraction = if (isTransparent) spec.alphaFraction else 0.92f

    val baseBg = tint ?: VotifyColors.SurfaceContainer
    val borderModifier = if (isTransparent || alphaFraction < 1f) {
        Modifier.border(
            width = 0.5.dp,
            color = Color.White.copy(alpha = spec.borderAlpha),
            shape = shape,
        )
    } else {
        Modifier.border(0.5.dp, VotifyColors.SurfaceContainerHighest.copy(alpha = 0.4f), shape)
    }

    Box(
        modifier
            .padding(horizontal = 8.dp)
            .fillMaxWidth()
            .height(68.dp)
            .graphicsLayer {
                translationY = offsetY.value
                alpha = (1f - (offsetY.value / 180f)).coerceIn(0.1f, 1f)
            }
            .clip(shape)
            // Настоящее матовое стекло — та же формула, что у нижней панели.
            .votifyGlass(
                shape = shape,
                baseColor = baseBg,
                spec = spec,
                hazeState = hazeState ?: LocalHazeState.current,
            )
            .then(borderModifier)
            .clickable(onClick = onClick)
            .pointerInput(onSwipeLeft, onSwipeRight, onDismiss, onClick) {
                var totalX = 0f
                var totalY = 0f
                var isDragging = false

                detectDragGestures(
                    onDragStart = {
                        totalX = 0f
                        totalY = 0f
                        isDragging = false
                    },
                    onDragEnd = {
                        if (!isDragging || (abs(totalX) <= 15f && abs(totalY) <= 15f)) {
                            // Tap detected inside gesture
                            onClick()
                        } else if (abs(totalY) > abs(totalX)) {
                            if (totalY > 30f) {
                                // Swipe down to dismiss
                                scope.launch {
                                    offsetY.animateTo(220f, tween(120))
                                    onDismiss()
                                }
                            } else if (totalY < -24f) {
                                // Swipe up to open full player
                                scope.launch {
                                    offsetY.animateTo(0f, tween(100))
                                    onClick()
                                }
                            } else {
                                scope.launch { offsetY.animateTo(0f, tween(140)) }
                            }
                        } else {
                            scope.launch { offsetY.animateTo(0f, tween(140)) }
                            if (totalX < -50f) {
                                onSwipeLeft()
                            } else if (totalX > 50f) {
                                onSwipeRight()
                            }
                        }
                    },
                    onDragCancel = {
                        scope.launch { offsetY.animateTo(0f, tween(140)) }
                    },
                    onDrag = { change, dragAmount ->
                        change.consume()
                        totalX += dragAmount.x
                        totalY += dragAmount.y
                        if (abs(totalX) > 6f || abs(totalY) > 6f) {
                            isDragging = true
                        }

                        if (totalY > 0) {
                            scope.launch { offsetY.snapTo(totalY) }
                        } else if (totalY < 0) {
                            scope.launch { offsetY.snapTo((totalY * 0.45f).coerceAtLeast(-40f)) }
                        }
                    },
                )
            },
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .fillMaxHeight()
                .padding(start = 8.dp, end = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            // 52x52 circular cover with slow spin animation when playing (matching rize(3).html)
            Artwork(
                url = track.cover,
                size = 52.dp,
                shape = CircleShape,
                modifier = Modifier
                    .clip(CircleShape)
                    .graphicsLayer {
                        scaleX = coverScale.value
                        scaleY = coverScale.value
                        rotationZ = if (state.isPlaying) coverRotation else 0f
                    },
            )

            Spacer(Modifier.width(12.dp))

            Column(Modifier.weight(1f)) {
                Text(
                    text = track.title,
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontSize = 15.sp,
                        fontWeight = FontWeight.SemiBold,
                    ),
                    color = VotifyColors.TextPrimary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    text = track.artist,
                    style = MaterialTheme.typography.bodySmall.copy(
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Normal,
                    ),
                    color = VotifyColors.TextMuted,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }

            Spacer(Modifier.width(8.dp))

            // Action buttons on right: Like button + Clean Play Button
            if (style.showLike) {
                IconButton(
                    onClick = onToggleFavorite,
                    modifier = Modifier.size(36.dp),
                ) {
                    Icon(
                        imageVector = if (isFavorite) Icons.Filled.Favorite else Icons.Outlined.FavoriteBorder,
                        contentDescription = stringResource(R.string.player_favorite),
                        tint = if (isFavorite) Color(0xFFFF3B5C) else VotifyColors.TextPrimary,
                        modifier = Modifier.size(22.dp),
                    )
                }
                Spacer(Modifier.width(4.dp))
            }

            // Clean Play Button: simple triangle/pause icon matching theme
            IconButton(
                onClick = onPlayPause,
                modifier = Modifier
                    .size(38.dp)
                    .graphicsLayer {
                        scaleX = playScale
                        scaleY = playScale
                    },
            ) {
                if (state.isBuffering && !state.isPlaying) {
                    CircularProgressIndicator(
                        color = VotifyColors.TextPrimary,
                        strokeWidth = 2.dp,
                        modifier = Modifier.size(18.dp),
                    )
                } else {
                    Icon(
                        imageVector = if (state.isPlaying) Icons.Filled.Pause else Icons.Filled.PlayArrow,
                        contentDescription = stringResource(if (state.isPlaying) R.string.player_pause else R.string.player_play),
                        tint = VotifyColors.TextPrimary,
                        modifier = Modifier.size(24.dp),
                    )
                }
            }
        }

        // 2px progress line along the bottom edge
        if (style.barProgress) {
            Box(
                Modifier
                    .align(Alignment.BottomStart)
                    .fillMaxWidth()
                    .height(2.dp)
                    .background(VotifyColors.SurfaceContainerHigh),
            ) {
                Box(
                    Modifier
                        .fillMaxWidth(state.progress)
                        .fillMaxHeight()
                        .background(VotifyColors.Primary),
                )
            }
        }
    }
}

/** Dominant cover color for the tinted mini-player background. */
@Composable
private fun rememberDominantTint(cover: String?): Color? {
    if (cover.isNullOrBlank()) return null
    val context = androidx.compose.ui.platform.LocalContext.current
    var tint by androidx.compose.runtime.remember(cover) { androidx.compose.runtime.mutableStateOf<Color?>(null) }
    androidx.compose.runtime.LaunchedEffect(cover) {
        runCatching {
            val loader = coil.Coil.imageLoader(context)
            val request = coil.request.ImageRequest.Builder(context).data(cover).size(64).allowHardware(false).build()
            val bitmap = loader.execute(request).drawable?.let { d ->
                (d as? android.graphics.drawable.BitmapDrawable)?.bitmap ?: d.toBitmap()
            }
            tint = bitmap?.let {
                androidx.palette.graphics.Palette.from(it).clearFilters().generate()
                    .dominantSwatch?.let { sw -> Color(sw.rgb).copy(alpha = 0.45f) }
            }
        }
    }
    return tint
}

