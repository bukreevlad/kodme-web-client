// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";
import { Icons } from "../../utils/icons.js";

// Импортируем config
import { CDM_FORM_CLASSES, CDM_FORM_HEADER_CLASSES, CDM_FORM_CONTENT_CLASSES, CDM_FORM_SECTION_CLASSES } from "../../config/constants.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Buttons } from "../../components/buttons.js";
import { Inputs } from "../../components/inputs.js";

// Импортируем forms
import { BotProfile } from "../bot-profile/index.js";

// Импортируем handlers
import { saveBotLinkHandler } from "./handlers/save.js";

/**
 * Данные формы смены ссылки бота.
 */
export interface BotSettingLinkData {

    /** Id бота. */
    botId: string;

    /** Текущий link бота. */
    botLink: string;

    /** Настройки формы. */
    options?: BotSettingLinkOptions;

}

/**
 * Настройки формы смены ссылки бота.
 */
export interface BotSettingLinkOptions {

    /** Куда вставить форму. */
    insertInto?: HTMLElement | null;

}

// Form
export class BotSettingLink {

    // Переменная для хранения единственного экземпляра формы
    static instance: BotSettingLink | null = null;

    /** Настройки формы. */
    options: BotSettingLinkOptions;

    /** Шаблон формы. */
    tpl: HTMLElement | null = null;

    /** Модальное окно формы. */
    modal: Overlay | null = null;

    /** Id бота. */
    botId: string;

    /** Текущий link бота. */
    botLink: string;

    /**
     * ***************************************************************************
     * Форма.
     * @param data - Данные.
     * @param data.botId - Id бота.
     * @param data.botLink - Текущий link бота.
     * @param data.options - Настройки формы.
     * @param data.options.insertInto - Куда вставить форму.
     * ***************************************************************************
     */
    constructor(data: BotSettingLinkData) {

        // Если не передан botId
        if (!data?.botId) throw new Error("Не передан: botId");
        if (!data?.botLink) throw new Error("Не передан: botLink");

        // Поиск открытого профиля бота: дочерняя форма (приложение, команда,
        // категория, ссылка) должна открыться внутри него. Если профиль
        // закрыт — остаётся левая колонка home
        const insertInto: HTMLElement | null = BotProfile.instances.get(data.botId)?.modal?.content
            || document.querySelector(".cdm-form.home .left");

        // Устанавливаем настройки
        this.options = {
            insertInto,
            ...data?.options
        }

        // Переменные формы
        this.botId = data.botId;
        this.botLink = data.botLink;

        // Проверяем, существует ли уже экземпляр
        if (BotSettingLink.instance) {
            return BotSettingLink.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        BotSettingLink.instance = this;

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
                type: "form",
                url: `?bot-setting-ling=${this.botId}`,
                insertInto: this.options.insertInto,
                closeOnEsc: false,
                closeOnOverlay: false,
                onBeforeOpen: () => this._setup(),
                onOpen: () => this._handlers(),
                onBeforeClose: () => this._onClose()
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
            const close = this.tpl?.querySelector(`:scope >.header [action-close]`);
            close?.addEventListener("click", () => this.modal?.close());

            // Сохранить
            const save = this.tpl?.querySelector(`:scope >.header [action-save]`);
            save?.addEventListener("click", () => saveBotLinkHandler(this));

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Настройка формы
    // ***************************************************************************
    async _setup(): Promise<void> {

        try {

            // Устанавливаем элементы
            const link = this.tpl?.querySelector<HTMLInputElement>(`:scope >.content [name="link"]`);

            // Записываем данные
            if (link) link.value = this.botLink;

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Действия при закрытии формы
    // ***************************************************************************
    _onClose(): void {

        // Удаляем экземпляр формы
        BotSettingLink.instance = null;

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement | null {
        
        return new DOMParser().parseFromString(`
        
            <div class="cdm-form bot-setting-link flex flex-col gap-0 ${CDM_FORM_CLASSES()} w-full">
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
                        attributes: ["action-save"],
                        icon: "device-floppy"
                    })}
                </div>
                 <div class="content w-full h-full flex ${CDM_FORM_CONTENT_CLASSES()}">

                    <div class="flex flex-col gap-3 p-3 max-w-[var(--form-max-content-width)] m-auto w-full">

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("link", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${window._lc.forms.bot_setting_link.link}
                            </span>
                            ${Inputs.create({
                                placeholder: window._lc.forms.bot_setting_link.link,
                                name: "link",
                                attributes: ["required"],
                            })}
                            <span class="text-sm text-secondary">${window._lc.forms.bot_setting_link.set_link_desc}</span>
                        </div>

                    </div>

                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-form");

    }

}
