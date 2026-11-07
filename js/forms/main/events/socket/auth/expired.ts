// Импортируем config
import { Socket } from "../../../../../config/socket.js";

// Импортируем utils
import { Logger } from "../../../../../utils/logs/logger.js";
import { TokenManager } from "../../../../../utils/network/token_manager.js";
import { getErrorMessage } from "../../../../../utils/helpers/error_util.js";

/** Сколько раз подряд пробуем обновить токен (HTTP тоже мог упасть вместе с WS). */
const REFRESH_ATTEMPTS = 3;

/** Задержка между попытками обновления токена (мс). */
const REFRESH_RETRY_DELAY = 3000;

/**
 * Коды ошибок, при которых повторное обновление токена бессмысленно
 * (refresh-токен истёк, сессия удалена — нужен повторный вход).
 */
const TERMINAL_ERROR_CODES = ["REFRESH_TOKEN_INVALID", "TOKEN_INVALID", "SESSION_NOT_FOUND"];

/**
 * Задержка перед следующей попыткой.
 * @param delay - Время ожидания (мс).
 * @returns Промис, разрешающийся по истечении задержки.
 */
function wait(delay: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * ***************************************************************************
 * Подписка на внутреннее событие "auth-expired" сокета.
 *
 * Сокет эмитит его при закрытии соединения кодом 1008: handshake не прошёл
 * и переподключаться со старым токеном бессмысленно. Типичный сценарий —
 * access-токен (TTL 15 минут) истёк за время жизни соединения, а связь
 * оборвалась (перезапуск nginx, сеть): приложение обновляет токен по
 * refresh-токену и переподключается без перезагрузки страницы.
 * ***************************************************************************
 */
export function subscribeAuthExpired(): void {

    // ***************************************************************************
    // Обновление токена после закрытия соединения с кодом 1008
    // ***************************************************************************
    Socket.client.on("auth-expired", () => {

        // Обновление токена асинхронное: ошибки разбирает внутри себя
        void handleAuthExpired();

    });

}

/**
 * ***************************************************************************
 * Обновить access-токен и переподключить сокет.
 *
 * Если обновить токен не удалось (сессия удалена, refresh-токен истёк),
 * страница перезагружается — форма выбора сессий покажет «сессия истекла».
 * ***************************************************************************
 */
async function handleAuthExpired(): Promise<void> {

    // Пробуем обновить токен: в момент обрыва HTTP-запрос тоже может упасть
    // (например, nginx перезапускается) — ретраим, прежде чем сдаться
    const token = await refreshWithRetries();

    // Не удалось — перезагружаем страницу (форма сессий разберётся с логином)
    if (!token) {
        window.location.reload();
        return;
    }

    // Свежий токен — в URL сокета: следующий connect() уйдёт уже с ним
    Socket.client.setAccessToken(token);

    // Переподключаемся: авто-реконнект на 1008 останавливался — запускаем сами.
    // Отказ connect() (сервер ещё не поднялся) обрабатывает сам сокет:
    // onclose продолжит цикл реконнекта, вмешиваться здесь не нужно.
    if (Socket.client.options.autoReconnect) {
        Socket.client.connect().catch(() => {
            // Ошибка уже обработана в onclose сокета
        });
    }

}

/**
 * ***************************************************************************
 * Обновить access-токен с повторными попытками.
 * @returns {Promise<string|null>} - Новый access-токен либо null, если
 *          обновить не удалось.
 * ***************************************************************************
 */
async function refreshWithRetries(): Promise<string | null> {

    // ***************************************************************************
    // Попытки обновления
    // ***************************************************************************
    for (let attempt = 1; attempt <= REFRESH_ATTEMPTS; attempt++) {

        try {

            return await TokenManager.refreshAccessToken();

        } catch (error) {

            Logger.error(`[app][auth]: Не удалось обновить access-токен (попытка ${attempt}/${REFRESH_ATTEMPTS}):`, error);

            // Токены или сессия невалидны — повторять бессмысленно
            const message = getErrorMessage(error);
            if (TERMINAL_ERROR_CODES.some((code) => message.includes(code))) return null;

            // Пауза перед следующей попыткой (кроме последней)
            if (attempt < REFRESH_ATTEMPTS) await wait(REFRESH_RETRY_DELAY);

        }

    }

    return null;

}
