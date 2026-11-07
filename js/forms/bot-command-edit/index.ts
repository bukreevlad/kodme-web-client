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

// Импортируем forms
import { BotProfile } from "../bot-profile/index.js";

// Импортируем handlers
import { saveHandler } from "./handlers/save.js";
import { removeHandler } from "./handlers/remove.js";

// Импортируем типы
import type { BotCommandEditResult, BotMenuRecord } from "../bot-settings/types.js";
import { t } from "../../utils/i18n/index.js";

/**
 * Настройки диалога редактирования команды.
 */
export interface EditBotCommandOptions {

    /** Куда вставить диалог. */
    insertInto?: HTMLElement | null | undefined;

}

/**
 * Данные конструктора диалога редактирования команды.
 */
export interface EditBotCommandData {

    /** Id бота. */
    botId: string;

    /** Команда для редактирования. */
    command: BotMenuRecord;

    /** Настройки формы. */
    options?: EditBotCommandOptions;

    /** Вызывается с результатом: правка полей либо удаление команды. */
    callback: (result: BotCommandEditResult) => void;

}

// Form
export class EditBotCommand {

    // Переменная для хранения единственного экземпляра формы
    static instance: EditBotCommand | null = null;

    /**
     * ***************************************************************************
     * Диалог редактирования команды меню бота.
     * @param data - Данные.
     * @param data.botId - Id бота.
     * @param data.command - Команда для редактирования.
     * @param data.options - Настройки формы.
     * @param data.options.insertInto - Куда вставить форму.
     * @param data.callback - Callback с результатом редактирования.
     * ***************************************************************************
     */
    constructor(data: EditBotCommandData) {

        // Если не передан botId
        if (!data?.botId) throw new Error("Не передан: botId");

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
        this.tpl = null;
        this.modal = null;
        this.content = null;
        this.osListScrollInstance = null; // overlayScroll instance

        // Переменные формы
        this.callback = data.callback;
        this.command = data.command;

        // Проверяем, существует ли уже экземпляр
        if (EditBotCommand.instance) {
            return EditBotCommand.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        EditBotCommand.instance = this;

        // Инициализация
        this._init();

    }

    // Настройки формы
    options: EditBotCommandOptions;

    // Редактируемая команда и callback с результатом
    command: BotMenuRecord;
    callback: (result: BotCommandEditResult) => void;

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

            // Без шаблона открывать форму не из чего
            if (!this.tpl) return;

            // Форма
            this.modal = new Overlay(this.tpl, {
                type: "form",
                insertInto: this.options.insertInto,
                closeOnEsc: false,
                closeOnOverlay: false,
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

            // Закрыть
            let close = this.tpl.querySelector(":scope >.header [action-close]");
            close?.addEventListener("click", () => this.modal?.close());

            // Сохранить
            let save = this.tpl.querySelector(":scope >.header [action-save]");
            save?.addEventListener("click", () => saveHandler(this));

            // Удалить
            let remove = this.tpl.querySelector(":scope >.header [action-remove]");
            remove?.addEventListener("click", () => removeHandler(this));

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
            let command = this.tpl.querySelector<HTMLInputElement>(":scope >.content [name=command]");
            let name = this.tpl.querySelector<HTMLInputElement>(":scope >.content [name=name]");
            let about = this.tpl.querySelector<HTMLInputElement>(":scope >.content [name=about]");

            // Поля обязаны входить в шаблон — иначе заполнять нечего
            if (!command || !name || !about) return;

            // Инициализируем скролл
            const content = this.content;
            if (content) {
                this.osListScrollInstance = OverlayScrollbars(content, {
                    scrollbars: { autoHide: "scroll" }, overflow: { x: "hidden", y: "scroll" }
                });
            }

            // Отображаем данные (about опционален — нормализуем, чтобы в поле
            // не «утекало» null)
            command.value = this.command.command ?? "";
            name.value = this.command.name ?? "";
            about.value = this.command.about ?? "";

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
        EditBotCommand.instance = null;

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement | null {

        return new DOMParser().parseFromString(`

            <div class="cdm-form bot-edit-command flex flex-col gap-0 ${CDM_FORM_CLASSES()} w-full">
                <div class="header flex flex-row gap-2 p-2 items-center ${CDM_FORM_HEADER_CLASSES()}">
                    ${Buttons.transparent({ shape: "circle", attributes: ["action-close"], icon: "ArrowLeft" })}
                    <span class="flex-1 font-semibold text-base truncate">${t("forms.bot_settings.dialogs.edit_command.title")}</span>
                    ${Buttons.transparent({ shape: "circle", attributes: ["action-save"], icon: "device-floppy" })}
                    ${Buttons.transparent({ shape: "circle", attributes: ["action-remove"], icon: "trash" })}
                </div>
                 <div class="content w-full h-full flex ${CDM_FORM_CONTENT_CLASSES()}">
                    <div class="flex flex-col gap-3 p-3 max-w-[var(--form-max-content-width)] m-auto w-full">

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("command", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${t("forms.bot_settings.dialogs.edit_command.command")}
                            </span>
                            ${Inputs.create({ placeholder: t("forms.bot_settings.dialogs.edit_command.command"), name: "command", classes: ["font-mono"] })}
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("label", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${t("forms.bot_settings.dialogs.edit_command.name")}
                            </span>
                            ${Inputs.create({ placeholder: t("forms.bot_settings.dialogs.edit_command.name"), name: "name" })}
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("message-circle", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${t("forms.bot_settings.dialogs.edit_command.about")}
                            </span>
                            ${Inputs.textarea({ placeholder: t("forms.bot_settings.dialogs.edit_command.about"), name: "about" })}
                        </div>

                    </div>
                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-form");

    }

}
