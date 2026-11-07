// Импортируем сторонние пакеты
import i18next from "i18next";

// Импортируем utils
import { Logger } from "../logs/logger.js";
import { TimeAgoFormatter } from "../date/time_ago_formatter.js";
import { applyTranslation, buildLanguageIndex, matchTranslation } from "./language_index.js";

// Импортируем типы
import type { DisplayType } from "../date/time_ago_formatter.js";

// Импортируем locales
import ru from "../../../locales/ru.json";

// Импортируем типы: type-only импорт en.json проверяет компилятором, что
// английская локаль содержит все ключи русской (несовпадение — ошибка tsc)
import type en from "../../../locales/en.json";

/**
 * Дерево строк одной локали — структура файла locales/<код>.json.
 */
type LocaleTree = typeof ru;

/** Язык для переключателя: код и имя из locale_name. */
export interface I18nLanguage {

    /** Код языка (ключи LOADERS). */
    code: string;

    /** Отображаемое имя (locale_name из локали). */
    name: string;

}

// Полнота en относительно ru: не хватает ключей — тип never, константа
// не соберётся
const _enComplete: typeof en extends LocaleTree ? true : never = true;

/**
 * Ленивая загрузка локалей: каждая локаль — отдельный чанк сборки,
 * в основном бандле только предзагруженный ru.
 */
const LOADERS: Record<string, () => Promise<{ default: LocaleTree }>> = {
    ru: async () => ({ default: ru }),
    en: () => import("../../../locales/en.json")
};

/** Атрибуты элементов, текст которых переводится при смене языка. */
const TRANSLATED_ATTRS = ["placeholder", "title", "aria-label", "alt", "value", "data-tooltip"];

/**
 * ***************************************************************************
 * I18n - сервис локализации на i18next.
 *
 * Инициализируется один раз в main до первого перевода. Смена языка в
 * реальном времени: changeLanguage() меняет ресурсы, сохраняет выбор и
 * рассылает событие `[app][locale]::changed` — открытые формы обновляют
 * тексты без перезагрузки страницы.
 * ***************************************************************************
 */
export class I18n {

    /** Ключ сохранённого выбора языка в localStorage. */
    private static readonly STORAGE_KEY = "kodme_lang";

    /** Доступные локали: код языка → дерево строк (en подключается позже). */
    private static readonly RESOURCES: Record<string, LocaleTree> & { ru: LocaleTree } = { ru };

    /** Текущий язык (после init — сохранённый или определённый по браузеру). */
    private static _language = "ru";

    /**
     * ***************************************************************************
     * Инициализация сервиса: выбор языка и подключение ресурсов.
     * @returns Промис инициализации.
     * ***************************************************************************
     */
    static async init(): Promise<void> {

        const language = this.resolveLanguage();
        await this.ensureLanguage(language);

        await i18next.init({
            lng: language,
            fallbackLng: "ru",
            resources: this.buildResources(),
            interpolation: { escapeValue: false },
            returnEmptyString: false,
            parseMissingKeyHandler: (key, _defaultValue, options) => {
                // В лог — язык и count: без них причина промаха не диагностируется
                const count = typeof options?.count === "number" ? options.count : "-";
                Logger.warn(`[i18n]: ключ локали не найден: ${key} (язык: ${i18next.language}, count: ${count})`);
                return key;
            }
        });

        this._language = language;
        Logger.debug(`[i18n]: инициализация, язык ${language}`);

    }

    /**
     * ***************************************************************************
     * Гарантирует, что локаль подключена: лениво загружает её чанк,
     * если она ещё не в ресурсах.
     * @param {string} language - Код языка из LOADERS.
     * @returns Промис подключения.
     * ***************************************************************************
     */
    private static async ensureLanguage(language: string): Promise<void> {

        if (language in this.RESOURCES) return;

        const loader = LOADERS[language];
        if (!loader) return;

        const mod = await loader();
        this.registerLanguage(language, mod.default);

    }

    /**
     * ***************************************************************************
     * Подключает локаль после инициализации (для лениво загружаемых JSON).
     * @param {string} language - Код языка.
     * @param {LocaleTree} tree - Дерево строк локали.
     * @returns void
     * ***************************************************************************
     */
    static registerLanguage(language: string, tree: LocaleTree): void {

        // Только дерево в ресурсы: цепочный addResourceBundle i18next
        // назначает внутри init() — вызов до инициализации падал
        // («addResourceBundle is not a function» и мёртвая страница при
        // стартовом языке en). До init ресурсы уходят в i18next.init
        // через buildResources, после — в changeLanguage
        this.RESOURCES[language] = tree;
        Logger.debug(`[i18n]: локаль подключена: ${language}`);

    }

