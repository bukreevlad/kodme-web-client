// Импортируем сторонние пакеты
import { OverlayScrollbars } from "overlayscrollbars";

// Импортируем config
import { CDM_MODAL_CLASSES, CDM_MODAL_FOOTER_CLASSES } from "../../config/constants.js";
import type { EmojiItem } from "../../config/emoji.js";

// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";
import { Icons } from "../../utils/icons.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Buttons } from "../../components/buttons.js";
import { EmptyState } from "../../components/empty_state.js";
import { Tabs } from "../../components/tabs.js";

// Импортируем functions
import { loadEmoji } from "./functions/load_emoji.js";
import { loadStickerPaks } from "./functions/load_sticker_paks.js";
import { backToPaks } from "./functions/back_to_paks.js";
import { showSticker } from "./functions/show_sticker.js";

// Импортируем типы
import type { StickerSelectCallback, EmojiFocusSticker } from "./types.js";

/**
 * Настройки панели эмодзи (позиционирование и монтирование — те же поля,
 * что принимает Overlay).
 */
export interface EmojiOptions {
    /** Куда вставить форму. */
    insertInto?: HTMLElement | null | undefined;
    /** Целевой элемент DOM, относительно которого позиционируется панель. */
    targetNode?: HTMLElement | null | undefined;
    /** Направление открытия относительно targetNode. */
    targetNodeDirection?: string | string[] | undefined;
    /** Координата X для отображения. */
    x?: number | undefined;
    /** Координата Y для отображения. */
    y?: number | undefined;
    /** Отступы от targetNode. */
    margin?: number | number[] | undefined;
}

/**
 * Обработчик выбора эмодзи в панели.
 * @param item - Выбранное эмодзи (символ и техническое имя).
 */
export type EmojiSelectCallback = (item: EmojiItem) => void;

/**
 * Данные конструктора формы эмодзи.
 */
export interface EmojiFormData {
    /** Настройки панели. */
    options?: EmojiOptions;
    /** Обработчик выбора эмодзи. */
    callback?: EmojiSelectCallback;
    /** Обработчик выбора стикера (нужен при showStickers). */
    stickerCallback?: StickerSelectCallback;
    /** Показывать ли таб «Стикеры» (по умолчанию false). */
    showStickers?: boolean;
    /** Стикер, к которому перейти при открытии (таб «Стикеры», сетка пака). */
    focusSticker?: EmojiFocusSticker | null | undefined;
}

// Form
export class Emoji {

    /** Переменная для хранения единственного экземпляра формы */
    static instance: Emoji | null = null;

    /** Настройки формы. */
    options: EmojiOptions;

    /** Шаблон формы. */
    tpl: HTMLElement | null = null;

    /** Модальное окно формы. */
    modal: Overlay | null = null;

    /** Обработчик выбора эмодзи. */
    callback: EmojiSelectCallback | null = null;

    /** Обработчик выбора стикера (таб «Стикеры»). */
    stickerCallback: StickerSelectCallback | null = null;

    /** Показывать ли таб «Стикеры». */
    showStickers: boolean = false;

    /** Стикер, к которому перейти при открытии (null — перехода нет). */
    focusSticker: EmojiFocusSticker | null = null;

    /** Инстанс OverlayScrollbars контента эмодзи. */
    osListScrollInstance: OverlayScrollbars | null = null;

    /** Инстанс OverlayScrollbars контента панели стикеров. */
    osStickersScrollInstance: OverlayScrollbars | null = null;

    /** Контент формы (для скроллбара). */
    content: HTMLElement | null = null;

    /** Контент панели стикеров (для скроллбара). */
    stickersContent: HTMLElement | null = null;

    /** Список категорий эмодзи (DOM). */
    list: HTMLElement | null = null;

    /** Менеджер табов (только при showStickers). */
    tabs: Tabs | null = null;

    /** Список паков (стадия 1 панели стикеров). */
    paksList: HTMLElement | null = null;

    /** Блок стадии 2 (стикеры открытого пака). */
    stickersView: HTMLElement | null = null;

    /** Сетка стикеров пака (стадия 2). */
    stickersGrid: HTMLElement | null = null;

    /** Название открытого пака (стадия 2). */
    pakName: HTMLElement | null = null;

    /** Пустое состояние панели стикеров (список паков пуст). */
    stickersEmpty: HTMLElement | null = null;

    /** Пустое состояние открытого пака (пак без стикеров). */
    stickersPakEmpty: HTMLElement | null = null;

    /** Паки панели уже загружались (грузятся один раз за жизнь формы). */
    isPaksLoaded: boolean = false;

    /** Список паков пуст (для пустого состояния на стадии 1). */
    isPaksEmpty: boolean = false;

