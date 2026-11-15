package app.votify.mobile.ui.account

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.AlternateEmail
import androidx.compose.material.icons.outlined.Chat
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.ContentCopy
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.ExitToApp
import androidx.compose.material.icons.outlined.FormatQuote
import androidx.compose.material.icons.outlined.Group
import androidx.compose.material.icons.outlined.Link
import androidx.compose.material.icons.outlined.MusicNote
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.PlayArrow
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Send
import androidx.compose.material.icons.outlined.SentimentSatisfied
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.Star
import androidx.compose.material.icons.outlined.Upload
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.core.graphics.drawable.toBitmap
import androidx.palette.graphics.Palette
import coil.compose.AsyncImage
import coil.imageLoader
import coil.request.ImageRequest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import app.votify.mobile.R
import app.votify.mobile.data.FavTrackInfo
import app.votify.mobile.data.local.PlaylistSummary
import app.votify.mobile.ui.components.Artwork
import app.votify.mobile.ui.theme.VotifyColors

private val BgDark = Color(0xFF0C0C0E)
private val SurfaceDark = Color(0xFF141418)
private val Surface2Dark = Color(0xFF1C1C22)
private val AccentDarkBtn = Color(0xFFF3F4F6)
private val TextDarkBtn = Color(0xFF0C0C0E)
private val TextMuted = Color(0xFF8E8E93)
private val BorderLine = Color(0x1AFFFFFF)

