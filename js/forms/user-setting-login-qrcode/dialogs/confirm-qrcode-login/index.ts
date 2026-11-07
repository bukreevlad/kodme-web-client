// Импортируем config
import { CDM_MODAL_CLASSES, CDM_MODAL_FOOTER_CLASSES, CDM_MODAL_HEADER_CLASSES } from "../../../../config/constants.js";

// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";
import { Icons } from "../../../../utils/icons.js";

// Импортируем components
import { Overlay } from "../../../../components/overlay/index.js";
import { Buttons } from "../../../../components/buttons.js";

// Импортируем handlers
import { confirmHandler } from "./handlers/confirm.js";

// Импортируем типы
import type { ScannedQRData } from "../../requests/scanned.js";

/**
 * Настройки диалога подтверждения входа.
 */
export interface ConfirmQRCodeLoginOptions {

    /** Куда вставить диалог. */
    insertInto?: HTMLElement | null;

}

/**
 * Данные конструктора диалога.
 */
export interface ConfirmQRCodeLoginData {

    /** Id пользователя. */
    userId: string;

    /** Данные сканирования (ip, user_agent, session_id устройства). */
    scannedResult: ScannedQRData;

    /** Настройки диалога. */
    options?: ConfirmQRCodeLoginOptions;

}

// Form
export class ConfirmQRCodeLogin {

    // Переменная для хранения единственного экземпляра формы
    static instance: ConfirmQRCodeLogin | null = null;

    /** Настройки диалога. */
    options: ConfirmQRCodeLoginOptions;

    /** Данные сканирования. */
    scannedResult: ScannedQRData;

    /** Шаблон диалога. */
    tpl: HTMLElement | null = null;

    /** Модальное окно диалога. */
    modal: Overlay | null = null;

    /**
     * ***************************************************************************
     * Диалог подтверждения входа по QR-коду.
     * @param data - Данные.
     * @param data.userId - Id пользователя.
     * @param data.scannedResult - Данные сканирования.
     * @param data.options - Настройки диалога.
     * @param data.options.insertInto - Куда вставить диалог.
     * ***************************************************************************
     */
    constructor(data: ConfirmQRCodeLoginData) {

        // Если не передан userId
        if (!data?.userId) throw new Error("Не передан: userId");

        // Устанавливаем настройки
        this.options = {
            ...data?.options
        }

        // Переменные формы
        this.scannedResult = data.scannedResult;

        // Проверяем, существует ли уже экземпляр
        if (ConfirmQRCodeLogin.instance) {
            return ConfirmQRCodeLogin.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        ConfirmQRCodeLogin.instance = this;

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

            // Форма
            this.modal = new Overlay(this.tpl, {
                type: "modal",
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

            // Обработчики вешаются на узлы шаблона — без него нечего слушать
            if (!this.tpl) return;

            // Закрыть
            let close = this.tpl.querySelector(":scope >.header [action-close]");
            close?.addEventListener("click", () => this.modal?.close());

            // Отмена
            let decline = this.tpl.querySelector(":scope >.footer [action-decline]");
            decline?.addEventListener("click", () => this.modal?.close());

            // Подтвердить
            let confirm = this.tpl.querySelector(":scope >.footer [action-confirm]");
            confirm?.addEventListener("click", () => confirmHandler(this));

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Настройка формы
    // ***************************************************************************
    async _setup(): Promise<void> {

        try {

            // Элементы задаются шаблоном — без него нечего заполнять
            if (!this.tpl) return;

            // Устанавливаем элементы
            let ip = this.tpl.querySelector<HTMLElement>(`:scope >.content [data-ip]`);
            let device = this.tpl.querySelector<HTMLElement>(`:scope >.content [data-device]`);

            // Поля обязаны входить в шаблон — иначе данные показать нечего
            if (!ip || !device) return;

            // Записываем данные
            ip.textContent = this.scannedResult.ip;
            device.textContent = this.scannedResult.user_agent;

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Действия при закрытии формы
    // ***************************************************************************
    _onClose(): void {

        // Удаляем экземпляр формы
        ConfirmQRCodeLogin.instance = null;

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement {

        return new DOMParser().parseFromString(`

            <div class="cdm-modal confirm-qrcode-login flex flex-col gap-0 ${CDM_MODAL_CLASSES()}">
                <div class="${CDM_MODAL_HEADER_CLASSES()}">
                    <span class="font-semibold text-lg">${window._lc.forms.user_setting_login_qrcode.dialogs.confirm_qrcode_login.confirm_enter}</span>
                    ${Buttons.transparent({ shape: "circle", attributes: ["action-close"], icon: "x" })}
                </div>
                 <div class="content w-full flex flex-col gap-1 p-3 items-center">

                    <span class="flex flex-row gap-2 items-center font-semibold">
                        <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                            ${Icons.icon("phone-check", { settings: { size: 20 } })?.outerHTML ?? ""}
                        </span>
                        ${window._lc.forms.user_setting_login_qrcode.dialogs.confirm_qrcode_login.new_device}
                    </span>
                    <div class="flex flex-col gap-1 p-3">
                        <span data-ip class="text-sm text-secondary"></span>
                        <span data-device class="text-sm text-secondary"></span>
                    </div>

                </div>
                <div class="${CDM_MODAL_FOOTER_CLASSES()}">
                    ${Buttons.create({ attributes: ["action-decline"], classes: ["w-full"], text: window._lc.forms.user_setting_login_qrcode.dialogs.confirm_qrcode_login.decline })}
                    ${Buttons.primary({ attributes: ["action-confirm"], classes: ["w-full"], text: window._lc.forms.user_setting_login_qrcode.dialogs.confirm_qrcode_login.confirm })}
                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-modal")!;

    }

}
