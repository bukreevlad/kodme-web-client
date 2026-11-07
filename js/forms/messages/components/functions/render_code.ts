// Импортируем сторонние пакеты
import type { MarkdownIt, RendererRule } from "markdown-it";

// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

/**
 * ***************************************************************************
 * Markdown-it plugin: Code Class Plugin
 *
 * Поведение:
 * - Перехватывает стандартный рендер inline-кода (code_inline)
 * - Добавляет классы ко всем inline-кодам
 * - Сохраняет оригинальное поведение для всех code
 *
 * Архитектура:
 * - Используем Renderer Rule (не tokenizer)
 * - Модифицируем токены "на лету" перед генерацией HTML
 * - Сохраняем оригинальный рендерер для базового функционала
 *
 * Безопасность:
 * - Полагаемся на стандартный механизм экранирования attrs в markdown-it
 * @param md - Экземпляр markdown-it.
 * ***************************************************************************
 */
export function codeClassPlugin(md: MarkdownIt): void {

    try {

        // Сохраняем оригинальную функцию рендеринга inline-кода
        const defaultRender: RendererRule = md.renderer.rules.code_inline || function (tokens, idx, options, env, self) {
            return self.renderToken(tokens, idx, options);
        };

        // Переопределяем рендеринг inline-кода
        md.renderer.rules.code_inline = function (tokens, idx, options, env, self) {
            const token = tokens[idx];
            if (!token) return "";

            // Добавляем классы к code
            const classes = "flex-inline rounded-md px-1 text-[var(--color-brand)] bg-[var(--color-brand)]/10";

            // Проверяем, есть ли уже атрибут class
            const classIndex = token.attrIndex("class");
            // attrIndex возвращает -1 и без атрибутов, поэтому здесь attrs есть
            if (classIndex >= 0 && token.attrs) {
                // Если класс уже есть, добавляем новые классы к существующим
                const classAttr = token.attrs[classIndex];
                if (classAttr) classAttr[1] += " " + classes;
            } else {
                // Если класса нет, устанавливаем новый атрибут
                token.attrSet("class", classes);
            }

            // Вызываем оригинальный рендеринг
            return defaultRender(tokens, idx, options, env, self);
        };

    } catch (error) {

        // Ошибка рендера не должна ронять всё сообщение: логируем
        // и отдаём дальше — текст останется без дополнительной разметки.
        Logger.error("[app][messages][render-code]:", error);

    }

}
