// Импортируем сторонние пакеты
import "@videojs/html/i18n/locales/ru";
import "@videojs/html/video/player";
import "@videojs/html/video/skin";
import "@videojs/html/ui/container";
import "@videojs/html/ui/poster";
import "@videojs/html/ui/buffering-indicator";
import "@videojs/html/ui/play-button";
import "@videojs/html/ui/gesture";
import "@videojs/html/ui/hotkey";
import "@videojs/html/ui/tooltip";
import "@videojs/html/ui/tooltip-label";
// Значения enum hls.js (не type-import): подписки на события ниже используют
// рабочие значения событий, а не их ключи
import { Events } from "hls.js";
import type Hls from "hls.js";
import type { Level } from "hls.js";

// Импортируем utils
import { Logger } from "../utils/logs/logger.js";
import { getErrorMessage } from "../utils/helpers/error_util.js";
import { Icons } from "../utils/icons.js";

/**
 * Вариант интерфейса плеера (см. VideoPlayer._build).
 */
export type VideoPlayerVariant = "full" | "note" | "bare";

/**
 * Настройки плеера: оформление и поведение.
 * Все поля опциональны — дефолты задаёт конструктор VideoPlayer.
 */
export interface VideoPlayerOptions {

    /** Вариант интерфейса (по умолчанию "full"). */
    variant?: VideoPlayerVariant;

    /** Автовоспроизведение. */
    autoplay?: boolean;

    /** Начать без звука. */
    muted?: boolean;

    /** Повторное воспроизведение. */
    loop?: boolean;

    /** playsinline (обязателен для iOS). */
    playsinline?: boolean;

    /** URL постера. */
    poster?: string | undefined;

    /** CSS-соотношение сторон (например "16:9") для резервации места. */
    ratio?: string;

    /** Дополнительные классы на корневой элемент плеера. */
    className?: string;

    /** Показывать кнопку широкого режима кадра в панели контролов (только вариант "full"). */
    wideControl?: boolean;

    /** Произвольные атрибуты нативного <video>. */
    attributes?: Record<string, string | boolean | null>;

}

/**
 * Данные создания плеера.
 */
export interface VideoPlayerData {

    /** Существующий нативный <video>. Если не передан — создаётся новый. */
    video?: HTMLVideoElement | null;

    /** Контейнер, в который монтируется плеер. По умолчанию — родитель <video>. */
    insertInto?: HTMLElement | null | undefined;

    /** Оформление и поведение (см. VideoPlayerOptions). */
    options?: VideoPlayerOptions;

}

/**
 * Подписчик события плеера (Plyr-совместимый on/off).
 */
type VideoPlayerHandler = (payload?: unknown) => void;

/**
 * Plyr-совместимый доступ к внутренним элементам плеера (см. VideoPlayer.elements).
 */
interface VideoPlayerElements {

    /** Контейнер слоёв и цель fullscreen. */
    container: HTMLElement | null;

    /** Нативный <video>. */
    video: HTMLVideoElement;

    /** Корневой <video-player>. */
    player: VideojsPlayerElement | null;

}

/**
 * Список нативных событий <video>, которые проброшены через on()/off().
 * Имена совпадают с Plyr, поэтому код переносится без изменений подписок.
 * @type {string[]}
 */
const MEDIA_EVENTS: string[] = [
    "play", "playing", "pause", "ended", "timeupdate", "durationchange",
    "loadedmetadata", "loadeddata", "canplay", "canplaythrough",
    "progress", "waiting", "seeking", "seeked", "ratechange",
    "volumechange", "enterpictureinpicture", "leavepictureinpicture",
    "fullscreenchange", "error"
];

/**
 * Брейкпоинт «узкого» экрана для кнопки широкого режима кадра.
 * Совпадает с lg Tailwind: широкий режим растягивает сцену трансляции
 * за лимит контента (~60rem), и уже на 64rem переключатель бесполезен.
 * @type {string}
 */
const WIDE_CONTROL_NARROW = "(max-width: 64rem)";

/**
 * Стили кнопки широкого режима кадра.
 *
 * Живут строкой, а не в css/components/videojs.css: кнопка лежит в
 * shadow root скина, куда глобальный CSS не проникает, — правила
 * внедряются <style> рядом с кнопкой (см. VideoPlayer._mountWideControl).
 * Базовый вид кнопке даёт класс media-button из стилей скина.
 * @type {string}
 */
const WIDE_BUTTON_STYLES = `
.media-cdm-player-wide .media-cdm-player-wide-icon {
    width: var(--media-icon-size, 1.25rem);
    height: var(--media-icon-size, 1.25rem);
}
.media-cdm-player-wide[aria-pressed="true"] {
    background-color: var(--media-accent-color);
    color: var(--media-accent-text-color, #ffffff);
}
`;

/**
 * ***************************************************************************
 * VIDEO_PLAYER_SKIN - собственный «лайтовый» скин проекта (light DOM).
 *
 * Зачем он нужен рядом с packaged `<video-skin>`
 * -------------------------------------------
 * Packaged-скин Video.js рендерится в shadow root и тематизируется только
 * через публичные CSS-переменные `--media-*`. Для «видеокружков» в чате нужен
 * принципиально другой набор контролов (одна большая кнопка play поверх
 * квадрата), а вырезать контролы из packaged-скина нельзя — документация прямо
 * запрещает опираться на его внутренние классы.
 *
 * Поэтому у нас свой скин: обычный light DOM, полностью стилизующийся нашими
 * же CSS-правилами (см. `css/components/videojs.css`). Иконки не используем —
 * стрелки play/pause и спиннер рисуются на CSS, чтобы не тянуть реестр
 * иконок Video.js.
 * ***************************************************************************
 */
class VideoPlayerSkin extends HTMLElement {

    /** Флаг собранной разметки (повторный render() теряет нативный <video>). */
    _cdmRendered = false;

