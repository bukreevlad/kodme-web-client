// Импортируем utils
import { GestureController } from "../../utils/gesture_controller.js";
import { CacheManager } from "../../utils/cache_manager.js";
import { Logger } from "../../utils/logs/logger.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Buttons } from "../../components/buttons.js";
import { t } from "../../utils/i18n/index.js";

/**
 * Данные для создания кроппера.
 */
export interface ImageCropperData {
    /** Ссылка на изображение. */
    imageUrl?: string;
}

/**
 * Прямоугольник обрезки в натуральных пикселях исходника.
 */
export interface CropRectangle {
    /** Отступ слева. */
    x: number;
    /** Отступ сверху. */
    y: number;
    /** Ширина области. */
    width: number;
    /** Высота области. */
    height: number;
}

/**
 * Данные, отдаваемые в `onSave` после обрезки.
 */
export interface ImageCropperSaveData {
    /** Исходная ссылка на изображение. */
    source: string;
    /** Прямоугольник обрезки в натуральных пикселях. */
    coords: CropRectangle;
}

/**
 * Настройки кроппера и модального окна.
 */
export interface ImageCropperOptions {
    /** Максимальный зум. */
    maxZoom?: number;
    /** Обработчик сохранения обрезки. */
    onSave?: ((data: ImageCropperSaveData) => void) | null;
    /** Закрывать ли по Escape. */
    closeOnEsc?: boolean;
    /** Закрывать ли по клику на оверлей. */
    closeOnOverlay?: boolean;
    /** Куда вставить модальное окно. */
    insertInto?: HTMLElement | null;
}

/**
 * Элементы шаблона кроппера (заполняются перед открытием).
 */
interface CropperElements {
    /** Корневой элемент шаблона. */
    wrap?: HTMLElement | null;
    /** Сцена с жестами. */
    stage?: HTMLElement | null;
    /** Канвас с трансформацией (зум/сдвиг). */
    canvas?: HTMLElement | null;
    /** Изображение. */
    img?: HTMLImageElement | null;
    /** Круглая область вырезки. */
    selection?: HTMLElement | null;
    /** Кнопка закрытия. */
    btnClose?: HTMLElement | null;
    /** Кнопка сохранения. */
    btnSave?: HTMLElement | null;
    /** Кнопка отмены. */
    btnCancel?: HTMLElement | null;
}

/**
 * ***************************************************************************
 * Обрезка изображений
 * ***************************************************************************
 */
export class ImageCropper {

    // Переменная для хранения единственного экземпляра
    static instance: ImageCropper | null = null;

    /** Ссылка на изображение. */
    imageUrl: string;

    /** Настройки кроппера и модального окна. */
    options: ImageCropperOptions;

    /** Шаблон формы. */
    tpl: HTMLElement | null = null;

    /** Модальное окно формы. */
    modal: Overlay | null = null;

    /** Элементы шаблона. */
    elements: CropperElements = {};

    /** Текущий зум. */
    zoom: number = 1;

    /** Смещение по X. */
    posX: number = 0;

    /** Смещение по Y. */
    posY: number = 0;

    /** Смещение по X на начало pan-жеста. */
    startPosX: number = 0;

    /** Смещение по Y на начало pan-жеста. */
    startPosY: number = 0;

    /** Зум на начало pinch-жеста. */
    startZoom: number = 1;

    /** Контроллер жестов. */
    gestures: GestureController | null = null;

    /** Время последнего тапа (детект двойного тапа). */
    lastTapTime: number = 0;

    /** Блокировка фантомных тапов. */
    _tapBlocker: boolean = false;

    /** Привязанный обработчик скролла колесом (для снятия слушателя). */
    boundHandleWheel: (e: WheelEvent) => void;

