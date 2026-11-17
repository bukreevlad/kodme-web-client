// Импортируем utils
import { Logger } from "./logs/logger.js";
import { KEYS_TO_REMOVE } from "./helpers/clean_store_data.js";

/**
 * Идентификатор элемента хранилища: строки (UUID v7) или числа.
 */
export type StoreId = string | number;

/**
 * Элемент хранилища: обязан содержать id, остальные поля произвольные.
 */
export interface StoreItem {
    /** Идентификатор элемента — по нему живут события обновления. */
    id: StoreId;
    [key: string]: unknown;
}

/**
 * Опции добавления элемента.
 */
export interface StoreAddOptions {
    /** Не обновлять границы (minId/maxId) при добавлении. */
    ignoreBounds?: boolean;
}

/**
 * Опции удаления всех элементов.
 */
export interface StoreRemoveAllOptions {
    /** Не эмитить события item::removed при удалении. */
    silent?: boolean;
}

/**
 * Опции получения элементов.
 */
export interface StoreGetAllOptions {
    /** Отсортировать элементы по id. */
    sort?: boolean;
}

/**
 * Событие замены идентификатора элемента (payload события
 * `item::id-changed::<старый id>`).
 */
export interface StoreIdChange {
    /** Старый идентификатор. */
    oldId: StoreId;
    /** Новый идентификатор. */
    newId: StoreId;
    /** Сам элемент. */
    item: StoreItem;
}

/**
 * Подписчик события хранилища. Payload честно `unknown`: хранилище
 * гетерогенно (в разных формах лежат разные сущности), сужение — на
 * стороне подписчика.
 */
export type StoreCallback = (payload: unknown, options?: StoreAddOptions) => void;

/**
 * Имена событий хранилища: базовые и динамические (по id элемента).
 */
export type StoreEventName =
    | "item::added"
    | "item::removed"
    | `item::updated::${string}`
    | `item::id-changed::${string}`;

/**
 * Сравнение идентификаторов как в операторе `<` у исходного кода:
 * числа сравниваются численно, всё остальное — по строковому
 * представлению (смешанные типы JS приводит к строке).
 * @param a - Первый идентификатор.
 * @param b - Второй идентификатор.
 * @returns - Отрицательное, ноль или положительное число.
 */