    /**
     * ***************************************************************************
     * Сборка внутренней разметки скина.
     * Вызывается явно из VideoPlayer ДО монтирования в DOM: на момент
     * вызова connectedCallback пользовательские элементы ещё не апгрейднуты.
     * @returns {void}
     * ***************************************************************************
     */
    render(): void {

        // Повторный вызов не допускаем — иначе потеряем нативный <video>
        if (this._cdmRendered) return;
        this._cdmRendered = true;

        // Забираем нативный <video> из light DOM скина
        const video = this.querySelector<HTMLVideoElement>(":scope > video");

        // Контейнер — это «визуальная граница» плеера и цель для fullscreen
        const container = document.createElement("media-container");
        container.className = "cdm-player";
        container.dataset.preset = this.dataset.variant || "video";

        // Медиа-слот: видео обязано лежать внутри контейнера,
        // иначе не будет корректного слоя и fullscreen-цели
        const slot = document.createElement("div");
        slot.className = "cdm-player-media";
        slot.setAttribute("data-media-slot", "");
        if (video) slot.appendChild(video);

        // Постер (прячется после первого play — так ведёт сам Video.js)
        const poster = document.createElement("media-poster");
        poster.className = "cdm-player-poster";

        // Индикатор буферизации (рисуется нашим CSS по [data-visible])
        const buffering = document.createElement("media-buffering-indicator");
        buffering.className = "cdm-player-buffering";

        // Тап по видео = play/pause
        const gesture = document.createElement("media-gesture");
        gesture.className = "cdm-player-gesture";
        gesture.setAttribute("type", "tap");
        gesture.setAttribute("action", "togglePaused");

        // Большая кнопка play по центру
        const play = document.createElement("media-play-button");
        play.className = "cdm-player-play";

        // Пробел / K — play/pause с клавиатуры
        const hotkey = document.createElement("media-hotkey");
        hotkey.setAttribute("keys", "Space");
        hotkey.setAttribute("action", "togglePaused");

        container.append(slot, poster, buffering, gesture, play, hotkey);
        this.appendChild(container);

    }

}

declare global {
    interface HTMLElementTagNameMap {
        /** Наш light-DOM скин для варианта "note" (см. VideoPlayerSkin). */
        "cdm-video-skin": VideoPlayerSkin;
    }
}

if (!customElements.get("cdm-video-skin")) {
    customElements.define("cdm-video-skin", VideoPlayerSkin);
}

/**
 * ***************************************************************************
 * VIDEO_PLAYER - глобальный видеоплеер проекта на Video.js 10.
 *
 * Зачем он нужен
 * --------------
 * Раньше каждое место с видео (media-viewer, видеокружки, трансляции,
 * конференция) самостоятельно поднимало `new Plyr(...)` и повторяло одну и
 * ту же обвязку: события, постер, качество, teardown, `[app][audio]::media-play`.
 *
 * Video.js 10 — это не конструктор, а три custom element'а
 * (`<video-player>` + скин + `<video>`), поэтому «просто заменить Plyr»
 * нельзя. Этот компонент скрывает композицию и даёт API, максимально
 * близкий к Plyr, чтобы перенос был механическим.
 *
 * Ключевое решение по стримингу
 * -----------------------------
 * HLS/FLV/RTC-движки (hls.js, mpegts.js, livekit-client, WebRTC) остаются
 * прежними и работают с ТЕМ ЖЕ нативным `<video>`, который отдаётся наружу
 * в `player.video`. Причина — кастомный `xhrSetup` с `?hls_chunk=` (его
 * требует service worker) и WHEP-логика трансляций. Меню качества при этом
 * остаётся нативным для Video.js: уровни hls.js пробрасываются через
 * адаптер `HlsLevelsRenditions` (частный класс ниже), а целые MP4-рендерации
 * загруженного видео — через `FileRenditions` (см.
 * `js/utils/video/file_renditions.js`).
 * ***************************************************************************
 */
export class VideoPlayer {

    /** Настройки с дефолтами (см. конструктор). */
    options: Required<VideoPlayerOptions>;

    /** Нативный <video> — с ним работают hls.js/mpegts/LiveKit. */
    video: HTMLVideoElement;

    /** Куда монтируется корневой <video-player> (null — родителя у видео нет). */
    host: HTMLElement | null;

    /** Корневой <video-player> (state boundary Video.js); null после destroy(). */
    player: VideojsPlayerElement | null;

    /** Скин плеера (наш light-DOM либо packaged <video-skin>); null после destroy(). */
    skin: HTMLElement | null;

    /** Контейнер для Plyr-совместимого доступа и оформления; null после destroy(). */
    container: HTMLElement | null;

    /** Store Video.js: состояние + actions (play/pause/seek/...); null после destroy(). */
    store: VideojsPlayerStore | null;

    /** Адаптер уровней hls.js для меню качества. */
    renditions: VideojsRenditionsAdapter | null;

    /** Подписки на нативные события <video>. */
    _mediaListeners: Map<string, () => void>;

    /** Производное состояние скина: воспроизведение уже начиналось (см. _syncSkinState). */
    _mediaStarted = false;

    /** Производное состояние скина: кадры ещё не пошли (см. _syncSkinState). */
    _mediaWaiting = false;

    /** Переключатель ширины кадра в панели контролов (опция wideControl); null после destroy(). */
    _wideButton: HTMLButtonElement | null = null;

    /** Подсказка кнопки ширины (лежит рядом с кнопкой в панели скина). */
    _wideTooltip: HTMLElement | null = null;

    /** Текст подсказки кнопки ширины. */
    _wideLabel: HTMLElement | null = null;

    /** Состояние широкого режима кадра (см. _toggleWide). */
    _wide = false;

    /** Снятие слушателей видимости кнопки ширины (см. _mountWideControl). */
    _wideCleanup: (() => void) | null = null;

    /** Пользовательские подписки (Plyr-совместимый on/off). */
    _handlers: Map<string, Set<VideoPlayerHandler>>;

    /** Флаг уничтожения. */
    _destroyed = false;