/** Profile screen matching the official atmospheric phone HTML design 1:1. */
@Composable
fun ProfileScreen(
    viewModel: ProfileViewModel,
    contentPadding: PaddingValues,
    onBack: () -> Unit,
    onOpenFriends: () -> Unit,
    onOpenSettings: () -> Unit = {},
    onToast: (String) -> Unit,
    onPlayFav: (FavTrackInfo) -> Unit,
    onOpenLogin: () -> Unit,
    onLogout: () -> Unit,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val playlists by viewModel.playlists.collectAsStateWithLifecycle()
    val clipboard = LocalClipboardManager.current

    val avatarPicker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        uri?.let(viewModel::onAvatarPicked)
    }
    val bannerPicker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        uri?.let(viewModel::onBannerPicked)
    }

    LaunchedEffect(viewModel) {
        viewModel.events.collect { e ->
            if (e is ProfileEvent.Message) onToast(e.text)
        }
    }

    val p = state.profile
    val guest = state.isGuest
    val profName = (p?.name ?: "").takeIf { it.isNotBlank() }
        ?: if (guest) stringResource(R.string.profile_guest_name) else state.fallbackName
    val profHandle = (p?.handle ?: "").takeIf { it.isNotBlank() }
        ?: if (guest) "guest" else state.fallbackHandle

    Box(
        Modifier
            .fillMaxSize()
            .background(BgDark)
    ) {
        // Atmospheric top dark subtle glow
        Box(
            Modifier
                .fillMaxWidth()
                .height(380.dp)
                .background(
                    Brush.verticalGradient(
                        listOf(
                            Color(0x18FFFFFF),
                            Color(0x06FFFFFF),
                            Color.Transparent,
                        )
                    )
                )
        )

        Column(
            Modifier
                .fillMaxSize()
                .padding(
                    top = contentPadding.calculateTopPadding(),
                    bottom = contentPadding.calculateBottomPadding() + 16.dp,
                )
        ) {
            // Top Navigation Bar
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 18.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Surface(
                    shape = CircleShape,
                    color = Color(0x14FFFFFF),
                    modifier = Modifier
                        .size(40.dp)
                        .clickable(onClick = {
                            if (state.editing) viewModel.cancelEdit() else onBack()
                        }),
                ) {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Icon(
                            Icons.AutoMirrored.Outlined.ArrowBack,
                            contentDescription = stringResource(R.string.nav_back),
                            tint = Color.White,
                            modifier = Modifier.size(20.dp),
                        )
                    }
                }

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Surface(
                        shape = CircleShape,
                        color = Color(0x14FFFFFF),
                        modifier = Modifier
                            .size(40.dp)
                            .clickable(onClick = onOpenFriends),
                    ) {
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            Icon(Icons.Outlined.Group, contentDescription = stringResource(R.string.friends_title), tint = Color.White, modifier = Modifier.size(18.dp))
                        }
                    }
                    Surface(
                        shape = CircleShape,
                        color = Color(0x14FFFFFF),
                        modifier = Modifier
                            .size(40.dp)
                            .clickable(onClick = onOpenSettings),
                    ) {
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            Icon(Icons.Outlined.Settings, contentDescription = stringResource(R.string.nav_settings), tint = Color.White, modifier = Modifier.size(18.dp))
                        }
                    }
                    if (!guest) {
                        Surface(
                            shape = CircleShape,
                            color = Color(0x22EF4444),
                            modifier = Modifier
                                .size(40.dp)
                                .clickable(onClick = onLogout),
                        ) {
                            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                Icon(Icons.Outlined.ExitToApp, contentDescription = stringResource(R.string.profile_logout), tint = Color(0xFFEF4444), modifier = Modifier.size(18.dp))
                            }
                        }
                    } else {
                        Surface(
                            shape = CircleShape,
                            color = Color(0x14FFFFFF),
                            modifier = Modifier
                                .size(40.dp)
                                .clickable(onClick = onOpenLogin),
                        ) {
                            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                Icon(Icons.Outlined.Person, contentDescription = stringResource(R.string.profile_login_short), tint = Color.White, modifier = Modifier.size(18.dp))
                            }
                        }
                    }
                }
            }

            if (state.loading && !guest && p == null) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = Color.White)
                }
            } else {
                Column(
                    Modifier
                        .weight(1f)
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = 18.dp, vertical = 8.dp),
                ) {
                    if (!state.editing) {
                        // --- VIEW 1: DISPLAY PROFILE ---
                        Spacer(Modifier.height(8.dp))

                        // Avatar with pen badge
                        Box(
                            modifier = Modifier
                                .size(116.dp)
                                .align(Alignment.CenterHorizontally),
                        ) {
                            AvatarBox(
                                url = state.stagedAvatar ?: (p?.avatar ?: "").takeIf { it.isNotBlank() } ?: "",
                                size = 116.dp,
                                border = false,
                            )
                            if (!guest) {
                                Surface(
                                    shape = CircleShape,
                                    color = SurfaceDark,
                                    border = BorderStroke(2.dp, BgDark),
                                    modifier = Modifier
                                        .align(Alignment.BottomEnd)
                                        .size(36.dp)
                                        .clickable {
                                            avatarPicker.launch(
                                                PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
                                            )
                                        },
                                ) {
                                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                        Icon(
                                            Icons.Outlined.Edit,
                                            contentDescription = stringResource(R.string.profile_change_avatar),
                                            tint = Color.White,
                                            modifier = Modifier.size(16.dp),
                                        )
                                    }
                                }
                            }
                        }

                        Spacer(Modifier.height(14.dp))

                        // Nickname & Handle
                        Text(
                            profName,
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.ExtraBold,
                            color = Color.White,
                            textAlign = TextAlign.Center,
                            fontSize = 26.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.fillMaxWidth(),
                        )
                        Spacer(Modifier.height(2.dp))
                        Text(
                            "@$profHandle",
                            style = MaterialTheme.typography.bodyMedium,
                            color = TextMuted,
                            fontSize = 14.sp,
                            textAlign = TextAlign.Center,
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    clipboard.setText(AnnotatedString("@$profHandle"))
                                    onToast("@$profHandle")
                                }
                                .padding(vertical = 2.dp),
                        )

                        // About bio
                        if (!p?.about.isNullOrBlank()) {
                            Text(
                                p?.about.orEmpty(),
                                style = MaterialTheme.typography.bodySmall,
                                color = Color(0xFFCCCCCC),
                                textAlign = TextAlign.Center,
                                fontSize = 14.sp,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(top = 10.dp, start = 12.dp, end = 12.dp),
                            )
                        }

                        // Social integration chips
                        val hasTg = !p?.tg.isNullOrBlank()
                        val hasDs = !p?.ds.isNullOrBlank()
                        val hasSite = !p?.site.isNullOrBlank()
                        if (hasTg || hasDs || hasSite) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(top = 16.dp)
                                    .horizontalScroll(rememberScrollState()),
                                horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                if (hasTg) {
                                    Surface(
                                        shape = RoundedCornerShape(99.dp),
                                        color = SurfaceDark,
                                        border = BorderStroke(1.dp, BorderLine),
                                        modifier = Modifier.clickable {
                                            clipboard.setText(AnnotatedString(p?.tg.orEmpty()))
                                            onToast("Telegram: ${p?.tg}")
                                        },
                                    ) {
                                        Row(Modifier.padding(horizontal = 13.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                                            Icon(Icons.Outlined.Send, null, tint = Color(0xFF29B6F6), modifier = Modifier.size(16.dp))
                                            Text("@${p?.tg.orEmpty().removePrefix("@")}", color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                                        }
                                    }
                                }
                                if (hasDs) {
                                    Surface(
                                        shape = RoundedCornerShape(99.dp),
                                        color = SurfaceDark,
                                        border = BorderStroke(1.dp, BorderLine),
                                        modifier = Modifier.clickable {
                                            clipboard.setText(AnnotatedString(p?.ds.orEmpty()))
                                            onToast("Discord: ${p?.ds}")
                                        },
                                    ) {
                                        Row(Modifier.padding(horizontal = 13.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                                            Icon(Icons.Outlined.Chat, null, tint = Color(0xFF7289DA), modifier = Modifier.size(16.dp))
                                            Text(p?.ds.orEmpty(), color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                                        }
                                    }
                                }
                                if (hasSite) {
                                    Surface(
                                        shape = RoundedCornerShape(99.dp),
                                        color = SurfaceDark,
                                        border = BorderStroke(1.dp, BorderLine),
                                        modifier = Modifier.clickable {
                                            clipboard.setText(AnnotatedString(p?.site.orEmpty()))
                                            onToast(p?.site.orEmpty())
                                        },
                                    ) {
                                        Row(Modifier.padding(horizontal = 13.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                                            Icon(Icons.Outlined.Link, null, tint = Color(0xFFB0B0B0), modifier = Modifier.size(16.dp))
                                            val d = p?.site.orEmpty().removePrefix("https://").removePrefix("http://").removeSuffix("/")
                                            Text(d, color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                                        }
                                    }
                                }
                            }
                        }

                        // Action Buttons: Редактировать & Опубликовать
                        Spacer(Modifier.height(20.dp))
                        Row(
                            Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                        ) {
                            if (!guest) {
                                Button(
                                    onClick = viewModel::startEdit,
                                    shape = RoundedCornerShape(18.dp),
                                    colors = ButtonDefaults.buttonColors(
                                        containerColor = AccentDarkBtn,
                                        contentColor = TextDarkBtn,
                                    ),
                                    modifier = Modifier
                                        .weight(1f)
                                        .height(50.dp),
                                ) {
                                    Text(stringResource(R.string.profile_edit), fontWeight = FontWeight.Bold, fontSize = 15.sp)
                                }
                                Button(
                                    onClick = viewModel::publish,
                                    enabled = !state.publishing,
                                    shape = RoundedCornerShape(18.dp),
                                    colors = ButtonDefaults.buttonColors(
                                        containerColor = Surface2Dark,
                                        contentColor = Color.White,
                                    ),
                                    border = BorderStroke(1.dp, BorderLine),
                                    modifier = Modifier
                                        .weight(1f)
                                        .height(50.dp),
                                ) {
                                    if (state.publishing) {
                                        CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp, color = Color.White)
                                        Spacer(Modifier.width(6.dp))
                                    }
                                    Text(stringResource(R.string.profile_publish), fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
                                }
                            } else {
                                Button(
                                    onClick = onOpenLogin,
                                    shape = RoundedCornerShape(18.dp),
                                    colors = ButtonDefaults.buttonColors(
                                        containerColor = AccentDarkBtn,
                                        contentColor = TextDarkBtn,
                                    ),
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(50.dp),
                                ) {
                                    Text(stringResource(R.string.profile_login_btn), fontWeight = FontWeight.Bold, fontSize = 15.sp)
                                }
                            }
                        }

                        // Section: Закреплённый трек
                        Spacer(Modifier.height(24.dp))
                        Row(
                            Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                "Закреплённый трек",
                                fontWeight = FontWeight.Bold,
                                fontSize = 15.sp,
                                color = Color.White,
                            )
                            if (!guest) {
                                TextButton(onClick = viewModel::startEdit) {
                                    Text("Изменить", color = Color(0xFFD4D4D8), fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                                }
                            }
                        }
                        Spacer(Modifier.height(8.dp))

                        val fav = p?.favTrack
                        if (fav != null) {
                            Surface(
                                shape = RoundedCornerShape(20.dp),
                                color = SurfaceDark,
                                border = BorderStroke(1.dp, BorderLine),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { onPlayFav(fav) },
                            ) {
                                Row(
                                    Modifier.fillMaxWidth().padding(12.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                                ) {
                                    Artwork(
                                        url = fav.cover,
                                        size = 56.dp,
                                        shape = RoundedCornerShape(14.dp),
                                        modifier = Modifier.size(56.dp).clip(RoundedCornerShape(14.dp)),
                                    )
                                    Column(Modifier.weight(1f)) {
                                        Text(
                                            fav.title,
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 15.sp,
                                            color = Color.White,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis,
                                        )
                                        Spacer(Modifier.height(2.dp))
                                        Text(
                                            fav.artist,
                                            fontSize = 13.sp,
                                            color = TextMuted,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis,
                                        )
                                    }
                                    Surface(
                                        shape = CircleShape,
                                        color = AccentDarkBtn,
                                        modifier = Modifier.size(42.dp),
                                    ) {
                                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                            Icon(Icons.Outlined.PlayArrow, null, tint = TextDarkBtn, modifier = Modifier.size(20.dp))
                                        }
                                    }
                                }
                            }
                        } else {
                            Surface(
                                shape = RoundedCornerShape(20.dp),
                                color = Surface2Dark,
                                border = BorderStroke(1.dp, BorderLine),
                                modifier = Modifier.fillMaxWidth(),
                            ) {
                                Box(Modifier.fillMaxWidth().padding(20.dp), contentAlignment = Alignment.Center) {
                                    Text("Ничего не закреплено", color = TextMuted, fontSize = 14.sp)
                                }
                            }
                        }

                        // Section: Плейлисты (3-column grid)
                        Spacer(Modifier.height(24.dp))
                        Text(
                            "Плейлисты",
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp,
                            color = Color.White,
                        )
                        Spacer(Modifier.height(10.dp))

                        if (playlists.isEmpty()) {
                            Surface(
                                shape = RoundedCornerShape(20.dp),
                                color = Surface2Dark,
                                border = BorderStroke(1.dp, BorderLine),
                                modifier = Modifier.fillMaxWidth(),
                            ) {
                                Box(Modifier.fillMaxWidth().padding(20.dp), contentAlignment = Alignment.Center) {
                                    Text("Плейлисты скрыты", color = TextMuted, fontSize = 14.sp)
                                }
                            }
                        } else {
                            Column(
                                Modifier.fillMaxWidth(),
                                verticalArrangement = Arrangement.spacedBy(10.dp),
                            ) {
                                playlists.chunked(3).forEach { rowItems ->
                                    Row(
                                        Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                                    ) {
                                        rowItems.forEach { pl ->
                                            Column(
                                                Modifier
                                                    .weight(1f)
                                                    .clip(RoundedCornerShape(16.dp)),
                                            ) {
                                                Artwork(
                                                    url = pl.cover ?: "",
                                                    size = 120.dp,
                                                    shape = RoundedCornerShape(16.dp),
                                                    modifier = Modifier
                                                        .fillMaxWidth()
                                                        .aspectRatio(1f)
                                                        .clip(RoundedCornerShape(16.dp)),
                                                )
                                                Spacer(Modifier.height(8.dp))
                                                Text(
                                                    pl.name,
                                                    fontWeight = FontWeight.SemiBold,
                                                    fontSize = 13.sp,
                                                    color = Color.White,
                                                    maxLines = 1,
                                                    overflow = TextOverflow.Ellipsis,
                                                )
                                                Text(
                                                    stringResource(R.string.profile_tracks_count, pl.trackCount),
                                                    fontSize = 12.sp,
                                                    color = TextMuted,
                                                    maxLines = 1,
                                                )
                                            }
                                        }
                                        for (i in 0 until (3 - rowItems.size)) {
                                            Spacer(Modifier.weight(1f))
                                        }
                                    }
                                }
                            }
                        }
                    } else {
                        // --- VIEW 2: EDIT PROFILE ---
                        Spacer(Modifier.height(8.dp))

                        // Large Avatar with pen badge
                        Box(
                            modifier = Modifier
                                .size(132.dp)
                                .align(Alignment.CenterHorizontally),
                        ) {
                            AvatarBox(
                                url = state.stagedAvatar ?: (p?.avatar ?: "").takeIf { it.isNotBlank() } ?: "",
                                size = 132.dp,
                                border = false,
                            )
                            Surface(
                                shape = CircleShape,
                                color = SurfaceDark,
                                border = BorderStroke(2.dp, BgDark),
                                modifier = Modifier
                                    .align(Alignment.BottomEnd)
                                    .size(38.dp)
                                    .clickable {
                                        avatarPicker.launch(
                                            PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
                                        )
                                    },
                            ) {
                                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                    Icon(Icons.Outlined.Edit, null, tint = Color.White, modifier = Modifier.size(16.dp))
                                }
                            }
                        }

                        Spacer(Modifier.height(20.dp))

                        // Никнейм
                        EditLabeledField(
                            label = "Никнейм",
                            icon = Icons.Outlined.Person,
                            value = state.editName,
                            maxLen = 32,
                            onValueChange = viewModel::setName,
                        )

                        Spacer(Modifier.height(14.dp))

                        // Юзернейм
                        EditLabeledField(
                            label = "Юзернейм",
                            icon = Icons.Outlined.AlternateEmail,
                            value = state.editHandle,
                            maxLen = 12,
                            onValueChange = viewModel::setHandle,
                        )
                        state.handleError?.let {
                            Text(it, color = Color(0xFFEF4444), fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp, start = 8.dp))
                        }

                        Spacer(Modifier.height(14.dp))

                        // О себе
                        EditLabeledField(
                            label = "О себе",
                            icon = Icons.Outlined.FormatQuote,
                            value = state.editAbout,
                            maxLen = 32,
                            singleLine = false,
                            placeholder = "Расскажите о себе",
                            onValueChange = viewModel::setAbout,
                        )

                        Spacer(Modifier.height(20.dp))

                        // Интеграции
                        Text("Интеграции", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = Color.White)
                        Spacer(Modifier.height(10.dp))

                        IntegrationRow(
                            icon = Icons.Outlined.Send,
                            iconColor = Color(0xFF29B6F6),
                            title = "Telegram",
                            value = state.editTg,
                            placeholder = "@username",
                            onValueChange = viewModel::setTg,
                        )

                        Spacer(Modifier.height(8.dp))

                        IntegrationRow(
                            icon = Icons.Outlined.Chat,
                            iconColor = Color(0xFF7289DA),
                            title = "Discord",
                            value = state.editDs,
                            placeholder = "username",
                            onValueChange = viewModel::setDs,
                        )

                        Spacer(Modifier.height(8.dp))

                        IntegrationRow(
                            icon = Icons.Outlined.Link,
                            iconColor = Color(0xFFB0B0B0),
                            title = "Сайт",
                            value = state.editSite,
                            placeholder = "https://...",
                            onValueChange = viewModel::setSite,
                        )

                        Spacer(Modifier.height(22.dp))

                        // Закреп
                        Text("Закреп", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = Color.White)
                        Spacer(Modifier.height(10.dp))

                        val staged = if (state.favCleared) null else (state.stagedFav ?: p?.favTrack)
                        if (staged != null) {
                            Surface(
                                shape = RoundedCornerShape(20.dp),
                                color = Surface2Dark,
                                border = BorderStroke(1.dp, BorderLine),
                                modifier = Modifier.fillMaxWidth(),
                            ) {
                                Row(
                                    Modifier.fillMaxWidth().padding(12.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                                ) {
                                    Artwork(url = staged.cover, size = 52.dp, shape = RoundedCornerShape(12.dp), modifier = Modifier.size(52.dp).clip(RoundedCornerShape(12.dp)))
                                    Column(Modifier.weight(1f)) {
                                        Text(staged.title, fontWeight = FontWeight.Bold, fontSize = 15.sp, color = Color.White, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                        Text(staged.artist, fontSize = 13.sp, color = TextMuted, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                    }
                                    IconButton(onClick = viewModel::clearFavorite) {
                                        Icon(Icons.Outlined.Close, null, tint = Color.White, modifier = Modifier.size(20.dp))
                                    }
                                }
                            }
                        } else {
                            Surface(
                                shape = RoundedCornerShape(22.dp),
                                color = Surface2Dark,
                                border = BorderStroke(1.dp, BorderLine),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable(onClick = viewModel::setFavoriteFromCurrent),
                            ) {
                                Column(
                                    Modifier.padding(20.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                    verticalArrangement = Arrangement.spacedBy(6.dp),
                                ) {
                                    Icon(Icons.Outlined.MusicNote, null, tint = TextMuted, modifier = Modifier.size(24.dp))
                                    Text("Поставить текущий трек в закреп", color = TextMuted, fontSize = 14.sp, fontWeight = FontWeight.Medium)
                                }
                            }
                        }

                        Spacer(Modifier.height(28.dp))

                        // Save & Back Buttons
                        Button(
                            onClick = viewModel::save,
                            enabled = !state.saving,
                            shape = RoundedCornerShape(18.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = AccentDarkBtn,
                                contentColor = TextDarkBtn,
                            ),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(50.dp),
                        ) {
                            if (state.saving) {
                                CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp, color = TextDarkBtn)
                                Spacer(Modifier.width(8.dp))
                            }
                            Text(stringResource(R.string.profile_save), fontWeight = FontWeight.Bold, fontSize = 16.sp)
                        }

                        Spacer(Modifier.height(10.dp))

                        Button(
                            onClick = viewModel::cancelEdit,
                            shape = RoundedCornerShape(18.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Surface2Dark,
                                contentColor = Color.White,
                            ),
                            border = BorderStroke(1.dp, BorderLine),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(50.dp),
                        ) {
                            Text(stringResource(R.string.profile_cancel), fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
                        }

                        Spacer(Modifier.height(16.dp))
                    }
                }
            }
        }
    }
}

