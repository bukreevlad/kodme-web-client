// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем functions
import { syncStore } from "./sync_store.js";
import { applyRoomState } from "./apply_room_state.js";
import { setConnecting } from "./set_connecting.js";
import { getSessionIceServers } from "./session_identity.js";

// Импортируем типы
import type { MeetPlay } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Подключение к комнате LiveKit.
 * @param form - Экземпляр формы.
 * @returns Промис подключения.
 * ***************************************************************************
 */
export async function connect(form: MeetPlay): Promise<void> {

    try {

        // Устанавливаем параметры
        const serverUrl = `wss://${window.location.hostname}/api/v1/meet`;
        Logger.debug(`🌐 [app][LiveKit]: Подключение к ${serverUrl}...`);

        // Подключение. ICE-серверы берём из сессии через guard: поле
        // `server` отсутствует в типе сессии, а его отсутствие не должно
        // ронять подключение (LiveKit уйдёт с дефолтными серверами)
        const iceServers = getSessionIceServers();

        // Токен проверяет вызывающий (см. index.ts): без него комната
        // недоступна, подключаться нечего
        const token = form.token;
        if (!token) return;

        await form.room?.connect(serverUrl, token, {
            ...(iceServers ? { rtcConfig: { iceServers } } : {})
        });
        Logger.debug("✅ [app][LiveKit]: Успешно подключено к комнате:", form.room?.name);

        // Применяем состояние комнаты до синхронизации участников:
        // к этому моменту организатор мог уже заблокировать кого-то,
        // и плитки сразу должны отрисоваться с нужными бейджами.
        // Также подхватывается принудительный режим сетки, если он задан.
        await applyRoomState(form, form.room?.metadata);

        // Пытаемся сразу запустить аудио.
        // На части браузеров это не сработает без жеста пользователя —
        // тогда аудио разблокирует обработчик unlock_audio.ts по первому клику.
        try {
            await form.room?.startAudio();
        } catch (audioError) {
            Logger.warn("🔊 [app][LiveKit]: Аудио не запустилось автоматически:", audioError);
        }

        // Вызываем syncStore: он сам возьмёт локального участника, всех удалённых,
        // отсортирует их, нарежет текущую страницу и добавит в Store.
        await syncStore(form);

        // Комната поднята: убираем оверлей «подключение…»
        setConnecting(form, false);

    } catch (error) {
        Logger.error("🚨 [app][LiveKit]: Ошибка подключения:", error);

        // Оверлей оставляем на месте: он и объясняет пользователю, что
        // происходит, и даёт кнопку «Отменить» вместо мёртвого экрана
        setConnecting(form, true);

        // Toast
        Toast.error(t("forms.meet_play.toasts.connect_error"), {
            duration: 4000
        });

    }

}
