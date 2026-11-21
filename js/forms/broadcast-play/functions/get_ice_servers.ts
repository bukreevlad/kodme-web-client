// Импортируем utils
import { LocalStorage } from "../../../utils/local_storage.js";

/**
 * ***************************************************************************
 * GET_ICE_SERVERS - ICE-серверы из настроек текущей сессии.
 *
 * Поле `server` дописывается в сессию при логине, поэтому честный путь —
 * только через guard: битая или неполная сессия не должна ронять
 * воспроизведение необработанной ошибкой. Без данных возвращается пустой
 * список — для локальной сети STUN не обязателен.
 *
 * @returns {RTCIceServer[]} Список ICE-серверов (возможно, пустой).
 * ***************************************************************************
 */
export function getIceServers(): RTCIceServer[] {

    try {

        const session: unknown = LocalStorage.session;
        if (!session || typeof session !== "object" || !("server" in session)) return [];

        const server: unknown = session.server;
        if (!server || typeof server !== "object" || !("web_rtc" in server)) return [];

        const webRtc: unknown = server.web_rtc;
        if (!webRtc || typeof webRtc !== "object" || !("ice_servers" in webRtc)) return [];

        const iceServers = webRtc.ice_servers;
        if (!Array.isArray(iceServers)) return [];

        // invariant: сервер отдаёт массив RTCIceServer
        return iceServers as RTCIceServer[];

    } catch {
        // Проблемы с сессией не должны блокировать воспроизведение
        return [];

    }

}