function compareIds(a: StoreId, b: StoreId): number {
    if (typeof a === "number" && typeof b === "number") {
        return a < b ? -1 : a > b ? 1 : 0;
    }

    const left = String(a);
    const right = String(b);
    return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * ***************************************************************************
 * Store: Хранилище с O(1) доступом и реактивными событиями.
 *
 * DOM-копии строк и их подписки живут в реестрах стора, а не в записях:
 * запись может быть общей для нескольких сторов, и стор снимает только
 * свои копии.
 * ***************************************************************************
 */
export class Store<T extends StoreItem = StoreItem> {

    /** Элементы хранилища по id. */
    items = new Map<StoreId, T>();

    /** Реестр подписчиков по имени события. */
    listeners: Record<string, StoreCallback[]> = {};

    /** DOM-копии строк по id (по одной на открытую папку). */
    private domElements = new Map<StoreId, HTMLElement[]>();

    /** Отписки строк от точечных событий обновления по id. */
    private itemSubscriptions = new Map<StoreId, Array<() => void>>();

    // Крайние ID (используем для лимитов и навигации)
    minId: StoreId | null = null;
    maxId: StoreId | null = null;

    /**
     * ***************************************************************************
     * Возвращает текущее количество элементов в хранилище
     * @returns {number}
     * ***************************************************************************
     */
    get size(): number {
        return this.items.size;
    }

    /**
     * ***************************************************************************
     * Подписывает callback на указанное событие
     * @param event - Название события
     * @param callback - Функция-обработчик события
     * @returns Функция для отписки от события
     * ***************************************************************************
     */
    on(event: StoreEventName, callback: StoreCallback): () => void {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(callback);

        return () => {
            // Проверяем, существует ли еще массив подписчиков для этого события
            if (this.listeners[event]) {
                this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);

                // Дополнительный плюс: если после отписки массив стал пустым, удаляем ключ
                if (this.listeners[event].length === 0) {
                    delete this.listeners[event];
                }
            }
        };
    }

    /**
     * ***************************************************************************
     * Эмитирует событие с переданными данными
     * @param event - Название события
     * @param payload - Данные, передаваемые обработчикам
     * @param options - Дополнительные опции
     * ***************************************************************************
     */
    emit(event: StoreEventName, payload: unknown, options?: StoreAddOptions): void {
        if (this.listeners[event]) {
            this.listeners[event].forEach(cb => cb(payload, options));
        }
    }

    /**
     * ***************************************************************************
     * Добавляет элемент в хранилище
     * @param item - Элемент для добавления (должен содержать поле id)
     * @param options - Опции добавления
     * ***************************************************************************
     */
    add(item: T, options?: StoreAddOptions): void {
        if (!item || item.id === undefined) {
            Logger.error("[app][Store]: Элемент должен содержать ID.", item);
            return;
        }

        this.items.set(item.id, item);

        if (!options?.ignoreBounds) {
            this._updateBoundsWithId(item.id);
        }

        this.emit("item::added", item, options);
    }

    /**
     * ***************************************************************************
     * Обновляет существующий элемент в хранилище
     * @param id - Идентификатор элемента
     * @param changes - Объект с изменениями для элемента
     * ***************************************************************************
     */
    update(id: StoreId, changes: Partial<T>): void {
        const item = this.items.get(id);
        if (item) {

            // Исключаем случайное или намеренное изменение id через update и
            // перенос служебных полей (DOM-состояние, хуки компонентов): они
            // принадлежат форме и пишутся на объект записи напрямую, а их
            // копирование из чужой записи смешивало бы состояние двух форм
            const safeChanges: Partial<StoreItem> = { ...changes };
            delete safeChanges.id;
            for (const key of KEYS_TO_REMOVE) {
                delete safeChanges[key];
            }
            Object.assign(item, safeChanges);

        }
        // Эмитим событие ВСЕГДА.
        // На него среагирует формы, элементы и тд., даже если элемента нет в списке (Map)
        this.emit(`item::updated::${id}`, item);
    }

    /**
     * ***************************************************************************
     * Удаляет элемент из хранилища
     * @param id - Идентификатор элемента для удаления
     * ***************************************************************************
     */
    remove(id: StoreId): void {
        const item = this.items.get(id);
        if (item) {
            this.items.delete(id);

            // Если удалили граничный элемент — пересчитываем
            if (id === this.minId || id === this.maxId) {
                this._recalculateBounds();
            }

            this.emit("item::removed", item);

            // DOM-копии и подписки строки принадлежат стору — снимаем их сами
            this._releaseItem(id, true);

            // Очищаем динамические подписки на этот элемент, чтобы избежать утечек памяти
            if (this.listeners[`item::updated::${id}`]) {
                delete this.listeners[`item::updated::${id}`];
            }
        }
    }

    /**
     * ***************************************************************************
     * Удаляет все элементы из хранилища
     * @param options - Опции удаления
     * ***************************************************************************
     */
    removeAll(options: StoreRemoveAllOptions = {}): void {
        if (this.items.size === 0) return;

        if (!options.silent) {
            // Уведомляем о каждом элементе (для корректного удаления DOM)
            for (const item of this.items.values()) {
                this.emit("item::removed", item);
            }
        }

        // Перед очисткой мапы снимаем DOM-копии, подписки и динамические
        // события каждого элемента. Тихое удаление DOM не трогает — список
        // в этом случае перерисовывает сама форма
        for (const id of this.items.keys()) {
            this._releaseItem(id, !options.silent);
            if (this.listeners[`item::updated::${id}`]) {
                delete this.listeners[`item::updated::${id}`];
            }
        }

        this.items.clear();
        this.minId = null;
        this.maxId = null;

        Logger.debug(`[app][Store]: Хранилище очищено.`);
    }

    /**
     * ***************************************************************************
     * Заменяет идентификатор элемента
     * @param oldId - Старый идентификатор
     * @param newId - Новый идентификатор
     * ***************************************************************************
     */
    replaceId(oldId: StoreId, newId: StoreId): void {
        const item = this.items.get(oldId);
        if (!item) return;

        this.items.delete(oldId);
        item.id = newId;
        this.items.set(newId, item);

        // Если старый ID был границей, проще пересчитать всё,
        // так как мы не знаем, стал ли newId новым экстремумом.
        if (oldId === this.minId || oldId === this.maxId) {
            this._recalculateBounds();
        } else {
            // Если не был — просто пробуем расширить границы
            this._updateBoundsWithId(newId);
        }

        this.emit(`item::id-changed::${oldId}`, { oldId, newId, item } satisfies StoreIdChange);

        // Переносим слушателей динамического события со старого id на новый
        const updatedListeners = this.listeners[`item::updated::${oldId}`];
        if (updatedListeners) {
            this.listeners[`item::updated::${newId}`] = updatedListeners;
            delete this.listeners[`item::updated::${oldId}`];
        }

        // Переносим реестры DOM-копий и подписок строки со старого id на новый
        this._moveItemRegistries(oldId, newId);
    }

    /**
     * ***************************************************************************
     * Регистрирует DOM-копию строки в реестре стора (у записи может быть
     * несколько копий — по одной на открытую папку).
     * @param id - Идентификатор элемента.
     * @param element - DOM-копия строки.
     * ***************************************************************************
     */
    registerDomElement(id: StoreId, element: HTMLElement): void {
        const elements = this.domElements.get(id);
        if (elements) {
            elements.push(element);
        } else {
            this.domElements.set(id, [element]);
        }
    }

    /**
     * ***************************************************************************
     * Снимает одну DOM-копию строки: удаляет элемент из DOM и из реестра
     * стора (например, при переносе канала в другую папку).
     * @param id - Идентификатор элемента.
     * @param element - DOM-копия строки.
     * ***************************************************************************
     */
    removeDomElement(id: StoreId, element: HTMLElement): void {
        const elements = this.domElements.get(id);
        if (elements) {
            const index = elements.indexOf(element);
            if (index !== -1) elements.splice(index, 1);
            if (elements.length === 0) this.domElements.delete(id);
        }
        element.remove();
    }

    /**
     * ***************************************************************************
     * Возвращает DOM-копии строки этого стора.
     * @param id - Идентификатор элемента.
     * @returns Массив DOM-копий (пустой, если копий нет).
     * ***************************************************************************
     */
    getDomElements(id: StoreId): HTMLElement[] {
        return [...(this.domElements.get(id) ?? [])];
    }

    /**
     * ***************************************************************************
     * Запоминает отписку строки от точечного события обновления: отписки
     * вызываются автоматически при удалении элемента (строк у записи может
     * быть несколько — подписка хранится на каждую).
     * @param id - Идентификатор элемента.
     * @param unsubscribe - Функция отписки.
     * ***************************************************************************
     */
    addItemSubscription(id: StoreId, unsubscribe: () => void): void {
        const subscriptions = this.itemSubscriptions.get(id);
        if (subscriptions) {
            subscriptions.push(unsubscribe);
        } else {
            this.itemSubscriptions.set(id, [unsubscribe]);
        }
    }

    /**
     * ***************************************************************************
     * Возвращает все элементы хранилища
     * @param options - Опции получения
     * @returns Массив элементов
     * ***************************************************************************
     */
    getAll(options: StoreGetAllOptions = {}): T[] {
        const items = Array.from(this.items.values());
        if (options.sort) {
            // Стандартная сортировка (хорошо работает для строковых UUID v7)
            items.sort((a, b) => compareIds(a.id, b.id));
        }
        return items;
    }

    /**
     * ***************************************************************************
     * Возвращает элемент по его идентификатору
     * @param id - Идентификатор элемента
     * @returns Найденный элемент или undefined
     * ***************************************************************************
     */
    get(id: StoreId): T | undefined {
        return this.items.get(id);
    }

    // --- Private Methods ---

    /**
     * ***************************************************************************
     * Быстрое обновление границ при добавлении
     * @private
     * @param id - Идентификатор для проверки границ
     * ***************************************************************************
     */
    private _updateBoundsWithId(id: StoreId): void {
        if (this.minId === null || compareIds(id, this.minId) < 0) this.minId = id;
        if (this.maxId === null || compareIds(id, this.maxId) > 0) this.maxId = id;
    }

    /**
     * ***************************************************************************
     * Полный пересчет O(N).
     * Вызывается только при удалении "края".
     * @private
     * ***************************************************************************
     */
    private _recalculateBounds(): void {
        if (this.items.size === 0) {
            this.minId = null;
            this.maxId = null;
            return;
        }

        let min: StoreId | null = null;
        let max: StoreId | null = null;

        for (const id of this.items.keys()) {
            if (min === null || compareIds(id, min) < 0) min = id;
            if (max === null || compareIds(id, max) > 0) max = id;
        }

        this.minId = min;
        this.maxId = max;
    }

    /**
     * ***************************************************************************
     * Снимает DOM-копии элемента и закрывает его подписки.
     * @private
     * @param id - Идентификатор элемента.
     * @param detachDom - Удалить DOM-копии из документа (тихое удаление
     *   оставляет DOM форме, которая перерисовывает список сама).
     * ***************************************************************************
     */
    private _releaseItem(id: StoreId, detachDom: boolean): void {

        // DOM-копии стор снимает сам — они принадлежат стору, а не записи
        const elements = this.domElements.get(id);
        if (elements) {
            this.domElements.delete(id);
            if (detachDom) elements.forEach((element) => element.remove());
        }

        // Подписки строк закрываются вместе с элементом
        const subscriptions = this.itemSubscriptions.get(id);
        if (subscriptions) {
            this.itemSubscriptions.delete(id);
            subscriptions.forEach((unsubscribe) => unsubscribe());
        }

    }

    /**
     * ***************************************************************************
     * Переносит реестры DOM-копий и подписок строки со старого id на новый.
     * @private
     * @param oldId - Старый идентификатор.
     * @param newId - Новый идентификатор.
     * ***************************************************************************
     */
    private _moveItemRegistries(oldId: StoreId, newId: StoreId): void {

        const elements = this.domElements.get(oldId);
        if (elements) {
            this.domElements.delete(oldId);
            this.domElements.set(newId, [...(this.domElements.get(newId) ?? []), ...elements]);
        }

        const subscriptions = this.itemSubscriptions.get(oldId);
        if (subscriptions) {
            this.itemSubscriptions.delete(oldId);
            this.itemSubscriptions.set(newId, [...(this.itemSubscriptions.get(newId) ?? []), ...subscriptions]);
        }

    }

}
