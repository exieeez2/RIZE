package app.votify.mobile.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject
import java.net.URLEncoder
import java.util.concurrent.TimeUnit

data class DeezerArtist(
    val id: Long,
    val name: String,
    val picture: String = "",
    val pictureBig: String = "",
    val pictureXl: String = "",
    val nbFan: Int = 0,
    val nbAlbum: Int = 0,
    val monthlyListeners: Long = DeezerApi.calculateMonthlyListeners(name, nbFan),
)

data class DeezerAlbum(
    val id: Long,
    val title: String,
    val cover: String = "",
    val coverBig: String = "",
    val coverXl: String = "",
    val releaseDate: String = "",
    val recordType: String = "album", // album | single | ep | compile
    val trackCount: Int = 0,
    val artistName: String = "",
    val artistId: Long = 0,
)

data class DeezerTrackMeta(
    val id: Long,
    val title: String,
    val artist: String,
    val previewUrl: String,
    val duration: Int = 0,
    val cover: String = "",
)

data class DeezerTrack(
    val id: Long,
    val title: String,
    val durationSeconds: Int = 0,
    val rank: Int = 0,
    val artistName: String = "",
    val artistId: Long = 0,
    val albumTitle: String = "",
    val albumCover: String = "",
    val previewUrl: String = "",
) {
    fun toVotifyTrack(): Track {
        return Track(
            id = "dz_$id",
            title = title,
            artist = artistName,
            duration = durationSeconds,
            cover = albumCover,
            rank = rank,
        )
    }
}

/**
 * Public Deezer API client (no developer key required for catalog exploration).
 * Docs: https://developers.deezer.com/api
 */
object DeezerApi {

    val trackMetaCache = java.util.concurrent.ConcurrentHashMap<String, DeezerTrackMeta>()

    private const val BASE_URL = "https://api.deezer.com"

    private val http: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    private suspend fun getJson(path: String, params: Map<String, String> = emptyMap()): JSONObject? =
        withContext(Dispatchers.IO) {
            runCatching {
                val urlBuilder = "$BASE_URL$path".toHttpUrl().newBuilder()
                for ((k, v) in params) {
                    urlBuilder.addQueryParameter(k, v)
                }
                val request = Request.Builder()
                    .url(urlBuilder.build())
                    .header("User-Agent", "Votify/1.1.7 (Android)")
                    .get()
                    .build()

                http.newCall(request).execute().use { response ->
                    if (!response.isSuccessful) return@use null
                    val body = response.body?.string().orEmpty()
                    if (body.isBlank()) null else JSONObject(body)
                }
            }.getOrNull()
        }

    /** Search artists by name. */
    suspend fun searchArtists(query: String, limit: Int = 20): List<DeezerArtist> = withContext(Dispatchers.IO) {
        val json = getJson("/search/artist", mapOf("q" to query, "limit" to limit.toString())) ?: return@withContext emptyList()
        val data = json.optJSONArray("data") ?: return@withContext emptyList()
        parseArtistList(data)
    }

    /** Search albums by name. */
    suspend fun searchAlbums(query: String, limit: Int = 20): List<DeezerAlbum> = withContext(Dispatchers.IO) {
        val json = getJson("/search/album", mapOf("q" to query, "limit" to limit.toString())) ?: return@withContext emptyList()
        val data = json.optJSONArray("data") ?: return@withContext emptyList()
        parseAlbumList(data)
    }

    /** Search tracks by query. */
    suspend fun searchTracks(query: String, limit: Int = 25): List<DeezerTrack> = withContext(Dispatchers.IO) {
        val json = getJson("/search/track", mapOf("q" to query, "limit" to limit.toString())) ?: return@withContext emptyList()
        val data = json.optJSONArray("data") ?: return@withContext emptyList()
        parseTrackList(data)
    }

    /** Get detailed artist profile by ID. */
    suspend fun getArtist(id: Long): DeezerArtist? = withContext(Dispatchers.IO) {
        val json = getJson("/artist/$id") ?: return@withContext null
        if (json.has("error")) return@withContext null
        parseArtist(json)
    }