    /**
     * ***************************************************************************
     * Создание плеера.
     * @param {VideoPlayerData} [data] - Медиаэлемент, контейнер монтирования и настройки.
     * ***************************************************************************
     */
    constructor(data: VideoPlayerData = {}) {

        // `video` и `insertInto` — структурные аргументы (где взять <video>
        // и куда его смонтировать), поэтому вынесены из options наружу.
        // Всё остальное — в data.options (конвенция проекта).
        const { video = null, insertInto = null, options = {} } = data || {};

        // Настройки с дефолтами
        this.options = {
            variant: "full",
            autoplay: false,
            muted: false,
            loop: false,
            playsinline: true,
            poster: "",
            ratio: "",
            className: "",
            wideControl: false,
            attributes: {},
            ...options
        };

        // Нативный <video> — тот самый, с которым работают hls.js/mpegts/LiveKit
        this.video = video instanceof HTMLVideoElement ? video : document.createElement("video");

        // Куда монтируем: явно заданный контейнер либо текущий родитель видео
        this.host = insertInto instanceof HTMLElement ? insertInto : this.video.parentElement;

        // Корневой <video-player> (state boundary Video.js) и скин
        this.player = document.createElement("video-player");
        this.skin = null;
        this.container = null;

        // Store Video.js: состояние + actions (play/pause/seek/quality/...)
        this.store = null;

        // Адаптер уровней hls.js для меню качества
        this.renditions = null;

        // Подписки на нативные события <video>
        this._mediaListeners = new Map();

        // Производное состояние скина (см. _syncSkinState)
        this._mediaStarted = false;
        this._mediaWaiting = false;

        // Пользовательские подписки (Plyr-совместимый on/off)
        this._handlers = new Map();

        // Флаг уничтожения
        this._destroyed = false;

        // Собираем DOM
        this._build();

    }

    // ***************************************************************************
    // Доступ к состоянию плеера
    // ***************************************************************************

    /**
     * ***************************************************************************
     * Текущее время воспроизведения (секунды).
     * @returns {number}
     * ***************************************************************************
     */
    get currentTime(): number {
        return this.video?.currentTime || 0;
    }

    /**
     * ***************************************************************************
     * Длительность медиа (секунды). 0, пока метаданные не загружены.
     * @returns {number}
     * ***************************************************************************
     */
    get duration(): number {
        const duration = this.video?.duration;
        return Number.isFinite(duration) ? duration : 0;
    }

    /**
     * ***************************************************************************
     * Громкость от 0 до 1.
     * @returns {number}
     * ***************************************************************************
     */
    get volume(): number {
        return this.video?.volume ?? 1;
    }

    /**
     * ***************************************************************************
     * Установка громкости (0..1).
     * @param {number} value - Новое значение громкости.
     * ***************************************************************************
     */
    set volume(value: number) {
        if (!this.video) return;
        this.video.volume = Math.min(1, Math.max(0, Number(value) || 0));
    }

    /**
     * ***************************************************************************
     * Признак отключённого звука.
     * @returns {boolean}
     * ***************************************************************************
     */
    get muted(): boolean {
        return !!this.video?.muted;
    }

    /**
     * ***************************************************************************
     * Включение/отключение звука.
     * @param {boolean} value - Новое состояние mute.
     * ***************************************************************************
     */
    set muted(value: boolean) {
        if (!this.video) return;
        this.video.muted = !!value;
    }

    /**
     * ***************************************************************************
     * Находится ли плеер на паузе.
     * @returns {boolean}
     * ***************************************************************************
     */
    get paused(): boolean {
        return this.video?.paused !== false;
    }

    /**
     * ***************************************************************************
     * Досмотрено ли видео до конца.
     * @returns {boolean}
     * ***************************************************************************
     */
    get ended(): boolean {
        return !!this.video?.ended;
    }

    /**
     * ***************************************************************************
     * Источник воспроизведения.
     * @returns {string}
     * ***************************************************************************
     */
    get src(): string {
        return this.video?.currentSrc || this.video?.src || "";
    }

    /**
     * ***************************************************************************
     * Установка источника.
     * @param {string} value - URL источника.
     * ***************************************************************************
     */
    set src(value: string) {
        if (!this.video) return;
        this.video.src = value || "";
        this.video.load();

        // Новый источник — снова показываем постер и кнопку play
        this._mediaStarted = false;
        this._mediaWaiting = false;
        this._syncSkinState();
    }

    /**
     * ***************************************************************************
     * Постер плеера (Plyr-совместимое свойство).
     * @returns {string}
     * ***************************************************************************
     */
    get poster(): string {
        return this.player?.poster || "";
    }

    /**
     * ***************************************************************************
     * Установка постера. Дублируем в атрибут нативного <video>, чтобы картинка
     * оставалась и после переподключения того же элемента к другому плееру.
     * @param {string} value - URL постера.
     * ***************************************************************************
     */
    set poster(value: string) {
        const url = value || "";
        if (this.player) this.player.poster = url;
        if (this.video) {
            if (url) this.video.setAttribute("poster", url);
            else this.video.removeAttribute("poster");
        }
    }

    /**
     * ***************************************************************************
     * Plyr-совместимый доступ к внутренним элементам плеера.
     * Мигрируемый код делает `player.elements.container.classList.add(...)`.
     * @returns {VideoPlayerElements}
     * ***************************************************************************
     */
    get elements(): VideoPlayerElements {
        return {
            container: this.container,
            video: this.video,
            player: this.player
        };
    }

    // ***************************************************************************
    // Сборка DOM
    // ***************************************************************************

