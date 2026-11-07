// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем components
import { ParticipantItem } from "../../components/participant.js";

// Импортируем functions
import { syncSelfTileVisibility } from "../../functions/self_view.js";

// Импортируем типы
import { isCallParticipantData } from "../../types.js";
import type { Call } from "../../index.js";

/**
 * ***************************************************************************
 * Добавление карточки участника в форму звонка.
 *
 * Ключевое отличие от встреч: локальный участник в сетку не попадает —
 * он рендерится в отдельной движимой плашке «я». Плашка участвует в
 * раскладке наравне с остальными (ей назначается роль .call-stage или
 * .call-corner), но физически лежит вне списка.
 * @param form - Экземпляр формы.
 * @returns {void}
 * ***************************************************************************
 */
export function subscribeItemAdded(form: Call): void {

    try {

        // Подписываемся на событие добавления нового элемента
        form.store.on('item::added', (data) => {

            // Guard: payload события — элемент списка участников
            if (!isCallParticipantData(data)) return;

            // Создаем DOM-элемент
            const item = new ParticipantItem(form, data);

            // Своя плитка — в плашку «я», чужие — в список раскладки
            const localIdentity = form.room?.localParticipant?.identity;
            const identity = data.participant?.identity || data.id;
            const target = identity === localIdentity ? form.selfTile : form.list;

            // Без DOM-элемента вставлять нечего
            const dom = item.getDOM();
            if (target && dom) target.appendChild(dom);

            // Видео появилось — снимаем скрытие плашки (общее правило
            // видимости, см. functions/self_view.ts)
            if (target === form.selfTile) syncSelfTileVisibility(form);

        });

    } catch (error) {
        Logger.error(error);
    }

}
