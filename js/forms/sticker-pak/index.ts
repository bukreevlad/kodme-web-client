// Импортируем сторонние пакеты
import { OverlayScrollbars } from "overlayscrollbars";

// Импортируем config
import { CDM_FORM_CLASSES, CDM_FORM_HEADER_CLASSES, CDM_FORM_CONTENT_CLASSES } from "../../config/constants.js";

// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Buttons } from "../../components/buttons.js";
import { EmptyState } from "../../components/empty_state.js";

// Импортируем functions
import { loadStickerPak } from "./functions/load_pak.js";

// Импортируем handlers
import { addStickerHandler } from "./handlers/add_sticker.js";
import { subscribeHandler } from "./handlers/subscribe.js";

// Импортируем типы
import { StickerItem, StickerPakData } from "./types.js";

/**
 * Настройки формы содержимого пака стикеров.
 */
export interface StickerPakOptions {

    /** Id пака. */
    pakId: string;

    /** Куда вставить форму. */
    insertInto?: HTMLElement | null;

}

// Form
export class StickerPak {

    // Реестр открытых форм по id пака: один пак — одна форма
    static instances = new Map<string, StickerPak>();

    /** Настройки формы. */
    options: StickerPakOptions;

    /** Id пака. */
    pakId: string;

    /** Шаблон формы. */
    tpl: HTMLElement | null = null;

    /** Модальное окно формы. */
    modal: Overlay | null = null;

    /** Контент формы (скролл-контейнер OverlayScrollbars). */
    content: HTMLElement | null = null;

    /** Сетка стикеров. */
    list: HTMLElement | null = null;

    /** Блок пустого состояния сетки. */
    empty: HTMLElement | null = null;

    /** Инстанс OverlayScrollbars списка. */
    osListScrollInstance: OverlayScrollbars | null = null;

    /** Слот прогресса загрузки нового стикера. */
    progressSlot: HTMLElement | null = null;

    /** Данные пака (заполняются в functions/load_pak.ts). */
    pak: StickerPakData | null = null;

    /** Стикеры пака (порядок — как отдал сервер). */
    stickers: StickerItem[] = [];

    /** Контроллер отмены текущей загрузки стикера (закрытие формы рвёт её). */
    uploadController: AbortController | null = null;

