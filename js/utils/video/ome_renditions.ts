// Импортируем utils
import { Logger } from "../logs/logger.js";

// Импортируем типы
import type { StreamRendition } from "../../forms/broadcast-play/types.js";

/**
 * ***************************************************************************
 * Адаптер вариантов качества WebRTC-воспроизведения под модель Video.js.
 *
 * Контракт повторяет `HlsLevelsRenditions` и `FileRenditions`, чтобы видеоплеер
 * не различал источники: Video.js показывает меню «Качество», только когда у
 * медиаэлемента есть `videoRenditions` (см. attachRenditions в video_player).
 *
 * Список приходит с сервера (ответ "[broadcast]: get stream info" — рендеринги
 * плейлиста `rtc` из OvenMediaEngine). Выбор пункта переключает качество на
 * сервере командой `change_rendition` WebSocket-сигналинга OME — через
 * колбэк, переданный в конструктор.
 *
 * Контракт, который ждёт Video.js:
 *   - `length` + итерация (`[...list]`);
 *   - у каждого: `id`, `label`, `width`, `height`, `bitrate`, `frameRate`,
 *     `selected`, `active`;
 *   - `selectedIndex` (get/set);
 *   - события `addrendition`, `change`, `activechange` (от EventTarget).
 * ***************************************************************************
 */

/**
 * Параметры конструктора адаптера OmeRenditions.
 */
export interface OmeRenditionsOptions {

    /** Варианты качества из ответа сервера. */
    renditions: StreamRendition[];

    /**
     * Выбор варианта на сервере.
     * @param name - Имя рендеринга в OME (source, 720p, 480p).
     * @returns void
     */
    onSelect: (name: string) => void;

    /** Индекс варианта, отдаваемого сервером сейчас (по умолчанию 0 — source). */
    activeIndex?: number;

}

/**
 * ***************************************************************************
 * OmeRenditions - адаптер вариантов качества для меню Video.js.
 *
 * Повторяет контракт `HlsLevelsRenditions`/`FileRenditions`, чтобы плеер
 * не различал источники. Выбор пункта переключает качество через
 * колбэк `onSelect`, переданный в конструктор.
 * ***************************************************************************
 */
export class OmeRenditions extends EventTarget {

    /** Варианты качества (копия списка из ответа сервера). */
    private _items: StreamRendition[];

    /** Колбэк выбора варианта на сервере. */
    private _onSelect: (name: string) => void;

    /** Индекс выбранного варианта. */
    private _selectedIndex: number;

    /** Флаг уничтожения: поздние колбэки не трогают мёртвый адаптер. */
    private _destroyed = false;

    /**
     * ***************************************************************************
     * Создание адаптера вариантов качества.
     * @param {OmeRenditionsOptions} options - Список рендерингов и колбэк выбора.
     * ***************************************************************************
     */
    constructor(options: OmeRenditionsOptions) {

        // EventTarget обязателен: Video.js подписывается на события списка
        super();

        this._items = options.renditions;
        this._onSelect = options.onSelect;
        this._selectedIndex = options.activeIndex ?? 0;

        // Первое событие — чтобы Video.js построил меню сразу после attach
        queueMicrotask(() => this._emit("addrendition"));

    }

    /**
     * ***************************************************************************
     * Количество вариантов качества.
     * @returns {number}
     * ***************************************************************************
     */
    get length(): number {
        return this._items.length;
    }

    /**
     * ***************************************************************************
     * Индекс выбранного варианта.
     * @returns {number}
     * ***************************************************************************
     */
    get selectedIndex(): number {
        return this._selectedIndex;
    }

    /**
     * ***************************************************************************
     * Установка выбранного варианта — вызывается из меню Video.js.
     * @param {number} value - Индекс варианта.
     * ***************************************************************************
     */
    set selectedIndex(value: number) {

        if (this._destroyed) return;

        const index = Number(value);
        if (!Number.isInteger(index) || index < 0 || index >= this._items.length) return;

        const selected = this._items[index];
        if (!selected) return;

        const already = index === this._selectedIndex;
        this._selectedIndex = index;

        // Переключение на сервер — только при реальной смене варианта
        if (!already) {
            try {
                this._onSelect(selected.name);
            } catch (error) {
                Logger.warn("[broadcast-play][renditions] не удалось переключить качество:", error);
            }
        }

        this._emit("activechange");
        this._emit("change");

    }

    /**
     * ***************************************************************************
     * Возвращает вариант по индексу (аналог LevelList.item в hls.js).
     * @param {number} index - Индекс варианта.
     * @returns Объект rendition или null.
     * ***************************************************************************
     */
    item(index: number): VideojsRendition | null {

        const rendition = this._items[index];
        if (!rendition) return null;

        const isSelected = this._selectedIndex === index;

        return {
            id: String(index),
            width: rendition.width ?? undefined,
            height: rendition.height ?? undefined,
            bitrate: rendition.bitrate ?? undefined,
            frameRate: rendition.frameRate ?? undefined,
            selected: isSelected,
            active: isSelected
        };

    }

    /**
     * ***************************************************************************
     * Числовой доступ к варианту: `list[1]`.
     * @param {number} index - Индекс варианта.
     * @returns Объект rendition или null.
     * ***************************************************************************
     */
    itemAt(index: number): VideojsRendition | null {
        return this.item(index);
    }

    /**
     * ***************************************************************************
     * Итерация по вариантам — Video.js разворачивает список через spread.
     * @returns Генератор rendition'ов.
     * ***************************************************************************
     */
    *[Symbol.iterator](): Generator<VideojsRendition | null> {
        for (let index = 0; index < this.length; index++) {
            yield this.item(index);
        }
    }

    /**
     * ***************************************************************************
     * Принудительная синхронизация списка (часть контракта адаптера):
     * сообщает Video.js, что данные изменились.
     * @returns void
     * ***************************************************************************
     */
    sync(): void {
        this._emit("change");
    }

    /**
     * ***************************************************************************
     * Обновляет список вариантов (ответ сервера мог прийти уже после attach).
     * @param {StreamRendition[]} renditions - Новый список вариантов.
     * @returns void
     * ***************************************************************************
     */
    update(renditions: StreamRendition[]): void {

        if (this._destroyed) return;

        this._items = renditions;

        // Выбранного варианта может больше не быть — берём первый
        if (this._selectedIndex >= renditions.length) {
            this._selectedIndex = 0;
        }

        this._emit("change");

    }

    /**
     * ***************************************************************************
     * Помечает вариант как активный (сервер отдаёт его сейчас).
     * @param {number} index - Индекс активного варианта.
     * @returns void
     * ***************************************************************************
     */
    setActive(index: number): void {

        if (this._destroyed || index === this._selectedIndex) return;

        this._selectedIndex = index;
        this._emit("activechange");

    }

    /**
     * ***************************************************************************
     * Отправка события подписчикам (Video.js).
     * @param {string} name - Имя события.
     * @returns void
     * ***************************************************************************
     */
    private _emit(name: string): void {

        if (this._destroyed) return;

        try {
            this.dispatchEvent(new Event(name));
        } catch (error) {
            Logger.warn(`[broadcast-play][renditions] ошибка события ${name}:`, error);
        }

    }

    /**
     * ***************************************************************************
     * Уничтожение адаптера: снимает флаг и рассылает финальное событие,
     * чтобы Video.js убрал пункт меню.
     * @returns void
     * ***************************************************************************
     */
    destroy(): void {

        if (this._destroyed) return;
        this._destroyed = true;
        this.dispatchEvent(new Event("removerendition"));

    }

}
