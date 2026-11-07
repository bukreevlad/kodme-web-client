/**
 * ***************************************************************************
 * Attachments - единая точка нормализации вложений сообщения.
 *
 * Зачем:
 * - Сервер (`services/messages/components/get_data.js`) отдаёт `attachments`
 *   как МАССИВ payload-ов (по одному на файл).
 * - Локальные (temp/pending) сообщения хранят вложения как ОБЪЕКТ-МАП по ключу
 *   (`temp_id` на клиенте, `document_id` после загрузки на сервере).
 * - Потребители в UI исторически смешивали `.forEach` / `.find` / `.filter`
 *   (ожидая массив) и `Object.keys` (ожидая объект) — из-за чего pending-вложения
 *   падали с TypeError.
 *
 * Модуль не хранит состояние и не мутирует входные данные: только приводит
 * любую форму к предсказуемой (Array или Map) и считает количество.
 * ***************************************************************************
 */

// Импортируем components (только тип: служебные инстансы прогресса в элементах)
import type { ProgressIndicator } from "../../components/progress.js";

/**
 * Элемент вложения (все поля опциональны; значения по умолчанию — из элемента).
 */
interface AttachmentElement {
    /** server-side document_id (в temp-режиме отсутствует). */
    id?: string | number | null;
    /** Локальный ключ temp-сообщения. */
    temp_id?: string;
    /** Локальный ключ после получения presigned URL. */
    document_id?: string;
    /** Имя файла. */
    name?: string;
    /** Имя файла (алиас). */
    file_name?: string | undefined;
    /** MIME-тип файла. */
    mime_type?: string;
    /** Тип файла (алиас). */
    type?: string;
    /** Размер в байтах. */
    size?: number;
    /** Метадата (размеры, длительность, превью, hls и т.п.). */
    metadata?: Record<string, unknown>;
    /** Служебные DOM-элементы UI-прогресса. */
    __domElements__?: Element[];
    /** Служебные инстансы UI-прогресса. */
    __progressInstances__?: ProgressIndicator[];
    [key: string]: unknown;
}

/** Исходное значение `attachments`: массив, объект-map или пусто. */
export type AttachmentsRaw = AttachmentElement[] | Record<string, AttachmentElement> | null | undefined;

/** Объект-мап вложений для сервера (`[message]: send`). */
type ServerAttachmentMap = Record<string, { file_name: string }>;

/**
 * ***************************************************************************
 * Нормализация произвольного значения `attachments` в МАССИВ элементов.
 * Поддерживает: Array, Object-map (temp/pending), null/undefined.
 * @param {AttachmentsRaw} raw - Исходное значение `attachments`.
 * @returns {AttachmentElement[]} - Всегда массив (пустой, если вложений нет).
 * ***************************************************************************
 */
export function normalize(raw: AttachmentsRaw): AttachmentElement[] {

    // Нет вложений
    if (!raw) return [];

    // Уже массив — возвращаем как есть (не клонируем, чтобы не потерять
    // ссылки на __domElements__ и служебные поля)
    if (Array.isArray(raw)) return raw;

    // Object-map (temp/pending): значения объекта, ключи известны из объекта
    if (typeof raw === "object") return Object.values(raw);

    // Неожиданный тип — безопасный fallback
    return [];
}

/**
 * ***************************************************************************
 * Приведение произвольного значения `attachments` в МАССИВ КЛЮЧЕЙ.
 * Ключ элемента — это идентификатор, по которому элемент лежит в object-map.
 * Для серверного массива ключом служит `id` документа.
 * @param {AttachmentsRaw} raw - Исходное значение `attachments`.
 * @returns {string[]} - Массив ключей (строк).
 * ***************************************************************************
 */
export function toKeys(raw: AttachmentsRaw): string[] {

    // Нет вложений
    if (!raw) return [];

    // Object-map: ключи и есть идентификаторы
    if (!Array.isArray(raw) && typeof raw === "object") return Object.keys(raw);

    // Массив: берём `id` документа (в temp-режиме — `temp_id`)
    return normalize(raw).map(_elementKey).filter(key => key != null);
}

/**
 * ***************************************************************************
 * Приведение произвольного значения `attachments` в Map (id → элемент).
 * Удобно для адресного доступа и безопасной мутации по ключу.
 * @param {AttachmentsRaw} raw - Исходное значение `attachments`.
 * @returns {Map<string, AttachmentElement>} - Map идентификаторов на элементы вложений.
 * ***************************************************************************
 */
export function toMap(raw: AttachmentsRaw): Map<string, AttachmentElement> {

    // Строим Map из нормализованного массива
    const map = new Map<string, AttachmentElement>();

    for (const element of normalize(raw)) {
        const key = _elementKey(element);
        if (key != null) map.set(key, element);
    }

    return map;
}

