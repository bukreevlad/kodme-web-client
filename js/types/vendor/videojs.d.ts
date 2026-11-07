// ***************************************************************************
// Минимальные типы для @videojs/html — только используемая часть API:
// корневой <video-player> (store + постер) и контракт списка renditions,
// который Video.js читает с медиаэлемента.
//
// Почему типы описаны здесь: субпуть `@videojs/html/video/player` (define-
// модуль) не отдаёт типов вовсе (только `export {}`), а тип пресета
// `@videojs/html/video` не содержит постера и отдаёт store невыводимым.
// Глобальные объявления повторяют то, что реально делает рантайм: свойства
// элемента берутся из конфига фич (см. player/element.js: config → static
// properties → свойство постера), store отдаётся геттером с ленивым
// созданием, а `videoRenditions` подсовывает Video.js вместо собственного
// списка уровней адаптер (см. video_player.ts).
// ***************************************************************************

/** Store Video.js (состояние + действия), который держит <video-player>. */
interface VideojsPlayerStore {

    /** Перемотка на секунды (действие time-фичи store). */
    seek?: (time: number) => Promise<void>;

}

/** Пункт списка renditions, который показывает меню «Качество» Video.js. */
interface VideojsRendition {

    /** Строковый ключ уровня — по нему меню сопоставляет пункт со списком. */
    id: string;

    /** Ширина кадра в пикселях (нет данных — пункт без размера). */
    width?: number | undefined;

    /** Высота кадра в пикселях. */
    height?: number | undefined;

    /** Битрейт в бит/с. */
    bitrate?: number | undefined;

    /** Частота кадров. */
    frameRate?: number | undefined;

    /** Кодек. */
    codec?: string | undefined;

    /** Выбран ли уровень как активный. */
    selected: boolean;

    /** Активен ли уровень прямо сейчас. */
    active: boolean;

}

/**
 * Адаптер уровней качества, который Video.js читает как список renditions
 * (см. HlsLevelsRenditions в components/video_player.ts, FileRenditions в
 * utils/video/file_renditions.ts и адаптер слоёв LiveKit).
 *
 * Контракт, который ждёт Video.js: length + итерация (spread), пункт по
 * индексу, selectedIndex (get/set) и события EventTarget (`addrendition`,
 * `change`, `activechange`).
 */
interface VideojsRenditionsAdapter extends EventTarget {

    /** Количество уровней качества. */
    readonly length: number;

    /** Уровень по индексу (null — индекс вне диапазона). */
    item(index: number): VideojsRendition | null;

    /** Итерация по уровням: Video.js разворачивает список через spread. */
    [Symbol.iterator](): IterableIterator<VideojsRendition | null>;

    /** Индекс выбранного уровня (-1 — авто). */
    selectedIndex: number;

    /** Принудительная синхронизация списка у источника уровней. */
    sync(): void;

    /** Отключение адаптера (снимает подписки источника). */
    destroy(): void;

}

/** Корневой <video-player> — state boundary Video.js (см. video_player.ts). */
interface VideojsPlayerElement extends HTMLElement {

    /** Store Video.js: состояние + действия (см. VideojsPlayerStore). */
    readonly store: VideojsPlayerStore;

    /** Постер плеера (реактивное свойство элемента, уходит в store постера). */
    poster?: string | null;

}

interface HTMLElementTagNameMap {

    /** Корневой <video-player> (регистрируется субпутём @videojs/html/video/player). */
    "video-player": VideojsPlayerElement;

}

interface HTMLMediaElement {

    /**
     * Список renditions нативного медиаэлемента. Video.js проверяет наличие
     * свойства (isMediaVideoRenditionCapable), чтобы показать меню «Качество»;
     * вместо собственного списка ему подсовывается адаптер уровней.
     */
    videoRenditions?: VideojsRenditionsAdapter | undefined;

}
