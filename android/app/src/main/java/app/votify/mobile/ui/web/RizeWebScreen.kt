package app.votify.mobile.ui.web

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.View
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.votify.mobile.VotifyApp
import app.votify.mobile.data.EmbeddedMusicSource
import app.votify.mobile.data.Track
import app.votify.mobile.player.PlayerController
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject

/**
 * Fullscreen hardware-accelerated WebView hosting the high-fidelity RIZE HTML UI
 * (android/app/src/main/assets/rize-web/index.html), seamlessly integrated with
 * the native ExoPlayer playback engine and local database.
 */
@SuppressLint("SetJavaScriptEnabled")
@Composable
fun RizeWebScreen(
    app: VotifyApp,
    modifier: Modifier = Modifier,
    onSwitchToCompose: (() -> Unit)? = null,
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val player = app.player
    val playerState by player.state.collectAsStateWithLifecycle()

    var webViewInstance by remember { mutableStateOf<WebView?>(null) }

    // Intercept back button to navigate sheets / modals inside the web UI
    BackHandler(enabled = true) {
        val wv = webViewInstance
        if (wv != null) {
            wv.evaluateJavascript("window.handleAndroidBack ? window.handleAndroidBack() : false") { result ->
                val handled = result == "true" || result == "\"true\""
                if (!handled) {
                    (context as? Activity)?.moveTaskToBack(true)
                }
            }
        } else {
            (context as? Activity)?.moveTaskToBack(true)
        }
    }

    // Sync native playback state changes to the WebView
    LaunchedEffect(playerState.isPlaying, playerState.current, playerState.positionMs, playerState.durationMs) {
        val wv = webViewInstance ?: return@LaunchedEffect
        val cur = playerState.current
        val json = JSONObject().apply {
            put("isPlaying", playerState.isPlaying)
            put("positionSec", playerState.positionMs / 1000f)
            put("durationSec", playerState.durationMs / 1000f)
            put("trackId", cur?.id ?: "")
            put("title", cur?.title ?: "")
            put("artist", cur?.artist ?: "")
            put("cover", cur?.cover ?: "")
        }
        wv.post {
            wv.evaluateJavascript("window.onNativePlayerStateUpdate && window.onNativePlayerStateUpdate(${json});", null)
        }
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xFF0A0A0A))
    ) {
        AndroidView(
            factory = { ctx ->
                WebView(ctx).apply {
                    layoutParams = ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                    )
                    setBackgroundColor(0xFF0A0A0A.toInt())
                    setLayerType(View.LAYER_TYPE_HARDWARE, null)
                    overScrollMode = View.OVER_SCROLL_NEVER

                    settings.apply {
                        javaScriptEnabled = true
                        domStorageEnabled = true
                        databaseEnabled = true
                        allowFileAccess = true
                        allowContentAccess = true
                        cacheMode = WebSettings.LOAD_DEFAULT
                        mediaPlaybackRequiresUserGesture = false
                        useWideViewPort = true
                        loadWithOverviewMode = true
                        displayZoomControls = false
                        builtInZoomControls = false
                    }

                    val bridge = RizeAndroidBridge(
                        activity = ctx as? Activity,
                        app = app,
                        scope = coroutineScope,
                        webView = this,
                        onSwitchToCompose = onSwitchToCompose
                    )
                    addJavascriptInterface(bridge, "RizeAndroid")
                    addJavascriptInterface(bridge, "AndroidBridge")

                    webChromeClient = WebChromeClient()
                    webViewClient = object : WebViewClient() {
                        override fun onPageFinished(view: WebView?, url: String?) {
                            super.onPageFinished(view, url)
                            // Initial bootstrap sync
                            bridge.pushInitialData()
                        }
                    }

                    loadUrl("file:///android_asset/rize-web/index.html")
                    webViewInstance = this
                }
            },
            update = { wv ->
                webViewInstance = wv
            },
            modifier = Modifier.fillMaxSize()
        )
    }

    DisposableEffect(Unit) {
        onDispose {
            webViewInstance?.destroy()
            webViewInstance = null
        }
    }
}

/**
 * JavaScript Interface exposed to `window.RizeAndroid` inside index.html.
 */
