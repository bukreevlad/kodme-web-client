// Импортируем config
import { CDM_MODAL_CLASSES, CDM_MODAL_CONTENT_CLASSES, CDM_MODAL_FOOTER_CLASSES, CDM_MODAL_HEADER_CLASSES } from "../../../../config/constants.js";

// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем components
import { Overlay } from "../../../../components/overlay/index.js";
import { Buttons } from "../../../../components/buttons.js";

import { t } from "../../../../utils/i18n/index.js";

/**
 * Настройки диалога подтверждения (подписи диалог берёт сам из локали).
 */
export interface ConfirmInviteDialogOptions {

    /** Куда вставить диалог. */
    insertInto?: HTMLElement | null | undefined;

    /** Callback подтверждения (true/false). */
    callback?: ((response: boolean) => void) | null;

}

// Form
export class ConfirmInviteDialog {

    // Переменная для хранения единственного экземпляра формы
    static instance: ConfirmInviteDialog | null = null;

    /** Настройки диалога. */
    options: Required<ConfirmInviteDialogOptions>;

    /** Шаблон диалога. */
    tpl: HTMLElement | null = null;

    /** Модальное окно диалога. */
    modal: Overlay | null = null;

    /**
     * ***************************************************************************
     * Диалог подтверждения отзыва приглашения канала.
     * @param data - Данные.
     * @param data.insertInto - Куда вставить диалог.
     * @param data.callback - Callback подтверждения (true/false).
     * ***************************************************************************
     */
    constructor({
        insertInto = null,
        callback = null
    }: ConfirmInviteDialogOptions) {

        // Устанавливаем настройки
        this.options = {
            insertInto,
            callback
        };

        // Проверяем, существует ли уже экземпляр
        if (ConfirmInviteDialog.instance) {
            return ConfirmInviteDialog.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        ConfirmInviteDialog.instance = this;

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
    // Обработчики
    // ***************************************************************************
    _handlers(): void {

        try {

            // Закрыть из шапки
            let headerClose = this.tpl?.querySelector(":scope >.header [action-close]");
            headerClose?.addEventListener("click", () => this.modal?.close());

            // Подтвердить действие
            let remove = this.tpl?.querySelector(":scope >.footer [action-remove]");
            remove?.addEventListener("click", () => this.options.callback?.(true));

            // Отмена
            let close = this.tpl?.querySelector(":scope >.footer [action-close]");
            close?.addEventListener("click", () => this.modal?.close());

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Действия при закрытии диалога
    // ***************************************************************************
    _onBeforeClose(): void {

        // Удаляем экземпляр формы
        ConfirmInviteDialog.instance = null;

    }

    // ***************************************************************************
    // Шаблон диалога
    // ***************************************************************************
    _template(): HTMLElement {

        return new DOMParser().parseFromString(`

            <div class="cdm-modal channel-invite-confirm flex flex-col p-0 gap-0 ${CDM_MODAL_CLASSES()}">
                <div class="${CDM_MODAL_HEADER_CLASSES()}">
                    <span class="flex flex-row gap-2 items-center font-semibold text-base">${t("forms.channel_manage_invites.dialogs.revoke.title")}</span>
                    ${Buttons.transparent({ shape: "circle", attributes: ["action-close"], icon: "x" })}
                </div>
                <div class="${CDM_MODAL_CONTENT_CLASSES()}">
                    <span class="text-secondary text-sm">${t("forms.channel_manage_invites.dialogs.revoke.description")}</span>
                </div>
                <div class="${CDM_MODAL_FOOTER_CLASSES()}">
                    ${Buttons.create({ attributes: ["action-close"], classes: ["w-full"], text: t("forms.channel_manage_invites.dialogs.revoke.action_close") })}
                    ${Buttons.danger({ attributes: ["action-remove"], classes: ["w-full"], text: t("forms.channel_manage_invites.dialogs.revoke.action_remove") })}
                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-modal")!;

    }

}