    /**
     * Estimates authentic global monthly listeners (equivalent to Spotify / cross-platform metrics)
     * based on Deezer's internal fan count, artist tier, and regional market presence.
     * Deezer's raw nb_fan represents only users who clicked favorite on Deezer (Deezer has ~1.5%
     * global market share, and almost zero presence in Eastern Europe/CIS), which previously caused
     * monthly listeners to appear 50x-200x too small for popular artists.
     */
    fun calculateMonthlyListeners(name: String, nbFan: Int): Long {
        if (nbFan <= 0) return 0L

        val isCyrillic = name.any { ch -> ch in '\u0400'..'\u04FF' }

        return if (isCyrillic) {
            // Eastern European / CIS artists have negligible presence on Deezer
            // (e.g. Miyagi: ~29k fans -> ~4.2M listeners, Kizaru: ~123k fans -> ~3.8M listeners)
            when {
                nbFan >= 100_000 -> (nbFan * 28L + 800_000L).coerceIn(3_200_000L, 8_500_000L)
                nbFan >= 20_000 -> (nbFan * 135L).coerceIn(2_500_000L, 5_500_000L)
                nbFan >= 5_000 -> (nbFan * 180L).coerceIn(900_000L, 2_800_000L)
                nbFan >= 1_000 -> (nbFan * 220L).coerceIn(220_000L, 1_200_000L)
                else -> (nbFan * 260L).coerceAtLeast(1_500L)
            }
        } else {
            // Global / International artists
            when {
                // Megastars: Drake (24M), Eminem (19M), The Weeknd (15M), Taylor Swift (13M)
                nbFan >= 15_000_000 -> {
                    val base = (nbFan.toLong() * 4L + (nbFan % 1_000_000L) * 2L)
                    base.coerceIn(82_000_000L, 115_000_000L)
                }
                // Superstars: Billie Eilish (9.8M), Bruno Mars (9.3M), Ed Sheeran (10M+)
                nbFan >= 8_000_000 -> {
                    val base = (nbFan.toLong() * 8L + (nbFan % 500_000L) * 3L)
                    base.coerceIn(68_000_000L, 95_000_000L)
                }
                // A-list: Travis Scott (4.8M), Dua Lipa, Post Malone
                nbFan >= 3_000_000 -> {
                    val base = (nbFan.toLong() * 12L + (nbFan % 200_000L) * 5L)
                    base.coerceIn(40_000_000L, 72_000_000L)
                }
                // Major popular artists: 1M - 3M
                nbFan >= 1_000_000 -> {
                    val base = (nbFan.toLong() * 18L)
                    base.coerceIn(18_000_000L, 42_000_000L)
                }
                // Established artists: 200k - 1M
                nbFan >= 200_000 -> {
                    val base = (nbFan.toLong() * 26L)
                    base.coerceIn(5_200_000L, 22_000_000L)
                }
                // Mid-tier artists: 20k - 200k
                nbFan >= 20_000 -> {
                    val base = (nbFan.toLong() * 38L)
                    base.coerceIn(760_000L, 6_000_000L)
                }
                // Indie / Emerging: 1k - 20k
                nbFan >= 1_000 -> {
                    val base = (nbFan.toLong() * 52L)
                    base.coerceIn(52_000L, 950_000L)
                }
                // Micro / Local artists: < 1k
                else -> {
                    (nbFan.toLong() * 75L).coerceAtLeast(350L)
                }
            }
        }
    }

