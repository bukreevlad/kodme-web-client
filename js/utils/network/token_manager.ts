// Импортируем utils
import { LocalStorage } from "../local_storage.js";

// Импортируем network
import { ApiError } from "./api_error.js";
import { ResponseHandler } from "./fetch_handler.js";

// Импортируем типы
import type { Answer } from "../../types/domain.js";

/**
 * Полезная нагрузка успешного ответа /api/v1/auth/refresh.
 */
interface RefreshAnswerData {

    /** Новый access-токен. */
    access_token: string;

}

/**
 * Значение — конверт успешного ответа обновления токена.
 * @param value - Проверяемое значение.
 * @returns true, если значение похоже на ответ обновления токена.
 */
function isRefreshAnswer(value: unknown): value is Answer<RefreshAnswerData> {

    if (typeof value !== "object" || value === null) return false;
    if (!("data" in value) || typeof value.data !== "object" || value.data === null) return false;

    return "access_token" in value.data && typeof value.data.access_token === "string";

}

/**
 * ***************************************************************************
 * TOKEN_MANAGER - обновление access-токена текущей сессии по refresh-токену.
 *
 * Нужен там, где access-токен «протух» на живом соединении: например, сокет
 * реконнектится после обрыва (перезапуск nginx, сеть), а токен в его URL
 * истёк — сервер закрывает handshake кодом 1008. Рефреш выполняется по
 * требованию, без фонового таймера: refresh-токен на сервере не ротируется,
 * поэтому повторные и параллельные вызовы безопасны.
 * ***************************************************************************
 */
export class TokenManager {

    /** Идущий сейчас рефреш (single-flight: параллельные вызовы ждут его). */
    private static _refreshing: Promise<string> | null = null;

    /**
     * ***************************************************************************
     * Обновить access-токен текущей сессии.
     * @returns {Promise<string>} - Новый access-токен.
     * @throws Ошибка запроса: ошибки сервера пробрасываются наружу — вызывающий
     *         разбирает коды и решает, что делать (например, вывести на логин).
     * ***************************************************************************
     */
    static refreshAccessToken(): Promise<string> {

        // Если рефреш уже идёт — возвращаем тот же промис (защита от гонок)
        if (!this._refreshing) {
            this._refreshing = this._refresh().finally(() => {
                this._refreshing = null;
            });
        }

        return this._refreshing;

    }

    /**
     * ***************************************************************************
     * Выполнить запрос рефреша и сохранить новый токен в сессии.
     * @returns {Promise<string>} - Новый access-токен.
     * ***************************************************************************
     */
    private static async _refresh(): Promise<string> {

        // Текущая сессия — единственный источник refresh-токена
        const session = LocalStorage.session ?? LocalStorage.getLastActionSession();
        if (!session || !session.refresh_token) throw new ApiError("Сессия не найдена");

        // Запрос обновления access-токена (refresh-токен уходит в заголовке)
        const request = await fetch(`/api/v1/auth/refresh`, {
            method: "POST",
            cache: "no-cache",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${session.refresh_token}`
            }
        });

        // Получаем ответ: ошибки сервера уходят неуспешным статусом и
        // ResponseHandler бросает их до этой точки
        const response: unknown = await ResponseHandler.handle(request);

        // Рантайм-гард: успешный ответ — конверт { data: { access_token }, ... }
        if (!isRefreshAnswer(response)) throw new ApiError("Неожиданный формат ответа обновления токена");

        // Сохраняем новый токен: читаем свежую копию сессии из хранилища
        // (она могла обновиться, пока шёл запрос)
        const stored = LocalStorage.getSession(session.id);
        if (stored) {
            stored.access_token = response.data.access_token;
            LocalStorage.updateSession(stored);
        }

        return response.data.access_token;

    }

}
