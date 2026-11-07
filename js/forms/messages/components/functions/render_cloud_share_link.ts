// Импортируем сторонние пакеты
import type { MarkdownIt, RendererRule } from "markdown-it";

// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

/**
 * ***************************************************************************
 * Markdown-it plugin: Cloud Share Links
 *
 * Поведение:
 * - Перехватывает ссылки формата /cloud/token_id
 * - Добавляет класс cloud-share-link и атрибут data-cloud-share-link
 * @param md - Экземпляр markdown-it.
 * ***************************************************************************
 */
export function cloudShareLinkRenderPlugin(md: MarkdownIt): void {

    try {

        const host = typeof window !== "undefined" ? window.location.hostname : "";

        /**
         * Обновленная регулярка:
         * Ищем /cloud/ за которым следует ID (токен) из таблицы cloud_shares
         */
        const CLOUD_REGEX = new RegExp(`^https?:\\/\\/${host.replace(/\./g, "\\.")}\\/cloud\\/([a-zA-Z0-9_\\-]+)`, "i");

        const defaultRender: RendererRule = md.renderer.rules.link_open || function (tokens, idx, options, env, self) {
            return self.renderToken(tokens, idx, options);
        };

        md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
            const token = tokens[idx];
            if (!token) return "";
            const hrefIndex = token.attrIndex("href");

            // attrIndex возвращает -1 и без атрибутов, поэтому здесь attrs есть
            const hrefAttr = token.attrs?.[hrefIndex];
            if (hrefIndex >= 0 && hrefAttr) {
                // markdown-it 15: значение атрибута приходит string | number
                const href = String(hrefAttr[1]);
                const match = href.match(CLOUD_REGEX);

                if (match) {
                    const tokenCode = match[1] ?? "";

                    // Добавляем класс для стилизации облачных ссылок
                    const classIndex = token.attrIndex("class");
                    if (classIndex < 0) {
                        token.attrPush(["class", "cloud-share-link"]);
                    } else {
                        const classAttr = token.attrs?.[classIndex];
                        if (classAttr) classAttr[1] += " cloud-share-link";
                    }

                    /**
                     * Записываем токен в data-атрибут. 
                     * Это позволит фронтенду при клике перехватить событие и 
                     * открыть файл/папку через API облака.
                     */
                    token.attrPush(["data-cloud-share-link", tokenCode]);
                }
            }

            return defaultRender(tokens, idx, options, env, self);
        };

    } catch (error) {

        // Ошибка рендера не должна ронять всё сообщение: логируем
        // и отдаём дальше — текст останется без дополнительной разметки.
        Logger.error("[app][messages][render-cloud-share-link]:", error);

    }

}
