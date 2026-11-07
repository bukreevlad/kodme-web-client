/**
 * Статус двухфакторной авторизации TOTP.
 */
export interface TotpStatusData {

    /** Фича TOTP разрешена на сервере. */
    available: boolean;

    /** TOTP подтверждён и защищает вход. */
    enabled: boolean;

    /** Есть незавершённое включение (секрет выдан, но не подтверждён). */
    setup_pending: boolean;

}

// Импортируем типы
import type { StoreItem } from "../../utils/store.js";

/**
 * Элемент списка ключей доступа (Passkey) в хранилище формы.
 */
export interface PasskeyListItem extends StoreItem {

    /** Идентификатор элемента в Store (= credential_id). */
    id: string;

    /** Идентификатор credential'а (base64url). */
    credential_id: string;

    /** Человекочитаемое имя ключа. */
    name: string;

    /** Перевозки аутентификатора или null. */
    transports: string[] | null;

    /** Время регистрации (ISO-8601). */
    created_at: string;

    /** Время последнего использования (ISO-8601) или null. */
    last_used_at: string | null;

    /** DOM-элементы списка (управляет Store при удалении). */
    __domElements__?: HTMLElement[];

}

/**
 * ***************************************************************************
 * Guard: payload события Store — элемент списка ключей доступа.
 * @param data - Проверяемое значение.
 * @returns true, если значение похоже на PasskeyListItem.
 * ***************************************************************************
 */
export function isPasskeyListItem(data: unknown): data is PasskeyListItem {

    // Guard: стор шлёт payload как unknown — сверяемся по полю
    if (typeof data !== "object" || data === null) return false;

    // invariant: объект прошёл проверку выше — читаем поля как PasskeyListItem
    const record = data as PasskeyListItem;
    return typeof record.credential_id === "string";

}