    /**
     * ***************************************************************************
     * Сборка структуры плеера и монтирование в контейнер.
     * @returns {void}
     * ***************************************************************************
     */
    _build(): void {

        // Корневой элемент создаётся в конструкторе; после destroy() его нет —
        // пересобирать уничтоженный плеер нельзя
        if (!this.player) return;

        const { variant, ratio, className } = this.options;

        // Корневой <video-player>: именно он владеет store-состоянием
        this.player.className = ["cdm-video-player", className].filter(Boolean).join(" ");
        this.player.dataset.variant = variant;

        // Резервируем пропорции до загрузки метаданных, чтобы не было прыжка вёрстки
        if (ratio) this.player.style.setProperty("--cdm-video-ratio", ratio);

        // Скин: наш собственный для "note", packaged Video.js для "full",
        // без скина для "bare" (RTC/LiveKit — там UI не нужен)
        if (variant === "note") {

            // Тип элемента известен из объявления HTMLElementTagNameMap ниже
            const skin = document.createElement("cdm-video-skin");
            skin.className = "cdm-video-skin";
            skin.dataset.variant = variant;
            skin.appendChild(this.video);

            // Разметку скина строим сразу: connectedCallback сработает позже,
            // когда нативный <video> уже окажется внутри light DOM
            skin.render();

            this.skin = skin;

        } else if (variant === "full") {

            // Packaged <video-skin> рендерится в shadow root, наш <video>
            // попадает туда через <slot> и остаётся тем же DOM-узлом
            this.skin = document.createElement("video-skin");
            this.skin.className = "cdm-video-skin";
            this.skin.appendChild(this.video);

        } else {

            // Только контейнер: медиа без интерфейса
            const container = document.createElement("media-container");
            container.className = "cdm-player";
            container.dataset.preset = "bare";
            container.appendChild(this.video);
            this.skin = container;
            this.container = container;

        }

        this.player.appendChild(this.skin);

        // Кнопка широкого режима встаёт в ряд контролов packaged-скина
        if (variant === "full" && this.options.wideControl) {
            this._mountWideControl();
        }

        // Контейнер для Plyr-совместимого доступа и оформления
        this.container = this.container || this.skin.querySelector<HTMLElement>("media-container") || this.skin;

        // Применяем autoplay/muted/loop/playsinline
        if (this.options.muted) this.video.muted = true;
        if (this.options.loop) this.video.loop = true;
        if (this.options.playsinline) this.video.setAttribute("playsinline", "");
        if (this.options.autoplay) this.video.autoplay = true;

        // Произвольные атрибуты нативного <video> (data-*, id и т.п.)
        for (const [key, value] of Object.entries(this.options.attributes || {})) {
            if (value === null || value === false) continue;
            this.video.setAttribute(key, value === true ? "" : value);
        }

        // Постер
        if (this.options.poster) this.poster = this.options.poster;

        // Монтируем: только после вставки в DOM store получает медиа
        if (this.host) this.host.appendChild(this.player);

        // Страховка стилей packaged-скина: Chromium при подключении первого
        // экземпляра <video-skin> к документу тихо сбрасывает уже применённые
        // adoptedStyleSheets (сброс происходит ВНУТРИ appendChild, минуя JS).
        // Проверяем сразу, в ближайшем microtask и следующим тиком — к этому
        // моменту модалка обычно уже подвинула DOM слота.
        if (variant === "full") {
            this.ensureSkinStyles();
            queueMicrotask(() => this.ensureSkinStyles());
            setTimeout(() => this.ensureSkinStyles(), 0);
            setTimeout(() => this.ensureSkinStyles(), 300);
        }

        // Store доступен сразу после создания элемента
        this.store = this.player.store;

        // Прокидываем нативные события <video> в нашу шину
        this._bindMediaEvents();

    }

    // ***************************************************************************
    // Восстановление стилей packaged-скина
    // ***************************************************************************

    /**
     * ***************************************************************************
     * Восстановление стилей packaged <video-skin>.
     *
     * Конструктор скина применяет два constructable-листа (shared + skin) к
     * теневому корню, но при монтировании плеера в документ шаблона формы
     * (Overlay собирает обёртку через DOMParser — отдельный документ, и
     * `_onBeforeOpen` работает до переноса в document.body) браузер тихо
     * сбрасывает adoptedStyleSheets: constructable-листы нельзя переносить
     * между документами. Тогда контролы рендерятся без стилей (display:
     * inline) и обрезаются контейнером.
     *
     * Метод идемпотентен, никогда не бросает исключений: сначала пробует
     * нативный перенос листов, а если узел всё ещё в чужом документе —
     * внедряет копию правил текстовым <style>, который работает в любом
     * документе и переживает последующий переезд DOM.
     *
     * @returns {boolean} - true, если стили на месте после проверки.
     * ***************************************************************************
     */
    ensureSkinStyles(): boolean {

        // Сбрасывать листы может только packaged <video-skin> (вариант "full")
        if (this.skin?.tagName !== "VIDEO-SKIN") return false;

        const root = this.skin.shadowRoot;
        if (!root) return false;

        try {

            // Листы на месте или <style> уже внедрён — ничего не трогаем
            if (root.adoptedStyleSheets?.length) return true;
            if (root.querySelector("style[data-cdm-skin-styles]")) return true;

            // Эталон: свежий <video-skin> в конструкторе применяет те же два
            // листа; сам он в документ не попадает, поэтому его не касаются
            // ни сброс, ни ограничения на перенос
            const probe = document.createElement("video-skin");
            const sheets = [...(probe.shadowRoot?.adoptedStyleSheets || [])];
            probe.remove();

            if (!sheets.length) return false;

            // 1) Нативный перенос листов — работает, когда узел уже в основном
            //    документе (например, отложенная проверка после открытия формы)
            try {
                root.adoptedStyleSheets = sheets;
                Logger.warn("[VideoPlayer] adoptedStyleSheets скина были потеряны — листы восстановлены");
                return true;
            } catch (e) {
                // Узел пока в чужом документе — браузер запрещает перенос,
                // переходим к текстовому <style>
            }

            // 2) Текстовый <style>: копия правил из эталонных листов, не зависит
            //    от документа-владельца узла и переживает переезд в document.body
            const css = sheets
                .map((sheet) => Array.from(sheet.cssRules).map((rule) => rule.cssText).join("\n"))
                .filter(Boolean)
                .join("\n");

            if (!css) return false;

            const style = document.createElement("style");
            style.dataset.cdmSkinStyles = "";
            style.textContent = css;
            root.appendChild(style);

            Logger.warn("[VideoPlayer] стили скина были потеряны — восстановлены через <style>-fallback");
            return true;

        } catch (error) {
            // Никогда не роняем форму из-за сбоя восстановления стилей
            Logger.error("[VideoPlayer] Ошибка восстановления стилей скина:", error);
            return false;
        }
    }

    // ***************************************************************************
    // Переключатель ширины кадра
    // ***************************************************************************

