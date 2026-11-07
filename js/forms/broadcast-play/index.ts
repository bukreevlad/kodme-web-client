// Импортируем сторонние пакеты
import { OverlayScrollbars } from "overlayscrollbars";

// Импортируем config
import { CDM_FORM_CLASSES, CDM_FORM_HEADER_CLASSES, CDM_FORM_CONTENT_CLASSES, CDM_FORM_SECTION_CLASSES } from "../../config/constants.js";

// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";
import { Icons } from "../../utils/icons.js";
import { LocalStorage } from "../../utils/local_storage.js";

// Импортируем requests
import { openCastRequest } from "./requests/open.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Buttons } from "../../components/buttons.js";

// Импортируем forms
import { Messages } from "../messages/index.js";

// Импортируем handlers
import { menuHandler } from "./handlers/menu.js";

// Импортируем functions
import { stopFLVPlayer } from "./functions/stop_flv_player.js";
import { stopHLSPlayer } from "./functions/stop_hls_player.js";
import { stopRTCPlayer } from "./functions/stop_rtc_player.js";
import { initPlayer } from "./functions/init_player.js";
import { loaderDispose, loaderHide, loaderWaiting } from "./functions/loader_control.js";
import { syncHeaderOffset } from "./functions/sync_header_offset.js";
import { syncLiveState } from "./functions/sync_live_state.js";
import { updateStats } from "./functions/update_stats.js";
import { renderAuthor } from "./functions/render_author.js";

// Импортируем типы
import type { VideoPlayer } from "../../components/video_player.js";
import type { StreamEngine, BroadcastCast } from "./types.js";
import { I18n, t } from "../../utils/i18n/index.js";

/**
 * Настройки формы просмотра трансляции.
 */
export interface BroadcastPlayOptions {

    /** Куда вставить форму. */
    insertInto?: HTMLElement | null;

}

/**
 * Данные конструктора формы.
 */
export interface BroadcastPlayData {

    /** Id трансляции. */
    castId: string;

    /** Настройки формы. */
    options?: BroadcastPlayOptions;

}

// Form
export class BroadcastPlay {

    // Реестр всех открытых форм BroadcastPlay: { castId: instance }
    static instances = new Map<string, BroadcastPlay>();

    /** Настройки формы. */
    options: BroadcastPlayOptions;

    /** Шаблон формы. */
    tpl: HTMLElement | null = null;

    /** Модальное окно формы. */
    modal: Overlay | null = null;

    /** Контент формы (скролл-контейнер OverlayScrollbars). */
    content: HTMLElement | null = null;

    /** Инстанс OverlayScrollbars контента. */
    osListScrollInstance: OverlayScrollbars | null = null;

    /** Id трансляции. */
    castId: string;

    /** Данные трансляции (ответ "[broadcast]: open"). */
    cast: BroadcastCast | null = null;

    /** Выбранный тип воспроизведения (rtc / flv / hls). */
    typePlay: string;

    /** Экземпляр VideoPlayer (UI + обёртка над <video>). */
    player: VideoPlayer | null = null;

    /** Экземпляр hls.js / mpegts.js (движок потока). */
    streamEngine: StreamEngine = null;

    /** PeerConnection WHEP-проигрывания (RTC). */
    peerConnection: RTCPeerConnection | null = null;

    /** Конфигурация RTCPeerConnection (ICE-серверы из сессии). */
    pcConfig: RTCConfiguration;

    /**
     * Ссылка на обработчик глобальной координации медиа: нужна, чтобы
     * снять подписку при закрытии (иначе она живёт до перезагрузки страницы)
     */
    boundGlobalMediaHandler: ((event: Event) => void) | null = null;

    /** Таймер чипа длительности эфира (см. functions/cast_timing_update.ts). */
    castTiming: ReturnType<typeof setInterval> | null = null;

    /** Таймер RTC-статистики (см. functions/rtc_stats_update.ts). */
    rtcStatTiming: ReturnType<typeof setInterval> | null = null;

