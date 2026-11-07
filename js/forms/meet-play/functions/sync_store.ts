// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем functions
import { updateParticipantsCount } from "./update_participants_count.js";
import { applyLayout } from "./apply_layout.js";

// Импортируем типы
import type { MeetPlay } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Синхронизирует список участников комнаты с хранилищем формы.
 *
 * Все участники комнаты попадают в список, без нарезки по страницам.
 * Раньше здесь была пагинация по 32 человека, но в конференции она
 * работала против пользователя: участник со второй страницы был не виден
 * вообще, и найти его можно было только кнопкой «вперёд». Теперь сетка
 * просто растёт вниз и скроллится.
 *
 * Тяжёлый случай (десятки плиток) не требует отдельной защиты: у комнаты
 * включён adaptiveStream, поэтому LiveKit подписывает видеотреки только
 * для видимых плиток, а остальные отдаёт по запросу скролла.
 * @param form - Экземпляр формы.
 * @returns Промис синхронизации.
 * ***************************************************************************
 */
export async function syncStore(form: MeetPlay): Promise<void> {

    try {

        // Комнаты ещё нет — участников синхронизировать не с кем
        const room = form.room;
        if (!room) return;

        // ---------- PARTICIPANTS ----------
        // Собираем всех: сначала (local), потом (remote)
        const all = [
            room.localParticipant,
            ...Array.from(room.remoteParticipants.values())
        ];
        // ---------- PARTICIPANTS ----------

        // ---------- СЧЁТЧИК ----------
        // Считаем от всей комнаты, а не от нарезанной страницы:
        // в шапке должно стоять настоящее число
        updateParticipantsCount(form);
        // ---------- СЧЁТЧИК ----------

        // ---------- STORE ----------
        // Синхронизируем Store. Сравнение идёт по identity, а не по
        // наличию в Map: участник может остаться в комнате, но сменить
        // объект RemoteParticipant после переподключения
        const currentIdentitiesInStore = Array.from(form.store.items.keys());
        const newIdentities = all.map(p => p?.identity);

        // Удаляем из стора тех, кого нет в комнате
        currentIdentitiesInStore.forEach(id => {
            if (!newIdentities.includes(String(id))) {
                form.store.remove(id);
            }
        });

        // Добавляем или обновляем каждого участника комнаты
        all.forEach(participant => {

            // Участник из комнаты всегда есть — identity берём с guard
            const identity = participant?.identity ?? "";

            // Если участник есть в сторе — просто обновляем его
            if (form.store.get(identity)) {
                form.store.update(identity, {
                    id: identity,
                    participant: participant
                });
            } else {
                form.store.add({
                    id: identity,
                    participant: participant
                });
            }

        });
        // ---------- STORE ----------

        // ---------- LAYOUT ----------
        // Плитки могли добавиться или исчезнуть, поэтому режим сетки
        // пересобирается на каждой синхронизации: в режимах с крупной
        // плиткой ушедший участник иначе остался бы висеть «фокусом»
        applyLayout(form);
        // ---------- LAYOUT ----------

    } catch (error) {
        Logger.error("🚨 [app][LiveKit]: Ошибка syncStore:", error);

        // Toast
        Toast.error(t("forms.meet_play.toasts.sync_error"));

    }

}
