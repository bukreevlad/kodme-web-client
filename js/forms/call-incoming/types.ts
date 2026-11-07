// Импортируем components (только типы)
import type { AvatarImageDocument } from "../../components/avatars.js";

// Импортируем типы
import type { CallAvatar } from "../call/types.js";

/**
 * Настройки формы входящего звонка.
 */
export interface CallIncomingOptions {

    /** Куда вставить форму. */
    insertInto?: HTMLElement | null;

}

/**
 * Данные формы входящего звонка.
 */
export interface CallIncomingData {

    /** Настройки формы. */
    options?: CallIncomingOptions;

    /** Id звонка. */
    callId: string;

    /** Id звонящего пользователя. */
    userId?: string | undefined;

    /** Имя звонящего. */
    displayName?: string | undefined;

    /**
     * Аватар звонящего. Тип `unknown`: форма открывается и по WS-событию
     * (нагрузка типизирована как unknown), и по deep-link из push — на
     * входе структура сверяется guard'ом.
     */
    avatar?: unknown;

}

/**
 * Значение — документ картинки аватара (запись файла изображения).
 * @param value - Проверяемое значение.
 * @returns true, если значение — запись (документ или похожая структура).
 */
function isAvatarRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

/**
 * Приводит аватар из данных формы к доменному типу CallAvatar.
 * @param value - Значение аватара (unknown из данных события).
 * @returns Аватар: документ картинки, URL-строка либо null.
 */
export function toCallAvatar(value: unknown): CallAvatar {

    // Аватар приходит с сервера документом либо строкой URL
    if (typeof value === "string") return value;

    // invariant: документ аватара — запись { id, token, metadata };
    // лишние ключи Avatars игнорирует
    return isAvatarRecord(value) ? (value as AvatarImageDocument) : null;

}
