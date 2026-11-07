// Импортируем utils
import { Logger } from "../logs/logger.js";
import { t } from "../i18n/index.js";

/**
 * ***************************************************************************
 * Адаптер переключения качества видео по отдельным MP4-файлам.
 *
 * Заменяет hls_renditions.js (адаптер HLS остался только для живых
 * SRS-трансляций — частный класс в `video_player.js`). HLS удаляется вместе
 * со storage-сервисом: он требовал сотни сегментов на файл и минуты
 * транскодирования на клиенте.
 * Вместо этого сервер отдаёт до трёх целых файлов (360/720/1080), и мы
 * переключаем src.
 *
 * Отличие от hls.js, которое важно: при смене src браузер сбрасывает
 * currentTime, play/pause, playbackRate и volume. Поэтому мы сохраняем
 * их перед сменой и восстанавливаем на событии loadedmetadata, иначе
 * переключение качества сбрасывало бы видео в начало.
 *
 * Контракт тот же, что у HlsRenditions, чтобы плеер не различал:
 * - EventTarget (addEventListener/dispatchEvent)
 * - итерация [Symbol.iterator], length, item/itemAt
 * - selectedIndex (get/set)
 * - selectedHeight (get)
 * - sync(), destroy()
 * ***************************************************************************
 */

/**
 * Вариант качества — строка меню, собранная из целых MP4-файлов рендерации
 * либо пункт «Оригинал».
 */
export interface FileRenditionOption {

    /** Метка качества (360/720/1080 либо «Оригинал»). */
    label: string;

    /** Ширина кадра (у оригинала отсутствует). */
    width?: number | undefined;

    /** URL рендерации. */
    url?: string | null | undefined;

}

/**
 * Rendition, который отдаётся Video.js (контракт меню «Качество»).
 */
export interface FileRenditionItem {

    /** Строковый индекс уровня — ключ сопоставления пункта меню и уровня. */
    id: string;

    /** Метка качества. */
    label?: string;

    /** Ширина кадра в пикселях. */
    width?: number | undefined;

    /** Высота кадра: у целых файлов неизвестна, считает плеер. */
    height?: number | undefined;

    /** Битрейт: у целых файлов не отдаётся. */
    bitrate?: number | undefined;

    /** Частота кадров: не отдаётся. */
    frameRate?: number | undefined;

    /** Кодек: не отдаётся. */
    codec?: string | undefined;

    /** URL файла качества. */
    url?: string | null | undefined;

    /** Выбран ли уровень как активный. */
    selected: boolean;

    /** Активен ли уровень прямо сейчас. */
    active: boolean;

}

/**
 * Опции создания адаптера уровней.
 */
export interface FileRenditionsOptions {

    /** Элемент видео. */
    video?: HTMLVideoElement | null;

    /** Список рендераций `[{ label, width, url }]` из metadata.renditions. */
    renditions?: FileRenditionOption[];

    /** URL оригинала (играется по умолчанию). */
    originalUrl?: string | null;

}

/**
 * Состояние воспроизведения, сохранённое перед сменой src
 * (браузер сбрасывает его при подмене источника).
 */
interface SavedVideoState {

    /** Стояло ли видео на паузе. */
    wasPaused: boolean;

    /** Позиция воспроизведения в секундах. */
    currentTime: number;

    /** Скорость воспроизведения. */
    playbackRate: number;

    /** Громкость (0..1). */
    volume: number;

    /** Выключен ли звук. */
    muted: boolean;

}

export class FileRenditions extends EventTarget {

    /** Ссылка на видеоэлемент. */
    video: HTMLVideoElement | null;

    /** Оригинальный URL. */
    originalUrl: string | null;

    /** Исходный список рендераций. */
    _renditions: FileRenditionOption[];

    /** Построенные варианты качества (рендерации + оригинал). */
    _options: FileRenditionOption[];

    /** Текущий индекс. */
    _selectedIndex: number;

    /** Флаг уничтожения. */
    _destroyed = false;

    /** Флаг, что состояние уже восстановлено для текущего src. */
    _restored = false;

    /** Состояние воспроизведения перед сменой src (null — менять нечего). */
    _lastState: SavedVideoState | null = null;

