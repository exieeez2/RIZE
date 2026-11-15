package app.votify.mobile.data

import android.content.Context
import android.content.SharedPreferences
import app.votify.mobile.data.local.FavoriteEntity
import app.votify.mobile.data.local.HistoryEntity
import app.votify.mobile.data.local.PlaylistEntity
import app.votify.mobile.data.local.PlaylistSummary
import app.votify.mobile.data.local.PlaylistTrackEntity
import app.votify.mobile.data.local.TrackEntity
import app.votify.mobile.data.local.VotifyDatabase
import androidx.room.withTransaction
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import org.json.JSONArray
import org.json.JSONObject

data class FollowedArtist(val name: String, val photoUrl: String = "")

/** Favorites, listening history and user playlists — all local (Room). */
class LibraryRepository(private val db: VotifyDatabase, private val context: Context? = null) {

    // ---- Followed Artists ----
    private val prefs: SharedPreferences? by lazy {
        context?.getSharedPreferences("votify_library_prefs", Context.MODE_PRIVATE)
    }

    private val _followedArtists = MutableStateFlow<List<FollowedArtist>>(loadFollowedArtists())
    val followedArtists: StateFlow<List<FollowedArtist>> = _followedArtists.asStateFlow()

    private fun loadFollowedArtists(): List<FollowedArtist> {
        val jsonStr = prefs?.getString("followed_artists", null) ?: return emptyList()
        return try {
            val arr = JSONArray(jsonStr)
            val list = mutableListOf<FollowedArtist>()
            for (i in 0 until arr.length()) {
                val obj = arr.getJSONObject(i)
                val name = obj.optString("name").trim()
                if (name.isNotBlank()) {
                    list.add(FollowedArtist(name, obj.optString("photoUrl")))
                }
            }
            list
        } catch (_: Exception) {
            emptyList()
        }
    }

    private fun saveFollowedArtists(list: List<FollowedArtist>) {
        val arr = JSONArray()
        list.forEach { a ->
            val obj = JSONObject()
            obj.put("name", a.name)
            obj.put("photoUrl", a.photoUrl)
            arr.put(obj)
        }
        prefs?.edit()?.putString("followed_artists", arr.toString())?.apply()
    }

    fun isArtistFollowed(name: String): Boolean {
        val target = name.trim().lowercase()
        return _followedArtists.value.any { it.name.trim().lowercase() == target }
    }

    fun toggleFollowArtist(name: String, photoUrl: String? = null): Boolean {
        val target = name.trim()
        if (target.isBlank()) return false
        val current = _followedArtists.value.toMutableList()
        val index = current.indexOfFirst { it.name.trim().equals(target, ignoreCase = true) }
        val nowFollowed: Boolean
        if (index >= 0) {
            current.removeAt(index)
            nowFollowed = false
        } else {
            current.add(0, FollowedArtist(target, photoUrl.orEmpty()))
            nowFollowed = true
        }
        _followedArtists.value = current
        saveFollowedArtists(current)
        return nowFollowed
    }

    fun updateArtistPhoto(name: String, photoUrl: String) {
        if (photoUrl.isBlank()) return
        val current = _followedArtists.value.toMutableList()
        val index = current.indexOfFirst { it.name.trim().equals(name.trim(), ignoreCase = true) }
        if (index >= 0) {
            val old = current[index]
            if (old.photoUrl != photoUrl) {
                current[index] = old.copy(photoUrl = photoUrl)
                _followedArtists.value = current
                saveFollowedArtists(current)
            }
        }
    }

    // ---- Favorites ----

    val favorites: Flow<List<Track>> = db.favorites().observeAll().map { it.map(TrackEntity::toTrack) }
    val favoriteIds: Flow<Set<String>> = db.favorites().observeIds().map { it.toSet() }
    val favoriteCount: Flow<Int> = db.favorites().observeCount()

    fun tracksByIds(ids: List<String>): Flow<List<Track>> =
        db.tracks().observeByIds(ids).map { it.map(TrackEntity::toTrack) }

    /** @return true if the track is a favorite after the toggle. */
    suspend fun toggleFavorite(track: Track): Boolean = db.withTransaction {
        val dao = db.favorites()
        if (dao.isFavorite(track.id)) {
            dao.delete(track.id)
            false
        } else {
            db.tracks().upsert(TrackEntity.from(track))
            dao.insert(FavoriteEntity(track.id, now()))
            true
        }
    }

    // ---- History ----

    fun recent(limit: Int = 50): Flow<List<Track>> =
        db.history().observeRecent(limit).map { it.map(TrackEntity::toTrack) }

    val historyCount: Flow<Int> = db.history().observeDistinctCount()

    suspend fun recordPlay(track: Track) = db.withTransaction {
        db.tracks().upsert(TrackEntity.from(track))
        db.history().insert(HistoryEntity(trackId = track.id, playedAt = now()))
        db.history().trim(keep = 2000)
    }

    suspend fun topArtists(limit: Int = 6): List<String> = db.history().topArtists(limit)

    /** Artists across ALL playlists, weighted by track count — wave seeds for collectors. */
    suspend fun playlistArtists(limit: Int = 8): List<String> {
        val counts = LinkedHashMap<String, Int>()
        db.playlists().getAll().forEach { pl ->
            db.playlists().tracksOf(pl.id).forEach { t ->
                val artist = t.artist.trim()
                if (artist.isNotBlank() && !artist.equals("Unknown", true)) {
                    counts[artist] = (counts[artist] ?: 0) + 1
                }
            }
        }
        return counts.entries.sortedByDescending { it.value }.map { it.key }.take(limit)
    }