class RizeAndroidBridge(
    private val activity: Activity?,
    private val app: VotifyApp,
    private val scope: CoroutineScope,
    private val webView: WebView,
    private val onSwitchToCompose: (() -> Unit)? = null,
) {
    private val context: Context get() = app.applicationContext

    fun pushInitialData() {
        scope.launch(Dispatchers.IO) {
            runCatching {
                val favs = app.library.favorites.first()
                val jsonFavs = JSONArray()
                favs.forEach { t ->
                    jsonFavs.put(JSONObject().apply {
                        put("id", t.id)
                        put("title", t.title)
                        put("artist", t.artist)
                        put("cover", t.cover)
                        put("duration", t.duration)
                        put("url", t.url)
                    })
                }
                withContext(Dispatchers.Main) {
                    webView.evaluateJavascript("window.onNativeFavoritesLoaded && window.onNativeFavoritesLoaded(${jsonFavs});", null)
                }
            }
        }
    }

    @JavascriptInterface
    fun playTrack(id: String, title: String, artist: String, cover: String, url: String, duration: Int) {
        scope.launch(Dispatchers.Main) {
            val track = Track(
                id = id.ifBlank { "track_${System.currentTimeMillis()}" },
                title = title.ifBlank { "Без названия" },
                artist = artist.ifBlank { "RIZE" },
                cover = cover,
                url = url.ifBlank { "votify://stream/$id" },
                duration = duration.coerceAtLeast(0)
            )
            app.player.playTrack(track)
            vibrate("light")
        }
    }

    @JavascriptInterface
    fun togglePlay() {
        scope.launch(Dispatchers.Main) {
            app.player.togglePlayPause()
            vibrate("light")
        }
    }

    @JavascriptInterface
    fun pause() {
        scope.launch(Dispatchers.Main) {
            if (app.player.state.value.isPlaying) {
                app.player.togglePlayPause()
            }
        }
    }

    @JavascriptInterface
    fun next() {
        scope.launch(Dispatchers.Main) {
            app.player.next()
            vibrate("light")
        }
    }

    @JavascriptInterface
    fun previous() {
        scope.launch(Dispatchers.Main) {
            app.player.previous()
            vibrate("light")
        }
    }

    @JavascriptInterface
    fun seekTo(seconds: Float) {
        scope.launch(Dispatchers.Main) {
            val ms = (seconds * 1000f).toLong().coerceAtLeast(0L)
            app.player.seekToMs(ms)
        }
    }

    @JavascriptInterface
    fun setShuffle(enabled: Boolean) {
        scope.launch(Dispatchers.Main) {
            app.player.setShuffle(enabled)
            vibrate("light")
        }
    }

    @JavascriptInterface
    fun toggleLike(id: String, title: String, artist: String, cover: String, duration: Int) {
        scope.launch(Dispatchers.IO) {
            val track = Track(
                id = id,
                title = title,
                artist = artist,
                cover = cover,
                url = "votify://stream/$id",
                duration = duration
            )
            val isFav = app.library.toggleFavorite(track)
            vibrate(if (isFav) "medium" else "light")
            withContext(Dispatchers.Main) {
                showToast(if (isFav) "Добавлено в любимые" else "Удалено из любимых")
                webView.evaluateJavascript("window.onNativeLikeStateChanged && window.onNativeLikeStateChanged('${id}', ${isFav});", null)
            }
        }
    }

    @JavascriptInterface
    fun search(query: String) {
        if (query.isBlank()) return
        scope.launch(Dispatchers.IO) {
            runCatching {
                val results = EmbeddedMusicSource.search(query, limit = 25)
                val jsonArr = JSONArray()
                results.forEach { t ->
                    jsonArr.put(JSONObject().apply {
                        put("id", t.id)
                        put("title", t.title)
                        put("artist", t.artist)
                        put("cover", t.cover)
                        put("duration", t.duration)
                        put("url", t.url)
                    })
                }
                withContext(Dispatchers.Main) {
                    webView.evaluateJavascript("window.onNativeSearchResults && window.onNativeSearchResults(${jsonArr});", null)
                }
            }
        }
    }

    @JavascriptInterface
    fun vibrate(type: String) {
        runCatching {
            val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val manager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                manager?.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
            } ?: return

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val effect = when (type) {
                    "light" -> VibrationEffect.createPredefined(VibrationEffect.EFFECT_TICK)
                    "medium" -> VibrationEffect.createPredefined(VibrationEffect.EFFECT_CLICK)
                    "heavy" -> VibrationEffect.createPredefined(VibrationEffect.EFFECT_HEAVY_CLICK)
                    else -> VibrationEffect.createPredefined(VibrationEffect.EFFECT_CLICK)
                }
                vibrator.vibrate(effect)
            } else {
                @Suppress("DEPRECATION")
                vibrator.vibrate(25L)
            }
        }
    }

    @JavascriptInterface
    fun showToast(message: String) {
        // Intrusive toast notifications suppressed everywhere per user request
    }

    @JavascriptInterface
    fun openExternal(url: String) {
        runCatching {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
        }
    }

    @JavascriptInterface
    fun switchToComposeUi() {
        activity?.runOnUiThread {
            onSwitchToCompose?.invoke()
        }
    }
}
