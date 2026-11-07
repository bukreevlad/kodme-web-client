// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем components
import { createParticipantItem } from "../../components/participant.js";

// Импортируем типы
import { isMeetParticipantItem } from "../../types.js";
import type { MeetPlay } from "../../index.js";

/**
 * ***************************************************************************
 * subscribeItemAdded - Добавление карточки нового участника в список.
 * @param form - Экземпляр формы.
 * @returns {void}
 * ***************************************************************************
 */
export function subscribeItemAdded(form: MeetPlay): void {

    try {

        // Подписываемся на событие добавления нового элемента
        form.store.on('item::added', (data) => {

            // Guard: payload события — элемент списка участников
            if (!isMeetParticipantItem(data)) return;

            // Создаем DOM-элемент и добавляем в список
            form.list?.appendChild(createParticipantItem(form, data));

        });

    } catch (error) {
        Logger.error(error)
    }

}