@Composable
private fun EditLabeledField(
    label: String,
    icon: ImageVector,
    value: String,
    maxLen: Int,
    singleLine: Boolean = true,
    placeholder: String = "",
    onValueChange: (String) -> Unit,
) {
    Column(Modifier.fillMaxWidth()) {
        Text(label, fontWeight = FontWeight.Bold, fontSize = 15.sp, color = Color.White)
        Spacer(Modifier.height(6.dp))
        Surface(
            shape = RoundedCornerShape(22.dp),
            color = SurfaceDark,
            border = BorderStroke(1.dp, BorderLine),
            modifier = Modifier
                .fillMaxWidth()
                .height(if (singleLine) 56.dp else 96.dp),
        ) {
            Row(
                Modifier
                    .fillMaxSize()
                    .padding(horizontal = 16.dp, vertical = if (singleLine) 0.dp else 12.dp),
                verticalAlignment = if (singleLine) Alignment.CenterVertically else Alignment.Top,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Icon(icon, null, tint = TextMuted, modifier = Modifier.size(20.dp).padding(top = if (singleLine) 0.dp else 2.dp))
                Box(Modifier.weight(1f)) {
                    if (value.isEmpty() && placeholder.isNotEmpty()) {
                        Text(placeholder, color = TextMuted, fontSize = 16.sp)
                    }
                    BasicTextField(
                        value = value,
                        onValueChange = { if (it.length <= maxLen) onValueChange(it) },
                        singleLine = singleLine,
                        textStyle = TextStyle(color = Color.White, fontSize = 16.sp),
                        cursorBrush = SolidColor(Color.White),
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            }
        }
        Text(
            "${value.length}/$maxLen",
            color = TextMuted,
            fontSize = 12.sp,
            textAlign = TextAlign.End,
            modifier = Modifier
                .fillMaxWidth()
                .padding(end = 8.dp, top = 4.dp),
        )
    }
}

@Composable
private fun IntegrationRow(
    icon: ImageVector,
    iconColor: Color,
    title: String,
    value: String,
    placeholder: String,
    onValueChange: (String) -> Unit,
) {
    Surface(
        shape = RoundedCornerShape(20.dp),
        color = Surface2Dark,
        border = BorderStroke(1.dp, BorderLine),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Surface(shape = CircleShape, color = Color(0x14FFFFFF), modifier = Modifier.size(38.dp)) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Icon(icon, null, tint = iconColor, modifier = Modifier.size(18.dp))
                }
            }
            Column(Modifier.weight(1f)) {
                Text(title, fontWeight = FontWeight.Bold, fontSize = 15.sp, color = Color.White)
                BasicTextField(
                    value = value,
                    onValueChange = onValueChange,
                    singleLine = true,
                    textStyle = TextStyle(color = Color.White, fontSize = 13.sp),
                    cursorBrush = SolidColor(Color.White),
                    decorationBox = { inner ->
                        if (value.isEmpty()) {
                            Text(placeholder, color = TextMuted, fontSize = 13.sp)
                        }
                        inner()
                    },
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }
    }
}

@Composable
fun AvatarBox(url: String, size: androidx.compose.ui.unit.Dp, border: Boolean = false) {
    val cleanUrl = url.trim()
    val isVectorFallback = cleanUrl.isBlank() || cleanUrl.startsWith("data:image/svg")

    Surface(
        shape = CircleShape,
        color = Color(0x14FFFFFF),
        border = if (border) BorderStroke(3.dp, Color(0x33FFFFFF)) else null,
        modifier = Modifier.size(size),
    ) {
        if (!isVectorFallback) {
            Artwork(
                url = cleanUrl,
                size = size,
                shape = CircleShape,
                modifier = Modifier.fillMaxSize(),
            )
        } else {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Icon(
                    Icons.Outlined.Person,
                    contentDescription = null,
                    tint = Color(0xFFD4D4D8),
                    modifier = Modifier.size(size * 0.45f),
                )
            }
        }
    }
}

