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
import { getInvites } from "./functions/get_invites.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Buttons } from "../../components/buttons.js";
import { EmptyState } from "../../components/empty_state.js";

// Импортируем events
import { subscribeStoreEvents } from "./events/store/store_events.js";

// Импортируем forms
import { BroadcastSettings } from "../broadcast-settings/index.js";
import { BroadcastInviteCreate } from "../broadcast-invite-create/index.js";

// Импортируем handlers
import { onInvitesScrollHandler } from "./handlers/on_invites_scroll.js";

// Импортируем типы
import type { BroadcastInvite } from "./types.js";
import { t } from "../../utils/i18n/index.js";

/**
 * Настройки формы управления приглашениями трансляции.
 */
export interface BroadcastManageInvitesOptions {

    /** Куда вставить форму. */
    insertInto?: HTMLElement | null;

}

/**
 * Данные конструктора формы.
 */
export interface BroadcastManageInvitesData {

    /** Id трансляции. */
    castId: string;

    /** Настройки формы. */
    options?: BroadcastManageInvitesOptions;

}

// Form
export class BroadcastManageInvites {

    // Реестр всех открытых форм BroadcastManageInvites: { castId: instance }
    static instances = new Map<string, BroadcastManageInvites>();

    /**
     * ***************************************************************************
     * Форма управления приглашениями трансляции.
     * @param data - Данные.
     * @param data.castId - Id трансляции.
     * @param data.options - Настройки формы.
     * @param data.options.insertInto - Куда вставить форму.
     * ***************************************************************************
     */
    constructor(data: BroadcastManageInvitesData) {

        // Если не передан castId
        if (!data?.castId) throw new Error("Не передан: castId");

        // Поиск открытого окна настроек трансляции
        let broadcastSettingsForm = BroadcastSettings.instances.get(data.castId);
        let insertInto = broadcastSettingsForm?.modal?.content || null;

        // Устанавливаем настройки
        this.options = {
            insertInto,
            ...data?.options
        };

        // Переменные формы
        this.tpl = null;
        this.modal = null;
        this.content = null;
        this.list = null;
        this.empty = null; // блок пустого состояния
        this.osListScrollInstance = null; // overlayScroll instance
        this.listScrollManager = null; // менеджер якоря скролла
        this._offScrollInvites = null; // отписка от скролла списка

        // Состояние пагинации списка (см. functions/get_invites.ts)
        this.isFirstLoaded = false; // первая страница загружена
        this.isLoadingFirst = false; // первая страница грузится
        this.isLoadingPrev = false; // грузится пачка старых (вверх)
        this.isLoadingNext = false; // грузится пачка новых (вниз)
        this.hasMorePrev = true; // есть ли старые записи выше списка
        this.hasMoreNext = true; // есть ли новые записи ниже списка
        this.lastErrorToastAt = 0; // время последнего тоста ошибки (троттлинг)

        // Переменные формы
        this.castId = data.castId;

        // Хранилище списка приглашений
        this.store = new Store<BroadcastInvite>();

        // Получаем instance
        let instance = BroadcastManageInvites.instances.get(data.castId);
        if (instance) return instance;

        // Регистрируем этот экземпляр формы
        BroadcastManageInvites.instances.set(this.castId, this);

        // Инициализация
        this._init();

    }

    // Настройки формы
    options: BroadcastManageInvitesOptions;

    // Каркас: шаблон, модалка, контент и instance скролла
    tpl: HTMLElement | null;
    modal: Overlay | null;
    content: HTMLElement | null;
    osListScrollInstance: OverlayScrollbars | null;

    // Элементы списка и пустого состояния
    list: HTMLElement | null;
    empty: HTMLElement | null;

    // Менеджер якоря скролла
    listScrollManager: ScrollManager | null;

    // Отписка от скролла списка
    _offScrollInvites: (() => void) | null;

    // Состояние пагинации списка
    isFirstLoaded: boolean;
    isLoadingFirst: boolean;
    isLoadingPrev: boolean;
    isLoadingNext: boolean;
    hasMorePrev: boolean;
    hasMoreNext: boolean;
    lastErrorToastAt: number;

    // Переменная формы
    castId: string;

    // Хранилище списка приглашений
    store: Store<BroadcastInvite>;

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
                url: `?broadcast-manage-invites=${this.castId}`,
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

            // Создать
            let create = this.tpl.querySelector(":scope >.header [action-create-invite]");
            create?.addEventListener("click", () => new BroadcastInviteCreate({ castId: this.castId }));

            // =========================

            // При скролле списка: троттлинг, проверка краёв и защита от
            // параллельных запросов — внутри хендлера
            this._offScrollInvites = onInvitesScrollHandler(this, this.osListScrollInstance);

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
            const content = this.tpl.querySelector<HTMLElement>(":scope >.content");
            this.content = content;
            this.list = this.tpl.querySelector(":scope >.content [data-list]");

            // Инициализируем скролл (скролл-контейнер входит в шаблон)
            if (content) {
                this.osListScrollInstance = OverlayScrollbars(content, {
                    scrollbars: { autoHide: "scroll" }, overflow: { x: "hidden", y: "scroll" }
                });

                // Менеджер якоря скролла: вставка пачки в начало списка
                // сдвигала бы видимую часть вниз (см. functions/get_invites.ts)
                this.listScrollManager = new ScrollManager(this.osListScrollInstance);
            }

            // Блок пустого состояния списка
            this.empty = this.tpl.querySelector(":scope >.content [data-empty]");

            // Получаем приглашения
            await getInvites(this);

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
    // Действия при закрытии формы
    // ***************************************************************************
    _onBeforeClose(): void {

        // Снимаем подписку на скролл (внутри — отписка и cancel троттлинга)
        this._offScrollInvites?.();
        this._offScrollInvites = null;

        // Удаляем экземпляр формы из реестра
        BroadcastManageInvites.instances.delete(this.castId);

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement {

        // invariant: корневой .cdm-form входит в сам шаблон — querySelector
        // с текстовым HTML всегда находит его
        return new DOMParser().parseFromString(`
        
            <div class="cdm-form broadcast-manage-invites flex flex-col ${CDM_FORM_CLASSES()} w-full">
                <div class="header flex flex-row gap-2 p-2 items-center justify-between ${CDM_FORM_HEADER_CLASSES()}">
                    ${Buttons.transparent({ shape: "circle", attributes: ["action-close"], icon: "ArrowLeft" })}
                    ${Buttons.transparent({ shape: "circle", attributes: ["action-create-invite"], icon: "Plus" })}
                </div>
                 <div class="content w-full h-full flex flex-row gap-0 ${CDM_FORM_CONTENT_CLASSES()}">
                    <div data-list class="flex flex-col gap-0 p-2 w-full max-w-[var(--form-max-content-width)] m-auto"></div>

                    ${EmptyState.create({
                        title: t("forms.broadcast_manage_invites.empty.title"),
                        description: t("forms.broadcast_manage_invites.empty.desc"),
                        icon: "link",
                        compact: true,
                        attributes: ["data-empty"],
                        classes: ["hidden", "flex-1"]
                    })}
                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-form")!;

    }

}
