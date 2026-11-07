// Импортируем config
import { STICKERS_PAGE_SIZE } from "../../../config/constants.js";

// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { toastError } from "../../../utils/ui/toast_error.js";

// Импортируем functions
import { updateEmptyState } from "./update_empty_state.js";

// Импортируем requests
import { getPaksRequest } from "../requests/get_paks.js";

// Импортируем типы
import type { StickerPaks } from "../index.js";

/**
 * ***************************************************************************
 * Минимальный интервал между одинаковыми тостами ошибки списка (мс).
 *
 * Подгрузка по скроллу идёт без участия пользователя: без подавления
 * недоступный сервер давал бы тост на каждый тик прокрутки — экран
 * забивался бы одинаковыми сообщениями. Подавление по времени сохраняет
 * обратную связь, но не превращает её в спам.
 * ***************************************************************************
 */
const ERROR_TOAST_REPEAT_MS = 10000;

/**
 * ***************************************************************************
 * Загрузка страницы списка паков стикеров.
 *
 * Пагинация простая offset-подгрузка «вниз» (сервер отдаёт паки по дате
 * создания, новые сверху; направления prev у паков нет).
 *
 * Мягкая защита от последовательных запросов (без отмены запросов):
 * - флаг isLoading: пока страница не вернулась, повторный вызов выходит;
 * - hasMore === false — данных больше нет, не стучимся;
 * - ошибка сервера НЕ трогает hasMore: сбой ≠ конец списка.
 *
 * @param form - Экземпляр формы.
 * @returns Promise, разрешающийся после завершения загрузки.
 * ***************************************************************************
 */
export async function getStickerPaks(form: StickerPaks): Promise<void> {

    // Проверка процесса: страница уже грузится или данные исчерпаны
    if (form.isLoading) return;
    if (form.isFirstLoaded && form.hasMore === false) return;

    // Помечаем начало загрузки (снимается в finally)
    form.isLoading = true;

    try {

        // Запрос (ошибки сервера сокет пробрасывает reject'ом — ловим в catch)
        const response = await getPaksRequest({
            offset: form.offset,
            limit: STICKERS_PAGE_SIZE
        });

        // Неожиданный ответ — просто выходим
        if (!Array.isArray(response?.data)) return;

        // Есть ли продолжение после текущей страницы
        form.hasMore = response.has_more === true;
        form.isFirstLoaded = true;

        // Сдвигаем смещение на размер полученной пачки (стор может уменьшаться
        // удалениями — offset считаем по полученным страницам, а не по стору)
        form.offset += response.data.length;

        // Проходим по массиву и добавляем в Store
        response.data.forEach(item => {

            // Записи без id в Store не встанут — пропускаем
            if (!item?.id) return;

            // Проверка в Store
            const isStore = form.store.get(item.id);

            // Существующая запись обновляется, новая — добавляется
            if (isStore) {
                form.store.update(item.id, item);
            } else {
                form.store.add(item);
            }

        });

        // Показываем/прячем пустое состояние списка
        updateEmptyState(form);

    } catch (error) {

        // Тост с троттлингом: фоновая догрузка не должна заливать экран
        _toastError(form, error);

    } finally {

        // Флаг снимаем всегда: иначе после первой ошибки список
        // не догружался бы никогда
        form.isLoading = false;

    }

}

/**
 * ***************************************************************************
 * Приватный: показ ошибки загрузки с троттлингом.
 * @param form - Экземпляр формы (хранит время последнего тоста).
 * @param error - Ошибка из catch (ошибки сервера сокет пробрасывает reject'ом).
 * ***************************************************************************
 */
function _toastError(form: StickerPaks, error: unknown): void {

    try {

        // Не чаще ERROR_TOAST_REPEAT_MS на форму
        const now = Date.now();
        const lastToastAt = form.lastErrorToastAt || 0;
        if (now - lastToastAt < ERROR_TOAST_REPEAT_MS) return;
        form.lastErrorToastAt = now;

        // Показываем тост (коды ошибок разбирает сам toastError)
        toastError(error, {
            context: "[app][sticker-paks][get-paks]",
            fallback: window._lc?.forms?.sticker_paks?.toasts?.load_error
        });

    } catch (toastError) {
        Logger.error("[app][sticker-paks][get-paks][toast]:", toastError);
    }

}