    /**
     * ***************************************************************************
     * Переключает язык в реальном времени: ресурсы меняются сразу, выбор
     * сохраняется, рассылается событие `[app][locale]::changed`.
     * @param {string} language - Код языка из подключённых локалей.
     * @returns Промис переключения.
     * ***************************************************************************
     */
    static async changeLanguage(language: string): Promise<void> {

        if (!(language in LOADERS)) {
            Logger.warn(`[i18n]: язык не поддерживается: ${language}`);
            return;
        }

        if (language === this._language) return;

        await this.ensureLanguage(language);

        // Цепочный addResourceBundle доступен только после init(); до
        // инициализации дерево уже ушло в i18next через buildResources
        const tree = this.RESOURCES[language];
        if (i18next.isInitialized && tree) {
            i18next.addResourceBundle(language, "translation", tree, true, true);
        }

        // Индекс старого языка — до переключения: DOM ещё написан им
        const previousLanguage = this._language;
        await i18next.changeLanguage(language);
        this._language = language;

        try {
            globalThis.localStorage?.setItem(this.STORAGE_KEY, language);
        } catch {
            // Хранилище недоступно (приватный режим) — выбор не сохраняем
        }

        // Обновляем открытые экраны на месте — без пересборки форм
        this.refresh(previousLanguage);
        this.dispatchChanged();
        Logger.debug(`[i18n]: язык изменён на ${language}`);

    }

    /** Текущий язык. */
    static get language(): string {
        return this._language;
    }

    /**
     * ***************************************************************************
     * Дерево строк текущего языка — доступ к значениям-объектам и массивам
     * (строки берутся через t()).
     * @returns Дерево строк локали.
     * ***************************************************************************
     */
    static get tree(): LocaleTree {
        return this.RESOURCES[this._language] ?? this.RESOURCES.ru;
    }

    /**
     * ***************************************************************************
     * Определяет язык: сохранённый выбор → navigator.language → ru.
     * @returns Код подключённого языка.
     * ***************************************************************************
     */
    private static resolveLanguage(): string {

        const stored = this.readStoredLanguage();
        if (stored) return stored;

        const browser = typeof navigator === "undefined" ? null : navigator.language;
        const short = browser ? browser.split("-")[0]?.toLowerCase() ?? null : null;
        if (short && short in LOADERS) return short;

        return "ru";

    }

    /**
     * ***************************************************************************
     * Читает сохранённый выбор языка из localStorage.
     * @returns Код языка либо null (нет записи или язык не подключён).
     * ***************************************************************************
     */
    private static readStoredLanguage(): string | null {

        try {
            const stored = globalThis.localStorage?.getItem(this.STORAGE_KEY);
            return stored && stored in LOADERS ? stored : null;
        } catch {
            // Хранилище недоступно — определяем язык по браузеру
            return null;
        }

    }

    /**
     * ***************************************************************************
     * Собирает ресурсы i18next: { <код>: { translation: <дерево> } }.
     * @returns Ресурсы для init.
     * ***************************************************************************
     */
    private static buildResources(): Record<string, { translation: LocaleTree }> {

        const resources: Record<string, { translation: LocaleTree }> = {};
        for (const [code, tree] of Object.entries(this.RESOURCES)) {
            resources[code] = { translation: tree };
        }
        return resources;

    }

    /**
     * ***************************************************************************
     * Составной счётчик «N слово»: текст считается по ключу и count, ключ и
     * число пишутся в атрибуты — refresh пересчитывает по ним, а не по
     * обратному поиску. Обратный поиск для таких строк неоднозначен: слово
     * «участник» живёт в нескольких ключах с разным переводом (participant
     * у конференций vs member у сообществ и сообщений).
     * @param {Element} element - Элемент счётчика.
     * @param {string} key - Ключ множественной формы.
     * @param {number} count - Число.
     * @returns void
     * ***************************************************************************
     */
    static setCount(element: Element, key: string, count: number): void {

        // Режимы взаимоисключаемы: отметки даты на этом элементе устарели
        element.removeAttribute("data-i18n-time");
        element.removeAttribute("data-i18n-timefmt");
        element.removeAttribute("data-i18n-timeprefix");
        element.removeAttribute("data-i18n-timeempty");

        element.setAttribute("data-i18n-key", key);
        element.setAttribute("data-i18n-count", String(count));
        element.textContent = this.renderCount(key, count);

    }

