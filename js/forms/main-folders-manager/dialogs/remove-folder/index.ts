// Импортируем config
import { CDM_MODAL_CLASSES, CDM_MODAL_CONTENT_CLASSES, CDM_MODAL_FOOTER_CLASSES, CDM_MODAL_HEADER_CLASSES } from "../../../../config/constants.js";

// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";
import { Icons } from "../../../../utils/icons.js";

// Импортируем components
import { Overlay } from "../../../../components/overlay/index.js";
import { Buttons } from "../../../../components/buttons.js";

// Импортируем handlers
import { removeFolderHandler } from "../../handlers/remove_folder.js";

// Импортируем типы
import type { MainFoldersManagerFolder } from "../../types.js";
import { t } from "../../../../utils/i18n/index.js";

/**
 * Настройки диалога подтверждения удаления папки.
 */
export interface RemoveFolderDialogOptions {

    /** Куда вставить форму. */
    insertInto?: HTMLElement | null;

}

/**
 * Данные диалога подтверждения удаления папки.
 */
export interface RemoveFolderDialogData {

    /** Данные удаляемой папки. */
    folder: MainFoldersManagerFolder;

    /** Настройки формы. */
    options?: RemoveFolderDialogOptions;

}

// Dialog
export class RemoveFolderDialog {

    // Переменная для хранения единственного экземпляра формы
    static instance: RemoveFolderDialog | null = null;

    // Настройки формы
    options: RemoveFolderDialogOptions;

    // Переменные формы
    folder: MainFoldersManagerFolder;
    tpl: HTMLElement | null;
    modal: Overlay | null;

    /**
     * ***************************************************************************
     * Диалог подтверждения удаления папки.
     * @param data - Данные.
     * @param data.folder - Данные удаляемой папки.
     * @param data.options - Настройки формы.
     * @param data.options.insertInto - Куда вставить форму.
     * ***************************************************************************
     */
    constructor(data: RemoveFolderDialogData) {

        // Устанавливаем настройки
        this.options = {
            insertInto: document.body,
            ...data?.options
        }

        // Переменные формы
        this.folder = data.folder;
        this.tpl = null;
        this.modal = null;

        // Проверяем, существует ли уже экземпляр
        if (RemoveFolderDialog.instance) {
            return RemoveFolderDialog.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        RemoveFolderDialog.instance = this;

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
                type: "modal",
                insertInto: this.options.insertInto,
                closeOnEsc: true,
                closeOnOverlay: true,
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

            // Закрыть из шапки
            let headerClose = this.tpl.querySelector(":scope >.header [action-close]");
            headerClose?.addEventListener("click", () => this.modal?.close());

            // Отмена
            let close = this.tpl.querySelector(":scope >.footer [action-close]");
            close?.addEventListener("click", () => this.modal?.close());

            // Удалить
            let remove = this.tpl.querySelector(":scope >.footer [action-remove]");
            remove?.addEventListener("click", async () => {

                // Удаляем папку
                await removeFolderHandler(this.folder);

                // Закрываем диалог
                this.modal?.close();

            });

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Настройка формы
    // ***************************************************************************
    async _onBeforeOpen(): Promise<void> {

        try {

            // Элементы задаются шаблоном — без него нечего заполнять
            if (!this.tpl) return;

            // Название папки в тексте диалога
            let folderName = this.tpl.querySelector<HTMLElement>(":scope >.content [data-folder-name]");
            if (folderName) folderName.textContent = `«${this.folder?.name || ""}»`;

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
        RemoveFolderDialog.instance = null;

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement {

        // invariant: корневой .cdm-modal входит в сам шаблон — querySelector
        // с текстовым HTML всегда находит его
        return new DOMParser().parseFromString(`

            <div class="cdm-modal remove-folder flex flex-col p-0 gap-0 ${CDM_MODAL_CLASSES()}">
                <div class="${CDM_MODAL_HEADER_CLASSES()}">
                    <span class="flex flex-row gap-2 items-center font-semibold text-base">
                        <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-red)]/10 text-[var(--color-red)]">${Icons.icon("trash", { settings: { size: 20 } })?.outerHTML ?? ""}</span>
                        ${t("forms.main_folders_manager.dialogs.remove_folder.desc")}
                    </span>
                    ${Buttons.transparent({ shape: "circle", attributes: ["action-close"], icon: "x" })}
                </div>
                <div class="${CDM_MODAL_CONTENT_CLASSES()}">
                    <span data-folder-name class="font-semibold"></span>
                    <span class="text-sm text-muted">${t("forms.main_folders_manager.dialogs.remove_folder.text")}</span>
                </div>
                <div class="${CDM_MODAL_FOOTER_CLASSES()}">
                    ${Buttons.create({
                        shape: "square",
                        attributes: ["action-close"],
                        classes: ["w-full"],
                        text: t("forms.main_folders_manager.dialogs.remove_folder.action_cancel")
                    })}
                    ${Buttons.danger({
                        shape: "square",
                        attributes: ["action-remove"],
                        classes: ["w-full"],
                        text: t("forms.main_folders_manager.dialogs.remove_folder.action_remove"),
                        icon: "trash"
                    })}
                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-modal")!;

    }

}