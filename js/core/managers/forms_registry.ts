// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";

/**
 * Роль слоя в системе открытых форм (как сущность живёт в интерфейсе):
 * - `workspace` — корневая форма рабочего места (имеет пилюлю);
 * - `pane`      — форма-панель раскладки рабочего места (спутник);
 * - `stack`     — вложенная форма в стеке панели;
 * - `attached`  — прикреплена к слою home вне рабочих мест;
 * - `dialog`    — модалка/поповер (слой диалогов, пилюль нет).
 */
export type FormPlacement = "workspace" | "pane" | "stack" | "attached" | "dialog";

/**
 * Запись реестра открытых форм: всё, что нужно знать о слое, чтобы
 * управлять его видимостью, контейнером и родством.
 */
export interface FormEntry {

    /** Id записи: осмысленный (channelId, castId) либо id оверлея. */
    id: string;

    /** Экземпляр слоя (Overlay); по нему живёт ссылочная идентичность. */
    instance: object;

    /** Форма-владелец слоя (экземпляр формы для запросов к ней). */
    owner?: object | null;

    /** Контейнер слоя в DOM (wrap); запись живёт, пока он смонтирован. */
    wrap?: HTMLElement | null;

    /** Контент слоя в DOM: точка монтирования вложенных форм. */
    content?: HTMLElement | null;

    /** Роль слоя в системе открытых форм. */
    placement: FormPlacement;

    /** Родительский контейнер (панель, form-container, .left) — где лежит слой. */
    container?: HTMLElement | null;

    /** Id записи-родителя (для вложенных форм и панелей). */
    parent?: string | null;

    /** Id рабочего места, которому принадлежит слой. */
    workspace?: string | null;

    /** URL слоя для интеграции с историей навигации. */
    url?: string | null;

    /** Заголовок слоя (пилюли, заголовки окон). */
    title?: string | null;

    /** Подпись слоя (пилюли). */
    subtitle?: string | null;

}

/** Наблюдатель событий реестра. */
export type FormsRegistryListener = (entry: FormEntry) => void;

/** Имена событий реестра. */
export type FormsRegistryEvent = "registered" | "updated" | "unregistered" | "raised";

/**
 * ***************************************************************************
 * FORMS_REGISTRY - единый реестр открытых форм (данные об открытом).
 * ***************************************************************************
 *
 * Источник истины о том, что сейчас открыто: каждая открытая сущность
 * (форма, модалка, поповер) зарегистрирована здесь со своей ролью
 * (`placement`), контейнером, родителем и рабочим местом.
 *
 * Порядок в реестре — это порядок слоёв: последняя запись — самый верхний
 * слой (только он реагирует на Escape). Порядок совпадает с порядком в DOM:
 * у слоёв одинаковый z-index, поэтому выше стоит смонтированный позже.
 *
 * Кто чем владеет:
 * - этот реестр — данные об открытом;
 * - LayoutManager (раскладки) — видимость контейнеров рабочих мест;
 * - TabsManager (пилюли) — только отображение пилюль.
 * ***************************************************************************
 */
export class FormsRegistry {

    /** Записи реестра: последняя — самый верхний слой. */
    private static _entries: FormEntry[] = [];

    /** Наблюдатели событий по именам. */
    private static _listeners: Record<string, FormsRegistryListener[]> = {};

    /**
     * ***************************************************************************
     * Регистрирует слой и делает его самым верхним. Повторная регистрация
     * того же экземпляра обновляет запись и поднимает её наверх (без дублей).
     * @param {FormEntry} entry - Запись реестра.
     * ***************************************************************************
     */
    static register(entry: FormEntry): void {
        if (!entry || !entry.instance) return;

        // Один слой — одна запись: дедуп и по экземпляру, и по id (запись
        // может быть создана раньше монтирования слоя). Перерегистрация
        // обновляет служебные поля, но не сбрасывает участие в оболочке
        // (роль, заголовки) — его задают update/addTab
        const existing = this.get(entry.id) ?? this.getByInstance(entry.instance);
        if (existing) {
            existing.instance = entry.instance;
            if (entry.wrap) existing.wrap = entry.wrap;
            if (entry.container !== undefined) existing.container = entry.container;
            if (entry.parent !== undefined) existing.parent = entry.parent;
            if (entry.url !== undefined) existing.url = entry.url;
            this.raise(existing.instance);
            this._emit("updated", existing);
            return;
        }

        this._entries.push(entry);
        this._emit("registered", entry);
    }

