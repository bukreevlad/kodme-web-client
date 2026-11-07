// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем functions
import { activate } from "./activate.js";
import { applyViewMode } from "./apply_view_mode.js";
import { updateParticipantsCount } from "./update_participants_count.js";

// Импортируем типы
import type { Call } from "../index.js";

/**
 * ***************************************************************************
 * Синхронизирует список участников комнаты с хранилищем формы.
 *
 * В звонке все участники видны разом (их единицы, максимум — десяток),
 * поэтому ни пагинации, ни отдельной защиты от тяжёлых списков нет.
 * @param form - Экземпляр формы.
 * @returns Промис синхронизации.
 * ***************************************************************************
 */
export async function syncStore(form: Call): Promise<void> {

    try {

        // ---------- PARTICIPANTS ----------
        // Собираем всех: сначала (local), потом (remote)
        const all = [
            form.room.localParticipant,
            ...Array.from(form.room.remoteParticipants.values())
        ];
        // ---------- PARTICIPANTS ----------

        // ---------- СЧЁТЧИК ----------
        updateParticipantsCount(form);
        // ---------- СЧЁТЧИК ----------

        // ---------- STORE ----------
        // Сравнение идёт по identity: участник может сменить объект
        // RemoteParticipant после переподключения
        const currentIdentitiesInStore = Array.from(form.store.items.keys());
        const newIdentities = all.map(p => p.identity);

        // Удаляем из стора тех, кого нет в комнате
        currentIdentitiesInStore.forEach(id => {
            // invariant: identity участника — всегда строка; String()
            // сохраняет легаси-семантику includes для нестроковых ключей
            if (!newIdentities.includes(String(id))) form.store.remove(id);
        });

        // Добавляем или обновляем каждого участника комнаты
        all.forEach(participant => {

            if (form.store.get(participant.identity)) {
                form.store.update(participant.identity, {
                    id: participant.identity,
                    participant: participant
                });
            } else {
                form.store.add({
                    id: participant.identity,
                    participant: participant
                });
            }

        });
        // ---------- STORE ----------

        // ---------- VIEW MODE ----------
        // Раскладка пересобирается на каждой синхронизации: ушедший
        // участник не должен остаться крупной плиткой
        applyViewMode(form);
        // ---------- VIEW MODE ----------

        // ---------- ACTIVATE ----------
        // Как только появился хоть один собеседник — звонок состоялся
        if (form.room.remoteParticipants.size > 0) activate(form);
        // ---------- ACTIVATE ----------

    } catch (error) {

        Logger.error("🚨 [app][call]: Ошибка SyncStore:", error);

        // Toast
        Toast.error(window._lc.forms.call.toasts.sync_error);

    }

}
