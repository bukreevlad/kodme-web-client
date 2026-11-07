// Импортируем сторонние пакеты
import type { VideoQuality } from "livekit-client";

/**
 * ***************************************************************************
 * LiveKitRenditions - адаптер слоёв simulcast под модель Video.js 10.
 *
 * Зачем это нужно
 * ---------------
 * Меню «Качество» в Video.js появляется только у медиаэлемента, который
 * «умеет renditions» (проверка `isMediaVideoRenditionCapable` смотрит на
 * наличие свойства `media.videoRenditions`). В конференции LiveKit отдаёт
 * набор simulcast-слоёв у публикации трека — но это не hls.js, поэтому
 * адаптер `HlsLevelsRenditions` (частный класс `video_player.js`) здесь неприменим.
 *
 * Список у LiveKit статичен для конкретной публикации: он приходит в
 * `publication.trackInfo.layers` и не меняется, пока не сменится публикация.
 * Значит, достаточно один раз построить уровни и отдавать их Video.js.
 * Переключение качества идёт через `publication.setVideoQuality(...)`.
 *
 * Контракт, который ждёт Video.js (такой же, как у FileRenditions и
 * HlsLevelsRenditions):
 *   - `length` + итерация (`[...list]`) — чтобы получить все rendition'ы;
 *   - у каждого: `id`, `width`, `height`, `bitrate`, `frameRate`, `codec`,
 *     `selected`, `active`;
 *   - `selectedIndex` (get/set) — чтение/установка выбранного уровня;
 *   - события `addrendition`, `removerendition`, `change`, `activechange`.
 * ***************************************************************************
 */

/**
 * Уровень качества адаптера: simulcast-слой LiveKit либо явный пункт из
 * `options.levels` (поля совпадают со слоем, часть из них опциональна).
 */
export interface LiveKitRenditionLevel {

    /** Качество подписки LiveKit (enum `VideoQuality`). */
    quality: VideoQuality;

    /** Ширина кадра в пикселях (0 — неизвестно). */
    width?: number | undefined;

    /** Высота кадра в пикселях (0 — неизвестно). */
    height?: number;

    /** Целевой битрейт в бит/с. */
    bitrate?: number | undefined;

    /** Частота кадров (у слоёв LiveKit не отдаётся, берётся из явного списка). */
    fps?: number | undefined;

}

/**
 * Rendition, который отдаётся Video.js (контракт меню «Качество»).
 */
export interface LiveKitRenditionItem {

    /** Строковый индекс уровня — ключ сопоставления пункта меню и уровня. */
    id: string;

    /** Ширина кадра в пикселях. */
    width?: number | undefined;

    /** Высота кадра в пикселях. */
    height?: number | undefined;

    /** Целевой битрейт в бит/с. */
    bitrate?: number | undefined;

    /** Частота кадров. */
    frameRate?: number | undefined;

    /** Кодек слоя: у simulcast LiveKit не отдаётся, поэтому всегда undefined. */
    codec?: string | undefined;

    /** Выбран ли уровень как целевой для подписки. */
    selected: boolean;

    /** Активен ли уровень прямо сейчас. */
    active: boolean;

}

/**
 * Минимальный контракт публикации видеотрека LiveKit, который использует
 * адаптер (структурный подтип `RemoteTrackPublication` из livekit-client).
 */
export interface LiveKitVideoPublication {

    /** Информация о треке — в ней лежат simulcast-слои. */
    trackInfo?: { layers?: LiveKitRenditionLevel[] } | null;

    /** Текущее качество подписки (undefined — определить не удалось). */
    videoQuality?: VideoQuality | null;

    /** Переключение качества подписки. */
    setVideoQuality(quality: VideoQuality): void;

}

/**
 * Опции создания адаптера слоёв.
 */
export interface LiveKitRenditionsOptions {

    /** Явный список уровней `{ quality, width, height, bitrate, fps }`. */
    levels?: LiveKitRenditionLevel[];