    /**
     * ***************************************************************************
     * Дата/время с пересборкой при смене языка: исходная метка, режим и
     * ключи-префикс/пустота хранятся в атрибутах — refresh пересобирает
     * строку через Intl на новой локали. Обратный поиск такое не чинит:
     * «перевод + отформатированная дата» — составная строка.
     * @param {Element} element - Элемент со временем.
     * @param {string | number | Date | null} date - Метка времени.
     * @param {DisplayType} [displayType] - Режим форматтера (по умолчанию «telegram»).
     * @param {string} [prefixKey] - Ключ-префикс перед датой («Был(а)»).
     * @param {string} [emptyKey] - Ключ, если даты нет («Не в сети»).
     * @returns void
     * ***************************************************************************
     */
    static setTime(
        element: Element,
        date: string | number | Date | null | undefined,
        displayType?: DisplayType,
        prefixKey?: string,
        emptyKey?: string
    ): void {

        // Режимы взаимоисключаемы: отметки счётчика на этом элементе устарели
        element.removeAttribute("data-i18n-key");
        element.removeAttribute("data-i18n-count");

        element.setAttribute("data-i18n-time", date ? String(date) : "");
        if (displayType) element.setAttribute("data-i18n-timefmt", displayType);
        if (prefixKey) element.setAttribute("data-i18n-timeprefix", prefixKey);
        if (emptyKey) element.setAttribute("data-i18n-timeempty", emptyKey);

        element.textContent = this.renderTime(date, displayType, prefixKey, emptyKey);

    }

    /**
     * ***************************************************************************
     * Уже переведённый статичный текст: снимает отметки других режимов —
     * сам текст при смене языка обновит обратный поиск refresh.
     * @param {Element} element - Элемент.
     * @param {string} text - Готовый текст.
     * @returns void
     * ***************************************************************************
     */
    static setPlain(element: Element, text: string): void {

        element.removeAttribute("data-i18n-time");
        element.removeAttribute("data-i18n-timefmt");
        element.removeAttribute("data-i18n-timeprefix");
        element.removeAttribute("data-i18n-timeempty");
        element.removeAttribute("data-i18n-key");
        element.removeAttribute("data-i18n-count");

        element.textContent = text;

    }

    /**
     * ***************************************************************************
     * Строка времени на текущем языке: форматтер (Intl) + префикс/пустота
     * из ключей локали.
     * @param {string | number | Date | null | undefined} date - Метка времени.
     * @param {DisplayType} [displayType] - Режим форматтера.
     * @param {string} [prefixKey] - Ключ-префикс.
     * @param {string} [emptyKey] - Ключ для пустой даты.
     * @returns Отформатированная строка.
     * ***************************************************************************
     */
    private static renderTime(
        date: string | number | Date | null | undefined,
        displayType?: DisplayType,
        prefixKey?: string,
        emptyKey?: string
    ): string {

        const tree = this.RESOURCES[this._language] ?? this.RESOURCES.ru;
        let text = new TimeAgoFormatter(date, displayType).formattedTime;

        if (!text && emptyKey && tree) {
            text = applyTranslation(this._language, tree, { kind: "exact", key: emptyKey }) ?? "";
        }

        if (prefixKey && tree) {
            const prefix = applyTranslation(this._language, tree, { kind: "exact", key: prefixKey });
            if (prefix) text = `${prefix} ${text}`;
        }

        return text;

    }

    /**
     * ***************************************************************************
     * Строка счётчика «N слово» на текущем языке: берётся из дерева локали
     * напрямую — ключ приходит из атрибута (динамический), а t() типами
     * принимает только литеральные ключи.
     * @param {string} key - Ключ множественной формы.
     * @param {number} count - Число.
     * @returns Строка вида «5 файлов» (с ключом-запасной при промахе).
     * ***************************************************************************
     */
    private static renderCount(key: string, count: number): string {

        const tree = this.RESOURCES[this._language] ?? this.RESOURCES.ru;
        if (!tree) return `${count} ${key}`;

        return applyTranslation(this._language, tree, { kind: "plural", baseKey: key, count })
            ?? `${count} ${key}`;

    }

    /**
     * ***************************************************************************
     * Список доступных языков для переключателя: код и имя из locale_name.
     * Локали подключаются лениво — имя читается после загрузки чанка.
     * @returns Промис списка языков.
     * ***************************************************************************
     */
    static async languages(): Promise<I18nLanguage[]> {

        const result: I18nLanguage[] = [];

        for (const code of Object.keys(LOADERS)) {
            await this.ensureLanguage(code);
            const name = this.RESOURCES[code]?.locale_name;
            if (name) result.push({ code, name });
        }

        return result;

    }

