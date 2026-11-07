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
import { BroadcastSettings } from "../broadcast-settings/index.js";
import { t } from "../../utils/i18n/index.js";

/**
 * Данные формы создания приглашения в трансляцию.
 */
export interface BroadcastInviteCreateData {

    /** Id трансляции. */
    castId: string;

    /** Настройки формы. */
    options?: BroadcastInviteCreateOptions;

}

/**
 * Настройки формы создания приглашения в трансляцию.
 */
export interface BroadcastInviteCreateOptions {

    /** Куда вставить форму. */
    insertInto?: HTMLElement | null;

}

// Form
export class BroadcastInviteCreate {

    // Реестр всех открытых форм BroadcastInviteCreate: { castId: instance }
    static instances = new Map<string, BroadcastInviteCreate>();

    // Переменные формы
    castId: string;

    // Каркас: шаблон, модалка, контент и instance скролла
    options: BroadcastInviteCreateOptions;
    tpl: HTMLElement | null;
    modal: Overlay | null;
    content: HTMLElement | null;
    osListScrollInstance: OverlayScrollbars | null;

    /**
     * ***************************************************************************
     * Форма создания приглашения в трансляцию.
     * @param data - Данные.
     * @param data.castId - Id трансляции.
     * @param data.options - Настройки формы.
     * @param data.options.insertInto - Куда вставить форму.
     * ***************************************************************************
     */
    constructor(data: BroadcastInviteCreateData) {

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
        this.osListScrollInstance = null; // overlayScroll instance

        // Переменные формы
        this.castId = data.castId;

        // Получаем instance
        let instance = BroadcastInviteCreate.instances.get(data.castId);
        if (instance) return instance;

        // Регистрируем этот экземпляр формы
        BroadcastInviteCreate.instances.set(this.castId, this);

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

            // Без шаблона открывать форму не из чего
            if (!this.tpl) return;

            // Форма
            this.modal = new Overlay(this.tpl, {
                type: "form",
                url: `?broadcast-invite-create=${this.castId}`,
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
            let switchIsNumberUsers = this.tpl.querySelector(`[name="is-max-users"]`);
            switchIsNumberUsers?.addEventListener("change", () => switchIsNumberUsersHandler(this));

            // Активируем переключатели
            Toggle.hydrate(this.tpl);

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

        // Удаляем экземпляр формы из реестра
        BroadcastInviteCreate.instances.delete(this.castId);

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement | null {

        return new DOMParser().parseFromString(`
        
            <div class="cdm-form broadcast-invite-create flex flex-col gap-0 ${CDM_FORM_CLASSES()} w-full">
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
                                ${t("forms.broadcast_invite_create.name")}
                            </span>
                            ${Inputs.create({
            placeholder: t("forms.broadcast_invite_create.name"),
            name: "name",
            attributes: ["required"]
        })}
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("users", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${t("forms.broadcast_invite_create.number_users")}
                            </span>
                            <span class="text-sm text-secondary">${t("forms.broadcast_invite_create.number_users_desc")}</span>

                            ${Toggle.switch({
            name: "is-max-users",
            checked: false,
            toggleText: {
                on: t("forms.broadcast_invite_create.limited"),
                off: t("forms.broadcast_invite_create.infifnity")
            }
        })}

                            <div data-max-users class="hidden">
                                ${Inputs.number({
            placeholder: t("forms.broadcast_invite_create.number_users"),
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

        `, "text/html").querySelector<HTMLElement>(".cdm-form");

    }

}
