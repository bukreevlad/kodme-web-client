// Импортируем сторонние пакеты
import { OverlayScrollbars } from "overlayscrollbars";

// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";
import { copyText } from "../../../../utils/helpers/clipboard.js";

// Импортируем типы
import type { MessageItem } from "../message.js";

/**
 * ***************************************************************************
 * preCodeActions - обвязка блоков кода внутри сообщения: скроллбар по ширине
 * кода и кнопка копирования текста блока.
 * @param message - Родительский компонент сообщения.
 * @returns void
 * ***************************************************************************
 */
export function preCodeActions(message: MessageItem): void {

    try {

        // Устанавливаем элементы
        let text = message.element.querySelector(":scope >.block >.presentation >.wrap-content >.wrap >.text-wrap >[data-text]");

        // =====================================

        // Включаем скролл
        text?.querySelectorAll("[data-pre-code]").forEach(element => {

            // Устанавливаем элементы
            let pre = element.querySelector("pre");
            let code = element.querySelector("code");
            let copyButton = element.querySelector<HTMLElement>("[action-copy]");

            // Без <pre> скроллбар нечего инициализировать
            if (!pre) return;

            // Инициализируем скроллбар
            const osListScrollInstance = OverlayScrollbars(pre, {
                scrollbars: { autoHide: "never" }, overflow: { x: "scroll", y: "scroll" }
            });

            // Кнопка копирования
            if (copyButton) {

                // Клик
                copyButton.onclick = async () => {

                    // Если нет code
                    if (!code) return;

                    // invariant: <code> внутри блока — всегда HTML-элемент
                    const textToCopy = (code as HTMLElement).innerText;

                    // Копируем через общий хелпер: раньше здесь был «висящий»
                    // промис navigator.clipboard без .catch() и console.error
                    await copyText(textToCopy, {
                        context: "[app][messages][precode-actions]"
                    });

                };

            }

        });

        // =====================================

    } catch (error) {

        // Ошибка рендера не должна ронять всё сообщение: логируем
        // и отдаём дальше — текст останется без дополнительной разметки.
        Logger.error("[app][messages][precode-actions]:", error);

    }

}
