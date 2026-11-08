// Импортируем utils
import { LocalStorage } from "../../utils/local_storage.js";
import { Logger } from "../../utils/logs/logger.js";
import { IsMobile } from "../../utils/helpers/is_mobile.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Buttons } from "../../components/buttons.js";

// Импортируем functions
import { showMedia } from "./functions/show_media.js";
import { destroyPlayer } from "./functions/destroy_player.js";
import { initGestures } from "./functions/init_gestures.js";

// Импортируем events
import { GlobalEvents } from "./events/global_events.js";

// Импортируем handlers
import { closeHandler } from "./handlers/close.js";
import { prevHandler } from "./handlers/prev.js";
import { nextHandler } from "./handlers/next.js";
import { wheelHandler } from "./handlers/wheel.js";
import { keydownHandler } from "./handlers/keydown.js";

// Импортируем типы
import type { VideoPlayer } from "../../components/video_player.js";
import type { GestureController, SwipeOptions } from "../../utils/gesture_controller.js";
import type {
    MediaItem,
    MediaPlayDetail,
    MediaViewerData,
    MediaViewerElements,
    MediaViewerOptions
} from "./types.js";

/**
 * ***************************************************************************
 * Просмотрщик медиа (Изображения и Видео)
 * Класс реализует паттерн Singleton, поддерживает слайдинг с предварительной
 * загрузкой соседних элементов и встроенным видеоплеером.
 *
 * В index.ts — только каркас жизненного цикла формы: логика вынесена в
 * handlers/ (нажатия), functions/ (процессы), events/ (подписки).
 * ***************************************************************************
 */
export class MediaViewer {

    /** Единственный экземпляр класса (Singleton). */
    static instance: MediaViewer | null = null;

    /** Список медиафайлов для просмотра. */
    media: MediaItem[];

    /** Индекс текущего отображаемого элемента. */
    currentIndex: number;

    /** Настройки: дефолты + overrides из `data.options`. */
    options: MediaViewerOptions;

    /** Шаблон формы (заполняется в `_open`). */
    tpl: HTMLElement | null = null;

    /** Модальный оверлей просмотрщика. */
    modal: Overlay | null = null;

    /** Элементы формы, собираемые в `_onBeforeOpen`. */
    elements: MediaViewerElements = {};

    // === Жесты и позиционирование (для зума и панорамирования) ===

    /** Контроллер жестов сцены (создаётся в initGestures). */
    gestures: GestureController | null = null;

    /** Текущий масштаб изображения. */
    zoom = 1;

    /** Сдвиг по X при зуме. */
    posX = 0;

    /** Сдвиг по Y при зуме. */
    posY = 0;

    // Смещения для свайпа
    /** Смещение свайпа по X. */
    tempDX = 0;

    /** Смещение свайпа по Y. */
    tempDY = 0;

    /** Флаг активной анимации перехода (слайда). */
    isTransitioning = false;

    /** Блокировщик жестов во время анимаций. */
    gestureLocked = false;

    // Для определения двойного тапа
    /** Время последнего тапа (performance.now()). */
    lastTapTime = 0;

    /** Блокировщик срабатывания двойного тапа посреди пары одиночных. */
    _tapBlocker = false;

    // === Плеер ===

    /** Видеоплеер активного слота (создаётся в createPlayer). */
    player: VideoPlayer | null = null;

    /** blob:-ссылка локального файла — для корректного освобождения. */
    _mediaBlobUrl: string | null = null;

    /** Подписаны ли глобальные события старта медиа. */
    _hasGlobalEvents = false;

    /** Флаг повторного создания плеера (защита от параллельного init). */
    _isInitializing = false;

    /** Нативный `<video>` активного слота (для очистки при destroy). */
    videoNode: HTMLVideoElement | null = null;

    /** Конфиг свайпа (перелистывание/закрытие) — его же включает updateGestureMode. */
    _swipeConfig: SwipeOptions | null = null;

    // Стартовые значения жестов панорамирования и щипка

    /** Стартовый сдвиг X панорамирования. */
    startPanX = 0;

    /** Стартовый сдвиг Y панорамирования. */
    startPanY = 0;

    /** Стартовый зум на начало щипка. */
    startZoom = 1;

    /** Стартовый сдвиг X на начало щипка. */
    startPinchX = 0;

    /** Стартовый сдвиг Y на начало щипка. */
    startPinchY = 0;

    /** Центр между пальцами на начало щипка. */
    startMidpoint: { x: number; y: number } = { x: 0, y: 0 };

    /** Стабильный обработчик глобального события старта медиа (для removeEventListener). */
    boundMediaPlayHandler: ((event: CustomEvent<MediaPlayDetail>) => void) | null = null;

    /** Стабильный обработчик keydown (для removeEventListener). */
    boundHandleKeydown: (event: KeyboardEvent) => void;

    /** Стабильный обработчик wheel (для removeEventListener). */
    boundHandleWheel: (event: WheelEvent) => void;

