// Импортируем сторонние пакеты
import type { LocalParticipant, RemoteParticipant } from "livekit-client";

// Импортируем functions
import { updateFooter } from "./update_footer.js";
import { updateParticipantsCount } from "./update_participants_count.js";
import { applyViewMode } from "./apply_view_mode.js";

// Импортируем типы
import type { Call } from "../index.js";

/**
 * ***************************************************************************
 * Синхронизирует отображение участника с его актуальным
 * состоянием в комнате.
 *
 * Практически все события LiveKit про треки приводят к одному и тому же
 * последствию: плитку участника в хранилище нужно обновить. Футер при этом
 * обновляется только для локального участника — чужие треки на наши кнопки
 * не влияют.
 * @param form - Экземпляр формы.
 * @param participant - Участник LiveKit (если вышел между событием и обработкой — пропускается).
 * @returns {void}
 * ***************************************************************************
 */
export function updateParticipant(form: Call, participant?: LocalParticipant | RemoteParticipant | null): void {

    // Участник мог выйти между событием и обработкой — пропускаем
    if (!participant) return;

    // ---------- TILE ----------
    if (form.store.get(participant.identity)) {
        form.store.update(participant.identity, { participant: participant });
    }
    // ---------- TILE ----------

    // ---------- FOOTER ----------
    if (participant.isLocal) updateFooter(form);
    // ---------- FOOTER ----------

    // ---------- VIEW MODE ----------
    // Участник мог впервые включить камеру или выйти — на раскладку это
    // не влияет, но счётчик в шапке держим в актуальном состоянии
    updateParticipantsCount(form);
    // ---------- VIEW MODE ----------

    // ---------- STAGE ----------
    // Если участник на сцене перестал быть виден — раскладка
    // вернётся к автоматике (см. functions/apply_view_mode.ts)
    if (form.stageIdentity && !form.store.get(form.stageIdentity)) {
        form.stageIdentity = null;
        applyViewMode(form);
    }
    // ---------- STAGE ----------

}