val BANNER_GRADIENTS: List<List<Color>> = listOf(
    listOf(Color(0xFF7928CA), Color(0xFFFF0080), Color(0xFF11101D)),
    listOf(Color(0xFF00F2FE), Color(0xFF4FACFE), Color(0xFF050B14)),
    listOf(Color(0xFF833AB4), Color(0xFFFD1D1D), Color(0xFFFCB045)),
    listOf(Color(0xFF10B981), Color(0xFF059669), Color(0xFF022C22)),
    listOf(Color(0xFFFF416C), Color(0xFFFF4B2B), Color(0xFF1A0505)),
    listOf(Color(0xFF00C6FF), Color(0xFF0072FF), Color(0xFF030F26)),
    listOf(Color(0xFFA855F7), Color(0xFF6366F1), Color(0xFF0F172A)),
    listOf(Color(0xFFF43F5E), Color(0xFFFB7185), Color(0xFF1E050C)),
    listOf(Color(0xFF18181B), Color(0xFF09090B)),
)

@Composable
fun BannerBox(banner: String, modifier: Modifier = Modifier) {
    val cleanBanner = banner.trim()
    val base64Bitmap = remember(cleanBanner) {
        if (cleanBanner.startsWith("data:image/") && cleanBanner.contains("base64,")) {
            runCatching {
                val b64 = cleanBanner.substringAfter("base64,")
                val bytes = android.util.Base64.decode(b64, android.util.Base64.DEFAULT)
                BitmapFactory.decodeByteArray(bytes, 0, bytes.size)?.asImageBitmap()
            }.getOrNull()
        } else null
    }

    Box(modifier) {
        val preset = cleanBanner.removePrefix("grad-").toIntOrNull()
        when {
            base64Bitmap != null -> {
                Image(
                    bitmap = base64Bitmap,
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
                )
            }
            cleanBanner.startsWith("http://") || cleanBanner.startsWith("https://") -> {
                AsyncImage(
                    model = cleanBanner,
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
                )
            }
            preset != null && preset in 1..BANNER_GRADIENTS.size -> Box(
                Modifier
                    .fillMaxSize()
                    .background(Brush.linearGradient(BANNER_GRADIENTS[preset - 1])),
            )
            else -> Box(
                Modifier
                    .fillMaxSize()
                    .background(Brush.linearGradient(listOf(Color(0xFF1E1E24), Color(0xFF2A2B36)))),
            )
        }

        Box(
            Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        colorStops = arrayOf(
                            0.0f to Color.Black.copy(alpha = 0.10f),
                            0.35f to Color(0xFF181818).copy(alpha = 0.55f),
                            0.80f to Color(0xFF181818).copy(alpha = 0.92f),
                            1.0f to Color(0xFF181818),
                        ),
                    ),
                ),
        )
    }
}

