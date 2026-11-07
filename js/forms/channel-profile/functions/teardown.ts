// Импортируем config
import { MEDIA_SECTIONS } from "../config/media_sections.js";

// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем events
import { StoreEvents } from "../events/store/index.js";

// Импортируем типы
import type { ChannelProfile } from "../types.js";

/**
 * ***************************************************************************
 * Освобождение ресурсов формы.
 *
 * Вызывается из двух мест, и это важно:
 * - _onBeforeClose() — обычное закрытие;
 * - путь отказа открытия (_onBeforeOpen возвращает false) — иначе форма,
 *   которая не открылась, оставила бы подписки и скроллбары в памяти.
 *
 * Порядок обязателен: сначала отписки (они перестают дёргать форму), потом
 * разрушение скроллбаров, потом очистка хранилищ. Удаление из реестра
 * instances делает сама форма (index.ts): здесь ей нужен только тип.
 *
 * @param form - Экземпляр формы профиля канала.
 * @returns void
 * ***************************************************************************
 */
export function teardown(form: ChannelProfile): void {

    // Нет формы — освобождать нечего
    if (!form) return;

    // Отписка от событий Store. Пока этого не было, Main.store навсегда
    // удерживал форму после закрытия (см. events/store/channel_item_updated.ts)
    StoreEvents.destroy(form);

    // Отписка от слушателей скроллбаров (троттлинг проверки догрузки).
    // Их нельзя оставлять висеть: отложенный вызов троттлинга мог бы
    // сработать уже после закрытия формы и обратиться к удалённому DOM
    for (const unsubscribe of form.handlerUnsubs || []) {
        try {
            unsubscribe();
        } catch (error) {
            Logger.error("[app][channel-profile][teardown]::handlers", error);
        }
    }
    form.handlerUnsubs = [];

    // Разрушаем скроллбары панелей: неразрушенный OverlayScrollbars удерживает
    // отсоединённый DOM через внутренние наблюдатели
    for (const entry of form.osInstances || []) {
        try {
            entry?.instance?.destroy?.();
        } catch (error) {
            Logger.error("[app][channel-profile][teardown]::scrollbar", error);
        }

        // Свойство обнуляем, чтобы после teardown им нельзя было воспользоваться
        if (entry?.property) form[entry.property] = null;
    }
    form.osInstances = [];

    // Чистим хранилища вкладок по конфигу секций: removeAll() эмитит
    // item::removed, а подписки к этому моменту уже отписаны, поэтому
    // элементы с DOM снимает сам браузер вместе с содержимым формы.
    // Список стор берём из конфига, а не перечисляем шестью строками —
    // новая вкладка не должна требовать правки teardown
    for (const section of MEDIA_SECTIONS) {
        try {
            form[section.storeKey]?.removeAll();
        } catch (error) {
            Logger.error(`[app][channel-profile][teardown]::store[${section.id}]`, error);
        }

        // Менеджер якоря удерживает ссылку на разрушенный скроллбар —
        // обнуляем (ключи состояния секций выводятся из section.id)
        form[`${section.id}ScrollManager`] = null;
    }

}