    /**
     * ***************************************************************************
     * Добавление кнопки широкого режима в панель контролов плеера.
     *
     * Кнопка встаёт в ряд с cast/pip/fullscreen и живёт их жизнью: прячется
     * вместе с контролами и оформляется их стилями (класс media-button).
     *
     * Почему вставка в shadow root
     * ----------------------------
     * Публичных точек расширения панели у Video.js 10 нет: скин принимает
     * снаружи только медиа и постер, а документация на добавление контролов
     * предлагает лишь eject всего скина в проект. Поэтому вставляем кнопку в
     * панель сами — это вынужденная опора на внутреннюю разметку пакета
     * (@videojs/html@10.0.0-rc.2). Если разметка изменится, кнопка просто
     * не появится (fallback — предупреждение в лог), плеер продолжит работать.
     *
     * @returns {boolean} - true, если кнопка добавлена.
     * ***************************************************************************
     */
    _mountWideControl(): boolean {

        // Панель рендерится в shadow root скина в конструкторе — к моменту
        // вызова она уже собрана
        const root = this.skin?.shadowRoot;
        if (!root) return false;

        // Правая группа панели (cast / airplay / pip / fullscreen)
        const group = root.querySelector<HTMLElement>("media-controls-group.video-controls-secondary");
        if (!group) {
            Logger.warn("[VideoPlayer] Панель контролов скина не найдена — кнопка широкого режима не добавлена");
            return false;
        }

        // Кнопка-переключатель в оформлении панели
        const button = document.createElement("button");
        button.type = "button";
        button.id = "cdm-player-wide-trigger";
        button.className = "media-button media-cdm-player-wide";
        button.setAttribute("aria-pressed", "false");
        button.setAttribute("aria-label", window._lc.components.video_player.wide_expand);

        // Иконка: maximize / minimize по состоянию (см. _wideIcon)
        const icon = this._wideIcon();
        if (icon) button.appendChild(icon);

        // Клик переключает режим. Тап по кнопке не превращается в play/pause:
        // GestureCoordinator не претендует на события интерактивных целей
        button.addEventListener("click", () => this._toggleWide());

        // Подсказка — по образцу кнопок скина: триггер по id + media-tooltip
        const tooltip = document.createElement("media-tooltip");
        tooltip.className = "media-popup media-popup-safe-area media-popup-transition media-popup-surface media-tooltip";
        tooltip.setAttribute("trigger", button.id);
        tooltip.setAttribute("side", "top");

        const label = document.createElement("media-tooltip-label");
        label.textContent = window._lc.components.video_player.wide_expand;
        tooltip.appendChild(label);

        // Стили кнопки внедряются в shadow root рядом с ней: глобальный CSS
        // не проникает внутрь скина. Базовый вид даёт класс media-button
        const style = document.createElement("style");
        style.textContent = WIDE_BUTTON_STYLES;

        group.prepend(button, tooltip);
        root.appendChild(style);

        this._wideButton = button;
        this._wideTooltip = tooltip;
        this._wideLabel = label;

        // Кнопка следует за видимостью контролов и прячется там, где широкий
        // режим бессмысленен (см. _syncWideButton)
        const sync = () => this._syncWideButton();
        document.addEventListener("fullscreenchange", sync);
        const narrow = window.matchMedia(WIDE_CONTROL_NARROW);
        narrow.addEventListener("change", sync);
        this._wideCleanup = () => {
            document.removeEventListener("fullscreenchange", sync);
            narrow.removeEventListener("change", sync);
        };

        this._syncWideButton();

        return true;

    }

    /**
     * ***************************************************************************
     * Иконка кнопки широкого режима по текущему состоянию.
     *
     * Иконка — Tabler (общий реестр иконок проекта) и показывает следующее
     * действие: maximize — «растянуть», minimize — «вернуть обратно».
     * @returns {SVGSVGElement|null} - Узел иконки (null, если иконка не найдена).
     * ***************************************************************************
     */
    _wideIcon(): SVGSVGElement | null {
        return Icons.icon(this._wide ? "minimize" : "maximize", { classes: ["media-cdm-player-wide-icon"] });
    }

    /**
     * ***************************************************************************
     * Синхронизация кнопки широкого режима с окружением.
     *
     * Кнопка прячется в двух случаях: в полноэкранном режиме ширина кадра не
     * регулируется, а на узких экранах широкий режим ничего не меняет.
     * Прячем inline-стилем: атрибут hidden бьют стили скина с их display.
     * @returns {void}
     * ***************************************************************************
     */
    _syncWideButton(): void {

        if (!this._wideButton) return;

        const hide = !!document.fullscreenElement || window.matchMedia(WIDE_CONTROL_NARROW).matches;

        this._wideButton.style.display = hide ? "none" : "";

        if (this._wideTooltip) {
            this._wideTooltip.toggleAttribute("disabled", hide);
            this._wideTooltip.style.display = hide ? "none" : "";
        }

    }

    /**
     * ***************************************************************************
     * Переключение широкого режима кадра.
     *
     * Состояние живёт в атрибутах кнопки (aria-pressed, aria-label), наружу
     * уходит событие "wide-toggle" с новым значением — вёрсткой вокруг плеера
     * управляет его владелец (например, форма трансляции).
     * @returns {void}
     * ***************************************************************************
     */
    _toggleWide(): void {

        this._wide = !this._wide;

        // Подпись описывает следующее действие и дублируется в подсказке
        const label = this._wide
            ? window._lc.components.video_player.wide_collapse
            : window._lc.components.video_player.wide_expand;

        this._wideButton?.setAttribute("aria-pressed", String(this._wide));
        this._wideButton?.setAttribute("aria-label", label);
        if (this._wideLabel) this._wideLabel.textContent = label;

        // Иконка меняется вместе с состоянием: maximize ↔ minimize
        const icon = this._wideIcon();
        if (icon && this._wideButton) this._wideButton.replaceChildren(icon);

        this._emit("wide-toggle", this._wide);

    }

    // ***************************************************************************
    // Работа с событиями
    // ***************************************************************************

    /**
     * ***************************************************************************
     * Подписка на нативные события <video>, отражение состояния в скин
     * и проброс событий во внутреннюю шину.
     * @returns {void}
     * ***************************************************************************
     */
    _bindMediaEvents(): void {

        for (const type of MEDIA_EVENTS) {
            const handler = () => {
                this._trackMediaState(type);
                this._emit(type);
            };
            this.video.addEventListener(type, handler);
            this._mediaListeners.set(type, handler);
        }

        // Первичная отрисовка: до первого события постер виден, play — нет
        this._syncSkinState();

    }

    /**
     * ***************************************************************************
     * Перевод нативных событий <video> в два признака состояния скина.
     * @param {string} type - Имя нативного события.
     * @returns {void}
     * ***************************************************************************
     */
    _trackMediaState(type: string): void {

        switch (type) {
            case "play":
                this._mediaStarted = true;
                this._mediaWaiting = false;
                break;
            case "waiting":
            case "seeking":
                this._mediaWaiting = true;
                break;
            case "playing":
            case "canplay":
            case "canplaythrough":
            case "seeked":
            case "timeupdate":
                this._mediaWaiting = false;
                break;
        }

        this._syncSkinState();

    }

