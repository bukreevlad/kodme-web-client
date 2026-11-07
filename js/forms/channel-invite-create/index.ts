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
import { ChannelProfile } from "../channel-profile/index.js";
import { t } from "../../utils/i18n/index.js";

/**
 * Настройки формы создания приглашения в канал.
 */
export interface ChannelInviteCreateOptions {

    /** Куда вставить форму. */
    insertInto?: HTMLElement | null;

}

/**
 * Данные конструктора формы.
 */
export interface ChannelInviteCreateData {

    /** Id канала. */
    channelId: string;

    /** Настройки формы. */
    options?: ChannelInviteCreateOptions;

}

// Form
export class ChannelInviteCreate {

    // Переменная для хранения единственного экземпляра формы
    static instance: ChannelInviteCreate | null = null;

    /**
     * ***************************************************************************
     * Форма создания приглашения в канал.
     * @param data - Данные.
     * @param data.channelId - Id канала.
     * @param data.options - Настройки формы.
     * @param data.options.insertInto - Куда вставить форму.
     * ***************************************************************************
     */
    constructor(data: ChannelInviteCreateData) {

        // Если не передан channelId
        if (!data?.channelId) throw new Error("Не передан: channelId");

        // Поиск открытого профиля канала
        let channelProfileForm = ChannelProfile.instances.get(data.channelId);
        let insertInto = channelProfileForm?.modal?.content || null;

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
        this.channelId = data.channelId;

        // Проверяем, существует ли уже экземпляр
        if (ChannelInviteCreate.instance) {
            return ChannelInviteCreate.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        ChannelInviteCreate.instance = this;

        // Инициализация
        this._init();

    }

    // Настройки формы
    options: ChannelInviteCreateOptions;

    // Каркас: шаблон, модалка, контент и instance скролла
    tpl: HTMLElement | null;
    modal: Overlay | null;
    content: HTMLElement | null;
    osListScrollInstance: OverlayScrollbars | null;

    // Переменная формы
    channelId: string;

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

            // Без шаблона открывать форму не из чего
            if (!this.tpl) return;

            // Форма
            this.modal = new Overlay(this.tpl, {
                type: "form",
                url: `?channel-invite-create=${this.channelId}`,
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

            // Кол. Пользователей
            let switchIsNumberUsers = this.tpl.querySelector(`:scope >.content [name="is-max-users"]`);
            switchIsNumberUsers?.addEventListener("change", () => switchIsNumberUsersHandler(this));

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

            // Инициализируем скролл (скролл-контейнер входит в шаблон)
            const content = this.content;
            if (content) {
                this.osListScrollInstance = OverlayScrollbars(content, {
                    scrollbars: { autoHide: "scroll" }, overflow: { x: "hidden", y: "scroll" }
                });
            }

            // Активируем переключатели
            Toggle.hydrate(this.tpl);

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
        ChannelInviteCreate.instance = null;

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement | null {

        return new DOMParser().parseFromString(`

            <div class="cdm-form channel-invite-create flex flex-col gap-0 ${CDM_FORM_CLASSES()} w-full">
                <div class="header flex flex-row gap-2 p-2 items-center justify-between ${CDM_FORM_HEADER_CLASSES()}">
                    ${Buttons.circle({ intent: "transparent", attributes: ["action-close"], icon: "ArrowLeft" })}
                    ${Buttons.circle({ intent: "transparent", attributes: ["action-create"], icon: "device-floppy" })}
                </div>
                 <div class="content w-full h-full flex ${CDM_FORM_CONTENT_CLASSES()}">

                    <div class="flex flex-col gap-3 p-3 max-w-[var(--form-max-content-width)] m-auto w-full">

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("label", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${t("forms.channel_invite_create.name")}
                            </span>
                            ${Inputs.create({ placeholder: t("forms.channel_invite_create.name"), name: "name", attributes: ["required"] })}
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("users", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${t("forms.channel_invite_create.number_users")}
                            </span>
                            <span class="text-sm text-secondary">${t("forms.channel_invite_create.number_users_desc")}</span>

                            ${Toggle.switch({
            name: "is-max-users",
            checked: false,
            toggleText: {
                on: t("forms.channel_invite_create.limited"),
                off: t("forms.channel_invite_create.infifnity")
            }
        })}

                            <div data-max-users class="hidden">
                                ${Inputs.number({ placeholder: t("forms.channel_invite_create.number_users"), min: "0", max: "1000", name: "max-users", attributes: ["required"] })}
                            </div>
                        </div>

                    </div>

                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-form");

    }

}