    /**
     * ***************************************************************************
     * Создает экземпляр ImageCropper
     * @param data - Данные и настройки.
     * @param data.imageUrl - Ссылка на изображение.
     * @param options - Настройки кроппера и модального окна.
     * ***************************************************************************
     */
    constructor(data: ImageCropperData = {}, options: ImageCropperOptions = {}) {

        this.imageUrl = data.imageUrl || "";
        this.options = {
            maxZoom: 4,
            onSave: null,
            closeOnEsc: true,
            closeOnOverlay: true,
            ...options
        };

        this.boundHandleWheel = (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            this._updateZoom(this.zoom * delta, e.clientX, e.clientY);
        };

        // Проверяем, существует ли уже экземпляр
        if (ImageCropper.instance) {
            return ImageCropper.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        ImageCropper.instance = this;

        // Инициализация
        this._init();
    }

    // ***************************************************************************
    // Инициализация
    // ***************************************************************************
    async _init(): Promise<void> {
        await this._open();
    }

    // ***************************************************************************
    // Открытие
    // ***************************************************************************
    async _open(): Promise<void> {

        try {

            // Шаблон формы
            this.tpl = this._template();

            // Без шаблона открывать форму не из чего
            if (!this.tpl) return;

            // Создаем модальное окно через единый класс Overlay
            this.modal = new Overlay(this.tpl, {
                type: "modal",
                url: `?image-cropper`,
                insertInto: this.options.insertInto,
                closeOnOverlay: this.options.closeOnOverlay,
                closeOnEsc: this.options.closeOnEsc,
                // легаси: false ≡ null в CSS-пресете (оба falsy — отступы не вешаются)
                wrapPadding: null,
                overlayBlur: true,
                onBeforeOpen: async () => await this._onBeforeOpen(),
                onOpen: () => this._onOpen(),
                onBeforeClose: () => this._onBeforeClose()
            });

            // Открываем модальное окно
            this.modal.open();

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Настройка перед открытием
    // ***************************************************************************
    async _onBeforeOpen(): Promise<void> {

        try {

            // Элементы заполняются из шаблона — без него нечего настраивать
            if (!this.tpl) return;

            // Сохраняем ссылки на элементы внутри шаблона
            this.elements.wrap = this.tpl;
            this.elements.stage = this.tpl.querySelector<HTMLElement>(".cdm-ic-stage");
            this.elements.canvas = this.tpl.querySelector<HTMLElement>(".cdm-ic-canvas");
            this.elements.img = this.tpl.querySelector<HTMLImageElement>(".cdm-ic-image");
            this.elements.selection = this.tpl.querySelector<HTMLElement>(".cdm-ic-selection");
            this.elements.btnClose = this.tpl.querySelector<HTMLElement>("[action-close]");
            this.elements.btnSave = this.tpl.querySelector<HTMLElement>("[action-save]");
            this.elements.btnCancel = this.tpl.querySelector<HTMLElement>("[action-cancel]");

            // Инициализация жестового контроллера и загрузка картинки
            this._initGestures();
            await this._loadImage();

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Форма открылась
    // ***************************************************************************
    _onOpen(): void {
        this._handlers();
    }

    // ***************************************************************************
    // Обработчики событий
    // ***************************************************************************
    _handlers(): void {

        try {

            // Кнопка сохранения
            this.elements.btnSave?.addEventListener("click", () => this._handleSave());

            // Кнопки отмены и закрытия
            this.elements.btnCancel?.addEventListener("click", () => this.close());
            this.elements.btnClose?.addEventListener("click", () => this.close());

            // События скролла колесом
            this.elements.stage?.addEventListener("wheel", this.boundHandleWheel, { passive: false });

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Действия перед закрытием
    // ***************************************************************************
    _onBeforeClose(): void {

        this.gestures?.destroy();

        if (this.elements.stage) {
            this.elements.stage.removeEventListener("wheel", this.boundHandleWheel);
        }

        this.elements = {};

        // Сбрасываем Singleton
        ImageCropper.instance = null;

    }

    // ***************************************************************************
    // Закрытие (вызов метода из экземпляра Overlay)
    // ***************************************************************************
    close(): void {
        this.modal?.close();
    }

    // ***************************************************************************
    // Шаблон элемента
    // ***************************************************************************
    _template(): HTMLElement | null {

        // Порядок слоёв задаёт обёртка диалога — она создаёт свой
        // stacking context; см. `CDM_Z_INDEX` в `js/config/constants.js`
        return new DOMParser().parseFromString(`
            <div class="cdm-modal image-cropper absolute flex p-0 inset-0 justify-center">
                <div class="absolute inset-0 bg-black/90"></div>
                <div class="cdm-ic-container relative w-full h-full flex flex-col z-10 select-none touch-none">
                    <div class="cdm-ic-stage flex flex-1 relative cursor-grab">
                        <div class="cdm-ic-canvas absolute inset-0 size-full flex items-center justify-center will-change-transform">
                            <img class="cdm-ic-image max-w-[90%] max-h-[90%] block pointer-events-none rounded-md" draggable="false" src="">
                        </div>
                        <div class="cdm-ic-selection rounded-full absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[280px] border-2 border-[--ic-selection-border-color] shadow-[0_0_0_4000px_var(--ic-selection-bg)] pointer-events-none z-10"></div>
                    </div>

                    ${Buttons.circle({ intent: "transparent", attributes: ["action-close"], classes: ["absolute", "top-[1rem]", "right-[1rem]", "z-30"], icon: "X" })}

                    <div class="cdm-ic-controls absolute bottom-0 w-full flex justify-center z-20 gap-3 p-3">
                        ${Buttons.create({ attributes: ["action-cancel"], text: t("forms.image_cropper.cancel") })}
                        ${Buttons.primary({ attributes: ["action-save"], text: t("forms.image_cropper.crop") })}
                    </div>
                </div>
            </div>
        `, "text/html").querySelector<HTMLElement>(".cdm-modal");

    }

    // ===========================================================================
    // Внутренний функционал обрезки (зум, жест, логика сохранения)
    // ===========================================================================

    async _loadImage(): Promise<void> {

        try {

            let finalUrl = this.imageUrl;

            // Если это внешняя ссылка (не blob), пытаемся взять из кэша
            if (this.imageUrl && !this.imageUrl.startsWith("blob:") && !this.imageUrl.startsWith("data:")) {

                // getMediaSrc отдаёт строку URL, которую перехватывает Service
                // Worker — она подставляется в src напрямую, без
                // URL.createObjectURL (он бросает TypeError на строке)
                const mediaUrl = CacheManager.getMediaSrc({
                    url: this.imageUrl,
                    file_token: "",
                    type: "image"
                });

                if (mediaUrl) {
                    finalUrl = mediaUrl;
                }

            }

            // Картинка — обязательный элемент шаблона: без неё кропить нечего
            const img = this.elements.img;
            if (!img) throw new Error("[image-cropper]: не найдено изображение");

            img.src = finalUrl;

            img.onload = () => {
                this._constrainPosition();
                this._applyTransform();
            };

        } catch (e) {
            Logger.error("Cropper Load Error", e);
            if (this.elements.img) {
                this.elements.img.src = this.imageUrl;
            }
        }

    }

    _constrainPosition(): void {

        const img = this.elements.img;
        const sel = this.elements.selection;

        if (!img || !sel || !img.offsetWidth) return;

        const selW = sel.offsetWidth;
        const selH = sel.offsetHeight;

        const minZoom = Math.max(selW / img.offsetWidth, selH / img.offsetHeight);
        if (this.zoom < minZoom) this.zoom = minZoom;

        const limitX = Math.max((img.offsetWidth * this.zoom - selW) / 2, 0);
        const limitY = Math.max((img.offsetHeight * this.zoom - selH) / 2, 0);

        this.posX = Math.min(Math.max(this.posX, -limitX), limitX);
        this.posY = Math.min(Math.max(this.posY, -limitY), limitY);

    }

    _initGestures(): void {

        // Сцена — обязательный элемент шаблона: без неё жесты не инициализировать
        const stage = this.elements.stage;
        if (!stage) return;

        this.gestures = new GestureController(stage, {
            pan: {
                freeMove: true,
                onStart: () => {
                    this.startPosX = this.posX;
                    this.startPosY = this.posY;
                },
                onMove: (dx, dy) => {
                    this.posX = this.startPosX + dx;
                    this.posY = this.startPosY + dy;
                    this._constrainPosition();
                    this._applyTransform();
                }
            },
            pinch: {
                onStart: () => {
                    this.startZoom = this.zoom;
                },
                onMove: (scale, midpoint) => {
                    this._updateZoom(this.startZoom * scale, midpoint.x, midpoint.y);
                }
            },
            tap: {
                onTap: (event) => {
                    if (this._tapBlocker) return;
                    this._tapBlocker = true;
                    setTimeout(() => { this._tapBlocker = false; }, 50);

                    const now = performance.now();
                    const diff = now - this.lastTapTime;

                    if (diff > 50 && diff < 300) {

                        // invariant: у TouchEvent нет координат в формате
                        // pos.x/pos.y — читаем clientX/clientY только у MouseEvent,
                        // иначе двойной тап зумит в центр (_updateZoom: focalX ?? centerX)
                        const focalX = event instanceof MouseEvent ? event.clientX : undefined;
                        const focalY = event instanceof MouseEvent ? event.clientY : undefined;

                        this.toggleZoom(focalX, focalY);
                        this.lastTapTime = 0;
                    } else {
                        this.lastTapTime = now;
                    }
                }
            }
        });

    }

    _updateZoom(newZoom: number, focalX?: number, focalY?: number): void {

        const oldZoom = this.zoom;
        // Фолбэк 4 повторяет дефолт конструктора — он защищает тип,
        // если вызывающий явно передал maxZoom: undefined
        this.zoom = Math.min(Math.max(0.1, newZoom), this.options.maxZoom ?? 4);

        const stage = this.elements.stage;
        if (!stage) return;
        const stageRect = stage.getBoundingClientRect();
        const centerX = stageRect.left + stageRect.width / 2;
        const centerY = stageRect.top + stageRect.height / 2;

        const focalRelX = (focalX ?? centerX) - centerX;
        const focalRelY = (focalY ?? centerY) - centerY;

        const ratio = this.zoom / oldZoom;
        this.posX = focalRelX - (focalRelX - this.posX) * ratio;
        this.posY = focalRelY - (focalRelY - this.posY) * ratio;

        this._constrainPosition();
        this._applyTransform();

    }

    toggleZoom(focalX?: number, focalY?: number): void {

        const target = this.zoom > 1.5 ? 1 : 2.5;
        this._applyTransform(true);
        this._updateZoom(target, focalX, focalY);

        setTimeout(() => {
            if (this.elements.canvas) this.elements.canvas.style.transition = "none";
        }, 200);

    }

    _applyTransform(animate = false): void {

        if (!this.elements.canvas) return;
        this.elements.canvas.style.transition = animate ? "transform 0.2s ease-out" : "none";
        this.elements.canvas.style.transform = `translate3d(${this.posX}px, ${this.posY}px, 0) scale(${this.zoom})`;

    }

    getCropData(): CropRectangle {

        // Элементы кропа обязательны к моменту вырезания —
        // отсутствие это ошибка
        const img = this.elements.img;
        const selection = this.elements.selection;
        if (!img || !selection) throw new Error("[image-cropper]: не найдены элементы кропа");

        const selRect = selection.getBoundingClientRect();
        const imgRect = img.getBoundingClientRect();

        const relX = (selRect.left - imgRect.left) / this.zoom;
        const relY = (selRect.top - imgRect.top) / this.zoom;
        const relW = selRect.width / this.zoom;
        const relH = selRect.height / this.zoom;

        const factor = img.naturalWidth / img.offsetWidth;

        return {
            x: Math.round(relX * factor),
            y: Math.round(relY * factor),
            width: Math.round(relW * factor),
            height: Math.round(relH * factor)
        };

    }

    _handleSave(): void {

        const cropData = this.getCropData();

        if (this.options.onSave) {
            this.options.onSave({
                source: this.imageUrl,
                coords: cropData
            });
        }

        this.close();

    }

}