    /**
     * ***************************************************************************
     * Отрисовка состояния в атрибуты нашего light-DOM скина.
     *
     * Зачем это нужно
     * ---------------
     * `media-poster`, `media-play-button` и `media-buffering-indicator`
     * в Video.js 10 — «безголовые»: они умеют вычислить состояние
     * (`getState()`), но НЕ выставляют его в DOM. В packaged-скине этим
     * занимается биндинг внутри shadow root, до которого нам нельзя дотянуться
     * (документация прямо запрещает опираться на внутренние классы).
     *
     * Поэтому мы отражаем состояние сами, в собственные атрибуты `data-cdm-*`,
     * и стилизуем их в `css/components/videojs.css`. Никакой зависимости от
     * внутренних API Video.js здесь нет.
     *
     * @returns {void}
     * ***************************************************************************
     */
    _syncSkinState(): void {

        if (this.options.variant !== "note" || !this.skin) return;

        const play = this.skin.querySelector("media-play-button");
        const poster = this.skin.querySelector("media-poster");
        const buffering = this.skin.querySelector("media-buffering-indicator");

        // Кнопка play видна на паузе; после досмотра показываем её как «повтор»
        play?.toggleAttribute("data-cdm-paused", this.video?.paused !== false);
        play?.toggleAttribute("data-cdm-ended", !!this.video?.ended);

        // Постер живёт до первого старта воспроизведения
        poster?.toggleAttribute("data-cdm-visible", !this._mediaStarted);

        // Спиннер — пока кадры не пошли
        buffering?.toggleAttribute("data-cdm-buffering", this._mediaWaiting);

    }

    /**
     * ***************************************************************************
     * Внутренний проброс события всем подписчикам.
     * Ошибка в одном обработчике не должна ломать остальных и не должна
     * «молча» умирать в консоли.
     * @param {string} type - Имя события.
     * @param {unknown} [payload] - Дополнительные данные.
     * @returns {void}
     * ***************************************************************************
     */
    _emit(type: string, payload?: unknown): void {

        const handlers = this._handlers.get(type);
        if (!handlers || handlers.size === 0) return;

        for (const handler of [...handlers]) {
            try {
                handler(payload);
            } catch (error) {
                Logger.error(`[VideoPlayer] Ошибка обработчика события "${type}":`, error);
            }
        }

    }

    // ***************************************************************************
    // Публичный API (Plyr-совместимое подмножество)
    // ***************************************************************************

    /**
     * ***************************************************************************
     * Подписка на событие плеера.
     * @param {string} type - Имя события ("play", "timeupdate", "ended", ...).
     * @param {VideoPlayerHandler} handler - Обработчик.
     * @returns {VideoPlayer} - Экземпляр (для цепочек).
     * ***************************************************************************
     */
    on(type: string, handler: VideoPlayerHandler): this {

        if (typeof handler !== "function") return this;

        // get() после set() не выводится компилятором — работаем с Set через локальную
        let handlers = this._handlers.get(type);
        if (!handlers) {
            handlers = new Set();
            this._handlers.set(type, handlers);
        }
        handlers.add(handler);

        return this;

    }

    /**
     * ***************************************************************************
     * Снятие подписки. Без handler снимает все подписки этого события.
     * @param {string} type - Имя события.
     * @param {VideoPlayerHandler} [handler] - Обработчик, который нужно снять.
     * @returns {VideoPlayer} - Экземпляр (для цепочек).
     * ***************************************************************************
     */
    off(type: string, handler?: VideoPlayerHandler): this {

        const handlers = this._handlers.get(type);
        if (!handlers) return this;

        if (handler) handlers.delete(handler);
        else handlers.clear();

        return this;

    }

    /**
     * ***************************************************************************
     * Запуск воспроизведения.
     * @returns {Promise<void>}
     * ***************************************************************************
     */
    async play(): Promise<void> {
        try {
            return await this.video.play();
        } catch (error) {
            Logger.warn("[VideoPlayer] Воспроизведение заблокировано браузером:", getErrorMessage(error) || error);
        }
    }

    /**
     * ***************************************************************************
     * Пауза.
     * @returns {void}
     * ***************************************************************************
     */
    pause(): void {
        try { this.video.pause(); } catch (error) {
            Logger.error("[VideoPlayer] Ошибка паузы:", error);
        }
    }

    /**
     * ***************************************************************************
     * Полная остановка: пауза + сброс позиции в начало.
     * Аналог Plyr.stop() — используется глобальной координацией медиа.
     * @returns {void}
     * ***************************************************************************
     */
    stop(): void {
        this.pause();
        try { this.video.currentTime = 0; } catch (error) { }
    }

    /**
     * ***************************************************************************
     * Переключение play/pause.
     * @returns {void}
     * ***************************************************************************
     */
    toggle(): void {
        this.video.paused ? this.play() : this.pause();
    }

    /**
     * ***************************************************************************
     * Перемотка на указанное время (секунды).
     * @param {number} time - Позиция в секундах.
     * @returns {Promise<void>}
     * ***************************************************************************
     */
    async seek(time: number): Promise<void> {
        try {
            if (this.store?.seek) await this.store.seek(time);
            else this.video.currentTime = time;
        } catch (error) {
            Logger.error("[VideoPlayer] Ошибка перемотки:", error);
        }
    }

    /**
     * ***************************************************************************
     * Установка скорости воспроизведения.
     * @param {number} rate - Множитель скорости.
     * @returns {void}
     * ***************************************************************************
     */
    setSpeed(rate: number): void {
        try {
            this.video.playbackRate = Number(rate) || 1;
        } catch (error) {
            Logger.error("[VideoPlayer] Ошибка установки скорости:", error);
        }
    }

    /**
     * ***************************************************************************
     * Подключение экземпляра hls.js: включает меню качества Video.js.
     *
     * Меню «Качество» у Video.js появляется только когда у медиаэлемента есть
     * `videoRenditions`. Мы не меняем HLS-движок (в проекте нужен кастомный
     * `xhrSetup` с `?hls_chunk=` для service worker), поэтому просто отдаём
     * адаптер, который Video.js читает как обычный список уровней.
     *
     * Остаётся ради HLS живых трансляций из SRS: загруженные видео-вложения
     * больше не используют HLS — у них качество переключает `FileRenditions`.
     *
     * @param {Hls} hls - Экземпляр hls.js.
     * @returns {HlsLevelsRenditions|null}
     * ***************************************************************************
     */
    attachHls(hls: Hls | null): HlsLevelsRenditions | null {

        // Если уровни уже подключались — переиспользуем тот же адаптер
        if (this.renditions instanceof HlsLevelsRenditions && this.renditions.hls === hls) return this.renditions;

        this.detachHls();

        if (!hls) return null;

        return this.attachRenditions(new HlsLevelsRenditions(hls));

    }

