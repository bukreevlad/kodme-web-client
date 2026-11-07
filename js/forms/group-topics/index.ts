// Импортируем сторонние пакеты
import { OverlayScrollbars } from "overlayscrollbars";

// Импортируем config
import { CDM_FORM_CLASSES, CDM_FORM_HEADER_CLASSES, CDM_FORM_CONTENT_CLASSES } from "../../config/constants.js";
import { slideInRight, slideOutRight } from "../../config/animations.js";

// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";
import { Store } from "../../utils/store.js";

// Импортируем events
import { subscribeStoreEvents } from "./events/store/store_events.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Buttons } from "../../components/buttons.js";

// Импортируем functions
import { showTopics } from "./functions/show_topics.js";

// Импортируем типы
import type { ChannelRecord } from "../main/types.js";

/**
 * Данные формы тем группы.
 */
export interface GroupTopicsData {

    /** Данные группы. */
    channel: ChannelRecord;

    /** Настройки формы. */
    options?: GroupTopicsOptions;

}

/**
 * Настройки формы тем группы.
 */
export interface GroupTopicsOptions {

    /** Куда вставить форму. */
    insertInto?: HTMLElement | null;

}

// Form
export class GroupTopics {

    // Реестр всех открытых форм GroupTopics: { channelId: instance }
    static instances = new Map<string, GroupTopics>();

    // Настройки формы
    options: GroupTopicsOptions;

    // Данные группы
    channel: ChannelRecord;

    // Каркас: шаблон, модалка, элементы шапки/контента и instance скролла
    tpl: HTMLElement | null;
    modal: Overlay | null;
    displayName: HTMLElement | null;
    subtitle: HTMLElement | null;
    content: HTMLElement | null;
    list: HTMLElement | null;
    osListScrollInstance: OverlayScrollbars | null;

    // Хранилище списка каналов
    store: Store<ChannelRecord>;

    // Отписки от глобального стора (вызываются при закрытии формы)
    storeUnsubs: Array<() => void>;

    /**
     * ***************************************************************************
     * Форма тем группы.
     * @param data - Данные.
     * @param data.channel - Данные группы.
     * @param data.options - Настройки формы.
     * @param data.options.insertInto - Куда вставить форму.
     * ***************************************************************************
     */
    constructor(data: GroupTopicsData) {

        // Если не передан id группы
        if (!data?.channel?.id) throw new Error("Не передан: channelId");

        // Устанавливаем настройки
        this.options = {
            insertInto: document.querySelector(".cdm-form.home .left"),
            ...data?.options
        }

        // Переменные формы
        this.channel = data.channel;

        // Переменные формы
        this.tpl = null;
        this.modal = null;
        this.displayName = null;
        this.subtitle = null;
        this.content = null;
        this.list = null;
        this.osListScrollInstance = null; // overlayScroll instance

        // Хранилище списка каналов
        this.store = new Store<ChannelRecord>();

        // Отписки от глобального стора
        this.storeUnsubs = [];

        // Получаем instance
        let instance = GroupTopics.instances.get(data.channel.id);
        if (instance) return instance;

        // Регистрируем этот экземпляр формы
        GroupTopics.instances.set(data.channel.id, this);

        // Инициализация
        this._init();

    }

    // ***************************************************************************
    // Инициализация
    // ***************************************************************************
    async _init(): Promise<void> {

        // Подписываемся на события Store. Отписки сохраняем — глобальный стор
        // живёт вне формы, и без отписки она утекает после закрытия
        this.storeUnsubs = subscribeStoreEvents(this);

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

            // Без шаблона открывать форму не из чего
            if (!this.tpl) return;

            // Форма
            this.modal = new Overlay(this.tpl, {
                type: "form",
                url: `?group-topics=${this.channel?.id}`,
                insertInto: this.options.insertInto,
                closeOnSwipe: { direction: "right" },
                onBeforeOpen: async () => await this._onBeforeOpen(),
                onOpen: async () => await this._onOpen(),
                onBeforeClose: () => this._onBeforeClose(),
                openAnimationClass: slideInRight,
                closeAnimationClass: slideOutRight
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
            let close = this.tpl.querySelector(":scope >.header [action-close]");
            close?.addEventListener("click", () => this.modal?.close());

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Настройка формы
    // ***************************************************************************
    async _onBeforeOpen(): Promise<void> {

        try {

            // Элементы заполняются из шаблона — без него нечего настраивать
            if (!this.tpl) return;

            // Устанавливаем элементы
            this.displayName = this.tpl.querySelector(":scope >.header [data-display-name]");
            this.subtitle = this.tpl.querySelector(":scope >.header [data-subtitle]");
            this.content = this.tpl.querySelector(":scope >.content");
            this.list = this.tpl.querySelector(":scope >.content [data-list]");

            // Инициализируем скролл (скролл-контейнер входит в шаблон)
            const content = this.content;
            if (content) {
                this.osListScrollInstance = OverlayScrollbars(content, {
                    scrollbars: { autoHide: "scroll" }, overflow: { x: "hidden", y: "scroll" }
                });
            }

            // Обновляем данные формы
            this._update(this.channel);

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Форма открылась
    // ***************************************************************************
    async _onOpen(): Promise<void> {

        // Устанавливаем обработчики
        this._handlers();

    }

    // ***************************************************************************
    // Обновление данных формы
    // ***************************************************************************
    async _update(data: ChannelRecord): Promise<void> {

        // Записываем данные группы
        this.channel = data;

        // Элементы задаются шаблоном в _onBeforeOpen — без них нечего обновлять
        const displayName = this.displayName;
        const subtitle = this.subtitle;
        if (!displayName || !subtitle) return;

        // Отображаем данные (display_name опционален — нормализуем к null)
        displayName.textContent = data.display_name ?? null;
        subtitle.textContent = window._lc.forms.group_topics.subtitle;

        // Отображаем темы группы
        showTopics(this);

    }

    // ***************************************************************************
    // Действия при закрытии формы
    // ***************************************************************************
    _onBeforeClose(): void {

        // Отписываемся от глобального стора, чтобы не утекать после закрытия
        this.storeUnsubs.forEach((unsubscribe) => unsubscribe());

        // Очищаем хранилище
        this.store?.removeAll();

        // Удаляем экземпляр формы из реестра
        GroupTopics.instances.delete(this.channel.id);

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement | null {

        return new DOMParser().parseFromString(`

            <div class="cdm-form group-topics absolute right-0 flex flex-col ${CDM_FORM_CLASSES()} h-full w-[75%] max-w-[75%] shadow-lg">
                <div class="header flex flex-row gap-2 p-2 items-center justify-between ${CDM_FORM_HEADER_CLASSES()}">
                    <div class="flex flex-row gap-2 items-center">
                        ${Buttons.transparent({ shape: "circle", attributes: ["action-close"], icon: "ArrowLeft" })}
                        <div class="flex flex-col gap-0">
                            <span data-display-name class="font-semibold"></span>
                            <span data-subtitle class="text-sm text-secondary"></span>
                        </div>
                    </div>
                </div>
                 <div class="content w-full h-full flex flex-row gap-0 ${CDM_FORM_CONTENT_CLASSES()}">
                    <div data-list class="flex flex-col p-2 gap-0 w-full"></div>
                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-form");

    }

}
