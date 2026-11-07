// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем events (вложенные)
import { disposeItemSubscriptions } from "./item_added.js";

// Импортируем типы
import type { Comments } from "../../index.js";

/**
 * ***************************************************************************
 * Подписка на событие удаления комментария из UI.
 *
 * Удаляет строку из ленты по data-id; позиции/разделители пересчитываются
 * отдельным проходом.
 * @param form - Экземпляр формы.
 * @returns Функция отписки от события Store либо null.
 * ***************************************************************************
 */
export function subscribeItemRemoved(form: Comments): (() => void) | null {

    // Если форма не открыта
    if (!form) return null;

    try {

        return form.store.on("item::removed", (payload: unknown) => {

            try {

                // Контейнер списка обязателен
                if (!form.list) return;

                // Id удаляемого комментария (payload — запись или id)
                const id = typeof payload === "string" ? payload : (payload as { id?: string })?.id;
                if (!id) return;

                // Удаляем строку из ленты (предварительно снимая персональные
                // подписки строки — item::updated / item::id-changed)
                const element = form.list.querySelector(`[data-id="${id}"]`);
                if (element) {
                    disposeItemSubscriptions(element);
                    element.remove();
                }

            } catch (error) {
                Logger.error("[app][comments][item-removed]::remove", error);
            }

        });

    } catch (error) {
        Logger.error("[app][comments][item-removed]::subscribe", error);
        return null;
    }

}