/**
 * ***************************************************************************
 * Количество вложений (безопасное для обоих форматов).
 * @param {AttachmentsRaw} raw - Исходное значение `attachments`.
 * @returns {number} - Количество элементов (0, если вложений нет).
 * ***************************************************************************
 */
export function count(raw: AttachmentsRaw): number {
    return normalize(raw).length;
}

/**
 * ***************************************************************************
 * Есть ли вложения (безопасная проверка для обоих форматов).
 * @param {AttachmentsRaw} raw - Исходное значение `attachments`.
 * @returns {boolean} - true, если вложений хотя бы одно.
 * ***************************************************************************
 */
export function isNotEmpty(raw: AttachmentsRaw): boolean {
    return count(raw) > 0;
}

/**
 * ***************************************************************************
 * Приведение произвольного значения `attachments` в объект-мап
 * (тот формат, который ожидает `[message]: send` на сервере).
 * Используется перед отправкой сообщения: сервер ждёт объект
 * вида `{ [document_id]: { file_name } }`.
 *
 * Мутирует переданный target (если он передан) или создаёт новый объект.
 * @param {AttachmentsRaw} raw - Исходное значение `attachments`.
 * @param {ServerAttachmentMap} [target] - Объект, в который выполняется запись.
 * @returns {ServerAttachmentMap} - Объект-мап вложений для сервера.
 * ***************************************************************************
 */
export function toServerMap(raw: AttachmentsRaw, target: ServerAttachmentMap = {}): ServerAttachmentMap {

    // Object-map — приводим ключи к document_id (сохраняя значения)
    if (!Array.isArray(raw) && raw && typeof raw === "object") {
        for (const [key, element] of Object.entries(raw)) {
            const documentId = _documentId(element) || key;
            target[documentId] = { file_name: element?.file_name || element?.name || "" };
        }
        return target;
    }

    // Массив — строим map из id документов
    for (const element of normalize(raw)) {
        const documentId = _documentId(element);
        if (documentId) {
            target[documentId] = { file_name: element?.file_name || element?.name || "" };
        }
    }

    return target;
}

/**
 * ***************************************************************************
 * Получить элемент вложения по ключу (безопасно для обоих форматов).
 * @param {AttachmentsRaw} raw - Исходное значение `attachments`.
 * @param {string | number} key - Ключ (temp_id / document_id / id).
 * @returns {AttachmentElement | null} - Элемент вложения или null.
 * ***************************************************************************
 */
export function get(raw: AttachmentsRaw, key: string | number): AttachmentElement | null {

    // Ключ не передан — искать нечего
    if (key == null) return null;

    // Object-map — прямой доступ по ключу
    if (!Array.isArray(raw) && raw && typeof raw === "object") {
        return raw[key] || null;
    }

    // Массив — поиск по id/temp_id/document_id
    return normalize(raw).find(el => _elementKey(el) === String(key)) || null;
}

/**
 * ***************************************************************************
 * Удалить элемент вложения по ключу (мутирует object-map на месте).
 * @param {Record<string, AttachmentElement> | null | undefined} raw - Object-map вложений.
 * @param {string | number} key - Ключ элемента.
 * @returns {boolean} - true, если элемент был найден и удалён.
 * ***************************************************************************
 */
export function removeByKey(raw: Record<string, AttachmentElement> | null | undefined, key: string | number): boolean {
    if (!raw || Array.isArray(raw) || typeof raw !== "object") return false;
    if (!(key in raw)) return false;
    delete raw[key];
    return true;
}

/**
 * ***************************************************************************
 * Приватный: определить ключ элемента вложения (в порядке приоритета).
 * @param {AttachmentElement} element - Элемент вложения.
 * @returns {string | null} - Ключ (temp_id / document_id / id) или null.
 * ***************************************************************************
 */
function _elementKey(element: AttachmentElement): string | null {

    if (!element || typeof element !== "object") return null;

    // Приоритет: temp_id → document_id → id (server-side)
    const key = element.temp_id ?? element.document_id ?? element.id;

    return key != null ? String(key) : null;
}

/**
 * ***************************************************************************
 * Приватный: определить document_id элемента вложения (только серверный id).
 * @param {AttachmentElement} element - Элемент вложения.
 * @returns {string | number | null} - document_id или null (для temp ещё не загруженных).
 * ***************************************************************************
 */
function _documentId(element: AttachmentElement): string | number | null {
    if (!element || typeof element !== "object") return null;
    return element.id ?? element.document_id ?? null;
}