    /**
     * ***************************************************************************
     * Форма.
     * @param data - Данные формы.
     * @param data.callback - Обработчик выбора эмодзи.
     * @param data.stickerCallback - Обработчик выбора стикера.
     * @param data.showStickers - Показывать ли таб «Стикеры».
     * @param data.focusSticker - Стикер, к которому перейти при открытии.
     * @param data.options - Настройки формы.
     * ***************************************************************************
     */
    constructor(data: EmojiFormData) {

        // Устанавливаем настройки
        this.options = {
            insertInto: data.options?.insertInto,
            targetNode: data.options?.targetNode,
            targetNodeDirection: data.options?.targetNodeDirection,
            x: data.options?.x,
            y: data.options?.y,
            margin: data.options?.margin,
            ...data?.options
        }

        // Обработчик выбора эмодзи
        this.callback = data.callback ?? null;

        // Обработчик выбора стикера и флаг таба
        this.stickerCallback = data.stickerCallback ?? null;
        this.showStickers = data.showStickers === true;

        // Стикер, к которому перейти при открытии
        this.focusSticker = data.focusSticker ?? null;

        // Проверяем, существует ли уже экземпляр
        if (Emoji.instance) {
            return Emoji.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        Emoji.instance = this;

        // Инициализация
        this._init();

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

            if (!this.tpl) return;

            // Форма
            this.modal = new Overlay(this.tpl, {
                type: "popover",
                fit: "shrink",
                url: `?emoji`,
                insertInto: this.options.insertInto,
                targetNode: this.options?.targetNode,
                targetNodeDirection: this.options?.targetNodeDirection,
                margin: this.options.margin || [0, 0, 10, 0],
                overlay: true,
                closeOnOverlay: true,
                onBeforeOpen: async () => await this._onBeforeOpen(),
                onOpen: () => this._onOpen(),
                onBeforeClose: () => this._onBeforeClose()
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

            // Закрыть
            const close = this.tpl?.querySelector(":scope >.footer [action-close]");
            close?.addEventListener("click", () => this.modal?.close());

            // Назад к списку паков (кнопка живёт в стадии 2 панели стикеров)
            if (this.showStickers) {
                const back = this.tpl?.querySelector<HTMLElement>(":scope [data-back]");
                back?.addEventListener("click", () => backToPaks(this));
            }

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Настройка формы
    // ***************************************************************************
    async _onBeforeOpen(): Promise<void> {

        try {

            // Устанавливаем элементы эмодзи
            this.content = this.tpl?.querySelector<HTMLElement>(":scope >.cdm-tabs-content >[data-target=\"emoji\"] >.content") ?? null;
            this.list = this.tpl?.querySelector<HTMLElement>(":scope >.cdm-tabs-content >[data-target=\"emoji\"] >.content >[data-list]") ?? null;

            // Инициализируем скролл эмодзи
            if (this.content) {
                this.osListScrollInstance = OverlayScrollbars(this.content, {
                scrollbars: { autoHide: "scroll" }, overflow: { x: "hidden", y: "scroll" }
                });
            }

            // Загружаем Emoji
            loadEmoji(this);

            // Панель стикеров настраивается только по запросу формы
            if (this.showStickers) this._initStickersPanel();

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Приватная: настройка панели стикеров (таб, скроллбар, элементы)
    // ***************************************************************************
    _initStickersPanel(): void {

        try {

            // Устанавливаем элементы панели стикеров
            this.stickersContent = this.tpl?.querySelector<HTMLElement>(":scope >.cdm-tabs-content >[data-target=\"stickers\"] >.content") ?? null;
            this.paksList = this.tpl?.querySelector<HTMLElement>(":scope [data-paks-list]") ?? null;
            this.stickersView = this.tpl?.querySelector<HTMLElement>(":scope [data-stickers-view]") ?? null;
            this.stickersGrid = this.tpl?.querySelector<HTMLElement>(":scope [data-stickers-grid]") ?? null;
            this.pakName = this.tpl?.querySelector<HTMLElement>(":scope [data-pak-name]") ?? null;
            this.stickersEmpty = this.tpl?.querySelector<HTMLElement>(":scope [data-stickers-empty]") ?? null;
            this.stickersPakEmpty = this.tpl?.querySelector<HTMLElement>(":scope [data-stickers-pak-empty]") ?? null;

            // Инициализируем скроллбар панели стикеров
            if (this.stickersContent) {
                this.osStickersScrollInstance = OverlayScrollbars(this.stickersContent, {
                    scrollbars: { autoHide: "scroll" }, overflow: { x: "hidden", y: "scroll" }
                });
            }

            // Собираем менеджер табов (без него панель стикеров недостижима)
            const links = this.tpl?.querySelector<HTMLElement>(":scope >[data-tabs] >[data-tabs-list]");
            const panes = this.tpl?.querySelector<HTMLElement>(":scope >.cdm-tabs-content");
            if (!links || !panes) return;

            this.tabs = new Tabs([{ tabs: links, scrollType: "horizontal" }], panes);

            // При первом открытии таба «Стикеры» грузим список паков
            this.tabs.activationCallbacks["stickers"] = () => loadStickerPaks(this);

        } catch (error) {
            Logger.error("[app][emoji][stickers-panel]:", error);
        }

    }

    // ***************************************************************************
    // Форма открылась
    // ***************************************************************************
    _onOpen(): void {

        this._handlers();

        // Переход к стикеру, если форма открыта для него
        if (this.focusSticker) showSticker(this, this.focusSticker);

    }

    // ***************************************************************************
    // Действия при закрытии формы
    // ***************************************************************************
    _onBeforeClose(): void {

        // Удаляем экземпляр формы
        Emoji.instance = null;

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    /**
     * ***************************************************************************
     * Шаблон формы.
     *
     * Геометрия: модалка — flex-колонка; при showStickers контент живёт в pane
     * внутри `.cdm-tabs-content`, поэтому у контейнера и pane стоит `min-h-0` —
     * иначе `min-height: auto` флекс-элементов остановит сжатие по `max-h-full`
     * модалки и скролл OverlayScrollbars умрёт (контент просто обрежется).
     * `min-w` фиксирует минимальную ширину popover: при переключении табов
     * ширина не прыгает. При showStickers модалка получает жёсткую ширину
     * `w-[min(22rem,100%)]`: ширина стабильна при любом составе панели, а
     * `min` заодно подгоняет её под узкие экраны (PWA); сетка стикеров —
     * фиксированные колонки (grid-cols-4), перенос клеток не влияет на ширину.
     * @returns DOM-элемент формы либо null.
     * ***************************************************************************
     */
    _template(): HTMLElement | null {

        return new DOMParser().parseFromString(`

            <div class="cdm-modal emoji flex flex-col gap-0 ${this.showStickers ? "w-[min(22rem,100%)]" : "min-w-[22rem]"} ${CDM_MODAL_CLASSES()}">

                ${this.showStickers ? `

                    <div data-tabs class="p-1 mb-0 w-full relative bg-[var(--second-bg)] rounded-3xl overflow-hidden flex-shrink-0">
                        <div data-tabs-list class="cdm-tabs flex flex-row gap-1 w-full rounded-3xl overflow-x-auto scrollbar-none">
                            <div data-target="emoji" class="item flex flex-row flex-1 justify-center flex-shrink-0 gap-2 p-2 items-center rounded-lg transition-colors duration-150 cursor-pointer hover:text-[var(--text-color)] hover:bg-[var(--second-bg)] active:bg-[var(--second-bg)] [&.active]:text-[var(--text-color)] [&.active]:font-semibold [&.active]:bg-[var(--second-bg)] active">${window._lc.forms.emoji.tabs.emoji}</div>
                            <div data-target="stickers" class="item flex flex-row flex-1 justify-center flex-shrink-0 gap-2 p-2 items-center rounded-lg transition-colors duration-150 cursor-pointer hover:text-[var(--text-color)] hover:bg-[var(--second-bg)] active:bg-[var(--second-bg)] [&.active]:text-[var(--text-color)] [&.active]:font-semibold [&.active]:bg-[var(--second-bg)]">${window._lc.forms.emoji.tabs.stickers}</div>
                        </div>
                    </div>

                ` : ""}

                <div class="cdm-tabs-content relative overflow-hidden flex w-full flex-col flex-1 min-h-0">

                    <div data-target="emoji" class="item flex flex-col w-full min-h-0 active">
                        <div class="content w-full flex flex-col gap-3">
                            <div data-list class="flex flex-col gap-3 p-3"></div>
                        </div>
                    </div>

                    ${this.showStickers ? `

                        <div data-target="stickers" class="item flex flex-col w-full min-h-0">
                            <div class="content w-full flex flex-col gap-0">

                                <div data-paks-list class="flex flex-col gap-1 p-2 w-full"></div>

                                <div data-stickers-view class="flex flex-col gap-0 w-full hidden">
                                    <div class="flex flex-row gap-2 p-2 items-center">
                                        <button data-back class="flex flex-row gap-2 items-center p-2 rounded-lg hover:bg-[var(--second-bg)] active:bg-[var(--second-bg)] cursor-pointer text-secondary">
                                            ${Icons.icon("arrow-left")?.outerHTML ?? ""}
                                            <span>${window._lc.forms.emoji.stickers.back}</span>
                                        </button>
                                        <span data-pak-name class="flex flex-row gap-2 items-center font-semibold truncate"></span>
                                    </div>
                                    <div data-stickers-grid class="grid grid-cols-4 gap-1 p-2 w-full"></div>
                                </div>

                                ${EmptyState.create({
                                    title: window._lc.forms.emoji.stickers.empty_title,
                                    description: window._lc.forms.emoji.stickers.empty_desc,
                                    icon: "sticker",
                                    compact: true,
                                    attributes: ["data-stickers-empty"],
                                    classes: ["hidden"]
                                })}

                                ${EmptyState.create({
                                    title: window._lc.forms.emoji.stickers.pak_empty_title,
                                    description: window._lc.forms.emoji.stickers.pak_empty_desc,
                                    icon: "sticker",
                                    compact: true,
                                    attributes: ["data-stickers-pak-empty"],
                                    classes: ["hidden"]
                                })}

                            </div>
                        </div>

                    ` : ""}

                </div>

                <div class="${CDM_MODAL_FOOTER_CLASSES()}">
                    ${Buttons.create({ attributes: ["action-close"], classes: ["w-full"], icon: "x" })}
                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-modal");

    }

}