    /**
     * ***************************************************************************
     * Обновляет поля записи (например, заголовок пилюли) и рассылает
     * событие `updated`. Запись должна быть зарегистрирована.
     * @param {string} id - Id записи.
     * @param {Partial<FormEntry>} patch - Изменяемые поля.
     * ***************************************************************************
     */
    static update(id: string, patch: Partial<FormEntry>): void {
        const entry = this.get(id);
        if (!entry) {
            Logger.warn(`[app][forms-registry]: Запись "${id}" не найдена — обновлять нечего.`);
            return;
        }

        // Id записи неизменяем: смена id живёт через unregister + register
        const safePatch: Partial<FormEntry> = { ...patch };
        delete safePatch.id;
        Object.assign(entry, safePatch);
        this._emit("updated", entry);
    }

    /**
     * ***************************************************************************
     * Убирает слой из реестра.
     * @param {string | object} ref - Id записи либо экземпляр слоя.
     * ***************************************************************************
     */
    static unregister(ref: string | object): void {
        const entry = this._resolve(ref);
        if (!entry) return;

        this._entries = this._entries.filter((item) => item !== entry);
        this._emit("unregistered", entry);
    }

    /**
     * ***************************************************************************
     * Поднимает слой наверх (например, при активации формы). Если слоя в
     * реестре нет — ничего не делает: он не смонтирован.
     * @param {string | object} ref - Id записи либо экземпляр слоя.
     * ***************************************************************************
     */
    static raise(ref: string | object): void {
        const entry = this._resolve(ref);
        if (!entry || !this._entries.includes(entry)) return;

        this._entries = this._entries.filter((item) => item !== entry);
        this._entries.push(entry);
        this._emit("raised", entry);
    }

    /**
     * ***************************************************************************
     * Возвращает запись по id.
     * @param {string} id - Id записи.
     * @returns {FormEntry | undefined} - Запись либо undefined.
     * ***************************************************************************
     */
    static get(id: string): FormEntry | undefined {
        return this._entries.find((entry) => entry.id === id);
    }

    /**
     * ***************************************************************************
     * Возвращает запись по экземпляру слоя.
     * @param {object} instance - Экземпляр слоя.
     * @returns {FormEntry | undefined} - Запись либо undefined.
     * ***************************************************************************
     */
    static getByInstance(instance: object): FormEntry | undefined {
        return this._entries.find((entry) => entry.instance === instance);
    }

    /**
     * ***************************************************************************
     * Закрывает слой записи, если он закрывается сам.
     * @param {string} id - Id записи.
     * ***************************************************************************
     */
    static closeLayer(id: string): void {
        const entry = this.get(id);
        if (!entry) return;
        if ("close" in entry.instance && typeof entry.instance.close === "function") {
            void entry.instance.close();
        }
    }

    /**
     * ***************************************************************************
     * Возвращает форму-владельца записи.
     * @param {string} id - Id записи.
     * @returns {T | undefined} - Форма-владелец либо undefined.
     * ***************************************************************************
     */
    static getOwner<T extends object>(id: string): T | undefined {
        // invariant: владелец записи — форма класса T, заданная при её открытии
        // invariant: владелец записи — форма класса T, заданная при её открытии
        return (this.get(id)?.owner ?? undefined) as T | undefined;
    }

    /**
     * ***************************************************************************
     * Возвращает все формы-владельцы, чей id начинается с префикса
     * (например, "messages:" — все открытые чаты).
     * @param {string} prefix - Префикс id записей.
     * @returns {T[]} - Формы-владельцы.
     * ***************************************************************************
     */
    static getOwners<T extends object>(prefix: string): T[] {
        return this._entries
            .filter((entry) => entry.id.startsWith(prefix) && entry.owner)
            // invariant: владелец записи — форма класса T, заданная при её открытии
            .map((entry) => entry.owner as T);
    }

    /**
     * ***************************************************************************
     * Есть ли открытые слои с id, начинающимся с префикса.
     * @param {string} prefix - Префикс id записей.
     * @returns {boolean} - true, если такие записи есть.
     * ***************************************************************************
     */
    static hasAny(prefix: string): boolean {
        return this._entries.some((entry) => entry.id.startsWith(prefix));
    }

    /**
     * ***************************************************************************
     * Возвращает запись слоя по его контенту: так вложенная форма находит
     * родителя, в контент которого она монтируется.
     * @param {HTMLElement | null} content - Контент слоя.
     * @returns {FormEntry | undefined} - Запись родителя либо undefined.
     * ***************************************************************************
     */
    static getByContent(content: HTMLElement | null): FormEntry | undefined {
        if (!content) return undefined;
        return this._entries.find((entry) => entry.content === content);
    }

