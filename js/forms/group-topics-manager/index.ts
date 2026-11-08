// Импортируем сторонние пакеты
import { OverlayScrollbars } from "overlayscrollbars";

// Импортируем config
import { CDM_FORM_CLASSES, CDM_FORM_HEADER_CLASSES, CDM_FORM_CONTENT_CLASSES } from "../../config/constants.js";

// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";
import { Store } from "../../utils/store.js";

// Импортируем core
import { ScrollManager } from "../../core/managers/scroll_manager.js";

// Импортируем functions
import { getTopics } from "./functions/get_topics.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Buttons } from "../../components/buttons.js";
import { EmptyState } from "../../components/empty_state.js";

// Импортируем events
import { subscribeStoreEvents } from "./events/store/store_events.js";

// Импортируем handlers
import { createHandler } from "./handlers/create.js";
import { onTopicsScrollHandler } from "./handlers/on_topics_scroll.js";

// Импортируем forms
import { ChannelProfile } from "../channel-profile/index.js";

// Импортируем типы
import type { GroupTopicRecord } from "./types.js";
import { t } from "../../utils/i18n/index.js";

/**
 * Настройки формы менеджера тем группы.
 */
export interface GroupTopicsManagerOptions {

    /** Куда вставить форму. */
    insertInto?: HTMLElement | null;

}

/**
 * Данные формы менеджера тем группы.
 */
export interface GroupTopicsManagerData {

    /** Id канала (группы). */
    channelId: string;

    /** Настройки формы. */
    options?: GroupTopicsManagerOptions;

}

// Form
export class GroupTopicsManager {

    // Реестр всех открытых форм GroupTopicsManager: { channelId: instance }
    static instances = new Map<string, GroupTopicsManager>();

    // Настройки формы
    options: GroupTopicsManagerOptions;

    // Переменные формы
    channelId: string;

    // Каркас: шаблон, модалка, элементы и instance скролла/менеджера якоря
    tpl: HTMLElement | null;
    modal: Overlay | null;
    content: HTMLElement | null;
    list: HTMLElement | null;
    empty: HTMLElement | null;
    osListScrollInstance: OverlayScrollbars | null;
    listScrollManager: ScrollManager | null;
    _offScrollTopics: (() => void) | null;

    // Состояние пагинации списка (см. functions/get_topics.ts)
    isFirstLoaded: boolean;
    isLoadingFirst: boolean;
    isLoadingPrev: boolean;
    isLoadingNext: boolean;
    hasMorePrev: boolean;
    hasMoreNext: boolean;
    lastErrorToastAt: number;

    // Хранилище списка тем
    store: Store<GroupTopicRecord>;

