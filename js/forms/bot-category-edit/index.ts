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
import type { BotCategoryEditResult, BotMenuRecord } from "../bot-settings/types.js";
import { t } from "../../utils/i18n/index.js";

/**
 * Настройки диалога редактирования папки.
 */
export interface EditBotCategoryOptions {

    /** Куда вставить диалог. */
    insertInto?: HTMLElement | null | undefined;

}

/**
 * Данные конструктора диалога редактирования папки.
 */
export interface EditBotCategoryData {

    /** Id бота. */
    botId: string;

    /** Папка для редактирования. */
    category: BotMenuRecord;

    /** Настройки формы. */
    options?: EditBotCategoryOptions;

    /** Вызывается с результатом: правка полей либо удаление папки. */
    callback: (result: BotCategoryEditResult) => void;

}

// Form
export class EditBotCategory {

    // Переменная для хранения единственного экземпляра формы
    static instance: EditBotCategory | null = null;

    /**
     * ***************************************************************************
     * Диалог редактирования папки меню бота.
     * @param data - Данные.
     * @param data.botId - Id бота.
     * @param data.category - Папка для редактирования.
     * @param data.options - Настройки формы.
     * @param data.options.insertInto - Куда вставить форму.
     * @param data.callback - Callback с результатом редактирования.
     * ***************************************************************************
     */
    constructor(data: EditBotCategoryData) {

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
        this.category = data.category;
        this.callback = data.callback;

        // Проверяем, существует ли уже экземпляр
        if (EditBotCategory.instance) {
            return EditBotCategory.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        EditBotCategory.instance = this;

        // Инициализация
        this._init();

    }

    // Настройки формы
    options: EditBotCategoryOptions;

    // Редактируемая папка и callback с результатом
    category: BotMenuRecord;
    callback: (result: BotCategoryEditResult) => void;

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
            let name = this.tpl.querySelector<HTMLInputElement>(":scope >.content [name=name]");
            let about = this.tpl.querySelector<HTMLInputElement>(":scope >.content [name=about]");

            // Поля обязаны входить в шаблон — иначе заполнять нечего
            if (!name || !about) return;

            // Инициализируем скролл
            const content = this.content;
            if (content) {
                this.osListScrollInstance = OverlayScrollbars(content, {
                    scrollbars: { autoHide: "scroll" }, overflow: { x: "hidden", y: "scroll" }
                });
            }

            // Отображаем данные (поля категории опциональны — нормализуем:
            // в легаси undefined уходил в поле как текст «undefined»)
            name.value = this.category.name ?? "";
            about.value = this.category.about ?? "";

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
        EditBotCategory.instance = null;

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement | null {

        return new DOMParser().parseFromString(`

            <div class="cdm-form bot-edit-category flex flex-col gap-0 ${CDM_FORM_CLASSES()} w-full">
                <div class="header flex flex-row gap-2 p-2 items-center ${CDM_FORM_HEADER_CLASSES()}">
                    ${Buttons.transparent({ shape: "circle", attributes: ["action-close"], icon: "ArrowLeft" })}
                    <span class="flex-1 font-semibold text-base truncate">${t("forms.bot_settings.dialogs.edit_category.title")}</span>
                    ${Buttons.transparent({ shape: "circle", attributes: ["action-save"], icon: "device-floppy" })}
                    ${Buttons.transparent({ shape: "circle", attributes: ["action-remove"], icon: "trash" })}
                </div>
                 <div class="content w-full h-full flex ${CDM_FORM_CONTENT_CLASSES()}">
                    <div class="flex flex-col gap-3 p-3 max-w-[var(--form-max-content-width)] m-auto w-full">

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("label", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${t("forms.bot_settings.dialogs.edit_category.name")}
                            </span>
                            ${Inputs.create({ placeholder: t("forms.bot_settings.dialogs.edit_category.name"), name: "name" })}
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("message-circle", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${t("forms.bot_settings.dialogs.edit_category.about")}
                            </span>
                            ${Inputs.textarea({ placeholder: t("forms.bot_settings.dialogs.edit_category.about"), name: "about" })}
                        </div>

                    </div>
                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-form");

    }

}