    /**
     * ***************************************************************************
     * Подключение произвольного адаптера уровней.
     *
     * Обобщение `attachHls`: Video.js проверяет у медиаэлемента лишь свойство
     * `videoRenditions`, поэтому адаптер может быть каким угодно, лишь бы он
     * реализовывал контракт списка (см. `FileRenditions` и `HlsLevelsRenditions`).
     * Так в конференции подключается адаптер слоёв LiveKit — там нет hls.js,
     * но меню «Качество» нужно точно так же.
     *
     * @param {VideojsRenditionsAdapter} renditions - Адаптер уровней (наследник EventTarget).
     * @returns {VideojsRenditionsAdapter|null} - Подключённый адаптер или null.
     * ***************************************************************************
     */
    attachRenditions<T extends VideojsRenditionsAdapter>(renditions: T | null): T | null {

        if (!renditions) return null;

        this.renditions = renditions;

        // Ключ, по которому Video.js понимает: медиа умеет renditions
        this.video.videoRenditions = renditions;

        return renditions;

    }

    /**
     * ***************************************************************************
     * Отключение адаптера уровней (перед destroy() экземпляра hls.js).
     * @returns {void}
     * ***************************************************************************
     */
    detachHls(): void {
        this.detachRenditions();
    }

    /**
     * ***************************************************************************
     * Отключение адаптера уровней.
     *
     * Снимать ДО уничтожения источника уровней: Video.js должен перестать
     * считать медиа «умеющим renditions», пока адаптер ещё живой.
     * @returns {void}
     * ***************************************************************************
     */
    detachRenditions(): void {

        if (!this.renditions) return;

        this.renditions.destroy();
        this.renditions = null;

        // Убираем свойство, чтобы Video.js считал медиа «без renditions»
        if (this.video) {
            try { delete this.video.videoRenditions; } catch (error) {
                this.video.videoRenditions = undefined;
            }
        }

    }

    /**
     * ***************************************************************************
     * Полное уничтожение плеера.
     *
     * Порядок важен: сначала hls.js, потом Video.js. При обратном порядке
     * hls.js успевает дёрнуть `load()` на уже отсоединённом <video>, из-за
     * чего в консоль падает `GET blob:... ERR_FILE_NOT_FOUND` (см. sw.js).
     * @returns {void}
     * ***************************************************************************
     */
    destroy(): void {

        if (this._destroyed) return;
        this._destroyed = true;

        // 1. Снимаем подписки с нативного <video>
        for (const [type, handler] of this._mediaListeners) {
            this.video.removeEventListener(type, handler);
        }
        this._mediaListeners.clear();
        this._handlers.clear();

        // Снимаем слушателей видимости кнопки ширины: иначе они переживут
        // плеер и будут висеть до перезагрузки страницы
        if (this._wideCleanup) {
            this._wideCleanup();
            this._wideCleanup = null;
        }

        // 2. Отпускаем адаптер уровней
        this.detachHls();

        // 3. Останавливаем воспроизведение
        try { this.video.pause(); } catch (error) { }

        // 4. Снимаем источник, чтобы не оставить живую ссылку на blob
        try {
            this.video.removeAttribute("src");
            this.video.querySelectorAll("source").forEach((source) => source.remove());
        } catch (error) { }

        // 5. Убираем <video-player> из DOM — store уничтожится сам
        try { this.player?.remove(); } catch (error) { }

        this.store = null;
        this.container = null;
        this.skin = null;
        this.player = null;
        this._wideButton = null;
        this._wideTooltip = null;
        this._wideLabel = null;

    }

}

/**
 * ***************************************************************************
 * HlsLevelsRenditions - адаптер списка уровней hls.js под модель Video.js 10.
 *
 * Частный класс `video_player.ts`. Раньше жил отдельным файлом
 * `js/utils/video/hls_renditions.js`, но тот обслуживал ещё и загруженные
 * видео-вложения. Загруженные видео перешли на целые MP4-рендерации
 * (`FileRenditions`), и отдельный модуль стал не нужен.
 * Единственный оставшийся потребитель — HLS живых трансляций из SRS
 * (раздел 11.4 плана), поэтому адаптер переехал сюда и не экспортируется.
 *
 * Зачем это нужно
 * ---------------
 * Video.js 10 умеет показывать меню качества только тогда, когда медиаэлемент
 * «умеет renditions» (проверка `isMediaVideoRenditionCapable` смотрит на
 * наличие свойства `media.videoRenditions`). Мы сознательно НЕ переносим
 * HLS-движок на `@videojs/hlsjs-video`, потому что в проекте есть собственный
 * `xhrSetup`, переписывающий URL чанков на `?hls_chunk=` (это требуется
 * service worker'у, см. `js/sw.js`).
 *
 * Поэтому мы оставляем родной `hls.js`, подключённый к нативному `<video>`, но
 * «притворяемся» для Video.js: подсовываем элементу список уровней hls.js
 * через контракт `videoRenditions`. Видеоплеер сам соберёт из него меню
 * «Качество», а выбор пунктов будет приходить в `selectedIndex`.
 *
 * Контракт, который ждёт Video.js:
 *   - `length` + итерация (`[...list]`) — чтобы получить все rendition'ы;
 *   - у каждого: `id`, `width`, `height`, `bitrate`, `frameRate`, `codec`,
 *     `selected`, `active`;
 *   - `selectedIndex` (get/set) — чтение/установка выбранного уровня;
 *   - события `addrendition`, `removerendition`, `change`, `activechange`
 *     (наследуются от `EventTarget`).
 * ***************************************************************************
 */
class HlsLevelsRenditions extends EventTarget {

    /** Ссылка на hls.js (null после destroy()). */
    hls: Hls | null;

    /** Флаг уничтожения, чтобы late-колбэки hls.js не трогали мёртвый адаптер. */
    _destroyed = false;

