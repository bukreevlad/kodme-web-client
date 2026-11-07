// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { LocalStorage } from "../../../utils/local_storage.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем functions
import { syncStore } from "./sync_store.js";
import { setState } from "./set_state.js";
import { updateFooter } from "./update_footer.js";

// Импортируем типы
import type { Call } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * ICE-серверы из настроек текущей сессии.
 *
 * Поле `server` дописывается в сессию при логине (см. handlers/check.ts
 * формы sessions), поэтому честный путь — только через guard: битая или
 * неполная сессия не должна ронять форму необработанной ошибкой.
 * @throws Error, если в сессии нет WebRTC-конфига.
 ***************************************************************************
 */
function getSessionIceServers(): RTCIceServer[] {

    const session: unknown = LocalStorage.session;
    if (!session || typeof session !== "object" || !("server" in session)) {
        throw new Error("В сессии нет данных сервера");
    }

    const server: unknown = session.server;
    if (!server || typeof server !== "object" || !("web_rtc" in server)) {
        throw new Error("В сессии нет WebRTC-конфига");
    }

    const webRtc: unknown = server.web_rtc;
    if (!webRtc || typeof webRtc !== "object" || !("ice_servers" in webRtc)) {
        throw new Error("В сессии нет ICE-серверов");
    }

    const iceServers = webRtc.ice_servers;
    if (!Array.isArray(iceServers)) {
        throw new Error("Некорректный формат ICE-серверов");
    }

    // invariant: сервер отдаёт массив RTCIceServer
    return iceServers as RTCIceServer[];

}

/**
 * ***************************************************************************
 * Подключение к комнате звонка.
 *
 * Тот же endpoint `/api/v1/meet`, что у встреч: комната звонка
 * `call::<call_id>` создаётся LiveKit-ом лениво при первом подключении.
 *
 * Микрофон включается сразу (звонок начинается со звука), камера остаётся
 * выключенной — её включает пользователь кнопкой. Если доступа к микрофону
 * нет, звонок всё равно продолжается: слышать собеседника можно.
 * @param form - Экземпляр формы.
 * @returns Промис подключения.
 * ***************************************************************************
 */
export async function connect(form: Call): Promise<void> {

    try {

        // Пока идёт подключение — оверлей «Соединение…». Прозвон важнее:
        // вызывающий уже видит «Звонок…» с живым отсчётом, а подключение
        // к комнате идёт в фоне и не должно сбивать это состояние — иначе
        // пользователь не видит, что дозванивается
        if (form.callState !== "ringing") {
            setState(form, "starting", t("forms.call.status.starting"));
        }

        // Подключение
        const serverUrl = `wss://${window.location.hostname}/api/v1/meet`;
        Logger.debug(`🌐 [app][LiveKit]: Подключение к ${serverUrl}...`);

        // Без токена комната недоступна — подключаться нечего; вызывающий
        // проверяет токен и сам закрывает форму с ошибкой
        if (!form.token) return;

        await form.room.connect(serverUrl, form.token, {
            rtcConfig: { iceServers: getSessionIceServers() }
        });
        Logger.debug("✅ [app][LiveKit]: Успешно подключено к комнате:", form.room.name);

        // ---------- МИКРОФОН ----------
        // Звонок стартует только со звуком. Отказ (нет разрешения,
        // нет устройства) не должен ронять звонок: собеседника всё
        // равно видно и слышно с его стороны
        try {
            await form.room.localParticipant.setMicrophoneEnabled(true, {
                noiseSuppression: true,
                echoCancellation: true,
                autoGainControl: true
            });
        } catch (error) {
            Logger.warn("[app][call]: Не удалось включить микрофон", error);

            // Toast
            Toast.error(t("forms.call.toasts.media_error"), { position: "top-center" });
        }
        // ---------- МИКРОФОН ----------

        // Синхронизируем участников (в том числе локального) и футер
        await syncStore(form);
        updateFooter(form);

    } catch (error) {

        Logger.error("[app][call]: Ошибка подключения к комнате звонка", error);

        // Закрываем форму: без комнаты звонок невозможен
        form.endCall({
            reason: "connect_error",
            toast: t("forms.call.toasts.connection_failed"),
            toastType: "error"
        });

    }

}