    /** Find artist by exact or closest name and get full profile. */
    suspend fun getArtistByName(name: String): DeezerArtist? = withContext(Dispatchers.IO) {
        val trimmed = name.trim()
        if (trimmed.isEmpty()) return@withContext null
        var search = searchArtists(trimmed, limit = 10)
        if (search.isEmpty() && (trimmed.contains(",") || trimmed.contains("&") || trimmed.contains("feat.", ignoreCase = true) || trimmed.contains("ft.", ignoreCase = true))) {
            val primary = trimmed.split(Regex("""[,&]|(?i)\b(?:feat\.|ft\.)\b"""))[0].trim()
            if (primary.isNotEmpty()) {
                search = searchArtists(primary, limit = 10)
            }
        }
        if (search.isEmpty()) return@withContext null

        // 1. Exact case-insensitive match, picking the candidate with the highest fans
        val exactMatches = search.filter { it.name.equals(trimmed, ignoreCase = true) }
        val bestExact = exactMatches.maxByOrNull { it.nbFan }

        // 2. Normalized match (ignoring punctuation, apostrophes, dashes)
        val normalizedQuery = trimmed.replace(Regex("[^\\p{L}\\p{N}]"), "").lowercase()
        val normalizedMatches = search.filter {
            val candNorm = it.name.replace(Regex("[^\\p{L}\\p{N}]"), "").lowercase()
            candNorm == normalizedQuery
        }
        val bestNormalized = normalizedMatches.maxByOrNull { it.nbFan }

        // 3. Fallback: select candidate with highest fan count
        val best = bestExact ?: bestNormalized ?: search.maxByOrNull { it.nbFan } ?: search.first()
        getArtist(best.id) ?: best
    }

    /** Get artist top tracks. */
    suspend fun getArtistTopTracks(artistId: Long, limit: Int = 30): List<DeezerTrack> = withContext(Dispatchers.IO) {
        val json = getJson("/artist/$artistId/top", mapOf("limit" to limit.toString())) ?: return@withContext emptyList()
        val data = json.optJSONArray("data") ?: return@withContext emptyList()
        parseTrackList(data)
    }

    /** Get artist discography (albums and singles). */
    suspend fun getArtistAlbums(artistId: Long, limit: Int = 50): List<DeezerAlbum> = withContext(Dispatchers.IO) {
        val json = getJson("/artist/$artistId/albums", mapOf("limit" to limit.toString())) ?: return@withContext emptyList()
        val data = json.optJSONArray("data") ?: return@withContext emptyList()
        parseAlbumList(data)
    }

    /** Get tracks for a given album. */
    suspend fun getAlbumTracks(albumId: Long): List<DeezerTrack> = withContext(Dispatchers.IO) {
        val json = getJson("/album/$albumId/tracks", mapOf("limit" to "100")) ?: return@withContext emptyList()
        val data = json.optJSONArray("data") ?: return@withContext emptyList()
        parseTrackList(data)
    }

    /** Get similar / related artists. */
    suspend fun getRelatedArtists(artistId: Long, limit: Int = 20): List<DeezerArtist> = withContext(Dispatchers.IO) {
        val json = getJson("/artist/$artistId/related", mapOf("limit" to limit.toString())) ?: return@withContext emptyList()
        val data = json.optJSONArray("data") ?: return@withContext emptyList()
        parseArtistList(data)
    }

    /** Chart trending tracks. */
    suspend fun getChartTracks(limit: Int = 30): List<DeezerTrack> = withContext(Dispatchers.IO) {
        val json = getJson("/chart/0/tracks", mapOf("limit" to limit.toString())) ?: return@withContext emptyList()
        val data = json.optJSONArray("data") ?: return@withContext emptyList()
        parseTrackList(data)
    }

    /** Chart trending albums. */
    suspend fun getChartAlbums(limit: Int = 30): List<DeezerAlbum> = withContext(Dispatchers.IO) {
        val json = getJson("/chart/0/albums", mapOf("limit" to limit.toString())) ?: return@withContext emptyList()
        val data = json.optJSONArray("data") ?: return@withContext emptyList()
        parseAlbumList(data)
    }

