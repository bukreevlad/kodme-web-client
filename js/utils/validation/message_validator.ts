// Импортируем config
import { getLimits } from "../../config/limits.js";

// Импортируем utils
import * as Attachments from "../messages/attachments.js";
import type { AttachmentsRaw } from "../messages/attachments.js";

/**
 * ***************************************************************************
 * MessageValidator - проверка сообщения ДО отправки на сервер: сервер
 * отвечает `TEXT_TOO_LONG` на текст длиннее лимита.
 *
 * Лимиты (длина текста, число вложений) берутся из `getLimits()`
 * (config/limits.ts): пока ответ авторизации не принят, проверки
 * пропускаются — их ведёт сервер. Проверка синхронна, поэтому можно
 * подсветить textarea и показать тост ДО создания pending-сообщения.
 *
 * Форма результата: `{ isValid, code, params }`, где `code` — ключ локали
 * (`forms.messages.toasts.*`), чтобы вызывающий код сам выбрал текст тоста.
 * ***************************************************************************
 */

/**
 * Разрешённые символы сообщения — зеркало серверной регулярки:
 *   /^[\p{L}\p{M}\p{N}\p{P}\p{S}\p{Zs}\u200C\u200D\u{E0020}-\u{E007F}]{1,N}$/mu
 *
 * Категории Unicode:
 * - `\p{L}` — буквы любой письменности (кириллица, латиница, иероглифы, арабский);
 * - `\p{M}` — знаки ударения, keycap (U+20E3) и variation selectors (U+FE0F);
 * - `\p{N}` — цифры (включая арабские индиские и римские);
 * - `\p{P}` — пунктуация;
 * - `\p{S}` — символы ( `$`, `€`, `©` ) и, что важно, эмодзи;
 * - `\p{Zs}` — пробелы (обычные и неразрывные), но НЕ перевод строки;
 * - U+200C/U+200D — ZWNJ/ZWJ, на которых держатся эмодзи-последовательности
 *   (👨‍👩‍👧) и персидский/хинди текст;
 * - U+E0020–U+E007F — теги флагов (🏴󠁧󠁢󠁳󠁣󠁴󠁿).
 *
 * Остальные невидимые символы (`\p{Cf}`: bidi-override, ZWSP, BOM) сюда
 * НЕ входят: ими прячут текст в сообщении, сервер их всё равно вычищает
 * в `sanitize_text`, а слать — незачем.
 *
 * ВАЖНО: при изменении регулярки на сервере — синхронно править и здесь,
 * иначе клиент отклонит текст, который сервер принял бы (или наоборот).
 */
const MESSAGES_TEXT_REGEX = /^[\p{L}\p{M}\p{N}\p{P}\p{S}\p{Zs}\u200C\u200D\u{E0020}-\u{E007F}]+$/mu;

/**
 * Коды ошибок валидации сообщения — ключи локали `forms.messages.toasts.*`.
 */
export type MessageValidationCode =
    | "message_too_long"
    | "invalid_characters"
    | "maximum_files"
    | "empty_message";

/**
 * Параметры ошибки валидации сообщения (подстановка в текст тоста).
 */
export interface MessageValidationParams {
    count?: number;
}

/**
 * Результат проверки сообщения: `isValid: true` всегда с `code: null`,
 * `isValid: false` — с кодом ошибки.
 */
export type MessageValidationResult =
    | { isValid: true; code: null; params: Record<string, never> }
    | { isValid: false; code: MessageValidationCode; params: MessageValidationParams };

/**
 * Общие опции проверки сообщения (текст + вложения).
 */
export interface ValidateMessageOptions {
    /** Максимум символов текста (по умолчанию `limits.messages.text_max_length`). */
    maxLength?: number;
    /** Проверять ли разрешённые символы (по умолчанию true). */
    checkCharacters?: boolean;
    /** Максимум файлов-вложений (по умолчанию лимит с сервера). */
    max?: number;
}

/**
 * Данные сообщения для canSend.
 */
export interface MessageData {
    /** Текст сообщения. */
    text?: string | null;
    /** Вложения (массив или объект-мап — любая форма). */
    attachments?: AttachmentsRaw;
}