    /**
     * ***************************************************************************
     * Форма.
     * @param data - Данные: список медиафайлов и настройки просмотрщика.
     * ***************************************************************************
     */
    constructor(data: MediaViewerData = {}) {
        this.media = data.media || [];

        // Индекс текущего отображаемого элемента
        this.currentIndex = data.options?.startIndex || 0;

        this.options = {
            loop: true,
            closeOnEsc: true,
            closeOnOverlay: true,
            maxZoom: 3,
            ...data?.options
        };

        // Стабильные ссылки для глобальных слушателей (нужны для removeEventListener)
        this.boundHandleKeydown = (event) => keydownHandler(event, this);
        this.boundHandleWheel = (event) => wheelHandler(event, this);

        if (MediaViewer.instance) {
            console.log("ℹ️ [MediaViewer] Возврат существующего Singleton-экземпляра");
            MediaViewer.instance.update(data);
            return MediaViewer.instance;
        }
        console.log("🚀 [MediaViewer] Создание нового экземпляра просмотрщика", data);

        MediaViewer.instance = this;
        this._init();
    }

    /**
     * ***************************************************************************
     * Инициализация.
     * ***************************************************************************
     */
    async _init(): Promise<void> {
        await this._open();
    }

    /**
     * ***************************************************************************
     * Открытие модального окна.
     * ***************************************************************************
     */
    async _open(): Promise<void> {
        try {
            console.log("📂 [MediaViewer] Открытие модального окна...");
            this.tpl = this._template();
            this.modal = new Overlay(this.tpl, {
                type: "modal",
                url: `?media-viewer`,
                insertInto: this.options.insertInto,
                closeOnOverlay: this.options.closeOnOverlay,
                closeOnEsc: this.options.closeOnEsc,
                // Отступ от краёв не нужен: `null` — явное отсутствие
                // класса отступа (тип опции — класс либо null)
                wrapPadding: null,
                overlayBlur: true,
                onBeforeOpen: async () => await this._onBeforeOpen(),
                onOpen: () => this._onOpen(),
                onBeforeClose: () => this._onBeforeClose()
            });
            this.modal.open();
        } catch (error) {
            console.error("❌ [MediaViewer] Ошибка при открытии модалки:", error);
            Logger.error(error);
            MediaViewer.instance = null;
        }
    }

    /**
     * ***************************************************************************
     * Логика до открытия формы: сборка элементов, подписки, жесты и первый слайд.
     * ***************************************************************************
     */
    async _onBeforeOpen(): Promise<void> {
        try {
            console.log("⚙️ [MediaViewer] Сборка DOM элементов и инициализация...");

            // Без шаблона собирать нечего
            const tpl = this.tpl;
            if (!tpl) return;

            // Собираем элементы формы
            this.elements.wrap = tpl;
            this.elements.stage = tpl.querySelector<HTMLElement>(".cdm-iv-stage");
            this.elements.track = tpl.querySelector<HTMLElement>(".cdm-iv-track");
            this.elements.counter = tpl.querySelector<HTMLElement>(".cdm-iv-counter");
            this.elements.loader = tpl.querySelector<HTMLElement>(".cdm-iv-loader");
            this.elements.btnPrev = tpl.querySelector<HTMLElement>(".cdm-iv-prev");
            this.elements.btnNext = tpl.querySelector<HTMLElement>(".cdm-iv-next");
            this.elements.btnClose = tpl.querySelector<HTMLElement>("[action-close]");

            // На мобильных стрелки навигации не показываем
            if (IsMobile.get()) {
                this.elements.btnPrev?.classList.add("hidden");
                this.elements.btnNext?.classList.add("hidden");
            }

            // Глобальные подписки и жесты сцены
            GlobalEvents.init(this);
            initGestures(this);

            await showMedia(this, this.currentIndex);
        } catch (error) {
            console.error("❌ [MediaViewer] Ошибка в _onBeforeOpen:", error);
            Logger.error(error);
            MediaViewer.instance = null;
            throw error;
        }
    }

    /**
     * ***************************************************************************
     * Форма открылась.
     * ***************************************************************************
     */
    _onOpen(): void {
        this._handlers();
    }

    /**
     * ***************************************************************************
     * Обработчики кнопок и событий формы.
     * ***************************************************************************
     */
    _handlers(): void {
        try {

            // Перелистывание: стрелки есть только при нескольких медиафайлах
            // (число может измениться в update — слушатели вешаем всегда)
            if (this.media.length <= 1) {
                if (this.elements.btnPrev) this.elements.btnPrev.style.display = "none";
                if (this.elements.btnNext) this.elements.btnNext.style.display = "none";
            }
            this.elements.btnPrev?.addEventListener("click", (event) => prevHandler(event, this));
            this.elements.btnNext?.addEventListener("click", (event) => nextHandler(event, this));

            // Закрытие
            this.elements.btnClose?.addEventListener("click", () => closeHandler(this));

            // Зум колесом и навигация стрелками клавиатуры
            this.elements.stage?.addEventListener("wheel", this.boundHandleWheel, { passive: false });
            document.addEventListener("keydown", this.boundHandleKeydown);

        } catch (error) {
            Logger.error(error);
        }
    }

