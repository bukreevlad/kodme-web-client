// Импортируем сторонние пакеты
import type { MarkdownIt, StateInline, Token } from "markdown-it";

// Импортируем config
import { MESSAGES_MENTIONS_REGEX } from "../../../../config/constants.js";

// Импортируем utils
import { Icons } from "../../../../utils/icons.js";
import { Logger } from "../../../../utils/logs/logger.js";

/**
 * Данные mention-токена, сохраняемые в meta (в HTML попадают уже
 * экранированными копиями).
 */
interface MentionMeta {

    /** Username либо код приглашения (ссылка mention'а). */
    link: string;

    /** Код приложения бота (пустая строка, если botapp не передан). */
    botAppLink: string;

}

/**
 * ***************************************************************************
 * Markdown-it plugin: Mentions
 *
 * Поведение:
 *  - Находит @username в тексте
 *  - Не срабатывает внутри `code`, `fence`, `link`
 *  - Не ломает стандартный markdown parsing
 *
 * Архитектура:
 *  - Используем inline rule (не core)
 *  - Работает посимвольно через state.pos
 *  - Не делаем post-processing HTML
 *
 * Безопасность:
 *  - Username проходит через escapeHtml
 *  - Нет innerHTML
 *  - Нет regex поверх HTML
 *  - Не мутируем state.src
 *
 * Примечание: «не внутри code/link» достигается самой механикой markdown-it —
 * inline-правило не вызывается в контекстах code/fence, а регистрация
 * `before("link", ...)` означает срабатывание раньше разбора ссылок.
 * @param md - Экземпляр markdown-it.
 * ***************************************************************************
 */
export function mentionRenderPlugin(md: MarkdownIt): void {

    try {

        /**
         * ***************************************************************************
         * Основной inline tokenizer.
         * Вызывается markdown-it на каждой позиции state.pos.
         * ***************************************************************************
         */
        function tokenize(state: StateInline, silent: boolean): boolean {

            const start = state.pos;

            /**
             * ***************************************************************************
             * Быстрая оптимизация:
             * Если текущий символ не "@", нет смысла делать match.
             * Это ускоряет работу на больших текстах.
             * ***************************************************************************
             */
            if (state.src.charCodeAt(start) !== 0x40) { // "@"
                return false;
            }

            // Берём остаток строки
            const src = state.src.slice(start);
            const match = src.match(MESSAGES_MENTIONS_REGEX);

            // Regex должен совпадать строго с текущей позицией
            if (!match || match.index !== 0) {
                return false;
            }

            if (!silent) {

                const username = match[1];
                const botAppLink = match[2];

                /**
                 * Создаём токен mention.
                 *
                 * Тип: 'mention'
                 * HTML-тег: <a>
                 */
                const token = state.push("mention", "a", 0);

                /**
                 * ВАЖНО:
                 *  - Экранируем username
                 *  - Не доверяем пользовательскому вводу
                 *  - Данные кладём в meta (attrs токена — массив атрибутов HTML)
                 */
                token.meta = {
                    link: md.utils.escapeHtml(username ?? ""),
                    botAppLink: md.utils.escapeHtml(botAppLink ?? "")
                } satisfies MentionMeta;

                token.content = "@" + username;
            }

            // Продвигаем позицию парсера
            state.pos += match[0].length;

            return true;
        }

        /**
         * ***************************************************************************
         * Вставляем правило ДО link,
         * чтобы @username не превращался в обычный текст внутри URL.
         * ***************************************************************************
         */
        md.inline.ruler.before("link", "mention", tokenize);

        /**
         * ***************************************************************************
         * Renderer для mention-токена.
         * ***************************************************************************
         */
        md.renderer.rules.mention = (tokens: Token[], idx: number) => {
            const token = tokens[idx];
            if (!token) return "";

            // invariant: meta заполняется парсером-плагином — форма MentionMeta
            const meta = (token.meta ?? undefined) as MentionMeta | undefined;
            const content = md.utils.escapeHtml(token.content);

            // Закрывающий </span> раньше стоял ПОСЛЕ тернарника, из-за чего у
            // mention'а без botAppLink появлялся лишний закрывающий тег и
            // вложенность HTML ломалась (браузер закрывал span заранее).
            const botApp = meta?.botAppLink
                ? `<span class="flex flex-row gap-1 px-1 rounded-md bg-[var(--second-bg)]">${Icons.icon("app-window")?.outerHTML}${meta?.botAppLink}</span>`
                : "";

            return `<a data-mention="${meta?.link}" class="mention cursor-pointer inline-flex flex-row gap-1 "><span class="px-1 rounded-md bg-[var(--color-brand)]/10">${content}</span>${botApp}</a>`;
        };

    } catch (error) {

        // Ошибка рендера не должна ронять всё сообщение: логируем
        // и отдаём дальше — текст останется без дополнительной разметки.
        Logger.error("[app][messages][render-mentions]:", error);

    }

}
