package app.votify.mobile.data

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import app.votify.mobile.BuildConfig
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.TimeUnit

@Serializable
data class UpdateInfo(
    val versionCode: Int = 0,
    val versionName: String = "",
    val sha: String = "",
    val shortSha: String = "",
    val downloadUrl: String = "",
    val cdnUrl: String = "",
    val releaseUrl: String = "",
    val mirrorUrl: String = "",
    val url: String = "",
    val version: String = "",
    val releaseNotes: String = "",
)

sealed interface UpdateState {
    data object Idle : UpdateState
    data object Checking : UpdateState
    data class Available(val info: UpdateInfo) : UpdateState
    data class Downloading(
        val info: UpdateInfo,
        val progress: Float,
        val bytesRead: Long,
        val totalBytes: Long,
    ) : UpdateState
    data class Ready(val info: UpdateInfo, val apkFile: File) : UpdateState
    data class Error(val message: String, val info: UpdateInfo? = null) : UpdateState
}

private sealed interface DownloadOutcome {
    data object InstalledOrStale : DownloadOutcome
    data object Success : DownloadOutcome
    data object RetryNext : DownloadOutcome
}

class AppUpdateManager(
    private val context: Context,
    private val scope: CoroutineScope,
) {
    private val http = OkHttpClient.Builder()
        .connectTimeout(7, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build()

    private val json = Json { ignoreUnknownKeys = true; coerceInputValues = true }

    private val _state = MutableStateFlow<UpdateState>(UpdateState.Idle)
    val state: StateFlow<UpdateState> = _state.asStateFlow()

    private val prefs = context.getSharedPreferences("votify_app_updates", Context.MODE_PRIVATE)
    private var dismissedSha: String? = null

    init {
        // Clear any old obsolete cached APK from legacy cache directory
        runCatching {
            File(context.cacheDir, "updates").deleteRecursively()
        }
        startPeriodicCheck()
    }

    private fun startPeriodicCheck() {
        scope.launch {
            // Check on app startup after network initialization (without force, respecting user dismiss)
            delay(2000L)
            checkForUpdate(force = false)
            while (true) {
                delay(300_000L) // Check every 5 minutes in background
                checkForUpdate(force = false)
            }
        }
    }

    fun checkForUpdate(force: Boolean = false, onResult: ((Boolean) -> Unit)? = null) {
        if (force) {
            dismissedSha = null
        }
        if (_state.value is UpdateState.Downloading || _state.value is UpdateState.Ready) {
            onResult?.invoke(true)
            return
        }

        scope.launch {
            _state.value = UpdateState.Checking
            val info = withContext(Dispatchers.IO) { fetchUpdateInfo() }
            if (info == null) {
                _state.value = UpdateState.Idle
                withContext(Dispatchers.Main) { onResult?.invoke(false) }
                return@launch
            }

            val curCode = BuildConfig.VERSION_CODE
            val curSha = BuildConfig.BUILD_SHA
            val curName = BuildConfig.VERSION_NAME

            // If the installed build matches the remote commit SHA, it is ALREADY the latest build!
            val isMatchingSha = if (info.sha.isNotBlank() && curSha.isNotBlank() && !curSha.equals("dev", ignoreCase = true)) {
                curSha.startsWith(info.shortSha.ifBlank { info.sha.take(7) }) || info.sha.startsWith(curSha)
            } else false

            if (isMatchingSha) {
                runCatching {
                    getUpdateApkFile().delete()
                    getUpdateMetaFile().delete()
                    File(context.cacheDir, "updates").deleteRecursively()
                }
                _state.value = UpdateState.Idle
                withContext(Dispatchers.Main) { onResult?.invoke(false) }
                return@launch
            }

            val remoteName = info.versionName.ifBlank { info.version }
            val isSemanticOlderOrSame = isSemanticVersionOlderOrSame(remoteName, curName)
            if (isSemanticOlderOrSame && !curSha.equals("dev", ignoreCase = true)) {
                runCatching {
                    getUpdateApkFile().delete()
                    getUpdateMetaFile().delete()
                    File(context.cacheDir, "updates").deleteRecursively()
                }
                _state.value = UpdateState.Idle
                withContext(Dispatchers.Main) { onResult?.invoke(false) }
                return@launch
            }

            val isNewerSemVer = isSemanticVersionNewer(remoteName, curName)
            val isNewerCode = info.versionCode > curCode
            val isNewerSha = if (info.sha.isNotBlank()) {
                if (curSha.isBlank() || curSha.equals("dev", ignoreCase = true)) {
                    false
                } else {
                    !curSha.startsWith(info.shortSha.ifBlank { info.sha.take(7) }) && !info.sha.startsWith(curSha)
                }
            } else false

            // An update is considered newer ONLY if remote version is strictly newer
            val isNewer = isNewerSemVer || (!isSemanticOlderOrSame && (isNewerCode || (isNewerSha && (info.versionCode <= 0 || info.versionCode >= curCode))))

            if (!force && dismissedSha == info.sha) {
                _state.value = UpdateState.Idle
                withContext(Dispatchers.Main) { onResult?.invoke(false) }
                return@launch
            }

            if (isNewer) {
                val cachedApk = getUpdateApkFile()
                val metaFile = getUpdateMetaFile()
                val cachedSha = if (metaFile.exists()) runCatching { metaFile.readText().trim() }.getOrNull() else null
                val pkgInfo = if (cachedApk.exists()) context.packageManager.getPackageArchiveInfo(cachedApk.absolutePath, 0) else null
                val cachedVersionCode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    pkgInfo?.longVersionCode?.toInt() ?: 0
                } else {
                    @Suppress("DEPRECATION")
                    pkgInfo?.versionCode ?: 0
                }

                val isMatchingPackage = pkgInfo != null &&
                    (pkgInfo.packageName == context.packageName || pkgInfo.packageName in setOf("com.hiby.music", "app.votify.mobile"))

                val isCachedValid = cachedApk.exists() &&
                        cachedApk.length() > 5_000_000 &&
                        !cachedSha.isNullOrBlank() &&
                        cachedSha == info.sha &&
                        isMatchingPackage &&
                        (cachedVersionCode > curCode || (cachedVersionCode == curCode && isNewerSha))

                if (isCachedValid) {
                    _state.value = UpdateState.Ready(info, cachedApk)
                } else {
                    if (cachedApk.exists()) cachedApk.delete()
                    if (metaFile.exists()) metaFile.delete()
                    // Prompt the user via banner — NEVER auto-download in background without consent!
                    _state.value = UpdateState.Available(info)
                }
                withContext(Dispatchers.Main) { onResult?.invoke(true) }
            } else {
                runCatching {
                    getUpdateApkFile().delete()
                    getUpdateMetaFile().delete()
                    File(context.cacheDir, "updates").deleteRecursively()
                }
                _state.value = UpdateState.Idle
                withContext(Dispatchers.Main) { onResult?.invoke(false) }
            }
        }
    }

    private fun isSemanticVersionNewer(remoteVersion: String, currentVersion: String): Boolean {
        if (remoteVersion.isBlank() || currentVersion.isBlank()) return false
        val rParts = remoteVersion.trimStart('v', 'V').split('.').mapNotNull { it.toIntOrNull() }
        val cParts = currentVersion.trimStart('v', 'V').split('.').mapNotNull { it.toIntOrNull() }
        val maxLen = maxOf(rParts.size, cParts.size)
        for (i in 0 until maxLen) {
            val r = rParts.getOrElse(i) { 0 }
            val c = cParts.getOrElse(i) { 0 }
            if (r > c) return true
            if (r < c) return false
        }
        return false
    }

    private fun isSemanticVersionOlderOrSame(remoteVersion: String, currentVersion: String): Boolean {
        if (remoteVersion.isBlank() || currentVersion.isBlank()) return false
        val rParts = remoteVersion.trimStart('v', 'V').split('.').mapNotNull { it.toIntOrNull() }
        val cParts = currentVersion.trimStart('v', 'V').split('.').mapNotNull { it.toIntOrNull() }
        val maxLen = maxOf(rParts.size, cParts.size)
        for (i in 0 until maxLen) {
            val r = rParts.getOrElse(i) { 0 }
            val c = cParts.getOrElse(i) { 0 }
            if (r > c) return false
            if (r < c) return true
        }
        return true
    }

    private suspend fun fetchUpdateInfo(): UpdateInfo? = withContext(Dispatchers.IO) {
        val urls = listOf(
            "https://raw.githubusercontent.com/exieeez2/RIZE/main/version.json?t=${System.currentTimeMillis()}",
            "https://cdn.jsdelivr.net/gh/exieeez2/RIZE@main/version.json?t=${System.currentTimeMillis()}",
            "https://api.github.com/repos/exieeez2/RIZE/releases/latest",
            "https://raw.githubusercontent.com/exieeez2/RIZE/main/android/version.json?t=${System.currentTimeMillis()}",
            "https://gitlab.com/exieeez/rize/-/raw/apk/version.json?inline=false&t=${System.currentTimeMillis()}",
            "https://gitlab.com/exieeez/rize/-/raw/releases/latest-android.json?inline=false&t=${System.currentTimeMillis()}"
        )
        val deferreds = urls.map { url ->
            async {
                runCatching {
                    val req = Request.Builder()
                        .url(url)
                        .header("Cache-Control", "no-cache, no-store, must-revalidate")
                        .header("Pragma", "no-cache")
                        .build()
                    http.newCall(req).execute().use { resp ->
                        if (resp.isSuccessful) {
                            val body = resp.body?.string().orEmpty()
                            if (body.isNotBlank()) {
                                if (body.contains("\"tag_name\"") && body.contains("\"assets\"")) {
                                    val tag = Regex("\"tag_name\"\\s*:\\s*\"([^\"]+)\"").find(body)?.groupValues?.get(1).orEmpty()
                                    val cleanVer = tag.trimStart('v', 'V')
                                    val apkUrl = Regex("\"browser_download_url\"\\s*:\\s*\"([^\"]*\\.apk)\"").find(body)?.groupValues?.get(1)
                                        ?: "https://github.com/exieeez2/RIZE/releases/download/$tag/RIZE-$tag.apk"
                                    val notes = Regex("\"body\"\\s*:\\s*\"([^\"]*)\"").find(body)?.groupValues?.get(1).orEmpty()
                                    val code = cleanVer.split('.').mapNotNull { it.toIntOrNull() }.let { parts ->
                                        val maj = parts.getOrElse(0) { 1 }
                                        val min = parts.getOrElse(1) { 0 }
                                        val patch = parts.getOrElse(2) { 0 }
                                        maj * 1000 + min * 100 + patch
                                    }
                                    return@async UpdateInfo(
                                        versionCode = code,
                                        versionName = cleanVer,
                                        version = cleanVer,
                                        downloadUrl = apkUrl,
                                        releaseUrl = apkUrl,
                                        url = apkUrl,
                                        releaseNotes = notes
                                    )
                                }
                                val parsed = json.decodeFromString<UpdateInfo>(body)
                                if (parsed.versionCode > 0 || parsed.sha.isNotBlank()) {
                                    return@async parsed
                                }
                            }
                        }
                    }
                    null
                }.getOrNull()
            }
        }
        val candidates = deferreds.awaitAll().filterNotNull()
        val curName = BuildConfig.VERSION_NAME
        // Filter out candidates that are older than or equal to current installed versionName
        val validCandidates = candidates.filterNot { isSemanticVersionOlderOrSame(it.versionName.ifBlank { it.version }, curName) }
        validCandidates.maxByOrNull { it.versionCode }
    }

    fun startDownload(info: UpdateInfo) {
        scope.launch {
            val apkFile = getUpdateApkFile()
            apkFile.parentFile?.mkdirs()
            if (apkFile.exists()) apkFile.delete()

            val curCode = BuildConfig.VERSION_CODE
            val curSha = BuildConfig.BUILD_SHA
            val isNewerSha = if (info.sha.isNotBlank()) {
                if (curSha.isBlank() || curSha.equals("dev", ignoreCase = true)) {
                    true
                } else {
                    !curSha.startsWith(info.shortSha.ifBlank { info.sha.take(7) }) && !info.sha.startsWith(curSha)
                }
            } else false

            val downloadUrls = listOfNotNull(
                info.url.ifBlank { null },
                info.releaseUrl.ifBlank { null },
                info.mirrorUrl.ifBlank { null },
                "https://github.com/exieeez2/RIZE/releases/download/v1.4.0/RIZE-v1.4.0.apk",
                "https://gitlab.com/exieeez/rize/-/raw/releases/RIZE.apk?inline=false",
                info.downloadUrl.ifBlank { null },
                info.cdnUrl.ifBlank { null }
            )

            for (url in downloadUrls) {
                _state.value = UpdateState.Downloading(info, 0f, 0L, -1L)
                val outcome = withContext(Dispatchers.IO) {
                    runCatching {
                        val req = Request.Builder()
                            .url(url)
                            .header("Cache-Control", "no-cache")
                            .header("Pragma", "no-cache")
                            .build()
                        http.newCall(req).execute().use { resp ->
                            if (!resp.isSuccessful) return@runCatching DownloadOutcome.RetryNext
                            val body = resp.body ?: return@runCatching DownloadOutcome.RetryNext
                            val total = body.contentLength()
                            val tempFile = File(apkFile.parentFile, "votify-update-temp.apk")
                            if (tempFile.exists()) tempFile.delete()

                            body.byteStream().use { input ->
                                FileOutputStream(tempFile).use { output ->
                                    val buffer = ByteArray(64 * 1024)
                                    var read: Int
                                    var bytesCopied = 0L
                                    var lastReport = System.currentTimeMillis()

                                    while (input.read(buffer).also { read = it } != -1) {
                                        output.write(buffer, 0, read)
                                        bytesCopied += read
                                        val now = System.currentTimeMillis()
                                        if (now - lastReport > 150 || bytesCopied == total) {
                                             lastReport = now
                                             val progress = if (total > 0) bytesCopied.toFloat() / total.toFloat() else 0f
                                             _state.value = UpdateState.Downloading(info, progress, bytesCopied, total)
                                        }
                                    }
                                    output.flush()
                                }
                            }
                            if (tempFile.exists() && tempFile.length() > 5_000_000) {
                                val pkgInfo = context.packageManager.getPackageArchiveInfo(tempFile.absolutePath, 0)
                                val apkVersionCode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                                    pkgInfo?.longVersionCode?.toInt() ?: 0
                                } else {
                                    @Suppress("DEPRECATION")
                                    pkgInfo?.versionCode ?: 0
                                }

                                val isMatchingPackage = pkgInfo != null &&
                                    (pkgInfo.packageName == context.packageName || pkgInfo.packageName in setOf("com.hiby.music", "app.votify.mobile"))

                                if (!isMatchingPackage) {
                                    android.util.Log.w("AppUpdateManager", "Rejected mismatched package: ${pkgInfo?.packageName} vs ${context.packageName}")
                                    tempFile.delete()
                                    return@runCatching DownloadOutcome.RetryNext
                                }

                                val isAlreadyInstalled = apkVersionCode <= curCode && !isNewerSha && !curSha.equals("dev", ignoreCase = true)
                                if (isAlreadyInstalled) {
                                    android.util.Log.i("AppUpdateManager", "Downloaded APK ($apkVersionCode) is already installed (cur=$curCode). Setting Idle.")
                                    tempFile.delete()
                                    return@runCatching DownloadOutcome.InstalledOrStale
                                }

                                val isLegitNewerApk = apkVersionCode > curCode || (apkVersionCode == curCode && isNewerSha) || curSha.equals("dev", ignoreCase = true)
                                if (isLegitNewerApk) {
                                    if (apkFile.exists()) apkFile.delete()
                                    tempFile.renameTo(apkFile)
                                    runCatching { getUpdateMetaFile().writeText(info.sha) }
                                    return@runCatching DownloadOutcome.Success
                                } else {
                                    android.util.Log.w("AppUpdateManager", "Rejected APK code=$apkVersionCode vs current=$curCode")
                                    tempFile.delete()
                                    return@runCatching DownloadOutcome.InstalledOrStale
                                }
                            } else {
                                tempFile.delete()
                                DownloadOutcome.RetryNext
                            }
                        }
                    }.getOrDefault(DownloadOutcome.RetryNext)
                }

                when (outcome) {
                    DownloadOutcome.InstalledOrStale -> {
                        _state.value = UpdateState.Idle
                        return@launch
                    }
                    DownloadOutcome.Success -> {
                        _state.value = UpdateState.Ready(info, apkFile)
                        if (canInstallDirectly()) {
                            installUpdate(apkFile)
                        }
                        return@launch
                    }
                    DownloadOutcome.RetryNext -> {
                        // try next mirror
                    }
                }
            }

            if (_state.value is UpdateState.Downloading) {
                _state.value = UpdateState.Error(context.getString(app.votify.mobile.R.string.update_download_failed), info)
            }
        }
    }

    fun canInstallDirectly(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.packageManager.canRequestPackageInstalls()
        } else {
            true
        }
    }

    fun openInstallPermissionSettings() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            runCatching {
                val intent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES).apply {
                    data = Uri.parse("package:${context.packageName}")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(intent)
            }.onFailure {
                val fallback = Intent(Settings.ACTION_SECURITY_SETTINGS).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                runCatching { context.startActivity(fallback) }
            }
        }
    }

    fun installUpdate(apkFile: File) {
        if (!apkFile.exists() || apkFile.length() < 1_000_000) {
            _state.value = UpdateState.Error(context.getString(app.votify.mobile.R.string.update_file_invalid))
            return
        }

        if (!canInstallDirectly()) {
            openInstallPermissionSettings()
            return
        }

        runCatching {
            val uri = FileProvider.getUriForFile(context, "${context.packageName}.provider", apkFile)
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/vnd.android.package-archive")
                clipData = android.content.ClipData.newRawUri("RIZE Update", uri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }

            val resInfoList = context.packageManager.queryIntentActivities(
                intent,
                android.content.pm.PackageManager.MATCH_DEFAULT_ONLY
            )
            for (resolveInfo in resInfoList) {
                val pkg = resolveInfo.activityInfo.packageName
                context.grantUriPermission(pkg, uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }

            context.startActivity(intent)
        }.onFailure { e ->
            _state.value = UpdateState.Error(context.getString(app.votify.mobile.R.string.update_installer_failed, e.message.orEmpty()))
        }
    }

    fun installAndRestart(apkFile: File) = installUpdate(apkFile)

    fun dismiss() {
        dismissedSha = (_state.value as? UpdateState.Available)?.info?.sha ?: "dismissed"
        _state.value = UpdateState.Idle
    }

    private fun getUpdateDir(): File {
        val base = context.getExternalFilesDir(null) ?: context.filesDir
        return File(base, "updates").apply { mkdirs() }
    }

    private fun getUpdateApkFile(): File = File(getUpdateDir(), "Votify-update.apk")
    private fun getUpdateMetaFile(): File = File(getUpdateDir(), "Votify-update.sha")
}