    /** Обработчики событий hls.js: пары [событие, обработчик]; снимаются в destroy(). */
    _hlsHandlers: Array<[Events, () => void]> | null = null;

    /**
     * ***************************************************************************
     * Создание адаптера уровней.
     * @param {Hls} hls - Экземпляр hls.js (`Hls.isSupported()` уже проверен).
     * @returns {HlsLevelsRenditions}
     * ***************************************************************************
     */
    constructor(hls: Hls) {

        // Вызываем родительский конструктор (EventTarget), иначе не будет
        // addEventListener/dispatchEvent, которые Video.js использует для
        // подписки на изменения списка
        super();

        // Ссылка на hls.js
        this.hls = hls || null;

        // Флаг уничтожения, чтобы late-колбэки hls.js не трогали мёртвый адаптер
        this._destroyed = false;

        // Подписываемся на события hls.js и синхронизируем список уровней
        this._syncLevels();

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
        return this.hls?.levels?.length || 0;
    }

    /**
     * ***************************************************************************
     * Возвращает rendition по индексу (аналог `LevelList.item` в hls.js).
     * @param {number} index - Индекс уровня.
     * @returns {VideojsRendition|null} - Объект rendition или null.
     * ***************************************************************************
     */
    item(index: number): VideojsRendition | null {
        const level = this.hls?.levels?.[index];
        return level ? this._toRendition(level, index) : null;
    }

    /**
     * ***************************************************************************
     * Числовой доступ к уровню: `list[3]`.
     * @param {number} index - Индекс уровня.
     * @returns {VideojsRendition|null} - Объект rendition или null.
     * ***************************************************************************
     */
    itemAt(index: number): VideojsRendition | null {
        return this.item(index);
    }

    /**
     * ***************************************************************************
     * Итерация по уровням — Video.js разворачивает список через spread.
     * @returns {Generator<VideojsRendition|null>}
     * ***************************************************************************
     */
    *[Symbol.iterator](): Generator<VideojsRendition | null> {
        for (let index = 0; index < this.length; index++) {
            yield this.item(index);
        }
    }

    /**
     * ***************************************************************************
     * Индекс выбранного уровня.
     * -1 означает «авто» (адаптивный битрейт, hls.currentLevel = -1).
     * @returns {number}
     * ***************************************************************************
     */
    get selectedIndex(): number {
        if (!this.hls) return -1;
        return this.hls.autoLevelEnabled ? -1 : this.hls.currentLevel;
    }

    /**
     * ***************************************************************************
     * Установка уровня качества. Вызывается из меню Video.js.
     * @param {number} value - Индекс уровня или -1 для автоматического режима.
     * ***************************************************************************
     */
    set selectedIndex(value: number) {
        if (!this.hls || this._destroyed) return;

        // -1 = авто (ABR), остальное = конкретный уровень
        const index = Number(value);
        this.hls.currentLevel = index < 0 ? -1 : index;

        // Сообщаем UI, что активный уровень сменился
        this._emit("activechange");
        this._emit("change");

    }

    // ***************************************************************************
    // Служебные методы
    // ***************************************************************************

    /**
     * ***************************************************************************
     * Подписка на события hls.js, влияющие на список уровней, и первая
     * синхронизация списка при подключении адаптера.
     *
     * Подписываемся по ЗНАЧЕНИЯМ enum (`Events.*`), а не по ключам: ключи вроде
     * `"MANIFEST_PARSED"` hls.js не сопоставляет со своими событиями, поэтому
     * такие обработчики никогда не срабатывали.
     * @returns {void}
     * ***************************************************************************
     */
    _syncLevels(): void {

        // Если hls.js не передан или уже уничтожен — просто синхронизируем
        // пустой список (меню качества спрячется сама)
        if (!this.hls) return;

        // Каждое событие hls.js превращаем в то событие списка, которое ждёт
        // внешний код (Video.js и подписчики адаптера)
        this._hlsHandlers = [
            [Events.MANIFEST_PARSED, () => this._emit("addrendition")],
            [Events.LEVEL_SWITCHED, () => this._emit("activechange")],
            [Events.LEVELS_UPDATED, () => this._emit("change")]
        ];

        for (const [event, handler] of this._hlsHandlers) {
            try { this.hls.on(event, handler); } catch (e) { }
        }

        this._emit("addrendition");

    }

    /**
     * ***************************************************************************
     * Преобразует уровень hls.js в rendition Video.js.
     * @param {Level} level - Уровень из `hls.levels`.
     * @param {number} index - Индекс уровня (используется как `id`).
     * @returns {VideojsRendition} - Объект rendition.
     * ***************************************************************************
     */
    _toRendition(level: Level, index: number): VideojsRendition {

        // `id` — это ключ, по которому Video.js сопоставляет пункт меню
        // с уровнем hls.js, поэтому используем строковый индекс
        const isSelected = this.selectedIndex === index;

        return {
            id: String(index),
            width: level.width || undefined,
            height: level.height || undefined,
            bitrate: level.bitrate || undefined,
            frameRate: level.frameRate || undefined,
            selected: isSelected,
            active: isSelected
        };

    }

    /**
     * ***************************************************************************
     * Отправка события подписчикам (Video.js).
     * @param {string} name - Имя события.
     * @returns {void}
     * ***************************************************************************
     */
    _emit(name: string): void {
        if (this._destroyed) return;
        try { this.dispatchEvent(new Event(name)); } catch (e) { }
    }

    // ***************************************************************************
    // Доступ к выбранному уровню
    // ***************************************************************************

    /**
     * ***************************************************************************
     * Принудительная синхронизация списка уровней (после парсинга манифеста).
     * @returns {void}
     * ***************************************************************************
     */
    sync(): void {
        this._emit("addrendition");
        this._emit("activechange");
    }

    /**
     * ***************************************************************************
     * Уничтожение адаптера: снимаем обработчики hls.js, помечаем его мёртвым
     * и отпускаем ссылку на hls.js.
     * @returns {void}
     * ***************************************************************************
     */
    destroy(): void {

        // Снимаем подписки с hls.js (по тем же парам событие/обработчик)
        if (this.hls && this._hlsHandlers) {
            for (const [event, handler] of this._hlsHandlers) {
                try { this.hls.off(event, handler); } catch (e) { }
            }
        }

        this._hlsHandlers = null;
        this._destroyed = true;
        this.hls = null;

    }

}
