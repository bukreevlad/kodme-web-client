// Импортируем сторонние пакеты
import { OverlayScrollbars } from "overlayscrollbars";

// Импортируем config
import { CDM_FORM_SECTION_CLASSES, CDM_MODAL_CLASSES, CDM_MODAL_FOOTER_CLASSES, CDM_MODAL_HEADER_CLASSES, CDM_MODAL_CONTENT_CLASSES } from "../../config/constants.js";

// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Buttons } from "../../components/buttons.js";

// Импортируем handlers
import { openHandler } from "./handlers/open.js";

/**
 * Настройки формы приглашения в трансляцию.
 */
export interface InviteBroadcastOptions {

    /** Куда вставить форму. */
    insertInto?: HTMLElement | null;

}

/**
 * Данные формы приглашения в трансляцию.
 */
export interface InviteBroadcastData {

    /** Настройки формы. */
    options?: InviteBroadcastOptions;

    /** Link ссылки приглашения. */
    invite?: string;

    /** Id трансляции. */
    broadcast_id: string;

    /** Название трансляции. */
    name?: string;

    /** Описание трансляции. */
    about?: string;

}

/**
 * Входные данные формы: broadcast_id может отсутствовать — например, в ответе
 * сервера о приглашении, где заполнено поле только для своего типа сущности.
 * Без broadcast_id конструктор бросает ошибку, форма не открывается.
 */
export type InviteBroadcastInput = Omit<InviteBroadcastData, "broadcast_id"> & {

    /** Id трансляции (отсутствует для приглашений других типов сущностей). */
    broadcast_id?: string;

};

// Form
export class InviteBroadcast {

    // Переменная для хранения единственного экземпляра формы
    static instance: InviteBroadcast | null = null;

    /** Настройки формы. */
    options: InviteBroadcastOptions;

    /** Шаблон формы. */
    tpl: HTMLElement | null = null;

    /** Модальное окно формы. */
    modal: Overlay | null = null;

    /** Контент формы (скролл-контейнер OverlayScrollbars). */
    content: HTMLElement | null = null;

    /** Инстанс OverlayScrollbars контента. */
    osListScrollInstance: OverlayScrollbars | null = null;

    /** Link ссылки приглашения. */
    invite: string | undefined;

    /** Id трансляции. */
    castId: string;

    /** Название трансляции. */
    name: string | undefined;

    /** Описание трансляции. */
    about: string | undefined;

    /**
     * ***************************************************************************
     * Форма.
     * @param data - Данные.
     * ***************************************************************************
     */
    constructor(data: InviteBroadcastInput) {

        // Если не передан broadcast_id
        if (!data?.broadcast_id) throw new Error("Не передан: broadcast_id");

        // Устанавливаем настройки
        this.options = {
            ...data?.options
        }

        // Переменные формы
        this.invite = data.invite;
        this.castId = data.broadcast_id;
        this.name = data.name;
        this.about = data.about;

        // Проверяем, существует ли уже экземпляр
        if (InviteBroadcast.instance) {
            return InviteBroadcast.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        InviteBroadcast.instance = this;

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

            // Форма
            this.modal = new Overlay(this.tpl, {
                type: "modal",
                url: `?broadcast-invite=${this.castId}`,
                insertInto: this.options.insertInto,
                closeOnEsc: true,
                closeOnOverlay: true,
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
            let close = this.tpl.querySelector(":scope >.footer [action-close]");
            close?.addEventListener("click", () => this.modal?.close());

            // Открыть
            let open = this.tpl.querySelector(":scope >.footer >[action-open]");
            open?.addEventListener("click", () => openHandler(this));

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
            this.content = this.tpl.querySelector(":scope >.content");
            let name = this.tpl.querySelector<HTMLElement>(":scope >.content [data-name]");
            let about = this.tpl.querySelector<HTMLElement>(":scope >.content [data-about]");

            // Записываем данные (undefined нормализуем к null — «нет текста»)
            if (name) name.textContent = this.name ?? null;
            if (about) about.textContent = this.about ?? null;

            // Инициализируем элементы
            if (this.content) {
                this.osListScrollInstance = OverlayScrollbars(this.content, {
                    scrollbars: { autoHide: "scroll" }, overflow: { x: "hidden", y: "scroll" }
                });
            }

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

        // Удаляем экземпляр формы
        InviteBroadcast.instance = null;

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement {

        // invariant: корневой .cdm-modal входит в сам шаблон — querySelector
        // с текстовым HTML всегда находит его
        return new DOMParser().parseFromString(`
        
            <div class="cdm-modal invite-broadcast flex flex-col gap-0 ${CDM_MODAL_CLASSES()}">
                 <div class="${CDM_MODAL_HEADER_CLASSES()}">
                    <span class="font-semibold text-lg">${window._lc.forms.invite_broadcast.title}</span>
                </div>
                 <div class="${CDM_MODAL_CONTENT_CLASSES()}">

                    <div class="flex flex-col gap-2 items-center w-full">

                        <div class="flex flex-col gap-1 items-center ${CDM_FORM_SECTION_CLASSES()} p-4 w-full">
                            <span data-name class="font-semibold"></span>
                            <span class="text-[var(--color-brand)] dark:text-[var(--color-brand)] text-sm">${window._lc.forms.invite_broadcast.broadcast}</span>
                            <span data-about class="empty:hidden text-secondary text-sm"></span>
                        </div>

                    </div>

                </div>
                <div class="${CDM_MODAL_FOOTER_CLASSES()}">
                    ${Buttons.create({ attributes: ["action-close"], classes: ["w-full"], text: window._lc.forms.invite_broadcast.cancel })}
                    ${Buttons.primary({ attributes: ["action-open"], classes: ["w-full"], text: window._lc.forms.invite_broadcast.open })}
                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-modal")!;

    }

}
