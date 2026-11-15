package app.votify.mobile.data

import app.votify.mobile.VotifyApp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.contentOrNull
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request as OkHttpRequest
import okhttp3.RequestBody.Companion.toRequestBody
import org.schabi.newpipe.extractor.NewPipe
import org.schabi.newpipe.extractor.ServiceList
import org.schabi.newpipe.extractor.downloader.Downloader
import org.schabi.newpipe.extractor.downloader.Request
import org.schabi.newpipe.extractor.downloader.Response
import org.schabi.newpipe.extractor.exceptions.ReCaptchaException
import org.schabi.newpipe.extractor.localization.ContentCountry
import org.schabi.newpipe.extractor.localization.Localization
import org.schabi.newpipe.extractor.playlist.PlaylistInfo
import org.schabi.newpipe.extractor.search.SearchInfo
import org.schabi.newpipe.extractor.services.youtube.linkHandler.YoutubeSearchQueryHandlerFactory
import org.schabi.newpipe.extractor.stream.AudioStream
import org.schabi.newpipe.extractor.stream.DeliveryMethod
import org.schabi.newpipe.extractor.stream.StreamInfo
import org.schabi.newpipe.extractor.stream.StreamInfoItem
import org.schabi.newpipe.extractor.Image
import java.io.IOException
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit

/**
 * Standalone (serverless) music source built on NewPipeExtractor — the same engine that powers
 * the NewPipe app. Search, stream URLs and playlist imports are fetched directly from
 * YouTube / YouTube Music / SoundCloud, and lyrics come straight from lrclib.net.
 *
 * All functions are **synchronous** (blocking network); callers wrap them in Dispatchers.IO.
 * [resolveAudioUrl] is additionally used from ExoPlayer's loading thread via ResolvingDataSource.
 */
object EmbeddedMusicSource {

    /** Offline downloads directory (set from VotifyApp). */
    @Volatile
    var downloadsDir: java.io.File? = null

    private val json = Json { ignoreUnknownKeys = true; coerceInputValues = true; isLenient = true }

    private val http: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(45, TimeUnit.SECONDS)
        .build()

    /**
     * Отдельный клиент для скачивания: пул побольше (качаем несколькими соединениями
     * сразу) и более длинный таймаут чтения — долгий трек на слабой сети не должен
     * обрываться на середине.
     */
    private val downloadHttp: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .connectionPool(okhttp3.ConnectionPool(16, 5, TimeUnit.MINUTES))
        .build()

    /** YouTube stream URLs live ~6h — cache 4h to be safe. */
    private const val STREAM_TTL_MS = 4 * 60 * 60 * 1000L

    /** Сколько параллельных соединений качает один трек (HTTP Range). */
    private const val MAX_CHUNKS = 4
    /** Мелкие файлы нарезать бессмысленно — только лишние запросы. */
    private const val CHUNK_MIN_SIZE = 320L * 1024L

    /** Живой чарт Apple Music (Россия): что слушают прямо сейчас, без ключа и регистрации. */
    private const val CHART_URL = "https://rss.marketingtools.apple.com/api/v2/ru/music/most-played/50/songs.json"

    private val EXCLUDED_POP_ARTISTS = setOf(
        "anna asti", "анна асти", "клава кока", "klava koka", "zivert", "зиверт",
        "мари краймбрери", "jony", "джони", "mia boyka", "миа бойка", "artik & asti",
        "люся чеботина", "niletto", "инстасамка", "instasamka", "шаман", "shaman",
        "сергей лазарев", "дима билан", "руки вверх", "ваня дмитриенко", "dabro",
        "хабиб", "юрий шатунов", "секрет", "ленинград",
    )

    /** Tracks shorter/longer than this are noise: intros, livestreams, hour-long mixes. */
    private const val MIN_TRACK_SECONDS = 30L
    private const val MAX_TRACK_SECONDS = 15 * 60L
    private const val MAX_WAVE_SECONDS = 10 * 60L

    /** Import caps: no intros in playlists, and never fetch more than this many items. */
    private const val MIN_IMPORT_SECONDS = 15L
    private const val MAX_IMPORT_ITEMS = 1000

    private val streamCache = ConcurrentHashMap<String, CachedUrl>()
    private val deezerToYtCache = ConcurrentHashMap<String, String>()

@Volatile
private var trendingCache: Pair<Long, List<Track>>? = null

private const val TRENDING_TTL_MS = 30 * 60 * 1000L

    private data class CachedUrl(val url: String, val at: Long)

    @Volatile
    private var initialized = false

    fun ensureInit() {
        if (initialized) return
        synchronized(this) {
            if (initialized) return
            NewPipe.init(OkHttpDownloader(http), Localization("ru", "UA"), ContentCountry("UA"))
            initialized = true
        }
    }

    // ------------------------------------------------------------------ search

    /**
     * YouTube search. `music = true` merges the YouTube Music catalog (clean "artist"
     * metadata, songs only) with a regular YouTube video search: amateur releases that
     * never made it into the Music catalog (e.g. «Отчим» — KSB muzic) exist only as
     * plain uploads, so without the merge they are unfindable.
     */
    fun search(query: String, limit: Int = 24, music: Boolean = true): List<Track> {
        ensureInit()
        val clean = query.trim().replace(Regex("\\s+"), " ")
        if (!music) {
            return runCatching { rawSearch(clean, music = false, limit) }
                .getOrElse { throw IOException("Поиск не отвечает: ${it.message ?: "нет связи"}") }
        }

        // Попытка №1: песни из каталога YouTube Music + обычные видео YouTube. Сбой отличается
        // от «пусто»: если упали оба запроса, показываем подсказку про связь, а не молчаливое
        // «ничего не найдено».
        val songs = runCatching { rawSearch(clean, music = true, limit) }.getOrNull()
        val videos = runCatching { rawSearch(clean, music = false, limit) }.getOrNull()
        if (songs == null && videos == null) {
            throw IOException("Поиск не отвечает: нет связи с YouTube")
        }
        var found = mergeResults(songs.orEmpty(), videos.orEmpty(), clean, limit)
        if (found.isNotEmpty()) return found

        // Попытка №2: по длинной фразе пусто — ищем по первым двум словам
        // («мейби бейби любимая школа» → «мейби бейби»).
        val words = clean.split(' ')
        if (words.size > 2) {
            val short = words.take(2).joinToString(" ")
            val s2 = runCatching { rawSearch(short, music = true, limit) }.getOrDefault(emptyList())
            val v2 = runCatching { rawSearch(short, music = false, limit) }.getOrDefault(emptyList())
            found = mergeResults(s2, v2, short, limit)
            if (found.isNotEmpty()) return found
        }

        // Попытка №3: та же выдача без отсева по длительности — у части результатов она
        // приходит нулевой, и трек пропадал из списка.
        val s3 = runCatching { rawSearch(clean, music = true, limit, strictDuration = false) }
            .getOrDefault(emptyList())
        val v3 = runCatching { rawSearch(clean, music = false, limit, strictDuration = false) }
            .getOrDefault(emptyList())
        return mergeResults(s3, v3, clean, limit)
    }

    /**
     * Склейка «песни каталога + обычные видео» без дублей, отсортированная по совпадению
     * с запросом: трек, у которого название и исполнитель совпадают со словами запроса,
     * стоит выше. Иначе YouTube отдаёт вперёд что угодно — например, при запросе
     * «любимая школа мейби бейби» первой шла «Аскорбинка», а не сама песня.
     */
    private fun mergeResults(
        songs: List<Track>,
        videos: List<Track>,
        query: String,
        limit: Int,
    ): List<Track> {
        val words = relevanceWords(query)
        return (songs + videos)
            .distinctBy { it.id }
            .distinctBy { "${it.artist}|${it.title}".lowercase() }
            .sortedByDescending { searchScore(it, words) }
            .take(limit)
    }

    /** Слова запроса от трёх букв. */
    private fun relevanceWords(query: String): List<String> =
        normalizeText(query).split(' ').filter { it.length >= 3 }.distinct()

    /**
     * Приводит текст к сравнимому виду: регистр, «ё»/«э» → «е», дефисы — в пробелы.
     * Без этого «мейби бейби» не совпадает с «Мэйби Бэйби».
     */
    private fun normalizeText(text: String): String = text
        .lowercase()
        .replace('ё', 'е')
        .replace('э', 'е')
        .replace('-', ' ')
        .replace(Regex("\\s+"), " ")
        .trim()

    /** Насколько трек отвечает на запрос: название весит больше исполнителя. */
    private fun searchScore(track: Track, words: List<String>): Int {
        if (words.isEmpty()) return 0
        val title = normalizeText(track.title)
        val artist = normalizeText(track.artist)
        var score = 0
        words.forEach { word ->
            if (title.contains(word)) score += 3
            if (artist.contains(word)) score += 2
        }
        // Весь запрос в названии/исполнителе — почти наверняка то, что искали.
        if (words.all { title.contains(it) || artist.contains(it) }) score += 2
        return score
    }

    /** Popular tracks of an artist (YouTube Music songs search). */
    fun artistTracks(artist: String, limit: Int = 50): List<Track> {
        ensureInit()
        return runCatching { rawSearch(artist, music = true, limit) }.getOrDefault(emptyList())
    }

    private fun rawSearch(
        query: String,
        music: Boolean,
        limit: Int,
        strictDuration: Boolean = true,
    ): List<Track> {
        val service = ServiceList.YouTube
        val handler = if (music) {
            service.searchQHFactory.fromQuery(query, listOf(YoutubeSearchQueryHandlerFactory.MUSIC_SONGS), "")
        } else {
            service.searchQHFactory.fromQuery(query)
        }
        return SearchInfo.getInfo(service, handler)
            .relatedItems
            .filterIsInstance<StreamInfoItem>()
            // Keep real songs only: drop livestreams, mixes and podcasts (30 s … 15 min).
            // При strictDuration = false фильтр выключен: у части результатов длительность
            // неизвестна (0), и трек терялся.
            .filter { !strictDuration || it.duration in MIN_TRACK_SECONDS..MAX_TRACK_SECONDS }
            .mapNotNull { it.toTrack() }
            .distinctBy { it.id }
            .distinctBy { "${it.artist}|${it.title}".lowercase() }
            .take(limit)
    }

    // ------------------------------------------------------------------ wave / recommendations

