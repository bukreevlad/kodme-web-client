// Импортируем utils
import { LocalStorage } from "../../../utils/local_storage.js";

/**
 * Сужение внешних данных сессии до структуры с полем id: данные
 * localStorage нельзя доверять, поэтому сверяемся через guard, а не
 * через приведение типов.
 * @param value - Проверяемое значение.
 * @returns true, если значение похоже на объект пользователя с id.
 */
function isUserIdentity(value: unknown): value is { id: string } {
    return !!value && typeof value === "object" && "id" in value && typeof value.id === "string";
}

/**
 * ***************************************************************************
 * Id текущего пользователя из сессии.
 *
 * Нужен в нескольких местах формы: геттер `isCreator`, плитка участника
 * и диалог настроек сетки сверяют `meet.created_user_id` с собой.
 * @returns Id пользователя или null (сессия неполная).
 * ***************************************************************************
 */
export function getSessionUserId(): string | null {

    const user: unknown = LocalStorage.session?.user;
    return isUserIdentity(user) ? user.id : null;

}

/**
 * ICE-серверы из настроек сессии (null, если конфиг не найден).
 *
 * Поле `server` нет в типе StoredSession, поэтому читаем через guard,
 * а не через приведение типа.
 * @returns Список ICE-серверов или null.
 * ***************************************************************************
 */
export function getSessionIceServers(): RTCIceServer[] | null {

    const session: unknown = LocalStorage.session;
    if (!session || typeof session !== "object" || !("server" in session)) return null;

    const server: unknown = session.server;
    if (!server || typeof server !== "object" || !("web_rtc" in server)) return null;

    const webRtc: unknown = server.web_rtc;
    if (!webRtc || typeof webRtc !== "object" || !("ice_servers" in webRtc)) return null;

    const iceServers = webRtc.ice_servers;
    return Array.isArray(iceServers) ? iceServers as RTCIceServer[] : null;

}
