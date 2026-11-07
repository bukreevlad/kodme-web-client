// Импортируем utils
import { toastError } from "../../../utils/ui/toast_error.js";

// Импортируем functions
import { syncListPak } from "../functions/sync_list_pak.js";

// Импортируем requests
import { subscribeRequest } from "../../sticker-paks/requests/subscribe.js";

// Импортируем типы
import type { StickerPak } from "../index.js";

/**
 * ***************************************************************************
 * subscribeHandler - добавить пак стикеров к себе (подписка).
 *
 * После успеха кнопка переходит в состояние «Добавлен», флаг is_member
 * обновляется в данных формы и в плашке пака в списке (если он открыт).
 * @param form - Экземпляр формы.
 * @returns Promise без значения.
 * ***************************************************************************
 */
export async function subscribeHandler(form: StickerPak): Promise<void> {

    try {

        // Запрос подписки (ошибки сервера сокет пробрасывает reject'ом)
        await subscribeRequest({ pak_id: form.pakId });

        // Обновляем флаг в данных пака
        if (form.pak) form.pak = { ...form.pak, is_member: true };

        // Кнопка переходит в состояние «Добавлен»
        const button = form.tpl?.querySelector<HTMLButtonElement>(":scope >.header [action-subscribe]");
        if (button) {
            button.textContent = window._lc.forms.sticker_pak.subscribe.added;
            button.disabled = true;
        }

        // Синхронизируем плашку пака в списке (событие item::updated)
        syncListPak(form, (item) => ({ ...item, is_member: true }));

    } catch (error) {

        // Показываем тост (коды ошибок разбирает сам toastError)
        toastError(error, {
            context: "[app][sticker-pak][subscribe]",
            fallback: window._lc.forms.sticker_pak.toasts.subscribe_error
        });

    }

}
