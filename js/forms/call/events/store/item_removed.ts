// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем functions
import { syncSelfTileVisibility } from "../../functions/self_view.js";

// Импортируем типы
import { isCallParticipantData } from "../../types.js";
import type { Call } from "../../index.js";

/**
 * ***************************************************************************
 * Удаление карточки участника из DOM и освобождение её ресурсов.
 *
 * Тело обработчика обязано выполняться ВНУТРИ подписки на `item::removed` и
 * работать с `data` из события — это данные конкретного участника. Если
 * выполнить его один раз сразу, с `form.data` (данными самой формы), то
 * событие удаления останется без слушателя: у вышедшего участника плитка
 * осталась бы висеть в сетке, а при его возвращении `store.get(identity)`
 * вернул бы undefined и в сетке оказалось бы две плитки одного человека.
 * @param form - Экземпляр формы.
 * @returns {void}
 * ***************************************************************************
 */
export function subscribeItemRemoved(form: Call): void {

    try {

        // Подписываемся на событие удаления участника из комнаты
        form.store.on('item::removed', (data) => {

            // Guard: payload события — элемент списка участников
            if (!isCallParticipantData(data)) return;

            // ---------- UNSUBSCRIBE ----------
            // Снимаем точечную подписку карточки на обновления
            if (typeof data.__unsubscribeStore__ === "function") {
                data.__unsubscribeStore__();
                data.__unsubscribeStore__ = null;
            }
            // ---------- UNSUBSCRIBE ----------

            // ---------- RESOURCES ----------
            // Гасим плееры и аудио: иначе голос вышедшего участника
            // останется звучать в документе
            try {
                data.__component__?.destroy();
            } catch (error) {
                Logger.warn("⚠️ [app][call]: Не удалось освободить ресурсы карточки:", error);
            }
            data.__component__ = null;
            // ---------- RESOURCES ----------

            // ---------- DOM ----------
            // Убираем все DOM-элементы карточки (их может быть несколько копий)
            if (Array.isArray(data.__domElements__)) {

                data.__domElements__.forEach(element => {
                    if (element && typeof element.remove === "function") element.remove();
                });

                // Очищаем массив, чтобы не копить утечки памяти
                data.__domElements__ = [];

            }

            // Своя плашка могла остаться пустой — применяем общее правило
            // видимости (см. functions/self_view.ts)
            syncSelfTileVisibility(form);
            // ---------- DOM ----------

        });

    } catch (error) {
        Logger.error(error);
    }

}