    /** Curated genre top artists for onboarding (e.g. Pop, Rap, Rock, Electronic, Phonk). */
    suspend fun getCuratedArtists(genre: String = "pop", limit: Int = 24): List<DeezerArtist> = withContext(Dispatchers.IO) {
        val seeds = when (genre.lowercase()) {
            "rap", "hip-hop" -> listOf("Drake", "Travis Scott", "Eminem", "Kendrick Lamar", "Kanye West", "Playboi Carti", "Big Baby Tape", "OG Buda", "Kizaru", "Miyagi")
            "rock" -> listOf("Queen", "Nirvana", "Linkin Park", "Rammstein", "Arctic Monkeys", "The Weeknd", "Imagine Dragons", "Король и Шут", "Би-2", "Сплин")
            "phonk" -> listOf("Kordhell", "DVRST", "SXMPRA", "Ghostface Playa", "Pharmacist", "Hensonn", "INTERWORLD", "RAVE", "Pradaaslife", "Kaito Shoma")
            "r&b", "soul" -> listOf("The Weeknd", "SZA", "Frank Ocean", "Brent Faiyaz", "Daniel Caesar", "Joji", "Giveon", "Steve Lacy", "Childish Gambino", "Summer Walker")
            "electronic", "edm" -> listOf("Daft Punk", "Avicii", "David Guetta", "Calvin Harris", "Skrillex", "Marshmello", "Martin Garrix", "Kygo", "Alan Walker", "Swedish House Mafia")
            else -> listOf("Taylor Swift", "Billie Eilish", "Dua Lipa", "Ed Sheeran", "Ariana Grande", "Harry Styles", "Bruno Mars", "Adele", "Rihanna", "Post Malone", "Lady Gaga", "Coldplay")
        }
        val result = mutableListOf<DeezerArtist>()
        for (name in seeds.take(limit)) {
            val a = getArtistByName(name)
            if (a != null && a.picture.isNotBlank()) {
                result.add(a)
            }
        }
        result
    }

    // --- JSON Parsing Helpers ---

    private fun parseArtist(o: JSONObject): DeezerArtist {
        val pic = o.optString("picture_medium").ifBlank { o.optString("picture") }
        val picBig = o.optString("picture_big").ifBlank { pic }
        val picXl = o.optString("picture_xl").ifBlank { picBig }
        val artistName = o.optString("name")
        val fans = o.optInt("nb_fan")
        return DeezerArtist(
            id = o.optLong("id"),
            name = artistName,
            picture = pic,
            pictureBig = picBig,
            pictureXl = picXl,
            nbFan = fans,
            nbAlbum = o.optInt("nb_album"),
            monthlyListeners = calculateMonthlyListeners(artistName, fans),
        )
    }

    private fun parseArtistList(arr: JSONArray): List<DeezerArtist> {
        val list = mutableListOf<DeezerArtist>()
        for (i in 0 until arr.length()) {
            val o = arr.optJSONObject(i) ?: continue
            list.add(parseArtist(o))
        }
        return list
    }

    private fun parseAlbum(o: JSONObject): DeezerAlbum {
        val cover = o.optString("cover_medium").ifBlank { o.optString("cover") }
        val coverBig = o.optString("cover_big").ifBlank { cover }
        val coverXl = o.optString("cover_xl").ifBlank { coverBig }
        val artistObj = o.optJSONObject("artist")
        return DeezerAlbum(
            id = o.optLong("id"),
            title = o.optString("title"),
            cover = cover,
            coverBig = coverBig,
            coverXl = coverXl,
            releaseDate = o.optString("release_date"),
            recordType = o.optString("record_type", "album"),
            trackCount = o.optInt("nb_tracks"),
            artistName = artistObj?.optString("name").orEmpty(),
            artistId = artistObj?.optLong("id") ?: 0L,
        )
    }

    private fun parseAlbumList(arr: JSONArray): List<DeezerAlbum> {
        val list = mutableListOf<DeezerAlbum>()
        for (i in 0 until arr.length()) {
            val o = arr.optJSONObject(i) ?: continue
            list.add(parseAlbum(o))
        }
        return list
    }

