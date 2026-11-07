// Импортируем components
import { Toast } from "../../components/toast.js";

// Импортируем utils
import { Logger } from "../logs/logger.js";
import { t } from "../i18n/index.js";

/**
 * ***************************************************************************
 * Clipboard - единый хелпер копирования текста.
 *
 * Зачем:
 * - `navigator.clipboard.writeText()` возвращает промис, который почти всегда
 *   забывали обрабатывать: при отказе (нет HTTPS, нет прав, старый браузер)
 *   пользователь не получал никакой реакции.
 * - Промис «висел» в памяти без `.catch()` — это ещё и необработанное отклонение
 *   в консоли.
 *
 * Модуль не бросает исключения: он возвращает boolean, а тексты берёт из локали.
 * ***************************************************************************
 */

/**
 * Опции копирования текста.
 */
export interface CopyTextOptions {

    /** Контекст для лога (по умолчанию "[app][clipboard]"). */
    context?: string;

    /** Не показывать тосты — только лог (по умолчанию false). */
    silent?: boolean;

    /** Текст тоста об успешном копировании (иначе — из локали). */
    successText?: string;

    /** Текст тоста об ошибке копирования (иначе — из локали). */
    errorText?: string;

}

/**
 * ***************************************************************************
 * Скопировать текст в буфер обмена.
 * @param text - Текст для копирования.
 * @param options - Опции (см. CopyTextOptions).
 * @returns true, если текст скопирован.
 * ***************************************************************************
 */
export async function copyText(text: string, options: CopyTextOptions = {}): Promise<boolean> {

    // Контекст для логов
    const context = options.context || "[app][clipboard]";

    // Тексты тостов: кастомные из вызывающего кода, иначе дефолтные из локали
    const successText = options.successText
        || t("components.clipboard.success");
    const errorText = options.errorText
        || t("components.clipboard.error");

    // Пустой текст копировать нечего
    if (!text) {
        Logger.warn(`${context}: попытка скопировать пустой текст.`);
        return false;
    }

    // ==========================
    // Способ 1: Clipboard API
    // ==========================
    try {
        if (navigator?.clipboard?.writeText) {
            await navigator.clipboard.writeText(String(text));

            // Успех
            !options.silent && Toast.success(successText);
            return true;
        }
    } catch (error) {

        // Частая причина — нет прав (https) или запрет в браузере: пробуем запасной путь
        Logger.warn(`${context}: Clipboard API недоступен, пробуем execCommand.`, error);

    }

    // ==========================
    // Способ 2: execCommand (устаревший, но работает в http-окружении и в WebView)
    // ==========================
    const copied = _copyByExecCommand(String(text));

    if (copied) {
        !options.silent && Toast.success(successText);
        return true;
    }

    // Ни один способ не сработал
    Logger.error(`${context}: не удалось скопировать текст.`);
    !options.silent && Toast.error(errorText);

    return false;

}

/**
 * ***************************************************************************
 * Копирование через execCommand (запасной путь без Clipboard API).
 * @param text - Текст для копирования.
 * @returns true, если скопировано.
 * ***************************************************************************
 */
function _copyByExecCommand(text: string): boolean {

    // Вне DOM скопировать нечего
    if (typeof document === "undefined") return false;

    try {

        // Временный textarea, который не должен быть виден и не должен получать фокус
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.top = "-1000px";
        textarea.style.opacity = "0";

        document.body.appendChild(textarea);
        textarea.select();

        // Само копирование (в некоторых браузерах нужно выделить всю страницу)
        const copied = document.execCommand ? document.execCommand("copy") : false;

        textarea.remove();

        return !!copied;

    } catch (error) {

        Logger.error("[app][clipboard]: ошибка execCommand.", error);
        return false;

    }

}
