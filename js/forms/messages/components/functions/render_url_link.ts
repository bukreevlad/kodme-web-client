// Импортируем сторонние пакеты
import type { MarkdownIt, RendererRule } from "markdown-it";

// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

/**
 * ***************************************************************************
 * Markdown-it plugin: URL Link Render Plugin
 *
 * Поведение:
 * - Перехватывает стандартный рендер ссылок (link_open)
 * - Добавляет атрибут data-link всем ссылкам
 * - Добавляет target="_blank"
 * - Сохраняет оригинальное поведение для всех ссылок
 *
 * Архитектура:
 * - Используем Renderer Rule (не tokenizer)
 * - Модифицируем токены "на лету" перед генерацией HTML
 * - Сохраняем оригинальный рендерер для базового функционала
 *
 * Безопасность:
 * - Полагаемся на стандартный механизм экранирования attrs в markdown-it
 * - Значение URL автоматически экранируется при рендеринге
 * @param md - Экземпляр markdown-it.
 * ***************************************************************************
 */
export function urlLinkRenderPlugin(md: MarkdownIt): void {

    try {

        // Сохраняем оригинальную функцию рендеринга ссылок
        const defaultRender: RendererRule = md.renderer.rules.link_open || function (tokens, idx, options, env, self) {
            return self.renderToken(tokens, idx, options);
        };

        // Переопределяем рендеринг открывающего тега ссылки
        md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
            const token = tokens[idx];
            if (!token) return "";

            // Получаем значение href
            const hrefIndex = token.attrIndex("href");
            // attrIndex возвращает -1 и без атрибутов, поэтому здесь attrs есть
            const hrefAttr = token.attrs?.[hrefIndex];
            if (hrefIndex >= 0 && hrefAttr) {
                const originalUrl = hrefAttr[1];

                // Добавляем атрибут data-link с оригинальным URL
                token.attrSet("data-link", originalUrl);
                token.attrSet("target", "_blank");
            } else {
                // Если по какой-то причине href отсутствует, все равно добавляем data-link
                token.attrSet("data-link", "");
            }

            // Вызываем оригинальный рендеринг
            return defaultRender(tokens, idx, options, env, self);
        };

    } catch (error) {

        // Ошибка рендера не должна ронять всё сообщение: логируем
        // и отдаём дальше — текст останется без дополнительной разметки.
        Logger.error("[app][messages][render-url-link]:", error);

    }

}