    /**
     * ***************************************************************************
     * Обновление данных открытого просмотрщика: повторное открытие переиспользует
     * Singleton — новый ряд медиа и стартовый слайд подставляются в открытую
     * форму вместо возврата устаревшего экземпляра.
     * @param data - Данные: список медиафайлов и настройки просмотрщика.
     * ***************************************************************************
     */
    update(data: MediaViewerData): void {

        // Новый ряд медиа, стартовый слайд и настройки
        this.media = data.media ?? this.media;
        this.currentIndex = data.options?.startIndex ?? 0;
        this.options = { ...this.options, ...data.options };

        // Стрелки перелистывания зависят от числа медиафайлов
        const hasMany = this.media.length > 1;
        if (this.elements.btnPrev) this.elements.btnPrev.style.display = hasMany ? "" : "none";
        if (this.elements.btnNext) this.elements.btnNext.style.display = hasMany ? "" : "none";

        // Форма ещё собирается — первый слайд покажет _onBeforeOpen
        if (!this.tpl || !this.modal) return;
        showMedia(this, this.currentIndex).catch((error) => {
            Logger.error("[app][MediaViewer]: ошибка обновления слайда:", error);
        });

    }

    /**
     * ***************************************************************************
     * Действия при закрытии формы: очистка ресурсов и подписок.
     * ***************************************************************************
     */
    _onBeforeClose(): void {
        console.log("🧹 [MediaViewer] Закрытие окна и очистка ресурсов");
        destroyPlayer(this);
        this.gestures?.destroy();

        document.removeEventListener("keydown", this.boundHandleKeydown);
        GlobalEvents.destroy(this);

        if (this.elements.stage) {
            this.elements.stage.removeEventListener("wheel", this.boundHandleWheel);
        }

        MediaViewer.instance = null;
    }

    /**
     * ***************************************************************************
     * Шаблон формы.
     * @returns Разборный DOM-элемент просмотрщика.
     * ***************************************************************************
     */
    _template(): HTMLElement {
        const isBlur = LocalStorage?.session?.settings?.user?.decorations?.blur || false;

        // Порядок слоёв задаёт обёртка диалога (см. `CDM_Z_INDEX` в
        // `js/config/constants.js`): свой z-index на корне не действует —
        // обёртка создаёт свой stacking context, а внутренние z-10…z-60
        // работают, сравниваясь между собой
        const root = new DOMParser().parseFromString(`
            <div class="cdm-modal image-viewer w-full h-full flex p-0 inset-0 justify-center">
                <div class="absolute inset-0 bg-black/90"></div>
                <div class="cdm-iv-loader hidden absolute z-[60]"></div>
                
                <div class="cdm-iv-container relative w-full h-full flex items-center justify-center z-10 overflow-hidden">
                    <button class="cdm-iv-btn cdm-iv-prev absolute cursor-pointer z-20 p-1 w-[5rem] rounded-full aspect-1/1 left-2 text-white ${isBlur ? "bg-white/10 dark:bg-white/10 backdrop-blur-[20px]" : "bg-black/50 dark:bg-black/80"}">‹</button>
                    
                    <div class="cdm-iv-stage w-full h-full flex items-center justify-center action-none cursor-grab relative" ondragstart="return false;">
                        <div class="cdm-iv-track w-full h-full relative will-change-[transform,opacity] select-none">
                            <div class="cdm-iv-slide absolute inset-0 flex items-center justify-center -translate-x-full" data-slot="prev"></div>
                            <div class="cdm-iv-slide absolute inset-0 flex items-center justify-center z-10" data-slot="active"></div>
                            <div class="cdm-iv-slide absolute inset-0 flex items-center justify-center translate-x-full" data-slot="next"></div>
                        </div>
                    </div>

                    <button class="cdm-iv-btn cdm-iv-next absolute cursor-pointer z-20 p-1 w-[5rem] rounded-full aspect-1/1 right-2 text-white ${isBlur ? "bg-white/10 dark:bg-white/10 backdrop-blur-[20px]" : "bg-black/50 dark:bg-black/80"}">›</button>
                    <div class="cdm-iv-counter absolute bottom-[1rem] p-2 rounded-xl z-20 text-white ${isBlur ? "bg-white/10 dark:bg-white/10 backdrop-blur-[20px]" : "bg-black/50 dark:bg-black/80"}"></div>
                    ${Buttons.circle({ intent: "transparent", attributes: ["action-close"], classes: ["absolute", "top-[1rem]", "right-[1rem]", "z-30"], icon: "X" })}
                </div>
            </div>
        `, "text/html").querySelector<HTMLElement>(".cdm-modal");

        // invariant: шаблон — наши строки, корневой .cdm-modal в нём всегда есть
        if (!(root instanceof HTMLElement)) {
            throw new TypeError("MediaViewer: шаблон .cdm-modal не найден");
        }

        return root;
    }
}
