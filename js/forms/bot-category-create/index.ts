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
import { addHandler } from "./handlers/add.js";

// Импортируем типы
import type { BotCategoryDraft } from "../bot-settings/types.js";
import { t } from "../../utils/i18n/index.js";

/**
 * Настройки диалога добавления папки.
 */
export interface AddBotCategoryOptions {

    /** Куда вставить диалог. */
    insertInto?: HTMLElement | null | undefined;

}

/**
 * Данные конструктора диалога добавления папки.
 */
export interface AddBotCategoryData {

    /** Id бота. */
    botId: string;

    /** Настройки формы. */
    options?: AddBotCategoryOptions;

    /** Вызывается с черновиком папки после проверки формы. */
    callback: (draft: BotCategoryDraft) => void;

}

// Form
export class AddBotCategory {

    // Переменная для хранения единственного экземпляра формы
    static instance: AddBotCategory | null = null;

    /**
     * ***************************************************************************
     * Диалог создания папки меню бота.
     * @param data - Данные.
     * @param data.botId - Id бота.
     * @param data.options - Настройки формы.
     * @param data.options.insertInto - Куда вставить форму.
     * @param data.callback - Callback с черновиком папки.
     * ***************************************************************************
     */
    constructor(data: AddBotCategoryData) {

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

        // Проверяем, существует ли уже экземпляр
        if (AddBotCategory.instance) {
            return AddBotCategory.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        AddBotCategory.instance = this;

        // Инициализация
        this._init();

    }

    // Настройки формы
    options: AddBotCategoryOptions;

    // Каркас: шаблон, модалка, контент
    tpl: HTMLElement | null;
    modal: Overlay | null;
    content: HTMLElement | null;
    osListScrollInstance: OverlayScrollbars | null;

    // Колбэк результата диалога
    callback: (draft: BotCategoryDraft) => void;

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

            // Создать
            let add = this.tpl.querySelector(":scope >.header [action-add]");
            add?.addEventListener("click", () => addHandler(this));

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
    async _onOpen(): Promise<void> {

        // Устанавливаем обработчики
        this._handlers();

    }

    // ***************************************************************************
    // Действия при закрытии формы
    // ***************************************************************************
    _onBeforeClose(): void {

        // Удаляем экземпляр формы
        AddBotCategory.instance = null;

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement | null {

        return new DOMParser().parseFromString(`

            <div class="cdm-form bot-add-category flex flex-col gap-0 ${CDM_FORM_CLASSES()} w-full">
                <div class="header flex flex-row gap-2 p-2 items-center ${CDM_FORM_HEADER_CLASSES()}">
                    ${Buttons.transparent({ shape: "circle", attributes: ["action-close"], icon: "ArrowLeft" })}
                    <span class="flex-1 font-semibold text-base truncate">${t("forms.bot_settings.dialogs.add_category.title")}</span>
                    ${Buttons.transparent({ shape: "circle", attributes: ["action-add"], icon: "device-floppy" })}
                </div>
                 <div class="content w-full h-full flex ${CDM_FORM_CONTENT_CLASSES()}">
                    <div class="flex flex-col gap-3 p-3 max-w-[var(--form-max-content-width)] m-auto w-full">

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("label", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${t("forms.bot_settings.dialogs.add_category.name")}
                            </span>
                            ${Inputs.create({ placeholder: t("forms.bot_settings.dialogs.add_category.name"), name: "name" })}
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("message-circle", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${t("forms.bot_settings.dialogs.add_category.about")}
                            </span>
                            ${Inputs.textarea({ placeholder: t("forms.bot_settings.dialogs.add_category.about"), name: "about" })}
                        </div>

                    </div>
                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-form");

    }

}
