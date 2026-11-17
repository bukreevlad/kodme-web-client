// Импортируем сторонние пакеты
import { OverlayScrollbars } from "overlayscrollbars";

// Импортируем config
import { CDM_FORM_CLASSES, CDM_FORM_HEADER_CLASSES, CDM_FORM_CONTENT_CLASSES } from "../../config/constants.js";

// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";
import { FormsRegistry } from "../../core/managers/forms_registry.js";
import { Store } from "../../utils/store.js";

// Импортируем core
import { ScrollManager } from "../../core/managers/scroll_manager.js";

// Импортируем functions
import { getMembers } from "./functions/get_members.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Buttons } from "../../components/buttons.js";
import { EmptyState } from "../../components/empty_state.js";

// Импортируем events
import { subscribeStoreEvents } from "./events/store/store_events.js";

// Импортируем handlers
import { onMembersScrollHandler } from "./handlers/on_members_scroll.js";

// Импортируем db
import { channelsTable } from "../main/db.js";

// Импортируем forms

// Импортируем типы
import type { MemberRecord } from "./types.js";
import type { ChannelRecord } from "../main/types.js";
import { t } from "../../utils/i18n/index.js";

/**
 * Настройки формы участников канала.
 */
export interface ChannelMembersOptions {

    /** Куда вставить форму. */
    insertInto?: HTMLElement | null;

}

/**
 * Данные формы участников канала.
 */
export interface ChannelMembersData {

    /** Id канала. */
    channelId: string;

    /** Настройки формы. */
    options?: ChannelMembersOptions;

}

// Form
export class ChannelMembers {

    // Настройки формы
    options: ChannelMembersOptions;

    // Переменные формы
    channelId: string;

    /** Канал из IndexedDB: права модерации читаются из его полей. */
    channel: ChannelRecord | null;

    // Каркас: шаблон, модалка, элементы и instance скролла/менеджера якоря
    tpl: HTMLElement | null;
    modal: Overlay | null;
    content: HTMLElement | null;
    list: HTMLElement | null;
    empty: HTMLElement | null;
    osListScrollInstance: OverlayScrollbars | null;
    listScrollManager: ScrollManager | null;
    _offScrollMembers: (() => void) | null;

    // Состояние пагинации списка (см. functions/get_members.ts)
    isFirstLoaded: boolean;
    isLoadingFirst: boolean;
    isLoadingPrev: boolean;
    isLoadingNext: boolean;
    hasMorePrev: boolean;
    hasMoreNext: boolean;
    lastErrorToastAt: number;

    // Хранилище списка участников
    store: Store<MemberRecord>;

    /**
     * ***************************************************************************
     * Форма участников канала.
     * @param data - Данные.
     * @param data.channelId - Id канала.
     * @param data.options - Настройки формы.
     * @param data.options.insertInto - Куда вставить форму.
     * ***************************************************************************
     */
    constructor(data: ChannelMembersData) {

        // Если не передан channelId
        if (!data?.channelId) throw new Error("Не передан: channelId");

        // Точка монтирования — контент открытого окна сообщений; без него
        // форма встаёт в общий контейнер
        const insertInto = FormsRegistry.get(`messages:${data.channelId}`)?.content
            ?? document.querySelector<HTMLElement>(".cdm-form.home .middle >.form-container");

        // Устанавливаем настройки
        this.options = {
            insertInto,
            ...data?.options
        }

        // Переменные формы
        this.channelId = data.channelId;
        this.channel = null;

        // Каркас
        this.tpl = null;
        this.modal = null;
        this.content = null;
        this.list = null;
        this.empty = null; // блок пустого состояния
        this.osListScrollInstance = null; // overlayScroll instance
        this.listScrollManager = null; // менеджер якоря скролла
        this._offScrollMembers = null; // отписка от скролла списка

        // Состояние пагинации списка (см. functions/get_members.ts)
        this.isFirstLoaded = false; // первая страница загружена
        this.isLoadingFirst = false; // первая страница грузится
        this.isLoadingPrev = false; // грузится пачка старых (вверх)
        this.isLoadingNext = false; // грузится пачка новых (вниз)
        this.hasMorePrev = true; // есть ли старые записи выше списка
        this.hasMoreNext = true; // есть ли новые записи ниже списка
        this.lastErrorToastAt = 0; // время последнего тоста ошибки (троттлинг)

        // Хранилище списка участников
        this.store = new Store<MemberRecord>();

        // Получаем instance
        let instance = FormsRegistry.getOwner<ChannelMembers>(`channel-members:${data.channelId}`);
        if (instance) return instance;

        // Регистрируем этот экземпляр формы

        // Инициализация
        this._init();

    }

    // ***************************************************************************
    // Инициализация
    // ***************************************************************************
    async _init(): Promise<void> {

        // Подписываемся на события Store.
        subscribeStoreEvents(this);

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
                owner: this,
                id: `channel-members:${this.channelId}`,
                placement: "stack",
                parent: FormsRegistry.getByContent(this.options.insertInto ?? null)?.id ?? null,
                url: `?channel-members=${this.channelId}`,
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

            // =========================

            // При скролле списка: троттлинг, проверка краёв и защита от
            // параллельных запросов — внутри хендлера (скролл-инстанс
            // создаётся в _onBeforeOpen; без него подписки не будет)
            this._offScrollMembers = onMembersScrollHandler(this, this.osListScrollInstance);

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
                // сдвигала бы видимую часть вниз (см. functions/get_members.ts)
                this.listScrollManager = new ScrollManager(this.osListScrollInstance);
            }

            // Блок пустого состояния списка
            this.empty = this.tpl.querySelector(":scope >.content [data-empty]");

            // Канал из IndexedDB: по его полям меню читает права модерации
            this.channel = await channelsTable().get(this.channelId) ?? null;

            // Получаем участников
            await getMembers(this);

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Форма открылась
    // ***************************************************************************
    async _onOpen(): Promise<void> {

        this._handlers();

    }

    // ***************************************************************************
    // Действия при закрытии формы
    // ***************************************************************************
    _onBeforeClose(): void {

        // Снимаем подписку на скролл (внутри — отписка и cancel троттлинга)
        this._offScrollMembers?.();
        this._offScrollMembers = null;

        // Удаляем экземпляр формы из реестра

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement {

        // invariant: корневой .cdm-form входит в сам шаблон — querySelector
        // с текстовым HTML всегда находит его
        return new DOMParser().parseFromString(`

            <div class="cdm-form channel-members flex flex-col ${CDM_FORM_CLASSES()} w-full">
                <div class="header flex flex-row gap-2 p-2 items-center justify-between ${CDM_FORM_HEADER_CLASSES()}">
                    <div class="flex flex-row gap-2 items-center">
                        ${Buttons.transparent({ shape: "circle", attributes: ["action-close"], icon: "ArrowLeft" })}
                        <span data-title class="flex flex-row gap-2 items-center font-semibold text-lg">${t("forms.channel_members.title")}</span>
                    </div>
                </div>
                 <div class="content w-full h-full flex ${CDM_FORM_CONTENT_CLASSES()}">

                    <div class="flex flex-col gap-0 p-2 w-full max-w-[var(--form-max-content-width)] mx-auto">
                        <div data-list class="flex flex-col gap-0 w-full"></div>

                        ${EmptyState.create({
                            title: t("forms.channel_members.empty.title"),
                            description: t("forms.channel_members.empty.desc"),
                            icon: "users",
                            compact: true,
                            attributes: ["data-empty"],
                            classes: ["hidden", "flex-1"]
                        })}
                    </div>

                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-form")!;

    }

}