    /** Таймер опроса состояния потока (см. functions/stream_info_update.ts). */
    castUpdaterTiming: ReturnType<typeof setInterval> | null = null;

    /**
     * Таймер отложенного показа лоадера при буферизации (см.
     * functions/loader_control.ts): лоадер включается, только если
     * пауза длится дольше порога, а не на каждое событие `waiting`
     */
    loaderTiming: ReturnType<typeof setTimeout> | null = null;

    /**
     * Признак того, что сервер отдаёт живой поток (ответ
     * get stream info не null). Живость эфира считается как
     * cast.is_live && isStreamLive — см. functions/sync_live_state.ts
     */
    isStreamLive = false;

    /** Отписка от ResizeObserver высоты шапки, см. functions/sync_header_offset.ts */
    unobserveHeader: (() => void) | null = null;

    /** Признак сборки чипов статистики (см. functions/update_stats.ts). */
    statsMounted = false;

    /** Ссылки на странсляцию */
    whepUrl: string | null = null;
    flvUrl: string | null = null;
    hlsUrl: string | null = null;

    // Устанавливаемые элементы шаблона (_onBeforeOpen)
    /** Шапка формы. */
    header: HTMLElement | null = null;

    /** Контейнер сцены с видео. */
    videoContainer: HTMLElement | null = null;

    /** Точка монтирования плеера. */
    videoMount: HTMLElement | null = null;

    /** Контейнер чипов статистики. */
    statsWrap: HTMLElement | null = null;

    /** Лоадер формы. */
    loader: HTMLElement | null = null;

    /** Кнопка контекстного меню в шапке. */
    menuButton: HTMLElement | null = null;

    /** Название трансляции. */
    name: HTMLElement | null = null;

    /** Строка автора трансляции. */
    author: HTMLElement | null = null;

    /** Контейнер строки автора (бейдж бота). */
    authorWrap: HTMLElement | null = null;

    /** Описание трансляции. */
    about: HTMLElement | null = null;

    // Узлы значений чипов статистики (см. functions/update_stats.ts)
    /** Чип «смотрят». */
    watching: HTMLElement | null = null;

    /** Чип длительности эфира. */
    timing: HTMLElement | null = null;

    /** Чип разрешения. */
    resolution: HTMLElement | null = null;

    /** Чип fps. */
    fps: HTMLElement | null = null;

    /** Чип битрейта. */
    bitrate: HTMLElement | null = null;

    /** Чип входящего трафика. */
    incoming: HTMLElement | null = null;

    /**
     * ***************************************************************************
     * Форма.
     * @param data - Данные.
     * @param data.castId - Id трансляции.
     * @param data.options - Настройки формы.
     * @param data.options.insertInto - Куда вставить форму.
     * ***************************************************************************
     */
    constructor(data: BroadcastPlayData) {

        // Если не передан userId
        if (!data?.castId) throw new Error("Не передан: castId");

        // Устанавливаем настройки
        this.options = {
            insertInto: document.querySelector<HTMLElement>(".cdm-form.home .middle >.form-container"),
            ...data?.options
        }

        // Переменные формы
        this.castId = data.castId;
        this.typePlay = "flv";
        this.pcConfig = {
            iceTransportPolicy: "all", // all или ("relay" если хочешь использовать только TURN)
            rtcpMuxPolicy: "require",
            iceServers: _getSessionIceServers()
        };

        // Получаем instance
        let instance = BroadcastPlay.instances.get(data.castId);
        if (instance) return instance;

        // Регистрируем этот экземпляр формы
        BroadcastPlay.instances.set(this.castId, this);

        // Инициализация
        this._init();

    }

    /**
     * ***************************************************************************
     * Нативный <video> текущего плеера.
     *
     * Живёт внутри VideoPlayer, но нужен наружу: hls.js, mpegts.js и WHEP
     * (RTCPeerConnection) подключаются именно к нему, а не к UI-обёртке.
     * Именно поэтому VideoPlayer оборачивает существующий <video>, а не
     * заменяет его (см. js/components/video_player.ts).
     *
     * @returns <video> или null, если плеера нет.
     * ***************************************************************************
     */
    get video(): HTMLVideoElement | null {
        return this.player?.video || null;
    }

