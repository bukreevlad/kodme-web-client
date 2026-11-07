// Импортируем сторонние пакеты
import { Html5Qrcode } from "html5-qrcode";

// Импортируем config
import { CDM_FORM_CLASSES, CDM_FORM_HEADER_CLASSES, CDM_FORM_CONTENT_CLASSES } from "../../config/constants.js";

// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Buttons } from "../../components/buttons.js";

// Импортируем forms
import { UserProfile } from "../user-profile/index.js";

// Импортируем functions
import { startScanner } from "./functions/start_scanner.js";
import { stopScanner } from "./functions/stop_scanner.js";
import { t } from "../../utils/i18n/index.js";

/**
 * Настройки формы входа по QR-коду.
 */
export interface UserSettingLoginWithQRCodeOptions {

    /** Куда вставить форму. */
    insertInto?: HTMLElement | null;

}

/**
 * Данные конструктора формы.
 */
export interface UserSettingLoginWithQRCodeData {

    /** Id пользователя. */
    userId: string;

    /** Настройки формы. */
    options?: UserSettingLoginWithQRCodeOptions;

}

// Form
export class UserSettingLoginWithQRCode {

    // Переменная для хранения единственного экземпляра формы
    static instance: UserSettingLoginWithQRCode | null = null;

    /** Настройки формы. */
    options: UserSettingLoginWithQRCodeOptions;

    /** Id пользователя. */
    userId: string;

    /** Шаблон формы. */
    tpl: HTMLElement | null = null;

    /** Модальное окно формы. */
    modal: Overlay | null = null;

    /** Флаг активного сканирования. */
    scanning: boolean;

    /** Экземпляр сканера QR-кода. */
    html5QrCode: Html5Qrcode | null;

    /**
     * ***************************************************************************
     * Форма.
     * @param data - Данные.
     * @param data.userId - Id пользователя.
     * @param data.options - Настройки формы.
     * @param data.options.insertInto - Куда вставить форму.
     * ***************************************************************************
     */
    constructor(data: UserSettingLoginWithQRCodeData) {

        // Если не передан userId
        if (!data?.userId) throw new Error("Не передан: userId");

        // Поиск открытого профиля пользователя
        let userProfileForm = UserProfile.instances.get(data.userId);
        let insertInto = userProfileForm?.modal?.content || null;

        // Устанавливаем настройки
        this.options = {
            insertInto,
            ...data?.options
        }

        // Переменные формы
        this.userId = data.userId;

        // Для работы с камерой
        this.scanning = false;
        this.html5QrCode = null;

        // Проверяем, существует ли уже экземпляр
        if (UserSettingLoginWithQRCode.instance) {
            return UserSettingLoginWithQRCode.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        UserSettingLoginWithQRCode.instance = this;

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
                type: "form",
                url: `?user-setting-login-qrcode=${this.userId}`,
                insertInto: this.options.insertInto,
                closeOnEsc: false,
                closeOnOverlay: false,
                onOpen: () => this._onOpen(),
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

            // Закрыть
            let close = this.tpl?.querySelector(`:scope >.header [action-close]`);
            close?.addEventListener("click", () => this.modal?.close());

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Форма открылась
    // ***************************************************************************
    async _onOpen(): Promise<void> {

        // Устанавливаем handlers
        this._handlers();

        // Запускаем сканирование
        await startScanner(this);

    }

    // ***************************************************************************
    // Действия при закрытии формы
    // ***************************************************************************
    async _onClose(): Promise<void> {

        try {

            // Останавливаем сканирование
            await stopScanner(this);

        } catch (error) {
            Logger.error("Cleanup error:", error);
        }

        // Удаляем экземпляр формы
        UserSettingLoginWithQRCode.instance = null;

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement {

        return new DOMParser().parseFromString(`
        
            <div class="cdm-form user-setting-login-qrcode flex flex-col gap-0 ${CDM_FORM_CLASSES()} w-full">
                <div class="header flex flex-row gap-2 p-2 items-center justify-start ${CDM_FORM_HEADER_CLASSES()}">
                    ${Buttons.transparent({ shape: "circle", attributes: ["action-close"], icon: "ArrowLeft" })}
                    <span class="flex flex-row gap-2 items-center font-semibold text-lg">${t("forms.user_setting_login_qrcode.scan_desc")}</span>
                </div>
                 <div class="content w-full h-full flex flex-col ${CDM_FORM_CONTENT_CLASSES()}">
                    <div id="video-qrcode-container" class="flex h-full w-full overflow-hidden"></div>
                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-form")!;

    }

}
