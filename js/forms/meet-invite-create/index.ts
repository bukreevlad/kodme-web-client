// Импортируем сторонние пакеты
import { OverlayScrollbars } from "overlayscrollbars";

// Импортируем config
import { CDM_FORM_CLASSES, CDM_FORM_HEADER_CLASSES, CDM_FORM_CONTENT_CLASSES, CDM_FORM_SECTION_CLASSES } from "../../config/constants.js";

// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";
import { Icons } from "../../utils/icons.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Buttons } from "../../components/buttons.js";
import { Inputs } from "../../components/inputs.js";
import { Toggle } from "../../components/toggle.js";

// Импортируем handlers
import { createHandler } from "./handlers/create.js";
import { switchIsNumberUsersHandler } from "./handlers/switch-is-number-users.js";

// Импортируем forms
import { MeetSettings } from "../meet-settings/index.js";
import { t } from "../../utils/i18n/index.js";

/**
 * Настройки формы создания приглашения в конференцию.
 */
export interface MeetInviteCreateOptions {

    /** Куда вставить форму. */
    insertInto?: HTMLElement | null;

}

/**
 * Данные конструктора формы.
 */
export interface MeetInviteCreateData {

    /** Id конференции. */
    meetId: string;

    /** Настройки формы. */
    options?: MeetInviteCreateOptions;

}

// Form
export class MeetInviteCreate {

    // Реестр всех открытых форм MeetInviteCreate: { meetId: instance }
    static instances = new Map<string, MeetInviteCreate>();

    // Переменные формы
    meetId: string;

    // Каркас: шаблон, модалка, контент и instance скролла
    options: MeetInviteCreateOptions;
    tpl: HTMLElement | null;
    modal: Overlay | null;
    content: HTMLElement | null;
    osListScrollInstance: OverlayScrollbars | null;

    /**
     * ***************************************************************************
     * Форма создания приглашения в конференцию.
     * @param data - Данные.
     * @param data.meetId - Id конференции.
     * @param data.options - Настройки формы.
     * @param data.options.insertInto - Куда вставить форму.
     * ***************************************************************************
     */
    constructor(data: MeetInviteCreateData) {

        // Если не передан meetId
        if (!data?.meetId) throw new Error("Не передан: meetId");

        // Поиск открытого окна настроек конференции
        let meetSettingsForm = MeetSettings.instances.get(data.meetId);
        let insertInto = meetSettingsForm?.modal?.content || null;

        // Устанавливаем настройки
        this.options = {
            insertInto,
            ...data?.options
        };

        // Переменные формы
        this.tpl = null;
        this.modal = null;
        this.content = null;
        this.osListScrollInstance = null; // overlayScroll instance

        // Переменные формы
        this.meetId = data.meetId;

        // Регистрируем этот экземпляр формы
        // Проверяем, существует ли уже экземпляр
        let instance = MeetInviteCreate.instances.get(data.meetId);
        if (instance) return instance;

        MeetInviteCreate.instances.set(this.meetId, this);

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
                type: "form",
                url: `?meet-invite-create=${this.meetId}`,
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
            let create = this.tpl.querySelector(":scope >.header [action-create]");
            create?.addEventListener("click", () => createHandler(this));

            // Лимит пользователей
            let isNumberUsers = this.tpl.querySelector(`:scope >.content [name="is-max-users"]`);
            isNumberUsers?.addEventListener("change", () => switchIsNumberUsersHandler(this));

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

            // Инициализируем скролл (скролл-контейнер входит в шаблон)
            if (content) {
                this.osListScrollInstance = OverlayScrollbars(content, {
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
        MeetInviteCreate.instances.delete(this.meetId);

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement {

        // invariant: корневой .cdm-form входит в сам шаблон — querySelector
        // с текстовым HTML всегда находит его
        return new DOMParser().parseFromString(`

            <div class="cdm-form meet-invite-create flex flex-col gap-0 ${CDM_FORM_CLASSES()} w-full">
                <div class="header flex flex-row gap-2 p-2 items-center justify-between ${CDM_FORM_HEADER_CLASSES()}">
                    ${Buttons.create({
            intent: "transparent",
            shape: "circle",
            attributes: ["action-close"],
            icon: "ArrowLeft"
        })}
                    ${Buttons.create({
            intent: "transparent",
            shape: "circle",
            attributes: ["action-create"],
            icon: "device-floppy"
        })}
                </div>
                 <div class="content w-full h-full flex ${CDM_FORM_CONTENT_CLASSES()}">

                    <div class="flex flex-col gap-3 p-3 max-w-[var(--form-max-content-width)] m-auto w-full">

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("label", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${t("forms.meet_invite_create.name")}
                            </span>
                            ${Inputs.create({
            placeholder: t("forms.meet_invite_create.name"),
            name: "name",
            attributes: ["required"]
        })}
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("users", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${t("forms.meet_invite_create.number_users")}
                            </span>
                            <span class="text-sm text-secondary">${t("forms.meet_invite_create.number_users_desc")}</span>

                            ${Toggle.switch({
            name: "is-max-users",
            checked: false,
            toggleText: {
                on: t("forms.meet_invite_create.limited"),
                off: t("forms.meet_invite_create.infifnity")
            }
        })}

                            <div data-max-users class="hidden">
                                ${Inputs.number({
            placeholder: t("forms.meet_invite_create.number_users"),
            name: "max-users",
            value: "10",
            min: "1",
            max: "1000",
            attributes: ["required"]
        })}
                            </div>
                        </div>

                    </div>

                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-form")!;

    }

}
