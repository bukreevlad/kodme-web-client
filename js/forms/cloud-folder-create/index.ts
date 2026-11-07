// Импортируем config
import { CDM_FORM_CLASSES, CDM_FORM_HEADER_CLASSES, CDM_FORM_CONTENT_CLASSES, CDM_FORM_SECTION_CLASSES } from "../../config/constants.js";

// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Buttons } from "../../components/buttons.js";
import { Inputs } from "../../components/inputs.js";

// Импортируем handlers
import { createHandler } from "./handlers/create.js";

// Импортируем типы
import type { Cloud } from "../cloud/index.js";
import { t } from "../../utils/i18n/index.js";

/**
 * Настройки диалога создания папки.
 */
export interface CreateFolderOptions {

    /** Куда вставить диалог. */
    insertInto?: HTMLElement | null;

}

/**
 * Данные конструктора диалога.
 */
export interface CreateFolderData {

    /** Экземпляр формы облака. */
    form: Cloud;

    /** Настройки диалога. */
    options?: CreateFolderOptions;

}

// Form
export class CreateFolder {

    // Переменная для хранения единственного экземпляра формы
    static instance: CreateFolder | null = null;

    /**
     * ***************************************************************************
     * Форма создания папки.
     * @param data - Данные.
     * @param data.form - Экземпляр формы облака.
     * @param data.options - Настройки формы.
     * ***************************************************************************
     */
    constructor(data: CreateFolderData) {

        // Если не передан form
        if (!data?.form) throw new Error("Не передан: form");

        // Устанавливаем настройки. Форма живёт в левой колонке home —
        // как и group-create, а не поверх всего документа
        this.options = {
            insertInto: document.querySelector(".cdm-form.home .left"),
            ...data?.options
        }

        // Переменные формы
        this.tpl = null;
        this.modal = null;

        // Переменные формы
        this.form = data.form;

        // Проверяем, существует ли уже экземпляр
        if (CreateFolder.instance) {
            return CreateFolder.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        CreateFolder.instance = this;

        // Инициализация
        this._init();

    }

    // Настройки формы
    options: CreateFolderOptions;

    // Каркас: шаблон и модалка
    tpl: HTMLElement | null = null;
    modal: Overlay | null = null;

    // Экземпляр формы облака
    form: Cloud;

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
                insertInto: this.options.insertInto,
                closeOnEsc: false,
                closeOnOverlay: false,
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

            // Закрыть
            let close = this.tpl?.querySelector(":scope >.header [action-close]");
            close?.addEventListener("click", () => this.modal?.close());

            // Создать
            let create = this.tpl?.querySelector(":scope >.header [action-create]");
            create?.addEventListener("click", () => createHandler(this));

            // Создать по Enter
            let input = this.tpl?.querySelector<HTMLInputElement>(":scope [name='name']");
            input?.addEventListener("keydown", (event) => {
                if (event.key === "Enter") {
                    createHandler(this);
                }
            });

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Форма открылась
    // ***************************************************************************
    _onOpen(): void {

        // Устанавливаем обработчики
        this._handlers();

        // Фокусируемся на поле ввода
        let input = this.tpl?.querySelector<HTMLInputElement>(":scope [name='name']");
        input?.focus();

    }

    // ***************************************************************************
    // Действия при закрытии формы
    // ***************************************************************************
    _onBeforeClose(): void {

        // Удаляем экземпляр формы
        CreateFolder.instance = null;

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement | null {

        return new DOMParser().parseFromString(`

            <div class="cdm-form cloud-create-folder flex flex-col gap-0 ${CDM_FORM_CLASSES()} w-full">
                <div class="header flex flex-row gap-2 p-2 items-center ${CDM_FORM_HEADER_CLASSES()}">
                    ${Buttons.transparent({ shape: "circle", attributes: ["action-close"], icon: "ArrowLeft" })}
                    <span class="flex-1 font-semibold text-base truncate">${t("forms.cloud.dialogs.create_folder.title")}</span>
                    ${Buttons.transparent({ shape: "circle", attributes: ["action-create"], icon: "device-floppy" })}
                </div>
                 <div class="content w-full h-full flex ${CDM_FORM_CONTENT_CLASSES()}">
                    <div class="flex flex-col gap-3 p-3 max-w-[var(--form-max-content-width)] m-auto w-full h-full">
                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="text-secondary text-sm">${t("forms.cloud.dialogs.create_folder.name")}</span>
                            ${Inputs.create({
            placeholder: t("forms.cloud.dialogs.create_folder.name"),
            name: "name",
            attributes: ["required"]
        })}
                        </div>
                    </div>
                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-form");

    }

}
