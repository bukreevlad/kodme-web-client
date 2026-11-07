// Импортируем сторонние пакеты
import type { MarkdownIt } from "markdown-it";

// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем config
import { MESSAGES_BOT_COMMAND_REGEX } from "../../../../config/constants.js";

/**
 * Данные разобранной команды бота, сохраняемые в meta токена
 * (не попадают в HTML напрямую — рендер экранирует их заново).
 */
interface BotCommandMeta {

    /** Nickname бота из шаблона команды. */
    bot: string | null;

    /** Имя команды без "/". */
    command: string | null;

    /** Строка аргументов. */
    args: string | null;

}

/**
 * ***************************************************************************
 * Markdown-it plugin: Bot Commands (STRICT MODE)
 *
 * Поведение:
 *  - Команда должна быть единственным содержимым сообщения.
 *  - Если присутствует любой дополнительный текст — парсинг не выполняется.
 *  - Работает на уровне core-пайплайна Markdown-it.
 *
 * Архитектурный принцип:
 *  - Мы не перехватываем inline-символы.
 *  - Мы проверяем весь исходный markdown (state.src).
 *  - Если это команда — полностью заменяем токены Markdown.
 *
 * Безопасность:
 *  - HTML не парсится (html: false в MarkdownIt).
 *  - Данные экранируются через md.utils.escapeHtml.
 *  - Нет post-processing HTML через regex.
 *  - Нет innerHTML-инъекций.
 * @param md - Экземпляр markdown-it.
 * ***************************************************************************
 */
export function renderBotCommands(md: MarkdownIt): void {

    try {

        /**
         * core.ruler.after('inline')
         *
         * Запускаемся ПОСЛЕ того как Markdown разобрал inline.
         * Это гарантирует:
         *  - мы имеем доступ к state.src (оригинальный текст)
         *  - можем безопасно заменить весь AST при необходимости
         */
        md.core.ruler.after("inline", "bot_command_strict", function (state) {

            // Убираем пробелы по краям.
            // Это позволяет корректно обрабатывать:
            // "   /start   "
            const raw = state.src.trim();

            // Проверяем совпадение со строгим regex.
            // Regex уже якорный (^ ... $).
            const match = MESSAGES_BOT_COMMAND_REGEX.exec(raw);

            // Если это НЕ чистая команда — ничего не меняем.
            if (!match) return;

            /**
             * Если мы здесь — всё сообщение является bot-командой.
             * Полностью заменяем токены Markdown.
             *
             * Это гарантирует:
             *  - команда не будет частично обработана markdown-правилами
             *  - не будет конфликтов с другими inline-плагинами
             */
            state.tokens = [];

            // Создаём структуру:
            // <p>
            //   <inline>
            //     <bot_command>
            //   </inline>
            // </p>

            const open = new state.Token("paragraph_open", "p", 1);
            const inline = new state.Token("inline", "", 0);
            const close = new state.Token("paragraph_close", "p", -1);

            inline.content = raw;
            inline.children = [];

            // Создаём кастомный токен bot_command
            const cmdToken = new state.Token("bot_command", "", 0);
            cmdToken.content = raw;

            /**
             * meta — безопасное место для хранения разобранных данных.
             * Эти данные не попадают напрямую в HTML.
             */
            cmdToken.meta = {
                bot: match.groups?.bot || null,
                command: match.groups?.command || null,
                args: match.groups?.args || null
            } satisfies BotCommandMeta;

            inline.children.push(cmdToken);

            state.tokens.push(open);
            state.tokens.push(inline);
            state.tokens.push(close);

        });

        /**
         * Renderer для кастомного токена bot_command
         *
         * ВАЖНО:
         *  - Всегда экранируем вывод.
         *  - Не доверяем token.meta.
         */
        md.renderer.rules.bot_command = (tokens, idx) => {

            const token = tokens[idx];
            if (!token) return "";

            // invariant: meta заполняется парсером-плагином — форма BotCommandMeta
            const meta = (token.meta ?? undefined) as BotCommandMeta | undefined;

            // Экранируем текст команды
            const content = md.utils.escapeHtml(token.content);

            return `<a href="#"
                data-bot-command 
                data-bot="${md.utils.escapeHtml(meta?.bot || "")}"
                data-command="${md.utils.escapeHtml(meta?.command || "")}"
                data-args="${md.utils.escapeHtml(meta?.args || "")}"
            >${content}</a>`;
        };

    } catch (error) {

        // Ошибка рендера не должна ронять всё сообщение: логируем
        // и отдаём дальше — текст останется без дополнительной разметки.
        Logger.error("[app][messages][render-bot-commands]:", error);

    }

}
