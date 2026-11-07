// Импортируем сторонние пакеты
import type { MarkdownIt, RendererRule } from "markdown-it";

// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

/**
 * ***************************************************************************
 * Markdown-it plugin: Invite Links
 *
 * Поведение:
 * - Перехватывает стандартный рендер ссылок (link_open)
 * - Если URL ведет на текущий хост и начинается с /+, добавляет data-invite
 * - Работает как для голых ссылок, так и для [текст](url)
 *
 * Архитектура:
 * - Используем Renderer Rule (не tokenizer)
 * - Модифицируем токены "на лету" перед генерацией HTML
 * - Сохраняем оригинальное поведение для обычных ссылок
 *
 * Безопасность:
 * - Полагаемся на стандартный механизм экранирования attrs в markdown-it
 * @param md - Экземпляр markdown-it.
 * ***************************************************************************
 */
export function inviteLinkRenderPlugin(md: MarkdownIt): void {

    try {

        // Динамически определяем текущий хост. 
        // В регулярке экранируем точки для корректного поиска.
        const host = typeof window !== "undefined" ? window.location.hostname : "";
        const INVITE_REGEX = new RegExp(`^https?:\\/\\/${host.replace(/\./g, "\\.")}\\/\\+([a-zA-Z0-9_\\-]+)`, "i");

        /**
         * Сохраняем оригинальный рендерер, чтобы расширить его, 
         * а не полностью перезаписать (Proxy pattern).
         */
        const defaultRender: RendererRule = md.renderer.rules.link_open || function (tokens, idx, options, env, self) {
            return self.renderToken(tokens, idx, options);
        };

        /**
         * Переопределяем правило отрисовки открывающего тега <a>
         */
        md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
            const token = tokens[idx];
            if (!token) return "";

            // Ищем индекс атрибута href в массиве атрибутов токена
            const hrefIndex = token.attrIndex("href");

            // attrIndex возвращает -1 и без атрибутов, поэтому здесь attrs есть
            const hrefAttr = token.attrs?.[hrefIndex];
            if (hrefIndex >= 0 && hrefAttr) {
                // markdown-it 15: значение атрибута приходит string | number
                const href = String(hrefAttr[1]);

                // Проверяем URL на соответствие формату инвайта
                const match = href.match(INVITE_REGEX);

                if (match) {
                    const inviteCode = match[1] ?? "";

                    /**
                     * Добавляем класс. 
                     * Если класс уже есть (например, от другого плагина), дополняем его.
                     */
                    const classIndex = token.attrIndex("class");
                    if (classIndex < 0) {
                        token.attrPush(["class", "invite-link"]);
                    } else {
                        const classAttr = token.attrs?.[classIndex];
                        if (classAttr) classAttr[1] += " invite-link";
                    }

                    /**
                     * Добавляем специфический атрибут для нашего фронтенда
                     */
                    token.attrPush(["data-invite", inviteCode]);
                }
            }

            // Возвращаем результат оригинального рендерера с нашими правками в token.attrs
            return defaultRender(tokens, idx, options, env, self);

        };

    } catch (error) {

        // Ошибка рендера не должна ронять всё сообщение: логируем
        // и отдаём дальше — текст останется без дополнительной разметки.
        Logger.error("[app][messages][render-invite-link]:", error);

    }

}
