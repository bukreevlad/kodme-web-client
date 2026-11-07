/**
 * Чистые функции сопоставления строк локали: текст на языке A → ключ →
 * перевод на язык B. Без зависимостей от DOM и i18next — покрываются
 * юнит-тестами напрямую.
 */

/** Правило параметрического шаблона: regex по значению с {{параметрами}}. */
interface PatternRule {

    /** Ключ перевода (полный путь к значению). */
    key: string;

    /** Regex со скобочными группами вместо {{параметров}}. */
    regex: RegExp;

    /** Имена параметров по порядку групп regex. */
    names: string[];

}

/** Правило множественной формы: форма слова → базовый ключ без суффикса. */
interface PluralRule {

    /** Форма слова (значение ключа с суффиксом `_one/_few/...`). */
    value: string;

    /** Базовый ключ: путь без суффикса, подставляется с `count`. */
    baseKey: string;

}

/** Индекс языка для обратного поиска «строка → ключ». */
export interface LanguageIndex {

    /** Точная карта: строка локали → ключ. */
    exact: Map<string, string>;

    /** Параметрические значения (содержат {{параметр}}). */
    patterns: PatternRule[];

    /** Множественные формы слов. */
    plurals: Map<string, string>;

}

/** Результат сопоставления текста с ключом локали. */
export type TranslationMatch =

    /** Точное совпадение значения. */
    | { kind: "exact"; key: string }

    /** Параметрический шаблон: ключ и извлечённые параметры. */
    | { kind: "pattern"; key: string; params: Record<string, string> }

    /** Число и множественная форма: базовый ключ и count. */
    | { kind: "plural"; baseKey: string; count: number };

/** Суффиксы множественных форм CLDR (порядок — от более специфичного). */
const PLURAL_SUFFIXES = ["_ordinal_one", "_ordinal_other", "_one", "_few", "_many", "_other", "_zero", "_two"];

/**
 * ***************************************************************************
 * Собирает индекс языка: точную карту, параметрические regex и множественные
 * формы. Обход — все строки дерева, включая элементы массивов.
 * @param {object} tree - Дерево строк локали (locales/<язык>.json).
 * @returns Индекс для обратного поиска.
 * ***************************************************************************
 */
export function buildLanguageIndex(tree: unknown): LanguageIndex {

    const exact = new Map<string, string>();
    const patterns: PatternRule[] = [];
    const plurals = new Map<string, string>();

    const walk = (node: unknown, path: string): void => {

        if (typeof node === "string") {

            // Имя языка не переводится при смене языка: список языков
            // показывает самоназвания («Русский»/«English») иначе после
            // переключения обе строки стали бы одинаковыми
            if (path === "locale_name") return;

            // Суффикс множественной формы: значение идёт в plurals,
            // базовый ключ (путь без суффикса) подставляется с count
            const pluralSuffix = PLURAL_SUFFIXES.find((suffix) => path.endsWith(suffix));
            if (pluralSuffix) {
                const baseKey = path.slice(0, -pluralSuffix.length);
                if (node && !plurals.has(node)) plurals.set(node, baseKey);
                if (!exact.has(node)) exact.set(node, path);
                return;
            }

            if (!node) return;

            // {{параметры}} — компилируем в regex; параметры языконезависимы
            if (node.includes("{{")) {
                const names: string[] = [];
                const source = node
                    .split(/(\{\{\w+\}\})/)
                    .map((part) => {
                        const param = part.match(/^\{\{(\w+)\}\}$/);
                        if (!param) return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                        names.push(param[1] ?? "");
                        return "(.+)";
                    })
                    .join("");
                patterns.push({ key: path, regex: new RegExp(`^${source}$`), names });
                return;
            }

            if (!exact.has(node)) exact.set(node, path);
            return;

        }

        if (Array.isArray(node)) {
            node.forEach((item, index) => walk(item, path ? `${path}.${index}` : String(index)));
            return;
        }

        if (node && typeof node === "object") {
            for (const [key, value] of Object.entries(node)) {
                walk(value, path ? `${path}.${key}` : key);
            }
        }

    };

    walk(tree, "");

    // Параметрические правила — от более точного (длинный литерал впереди)
    patterns.sort((a, b) => b.regex.source.length - a.regex.source.length);

    return { exact, patterns, plurals };

}

/**
 * ***************************************************************************
 * Ищет ключ локали для текста: точное совпадение → параметрический шаблон →
 * «целое число + множественная форма». Первое совпадение побеждает.
 * @param {LanguageIndex} index - Индекс языка, на котором написан текст.
 * @param {string} text - Текст из DOM.
 * @returns Совпадение либо null (текст не трогаем).
 * ***************************************************************************
 */
export function matchTranslation(index: LanguageIndex, text: string): TranslationMatch | null {

    const trimmed = text.trim();
    if (!trimmed) return null;

    // 1. Точное совпадение
    const exactKey = index.exact.get(trimmed);
    if (exactKey) return { kind: "exact", key: exactKey };

    // 2. Параметрический шаблон: «Код отправлен на a@b.c», «Шаг 1 из 3»
    for (const rule of index.patterns) {
        const found = trimmed.match(rule.regex);
        if (!found) continue;
        const params: Record<string, string> = {};
        rule.names.forEach((name, position) => {
            params[name] = found[position + 1] ?? "";
        });
        return { kind: "pattern", key: rule.key, params };
    }

    // 3. Число и множественная форма: «5 файлов» → count + форма слова
    const countMatch = trimmed.match(/^(\d+)\s+(.+)$/);
    const count = countMatch?.[1];
    const word = countMatch?.[2];
    if (count && word) {
        const baseKey = index.plurals.get(word);
        if (baseKey) return { kind: "plural", baseKey, count: Number(count) };
    }

    return null;

}

/**
 * ***************************************************************************
 * Переводит текст по совпадению на языке назначения. Чистая функция:
 * берёт значения из дерева целевой локали, категорию множественного числа
 * выбирает Intl.PluralRules.
 * @param {string} language - Код языка назначения (нужен для plural-правил).
 * @param {object} tree - Дерево строк целевой локали.
 * @param {TranslationMatch} match - Совпадение из matchTranslation.
 * @returns Перевод либо null (нет значения — текст остаётся как был).
 * ***************************************************************************
 */
export function applyTranslation(language: string, tree: unknown, match: TranslationMatch): string | null {

    const dig = (path: string): unknown => {
        let node: unknown = tree;
        for (const segment of path.split(".")) {
            if (node && typeof node === "object" && segment in (node as Record<string, unknown>)) {
                node = (node as Record<string, unknown>)[segment];
            } else {
                return undefined;
            }
        }
        return node;
    };

    if (match.kind === "exact") {
        const value = dig(match.key);
        return typeof value === "string" ? value : null;
    }

    if (match.kind === "pattern") {
        const value = dig(match.key);
        if (typeof value !== "string") return null;
        let result = value;
        for (const [name, param] of Object.entries(match.params)) {
            result = result.replaceAll(`{{${name}}}`, param);
        }
        return result;
    }

    // plural: категория языка назначения → суффикс → значение; число
    // возвращается в составе — исходный текст был «N слово»
    const category = new Intl.PluralRules(language).select(match.count);
    const candidates = [`${match.baseKey}_${category}`, `${match.baseKey}_other`];
    for (const key of candidates) {
        const value = dig(key);
        if (typeof value === "string") return `${match.count} ${value}`;
    }
    return null;

}
