package app.votify.mobile.data

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.content.res.Configuration
import android.os.Build
import android.os.LocaleList
import java.util.Locale

tailrec fun Context.findActivity(): Activity? = when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.findActivity()
    else -> null
}

/**
 * In-app language override («Русский» / «English» / «Українська» в Настройках).
 * Kept in a tiny SharedPreferences file because attachBaseContext needs a synchronous
 * read before any UI exists; changing it recreates the activity to re-resolve resources.
 */
object AppLocale {
    const val RU = "ru"
    const val EN = "en"
    const val UK = "uk"
    private const val PREFS = "votify_locale"
    private const val KEY = "language"

    fun language(context: Context): String =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, RU) ?: RU

    fun setLanguage(context: Context, code: String) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        prefs.edit().putString(KEY, code).commit()

        val locale = Locale(code)
        Locale.setDefault(locale)

        applyToContext(context, locale)
        applyToContext(context.applicationContext, locale)

        context.findActivity()?.recreate()
    }

    private fun applyToContext(ctx: Context, locale: Locale) {
        val res = ctx.resources
        val config = Configuration(res.configuration)
        config.setLocale(locale)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            config.setLocales(LocaleList(locale))
        }
        @Suppress("DEPRECATION")
        res.updateConfiguration(config, res.displayMetrics)
    }

    /** Wraps a base context so every resource lookup uses the selected language. */
    fun wrap(context: Context): Context {
        val locale = Locale(language(context))
        Locale.setDefault(locale)
        val config = Configuration(context.resources.configuration)
        config.setLocale(locale)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            config.setLocales(LocaleList(locale))
        }
        return context.createConfigurationContext(config)
    }
}
