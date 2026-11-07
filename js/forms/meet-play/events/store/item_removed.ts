// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем типы
import { isMeetParticipantItem } from "../../types.js";
import type { MeetPlay } from "../../index.js";

/**
 * ***************************************************************************
 * subscribeItemRemoved - Удаление карточки участника из DOM и снятие её
 *                        подписки.
 *
 * Тело обработчика обязано выполняться ВНУТРИ подписки на `item::removed` и
 * работать с `data` из события — это данные конкретного участника. Если
 * выполнить его один раз сразу, с данными самой формы, то событие удаления
 * останется без слушателя: у вышедшего участника плитка осталась бы висеть
 * в сетке, а при его возвращении `store.get(identity)` вернул бы undefined,
 * `store.add()` создал бы вторую карточку — и в сетке оказалось бы две
 * плитки одного и того же человека.
 *
 * Store сам чистит слушатели `item::updated::<id>`, но карточка держит свою
 * функцию отписки (`data.__unsubscribeStore__`). Без её вызова подписки
 * переживали удаление участника и копились до пересоздания Store.
 * @param form - Экземпляр формы.
 * @returns {void}
 * ***************************************************************************
 */
export function subscribeItemRemoved(form: MeetPlay): void {

    try {

        // Подписываемся на событие удаления участника из комнаты
        form.store.on('item::removed', (data) => {

            // Guard: payload события — элемент списка участников
            if (!isMeetParticipantItem(data)) return;

            // ---------- UNSUBSCRIBE ----------
            // Снимаем точечную подписку карточки на обновления
            if (typeof data.__unsubscribeStore__ === "function") {
                data.__unsubscribeStore__();
                data.__unsubscribeStore__ = null;
            }
            // ---------- UNSUBSCRIBE ----------

            // ---------- DOM ----------
            // Убираем все DOM-элементы карточки (их может быть несколько копий)
            if (Array.isArray(data.__domElements__)) {

                data.__domElements__.forEach(element => {
                    if (element && typeof element.remove === "function") element.remove();
                });

                Logger.debug(`Удалено копий элемента: ${data.__domElements__.length}`);

                // Очищаем массив, чтобы не копить утечки памяти
                data.__domElements__ = [];

            }
            // ---------- DOM ----------

        });

    } catch (error) {
        Logger.error(error)
    }

}
