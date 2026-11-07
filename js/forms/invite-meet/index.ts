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
 * Настройки формы приглашения в конференцию.
 */
export interface InviteMeetOptions {

    /** Куда вставить форму. */
    insertInto?: HTMLElement | null;

}

/**
 * Данные формы приглашения в конференцию.
 */
export interface InviteMeetData {

    /** Настройки формы. */
    options?: InviteMeetOptions;

    /** Ссылка-приглашение. */
    invite?: string;

    /** Id конференции. */
    meet_id: string;

    /** Название конференции. */
    name?: string;

    /** Описание конференции. */
    about?: string;

}

/**
 * Входные данные формы: meet_id может отсутствовать — например, в ответе
 * сервера о приглашении, где заполнено поле только для своего типа сущности.
 * Без meet_id конструктор бросает ошибку, форма не открывается.
 */
export type InviteMeetInput = Omit<InviteMeetData, "meet_id"> & {

    /** Id конференции (отсутствует для приглашений других типов сущностей). */
    meet_id?: string;

};

// Form
export class InviteMeet {

    // Переменная для хранения единственного экземпляра формы
    static instance: InviteMeet | null = null;

    /** Настройки формы. */
    options: InviteMeetOptions;

    /** Шаблон формы. */
    tpl: HTMLElement | null = null;

    /** Модальное окно формы. */
    modal: Overlay | null = null;

    /** Контент формы (скролл-контейнер OverlayScrollbars). */
    content: HTMLElement | null = null;

    /** Инстанс OverlayScrollbars контента. */
    osListScrollInstance: OverlayScrollbars | null = null;

    /** Ссылка-приглашение. */
    invite: string;

    /** Id конференции. */
    meetId: string;

    /** Название конференции. */
    name: string | undefined;

    /** Описание конференции. */
    about: string | undefined;

    /**
     * ***************************************************************************
     * Форма.
     * @param data - Данные.
     * ***************************************************************************
     */
    constructor(data: InviteMeetInput) {

        // Если не передан meet_id
        if (!data?.meet_id) throw new Error("Не передан: meet_id");

        // Устанавливаем настройки
        this.options = {
            ...data?.options
        }

        // Переменные формы
        this.invite = data.invite || "";
        this.meetId = data.meet_id;
        this.name = data.name;
        this.about = data.about;

        // Проверяем, существует ли уже экземпляр
        if (InviteMeet.instance) {
            return InviteMeet.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        InviteMeet.instance = this;

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
                type: "modal",
                url: `?meet-invite=${this.meetId}`,
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

            // Закрыть
            let close = this.tpl?.querySelector(":scope >.footer [action-close]");
            close?.addEventListener("click", () => this.modal?.close());

            // Открыть
            let open = this.tpl?.querySelector(":scope >.footer >[action-open]");
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

            // Устанавливаем элементы
            this.content = this.tpl?.querySelector(":scope >.content") ?? null;
            let name = this.tpl?.querySelector<HTMLElement>(":scope >.content [data-name]");
            let about = this.tpl?.querySelector<HTMLElement>(":scope >.content [data-about]");

            // Записываем данные
            if (name) name.textContent = this.name || "";
            if (about) about.textContent = this.about || "";

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
        InviteMeet.instance = null;

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement | null {

        return new DOMParser().parseFromString(`
        
            <div class="cdm-modal invite-meet flex flex-col gap-0 ${CDM_MODAL_CLASSES()}">
                 <div class="${CDM_MODAL_HEADER_CLASSES()}">
                    <span class="font-semibold text-lg">${window._lc.forms.invite_meet.title}</span>
                </div>
                 <div class="${CDM_MODAL_CONTENT_CLASSES()}">

                    <div class="flex flex-col gap-2 items-center w-full">

                        <div class="flex flex-col gap-1 items-center ${CDM_FORM_SECTION_CLASSES()} p-4 w-full">
                            <span data-name class="font-semibold"></span>
                            <span class="text-[var(--color-brand)] dark:text-[var(--color-brand)] text-sm">${window._lc.forms.invite_meet.meet}</span>
                            <span data-about class="empty:hidden text-secondary text-sm"></span>
                        </div>

                    </div>

                </div>
                <div class="${CDM_MODAL_FOOTER_CLASSES()}">
                    ${Buttons.create({ attributes: ["action-close"], classes: ["w-full"], text: window._lc.forms.invite_meet.cancel })}
                    ${Buttons.primary({ attributes: ["action-open"], classes: ["w-full"], text: window._lc.forms.invite_meet.open })}
                </div>
            </div>

        `, "text/html").querySelector(".cdm-modal");

    }

}
