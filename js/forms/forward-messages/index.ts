// Импортируем сторонние пакеты
import { FormsRegistry } from "../../core/managers/forms_registry.js";
import { OverlayScrollbars } from "overlayscrollbars";

// Импортируем config
import { CDM_FORM_CLASSES, CDM_FORM_HEADER_CLASSES } from "../../config/constants.js";

// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";
import { Icons } from "../../utils/icons.js";
import { Store } from "../../utils/store.js";

// Импортируем functions
import { getChannels } from "./functions/get_channels.js";
import { showForwardFolders } from "./functions/show_folders.js";

// Импортируем handlers
import { closeHandler } from "./handlers/close.js";
import { forwardMessagesHandler } from "./handlers/forward_messages.js";

// Импортируем events
import { subscribeStoreEvents } from "./events/store/store_events.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Buttons } from "../../components/buttons.js";
import { Tabs } from "../../components/tabs.js";

// Импортируем типы
import type { ForwardChannelRecord } from "./types.js";
import { t } from "../../utils/i18n/index.js";

/**
 * Callback формы: получает id выбранных каналов-получателей.
 */
export type ForwardMessagesCallback = (selectedIds: string[]) => void;

/**
 * Настройки формы пересылки.
 */
export interface ForwardMessagesOptions {

    /** Куда вставить форму. */
    insertInto?: HTMLElement | null;

}

/**
 * Данные конструктора формы.
 */
export interface ForwardMessagesData {

    /** Callback, вызываемый с id выбранных каналов. */
    callback?: ForwardMessagesCallback;

    /** Настройки формы. */
    options?: ForwardMessagesOptions;

}

// Form
export class ForwardMessages {


    // Каркас: шаблон, модалка, контент и instance скролла
    options: ForwardMessagesOptions;
    tpl: HTMLElement | null;
    modal: Overlay | null;
    content: HTMLElement | null;
    osListScrollInstance: OverlayScrollbars | null;

    // Менеджер табов папок (зеркало главной формы: «Все» + папки сессии)
    foldersTabs: Tabs | null;

    // Данные формы
    callback: ForwardMessagesCallback | null;
    selectedChannelsIds: string[];

    // Хранилище списка каналов
    store: Store<ForwardChannelRecord>;

    /**
     * ***************************************************************************
     * Форма выбора каналов для пересылки сообщений.
     * @param data - Данные.
     * @param data.callback - Callback (получает id выбранных каналов).
     * @param data.options - Настройки формы.
     * @param data.options.insertInto - Куда вставить форму.
     * ***************************************************************************
     */
    constructor(data?: ForwardMessagesData) {

        // Устанавливаем настройки
        this.options = {
            insertInto: document.querySelector(".cdm-form.home .left"),
            ...data?.options
        };

        // Переменные формы
        this.tpl = null;
        this.modal = null;
        this.content = null;
        this.foldersTabs = null;
        this.osListScrollInstance = null; // overlayScroll instance

        // Переменные формы
        this.callback = data?.callback || null;
        this.selectedChannelsIds = [];

        // Хранилище списка каналов
        this.store = new Store<ForwardChannelRecord>();

        // Проверяем, существует ли уже экземпляр
        const opened = FormsRegistry.getOwner<ForwardMessages>("forward-messages");
        if (opened) return opened;

        // Сохраняем ссылку на текущий экземпляр

        // Инициализация
        this._init();

    }

    // *************************************************************************
    // Инициализация
    // *************************************************************************
    async _init(): Promise<void> {

        // Подписываемся на события Store.
        subscribeStoreEvents(this);

        // Открытие
        await this._open();

    }

