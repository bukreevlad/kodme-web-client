// Импортируем типы
import type { AppPermission } from "../../../bot-app-sdk.js";

/** Ключ localStorage с выданными приложениям разрешениями. */
const STORAGE_KEY = "bot_app_permissions";

/**
 * Проверяет, что значение — запись (объект).
 * @param value - Проверяемое значение.
 * @returns true, если значение — запись.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

/**
 * Проверяет, что значение — известный тип доступа к устройству.
 * @param value - Проверяемое значение.
 * @returns true, если значение — тип доступа.
 */
export function isAppPermission(value: unknown): value is AppPermission {
    return value === "camera"
        || value === "microphone"
        || value === "geolocation"
        || value === "clipboard-write";
}

/**
 * ***************************************************************************
 * Получает выданные приложению разрешения на доступ к устройству.
 * @param appId - Id приложения.
 * @returns Список выданных разрешений (пустой, если доступа нет).
 * ***************************************************************************
 */
export function getGrantedPermissions(appId: string): AppPermission[] {

    try {

        // Читаем хранилище: невалидные данные считаем отсутствием разрешений
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const stored: unknown = JSON.parse(raw);
        if (!isRecord(stored)) return [];

        // Список конкретного приложения фильтруем по известным типам доступа
        const list: unknown = stored[appId];
        if (!Array.isArray(list)) return [];
        return list.filter(isAppPermission);

    } catch {
        // Хранилище недоступно или повреждено — разрешений нет
        return [];
    }

}

/**
 * ***************************************************************************
 * Запоминает выданное приложению разрешение (для следующих открытий).
 * @param appId - Id приложения.
 * @param permission - Выданный тип доступа.
 * ***************************************************************************
 */
export function grantPermission(appId: string, permission: AppPermission): void {

    try {

        // Читаем текущее состояние хранилища
        const raw = window.localStorage.getItem(STORAGE_KEY);
        const stored: unknown = raw ? JSON.parse(raw) : {};
        const map: Record<string, unknown> = isRecord(stored) ? stored : {};

        // Добавляем разрешение в список приложения
        const list: unknown = map[appId];
        const current: AppPermission[] = Array.isArray(list) ? list.filter(isAppPermission) : [];
        if (!current.includes(permission)) current.push(permission);
        map[appId] = current;

        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));

    } catch {
        // Хранилище недоступно — разрешение действует только до перезагрузки
        // документа iframe (токен остаётся в его allow)
    }

}