    /**
     * ***************************************************************************
     * Форма.
     * @param data - Данные.
     * @param data.pakId - Id пака.
     * @param data.insertInto - Куда вставить форму.
     * ***************************************************************************
     */
    constructor(data: StickerPakOptions) {

        // Устанавливаем настройки
        this.options = {
            insertInto: document.querySelector<HTMLElement>(".cdm-form.home .left"),
            ...data
        }

        // Id пака обязателен — без него форма не о чём
        this.pakId = data.pakId;

        // Проверяем, открыт ли уже этот пак
        const existing = StickerPak.instances.get(this.pakId);
        if (existing) {
            return existing;
        }

        // Сохраняем ссылку в реестр
        StickerPak.instances.set(this.pakId, this);

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
                type: "form",
                url: `?stickers&paks=${this.pakId}`,
                insertInto: this.options.insertInto,
                closeOnEsc: false,
                closeOnOverlay: false,
                onBeforeOpen: async () => await this._onBeforeOpen(),
                onOpen: () => this._onOpen(),
                onBeforeClose: () => this._onBeforeClose()
            });

            // Открываем форму
            this.modal.open();

        } catch (error) {
            Logger.error("[app][sticker-pak][open]:", error);
        }

    }

    // ***************************************************************************
    // Обработчики
    // ***************************************************************************
    _handlers(): void {

        try {

            // Обработчики вешаются на узлы шаблона — без него нечего слушать
            if (!this.tpl) return;

            // Назад
            let close = this.tpl.querySelector(":scope >.header [action-close]");
            close?.addEventListener("click", () => this.modal?.close());

            // Добавить стикер (кнопка видна только автору — см. functions/load_pak.ts)
            let add = this.tpl.querySelector(":scope >.header [action-add]");
            add?.addEventListener("click", () => addStickerHandler(this));

            // Добавить пак к себе (кнопка видна для чужого публичного пака — см. functions/load_pak.ts)
            let subscribe = this.tpl.querySelector(":scope >.header [action-subscribe]");
            subscribe?.addEventListener("click", () => subscribeHandler(this));

        } catch (error) {
            Logger.error("[app][sticker-pak][handlers]:", error);
        }

    }

    // ***************************************************************************
    // Настройка формы
    // ***************************************************************************
    async _onBeforeOpen(): Promise<void> {

        try {

            // Элементы заполняются из шаблона — без него нечего настраивать
            if (!this.tpl) return;

            // Устанавливаем контейнеры
            this.content = this.tpl.querySelector(":scope >.content");
            this.list = this.tpl.querySelector(":scope >.content [data-list]");
            this.empty = this.tpl.querySelector(":scope >.content [data-empty]");
            this.progressSlot = this.tpl.querySelector(":scope >.content [data-progress]");

            // Инициализируем элементы (скролл-контейнер входит в шаблон)
            const content = this.content;
            if (content) {
                this.osListScrollInstance = OverlayScrollbars(content, {
                    scrollbars: { autoHide: "scroll" }, overflow: { x: "hidden", y: "scroll" }
                });
            }

            // Загружаем пак со стикерами
            await loadStickerPak(this);

        } catch (error) {
            Logger.error("[app][sticker-pak][before-open]:", error);
        }

    }

    // ***************************************************************************
    // Форма открылась
    // ***************************************************************************
    _onOpen(): void {

        this._handlers();

    }

    // ***************************************************************************
    // Действия при закрытии формы
    // ***************************************************************************
    _onBeforeClose(): void {

        // Закрытие формы рвёт незавершённую загрузку стикера
        this.uploadController?.abort();
        this.uploadController = null;

        // Удаляем экземпляр из реестра
        StickerPak.instances.delete(this.pakId);

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement | null {

        // invariant: корневой .cdm-form входит в сам шаблон — querySelector
        // с текстовым HTML всегда находит его
        return new DOMParser().parseFromString(`

            <div class="cdm-form sticker-pak flex flex-col ${CDM_FORM_CLASSES()} w-full">
                <div class="header flex flex-row gap-2 p-2 items-center justify-between ${CDM_FORM_HEADER_CLASSES()}">
                    <div class="flex flex-row gap-2 items-center min-w-0">
                        ${Buttons.transparent({ shape: "circle", attributes: ["action-close"], icon: "ArrowLeft" })}
                        <span data-title class="flex flex-row gap-2 items-center font-semibold text-lg truncate"></span>
                    </div>
                    <div class="flex flex-row gap-2 items-center">
                        <div data-member-actions class="flex flex-row gap-2 items-center hidden">
                            ${Buttons.primary({ text: window._lc.forms.sticker_pak.subscribe.add, size: "sm", attributes: ["action-subscribe"] })}
                        </div>
                        <div data-author-actions class="flex flex-row gap-2 items-center hidden">
                            ${Buttons.transparent({ shape: "circle", attributes: ["action-add"], icon: "Plus" })}
                        </div>
                    </div>
                </div>
                 <div class="content w-full h-full flex flex-col gap-0 ${CDM_FORM_CONTENT_CLASSES()}">
                    <div data-progress class="flex flex-row justify-center p-2 hidden"></div>
                    <div data-list class="grid grid-cols-3 gap-1 p-2 w-full"></div>

                    ${EmptyState.create({
                        title: window._lc.forms.sticker_pak.empty.title,
                        description: window._lc.forms.sticker_pak.empty.desc,
                        icon: "sticker",
                        compact: true,
                        attributes: ["data-empty"],
                        classes: ["hidden"]
                    })}
                </div>
            </div>

        `, "text/html").querySelector(".cdm-form");

    }

}
