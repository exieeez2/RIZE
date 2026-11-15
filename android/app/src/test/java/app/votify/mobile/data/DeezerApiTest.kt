package app.votify.mobile.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.text.NumberFormat
import java.util.Locale

class DeezerApiTest {

    @Test
    fun testDeezerTrackToVotifyTrackConversion() {
        val deezerTrack = DeezerTrack(
            id = 3945173111L,
            title = "ЛАБУДА",
            durationSeconds = 796,
            rank = 372454,
            artistName = "NORD DIVISION",
            artistId = 245537042L,
            albumTitle = "ЛАБУДА",
            albumCover = "https://cdn-images.dzcdn.net/images/cover/e453d492938d3059e780ab36c88fff49/1000x1000.jpg",
            previewUrl = "https://cdnt-preview.dzcdn.net/api/1/1/0/9/9/0/preview.mp3",
        )

        val track = deezerTrack.toVotifyTrack()

        assertEquals("dz_3945173111", track.id)
        assertEquals("ЛАБУДА", track.title)
        assertEquals("NORD DIVISION", track.artist)
        assertEquals(796, track.duration)
        assertEquals("https://cdn-images.dzcdn.net/images/cover/e453d492938d3059e780ab36c88fff49/1000x1000.jpg", track.cover)
        assertEquals(372454, track.rank)
    }

    @Test
    fun testTrackMetaCacheStoresAndRetrieves() {
        val meta = DeezerTrackMeta(
            id = 3945173111L,
            title = "ЛАБУДА",
            artist = "NORD DIVISION",
            previewUrl = "https://cdnt-preview.dzcdn.net/preview.mp3",
            duration = 796,
            cover = "https://cdn-images.dzcdn.net/cover.jpg",
        )

        DeezerApi.trackMetaCache["dz_3945173111"] = meta

        val retrieved = DeezerApi.getTrackSync(3945173111L)
        assertNotNull(retrieved)
        assertEquals("ЛАБУДА", retrieved?.title)
        assertEquals("NORD DIVISION", retrieved?.artist)
        assertEquals("https://cdnt-preview.dzcdn.net/preview.mp3", retrieved?.previewUrl)
    }

    @Test
    fun testArtistMonthlyListenersFormatting() {
        val artist = DeezerArtist(
            id = 245537042L,
            name = "NORD DIVISION",
            nbFan = 1640,
            nbAlbum = 36,
        )

        val formattedListeners = NumberFormat.getInstance(Locale.forLanguageTag("ru")).format(artist.monthlyListeners)
        val fullString = "$formattedListeners слушателей в месяц"

        assertTrue(artist.monthlyListeners >= 50_000L)
        assertTrue(fullString.contains("слушателей в месяц"))
    }

    @Test
    fun testCalculateMonthlyListenersRealisticScaling() {
        // Megastars (15M+ fans on Deezer) should scale to ~80M - 115M monthly listeners
        val drakeListeners = DeezerApi.calculateMonthlyListeners("Drake", 24_124_989)
        assertTrue("Drake listeners should be ~90M+, got $drakeListeners", drakeListeners in 80_000_000L..115_000_000L)

        val eminemListeners = DeezerApi.calculateMonthlyListeners("Eminem", 19_168_278)
        assertTrue("Eminem listeners should be ~80M+, got $eminemListeners", eminemListeners in 80_000_000L..100_000_000L)

        // Superstars (8M - 15M fans)
        val weekndListeners = DeezerApi.calculateMonthlyListeners("The Weeknd", 14_778_645)
        assertTrue("The Weeknd listeners should be ~80M+, got $weekndListeners", weekndListeners in 80_000_000L..115_000_000L)

        // Cyrillic artists with low Deezer counts should scale realistically to millions
        val miyagiListeners = DeezerApi.calculateMonthlyListeners("Miyagi & Эндшпиль", 29_274)
        assertTrue("Miyagi listeners should scale to millions, got $miyagiListeners", miyagiListeners in 2_500_000L..6_000_000L)

        val kizaruListeners = DeezerApi.calculateMonthlyListeners("Кизару", 123_552)
        assertTrue("Kizaru listeners should scale to millions, got $kizaruListeners", kizaruListeners in 3_000_000L..8_500_000L)

        // Emerging artists should have realistic listener counts, not tiny fake single digits
        val indieListeners = DeezerApi.calculateMonthlyListeners("Local Band", 350)
        assertTrue("Indie band listeners should be positive and realistic, got $indieListeners", indieListeners >= 1_000L)
    }
}