    /**
     * «Моя волна» without a server: search a few songs of every seed artist, anchor with
     * track seeds, drop everything the user heard recently.
     */
    fun wave(artistSeeds: List<String>, trackSeeds: List<String>, exclude: Set<String>, limit: Int): List<Track> {
        ensureInit()
        val blocked = exclude.toMutableSet()

        // 1. Якоря — недавние и любимые треки: по одному поиску на трек, параллельно.
        val anchors = fanOut(trackSeeds.take(6).filter { it.isNotBlank() }, limit = 3) { seed ->
            rawSearch(seed, music = true, 1)
        }.distinctBy { it.id }
        blocked += anchors.map { it.id }

        // 2. Похожее: блок «Далее» у каждого якоря отдельно. Трек, который всплыл у
        //    нескольких якорей, правда похож — считаем, сколько раз он встретился.
        val anchorIds = anchors.map { it.id }.distinct().take(4)
        val perAnchor: List<List<Track>> = if (anchorIds.isEmpty()) emptyList() else runBlocking {
            coroutineScope {
                anchorIds.map { id ->
                    async(Dispatchers.IO) { runCatching { relatedTracks(id, 12) }.getOrDefault(emptyList()) }
                }.awaitAll()
            }
        }
        val hits = mutableMapOf<String, Int>()
        perAnchor.forEach { list -> list.distinctBy { it.id }.forEach { t -> hits[t.id] = (hits[t.id] ?: 0) + 1 } }
        val related = perAnchor.flatten()

        // 3. Свежие треки артистов из истории — только чтобы добить хвост, если
        //    «похожего» набралось мало.
        val fromArtists = fanOut(
            artistSeeds.take(4).filter { it.isNotBlank() && !it.equals("Unknown", true) },
            limit = 4,
        ) { artist -> rawSearch(artist, music = true, 6) }

        if (related.isEmpty() && fromArtists.isEmpty()) return recommendations(limit)

        val seedArtists = artistSeeds.map { normalizeArtist(it) }.filter { it.isNotBlank() }.toSet()
        val anchorArtists = anchors.map { normalizeArtist(it.artist) }.filter { it.isNotBlank() }.toSet()
        val anchorWords = anchors.flatMap { significantWords(it.title) }.toSet()

        val ranked = (related + fromArtists)
            .asSequence()
            .distinctBy { it.id }
            .distinctBy { dedupeKey(it) }
            .filter { it.id !in blocked && it.duration in MIN_TRACK_SECONDS..MAX_WAVE_SECONDS }
            .map { track -> track to relevance(track, anchorArtists, seedArtists, anchorWords, hits[track.id] ?: 0) }
            .sortedByDescending { it.second }
            .map { it.first }
            .toList()
            .take(limit)

        if (ranked.isEmpty()) return recommendations(limit)
        // Подряд идущие треки одного артиста разводим, порядок по похожести сохраняем.
        return spreadByArtist(ranked)
    }

    /** Насколько трек близок к тому, что человек реально слушает (больше — лучше). */
    private fun relevance(
        track: Track,
        anchorArtists: Set<String>,
        seedArtists: Set<String>,
        anchorWords: Set<String>,
        hits: Int,
    ): Double {
        val artist = normalizeArtist(track.artist)
        var score = 0.0
        if (artist in anchorArtists) score += 6.0
        else if (anchorArtists.any { artist.contains(it) || it.contains(artist) }) score += 4.0
        if (artist in seedArtists) score += 2.5
        else if (seedArtists.any { artist.contains(it) || it.contains(artist) }) score += 1.5
        if (significantWords(track.title).any { it in anchorWords }) score += 0.75
        score += hits * 1.5
        // Немного случайности, чтобы волна не залипала на одном и том же наборе.
        return score + Math.random()
    }

    /** Round-robin по артистам: подряд не идут пять треков одного исполнителя. */
    private fun spreadByArtist(tracks: List<Track>): List<Track> {
        val groups = linkedMapOf<String, MutableList<Track>>()
        tracks.forEach { track -> groups.getOrPut(normalizeArtist(track.artist)) { mutableListOf() } += track }
        val queues = groups.values.toList()
        val out = mutableListOf<Track>()
        var index = 0
        while (out.size < tracks.size) {
            var added = false
            for (queue in queues) {
                if (index < queue.size) {
                    out += queue[index]
                    added = true
                }
            }
            if (!added) break
            index++
        }
        return out
    }

    private fun dedupeKey(track: Track): String = "${normalizeArtist(track.artist)}|${track.title.lowercase()}"

    /** «Artist Name», «artist-name», «ARTIST» — один и тот же артист. */
    private fun normalizeArtist(value: String): String =
        value.lowercase()
            .replace(Regex("[^\\p{L}\\p{N}& ]"), " ")
            .replace(Regex("\\s+"), " ")
            .trim()

    private fun significantWords(title: String): Set<String> =
        title.lowercase()
            .replace(Regex("[^\\p{L}\\p{N} ]"), " ")
            .split(Regex("\\s+"))
            .filter { it.length >= 3 }
            .toSet()

    /**
     * Выполняет [block] для каждого элемента на пуле IO (не более [limit] одновременно)
     * и склеивает результаты. Ошибки проглатываются: волна и чарт должны жить, даже
     * если один из запросов не прошёл.
     */
    private fun <T> fanOut(items: List<T>, limit: Int = 6, block: (T) -> List<Track>): List<Track> {
        if (items.isEmpty()) return emptyList()
        return runBlocking {
            coroutineScope {
                items.chunked(limit).flatMap { batch ->
                    batch.map { item -> async(Dispatchers.IO) { runCatching { block(item) }.getOrDefault(emptyList()) } }
                        .awaitAll()
                        .flatten()
                }
            }
        }
    }

    /** То же, что [fanOut], но результат каждого элемента остаётся отдельным списком. */
    private fun <T, R : Any> mapParallel(items: List<T>, limit: Int = 6, block: (T) -> R): List<R> {
        if (items.isEmpty()) return emptyList()
        return runBlocking {
            coroutineScope {
                items.chunked(limit).flatMap { batch ->
                    batch.map { item -> async(Dispatchers.IO) { runCatching { block(item) }.getOrNull() } }.awaitAll()
                }
            }
        }.filterNotNull()
    }

    /**
     * По-настоящему похожие треки: блок «Далее» у видео-якоря (YouTube related).
     * Поиск по имени артиста даёт случайную популярщину, а related — близкую по звуку музыку.
     * Пусто, если related-блок недоступен (тогда волна работает по-старому).
     */
    fun relatedTracks(trackId: String, limit: Int = 6): List<Track> {
        if (trackId.isBlank() || trackId.startsWith("sc_") || trackId.startsWith("http")) return emptyList()
        ensureInit()
        return runCatching {
            val pageUrl = "https://www.youtube.com/watch?v=$trackId"
            val extractor = NewPipe.getServiceByUrl(pageUrl).getStreamExtractor(pageUrl)
            extractor.fetchPage()
            extractor.getRelatedItems()?.items
                ?.filterIsInstance<StreamInfoItem>()
                .orEmpty()
                .filter { it.duration in MIN_TRACK_SECONDS..MAX_WAVE_SECONDS }
                .mapNotNull { it.toTrack() }
                .distinctBy { it.id }
                .distinctBy { "${it.artist}|${it.title}".lowercase() }
                .take(limit)
        }.getOrDefault(emptyList())
    }

    /**
     * «В тренде»: живой чарт Apple Music (Россия) — то, что действительно слушают прямо
     * сейчас. Позиции чарта ищем на YouTube Music параллельно и сохраняем порядок:
     * первая строчка чарта остаётся первой в списке. Кэш 30 минут.
     *
     * Если чарт недоступен — запасной путь: свежие запросы и хиты актуальных артистов.
     */
    fun trendingCis(limit: Int = 50): List<Track> {
        ensureInit()
        val cached = trendingCache
        if (cached != null && System.currentTimeMillis() - cached.first < TRENDING_TTL_MS) {
            return cached.second.take(limit)
        }

        // 1. Артисты актуального звучания (ONDA ANDAR, madk1d, 52 NGG, андеграунд рэп)
        val artists = listOf(
            "ONDA ANDAR", "madk1d", "VILLIAN", "ICEGERGERT", "Friendly Thug 52 NGG",
            "ALBLAK 52", "Hugo Loud", "Toxi$", "Heronwater", "Scally Milano",
            "Big Baby Tape", "Kizaru", "Bushido Zho", "SALUKI", "Платина",
            "OG Buda", "unki", "Voskresenskii", "kai angel", "9mice",
            "Pepel Nahudi", "Aarne", "10AGE", "Macan",
        )
        val perArtist = mapParallel(artists.shuffled().take(12), limit = 4) { artist ->
            rawSearch(artist, music = true, 4).take(3)
        }
        val interleaved = mutableListOf<Track>()
        (0 until 3).forEach { i -> perArtist.forEach { page -> page.getOrNull(i)?.let { interleaved += it } } }

        // 2. Живой чарт (с фильтрацией попсы)
        val chart = chartEntries(50)
        val chartTracks = fanOut(chart.take(25), limit = 5) { (artist, title) ->
            rawSearch(if (artist.isBlank()) title else "$artist $title", music = true, 1)
        }

        val freshQueries = listOf(
            "ONDA ANDAR", "madk1d", "VILLIAN ДИНАСТИЯ", "русский рэп андеграунд",
            "52 ngg", "ICEGERGERT", "dark trap", "хип хоп 2026",
        )
        val fresh = fanOut(freshQueries, limit = 4) { q -> rawSearch(q, music = true, 6) }

        val combined = (interleaved.take(15) + chartTracks + interleaved.drop(15) + fresh)
            .distinctBy { it.id }
            .distinctBy { dedupeKey(it) }
            .filter { it.duration in MIN_TRACK_SECONDS..MAX_WAVE_SECONDS }

        if (combined.isNotEmpty()) {
            trendingCache = System.currentTimeMillis() to combined
            return combined.take(limit)
        }
        return recommendations(limit)
    }

    /** Позиции живого чарта Apple Music (с отсевом попсы): (артист, название). */
    private fun chartEntries(limit: Int): List<Pair<String, String>> {
        val body = runCatching { httpGetString(CHART_URL) }.getOrNull() ?: return emptyList()
        return runCatching {
            val results = json.parseToJsonElement(body)
                .jsonObject["feed"]?.jsonObject
                ?.get("results")?.jsonArray
                .orEmpty()
            results.mapNotNull { item ->
                val obj = runCatching { item.jsonObject }.getOrNull() ?: return@mapNotNull null
                val title = obj["name"]?.jsonPrimitive?.content?.takeIf { it.isNotBlank() } ?: return@mapNotNull null
                val artist = obj["artistName"]?.jsonPrimitive?.content.orEmpty()
                val full = "$artist $title".lowercase()
                if (EXCLUDED_POP_ARTISTS.any { full.contains(it) }) return@mapNotNull null
                artist to title
            }.take(limit)
        }.getOrDefault(emptyList())
    }

    fun recommendations(limit: Int): List<Track> {
        ensureInit()
        val queries = listOf(
            "ONDA ANDAR",
            "madk1d",
            "VILLIAN ДИНАСТИЯ",
            "ICEGERGERT",
            "Friendly Thug 52 NGG",
            "ALBLAK 52",
            "Hugo Loud",
            "Toxi$",
            "Heronwater",
            "Scally Milano",
            "Big Baby Tape",
            "Kizaru",
            "Bushido Zho",
            "SALUKI",
            "Платина",
            "OG Buda",
        )
        return queries.asSequence()
            .shuffled()
            .take(6)
            .map { q -> runCatching { rawSearch(q, music = true, 6) }.getOrDefault(emptyList()) }
            .flatten()
            .distinctBy { it.id }
            .distinctBy { dedupeKey(it) }
            .filter { it.duration in MIN_TRACK_SECONDS..MAX_WAVE_SECONDS }
            .shuffled()
            .take(limit)
            .toList()
    }

    // ------------------------------------------------------------------ offline downloads