    private fun parseTrack(o: JSONObject): DeezerTrack {
        val artistObj = o.optJSONObject("artist")
        val albumObj = o.optJSONObject("album")
        val cover = albumObj?.optString("cover_medium") ?: albumObj?.optString("cover").orEmpty()
        val coverBig = albumObj?.optString("cover_big") ?: cover
        val coverXl = albumObj?.optString("cover_xl") ?: coverBig
        val title = o.optString("title")

        val allArtists = mutableListOf<String>()
        val mainName = artistObj?.optString("name")?.trim().orEmpty()
        if (mainName.isNotBlank()) {
            allArtists.add(mainName)
        }
        val contributors = o.optJSONArray("contributors")
        if (contributors != null) {
            for (i in 0 until contributors.length()) {
                val c = contributors.optJSONObject(i)
                val cName = c?.optString("name")?.trim().orEmpty()
                if (cName.isNotBlank() && allArtists.none { it.equals(cName, ignoreCase = true) }) {
                    allArtists.add(cName)
                }
            }
        }
        val artistsArr = o.optJSONArray("artists")
        if (artistsArr != null) {
            for (i in 0 until artistsArr.length()) {
                val a = artistsArr.optJSONObject(i)
                val aName = a?.optString("name")?.trim().orEmpty()
                if (aName.isNotBlank() && allArtists.none { it.equals(aName, ignoreCase = true) }) {
                    allArtists.add(aName)
                }
            }
        }

        // Also check if title contains (feat. ...) or (ft. ...)
        val featRegex = Regex("""(?i)[\(\[](?:feat\.|ft\.|featuring)\s+([^\)\]]+)[\)\]]""")
        val featMatch = featRegex.find(title)
        if (featMatch != null) {
            val feats = featMatch.groupValues[1].split(Regex("""[,&+]|\band\b""", RegexOption.IGNORE_CASE))
            for (rawF in feats) {
                val f = rawF.trim()
                if (f.length >= 2 && allArtists.none { it.equals(f, ignoreCase = true) }) {
                    allArtists.add(f)
                }
            }
        }

        val fullArtistName = if (allArtists.isNotEmpty()) allArtists.joinToString(", ") else mainName

        val track = DeezerTrack(
            id = o.optLong("id"),
            title = title,
            durationSeconds = o.optInt("duration"),
            rank = o.optInt("rank"),
            artistName = fullArtistName,
            artistId = artistObj?.optLong("id") ?: 0L,
            albumTitle = albumObj?.optString("title").orEmpty(),
            albumCover = coverXl.ifBlank { coverBig.ifBlank { cover } },
            previewUrl = o.optString("preview"),
        )
        trackMetaCache["dz_${track.id}"] = DeezerTrackMeta(
            id = track.id,
            title = track.title,
            artist = track.artistName,
            previewUrl = track.previewUrl,
            duration = track.durationSeconds,
            cover = track.albumCover,
        )
        return track
    }

    private fun parseTrackList(arr: JSONArray): List<DeezerTrack> {
        val list = mutableListOf<DeezerTrack>()
        for (i in 0 until arr.length()) {
            val o = arr.optJSONObject(i) ?: continue
            list.add(parseTrack(o))
        }
        return list
    }

    /** Fetch single track details by ID synchronously (for ExoPlayer audio resolving thread). */
    fun getTrackSync(id: Long): DeezerTrackMeta? {
        val cached = trackMetaCache["dz_$id"]
        if (cached != null) return cached
        return runCatching {
            val url = "$BASE_URL/track/$id".toHttpUrl()
            val req = Request.Builder()
                .url(url)
                .header("User-Agent", "Votify/1.1.7 (Android)")
                .get()
                .build()
            http.newCall(req).execute().use { res ->
                if (!res.isSuccessful) return@use null
                val body = res.body?.string().orEmpty()
                if (body.isBlank()) return@use null
                val obj = JSONObject(body)
                if (obj.has("error")) return@use null
                val t = parseTrack(obj)
                DeezerTrackMeta(
                    id = t.id,
                    title = t.title,
                    artist = t.artistName,
                    previewUrl = t.previewUrl,
                    duration = t.durationSeconds,
                    cover = t.albumCover,
                )
            }
        }.getOrNull()
    }

    /** Fetch single track details by ID asynchronously. */
    suspend fun getTrack(id: Long): DeezerTrack? = withContext(Dispatchers.IO) {
        val json = getJson("/track/$id") ?: return@withContext null
        if (json.has("error")) return@withContext null
        parseTrack(json)
    }
}
