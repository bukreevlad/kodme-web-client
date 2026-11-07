// Импортируем сторонние пакеты
import { OverlayScrollbars } from "overlayscrollbars";

// Импортируем config
import { CDM_MODAL_CLASSES, CDM_MODAL_CONTENT_CLASSES, CDM_MODAL_FOOTER_CLASSES, CDM_MODAL_HEADER_CLASSES } from "../../../../config/constants.js";

// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";
import { Icons } from "../../../../utils/icons.js";

// Импортируем components
import { Overlay } from "../../../../components/overlay/index.js";
import { Buttons } from "../../../../components/buttons.js";
import { Inputs } from "../../../../components/inputs.js";

// Импортируем forms
import { BotProfile } from "../../../bot-profile/index.js";

// Импортируем handlers
import { importHandler } from "./handlers/import.js";

/**
 * Настройки диалога импорта меню из JSON.
 */
export interface ImportBotCommandsOptions {

    /** Куда вставить диалог. */
    insertInto?: HTMLElement | null | undefined;

}

/**
 * Данные конструктора диалога импорта меню из JSON.
 */
export interface ImportBotCommandsData {

    /** Id бота. */
    botId: string;

    /** Настройки формы. */
    options?: ImportBotCommandsOptions;

    /** Вызывается с JSON-строкой меню после проверки формы. */
    callback: (json: string) => void;

}

// Form
export class ImportBotCommands {

    // Переменная для хранения единственного экземпляра формы
    static instance: ImportBotCommands | null = null;

    /**
     * ***************************************************************************
     * Диалог импорта меню бота из JSON.
     * @param data - Данные.
     * @param data.botId - Id бота.
     * @param data.options - Настройки формы.
     * @param data.options.insertInto - Куда вставить форму.
     * @param data.callback - Callback с JSON-строкой меню.
     * ***************************************************************************
     */
    constructor(data: ImportBotCommandsData) {

        // Если не передан botId
        if (!data?.botId) throw new Error("Не передан: botId");

        // Поиск открытого профиля пользователя
        let boProfileForm = BotProfile.instances.get(data.botId);
        let insertInto = boProfileForm?.modal?.content || null;

        // Устанавливаем настройки
        this.options = {
            insertInto: insertInto || data.options?.insertInto,
            ...data?.options
        }

        // Переменные формы
        this.tpl = null;
        this.modal = null;
        this.content = null;
        this.osListScrollInstance = null; // overlayScroll instance

        // Переменные формы
        this.callback = data.callback;

        // Проверяем, существует ли уже экземпляр
        if (ImportBotCommands.instance) {
            return ImportBotCommands.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        ImportBotCommands.instance = this;

        // Инициализация
        this._init();

    }

    // Настройки формы
    options: ImportBotCommandsOptions;

    // Callback с JSON-строкой меню
    callback: (json: string) => void;

    // Каркас: шаблон, модалка, контент
    tpl: HTMLElement | null;
    modal: Overlay | null;
    content: HTMLElement | null;
    osListScrollInstance: OverlayScrollbars | null;

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
                insertInto: this.options.insertInto,
                closeOnEsc: true,
                closeOnOverlay: true,
                onBeforeOpen: async () => await this._onBeforeOpen(),
                onOpen: async () => await this._onOpen(),
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

            // Сохранить
            let save = this.tpl?.querySelector(":scope >.footer [action-save]");
            save?.addEventListener("click", () => importHandler(this));

            // Отмена
            let close = this.tpl?.querySelector(":scope >.footer [action-close]");
            close?.addEventListener("click", () => this.modal?.close());

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

            // Инициализируем скролл
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
    async _onOpen(): Promise<void> {

        // Устанавливаем обработчики
        this._handlers();

    }

    // ***************************************************************************
    // Действия при закрытии формы
    // ***************************************************************************
    _onBeforeClose(): void {

        // Удаляем экземпляр формы
        ImportBotCommands.instance = null;

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement | null {

        return new DOMParser().parseFromString(`

            <div class="cdm-modal bot-import-commands-from-json flex flex-col p-0 gap-0 w-[26rem] ${CDM_MODAL_CLASSES()}">
                <div class="${CDM_MODAL_HEADER_CLASSES()}">
                    <span class="flex flex-row gap-2 items-center font-semibold text-lg">${window._lc.forms.bot_settings.dialogs.import_json.title}</span>
                </div>
                 <div class="${CDM_MODAL_CONTENT_CLASSES()}">
                    <div class="flex flex-col gap-2">

                        ${Inputs.textarea({ placeholder: window._lc.forms.bot_settings.dialogs.import_json.json_menu, classes: ["font-mono", "text-xs"], name: "code" })}

                    </div>
                </div>
                <div class="${CDM_MODAL_FOOTER_CLASSES()}">
                    ${Buttons.primary({ shape: "square", attributes: ["action-save"], classes: ["w-full"], text: window._lc.forms.bot_settings.dialogs.import_json.action_save })}
                    ${Buttons.create({ shape: "square", attributes: ["action-close"], classes: ["w-full"], text: window._lc.forms.bot_settings.dialogs.import_json.action_close })}
                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-modal");

    }

}