    /** Качество по умолчанию, если выбранный уровень определить не удалось. */
    defaultQuality?: VideoQuality | "HIGH";

}

export class LiveKitRenditions extends EventTarget {

    /** Публикация видеотрека LiveKit (после `destroy()` — null). */
    publication: LiveKitVideoPublication | null;

    /** Качество по умолчанию для fallback. */
    defaultQuality: VideoQuality | "HIGH";

    /** Флаг уничтожения, чтобы late-колбэки не трогали мёртвый адаптер. */
    _destroyed = false;

    /** Построенные уровни (статичны для публикации). */
    _levels: LiveKitRenditionLevel[];

    /**
     * ***************************************************************************
     * Создание адаптера слоёв.
     * @param publication - Публикация видеотрека LiveKit.
     * @param options - Дополнительные параметры.
     * @param options.levels - Явный список уровней
     *        `{ quality, width, height, bitrate, fps }`. Если не передан —
     *        уровни берутся из `publication.trackInfo.layers`.
     * @param options.defaultQuality - Качество по умолчанию, если
     *        выбранный уровень не удалось определить (значение enum VideoQuality
     *        либо строка из легаси-фолбэка).
     * @returns {LiveKitRenditions}
     * ***************************************************************************
     */
    constructor(publication: LiveKitVideoPublication, options: LiveKitRenditionsOptions = {}) {

        // Вызываем родительский конструктор (EventTarget), иначе не будет
        // addEventListener/dispatchEvent, которые Video.js использует для
        // подписки на изменения списка
        super();

        // Ссылка на публикацию LiveKit
        this.publication = publication || null;

        // Качество по умолчанию для fallback
        this.defaultQuality = options.defaultQuality || "HIGH";

        // Флаг уничтожения, чтобы late-колбэки не трогали мёртвый адаптер
        this._destroyed = false;

        // Уровни строим сразу: у LiveKit они статичны для публикации.
        // Явный список (options.levels) важнее слоёв из SDP — он нужен, когда
        // публикация не объявила simulcast, но переключение всё равно возможно.
        this._levels = options.levels
            ? [...options.levels]
            : this._buildLevels();

    }

    // ***************************************************************************
    // Свойства и методы доступа к уровням
    // ***************************************************************************

    /**
     * ***************************************************************************
     * Количество доступных уровней.
     * @returns {number}
     * ***************************************************************************
     */
    get length(): number {
        return this._levels.length;
    }

    /**
     * ***************************************************************************
     * Возвращает rendition по индексу.
     * @param {number} index - Индекс уровня.
     * @returns {LiveKitRenditionItem|null} - Объект rendition или null.
     * ***************************************************************************
     */
    item(index: number): LiveKitRenditionItem | null {
        const level = this._levels[index];
        return level ? this._toRendition(level, index) : null;
    }

    /**
     * ***************************************************************************
     * Числовой доступ к уровню: `list[3]`.
     * @param {number} index - Индекс уровня.
     * @returns {LiveKitRenditionItem|null} - Объект rendition или null.
     * ***************************************************************************
     */
    itemAt(index: number): LiveKitRenditionItem | null {
        return this.item(index);
    }

    /**
     * ***************************************************************************
     * Итерация по уровням — Video.js разворачивает список через spread.
     * @returns {Generator<LiveKitRenditionItem|null>}
     * ***************************************************************************
     */
    *[Symbol.iterator](): Generator<LiveKitRenditionItem | null> {
        for (let index = 0; index < this._levels.length; index++) {
            yield this.item(index);
        }
    }

    /**
     * ***************************************************************************
     * Индекс выбранного уровня.
     *
     * У LiveKit нет режима «авто», как у hls.js: подписчик всегда подписан
     * либо на конкретный simulcast-слой, либо (при отсутствии слоёв в SDP)
     * на единственный поток. Поэтому -1 означает «слой определить не удалось»,
     * а не «авто».
     *
     * @returns {number}
     * ***************************************************************************
     */
    get selectedIndex(): number {
        if (!this.publication) return -1;

        // Текущее качество подписки LiveKit
        const current = this.publication.videoQuality;
        if (!current) return -1;

        const index = this._levels.findIndex((level) => level.quality === current);
        return index;
    }

