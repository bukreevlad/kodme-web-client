// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";
import { LocalStorage } from "../../../../utils/local_storage.js";

// Импортируем functions
import { updateEmptyState } from "../../functions/update_empty_state.js";

// Импортируем components
import { createSessionItem } from "../../components/session.js";

// Импортируем типы
import { hasDeviceDirection, isSessionListItem } from "../../types.js";
import type { UserSettingDevices } from "../../index.js";

/**
 * ***************************************************************************
 * Подписка на событие добавления сессии в UI.
 *
 * Текущая сессия (id совпадает с сохранённой) роутится в отдельный блок
 * «Это устройство» — независимо от направления пачки. Остальные сессии
 * попадают в общий список «старые сверху, новые снизу»:
 * - direction "prev" — пачка старше minId (сервер отдаёт её по убыванию id),
 *   последовательный prepend складывает её в возрастающем порядке;
 * - direction "next" и первая страница (direction не передан) — в конец.
 *
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function subscribeItemAdded(form: UserSettingDevices): void {

    try {

        // Подписываемся на событие добавления нового элемента.
        // Стор локальный (живёт вместе с формой), утечки подписки нет
        form.store.on("item::added", (data, options) => {

            // Эмитим всегда, но payload может быть не записью
            if (!isSessionListItem(data)) return;

            // Создаем DOM-элемент
            let item = createSessionItem(form, data);

            // Если это текущая сессия — в отдельный блок сверху
            if (data.id === LocalStorage.sessionId) {
                form.currentDevice?.appendChild(item);
            } else {

                // В общий список с учётом направления
                if (hasDeviceDirection(options) && options.direction === "prev") {
                    form.list?.prepend(item);
                } else {
                    form.list?.appendChild(item);
                }

            }

            // Пересчитываем заглушку «Других активных сессий нет»
            updateEmptyState(form);

        });

    } catch (error) {
        Logger.error(error)
    }

}