    // *************************************************************************
    // Открытие
    // *************************************************************************
    async _open(): Promise<void> {

        try {

            // Шаблон формы
            this.tpl = this._template();

            if (!this.tpl) return;

            // Форма
            this.modal = new Overlay(this.tpl, {
                type: "form",
                owner: this,
                id: "forward-messages",
                insertInto: this.options.insertInto,
                closeOnEsc: true,
                closeOnOverlay: true,
                closeOnSwipe: { direction: "right" },
                onBeforeOpen: async () => await this._onBeforeOpen(),
                onOpen: async () => await this._onOpen(),
                onBeforeClose: () => this._onBeforeClose()
            });

            // Открываем форму
            this.modal.open();

        } catch (error) {
            Logger.error(error);
        }

    }

    // *************************************************************************
    // Обработчики
    // *************************************************************************
    _handlers(): void {

        try {

            // Закрыть
            let close = this.tpl?.querySelector(":scope >.header [action-close]");
            close?.addEventListener("click", () => closeHandler(this));

            // Переслать
            let forward = this.tpl?.querySelector(":scope >[action-forward-messages]");
            forward?.addEventListener("click", () => forwardMessagesHandler(this));

        } catch (error) {
            Logger.error(error);
        }

    }

    // *************************************************************************
    // Настройка формы
    // *************************************************************************
    async _onBeforeOpen(): Promise<void> {

        try {

            // Устанавливаем элементы
            this.content = this.tpl?.querySelector(":scope >.content") ?? null;

            // Лента и панели папок обязаны быть в шаблоне — иначе вкладки не собрать
            const foldersHorizontal = this.tpl?.querySelector<HTMLElement>(":scope [data-folders-horizontal] >[data-list]") ?? null;
            const foldersPanes = this.tpl?.querySelector<HTMLElement>(":scope >.content >.cdm-tabs-content") ?? null;
            if (!foldersHorizontal || !foldersPanes) return;

            // Менеджер табов папок (как на главной форме)
            this.foldersTabs = new Tabs(
                [{ tabs: foldersHorizontal, scrollType: "horizontal" }],
                foldersPanes,
                { isSlider: true }
            );

            // Инициализируем скролл
            if (this.content) {
                this.osListScrollInstance = OverlayScrollbars(this.content, {
                scrollbars: { autoHide: "scroll" }, overflow: { x: "hidden", y: "scroll" }
                });
            }

            // Папки пользователя: «Все» + папки сессии — ДО загрузки строк,
            // события item::added раскладивают каналы по готовым панелям
            showForwardFolders(this);

            // Получаем каналы с IndexedDB
            await getChannels(this);

        } catch (error) {
            Logger.error(error);
        }

    }

    // *************************************************************************
    // Форма открылась
    // *************************************************************************
    async _onOpen(): Promise<void> {

        // Устанавливаем обработчики
        this._handlers();

    }

    // *************************************************************************
    // Действия при закрытии формы
    // *************************************************************************
    _onBeforeClose(): void {


    }

    // *************************************************************************
    // Шаблон формы
    // *************************************************************************
    _template(): HTMLElement | null {

        return new DOMParser().parseFromString(`

            <div class="cdm-form forward-messages flex flex-col ${CDM_FORM_CLASSES()} w-full">
                <div class="header flex flex-row gap-2 p-2 items-center ${CDM_FORM_HEADER_CLASSES()}">
                    <span data-title class="flex-1 font-semibold text-base truncate">${t("forms.forward_messages.header_title")}</span>
                    <button action-close class="rounded-full">${Icons.icon("X")?.outerHTML}</button>
                </div>
                <div class="flex w-full pt-[var(--form-header-height)]">
                    <div data-folders-horizontal class="p-1 w-full relative flex flex-row items-center gap-1 overflow-hidden">
                        <div data-list class="cdm-tabs flex flex-row gap-1 flex-1 min-w-0 overflow-x-auto scrollbar-none"></div>
                    </div>
                </div>
                 <div class="content w-full flex flex-row gap-0 flex-1 min-h-0 overflow-hidden pb-[var(--form-footer-height)]">
                    <div class="cdm-tabs-content flex flex-row gap-0 w-full overflow-hidden"></div>
                </div>
                ${Buttons.primary({ shape: "circle", attributes: ["action-forward-messages"], icon: "arrow-back-up-double" })}
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-form");

    }

}