    /**
     * ***************************************************************************
     * Установка уровня качества. Вызывается из меню Video.js.
     * @param {number} value - Индекс уровня.
     * ***************************************************************************
     */
    set selectedIndex(value: number) {

        if (!this.publication || this._destroyed) return;

        const index = Number(value);
        const level = this._levels[index];
        if (!level) return;

        try {
            this.publication.setVideoQuality(level.quality);
        } catch (error) {
            // Публикация могла размонтироваться между кликом и вызовом —
            // это штатная ситуация, а не ошибка плеера
            return;
        }

        // Сообщаем UI, что активный уровень сменился
        this._emit("activechange");
        this._emit("change");

    }

    // ***************************************************************************
    // Служебные методы
    // ***************************************************************************

    /**
     * ***************************************************************************
     * Построение списка уровней из simulcast-слоёв публикации.
     *
     * Сортируем по высоте по убыванию: так первым в меню оказывается
     * максимальное качество — это же поведение было у Plyr (`default: options[0]`
     * при списке, отсортированном по убыванию высоты).
     *
     * @returns {LiveKitRenditionLevel[]} - Уровни
     *          `{ quality, width, height, bitrate, fps }`.
     * ***************************************************************************
     */
    _buildLevels(): LiveKitRenditionLevel[] {

        const layers = this.publication?.trackInfo?.layers || [];
        if (!layers.length) return [];

        // Отмечаем высоты, уже попавшие в список: в SDP один слой может
        // описываться несколькими записями
        const seen = new Set<number>();
        const levels: LiveKitRenditionLevel[] = [];

        for (const layer of [...layers].sort((a, b) => (b.height || 0) - (a.height || 0))) {
            if (!layer.height || seen.has(layer.height)) continue;
            seen.add(layer.height);
            levels.push({
                quality: layer.quality,
                width: layer.width,
                height: layer.height,
                bitrate: layer.bitrate,
                fps: layer.fps
            });
        }

        return levels;

    }

    /**
     * ***************************************************************************
     * Преобразует слой LiveKit в rendition Video.js.
     * @param {LiveKitRenditionLevel} level - Уровень из списка.
     * @param {number} index - Индекс уровня (используется как `id`).
     * @returns {LiveKitRenditionItem} - Объект rendition.
     * ***************************************************************************
     */
    _toRendition(level: LiveKitRenditionLevel, index: number): LiveKitRenditionItem {

        // `id` — это ключ, по которому Video.js сопоставляет пункт меню
        // с уровнем, поэтому используем строковый индекс
        const isSelected = this.selectedIndex === index;

        return {
            id: String(index),
            width: level.width || undefined,
            height: level.height || undefined,
            bitrate: level.bitrate || undefined,
            frameRate: level.fps || undefined,
            codec: undefined,
            selected: isSelected,
            active: isSelected
        };

    }

    /**
     * ***************************************************************************
     * Безопасная отправка события в список renditions.
     * @param {string} type - Имя события.
     * @returns {void}
     * ***************************************************************************
     */
    _emit(type: string): void {
        if (this._destroyed) return;
        try { this.dispatchEvent(new Event(type)); } catch (e) { }
    }

    // ***************************************************************************
    // Публичный API
    // ***************************************************************************

    /**
     * ***************************************************************************
     * Принудительная синхронизация списка уровней.
     * @returns {void}
     * ***************************************************************************
     */
    sync(): void {
        this._emit("addrendition");
        this._emit("activechange");
    }

    /**
     * ***************************************************************************
     * Отпускаем ссылку на публикацию LiveKit.
     * @returns {void}
     * ***************************************************************************
     */
    destroy(): void {
        this._destroyed = true;
        this.publication = null;
        this._levels = [];
    }

}