    /**
     * ***************************************************************************
     * Живое обновление открытых экранов после смены языка: обход текстовых
     * узлов и атрибутов, строка языка A → ключ → перевод на язык B.
     * Без пересборки форм: меняется только текст.
     * @param {string} previousLanguage - Язык, на котором написан DOM.
     * @returns void
     * ***************************************************************************
     */
    static refresh(previousLanguage: string): void {

        if (typeof document === "undefined") return; // окружение без DOM (тесты)

        const previousTree = this.RESOURCES[previousLanguage];
        const targetTree = this.RESOURCES[this._language];
        if (!previousTree || !targetTree) return;

        // Нечего обходить
        if (!document.body) return;

        const index = buildLanguageIndex(previousTree);
        const language = this._language;

        const swap = (text: string): string | null => {
            const match = matchTranslation(index, text);
            return match ? applyTranslation(language, targetTree, match) : null;
        };

        // Помеченные счётчики пересчитываются по СВОЕМУ ключу — обратный
        // поиск для «число + слово» неоднозначен. Условие «текст ещё
        // начинается с числа»: элемент могли перезаписать другим контентом
        // (тот же subtitle показывает и «В сети»)
        const rebuilt = new Set<HTMLElement>();
        document.querySelectorAll<HTMLElement>("[data-i18n-count]").forEach((element) => {
            const key = element.getAttribute("data-i18n-key");
            const count = Number(element.getAttribute("data-i18n-count"));
            if (!key || !Number.isFinite(count)) return;
            if (!element.textContent?.startsWith(`${count} `)) return;
            const text = applyTranslation(language, targetTree, { kind: "plural", baseKey: key, count });
            if (text === null) return;
            element.textContent = text;
            rebuilt.add(element);
        });

        // Даты/время пересобираются по сохранённой метке: составные строки
        // «перевод + дата» обратный поиск не чинит
        document.querySelectorAll<HTMLElement>("[data-i18n-time]").forEach((element) => {
            const rawType = element.getAttribute("data-i18n-timefmt");
            // invariant: атрибуты пишет только setTime — значение из DisplayType
            const displayType = rawType ? rawType as DisplayType : undefined;
            element.textContent = this.renderTime(
                element.getAttribute("data-i18n-time"),
                displayType,
                element.getAttribute("data-i18n-timeprefix") ?? undefined,
                element.getAttribute("data-i18n-timeempty") ?? undefined
            );
        });

        // Текстовые узлы (SCRIPT/STYLE не трогаем — это не интерфейс)
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let node = walker.nextNode();
        while (node) {
            const parent = node.parentElement;
            const tag = parent?.tagName;
            // Узлы внутри пересчитанных счётчиков не трогаем: у них свой ключ
            const holder = parent?.closest<HTMLElement>("[data-i18n-count]");
            const skipCount = holder ? rebuilt.has(holder) : false;
            if (node.nodeValue?.trim() && tag !== "SCRIPT" && tag !== "STYLE" && !skipCount) {
                const next = swap(node.nodeValue);
                if (next !== null) node.nodeValue = next;
            }
            node = walker.nextNode();
        }

        // Атрибуты: placeholder, title, aria-label и т.п.
        for (const attr of TRANSLATED_ATTRS) {
            document.querySelectorAll<HTMLElement>(`[${attr}]`).forEach((element) => {
                const value = element.getAttribute(attr);
                if (!value) return;
                const next = swap(value);
                if (next !== null) element.setAttribute(attr, next);
            });
        }

        Logger.debug(`[i18n]: тексты обновлены: ${previousLanguage} → ${language}`);

    }

    /**
     * ***************************************************************************
     * Рассылает событие смены языка для перерисовки открытого UI.
     * @returns void
     * ***************************************************************************
     */
    private static dispatchChanged(): void {

        if (typeof window === "undefined") return; // окружение без DOM (тесты)

        window.dispatchEvent(new CustomEvent("[app][locale]::changed", {
            detail: { language: this._language }
        }));

    }

}

/**
 * ***************************************************************************
 * Перевод по ключу (путь из locales/<язык>.json, например
 * «forms.search.states.not_found»). Пути ключей проверяются tsc.
 * @param {string | string[]} key - Путь ключа перевода.
 * @param options - Параметры подстановки и плурала (count и др.).
 * @returns Локализованная строка.
 * ***************************************************************************
 */
export const t = i18next.t;
