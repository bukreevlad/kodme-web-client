// Импортируем config
import { CDM_FORM_CLASSES, CDM_FORM_HEADER_CLASSES, CDM_FORM_CONTENT_CLASSES, CDM_FORM_SECTION_CLASSES } from "../../config/constants.js";

// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Buttons } from "../../components/buttons.js";
import { Inputs } from "../../components/inputs.js";

/**
 * Настройки диалога переименования ключа доступа.
 */
export interface PasskeyRenameDialogOptions {

    /** Текущее имя ключа. */
    name: string;

    /** Куда вставить диалог. */
    insertInto?: HTMLElement | null | undefined;

    /** Callback сохранения (новое имя). */
    callback?: ((name: string) => void) | null;

}

// Form
export class PasskeyRenameDialog {

    // Переменная для хранения единственного экземпляра формы
    static instance: PasskeyRenameDialog | null = null;

    /** Настройки диалога. */
    options: Required<PasskeyRenameDialogOptions>;

    /** Шаблон диалога. */
    tpl: HTMLElement | null = null;

    /** Модальное окно диалога. */
    modal: Overlay | null = null;

    /**
     * ***************************************************************************
     * Диалог переименования ключа доступа: одно поле с именем.
     * @param data - Данные.
     * @param data.name - Текущее имя ключа.
     * @param data.insertInto - Куда вставить диалог.
     * @param data.callback - Callback сохранения (новое имя).
     * ***************************************************************************
     */
    constructor({
        name = "",
        insertInto = null,
        callback = null
    }: PasskeyRenameDialogOptions) {

        // Устанавливаем настройки. Родитель (форма безопасности) приходит
        // от вызывающего, без него остаётся левая колонка home
        this.options = {
            name,
            insertInto: insertInto ?? document.querySelector(".cdm-form.home .left"),
            callback
        };

        // Проверяем, существует ли уже экземпляр
        if (PasskeyRenameDialog.instance) {
            return PasskeyRenameDialog.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        PasskeyRenameDialog.instance = this;

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

            // Модальное окно
            this.modal = new Overlay(this.tpl, {
                type: "form",
                insertInto: this.options.insertInto,
                closeOnEsc: false,
                closeOnOverlay: false,
                onBeforeOpen: () => this._setup(),
                onOpen: () => this._handlers(),
                onBeforeClose: () => this._onBeforeClose()
            });

            // Открываем диалог
            this.modal.open();

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Настройка диалога
    // ***************************************************************************
    _setup(): void {

        // Фокусируем поле ввода имени и подставляем текущее имя ключа
        const nameInput = this.tpl?.querySelector<HTMLInputElement>("[name=\"name\"]");
        if (nameInput) nameInput.value = this.options.name;
        nameInput?.focus?.();
        nameInput?.select?.();

    }

    // ***************************************************************************
    // Обработчики
    // ***************************************************************************
    _handlers(): void {

        try {

            // Закрыть из шапки
            let headerClose = this.tpl?.querySelector(":scope >.header [action-close]");
            headerClose?.addEventListener("click", () => this.modal?.close());

            // Сохранить имя (уходит в callback — обработчик формы)
            let save = this.tpl?.querySelector(":scope >.header [action-save]");
            save?.addEventListener("click", () => {

                // Считываем имя и передаём наружу
                const name = this.tpl?.querySelector<HTMLInputElement>("[name=\"name\"]");
                this.options.callback?.(name?.value.trim() ?? "");

            });

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Действия при закрытии диалога
    // ***************************************************************************
    _onBeforeClose(): void {

        // Удаляем экземпляр формы
        PasskeyRenameDialog.instance = null;

    }

    // ***************************************************************************
    // Шаблон диалога
    // ***************************************************************************
    _template(): HTMLElement {

        return new DOMParser().parseFromString(`

            <div class="cdm-form security-passkey-rename flex flex-col gap-0 ${CDM_FORM_CLASSES()} w-full">
                <div class="header flex flex-row gap-2 p-2 items-center ${CDM_FORM_HEADER_CLASSES()}">
                    ${Buttons.transparent({ shape: "circle", attributes: ["action-close"], icon: "ArrowLeft" })}
                    <span class="flex-1 font-semibold text-base truncate">${window._lc.forms.user_setting_security.passkey_rename_title}</span>
                    ${Buttons.transparent({ shape: "circle", attributes: ["action-save"], icon: "device-floppy" })}
                </div>
                <div class="content w-full h-full flex ${CDM_FORM_CONTENT_CLASSES()}">
                    <div class="flex flex-col gap-3 p-3 max-w-[var(--form-max-content-width)] m-auto w-full">
                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            ${Inputs.create({
                                placeholder: window._lc.forms.user_setting_security.passkey_name_placeholder,
                                name: "name",
                                icon: "key",
                                attributes: [
                                    "required",
                                    { name: "autocomplete", value: "off" },
                                    { name: "maxlength", value: "64" }
                                ]
                            })}
                        </div>
                    </div>
                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-form")!;

    }

}
