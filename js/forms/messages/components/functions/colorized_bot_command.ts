// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем типы
import type { BotCommandArg } from "../types.js";

/**
 * ***************************************************************************
 * colorizedBotCommand - раскрашенная HTML-разметка команды бота.
 *
 * Возвращает строку со span-ами команды и её аргументов: имя команды —
 * брендовым цветом, ключи аргументов — жёлтым, строки — зелёным,
 * числа и boolean — красным. Ошибка рендера не роняет сообщение:
 * логируется и возвращается пустая строка (раньше — undefined, который
 * при записи в innerHTML превращался в текст «undefined»).
 * @param command - Команда бота (без ведущего "/").
 * @param args - Аргументы команды.
 * @returns HTML-строка разметки команды ("" при отсутствии команды).
 * ***************************************************************************
 */
export function colorizedBotCommand(command?: string | null, args?: BotCommandArg[] | null): string {

    try {

        // Если нет команды — отдаём пустую строку
        if (!command) return "";

        // Команда бота
        let result = `<span class="cmd-name text-[var(--color-brand)] dark:text-[var(--color-brand)] font-semibold">/${command}</span>`;

        // Проходим по аргументам
        args && args.forEach(arg => {

            // Если есть ключ
            if (arg.key) {

                // Аргументы с ключами и значениями
                let keyHtml = `<span class="arg-key font-semibold text-[var(--color-yellow)] dark:text-[var(--color-yellow)]">${arg.key}</span>`;

                // Если значение = строка
                if (typeof arg.value === "string") {

                    result += ` ${keyHtml} <span class="arg-string text-green-600 dark:text-green-500">"${arg.value}"</span>`;

                    // Если значение = boolean
                } else if (typeof arg.value === "boolean") {

                    result += ` ${keyHtml} <span class="arg-bool text-[var(--color-red)] dark:text-[var(--color-red)]">${arg.value}</span>`;

                    // Если значение = number
                } else if (typeof arg.value === "number") {

                    result += ` ${keyHtml} <span class="arg-number text-[var(--color-red)] dark:text-[var(--color-red)]">${arg.value}</span>`;

                } else if (!arg.value) {

                    result += ` ${keyHtml}`;

                }

                // Отдельные значения без ключей
            } else {

                // Если значение = boolean
                if (typeof arg.value === "boolean") {

                    result += ` <span class="arg-bool text-[var(--color-red)] dark:text-[var(--color-red)]">${arg.value}</span>`;

                    // Если значение = number
                } else if (typeof arg.value === "number") {

                    result += ` <span class="arg-number text-[var(--color-red)] dark:text-[var(--color-red)]">${arg.value}</span>`;

                } else {

                    if (arg.isQuoted) {
                        result += ` <span class="arg-string text-green-600 dark:text-green-500">${arg.isQuoted}${arg.value}${arg.isQuoted}</span>`;
                    } else {
                        result += ` <span class="arg-standalone text-secondary dark:text-secondary">${arg.value}</span>`;
                    }

                }

            }

        });

        return result;

    } catch (error) {

        // Ошибка рендера не должна ронять всё сообщение: логируем
        // и отдаём пустую строку — текст останется без дополнительной разметки.
        Logger.error("[app][messages][colorized-bot-command]:", error);
        return "";

    }

}
