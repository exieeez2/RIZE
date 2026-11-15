#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -f "${ROOT_DIR}/.env" ]]; then
    # shellcheck disable=SC1091
    source "${ROOT_DIR}/.env"
fi
BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
CHAT_ID="${TELEGRAM_CHAT_ID:-}"
APK_PATH="${ROOT_DIR}/rize.apk"

if [[ ! -f "$APK_PATH" ]]; then
    APK_PATH="${ROOT_DIR}/android/app/build/outputs/apk/debug/app-debug.apk"
fi

if [[ -z "$CHAT_ID" ]]; then
    # Try fetching chat ID from latest update
    UPDATES=$(curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getUpdates")
    CHAT_ID=$(echo "$UPDATES" | python3 -c '
import sys, json
try:
    data = json.load(sys.stdin)
    results = data.get("result", [])
    if results:
        # find last message or channel_post
        last = results[-1]
        msg = last.get("message") or last.get("channel_post") or last.get("my_chat_member")
        if msg:
            chat = msg.get("chat", {})
            print(chat.get("id", ""))
except Exception:
    pass
')
fi

if [[ -z "$CHAT_ID" ]]; then
    echo "⚠️ TELEGRAM_CHAT_ID не найден. Напиши любое сообщение боту @rizedevexe_bot (или добавь его в канал)!"
    exit 0
fi

echo "📤 Отправка ${APK_PATH} в Telegram (chat_id: ${CHAT_ID})..."
VERSION_INFO=$(cd "$ROOT_DIR/android" && ./gradlew -q printVersion 2>/dev/null || echo "v2.0.0")
CAPTION="🚀 Свежая сборка RIZE APK
📱 Версия: 2.0.0 (build 2001)
🕒 $(date '+%Y-%m-%d %H:%M:%S')
✨ Полный редизайн: Hero обложка, новый нижний бар, чистая медиатека и поиск."

RESPONSE=$(curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendDocument" \
    -F "chat_id=${CHAT_ID}" \
    -F "caption=${CAPTION}" \
    -F "document=@${APK_PATH}")

if echo "$RESPONSE" | grep -q '"ok":true'; then
    echo "✅ APK успешно отправлен в Telegram!"
else
    echo "❌ Ошибка отправки в Telegram: $RESPONSE"
fi