    /**
     * ***************************************************************************
     * Ищет записи по полям (роль, родитель, рабочее место).
     * @param {Partial<Pick<FormEntry, "placement" | "parent" | "workspace">>} query - Поля поиска.
     * @returns {FormEntry[]} - Найденные записи в порядке слоёв.
     * ***************************************************************************
     */
    static find(query: Partial<Pick<FormEntry, "placement" | "parent" | "workspace">>): FormEntry[] {
        return this._entries.filter((entry) => {
            if (query.placement !== undefined && entry.placement !== query.placement) return false;
            if (query.parent !== undefined && entry.parent !== query.parent) return false;
            if (query.workspace !== undefined && entry.workspace !== query.workspace) return false;
            return true;
        });
    }

    /**
     * ***************************************************************************
     * Возвращает детей записи (вложенные формы и панели).
     * @param {string} parentId - Id записи-родителя.
     * @returns {FormEntry[]} - Дочерние записи в порядке слоёв.
     * ***************************************************************************
     */
    static children(parentId: string): FormEntry[] {
        return this._entries.filter((entry) => entry.parent === parentId);
    }

    /**
     * ***************************************************************************
     * Возвращает самый верхний смонтированный слой. Записи без wrap (слой
     * ещё открывается) слоями ещё не являются: им рано ловить Escape.
     * @returns {FormEntry | null} - Верхняя запись либо null.
     * ***************************************************************************
     */
    static top(): FormEntry | null {
        this._prune();
        for (let i = this._entries.length - 1; i >= 0; i--) {
            const entry = this._entries[i];
            if (entry?.wrap?.isConnected === true) return entry;
        }
        return null;
    }

    /**
     * ***************************************************************************
     * Является ли слой верхним в реестре. Только верхний слой имеет право
     * реагировать на Escape.
     * @param {string | object} ref - Id записи либо экземпляр слоя.
     * @returns {boolean} - true, если слой самый верхний.
     * ***************************************************************************
     */
    static isTop(ref: string | object): boolean {
        const top = this.top();
        return !!top && top === this._resolve(ref);
    }

    /**
     * ***************************************************************************
     * Возвращает все записи реестра (снизу вверх).
     * @returns {FormEntry[]} - Копия списка записей.
     * ***************************************************************************
     */
    static layers(): FormEntry[] {
        return [...this._entries];
    }

    /**
     * ***************************************************************************
     * Подписывается на событие реестра.
     * @param {FormsRegistryEvent} event - Имя события.
     * @param {FormsRegistryListener} listener - Наблюдатель.
     * @returns {() => void} - Функция отписки.
     * ***************************************************************************
     */
    static on(event: FormsRegistryEvent, listener: FormsRegistryListener): () => void {
        if (!this._listeners[event]) this._listeners[event] = [];
        this._listeners[event].push(listener);

        return () => {
            const list = this._listeners[event];
            if (!list) return;
            this._listeners[event] = list.filter((item) => item !== listener);
            if (this._listeners[event]?.length === 0) delete this._listeners[event];
        };
    }

    /**
     * ***************************************************************************
     * Полный сброс реестра (например, при перезагрузке приложения).
     * ***************************************************************************
     */
    static clear(): void {
        this._entries = [];
    }

    // --- Private Methods ---

    /**
     * ***************************************************************************
     * Ищет запись по id либо экземпляру.
     * @private
     * @param {string | object} ref - Id записи либо экземпляр слоя.
     * @returns {FormEntry | undefined} - Запись либо undefined.
     * ***************************************************************************
     */
    private static _resolve(ref: string | object): FormEntry | undefined {
        return typeof ref === "string" ? this.get(ref) : this.getByInstance(ref);
    }

    /**
     * ***************************************************************************
     * Убирает из реестра слои, которые уже не смонтированы в DOM. Нужен,
     * чтобы «мёртвый» слой (например, убитый вместе с родителем) не
     * перехватывал Escape и не блокировал всё остальное. Записи без wrap
     * не трогаются: слой ещё не смонтирован, его запись жива.
     * @private
     * ***************************************************************************
     */
    private static _prune(): void {
        this._entries = this._entries.filter((entry) => !entry.wrap || entry.wrap.isConnected === true);
    }

    /**
     * ***************************************************************************
     * Рассылает событие наблюдателям.
     * @private
     * @param {FormsRegistryEvent} event - Имя события.
     * @param {FormEntry} entry - Запись-нагрузка события.
     * ***************************************************************************
     */
    private static _emit(event: FormsRegistryEvent, entry: FormEntry): void {
        const list = this._listeners[event];
        if (!list) return;
        list.forEach((listener) => {
            try {
                listener(entry);
            } catch (error) {
                Logger.error(error);
            }
        });
    }

}