    /**
     * ***************************************************************************
     * Форма менеджера тем группы.
     * @param data - Данные.
     * @param data.channelId - Id канала.
     * @param data.options - Настройки формы.
     * @param data.options.insertInto - Куда вставить форму.
     * ***************************************************************************
     */
    constructor(data: GroupTopicsManagerData) {

        // Если не передан channelId
        if (!data?.channelId) throw new Error("Не передан: channelId");

        // Поиск открытого профиля канала
        let channelProfileForm = ChannelProfile.instances.get(data.channelId);
        let insertInto = channelProfileForm?.modal?.content || null;

        // Устанавливаем настройки
        this.options = {
            insertInto,
            ...data?.options
        }

        // Переменные формы
        this.channelId = data.channelId;

        // Переменные формы
        this.tpl = null;
        this.modal = null;
        this.content = null;
        this.list = null;
        this.empty = null; // блок пустого состояния
        this.osListScrollInstance = null; // overlayScroll instance
        this.listScrollManager = null; // менеджер якоря скролла
        this._offScrollTopics = null; // отписка от скролла списка

        // Состояние пагинации списка (см. functions/get_topics.ts)
        this.isFirstLoaded = false; // первая страница загружена
        this.isLoadingFirst = false; // первая страница грузится
        this.isLoadingPrev = false; // грузится пачка старых (вверх)
        this.isLoadingNext = false; // грузится пачка новых (вниз)
        this.hasMorePrev = true; // есть ли старые записи выше списка
        this.hasMoreNext = true; // есть ли новые записи ниже списка
        this.lastErrorToastAt = 0; // время последнего тоста ошибки (троттлинг)

        // Хранилище списка тем
        this.store = new Store<GroupTopicRecord>();

        // Получаем instance
        let instance = GroupTopicsManager.instances.get(data.channelId);
        if (instance) return instance;

        // Регистрируем этот экземпляр формы
        GroupTopicsManager.instances.set(this.channelId, this);

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

            // Форма
            this.modal = new Overlay(this.tpl, {
                type: "form",
                url: `?group-topics-manager=${this.channelId}`,
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
            Logger.error(error);
        }

    }

    // *************************************************************************
    // Обработчики
    // *************************************************************************
    _handlers(): void {

        try {

            // Обработчики вешаются на узлы шаблона — без него нечего слушать
            if (!this.tpl) return;

            // Закрыть
            let close = this.tpl.querySelector(":scope >.header [action-close]");
            close?.addEventListener("click", () => this.modal?.close());

            // Создать
            let create = this.tpl.querySelector(":scope >.header [action-create]");
            create?.addEventListener("click", () => createHandler(this));

            // =========================

            // При скролле списка: троттлинг, проверка краёв и защита от
            // параллельных запросов — внутри хендлера
            this._offScrollTopics = onTopicsScrollHandler(this, this.osListScrollInstance);

        } catch (error) {
            Logger.error(error);
        }

    }

    // *************************************************************************
    // Настройка формы
    // *************************************************************************
    async _onBeforeOpen(): Promise<void> {

        try {

            // Элементы заполняются из шаблона — без него нечего настраивать
            if (!this.tpl) return;

            // Устанавливаем список
            const content = this.tpl.querySelector<HTMLElement>(":scope >.content");
            this.content = content;
            this.list = this.tpl.querySelector(":scope >.content [data-list]");

            // Инициализируем скролл (скролл-контейнер входит в шаблон)
            if (content) {
                this.osListScrollInstance = OverlayScrollbars(content, {
                    scrollbars: { autoHide: "scroll" }, overflow: { x: "hidden", y: "scroll" }
                });

                // Менеджер якоря скролла: вставка пачки в начало списка
                // сдвигала бы видимую часть вниз (см. functions/get_topics.ts)
                this.listScrollManager = new ScrollManager(this.osListScrollInstance);
            }

            // Блок пустого состояния списка
            this.empty = this.tpl.querySelector(":scope >.content [data-empty]");

            // Получаем темы
            await getTopics(this);

        } catch (error) {
            Logger.error(error);
        }

    }

    // *************************************************************************
    // Форма открылась
    // *************************************************************************
    _onOpen(): void {

        this._handlers();

    }

    // *************************************************************************
    // Действия при закрытии формы
    // *************************************************************************
    _onBeforeClose(): void {

        // Снимаем подписку на скролл (внутри — отписка и cancel троттлинга)
        this._offScrollTopics?.();
        this._offScrollTopics = null;

        // Удаляем экземпляр формы из реестра
        GroupTopicsManager.instances.delete(this.channelId);

    }

    // *************************************************************************
    // Шаблон формы
    // *************************************************************************
    _template(): HTMLElement {

        // invariant: корневой .cdm-form входит в сам шаблон — querySelector
        // с текстовым HTML всегда находит его
        return new DOMParser().parseFromString(`

            <div class="cdm-form group-topics-manager flex flex-col ${CDM_FORM_CLASSES()} w-full">
                <div class="header flex flex-row gap-2 p-2 items-center justify-between ${CDM_FORM_HEADER_CLASSES()}">
                    <div class="flex flex-row gap-2 items-center">
                        ${Buttons.create({
            intent: "transparent",
            shape: "circle",
            attributes: ["action-close"],
            icon: "ArrowLeft"
        })}
                        <span data-title class="flex flex-row gap-2 items-center font-semibold text-lg">${t("forms.group_topics_manager.title")}</span>
                    </div>
                    ${Buttons.create({
            intent: "transparent",
            shape: "circle",
            attributes: ["action-create"],
            icon: "Plus"
        })}
                </div>
                 <div class="content w-full h-full flex flex-row gap-0 ${CDM_FORM_CONTENT_CLASSES()}">
                    <div data-list class="flex flex-col gap-0 p-2 w-full max-w-[var(--form-max-content-width)] m-auto"></div>

                    ${EmptyState.create({
                        title: t("forms.group_topics_manager.empty.title"),
                        description: t("forms.group_topics_manager.empty.desc"),
                        icon: "messages",
                        compact: true,
                        attributes: ["data-empty"],
                        classes: ["hidden", "flex-1"]
                    })}
                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-form")!;

    }

}
