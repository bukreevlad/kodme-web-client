// Импортируем config
import { USER_DEVICES_PAGE_SIZE } from "../../../config/constants.js";

// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { toastError } from "../../../utils/ui/toast_error.js";

// Импортируем functions
import { updateEmptyState } from "./update_empty_state.js";

// Импортируем requests
import { getSessionsRequest } from "../requests/get_devices.js";

// Импортируем типы
import type { StoreId } from "../../../utils/store.js";
import type { DeviceDirection, SessionStoreAddOptions } from "../types.js";
import type { UserSettingDevices } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

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
 * Опции загрузки страницы сессий (устройств).
 */
export interface GetDevicesOptions {

    /**
     * Направление ["prev" | "next"]. Отсутствует — первая страница.
     */
    direction?: DeviceDirection;

}

/**
 * ***************************************************************************
 * Загрузка страницы списка сессий (устройств).
 *
 * Список «старые сверху, новые снизу» (по возрастанию id):
 * - первая загрузка (без direction) — от глобального минимума id,
 *   cursor не нужен;
 * - prev — сессии старше minId, вставка в НАЧАЛО списка;
 * - next — сессии новее maxId, вставка в КОНЕЦ списка.
 *
 * Текущая сессия роутится в отдельный блок «Это устройство» — это
 * делает events/store/item_added.ts; пустое состояние «Других активных
 * сессий нет» касается только списка остальных устройств.
 *
 * Мягкая защита от последовательных запросов (без отмены запросов):
 * - флаг isLoading* на каждое направление: пока пачка не вернулась,
 *   повторные вызовы просто выходят (return);
 * - hasMore* === false — в направлении данных больше нет, не стучимся;
 * - ошибка сервера НЕ трогает hasMore*: сбой ≠ конец списка.
 *
 * @param form - Экземпляр формы.
 * @param options - Опции.
 * @param options.direction - Направление ["prev" | "next"]. Отсутствует —
 *   первая страница.
 * @returns Promise без значения.
 * ***************************************************************************
 */
export async function getDevices(form: UserSettingDevices, options: GetDevicesOptions = {}): Promise<void> {

    // Направление: undefined — первая страница
    const direction = options?.direction;

    // Проверка процесса: это направление уже грузится или его данные исчерпаны
    if (direction === "prev" && (form.isLoadingPrev || form.hasMorePrev === false)) return;
    if (direction === "next" && (form.isLoadingNext || form.hasMoreNext === false)) return;
    if (!direction && (form.isLoadingFirst || form.isFirstLoaded)) return;

    // Помечаем начало загрузки (снимается в finally)
    if (direction === "prev") form.isLoadingPrev = true;
    else if (direction === "next") form.isLoadingNext = true;
    else form.isLoadingFirst = true;

    try {

        // Устанавливаем cursorId: prev — крайняя старая сессия, next — крайняя новая
        let cursorId: StoreId | null = null;
        if (direction === "prev") cursorId = form.store.minId;
        if (direction === "next") cursorId = form.store.maxId;

        // Запрос. Ответ status: false отклоняется сокетом и попадает в catch ниже
        // (тост с троттлингом, флаги hasMore* не трогаются)
        let response = await getSessionsRequest({
            cursor_id: cursorId,
            direction: direction,
            offset: USER_DEVICES_PAGE_SIZE
        });

        // Неожиданный ответ — не гасим направление, просто выходим
        if (!Array.isArray(response?.data)) return;

        // ---------- HAS_MORE ----------
        // Сервер считает has_more по запрошенному направлению; для первой
        // страницы (порядок asc от глобального минимума) признак относится
        // к стороне next — «есть ли сессии ниже». Сторону prev сразу
        // закрываем: без курсора страница начинается с самой старой
        // сессии, старше нечего
        if (direction === "prev") {
            form.hasMorePrev = response.has_more === true;
        } else if (direction === "next") {
            form.hasMoreNext = response.has_more === true;
        } else {
            form.hasMoreNext = response.has_more === true;
            form.hasMorePrev = false;
            form.isFirstLoaded = true;
        }
        // ---------- HAS_MORE ----------

        // Якорь скролла ДО пачки: вставка в начало сдвинула бы
        // видимую часть списка вниз (для append восстановление даст ноль)
        form.listScrollManager?.saveAnchor();

        // Опции добавления: направление уходит в стор и дальше — в строку
        // списка (см. SessionStoreAddOptions)
        const addOptions: SessionStoreAddOptions = { direction: direction };

        // Проходим по массиву и добавляем в Store
        response.data.forEach(item => {

            // Записи без id в Store не встанут — пропускаем
            if (!item?.id) return;

            // Проверка в Store
            let isStore = form.store.get(item.id);

            // Существующая запись обновляется, новая — добавляется с направлением
            // (direction: undefined для первой страницы → вставка в конец)
            if (isStore) {
                form.store.update(item.id, item);
            } else {
                form.store.add(item, addOptions);
            }

        });

        // Восстанавливаем якорь после пачки
        form.listScrollManager?.update();
        form.listScrollManager?.restoreAnchor();

        // Показываем/прячем заглушку «Других активных сессий нет»
        updateEmptyState(form);

    } catch (error) {

        // Тост с троттлингом: фоновая догрузка не должна заливать экран
        toastErrorOnce(form, error);

    } finally {

        // Флаги снимаем всегда: иначе после первой ошибки направление
        // не догружалось бы никогда
        if (direction === "prev") form.isLoadingPrev = false;
        else if (direction === "next") form.isLoadingNext = false;
        else form.isLoadingFirst = false;

    }

}

/**
 * ***************************************************************************
 * Приватный: показ ошибки загрузки с троттлингом.
 * @param form - Экземпляр формы (хранит время последнего тоста).
 * @param error - Ошибка из catch.
 * ***************************************************************************
 */
function toastErrorOnce(form: UserSettingDevices, error: unknown): void {

    try {

        // Не чаще ERROR_TOAST_REPEAT_MS на форму
        const now = Date.now();
        const lastToastAt = form.lastErrorToastAt || 0;
        if (now - lastToastAt < ERROR_TOAST_REPEAT_MS) return;
        form.lastErrorToastAt = now;

        // Показываем тост (коды ошибок разбирает сам toastError)
        toastError(error, {
            context: "[app][user-setting-devices][get-devices]",
            fallback: t("forms.user_setting_devices.toasts.load_error")
        });

    } catch (toastError) {
        Logger.error("[app][user-setting-devices][get-devices][toast]:", toastError);
    }

}
