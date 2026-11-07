// Импортируем bun test
import { describe, expect, test } from "bun:test";

// Импортируем файловую систему
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

/** Корень исходников клиента (этот файл лежит в tests/). */
const SRC_ROOT = join(import.meta.dir, "..", "js");

/**
 * Файлы с исключениями:
 * - time_ago_formatter — НАМЕРЕННЫЕ русские ветки locale.startsWith("ru"),
 *   это и есть локализация форматтера;
 * - overlay — ошибки программиста (инфраструктура, не интерфейс);
 * - sw — уведомления Service Worker: язык в контексте SW недоступен без
 *   обмена со страницей, локализация вынесена отдельным решением.
 */
const ALLOW_FILES = new Set([
    "utils/date/time_ago_formatter.ts",
    "components/overlay/index.ts",
    "sw.ts",
    // Метки progress медиа-обработки — диагностика: потребителей,
    // отображающих их в UI, в коде нет
    "utils/media/media_processor.ts",
]);

/**
 * Строки, где кириллица — не вывод пользователю: логи, сообщения исключений,
 * а также сопоставления строк (regex/.test/.includes/.replace) — это логика
 * над текстом сервера/регулярками, а не отображение.
 */
const ALLOW_LINE = /Logger\.|console\.|throw new |new Error\(|\.test\(|\.replace\(|\.includes\(/;

/**
 * Рекурсивно собирает все .ts-файлы каталога.
 * @param dir - Каталог.
 * @returns Список абсолютных путей.
 */
function walk(dir: string): string[] {
    const result: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) result.push(...walk(full));
        else if (entry.name.endsWith(".ts")) result.push(full);
    }
    return result;
}

/**
 * ***************************************************************************
 * Запрет вшитых русских строк: тексты пользователю — только через t() и
 * locales/*.json. Строки в коде (в т.ч. внутри HTML-шаблонов) — нарушение;
 * комментарии и логи не считаются.
 *
 * Исключение — форматтер дат: его ru-ветки условия locale.startsWith("ru")
 * и являются локализацией.
 * ***************************************************************************
 */
describe("запрет вшитых строк в коде", () => {

    test("в js/ нет русских литералов вне локализации", () => {
        const violations: string[] = [];

        for (const file of walk(SRC_ROOT)) {
            const rel = relative(SRC_ROOT, file).split(sep).join("/");
            if (ALLOW_FILES.has(rel)) continue;

            const lines = readFileSync(file, "utf8").split("\n");
            let inBlockComment = false;
            let inHtmlComment = false;
            let prevCode = "";

            lines.forEach((line, index) => {
                const trimmed = line.trim();

                // Блочные комментарии кода (/* ... */, в т.ч. без ведущего *)
                if (inBlockComment) {
                    if (trimmed.includes("*/")) inBlockComment = false;
                    return;
                }
                if (!inBlockComment && trimmed.includes("/*") && !trimmed.includes("*/")) {
                    inBlockComment = true;
                    return;
                }

                // HTML-комментарии внутри шаблонов (<!-- ... -->)
                if (inHtmlComment) {
                    if (trimmed.includes("-->")) inHtmlComment = false;
                    return;
                }
                if (trimmed.includes("<!--")) {
                    if (!trimmed.includes("-->")) inHtmlComment = true;
                    return;
                }

                // Комментарии — не код
                if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.endsWith("*/")) return;

                // Строчный комментарий после кода отсекаем (URL с //
                // усекут строку — это лишь недосмотр, не ложное срабатывание)
                const code = line.split("//")[0] ?? "";
                const remember = (): void => {
                    if (trimmed) prevCode = trimmed;
                };

                // Продолжение многострочного лога/ошибки: строка-шаблон
                // начинается со скобки/плюса, а вызов — на предыдущей строке
                // (проверяем ДО запоминания — prevCode ещё прошлая строка)
                if (/^(\+|`|\?|\|\|)/.test(trimmed) && /Logger\.|console\.|throw new/.test(prevCode)) {
                    return;
                }

                if (!/[А-Яа-яЁё]/.test(code)) {
                    remember();
                    return;
                }
                if (ALLOW_LINE.test(code)) {
                    remember();
                    return;
                }

                violations.push(`js/${rel}:${index + 1}: ${trimmed.slice(0, 120)}`);
                remember();
            });
        }

        expect(violations).toEqual([]);
    });

});