    /** File the track is downloaded to, or null when storage is not set up. */
    fun downloadFileFor(trackId: String): java.io.File? =
        downloadsDir?.let { java.io.File(it, downloadName(trackId) + ".audio") }

    private fun downloadName(trackId: String): String =
        if (trackId.matches(Regex("[A-Za-z0-9_-]{1,64}"))) trackId
        else "u_" + Integer.toHexString(trackId.hashCode()) + "_" + trackId.length

    fun isDownloaded(trackId: String): Boolean =
        downloadFileFor(trackId)?.let { it.exists() && it.length() > 0 } == true

    /** Count + total size of offline copies (for the storage screen). */
    fun downloadStats(): Pair<Int, Long> {
        val dir = downloadsDir ?: return 0 to 0L
        val files = dir.listFiles()?.filter { it.isFile && it.name.endsWith(".audio") } ?: return 0 to 0L
        return files.size to files.sumOf { it.length() }
    }

    fun deleteDownload(trackId: String) {
        downloadFileFor(trackId)?.takeIf { it.exists() }?.delete()
    }

    /**
     * Download a track for offline listening: resolve the stream URL, fetch the bytes into
     * a temp file, then atomically move it into place. Existing copies are reused as-is.
     * [onProgress] reports (receivedBytes, totalBytes); total is -1 when the server does
     * not send Content-Length.
     */
    fun downloadTrack(
        trackId: String,
        quality: AudioQuality,
        onProgress: (received: Long, total: Long) -> Unit = { _, _ -> },
    ): java.io.File {
        ensureInit()
        val dir = downloadsDir ?: throw IOException("Хранилище недоступно")
        dir.mkdirs()
        val target = java.io.File(dir, downloadName(trackId) + ".audio")
        if (target.exists() && target.length() > 0) return target
        val resolved = resolveAudioUrl(trackId, quality)
        val audioUrl = if (resolved.contains(".m3u8") || resolved.contains("stream/hls")) {
            resolveTrackViaYoutubeFallback(trackId, quality) ?: resolved
        } else {
            resolved
        }
        val url = stripRangeParam(audioUrl)
        val tmp = java.io.File(dir, downloadName(trackId) + ".tmp")
        try {
            downloadInChunks(url, tmp, onProgress)
        } catch (e: Throwable) {
            if (e is InterruptedException) throw e
            // Диапазоны не поддерживаются или поток оборвался — страхуем обычной загрузкой.
            tmp.delete()
            downloadWhole(url, tmp, onProgress)
        }
        if (tmp.length() == 0L) {
            tmp.delete()
            throw IOException("Пустой файл")
        }
        if (!tmp.renameTo(target)) {
            tmp.delete()
            throw IOException("Не удалось сохранить файл")
        }
        return target
    }