    suspend fun clearHistory() = db.history().clear()

    /** «Очистить всё»: favorites, history, playlists and the cached track rows. */
    suspend fun clearAllData() = db.withTransaction {
        db.favorites().clear()
        db.history().clear()
        db.playlists().clearAllTracks()
        db.playlists().clearAll()
        db.playlists().clearAllTracksData()
    }

    // ---- Playlists ----

    val playlists: Flow<List<PlaylistSummary>> = db.playlists().observeSummaries()

    fun playlist(id: Long): Flow<PlaylistEntity?> = db.playlists().observe(id)

    fun playlistTracks(id: Long): Flow<List<Track>> =
        db.playlists().observeTracks(id).map { it.map(TrackEntity::toTrack) }

    suspend fun createPlaylist(name: String): Long {
        val t = now()
        return db.playlists().insert(PlaylistEntity(name = name.trim().ifEmpty { "Новый плейлист" }, createdAt = t, updatedAt = t))
    }

    suspend fun renamePlaylist(id: Long, name: String) = db.playlists().rename(id, name.trim(), now())

    suspend fun updatePlaylistCover(id: Long, cover: String?) = db.playlists().updateCover(id, cover, now())

    suspend fun deletePlaylist(id: Long) = db.playlists().delete(id)

    /** @return false if the track was already in the playlist. */
    suspend fun addToPlaylist(playlistId: Long, track: Track): Boolean = db.withTransaction {
        db.tracks().upsert(TrackEntity.from(track))
        val dao = db.playlists()
        val t = now()
        val pos = dao.nextPosition(playlistId)
        val inserted = dao.insertTrack(PlaylistTrackEntity(playlistId, track.id, pos, t)) != -1L
        if (inserted) dao.touch(playlistId, t)
        inserted
    }

    suspend fun removeFromPlaylist(playlistId: Long, trackId: String) {
        db.playlists().removeTrack(playlistId, trackId)
        db.playlists().touch(playlistId, now())
    }

    suspend fun playlistIdsContaining(trackId: String): Set<Long> =
        db.playlists().playlistIdsContaining(trackId).toSet()

    /**
     * Seeds or restores master playlists bundled in assets (e.g. `exieeez` with 117 tracks).
     * If local playlist has fewer tracks (e.g. truncated Spotify import or reinstalled app),
     * merges existing user-added tracks with the complete bundled tracklist without losing any data.
     */
    suspend fun restoreOrSeedBundledPlaylists(context: Context) = withContext(Dispatchers.IO) {
        try {
            val jsonStr = context.assets.open("shared_storage.json").bufferedReader().use { it.readText() }
            val root = JSONObject(jsonStr)
            val playlistsArr = root.optJSONArray("playlists") ?: return@withContext
            val now = System.currentTimeMillis()

            for (pIdx in 0 until playlistsArr.length()) {
                val plObj = playlistsArr.getJSONObject(pIdx)
                val plName = plObj.optString("name").trim()
                if (plName.isBlank()) continue
                val plCover = plObj.optString("cover").takeIf { it.isNotBlank() }
                val tracksArr = plObj.optJSONArray("tracks") ?: continue
                if (tracksArr.length() == 0) continue

                val bundledTracks = mutableListOf<TrackEntity>()
                for (tIdx in 0 until tracksArr.length()) {
                    val trkObj = tracksArr.getJSONObject(tIdx)
                    val id = trkObj.optString("id").trim()
                    val title = trkObj.optString("title").trim()
                    val artist = trkObj.optString("artist").trim().ifBlank { "Unknown" }
                    val cover = trkObj.optString("cover").ifBlank { trkObj.optString("thumbnail") }
                    val duration = trkObj.optInt("duration", 0)
                    if (id.isNotBlank() && title.isNotBlank()) {
                        bundledTracks.add(TrackEntity(id = id, title = title, artist = artist, cover = cover, duration = duration))
                    }
                }
                if (bundledTracks.isEmpty()) continue

                val existing = db.playlists().byName(plName)
                if (existing == null) {
                    val pid = db.playlists().insert(PlaylistEntity(0, plName, now, now, customCover = plCover))
                    db.tracks().upsertAll(bundledTracks)
                    bundledTracks.forEachIndexed { i, t ->
                        db.playlists().insertTrack(PlaylistTrackEntity(pid, t.id, i, now))
                    }
                } else {
                    val existingTracks = db.playlists().tracksOf(existing.id)
                    if (existingTracks.size < bundledTracks.size) {
                        val bundledIds = bundledTracks.map { it.id }.toSet()
                        val bundledKeys = bundledTracks.map { "${it.title}_${it.artist}".lowercase() }.toSet()
                        val userAddedTracks = existingTracks.filter {
                            it.id !in bundledIds && "${it.title}_${it.artist}".lowercase() !in bundledKeys
                        }
                        val merged = (userAddedTracks + bundledTracks).distinctBy {
                            it.id.ifBlank { "${it.title}_${it.artist}".lowercase() }
                        }
                        db.tracks().upsertAll(merged)
                        db.playlists().clearTracks(existing.id)
                        merged.forEachIndexed { i, t ->
                            db.playlists().insertTrack(PlaylistTrackEntity(existing.id, t.id, i, now))
                        }
                        if (existing.customCover.isNullOrBlank() && plCover != null) {
                            db.playlists().updateCover(existing.id, plCover, now)
                        }
                        db.playlists().touch(existing.id, now)
                    }
                }
            }
        } catch (_: Exception) {}
    }

    private fun now() = System.currentTimeMillis()
}