    /**
     * ***************************************************************************
     * Создание адаптера уровней.
     * @param e - Объект { video, renditions, originalUrl }.
     * ***************************************************************************
     */
    constructor(e: FileRenditionsOptions = {}) {

        super();

        // Ссылка на видеоэлемент
        this.video = e.video || null;

        // Оригинальный URL
        this.originalUrl = e.originalUrl || null;

        // Исходный список рендераций
        this._renditions = Array.isArray(e.renditions) ? e.renditions.slice() : [];

        // Собираем options: сначала рендерации, затем оригинал
        this._options = [];
        for (const r of this._renditions) {
            this._options.push({
                label: r.label,
                width: r.width,
                url: r.url
            });
        }
        this._options.push({
            label: t("utils.file_renditions.original"),
            url: this.originalUrl
        });

        // Текущий индекс
        this._selectedIndex = this._options.length - 1;

        // Обработчик возврата состояния после смены src
        this._onLoadedMetadata = this._onLoadedMetadata.bind(this);

        // Флаг уничтожения
        this._destroyed = false;
        this._restored = false;

        if (this.video) {
            try {
                this.video.addEventListener("loadedmetadata", this._onLoadedMetadata, { once: false });
            } catch (error) {
                Logger.error(error);
            }
        }

        // Подтверждаем список для Video.js
        try {
            this._emit("addrendition");
            this._emit("activechange");
        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Свойства и методы доступа к уровням
    // ***************************************************************************

    /**
     * ***************************************************************************
     * Количество доступных вариантов качества.
     * @returns {number}
     * ***************************************************************************
     */
    get length(): number {
        return this._options.length;
    }

    /**
     * ***************************************************************************
     * Возвращает rendition по индексу.
     * @param {number} index - Индекс.
     * @returns {FileRenditionItem|null}
     * ***************************************************************************
     */
    item(index: number): FileRenditionItem | null {
        const opt = this._options[index];
        if (!opt) return null;
        return this._toRendition(opt, index);
    }

    /**
     * ***************************************************************************
     * Числовой доступ к уровню.
     * @param {number} index - Индекс уровня.
     * @returns {FileRenditionItem|null}
     * ***************************************************************************
     */
    itemAt(index: number): FileRenditionItem | null {
        return this.item(index);
    }

    /**
     * ***************************************************************************
     * Итерация по уровням.
     * @returns {Generator<FileRenditionItem|null>}
     * ***************************************************************************
     */
    *[Symbol.iterator](): Generator<FileRenditionItem | null> {
        for (let index = 0; index < this.length; index++) {
            yield this.item(index);
        }
    }

    /**
     * ***************************************************************************
     * Индекс выбранного уровня.
     * @returns {number}
     * ***************************************************************************
     */
    get selectedIndex(): number {
        return this._selectedIndex;
    }

    /**
     * ***************************************************************************
     * Установка уровня качества.
     * @param {number} value - Индекс уровня.
     * ***************************************************************************
     */
    set selectedIndex(value: number) {
        if (!this.video || this._destroyed) return;

        const index = Math.max(0, Math.min(Number(value) || 0, this._options.length - 1));
        if (index === this._selectedIndex) {
            this._emit("activechange");
            this._emit("change");
            return;
        }

        const nextUrl = this._options[index]?.url;
        if (!nextUrl) return;

        // Сохраняем состояние перед сменой src (браузер сбрасывает его)
        const wasPaused = this.video.paused;
        const currentTime = this.video.currentTime;
        const playbackRate = this.video.playbackRate;
        const volume = this.video.volume;
        const muted = this.video.muted;

        this._lastState = { wasPaused, currentTime, playbackRate, volume, muted };
        this._restored = false;

        try {
            this._selectedIndex = index;
            this.video.src = nextUrl;
            // В некоторых случаях нужно призвать загрузку
            try { this.video.load(); } catch (error) { Logger.error(error); }
        } catch (error) {
            Logger.error(error);
        }

        this._emit("activechange");
        this._emit("change");
    }

    /**
     * ***************************************************************************
     * Высота для расчёта aspect-ratio в интерфейсе.
     * @returns {number|undefined}
     * ***************************************************************************
     */
    get selectedHeight(): number | undefined {
        const opt = this._options[this._selectedIndex];
        return opt?.width ? undefined : (this.video?.videoHeight || undefined);
    }

    /**
     * ***************************************************************************
     * Преобразует вариант качества в rendition Video.js.
     * @param {FileRenditionOption} opt - Опция качества.
     * @param {number} index - Индекс.
     * @returns {FileRenditionItem}
     * ***************************************************************************
     */
    _toRendition(opt: FileRenditionOption, index: number): FileRenditionItem {
        const isSelected = this.selectedIndex === index;
        return {
            id: String(index),
            label: opt.label,
            width: opt.width || undefined,
            height: undefined,
            bitrate: undefined,
            frameRate: undefined,
            codec: undefined,
            url: opt.url,
            selected: isSelected,
            active: isSelected
        };
    }

    /**
     * ***************************************************************************
     * Восстанавливаем состояние после смены src.
     * @returns {void}
     * ***************************************************************************
     */
    _onLoadedMetadata(): void {
        if (this._destroyed || this._restored || !this._lastState || !this.video) return;
        const st = this._lastState;
        try {
            if (this.video.readyState >= 1) {
                if (st.currentTime !== undefined && !isNaN(st.currentTime)) {
                    this.video.currentTime = st.currentTime;
                }
            }
        } catch (error) { Logger.error(error); }

        try {
            this.video.playbackRate = st.playbackRate;
        } catch (error) { Logger.error(error); }

        try {
            this.video.volume = st.volume;
            this.video.muted = st.muted;
        } catch (error) { Logger.error(error); }

        if (!st.wasPaused) {
            try { this.video.play().catch(() => {}); } catch (error) { Logger.error(error); }
        }

        this._restored = true;
    }

    /**
     * ***************************************************************************
     * Безопасная отправка события.
     * @param {string} type - Имя события.
     * @returns {void}
     * ***************************************************************************
     */
    _emit(type: string): void {
        if (this._destroyed) return;
        try { this.dispatchEvent(new Event(type)); } catch (error) { }
    }

    /**
     * ***************************************************************************
     * Принудительная синхронизация списка.
     * @returns {void}
     * ***************************************************************************
     */
    sync(): void {
        try {
            this._emit("addrendition");
            this._emit("activechange");
        } catch (error) {
            Logger.error(error);
        }
    }

    /**
     * ***************************************************************************
     * Снятие подписок.
     * @returns {void}
     * ***************************************************************************
     */
    destroy(): void {
        if (this.video) {
            try { this.video.removeEventListener("loadedmetadata", this._onLoadedMetadata); } catch (error) { }
        }
        this._destroyed = true;
        this.video = null;
        this._options = [];
        this._renditions = [];
    }

}
