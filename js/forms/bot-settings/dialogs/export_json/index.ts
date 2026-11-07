// Импортируем сторонние пакеты
import { OverlayScrollbars } from "overlayscrollbars";

// Импортируем config
import { CDM_MODAL_CLASSES, CDM_MODAL_CONTENT_CLASSES, CDM_MODAL_FOOTER_CLASSES, CDM_MODAL_HEADER_CLASSES } from "../../../../config/constants.js";

// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем components
import { Overlay } from "../../../../components/overlay/index.js";
import { Buttons } from "../../../../components/buttons.js";
import { Inputs } from "../../../../components/inputs.js";

// Импортируем forms
import { BotProfile } from "../../../bot-profile/index.js";

// Импортируем handlers
import { copyHandler } from "./handlers/copy.js";

// Импортируем типы
import type { BotMenuRecord } from "../../types.js";

/**
 * Настройки диалога экспорта меню в JSON.
 */
export interface ExportBotCommandsOptions {

    /** Куда вставить диалог. */
    insertInto?: HTMLElement | null | undefined;

}

/**
 * Данные конструктора диалога экспорта меню в JSON.
 */
export interface ExportBotCommandsData {

    /** Id бота. */
    botId: string;

    /** Команды и категории меню бота. */
    commands: BotMenuRecord[];

    /** Настройки формы. */
    options?: ExportBotCommandsOptions;

}

// Form
export class ExportBotCommands {

    // Переменная для хранения единственного экземпляра формы
    static instance: ExportBotCommands | null = null;

    /**
     * ***************************************************************************
     * Диалог экспорта меню бота в JSON.
     * @param data - Данные.
     * @param data.botId - Id бота.
     * @param data.commands - Команды и категории меню бота.
     * @param data.options - Настройки формы.
     * @param data.options.insertInto - Куда вставить форму.
     * ***************************************************************************
     */
    constructor(data: ExportBotCommandsData) {

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

        // Меню бота в виде JSON-строки для поля формы
        this.commands = JSON.stringify(data.commands);

        // Проверяем, существует ли уже экземпляр
        if (ExportBotCommands.instance) {
            return ExportBotCommands.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        ExportBotCommands.instance = this;

        // Инициализация
        this._init();

    }

    // Настройки формы
    options: ExportBotCommandsOptions;

    // Меню бота в виде JSON-строки
    commands: string;

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

            // Обработчики вешаются на узлы шаблона — без него нечего слушать
            if (!this.tpl) return;

            // Копировать
            let copy = this.tpl.querySelector(":scope >.footer [action-copy]");
            copy?.addEventListener("click", () => copyHandler(this));

            // Отмена
            let close = this.tpl.querySelector(":scope >.footer [action-close]");
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

            // Элементы заполняются из шаблона — без него нечего настраивать
            if (!this.tpl) return;

            // Устанавливаем элементы
            const content = this.tpl.querySelector<HTMLElement>(":scope >.content");
            const code = this.tpl.querySelector<HTMLInputElement>(":scope >.content [name=code]");
            if (!content || !code) return;
            this.content = content;

            // Инициализируем скролл (скролл-контейнер входит в шаблон)
            this.osListScrollInstance = OverlayScrollbars(content, {
                scrollbars: { autoHide: "scroll" }, overflow: { x: "hidden", y: "scroll" }
            });

            // Отображаем json
            code.value = this.commands;

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
        ExportBotCommands.instance = null;

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement {

        // invariant: корневой .cdm-modal входит в сам шаблон — querySelector
        // с текстовым HTML всегда находит его
        return new DOMParser().parseFromString(`

            <div class="cdm-modal bot-export-commands-to-json flex flex-col p-0 gap-0 w-[26rem] ${CDM_MODAL_CLASSES()}">
                <div class="${CDM_MODAL_HEADER_CLASSES()}">
                    <span class="flex flex-row gap-2 items-center font-semibold text-lg">${window._lc.forms.bot_settings.dialogs.export_json.title}</span>
                </div>
                 <div class="${CDM_MODAL_CONTENT_CLASSES()}">
                    <div class="flex flex-col gap-2">

                        ${Inputs.textarea({ placeholder: window._lc.forms.bot_settings.dialogs.export_json.json_menu, classes: ["font-mono", "text-xs"], name: "code" })}

                    </div>
                </div>
                <div class="${CDM_MODAL_FOOTER_CLASSES()}">
                    ${Buttons.primary({ shape: "square", attributes: ["action-copy"], classes: ["w-full"], text: window._lc.forms.bot_settings.dialogs.export_json.action_copy })}
                    ${Buttons.create({ shape: "square", attributes: ["action-close"], classes: ["w-full"], text: window._lc.forms.bot_settings.dialogs.export_json.action_close })}
                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-modal")!;

    }

}
