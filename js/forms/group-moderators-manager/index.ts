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
import { getModerators } from "./functions/get_moderators.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Buttons } from "../../components/buttons.js";
import { EmptyState } from "../../components/empty_state.js";

// Импортируем events
import { subscribeStoreEvents } from "./events/store/store_events.js";

// Импортируем handlers
import { createHandler } from "./handlers/create.js";
import { onModeratorsScrollHandler } from "./handlers/on_moderators_scroll.js";

// Импортируем forms
import { ChannelProfile } from "../channel-profile/index.js";

// Импортируем типы
import type { GroupModeratorRecord } from "./types.js";
import { t } from "../../utils/i18n/index.js";

/**
 * Настройки формы менеджера модераторов группы.
 */
export interface GroupModeratorsManagerOptions {

    /** Куда вставить форму. */
    insertInto?: HTMLElement | null;

}

/**
 * Данные формы менеджера модераторов группы.
 */
export interface GroupModeratorsManagerData {

    /** Id канала (группы). */
    channelId: string;

    /** Настройки формы. */
    options?: GroupModeratorsManagerOptions;

}

// Form
export class GroupModeratorsManager {

    // Реестр всех открытых форм GroupModeratorsManager: { channelId: instance }
    static instances = new Map<string, GroupModeratorsManager>();

    // Настройки формы
    options: GroupModeratorsManagerOptions;

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
    _offScrollModerators: (() => void) | null;

    // Состояние пагинации списка (см. functions/get_moderators.ts)
    isFirstLoaded: boolean;
    isLoadingFirst: boolean;
    isLoadingPrev: boolean;
    isLoadingNext: boolean;
    hasMorePrev: boolean;
    hasMoreNext: boolean;
    lastErrorToastAt: number;

    // Хранилище списка модераторов
    store: Store<GroupModeratorRecord>;

    /**
     * ***************************************************************************
     * Форма менеджера модераторов группы.
     * @param data - Данные.
     * @param data.channelId - Id канала.
     * @param data.options - Настройки формы.
     * @param data.options.insertInto - Куда вставить форму.
     * ***************************************************************************
     */
    constructor(data: GroupModeratorsManagerData) {

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
        this._offScrollModerators = null; // отписка от скролла списка

        // Состояние пагинации списка (см. functions/get_moderators.ts)
        this.isFirstLoaded = false; // первая страница загружена
        this.isLoadingFirst = false; // первая страница грузится
        this.isLoadingPrev = false; // грузится пачка старых (вверх)
        this.isLoadingNext = false; // грузится пачка новых (вниз)
        this.hasMorePrev = true; // есть ли старые записи выше списка
        this.hasMoreNext = true; // есть ли новые записи ниже списка
        this.lastErrorToastAt = 0; // время последнего тоста ошибки (троттлинг)

        // Хранилище списка модераторов
        this.store = new Store<GroupModeratorRecord>();

        // Получаем instance
        let instance = GroupModeratorsManager.instances.get(data.channelId);
        if (instance) return instance;

        // Регистрируем этот экземпляр формы
        GroupModeratorsManager.instances.set(this.channelId, this);

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

            // NOTE(MIGRATION): из опций формы убрана мёртвая
            // openAnimationClass: передавалась строкой "slide-in-right",
            // а оверлей ждёт объект пресета { animation, settings } —
            // опция никогда не применялась

            // Форма
            this.modal = new Overlay(this.tpl, {
                type: "form",
                url: `?group-moderators-manager=${this.channelId}`,
                insertInto: this.options.insertInto,
                closeOnEsc: false,
                closeOnOverlay: false,
                onBeforeOpen: async () => await this._onBeforeOpen(),
                onOpen: () => this._onOpen(),
                onBeforeClose: () => this._onBeforeClose(),
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

            // Добавить
            let create = this.tpl.querySelector(":scope >.header [action-create]");
            create?.addEventListener("click", () => createHandler(this));

            // =========================

            // При скролле списка: троттлинг, проверка краёв и защита от
            // параллельных запросов — внутри хендлера
            this._offScrollModerators = onModeratorsScrollHandler(this, this.osListScrollInstance);

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
                // сдвигала бы видимую часть вниз (см. functions/get_moderators.ts)
                this.listScrollManager = new ScrollManager(this.osListScrollInstance);
            }

            // Блок пустого состояния списка
            this.empty = this.tpl.querySelector(":scope >.content [data-empty]");

            // Получаем модераторов
            await getModerators(this);

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
        this._offScrollModerators?.();
        this._offScrollModerators = null;

        // Удаляем экземпляр формы из реестра
        GroupModeratorsManager.instances.delete(this.channelId);

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement {

        // invariant: корневой .cdm-form входит в сам шаблон — querySelector
        // с текстовым HTML всегда находит его
        return new DOMParser().parseFromString(`
        
            <div class="cdm-form group-moderators-manager flex flex-col ${CDM_FORM_CLASSES()} w-full">
                <div class="header flex flex-row gap-2 p-2 items-center justify-between ${CDM_FORM_HEADER_CLASSES()}">
                    <div class="flex flex-row gap-2 items-center">
                        ${Buttons.create({
            intent: "transparent",
            shape: "circle",
            attributes: ["action-close"],
            icon: "ArrowLeft"
        })}
                        <span data-title class="flex flex-row gap-2 items-center font-semibold text-lg">${t("forms.group_moderators_manager.title")}</span>
                    </div>
                    ${Buttons.create({
            intent: "transparent",
            shape: "circle",
            attributes: ["action-create"],
            icon: "Plus"
        })}
                </div>
                 <div class="content w-full h-full flex flex-row gap-0 w-full max-w-[var(--form-max-content-width)] m-auto ${CDM_FORM_CONTENT_CLASSES()}">
                    <div data-list class="flex flex-col gap-0 p-2 w-full"></div>

                    ${EmptyState.create({
                        title: t("forms.group_moderators_manager.empty.title"),
                        description: t("forms.group_moderators_manager.empty.desc"),
                        icon: "shield-check",
                        compact: true,
                        attributes: ["data-empty"],
                        classes: ["hidden", "flex-1"]
                    })}
                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-form")!;

    }

}