    /**
     * Экспорт трека в публичные «Загрузки» устройства (Scoped Storage через MediaStore.Downloads).
     * Сохраняет трек с метаданными (название, исполнитель) в целевом формате (opus, ogg, mp3, flac).
     */
    fun exportTrackToPublicDownloads(
        context: android.content.Context,
        trackId: String,
        title: String,
        artist: String,
        format: String = "opus"
    ): Boolean {
        return runCatching {
            val cachedFile = downloadTrack(trackId, AudioQuality.High)
            if (!cachedFile.exists() || cachedFile.length() == 0L) return false

            val ext = when (format.lowercase()) {
                "ogg" -> "ogg"
                "mp3" -> "mp3"
                "flac" -> "flac"
                else -> "opus"
            }
            val mimeType = when (ext) {
                "ogg" -> "audio/ogg"
                "mp3" -> "audio/mpeg"
                "flac" -> "audio/flac"
                else -> "audio/opus"
            }
            val safeTitle = title.replace(Regex("[^a-zA-Z0-9а-яА-ЯёЁ _\\-]"), "").trim().ifBlank { "Track" }
            val safeArtist = artist.replace(Regex("[^a-zA-Z0-9а-яА-ЯёЁ _\\-]"), "").trim().ifBlank { "Artist" }
            val fileName = "$safeArtist - $safeTitle.$ext"

            val resolver = context.contentResolver
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
                val contentValues = android.content.ContentValues().apply {
                    put(android.provider.MediaStore.MediaColumns.DISPLAY_NAME, fileName)
                    put(android.provider.MediaStore.MediaColumns.MIME_TYPE, mimeType)
                    put(android.provider.MediaStore.MediaColumns.RELATIVE_PATH, android.os.Environment.DIRECTORY_DOWNLOADS + "/RIZE")
                    put(android.provider.MediaStore.Audio.Media.TITLE, title)
                    put(android.provider.MediaStore.Audio.Media.ARTIST, artist)
                }
                val uri = resolver.insert(android.provider.MediaStore.Downloads.EXTERNAL_CONTENT_URI, contentValues)
                    ?: return false
                resolver.openOutputStream(uri)?.use { out ->
                    cachedFile.inputStream().use { input ->
                        input.copyTo(out)
                    }
                }
            } else {
                val downloadsDir = android.os.Environment.getExternalStoragePublicDirectory(android.os.Environment.DIRECTORY_DOWNLOADS)
                val targetDir = java.io.File(downloadsDir, "RIZE").apply { mkdirs() }
                val targetFile = java.io.File(targetDir, fileName)
                cachedFile.copyTo(targetFile, overwrite = true)
            }
            true
        }.getOrDefault(false)
    }

    /**
     * Качает трек кусками в несколько соединений (HTTP Range). Одно соединение с
     * googlevideo упирается в собственный потолок скорости, поэтому плейлист из
     * сотни треков уходил в часы; 4 потока на трек дают кратный прирост.
     * Если размер неизвестен или файл мелкий — качаем в один поток.
     */
    private fun downloadInChunks(url: String, tmp: java.io.File, onProgress: (Long, Long) -> Unit) {
        val total = contentLength(url)
        val chunks = when {
            total <= 0L -> throw IOException("Диапазоны не поддерживаются")
            total < CHUNK_MIN_SIZE -> 1
            total < 1_500_000L -> 2
            else -> MAX_CHUNKS
        }
        if (chunks == 1) {
            downloadWhole(url, tmp, onProgress, total)
            return
        }

        val received = java.util.concurrent.atomic.AtomicLong(0)
        val lock = Any()
        var reported = 0L
        val report: (Long) -> Unit = { value ->
            synchronized(lock) {
                if (value - reported >= 256 * 1024 || value >= total) {
                    reported = value
                    onProgress(value.coerceAtMost(total), total)
                }
            }
        }

        java.io.RandomAccessFile(tmp, "rw").use { file ->
            file.setLength(total)
            val errors = java.util.Collections.synchronizedList(mutableListOf<Throwable>())
            val workers = (0 until chunks).map { index ->
                val start = total * index / chunks
                val end = if (index == chunks - 1) total - 1 else (total * (index + 1) / chunks) - 1
                Thread {
                    runCatching {
                        val request = OkHttpRequest.Builder()
                            .url(url)
                            .header("Range", "bytes=$start-$end")
                            .build()
                        downloadHttp.newCall(request).execute().use { resp ->
                            // 200 вместо 206 — сервер Range не умеет: пишем в один поток.
                            if (resp.code != 206) throw IOException("HTTP ${resp.code}")
                            val body = resp.body ?: throw IOException("Пустой ответ")
                            body.byteStream().use { input ->
                                val buffer = ByteArray(64 * 1024)
                                var offset = start
                                while (true) {
                                    val read = input.read(buffer)
                                    if (read == -1) break
                                    synchronized(file) {
                                        file.seek(offset)
                                        file.write(buffer, 0, read)
                                    }
                                    offset += read
                                    report(received.addAndGet(read.toLong()))
                                }
                            }
                        }
                    }.onFailure { errors += it }
                }.apply { isDaemon = true }
            }
            workers.forEach { it.start() }
            workers.forEach { it.join() }
            if (errors.isNotEmpty()) throw errors.first()
        }
        onProgress(total, total)
        if (tmp.length() != total) throw IOException("Файл докачан не полностью")
    }

    /** Обычная последовательная загрузка — страховка и вариант для мелких файлов. */
    private fun downloadWhole(
        url: String,
        tmp: java.io.File,
        onProgress: (Long, Long) -> Unit,
        knownTotal: Long = -1L,
    ) {
        val request = OkHttpRequest.Builder().url(url).build()
        downloadHttp.newCall(request).execute().use { resp ->
            if (!resp.isSuccessful) throw IOException("HTTP ${resp.code}")
            runCatching {
                val body = resp.body ?: throw IOException("Пустой ответ")
                val total = if (knownTotal > 0) knownTotal else body.contentLength()
                onProgress(0L, total)
                body.byteStream().use { input ->
                    tmp.outputStream().use { output ->
                        val buffer = ByteArray(64 * 1024)
                        var received = 0L
                        var reported = 0L
                        while (true) {
                            val read = input.read(buffer)
                            if (read == -1) break
                            output.write(buffer, 0, read)
                            received += read
                            // Throttle UI updates: report at most every 256 KiB.
                            if (received - reported >= 256 * 1024) {
                                reported = received
                                onProgress(received, total)
                            }
                        }
                        onProgress(received, if (total > 0) total else received)
                    }
                }
            }.onFailure { tmp.delete(); throw IOException("Не удалось сохранить файл") }
        }
    }

    /** Размер файла и поддержка Range — без этого загрузку не нарезать на части. */
    private fun contentLength(url: String): Long {
        val request = OkHttpRequest.Builder().url(url).head().build()
        downloadHttp.newCall(request).execute().use { resp ->
            if (!resp.isSuccessful) return -1L
            val ranges = resp.header("Accept-Ranges")?.equals("bytes", ignoreCase = true) == true
            val length = resp.header("Content-Length")?.toLongOrNull() ?: -1L
            return if (ranges && length > 0) length else -1L
        }
    }

    /**
     * Ссылки YouTube бывают с параметром «range=0-N»: он ограничивает отдачу, поэтому
     * для своей нарезки на куски этот параметр убираем.
     */
    private fun stripRangeParam(url: String): String {
        if (!url.contains("range=")) return url
        return runCatching {
            url.toHttpUrl().newBuilder().removeAllQueryParameters("range").build().toString()
        }.getOrDefault(url)
    }

    // ------------------------------------------------------------------ streaming

    /**
     * Direct audio URL for a track id. YouTube ids are 11-char video ids; SoundCloud tracks
     * use their page URL as the id. Blocking; cached with a TTL because googlevideo links expire.
     */
    fun resolveAudioUrl(trackId: String, quality: AudioQuality): String {
        ensureInit()
        val cacheKey = "$trackId|${quality.key}"
        val cached = streamCache[cacheKey]
        if (cached != null && System.currentTimeMillis() - cached.at < STREAM_TTL_MS) return cached.url

        if (trackId.startsWith("audius_")) {
            val audiusStream = resolveAudiusStreamUrl(trackId)
                ?: throw IOException("Не удалось получить аудиопоток Audius")
            streamCache[cacheKey] = CachedUrl(audiusStream, System.currentTimeMillis())
            return audiusStream
        }

        if (trackId.startsWith("sc_")) {
            val scStream = resolveSoundcloudStreamDirect(trackId.removePrefix("sc_"))
            if (scStream != null) {
                streamCache[cacheKey] = CachedUrl(scStream, System.currentTimeMillis())
                return scStream
            }
            val fallbackStream = resolveTrackViaYoutubeFallback(trackId, quality)
            if (fallbackStream != null) {
                streamCache[cacheKey] = CachedUrl(fallbackStream, System.currentTimeMillis())
                return fallbackStream
            }
            throw IOException("Не удалось получить аудиопоток SoundCloud")
        }

        if (trackId.startsWith("dz_")) {
            val dzStream = resolveDeezerTrackStream(trackId, quality)
            if (dzStream != null) {
                streamCache[cacheKey] = CachedUrl(dzStream, System.currentTimeMillis())
                return dzStream
            }
            throw IOException("Не удалось получить аудиопоток для трека Deezer")
        }

        val pageUrl = if (trackId.startsWith("http")) trackId else "https://www.youtube.com/watch?v=$trackId"
        val npStream = runCatching {
            val info = StreamInfo.getInfo(NewPipe.getServiceByUrl(pageUrl), pageUrl)
            pickAudioStream(info.audioStreams, quality)?.getContent()
        }.getOrNull()

        if (npStream != null) {
            streamCache[cacheKey] = CachedUrl(npStream, System.currentTimeMillis())
            return npStream
        }

        if ("soundcloud.com" in pageUrl || trackId.startsWith("sc_")) {
            val scEngine = runCatching { VotifyApp.instance.getCurrentCustomPrefs().soundcloudEngine }.getOrDefault("alt")
            when (scEngine) {
                "extractor" -> {
                    val npStream = runCatching {
                        val info = StreamInfo.getInfo(ServiceList.SoundCloud, pageUrl)
                        pickAudioStream(info.audioStreams, quality)?.getContent()
                    }.getOrNull()
                    if (npStream != null) {
                        streamCache[cacheKey] = CachedUrl(npStream, System.currentTimeMillis())
                        return npStream
                    }
                }
                "direct" -> {
                    val scStream = resolveSoundcloudStreamByPageUrl(pageUrl)
                    if (scStream != null) {
                        streamCache[cacheKey] = CachedUrl(scStream, System.currentTimeMillis())
                        return scStream
                    }
                }
                else -> { // "alt" - default
                    val scStream = resolveSoundcloudStreamByPageUrl(pageUrl)
                    if (scStream != null && !scStream.contains("preview") && !scStream.contains("/snippets/")) {
                        streamCache[cacheKey] = CachedUrl(scStream, System.currentTimeMillis())
                        return scStream
                    }
                    val fallbackStream = resolveTrackViaYoutubeFallback(trackId, quality)
                    if (fallbackStream != null) {
                        streamCache[cacheKey] = CachedUrl(fallbackStream, System.currentTimeMillis())
                        return fallbackStream
                    }
                    if (scStream != null) {
                        streamCache[cacheKey] = CachedUrl(scStream, System.currentTimeMillis())
                        return scStream
                    }
                }
            }
        }

        throw IOException("Не удалось получить аудиопоток")
    }

    fun cacheDeezerToYt(dzId: String, ytId: String) {
        deezerToYtCache[dzId] = ytId
    }

    /**
     * Resolves a Deezer track (`dz_<id>`) by mapping its artist and title to a full audio
     * stream on YouTube / YouTube Music / SoundCloud / Audius.
     */
    private fun resolveDeezerTrackStream(trackId: String, quality: AudioQuality): String? {
        val rawId = trackId.removePrefix("dz_").toLongOrNull() ?: return null
        val meta = DeezerApi.getTrackSync(rawId)

        // 1. Check if we previously found a matching YouTube video ID
        val cachedYtId = deezerToYtCache[trackId]
        if (cachedYtId != null) {
            val ytStream = runCatching {
                val pageUrl = "https://www.youtube.com/watch?v=$cachedYtId"
                val info = StreamInfo.getInfo(NewPipe.getServiceByUrl(pageUrl), pageUrl)
                pickAudioStream(info.audioStreams, quality)?.getContent()
            }.getOrNull()
            if (ytStream != null) return ytStream
        }

        // Clean query to avoid overly strict search misses
        val rawTitle = meta?.title.orEmpty()
        val rawArtist = meta?.artist.orEmpty()
        val cleanTitle = rawTitle
            .replace(Regex("""(?i)\s*[\(\[](?:feat\.|ft\.|bonus|remaster(?:ed)?|version|deluxe|explicit|edition|mix|anniversary|prod\.)[^\)\]]*[\)\]]"""), "")
            .trim()
        val query = if (rawArtist.isNotBlank() && cleanTitle.isNotBlank()) {
            "$rawArtist $cleanTitle".trim()
        } else if (rawArtist.isNotBlank()) {
            "$rawArtist $rawTitle".trim()
        } else {
            rawTitle.trim()
        }

        // 2. Search on YouTube Music & YouTube with multi-step fallback
        val queries = listOfNotNull(
            query.takeIf { it.isNotBlank() },
            if (rawArtist.isNotBlank() && cleanTitle.isNotBlank()) "$rawArtist - $cleanTitle" else null,
            if (rawArtist.isNotBlank() && cleanTitle.isNotBlank()) "$cleanTitle $rawArtist" else null,
            cleanTitle.takeIf { it.isNotBlank() && it != query },
        ).distinct()

        for (q in queries) {
            val ytCandidates = runCatching { search(q, limit = 5, music = true) }.getOrDefault(emptyList())
                .ifEmpty { runCatching { rawSearch(q, music = false, limit = 4, strictDuration = false) }.getOrDefault(emptyList()) }

            for (cand in ytCandidates) {
                if (cand.id.isNotBlank() && !cand.id.startsWith("dz_") && (cand.duration == 0 || cand.duration >= 45)) {
                    val ytStream = runCatching {
                        val pageUrl = "https://www.youtube.com/watch?v=${cand.id}"
                        val info = StreamInfo.getInfo(NewPipe.getServiceByUrl(pageUrl), pageUrl)
                        pickAudioStream(info.audioStreams, quality)?.getContent()
                    }.getOrNull()
                    if (ytStream != null) {
                        deezerToYtCache[trackId] = cand.id
                        return ytStream
                    }
                }
            }

            // Fallback to SoundCloud full-length stream
            val scStream = runCatching { resolveSoundcloudByQuery(q) }.getOrNull()
            if (scStream != null) return scStream

            // Fallback to Audius full-length stream
            val audiusStream = runCatching { resolveAudiusByQuery(q) }.getOrNull()
            if (audiusStream != null) return audiusStream
        }

        // Never fallback to 30s previewUrl snippets per user requirement
        return null
    }

    /**
     * Resolves a full-length track from SoundCloud by search query.
     */
    fun resolveSoundcloudByQuery(query: String): String? {
        val clientId = getSoundcloudClientId() ?: return null
        val url = "https://api-v2.soundcloud.com/search/tracks?q=" + encode(query) + "&limit=6&client_id=" + clientId
        val data = httpGetString(url) ?: return null
        val root = runCatching { json.parseToJsonElement(data).jsonObject }.getOrNull() ?: return null
        val collection = root["collection"]?.jsonArray ?: return null
        for (item in collection) {
            val trackObj = runCatching { item.jsonObject }.getOrNull() ?: continue
            val id = trackObj["id"]?.jsonPrimitive?.contentOrNull ?: continue
            val durationMs = trackObj["duration"]?.jsonPrimitive?.contentOrNull?.toLongOrNull() ?: 0L
            // Skip short snippets/previews (< 40 seconds)
            if (durationMs in 1..40_000) continue
            val stream = resolveSoundcloudStreamDirect(id)
            if (!stream.isNullOrBlank() && !stream.contains("preview") && !stream.contains("/snippets/")) {
                return stream
            }
        }
        return null
    }

    /**
     * Resolves a full-length track from Audius by search query.
     */
    fun resolveAudiusByQuery(query: String): String? {
        val audiusTracks = runCatching { searchAudius(query, limit = 4) }.getOrDefault(emptyList())
        for (t in audiusTracks) {
            val stream = runCatching { resolveAudiusStreamUrl(t.id) }.getOrNull()
            if (!stream.isNullOrBlank()) return stream
        }
        return null
    }

    /**
     * Resolves any track (SoundCloud, custom) via YouTube / YouTube Music search fallback
     * when the original source is geo-blocked, unavailable, or restricted.
     */
    private fun resolveTrackViaYoutubeFallback(trackId: String, quality: AudioQuality): String? {
        val cachedYt = deezerToYtCache[trackId]
        if (cachedYt != null) {
            val ytStream = runCatching {
                val pageUrl = "https://www.youtube.com/watch?v=$cachedYt"
                val info = StreamInfo.getInfo(NewPipe.getServiceByUrl(pageUrl), pageUrl)
                pickAudioStream(info.audioStreams, quality)?.getContent()
            }.getOrNull()
            if (ytStream != null) return ytStream
        }

        // 1. Look up track metadata from the local database
        var title: String? = null
        var artist: String? = null
        val entity = runCatching { app.votify.mobile.VotifyApp.instance.database.tracks().byIdSync(trackId) }.getOrNull()
        if (entity != null) {
            title = entity.title
            artist = entity.artist
        }

        // 2. If not found in DB, try fetching track info from SoundCloud API v2
        if (title.isNullOrBlank()) {
            val clientId = getSoundcloudClientId()
            if (clientId != null) {
                val jsonStr = if (trackId.startsWith("sc_")) {
                    httpGetString("https://api-v2.soundcloud.com/tracks/${trackId.removePrefix("sc_")}?client_id=$clientId")
                } else if (trackId.startsWith("http")) {
                    httpGetString("https://api-v2.soundcloud.com/resolve?url=" + encode(trackId) + "&client_id=" + clientId)
                } else null
                if (jsonStr != null) {
                    val root = runCatching { json.parseToJsonElement(jsonStr).jsonObject }.getOrNull()
                    title = root?.get("title")?.jsonPrimitive?.contentOrNull
                    artist = root?.get("user")?.jsonObject?.get("username")?.jsonPrimitive?.contentOrNull
                }
            }
        }

        // 3. If still empty, parse slug from soundcloud URL: soundcloud.com/artist/title
        if (title.isNullOrBlank() && trackId.contains("soundcloud.com/")) {
            val path = trackId.substringAfter("soundcloud.com/").substringBefore('?').trim('/')
            val parts = path.split('/')
            if (parts.size >= 2) {
                artist = parts[0].replace('-', ' ').replace('_', ' ')
                title = parts[1].replace('-', ' ').replace('_', ' ')
            }
        }

        val query = if (!artist.isNullOrBlank() && !title.isNullOrBlank()) "$artist $title" else (title ?: "")
        if (query.isBlank()) return null

        val ytTrack = runCatching { rawSearch(query, music = true, limit = 3).firstOrNull() }.getOrNull()
            ?: runCatching { rawSearch(query, music = false, limit = 3).firstOrNull() }.getOrNull()

        if (ytTrack != null) {
            deezerToYtCache[trackId] = ytTrack.id
            val ytStream = runCatching {
                val pageUrl = "https://www.youtube.com/watch?v=${ytTrack.id}"
                val info = StreamInfo.getInfo(NewPipe.getServiceByUrl(pageUrl), pageUrl)
                pickAudioStream(info.audioStreams, quality)?.getContent()
            }.getOrNull()
            if (ytStream != null) return ytStream
        }
        return null
    }

    /**
     * Warm the cache for upcoming tracks (called from a background coroutine).
     * Параллельно и с запасом: разбор страницы — самое долгое в загрузке трека,
     * поэтому ссылки для следующей пачки готовим заранее.
     */
    fun preload(ids: List<String>, quality: AudioQuality) {
        if (ids.isEmpty()) return
        runBlocking {
            coroutineScope {
                ids.take(8).map { id ->
                    async(Dispatchers.IO) { runCatching { resolveAudioUrl(id, quality) } }
                }.awaitAll()
            }
        }
    }

    private fun isOpusStream(stream: AudioStream): Boolean {
        val codec = stream.codec?.lowercase() ?: ""
        val fmt = stream.format?.name?.lowercase() ?: ""
        return "opus" in codec || "opus" in fmt || "webm" in fmt || "ogg" in fmt
    }

    private fun pickAudioStream(streams: List<AudioStream>, quality: AudioQuality): AudioStream? {
        val progressive = streams.filter { it.isUrl && it.deliveryMethod == DeliveryMethod.PROGRESSIVE_HTTP }
        val opusOnly = progressive.filter { isOpusStream(it) }
        val candidates = if (opusOnly.isNotEmpty()) opusOnly else progressive

        val byBitrate = candidates.sortedBy { it.averageBitrate }
        val known = byBitrate.filter { it.averageBitrate > 0 }.ifEmpty { byBitrate }
        return when (quality) {
            AudioQuality.Low -> known.firstOrNull { it.averageBitrate >= 48_000 } ?: known.firstOrNull()
            AudioQuality.Medium -> known.firstOrNull { it.averageBitrate in 96_000..160_000 } ?: known.lastOrNull()
            AudioQuality.High -> known.lastOrNull()
        } ?: candidates.firstOrNull() ?: progressive.firstOrNull()
    }

    private const val AUDIUS_API_BASE = "https://api.audius.co"
    private const val AUDIUS_APP_NAME = "RIZE"

    fun searchAudius(query: String, limit: Int = 20): List<Track> {
        val encodedQuery = java.net.URLEncoder.encode(query, "UTF-8")
        val url = "$AUDIUS_API_BASE/v1/tracks/search?query=$encodedQuery&app_name=$AUDIUS_APP_NAME"
        val request = OkHttpRequest.Builder().url(url).build()
        val response = runCatching { http.newCall(request).execute() }.getOrNull() ?: return emptyList()
        if (!response.isSuccessful) {
            response.close()
            return emptyList()
        }
        val body = response.body?.string().orEmpty()
        response.close()
        if (body.isBlank()) return emptyList()
        val jsonEl = runCatching { json.parseToJsonElement(body) }.getOrNull() ?: return emptyList()
        val data = jsonEl.jsonObject["data"]?.jsonArray ?: return emptyList()
        return data.mapNotNull { item ->
            val obj = item.jsonObject
            val id = "audius_" + (obj["id"]?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null)
            val title = obj["title"]?.jsonPrimitive?.contentOrNull ?: "Unknown Track"
            val user = obj["user"]?.jsonObject
            val artist = user?.get("name")?.jsonPrimitive?.contentOrNull ?: "Unknown Artist"
            val duration = obj["duration"]?.jsonPrimitive?.contentOrNull?.toDoubleOrNull()?.toLong() ?: 0L
            val artwork = obj["artwork"]?.jsonObject
            val artworkUrl = artwork?.get("480x480")?.jsonPrimitive?.contentOrNull
                ?: artwork?.get("150x150")?.jsonPrimitive?.contentOrNull
                ?: ""
            Track(
                id = id,
                title = title,
                artist = artist,
                cover = artworkUrl,
                url = "$AUDIUS_API_BASE/v1/tracks/${id.removePrefix("audius_")}/stream?app_name=$AUDIUS_APP_NAME",
                duration = duration.toInt(),
            )
        }.take(limit)
    }

    fun resolveAudiusStreamUrl(trackId: String): String? {
        val rawId = trackId.removePrefix("audius_")
        val streamUrl = "$AUDIUS_API_BASE/v1/tracks/$rawId/stream?app_name=$AUDIUS_APP_NAME"
        val req = OkHttpRequest.Builder().url(streamUrl).head().build()
        val resp = runCatching { http.newCall(req).execute() }.getOrNull()
        val finalUrl = resp?.request?.url?.toString() ?: streamUrl
        resp?.close()
        return finalUrl
    }

    // ------------------------------------------------------------------ lyrics

    /** lrclib.net — the same source the server used behind /api/lyrics. */
    fun lyrics(track: String, artist: String): LyricsResponse {
        val cleanTrack = track
            .replace(Regex("""(?i)\s*[\(\[](?:feat|ft|official|remix|slowed|reverb|prod|audio|video|music video|lyric video|lyrics|clip|hd|hq|4k)[^\)\]]*[\)\]]"""), "")
            .replace(Regex("""(?i)\s*-\s*official.*$"""), "")
            .replace(Regex("""(?i)\s*\|\s*official.*$"""), "")
            .replace(Regex("""(?i)\b(?:official\s*(?:music\s*)?video|lyric\s*video|official\s*audio)\b"""), "")
            .trim()
            .ifBlank { track.trim() }
        val cleanArtist = artist
            .replace(Regex("""(?i)\s*(?:feat|ft|\&|,).*$"""), "")
            .trim()
            .ifBlank { artist.trim() }

        // 1. Direct get with clean track & artist
        val get1 = "https://lrclib.net/api/get?track_name=${encode(cleanTrack)}&artist_name=${encode(cleanArtist)}"
        runCatching { httpGetString(get1) }.getOrNull()?.let { body ->
            runCatching { json.decodeFromString<LrcLibTrack>(body) }.getOrNull()
                ?.takeIf { it.syncedLyrics != null || it.plainLyrics != null }
                ?.let { return it.toResponse(track, artist) }
        }

        // 2. Direct get with raw track & artist if clean differed
        if (cleanTrack != track || cleanArtist != artist) {
            val get2 = "https://lrclib.net/api/get?track_name=${encode(track)}&artist_name=${encode(artist)}"
            runCatching { httpGetString(get2) }.getOrNull()?.let { body ->
                runCatching { json.decodeFromString<LrcLibTrack>(body) }.getOrNull()
                    ?.takeIf { it.syncedLyrics != null || it.plainLyrics != null }
                    ?.let { return it.toResponse(track, artist) }
            }
        }

        // 2b. If track contains " - ", try splitting "Artist - Title" (common in YouTube video titles)
        val parts = cleanTrack.split(" - ", limit = 2)
        if (parts.size == 2) {
            val splitArtist = parts[0].trim()
            val splitTitle = parts[1].trim()
            val getSplit = "https://lrclib.net/api/get?track_name=${encode(splitTitle)}&artist_name=${encode(splitArtist)}"
            runCatching { httpGetString(getSplit) }.getOrNull()?.let { body ->
                runCatching { json.decodeFromString<LrcLibTrack>(body) }.getOrNull()
                    ?.takeIf { it.syncedLyrics != null || it.plainLyrics != null }
                    ?.let { return it.toResponse(track, artist) }
            }
        }

        // 3. Search query with artist + title (prioritize synced lyrics)
        val search1 = "https://lrclib.net/api/search?q=${encode("$cleanArtist $cleanTrack")}"
        runCatching { httpGetString(search1) }.getOrNull()?.let { body ->
            val list = runCatching { json.decodeFromString<List<LrcLibTrack>>(body) }.getOrNull().orEmpty()
            list.firstOrNull { it.syncedLyrics != null }?.let { return it.toResponse(track, artist) }
            list.firstOrNull { it.plainLyrics != null }?.let { return it.toResponse(track, artist) }
        }

        // 4. Search query with just track name
        val search2 = "https://lrclib.net/api/search?q=${encode(cleanTrack)}"
        runCatching { httpGetString(search2) }.getOrNull()?.let { body ->
            val list = runCatching { json.decodeFromString<List<LrcLibTrack>>(body) }.getOrNull().orEmpty()
            list.firstOrNull { it.syncedLyrics != null }?.let { return it.toResponse(track, artist) }
            list.firstOrNull { it.plainLyrics != null }?.let { return it.toResponse(track, artist) }
        }

        return LyricsResponse(syncedLyrics = null, plainLyrics = null, track = track, artist = artist)
    }

    @kotlinx.serialization.Serializable
    private data class LrcLibTrack(
        val syncedLyrics: String? = null,
        val plainLyrics: String? = null,
        val trackName: String? = null,
        val artistName: String? = null,
    )

    private fun LrcLibTrack.toResponse(track: String, artist: String) = LyricsResponse(
        syncedLyrics = syncedLyrics,
        plainLyrics = plainLyrics,
        track = trackName ?: track,
        artist = artistName ?: artist,
    )

    // ------------------------------------------------------------------ playlist import

    /** YouTube / SoundCloud playlists via NewPipe, Spotify playlists via its embed page. */
    suspend fun importPlaylist(url: String): ImportedTracks = withContext(Dispatchers.IO) {
        ensureInit()
        val resolvedUrl = resolveUrlRedirects(url.trim())
        when {
            "music.yandex." in resolvedUrl || "yandex.ru/music" in resolvedUrl || "yandex.com/music" in resolvedUrl -> importYandexMusic(resolvedUrl)
            "soundcloud.com" in resolvedUrl -> importSoundcloud(resolvedUrl)
            "spotify.com" in resolvedUrl -> importSpotify(resolvedUrl)
            else -> importYoutube(resolvedUrl)
        }
    }

    suspend fun importYandexMusic(url: String): ImportedTracks = withContext(Dispatchers.IO) {
        ensureInit()
        val cleanUrl = url.substringBefore('?')
        val playlistMatch = Regex("""(?:users/([^/]+)/)?playlists/(\d+)""", RegexOption.IGNORE_CASE).find(cleanUrl)
        val albumMatch = Regex("""album/(\d+)""", RegexOption.IGNORE_CASE).find(cleanUrl)
        val trackMatch = Regex("""(?:track/|trackId=)(\d+)""", RegexOption.IGNORE_CASE).find(cleanUrl)
        val artistMatch = Regex("""artist/(\d+)""", RegexOption.IGNORE_CASE).find(cleanUrl)
        val profileMatch = Regex("""(?:users/|user/)([^/]+)(?:/(?:playlists|tracks|likes))?/?$""", RegexOption.IGNORE_CASE).find(cleanUrl)

        var playlistName = "Яндекс Музыка импорт"
        val candidates = mutableListOf<Pair<String, String>>() // (title, artist)

        if (playlistMatch != null) {
            val owner = playlistMatch.groupValues.getOrNull(1)?.ifBlank { null } ?: "yamusic-top"
            val kind = playlistMatch.groupValues[2]
            val apiUrl = "https://music.yandex.ru/handlers/playlist.jsx?owner=" + encode(owner) + "&kinds=" + encode(kind)
            val jsonStr = httpGetString(apiUrl)
            if (!jsonStr.isNullOrBlank()) {
                val root = runCatching { json.parseToJsonElement(jsonStr).jsonObject }.getOrNull()
                val pl = root?.get("playlist")?.jsonObject ?: root
                val title = pl?.get("title")?.jsonPrimitive?.contentOrNull
                if (!title.isNullOrBlank()) playlistName = title
                val tracksArray = pl?.get("tracks")?.jsonArray ?: JsonArray(emptyList())
                for (elem in tracksArray) {
                    val obj = (elem as? JsonObject)?.get("track")?.jsonObject ?: (elem as? JsonObject) ?: continue
                    val tTitle = obj["title"]?.jsonPrimitive?.contentOrNull ?: continue
                    val artistsArray = obj["artists"]?.jsonArray
                    val artistName = artistsArray?.mapNotNull { (it as? JsonObject)?.get("name")?.jsonPrimitive?.contentOrNull }
                        ?.joinToString(", ") ?: obj["artist"]?.jsonPrimitive?.contentOrNull ?: ""
                    candidates.add(tTitle to artistName)
                }
            }
        } else if (profileMatch != null) {
            val owner = profileMatch.groupValues[1]
            playlistName = "Плейлист пользователя $owner"
            // 1. Try public liked tracks (kind=3)
            val likedApiUrl = "https://music.yandex.ru/handlers/playlist.jsx?owner=" + encode(owner) + "&kinds=3"
            val likedJsonStr = httpGetString(likedApiUrl)
            if (!likedJsonStr.isNullOrBlank()) {
                val root = runCatching { json.parseToJsonElement(likedJsonStr).jsonObject }.getOrNull()
                val pl = root?.get("playlist")?.jsonObject ?: root
                val title = pl?.get("title")?.jsonPrimitive?.contentOrNull
                if (!title.isNullOrBlank()) playlistName = title
                val tracksArray = pl?.get("tracks")?.jsonArray ?: JsonArray(emptyList())
                for (elem in tracksArray) {
                    val obj = (elem as? JsonObject)?.get("track")?.jsonObject ?: (elem as? JsonObject) ?: continue
                    val tTitle = obj["title"]?.jsonPrimitive?.contentOrNull ?: continue
                    val artistsArray = obj["artists"]?.jsonArray
                    val artistName = artistsArray?.mapNotNull { (it as? JsonObject)?.get("name")?.jsonPrimitive?.contentOrNull }
                        ?.joinToString(", ") ?: obj["artist"]?.jsonPrimitive?.contentOrNull ?: ""
                    candidates.add(tTitle to artistName)
                }
            }
            // 2. If kind=3 had no tracks, query user library playlists
            if (candidates.isEmpty()) {
                val libApiUrl = "https://music.yandex.ru/handlers/library.jsx?owner=" + encode(owner) + "&filter=playlists"
                val libJsonStr = httpGetString(libApiUrl)
                if (!libJsonStr.isNullOrBlank()) {
                    val root = runCatching { json.parseToJsonElement(libJsonStr).jsonObject }.getOrNull()
                    val playlistsArr = root?.get("playlists")?.jsonArray
                    val firstKind = playlistsArr?.firstOrNull()?.jsonObject?.get("kind")?.jsonPrimitive?.contentOrNull
                    if (firstKind != null) {
                        val subPlUrl = "https://music.yandex.ru/handlers/playlist.jsx?owner=" + encode(owner) + "&kinds=" + encode(firstKind)
                        val subJsonStr = httpGetString(subPlUrl)
                        if (!subJsonStr.isNullOrBlank()) {
                            val subRoot = runCatching { json.parseToJsonElement(subJsonStr).jsonObject }.getOrNull()
                            val pl = subRoot?.get("playlist")?.jsonObject ?: subRoot
                            val title = pl?.get("title")?.jsonPrimitive?.contentOrNull
                            if (!title.isNullOrBlank()) playlistName = title
                            val tracksArray = pl?.get("tracks")?.jsonArray ?: JsonArray(emptyList())
                            for (elem in tracksArray) {
                                val obj = (elem as? JsonObject)?.get("track")?.jsonObject ?: (elem as? JsonObject) ?: continue
                                val tTitle = obj["title"]?.jsonPrimitive?.contentOrNull ?: continue
                                val artistsArray = obj["artists"]?.jsonArray
                                val artistName = artistsArray?.mapNotNull { (it as? JsonObject)?.get("name")?.jsonPrimitive?.contentOrNull }
                                    ?.joinToString(", ") ?: obj["artist"]?.jsonPrimitive?.contentOrNull ?: ""
                                candidates.add(tTitle to artistName)
                            }
                        }
                    }
                }
            }
        } else if (albumMatch != null && !cleanUrl.contains("/track/")) {
            val albumId = albumMatch.groupValues[1]
            val apiUrl = "https://music.yandex.ru/handlers/album.jsx?album=" + encode(albumId)
            val jsonStr = httpGetString(apiUrl)
            if (!jsonStr.isNullOrBlank()) {
                val root = runCatching { json.parseToJsonElement(jsonStr).jsonObject }.getOrNull()
                val title = root?.get("title")?.jsonPrimitive?.contentOrNull
                if (!title.isNullOrBlank()) playlistName = title
                val volumes = root?.get("volumes")?.jsonArray ?: JsonArray(emptyList())
                for (vol in volumes) {
                    val tracks = (vol as? JsonArray) ?: continue
                    for (elem in tracks) {
                        val obj = elem.jsonObject
                        val tTitle = obj["title"]?.jsonPrimitive?.contentOrNull ?: continue
                        val artistsArray = obj["artists"]?.jsonArray
                        val artistName = artistsArray?.mapNotNull { (it as? JsonObject)?.get("name")?.jsonPrimitive?.contentOrNull }
                            ?.joinToString(", ") ?: ""
                        candidates.add(tTitle to artistName)
                    }
                }
            }
        } else if (trackMatch != null) {
            val trackId = trackMatch.groupValues[1]
            val apiUrl = "https://music.yandex.ru/handlers/track.jsx?track=" + encode(trackId)
            val jsonStr = httpGetString(apiUrl)
            if (!jsonStr.isNullOrBlank()) {
                val root = runCatching { json.parseToJsonElement(jsonStr).jsonObject }.getOrNull()
                val trk = root?.get("track")?.jsonObject ?: root
                val tTitle = trk?.get("title")?.jsonPrimitive?.contentOrNull
                if (!tTitle.isNullOrBlank()) {
                    playlistName = tTitle
                    val artistsArray = trk?.get("artists")?.jsonArray
                    val artistName = artistsArray?.mapNotNull { (it as? JsonObject)?.get("name")?.jsonPrimitive?.contentOrNull }
                        ?.joinToString(", ") ?: ""
                    candidates.add(tTitle to artistName)
                }
            }
        } else if (artistMatch != null) {
            val artistId = artistMatch.groupValues[1]
            val apiUrl = "https://music.yandex.ru/handlers/artist.jsx?artist=" + encode(artistId) + "&what=tracks"
            val jsonStr = httpGetString(apiUrl)
            if (!jsonStr.isNullOrBlank()) {
                val root = runCatching { json.parseToJsonElement(jsonStr).jsonObject }.getOrNull()
                val artistName = root?.get("artist")?.jsonObject?.get("name")?.jsonPrimitive?.contentOrNull ?: "Исполнитель"
                playlistName = "Треки: $artistName"
                val tracksArray = root?.get("tracks")?.jsonArray ?: JsonArray(emptyList())
                for (elem in tracksArray) {
                    val obj = elem.jsonObject
                    val tTitle = obj["title"]?.jsonPrimitive?.contentOrNull ?: continue
                    val artistsArray = obj["artists"]?.jsonArray
                    val art = artistsArray?.mapNotNull { (it as? JsonObject)?.get("name")?.jsonPrimitive?.contentOrNull }
                        ?.joinToString(", ") ?: artistName
                    candidates.add(tTitle to art)
                }
            }
        }

        // HTML Fallback if handlers returned no candidates
        if (candidates.isEmpty()) {
            val html = httpGetString(cleanUrl)
            if (!html.isNullOrBlank()) {
                val ogTitle = Regex("""<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']""", RegexOption.IGNORE_CASE)
                    .find(html)?.groupValues?.get(1)
                if (!ogTitle.isNullOrBlank()) {
                    playlistName = ogTitle.substringBefore(" — слушать").substringBefore(" — Яндекс Музыка").trim()
                }
                val jsonLd = Regex("""<script\s+type=["']application/ld\+json["'][^>]*>(.*?)</script>""", RegexOption.DOT_MATCHES_ALL)
                    .find(html)?.groupValues?.get(1)
                if (!jsonLd.isNullOrBlank()) {
                    val ldRoot = runCatching { json.parseToJsonElement(jsonLd).jsonObject }.getOrNull()
                    val tracks = ldRoot?.get("tracks")?.jsonArray ?: ldRoot?.get("track")?.jsonObject?.get("itemListElement")?.jsonArray
                    if (tracks != null) {
                        for (elem in tracks) {
                            val obj = (elem as? JsonObject)?.get("item")?.jsonObject ?: (elem as? JsonObject) ?: continue
                            val tTitle = obj["name"]?.jsonPrimitive?.contentOrNull ?: continue
                            val byArtist = obj["byArtist"]?.jsonObject?.get("name")?.jsonPrimitive?.contentOrNull ?: ""
                            candidates.add(tTitle to byArtist)
                        }
                    }
                }
            }
        }

        if (candidates.isEmpty()) throw IOException("Не удалось извлечь треки из ссылки Яндекс Музыки")

        // Resolve candidates to full playable audio tracks in parallel batches
        val resolved = mutableListOf<Track>()
        candidates.take(MAX_IMPORT_ITEMS).chunked(5).forEach { batch ->
            coroutineScope {
                batch.map { (title, artist) ->
                    async(Dispatchers.IO) {
                        val q = if (artist.isNotBlank()) "$artist $title" else title
                        runCatching { rawSearch(q, music = true, 1).firstOrNull() }.getOrNull()
                            ?: runCatching { rawSearch(q, music = false, 1).firstOrNull() }.getOrNull()
                    }
                }.awaitAll().forEach { track ->
                    if (track != null) {
                        synchronized(resolved) { resolved += track }
                    }
                }
            }
        }

        if (resolved.isEmpty()) throw IOException("По трекам Яндекс Музыки ничего не найдено")
        ImportedTracks(name = playlistName, tracks = resolved.distinctBy { it.id })
    }

    private fun importYoutube(url: String): ImportedTracks {
        val info = PlaylistInfo.getInfo(ServiceList.YouTube, url)
        val items = allPlaylistPages(ServiceList.YouTube, url, info.relatedItems, info.nextPage)
        val tracks = items.mapNotNull { it.toTrack() }
        if (tracks.isEmpty()) throw IOException("Плейлист пуст или недоступен")
        return ImportedTracks(name = info.name, tracks = tracks)
    }

    private fun importSoundcloud(url: String): ImportedTracks {
        val cleanUrl = url.substringBefore('?')
        // Direct SoundCloud API v2 with stub hydration handles 100+ track playlists completely
        val directResult = runCatching { importSoundcloudDirect(cleanUrl) }.getOrNull()
        if (directResult != null && directResult.tracks.isNotEmpty()) {
            return directResult
        }

        val npResult = runCatching {
            val info = PlaylistInfo.getInfo(ServiceList.SoundCloud, cleanUrl)
            val items = allPlaylistPages(ServiceList.SoundCloud, cleanUrl, info.relatedItems, info.nextPage)
            val tracks = items.mapNotNull { it.toTrack() }
            if (tracks.isNotEmpty()) {
                ImportedTracks(name = info.name, tracks = tracks)
            } else null
        }.getOrNull()

        if (npResult != null) return npResult

        return importSoundcloudDirect(cleanUrl)
    }

    /** The first page holds ~100 items — walk every next page so long playlists import fully. */
    private fun allPlaylistPages(
        service: org.schabi.newpipe.extractor.StreamingService,
        url: String,
        first: List<StreamInfoItem>,
        firstNextPage: org.schabi.newpipe.extractor.Page?,
    ): List<StreamInfoItem> {
        val items = first.toMutableList()
        var page = firstNextPage
        var guarded = 0
        while (page != null && items.size < MAX_IMPORT_ITEMS && guarded++ < 60) {
            val more = runCatching { PlaylistInfo.getMoreItems(service, url, page) }.getOrNull() ?: break
            items += more.items.filterIsInstance<StreamInfoItem>()
            page = more.nextPage
        }
        return items
            .distinctBy { it.url }
            .filter { it.duration in MIN_IMPORT_SECONDS..MAX_TRACK_SECONDS }
    }

    /**
     * Spotify has no public API for playlist tracks, so (like the PC server) we read the
     * playlist's embed page and resolve each title on YouTube Music.
     */
    suspend fun importSpotify(url: String): ImportedTracks = withContext(Dispatchers.IO) {
        val playlistId = Regex("playlist/([a-zA-Z0-9]+)").find(url)?.groupValues?.get(1)
            ?: throw IOException("Некорректная ссылка Spotify")
        val html = httpGetString("https://open.spotify.com/embed/playlist/$playlistId")
            ?: throw IOException("Не удалось загрузить страницу плейлиста Spotify")
        val data = Regex("""<script[^>]*id="__NEXT_DATA__"[^>]*>(.*?)</script>""")
            .find(html)?.groupValues?.get(1)
            ?: throw IOException("Не удалось извлечь треки из Spotify")
        val entries = parseSpotifyTrackList(data)
        if (entries.isEmpty()) throw IOException("Не удалось извлечь треки из Spotify")

        // Resolve in small sequential batches so we don't hammer YouTube with 100 parallel calls.
        val resolved = mutableListOf<Track>()
        entries.take(MAX_IMPORT_ITEMS).chunked(5).forEach { batch ->
            coroutineScope {
                val results = batch.map { (title, artist) ->
                    async(Dispatchers.IO) {
                        // YT Music first; fall back to a regular YouTube search (videos play fine too).
                        val found = runCatching { rawSearch("$artist $title", music = true, 1).firstOrNull() }
                            .getOrNull()
                            ?: runCatching { rawSearch("$artist $title", music = false, 1).firstOrNull() }
                                .getOrNull()
                        // Never drop a track: if search timed out or returned empty, retain the track
                        found ?: Track(
                            id = "sp_${System.currentTimeMillis()}_${Math.abs((title + artist).hashCode())}",
                            title = title,
                            artist = artist.ifBlank { "Unknown" },
                            cover = "",
                            duration = 0,
                        )
                    }
                }.awaitAll()
                synchronized(resolved) {
                    resolved += results
                }
            }
        }
        if (resolved.isEmpty()) throw IOException("По трекам Spotify ничего не найдено")
        ImportedTracks(
            name = parseSpotifyName(data) ?: "Spotify плейлист",
            tracks = resolved.distinctBy { it.id },
        )
    }

    /** (title, artist) pairs from the embed page's __NEXT_DATA__ JSON. */
    private fun parseSpotifyTrackList(nextData: String): List<Pair<String, String>> {
        val root = runCatching { json.parseToJsonElement(nextData).jsonObject }.getOrNull() ?: return emptyList()
        val candidates = listOf(
            listOf("props", "pageProps", "state", "data", "entity", "trackList"),
            listOf("props", "pageProps", "state", "data", "playlist", "trackList"),
            listOf("props", "pageProps", "tracks", "items"),
            listOf("props", "pageProps", "data", "playlist", "trackList"),
        )
        val entries = mutableListOf<Pair<String, String>>()
        for (path in candidates) {
            var node: kotlinx.serialization.json.JsonElement? = root
            for (key in path) {
                node = (node as? JsonObject)?.get(key) ?: break
            }
            val list = (node as? kotlinx.serialization.json.JsonElement)?.let { el ->
                runCatching { el.jsonArray }.getOrNull()
            } ?: continue
            for (item in list) {
                val obj = runCatching { item.jsonObject }.getOrNull() ?: continue
                val trk = obj["track"]?.let { runCatching { it.jsonObject }.getOrNull() } ?: obj
                val title = trk["title"]?.jsonPrimitive?.contentOrNull
                    ?: trk["name"]?.jsonPrimitive?.contentOrNull ?: continue
                val artist = trk["subtitle"]?.jsonPrimitive?.contentOrNull
                    ?: trk["artists"]?.let { arr ->
                        runCatching {
                            arr.jsonArray.mapNotNull { it.jsonObject["name"]?.jsonPrimitive?.contentOrNull }.joinToString(", ")
                        }.getOrNull()
                    }.orEmpty()
                if (title.isNotBlank() && entries.none { it.first == title && it.second == artist }) {
                    entries.add(title to artist)
                }
            }
            if (entries.isNotEmpty()) return entries
        }

        // Recursive tree walk fallback
        fun walk(node: kotlinx.serialization.json.JsonElement) {
            when (node) {
                is JsonObject -> {
                    val title = node["title"]?.jsonPrimitive?.contentOrNull ?: node["name"]?.jsonPrimitive?.contentOrNull
                    val subtitle = node["subtitle"]?.jsonPrimitive?.contentOrNull ?: node["artist"]?.jsonPrimitive?.contentOrNull
                    val uri = node["uri"]?.jsonPrimitive?.contentOrNull.orEmpty()
                    if (!title.isNullOrBlank() && (!subtitle.isNullOrBlank() || uri.startsWith("spotify:track:"))) {
                        val pair = title.trim() to (subtitle?.trim().orEmpty())
                        if (entries.none { it.first == pair.first && it.second == pair.second }) {
                            entries.add(pair)
                        }
                    }
                    node.values.forEach { walk(it) }
                }
                is kotlinx.serialization.json.JsonArray -> {
                    node.forEach { walk(it) }
                }
                else -> {}
            }
        }
        walk(root)
        return entries
    }

    private fun parseSpotifyName(nextData: String): String? = runCatching {
        json.parseToJsonElement(nextData).jsonObject
            .get("props")!!.jsonObject["pageProps"]!!.jsonObject
            .get("state")!!.jsonObject["data"]!!.jsonObject
            .get("entity")!!.jsonObject["name"]!!.jsonPrimitive.content
    }.getOrNull()

    // ------------------------------------------------------------------ helpers

    private fun StreamInfoItem.toTrack(): Track? {
        val id = extractId(url) ?: return null
        return Track(
            id = id,
            title = name ?: "",
            artist = uploaderName?.trim().orEmpty().ifBlank { "Unknown" },
            cover = bestImage(thumbnails),
            url = url,
            duration = duration.toInt(),
        )
    }

    /** YouTube page URL → 11-char id; SoundCloud URL is its own id. */
    private fun extractId(pageUrl: String): String? = when {
        pageUrl.contains("youtube.com") || pageUrl.contains("youtu.be") ->
            Regex("[?&]v=([a-zA-Z0-9_-]{11})").find(pageUrl)?.groupValues?.get(1)
                ?: Regex("youtu\\.be/([a-zA-Z0-9_-]{11})").find(pageUrl)?.groupValues?.get(1)
        else -> pageUrl
    }

    private fun bestImage(images: List<Image>): String =
        images.maxByOrNull { (it.width.toLong()) * (it.height.toLong()) }?.url ?: ""

    private fun encode(s: String) = java.net.URLEncoder.encode(s, "UTF-8")

    private fun getEffectiveHttpClient(): OkHttpClient {
        val prefs = runCatching { app.votify.mobile.VotifyApp.instance.getCurrentCustomPrefs() }.getOrNull()
        if (prefs != null && prefs.zapretEnabled) {
            val port = prefs.zapretPort.toIntOrNull() ?: 1080
            val host = prefs.zapretHost.ifBlank { "127.0.0.1" }
            return http.newBuilder()
                .proxy(java.net.Proxy(java.net.Proxy.Type.HTTP, java.net.InetSocketAddress(host, port)))
                .build()
        }
        if (prefs != null && prefs.proxyEnabled && prefs.proxyHost.isNotBlank()) {
            val port = prefs.proxyPort.toIntOrNull() ?: 8080
            return http.newBuilder()
                .proxy(java.net.Proxy(java.net.Proxy.Type.HTTP, java.net.InetSocketAddress(prefs.proxyHost, port)))
                .build()
        }
        return http
    }

    private fun httpGetString(url: String): String? {
        val request = OkHttpRequest.Builder()
            .url(url)
            .header("User-Agent", "RIZE Android (https://github.com/exieeez/RIZE)")
            .build()
        getEffectiveHttpClient().newCall(request).execute().use { resp ->
            if (!resp.isSuccessful) return null
            return resp.body?.string()
        }
    }

    /** Fallback cover search via iTunes API (clean 600x600 cover for releases without artwork on SoundCloud). */
    fun fetchCoverFallback(artist: String, title: String): String {
        val q = if (artist.isNotBlank() && artist != "Unknown") "$artist $title" else title
        if (q.isBlank()) return ""
        return runCatching {
            val encoded = encode(q)
            val jsonStr = httpGetString("https://itunes.apple.com/search?term=$encoded&entity=song&limit=1") ?: return@runCatching ""
            val root = json.parseToJsonElement(jsonStr).jsonObject
            val results = root["results"]?.jsonArray
            val first = results?.firstOrNull()?.jsonObject
            first?.get("artworkUrl100")?.jsonPrimitive?.contentOrNull?.replace("100x100bb", "600x600bb") ?: ""
        }.getOrDefault("")
    }

    private fun resolveUrlRedirects(rawUrl: String): String {
        var currentUrl = rawUrl.trim()
        if (!currentUrl.startsWith("http://") && !currentUrl.startsWith("https://")) {
            currentUrl = "https://$currentUrl"
        }
        return runCatching {
            val request = OkHttpRequest.Builder()
                .url(currentUrl)
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                .build()
            http.newCall(request).execute().use { resp ->
                resp.request.url.toString()
            }
        }.getOrDefault(currentUrl)
    }

    @Volatile
    private var scClientId: String? = null
    @Volatile
    private var scClientIdExpiry: Long = 0

    private val FALLBACK_SOUNDCLOUD_CLIENT_IDS = listOf(
        "vt2oQexBfFF8I9fidrzKADHEtcll3t3Q",
        "2t9loNfhNvhAzikio344W5URvQXQXgit",
        "a3e059563d7fd3372b49b37f00a00bcf",
        "iZIs9mchVcX5lhVR1EzGCcyBDpqDe2cg",
        "fDoItMDbsbZz8dY16ZzARCZmzgHBPotA",
    )

    private fun getSoundcloudClientId(): String? {
        if (!scClientId.isNullOrBlank() && System.currentTimeMillis() < scClientIdExpiry) {
            return scClientId
        }
        val scraped = runCatching {
            val html = httpGetString("https://soundcloud.com") ?: return@runCatching null
            val scriptUrls = Regex("""(?:src|href)="((?:https?:)?//[^" ]+\.js[^" ]*)"""", RegexOption.IGNORE_CASE)
                .findAll(html)
                .map { m ->
                    val u = m.groupValues[1]
                    if (u.startsWith("//")) "https:$u" else u
                }
                .toList()
            val scripts = listOf(html) + scriptUrls.takeLast(10).mapNotNull { runCatching { httpGetString(it) }.getOrNull() }
            for (script in scripts) {
                val match = Regex("""client_id["']?\s*[:=]\s*["']([a-zA-Z0-9_-]{16,})["']""").find(script)
                    ?: Regex("""client_id(?:=|%3D|["':])([a-zA-Z0-9_-]{16,})""", RegexOption.IGNORE_CASE).find(script)
                if (match != null) {
                    val id = match.groupValues[1]
                    scClientId = id
                    scClientIdExpiry = System.currentTimeMillis() + 3600_000L
                    return@runCatching id
                }
            }
            null
        }.getOrNull()

        if (!scraped.isNullOrBlank()) return scraped

        // Fallback to verified client_ids if web scraping failed
        val workingFallback = FALLBACK_SOUNDCLOUD_CLIENT_IDS.firstOrNull { id ->
            val test = runCatching {
                httpGetString("https://api-v2.soundcloud.com/search/tracks?q=test&limit=1&client_id=$id")
            }.getOrNull()
            !test.isNullOrBlank() && "\"collection\"" in test
        } ?: FALLBACK_SOUNDCLOUD_CLIENT_IDS.first()

        scClientId = workingFallback
        scClientIdExpiry = System.currentTimeMillis() + 1800_000L
        return workingFallback
    }

    private fun importSoundcloudDirect(cleanUrl: String): ImportedTracks {
        val clientId = getSoundcloudClientId() ?: throw IOException("SoundCloud недоступен (не удалось получить client_id)")
        val resolveUrl = "https://api-v2.soundcloud.com/resolve?url=" + encode(cleanUrl) + "&client_id=" + clientId
        val jsonStr = httpGetString(resolveUrl) ?: throw IOException("Плейлист SoundCloud не найден или недоступен")
        val root = runCatching { json.parseToJsonElement(jsonStr).jsonObject }.getOrNull()
            ?: throw IOException("Ошибка разбора данных SoundCloud")

        val kind = root["kind"]?.jsonPrimitive?.contentOrNull
        val title = root["title"]?.jsonPrimitive?.contentOrNull ?: "SoundCloud Playlist"
        val tracksList = mutableListOf<Track>()

        if (kind == "playlist") {
            val tracksArray = root["tracks"]?.jsonArray ?: kotlinx.serialization.json.JsonArray(emptyList())
            val rawEntries = mutableListOf<Pair<Long, kotlinx.serialization.json.JsonObject?>>()
            for (elem in tracksArray) {
                val obj = elem.jsonObject
                val idLong = obj["id"]?.jsonPrimitive?.contentOrNull?.toLongOrNull() ?: continue
                val hasTitle = obj["title"]?.jsonPrimitive?.contentOrNull != null
                rawEntries.add(idLong to (if (hasTitle) obj else null))
            }

            // Hydrate stub tracks (SoundCloud returns full objects for first ~5 tracks and only {id} for the rest)
            val stubIds = rawEntries.filter { it.second == null }.map { it.first }
            val hydratedMap = mutableMapOf<Long, kotlinx.serialization.json.JsonObject>()
            for (chunk in stubIds.chunked(50)) {
                if (tracksList.size + hydratedMap.size >= MAX_IMPORT_ITEMS) break
                val idsParam = chunk.joinToString("%2C")
                val hUrl = "https://api-v2.soundcloud.com/tracks?ids=$idsParam&client_id=$clientId"
                val hJson = httpGetString(hUrl) ?: continue
                val hArr = runCatching { json.parseToJsonElement(hJson).jsonArray }.getOrNull() ?: continue
                for (item in hArr) {
                    val hObj = item.jsonObject
                    val hId = hObj["id"]?.jsonPrimitive?.contentOrNull?.toLongOrNull() ?: continue
                    hydratedMap[hId] = hObj
                }
            }

            for ((idLong, initialObj) in rawEntries.take(MAX_IMPORT_ITEMS)) {
                val obj = initialObj ?: hydratedMap[idLong] ?: continue
                val permalink = obj["permalink_url"]?.jsonPrimitive?.contentOrNull
                val tTitle = obj["title"]?.jsonPrimitive?.contentOrNull ?: continue
                val artist = obj["user"]?.jsonObject?.get("username")?.jsonPrimitive?.contentOrNull ?: "Unknown"
                val rawArt = obj["artwork_url"]?.jsonPrimitive?.contentOrNull
                    ?: obj["user"]?.jsonObject?.get("avatar_url")?.jsonPrimitive?.contentOrNull
                var artwork = rawArt?.replace("-large", "-t500x500")?.replace("-badge", "-t500x500") ?: ""
                if (artwork.isBlank() || artwork.contains("default_avatar")) {
                    artwork = fetchCoverFallback(artist, tTitle)
                }
                val duration = ((obj["duration"]?.jsonPrimitive?.contentOrNull?.toLongOrNull() ?: 0L) / 1000L).toInt()
                val id = permalink ?: "sc_$idLong"
                tracksList.add(
                    Track(
                        id = id,
                        title = tTitle,
                        artist = artist,
                        cover = artwork,
                        url = permalink ?: cleanUrl,
                        duration = duration,
                    )
                )
            }
        } else if (kind == "track") {
            val permalink = root["permalink_url"]?.jsonPrimitive?.contentOrNull
            val tTitle = root["title"]?.jsonPrimitive?.contentOrNull ?: "Unknown Track"
            val artist = root["user"]?.jsonObject?.get("username")?.jsonPrimitive?.contentOrNull ?: "Unknown"
            val rawArt = root["artwork_url"]?.jsonPrimitive?.contentOrNull
                ?: root["user"]?.jsonObject?.get("avatar_url")?.jsonPrimitive?.contentOrNull
            var artwork = rawArt?.replace("-large", "-t500x500")?.replace("-badge", "-t500x500") ?: ""
            if (artwork.isBlank() || artwork.contains("default_avatar")) {
                artwork = fetchCoverFallback(artist, tTitle)
            }
            val duration = ((root["duration"]?.jsonPrimitive?.contentOrNull?.toLongOrNull() ?: 0L) / 1000L).toInt()
            val id = permalink ?: root["id"]?.jsonPrimitive?.contentOrNull?.let { "sc_$it" } ?: cleanUrl
            tracksList.add(
                Track(
                    id = id,
                    title = tTitle,
                    artist = artist,
                    cover = artwork,
                    url = permalink ?: cleanUrl,
                    duration = duration,
                )
            )
        }

        if (tracksList.isEmpty()) throw IOException("Плейлист SoundCloud пуст или недоступен")
        return ImportedTracks(name = title, tracks = tracksList)
    }

    private fun resolveSoundcloudStreamDirect(numericId: String): String? {
        val clientId = getSoundcloudClientId() ?: return null
        val trackUrl = "https://api-v2.soundcloud.com/tracks/$numericId?client_id=$clientId"
        val data = httpGetString(trackUrl) ?: return null
        return parseSoundcloudStreamFromTrackJson(data, clientId)
    }

    private fun resolveSoundcloudStreamByPageUrl(pageUrl: String): String? {
        val clientId = getSoundcloudClientId() ?: return null
        val resolveUrl = "https://api-v2.soundcloud.com/resolve?url=" + encode(pageUrl) + "&client_id=" + clientId
        val data = httpGetString(resolveUrl) ?: return null
        return parseSoundcloudStreamFromTrackJson(data, clientId)
    }

    private fun parseSoundcloudStreamFromTrackJson(jsonStr: String, clientId: String): String? {
        val root = runCatching { json.parseToJsonElement(jsonStr).jsonObject }.getOrNull() ?: return null
        val transcodings = root["media"]?.jsonObject?.get("transcodings")?.jsonArray ?: return null

        // Order transcodings by priority: progressive MP3 > HLS AAC/MP4 > general HLS > others
        val sortedTranscodings = transcodings.mapNotNull { runCatching { it.jsonObject }.getOrNull() }.sortedBy { obj ->
            val format = obj["format"]?.jsonObject
            val protocol = format?.get("protocol")?.jsonPrimitive?.contentOrNull ?: ""
            val mime = format?.get("mime_type")?.jsonPrimitive?.contentOrNull ?: ""
            when {
                protocol == "progressive" || "audio/mpeg" in mime -> 0
                protocol == "hls" && ("mp4" in mime || "aac" in mime) -> 1
                protocol == "hls" -> 2
                else -> 3
            }
        }

        for (obj in sortedTranscodings) {
            val targetUrl = obj["url"]?.jsonPrimitive?.contentOrNull ?: continue
            val separator = if ("?" in targetUrl) "&" else "?"
            val streamData = httpGetString("$targetUrl${separator}client_id=$clientId") ?: continue
            val streamObj = runCatching { json.parseToJsonElement(streamData).jsonObject }.getOrNull() ?: continue
            val streamUrl = streamObj["url"]?.jsonPrimitive?.contentOrNull
            if (!streamUrl.isNullOrBlank()) {
                return streamUrl
            }
        }
        return null
    }

    // ------------------------------------------------------------------ NewPipe downloader

    /** Bridges NewPipeExtractor to OkHttp (the library itself ships no HTTP client). */
    private class OkHttpDownloader(private val client: OkHttpClient) : Downloader() {

        override fun execute(request: Request): Response {
            val builder = OkHttpRequest.Builder().url(request.url())
            request.headers().forEach { (name, values) ->
                values.forEach { value -> builder.addHeader(name, value) }
            }
            when (request.httpMethod()) {
                "HEAD" -> builder.head()
                "POST" -> builder.post((request.dataToSend() ?: ByteArray(0)).toRequestBody(null))
                else -> builder.get()
            }
            client.newCall(builder.build()).execute().use { resp ->
                if (resp.code == 429) {
                    throw ReCaptchaException("reCaptcha Challenge requested", request.url())
                }
                return Response(
                    resp.code,
                    resp.message,
                    resp.headers.toMultimap(),
                    resp.body?.string().orEmpty(),
                    request.url(),
                )
            }
        }
    }
}