/**
 * ***************************************************************************
 * Проверить текст сообщения.
 * @param text - Текст из textarea.
 * @param options - Опции.
 * @param options.maxLength - Максимум символов.
 * @param options.checkCharacters - Проверять ли разрешённые символы.
 * @returns Результат проверки.
 * ***************************************************************************
 */
export function validateText(text: string, options: ValidateMessageOptions = {}): MessageValidationResult {

    // Приводим к строке (textarea.value всегда строка, но защищаемся)
    const value = String(text ?? "");

    // Пустой текст — не задача этой проверки: «а есть ли что отправлять вообще»
    // решает canSend (пустой текст с вложениями отправляется штатно).
    // Регулярка же требует минимум один символ, поэтому пустая строка прошла бы
    // в «невалидные символы» — это вводит в заблуждение и ломает отправку
    // сообщения только с файлами.
    if (value === "") return { isValid: true, code: null, params: {} };

    // Максимум символов. Лимит неизвестен (ответ авторизации не принят) —
    // длину проверяет сервер
    const maxLength = options.maxLength ?? getLimits()?.messages.text_max_length;
    if (maxLength === undefined) return { isValid: true, code: null, params: {} };

    // Текст длиннее лимита: сервер ответит TEXT_TOO_LONG, предупреждаем заранее.
    // Считаем через spread: эмодзи занимает 2 UTF-16 code units — по .length
    // сообщение из эмодзи «превышало» бы лимит вдвое
    if ([...value].length > maxLength) {
        return { isValid: false, code: "message_too_long", params: { count: maxLength } };
    }

    // Символы: повторяем серверную регулярку, чтобы не отправлять заведомо
    // отвергаемый текст. Флаг `u` обязателен — без него свойства \p{...}
    // работают как «буквально p{L}».
    if (options.checkCharacters !== false && !MESSAGES_TEXT_REGEX.test(value)) {
        return { isValid: false, code: "invalid_characters", params: {} };
    }

    return { isValid: true, code: null, params: {} };

}

/**
 * ***************************************************************************
 * Проверить количество вложений.
 * @param attachments - Вложения сообщения (массив или объект-мап).
 * @param options - Опции.
 * @param options.max - Максимум файлов.
 * @returns Результат проверки.
 * ***************************************************************************
 */
export function validateAttachments(attachments: AttachmentsRaw, options: ValidateMessageOptions = {}): MessageValidationResult {

    // Максимум файлов из `limits.files.max_files_per_message`; лимит
    // неизвестен — количество проверяет сервер
    const max = options.max ?? getLimits()?.files.max_files_per_message;
    if (max === undefined) return { isValid: true, code: null, params: {} };

    // Считаем через нормализатор: сервер отдаёт массив, локальные — объект-мап
    const count = Attachments.count(attachments);

    if (count > max) {
        return { isValid: false, code: "maximum_files", params: { count: max } };
    }

    return { isValid: true, code: null, params: {} };

}

/**
 * ***************************************************************************
 * Проверить, можно ли отправить сообщение (текст или вложения).
 * @param data - Данные сообщения.
 * @param data.text - Текст сообщения.
 * @param data.attachments - Вложения.
 * @param options - Опции (см. validateText/validateAttachments).
 * @returns Результат проверки.
 * ***************************************************************************
 */
export function canSend(data: MessageData, options: ValidateMessageOptions = {}): MessageValidationResult {

    // Текст (с обрезкой пробелов: сообщение из одних пробелов отправлять бессмысленно)
    const text = String(data?.text ?? "").trim();

    // Есть вложения (считаем по нормализатору, а не по факту существования объекта)
    const hasAttachments = Attachments.isNotEmpty(data?.attachments);

    // Ни текста, ни вложений — отправлять нечего
    if (text === "" && !hasAttachments) {
        return { isValid: false, code: "empty_message", params: {} };
    }

    // Текст
    const textCheck = validateText(text, options);
    if (!textCheck.isValid) return textCheck;

    // Вложения
    const attachmentsCheck = validateAttachments(data?.attachments, options);
    if (!attachmentsCheck.isValid) return attachmentsCheck;

    return { isValid: true, code: null, params: {} };

}