    /**
     * ***************************************************************************
     * Идёт ли сейчас воспроизведение трансляции.
     *
     * Нужно, потому что движок потока (form.streamEngine) есть не всегда:
     *   - HLS через MSE — hls.js, лежит в form.streamEngine;
     *   - HLS нативно (Safari/iOS, MSE недоступен) — <video> играет сам,
     *     движка нет, а src задан прямо в теге;
     *   - FLV — mpegts.js, лежит в form.streamEngine;
     *   - RTC — RTCPeerConnection, лежит в form.peerConnection.
     *
     * Без этой проверки на iOS ветка «нативный HLS» перезапускалась бы
     * каждые 5 секунд по таймеру stream_info_update.
     *
     * @returns true, если воспроизведение уже запущено.
     * ***************************************************************************
     */
    get isPlaying(): boolean {

        if (this.streamEngine) return true;
        if (this.peerConnection) return true;

        // Нативный HLS: src задан, но srcObject и движка нет
        if (this.typePlay === "hls" && this.video?.getAttribute("src")) return true;

        return false;

    }

    // ***************************************************************************
    // Инициализация
    // ***************************************************************************
    async _init(): Promise<void> {

        // Открытие
        await this._open();

    }

    // ***************************************************************************
    // Открытие
    // ***************************************************************************
    async _open(): Promise<void> {

        try {

            // Шаблон формы
            this.tpl = this._template();

            // Форма
            this.modal = new Overlay(this.tpl, {
                type: "form",
                url: `?broadcast-play=${this.castId}`,
                insertInto: this.options.insertInto,
                closeOnEsc: false,
                closeOnOverlay: false,

                // Плеер исключаем из свайп-закрытия.
                //
                // На мобильных форма вешает GestureController на свой .content,
                // то есть на контейнер с видео. Порог жеста — 3 px, а список
                // ignore по умолчанию пуст, поэтому палец сдвигался на три
                // пикселя — и жест уже наш: тап до Video.js не доходит, а свайп
                // по видео не скроллит форму. На десктопе контроллера нет
                // вовсе (isMobile.get()), поэтому там всё работает.
                ignoreSwipeElements: ["[data-video-mount]"],

                onBeforeOpen: async () => await this._onBeforeOpen(),
                onOpen: () => this._onOpen(),
                onBeforeClose: () => this._onBeforeClose(),
                openAnimationClass: null,
                closeAnimationClass: null
            });

            // Открываем форму
            this.modal.open();

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Обработчики
    // ***************************************************************************
    _handlers(): void {

        try {

            // Обработчики вешаются на узлы шаблона — без него нечего слушать
            if (!this.tpl) return;

            // Закрыть
            let close = this.tpl.querySelector<HTMLElement>(":scope >.header [action-close]");
            close?.addEventListener("click", () => this.modal?.close());

            // Контекстное меню
            let menu = this.tpl.querySelector<HTMLElement>(":scope >.header [action-menu]");
            this.menuButton = menu;
            menu?.addEventListener("click", (event) => menuHandler(event, this));

            // Открыть чат
            let openChat = this.tpl.querySelector<HTMLElement>(":scope >.header [action-open-chat]");
            openChat?.addEventListener("click", () => {
                // Ссылки в замыкании читаются в момент клика;
                // без id канала чат не открываем
                const channelId = this.cast?.chat_channel_id;
                if (channelId) new Messages({ channelId });
            });

            // Лоадер формы: прячется, когда видео заиграло, и показывается
            // при буферизации дольше порога. Привязка к событиям плеера —
            // в functions/loader_control.ts
            this.video?.addEventListener("playing", () => loaderHide(this));
            this.video?.addEventListener("waiting", () => loaderWaiting(this));

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Настройка формы
    // ***************************************************************************
    async _onBeforeOpen(): Promise<void> {

        try {

            // Получаем трансляцию
            const response = await openCastRequest({
                cast_id: this.castId
            });

            // Записываем данные
            this.cast = response.data;

            // Ссылки на странсляцию
            this.whepUrl = `${window.location.protocol}//${window.location.hostname}/api/v1/cast/whep/?app=live&stream=${this.castId}&token=${this.cast?.access_token}`;
            this.flvUrl = `${window.location.protocol}//${window.location.hostname}/api/v1/cast/flv/live/${this.castId}.flv?token=${this.cast?.access_token}`;
            this.hlsUrl = `${window.location.protocol}//${window.location.hostname}/api/v1/cast/hls/live/${this.castId}.m3u8?token=${this.cast?.access_token}`;

            // Эфир объявлен активным — живое состояние ставим сразу, до
            // первого опроса stream_info_update: иначе между вставкой формы
            // в документ и созданием плеера (initPlayer) по центру сцены
            // мелькал бы плейсхолдер «Эфир не запущен». Первый же опрос
            // в initPlayer подтверждает или опровергает это состояние
            if (this.cast?.is_live) this.isStreamLive = true;

            // Записываем данные
            // Без сессии тип воспроизведения не узнать
            const session = LocalStorage.session;
            if (!session) return;
            this.typePlay = session.settings.broadcasts.type_play;

            // Элементы заполняются из шаблона — без него нечего настраивать
            if (!this.tpl) return;

            // Устанавливаем элементы
            this.content = this.tpl.querySelector<HTMLElement>(":scope >.content");
            this.name = this.tpl.querySelector<HTMLElement>(":scope >.content [data-title] [data-name]");
            this.author = this.tpl.querySelector<HTMLElement>(":scope >.content [data-title] [data-author-name]");
            this.authorWrap = this.tpl.querySelector<HTMLElement>(":scope >.content [data-title] [data-author-row]");
            this.about = this.tpl.querySelector<HTMLElement>(":scope >.content [data-title] [data-about]");

            // Устанавливаем элементы
            this.header = this.tpl.querySelector<HTMLElement>(":scope >.header");
            this.videoContainer = this.tpl.querySelector<HTMLElement>(":scope >.content [data-video-wrap]");
            this.videoMount = this.tpl.querySelector<HTMLElement>(":scope >.content [data-video-mount]");
            this.statsWrap = this.tpl.querySelector<HTMLElement>(":scope >.content [data-cast-info]");

            this.loader = this.tpl.querySelector<HTMLElement>(":scope >.header .cdm-loader");

            // Инициализируем скролл
            const content = this.content;
            if (content) {
                this.osListScrollInstance = OverlayScrollbars(content, {
                    scrollbars: { autoHide: "scroll" }, overflow: { x: "hidden", y: "scroll" }
                });
            }

            // Обновляем форму
            this.update(response.data);

            // Сообщаем системе, что форма открыта
            window.dispatchEvent(new CustomEvent("[app][form]::opened", {
                detail: {
                    id: this.modal?.options.id,
                    data: {
                        instance: this,
                        title: this.cast.name,
                        subtitle: t("forms.broadcast_play.title")
                    }
                }
            }));

            // Плеер создаётся в _onOpen(): к этому моменту форма уже вставлена
            // в документ, и скин Video.js конструируется подключённым — иначе его
            // стили не применяются. Подробности в functions/init_player.ts

        } catch (error) {
            Logger.error(error);
            this.modal?.close();
        }

    }

    // ***************************************************************************
    // Форма открылась
    // ***************************************************************************
    _onOpen(): void {

        // Плеер строим первым: обработчики и таймеры уже обращаются к form.player
        initPlayer(this);

        this._handlers();

        // Наблюдатель высоты шапки запускаем здесь, а не в _onBeforeOpen:
        // к моменту onOpen форма уже вставлена в документ и ResizeObserver
        // видит реальные размеры (до вставки он отдал бы 0px)
        this.unobserveHeader = syncHeaderOffset(this);

    }

    // ***************************************************************************
    // Обновляем данные формы
    // ***************************************************************************
    update(data: BroadcastCast): void {

        // Обновляем данные формы
        this.cast = data;

        // Устанавливаем элементы
        let openChat = this.tpl?.querySelector<HTMLElement>(":scope >.header [action-open-chat]");

        // Проверка чата
        if (openChat) {
            !this.cast.is_chat ? openChat.classList.add("hidden") : openChat.classList.remove("hidden");
        }

        // Отображаем данные
        if (this.name) this.name.textContent = this.cast.name;
        if (this.about) this.about.textContent = this.cast.about;

        // Строка автора: человек и бот различаются визуально
        renderAuthor(this, data);

        // Чипы статистики: сборка и значения — в одном месте,
        // см. functions/update_stats.ts
        updateStats(this, data?.stream);

        // Пока эфир не идёт — показываем нулевую длительность
        if (!this.cast.is_live && this.timing) this.timing.textContent = "00:00";

        // Состояние эфира пишем в атрибут на корне формы
        syncLiveState(this);

    }

    // ***************************************************************************
    // Действия при закрытии формы
    // ***************************************************************************
    _onBeforeClose(): void {

        // Порядок teardown критичен: сначала освобождаем движки потока
        // (hls.js / mpegts / WHEP), и только потом уничтожаем плеер.
        // Обратный порядок даёт "GET blob:... ERR_FILE_NOT_FOUND": движок
        // успевает дёрнуть load() на уже отсоединённом <video>.
        stopFLVPlayer(this);
        stopHLSPlayer(this);
        stopRTCPlayer(this);

        // Удаляем плеер
        if (this.player) {
            this.player.destroy();
            this.player = null;
        }

        // Снимаем глобальную подписку, иначе она переживёт форму
        if (this.boundGlobalMediaHandler) {
            window.removeEventListener("[app][audio]::media-play", this.boundGlobalMediaHandler);
            this.boundGlobalMediaHandler = null;
        }

        // Снимаем наблюдатель высоты шапки: он иначе переживёт форму и
        // продолжит писать в отсоединённый элемент
        if (this.unobserveHeader) {
            this.unobserveHeader();
            this.unobserveHeader = null;
        }

        // Останавливаем таймер (без таймера останавливать нечего)
        if (this.castUpdaterTiming != null) clearInterval(this.castUpdaterTiming);

        // Снимаем отложенный показ лоадера, иначе он переживёт форму
        loaderDispose(this);

        // Удаляем экземпляр формы из реестра
        BroadcastPlay.instances.delete(this.castId);

        // Сообщаем системе, что форма закрыта
        window.dispatchEvent(new CustomEvent("[app][form]::closed", {
            detail: { id: this.modal?.options.id }
        }));

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement {

        // Локализованные подписи. aria-подписи тоже держим в локализации:
        // их читает скринридер, по-русски они осмысленны
        const locale = I18n.tree.forms.broadcast_play;

        const tpl = new DOMParser().parseFromString(`
        
            <div class="cdm-form broadcast-play flex flex-col ${CDM_FORM_CLASSES()} w-full" data-live="false">
                <div class="header flex flex-row gap-2 p-2 items-center justify-between ${CDM_FORM_HEADER_CLASSES()}">
                    <div class="flex flex-row gap-2 items-center">
                        ${Buttons.circle({ intent: "transparent", attributes: ["action-close", { name: "aria-label", value: locale.aria.back }], icon: "ArrowLeft" })}
                        <span data-title class="flex flex-row gap-2 items-center font-semibold text-lg">${t("forms.broadcast_play.title")}</span>
                        <span class="cdm-loader hidden"></span>
                    </div>
                    <div class="flex flex-row gap-2 items-center">
                        ${Buttons.circle({ intent: "transparent", attributes: ["action-open-chat", { name: "aria-label", value: locale.aria.chat }], icon: "message-2" })}
                        ${Buttons.circle({ intent: "transparent", attributes: ["action-menu", { name: "aria-label", value: locale.aria.menu }], icon: "dots-vertical" })}
                    </div>
                </div>
                 <div class="content w-full h-full flex flex-col ${CDM_FORM_CONTENT_CLASSES()}">
                    <div class="flex flex-col gap-3 p-3 h-full w-full">

                        <!-- Сцена с видео. Ширина по умолчанию ограничена общим
                             лимитом контента; кнопка в контролах плеера
                             растягивает сцену на всю ширину формы — состояние
                             живёт в атрибуте data-video-wide на корне -->
                        <div data-video-wrap class="relative flex flex-col gap-0 w-full mx-auto max-w-[calc(var(--form-max-content-width)*2)] aspect-16/9 rounded-lg overflow-hidden">
                            <div data-video-mount class="absolute inset-0"></div>

                            <!-- Затемнение сверху, высота = 2 x высота шапки.
                                 Высоту пишет functions/sync_header_offset.ts -->
                            <div data-live-scrim aria-hidden="true"></div>

                            <!-- Плейсхолдер по центру сцены, пока эфир не идёт.
                                 Вид решает только CSS по data-live -->
                            <div data-live-placeholder>
                                <span data-live-placeholder-label>
                                    ${Icons.icon("broadcast")?.outerHTML || ""}
                                    ${locale.offline}
                                </span>
                            </div>
                        </div>

                    <!-- Название, автор, описание и статистика остаются в узкой
                         колонке и в широком режиме сцены -->
                    <div data-title class="flex flex-col gap-3 w-full mx-auto max-w-[calc(var(--form-max-content-width)*2)] ${CDM_FORM_SECTION_CLASSES()}">
                        <div class="flex flex-col gap-1">
                            <span data-name class="font-semibold"></span>
                            <div data-author-row class="flex flex-row gap-1 items-center flex-wrap">
                                <span data-author-name class="text-sm text-muted"></span>
                            </div>
                            <span data-about class="text-secondary empty:hidden"></span>
                        </div>

                        <!-- Контейнер чипов статистики. Разметку чипов
                             собирает functions/update_stats.ts — она
                             добавляет их прямо сюда, поэтому ряд, а не
                             колонка: иначе шесть чипов сложились бы в
                             шестирядную башню вместо прежних трёх рядов -->
                        <div data-cast-info class="flex flex-row flex-wrap gap-1 items-center"></div>
                    </div>

                    </div>

                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-form");

        // invariant: шаблон — наши строки, форма в нём всегда есть
        if (!tpl) throw new TypeError("broadcast-play: template: форма .cdm-form не найдена");

        return tpl;

    }

}

/**
 * ***************************************************************************
 * Приватный: ICE-серверы из настроек текущей сессии.
 *
 * Поле `server` дописывается в сессию при логине (см. handlers/check.ts
 * формы sessions), поэтому честный путь — только через guard: битая или
 * неполная сессия не должна ронять форму необработанной ошибкой.
 * @throws Error, если в сессии нет WebRTC-конфига.
 * ***************************************************************************
 */
function _getSessionIceServers(): RTCIceServer[] {

    const session: unknown = LocalStorage.session;
    if (!session || typeof session !== "object" || !("server" in session)) {
        throw new Error("В сессии нет данных сервера");
    }

    const server: unknown = session.server;
    if (!server || typeof server !== "object" || !("web_rtc" in server)) {
        throw new Error("В сессии нет WebRTC-конфига");
    }

    const webRtc: unknown = server.web_rtc;
    if (!webRtc || typeof webRtc !== "object" || !("ice_servers" in webRtc)) {
        throw new Error("В сессии нет ICE-серверов");
    }

    const iceServers = webRtc.ice_servers;
    if (!Array.isArray(iceServers)) {
        throw new Error("Некорректный формат ICE-серверов");
    }

    // invariant: сервер отдаёт массив RTCIceServer
    return iceServers as RTCIceServer[];

}