@Composable
fun rememberFavTrackBrush(coverUrl: String?): Brush {
    val context = LocalContext.current
    var dominantColor by remember(coverUrl) { mutableStateOf<Color?>(null) }

    LaunchedEffect(coverUrl) {
        val cleanUrl = coverUrl?.trim().orEmpty()
        if (cleanUrl.isBlank() || cleanUrl.startsWith("data:image/svg")) {
            dominantColor = null
            return@LaunchedEffect
        }
        withContext(Dispatchers.IO) {
            try {
                val bitmap: Bitmap? = if (cleanUrl.startsWith("data:image/") && cleanUrl.contains("base64,")) {
                    val b64 = cleanUrl.substringAfter("base64,")
                    val bytes = android.util.Base64.decode(b64, android.util.Base64.DEFAULT)
                    BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                } else {
                    val loader = context.imageLoader
                    val request = ImageRequest.Builder(context)
                        .data(cleanUrl)
                        .size(64)
                        .allowHardware(false)
                        .build()
                    loader.execute(request).drawable?.toBitmap()
                }

                if (bitmap != null) {
                    val palette = Palette.from(bitmap).maximumColorCount(16).generate()
                    val domSwatch = palette.dominantSwatch
                        ?: palette.vibrantSwatch
                        ?: palette.mutedSwatch
                    val rgb = domSwatch?.rgb
                    if (rgb != null) {
                        dominantColor = Color(rgb)
                    } else {
                        val scaled = Bitmap.createScaledBitmap(bitmap, 24, 24, false)
                        var rAcc = 0L
                        var gAcc = 0L
                        var bAcc = 0L
                        var count = 0
                        for (x in 0 until scaled.width) {
                            for (y in 0 until scaled.height) {
                                val pixel = scaled.getPixel(x, y)
                                val pr = android.graphics.Color.red(pixel)
                                val pg = android.graphics.Color.green(pixel)
                                val pb = android.graphics.Color.blue(pixel)
                                val brightness = (pr * 299 + pg * 587 + pb * 114) / 1000
                                if (brightness in 19..234) {
                                    rAcc += pr
                                    gAcc += pg
                                    bAcc += pb
                                    count++
                                }
                            }
                        }
                        if (count > 0) {
                            dominantColor = Color(
                                (rAcc / count).toInt(),
                                (gAcc / count).toInt(),
                                (bAcc / count).toInt(),
                            )
                        }
                    }
                }
            } catch (_: Throwable) {
                // Ignore fallback to null
            }
        }
    }

    return remember(dominantColor) {
        val dom = dominantColor
        if (dom != null) {
            val r = dom.red
            val g = dom.green
            val b = dom.blue
            val r1 = r * 0.55f
            val g1 = g * 0.55f
            val b1 = b * 0.55f
            val r2 = r * 0.22f
            val g2 = g * 0.22f
            val b2 = b * 0.22f

            Brush.linearGradient(
                colorStops = arrayOf(
                    0.0f to Color(red = r1, green = g1, blue = b1, alpha = 0.72f),
                    0.75f to Color(red = r2, green = g2, blue = b2, alpha = 0.95f),
                    1.0f to Color(0xFF121216),
                ),
            )
        } else {
            Brush.linearGradient(
                listOf(Color(0xFF181818), Color(0xFF181818)),
            )
        }
    }
}

@Composable
fun FavoriteTrackCard(
    fav: FavTrackInfo,
    onPlay: (FavTrackInfo) -> Unit,
    modifier: Modifier = Modifier,
) {
    val brush = rememberFavTrackBrush(fav.cover)
    val rawArtist = if (fav.artist.isNotBlank() && fav.artist != "Unknown" && fav.artist != "Неизвестный исполнитель") fav.artist else ""
    val hasArtistInTitle = rawArtist.isNotBlank() && fav.title.contains(rawArtist, ignoreCase = true)
    val displayTitle = if (rawArtist.isNotBlank() && !hasArtistInTitle) "$rawArtist - ${fav.title}" else fav.title
    val displayArtist = if (rawArtist.isNotBlank()) "<$rawArtist>" else "<unknown>"

    Box(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(brush)
            .clickable(onClick = { onPlay(fav) })
            .padding(horizontal = 18.dp, vertical = 14.dp),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Box(
                modifier = Modifier
                    .size(72.dp)
                    .clip(RoundedCornerShape(16.dp)),
            ) {
                Artwork(
                    url = fav.cover,
                    size = 72.dp,
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier.fillMaxSize(),
                )
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color.Black.copy(alpha = 0.28f)),
                    contentAlignment = Alignment.Center,
                ) {
                    Surface(
                        shape = CircleShape,
                        color = Color.Black.copy(alpha = 0.40f),
                        modifier = Modifier.size(36.dp),
                    ) {
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            Icon(
                                Icons.Outlined.PlayArrow,
                                contentDescription = stringResource(R.string.profile_play),
                                tint = Color.White,
                                modifier = Modifier.size(24.dp),
                            )
                        }
                    }
                }
            }

            Column(
                modifier = Modifier.weight(1f),
            ) {
                Text(
                    text = displayTitle,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = Color.White,
                    fontSize = 17.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    letterSpacing = (-0.2).sp,
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    text = displayArtist,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium,
                    color = Color(0xFF9E9EA4),
                    fontSize = 14.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    text = stringResource(R.string.profile_fav_label).uppercase(),
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = Color(0xFF707075),
                    fontSize = 12.sp,
                    letterSpacing = 0.3.sp,
                )
            }
        }
    }
}
