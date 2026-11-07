// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";

// Импортируем config
import { CDM_MODAL_CLASSES, CDM_MODAL_CENTERED_CONTENT_CLASSES } from "../../config/constants.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Buttons } from "../../components/buttons.js";

// Импортируем handlers
import { backHandler } from "./handlers/back.js";
import { qrCodePollingHandler } from "./handlers/polling_handler.js";

// Импортируем functions
import { getQRCode } from "./functions/get_qrcode.js";
import { getQRCodeStatusPolling } from "./functions/get_qr_status_polling.js";

// Form
export class LoginWithQRCode {

    // Переменная для хранения единственного экземпляра формы
    static instance: LoginWithQRCode | null = null;

    /** Настройки формы. */
    options: object;

    /** Шаблон формы. */
    tpl: HTMLElement | null = null;

    /** Модальное окно формы. */
    modal: Overlay | null = null;

    /** Id QR-кода авторизации. */
    qrId: string | null = null;

    /** Идентификатор интервала поллинга статуса. */
    pollingInterval: ReturnType<typeof setInterval> | null = null;

    /**
     * ***************************************************************************
     * Форма входа по QR-коду.
     * @param options - Настройки формы.
     * ***************************************************************************
     */
    constructor(options?: object) {

        // Устанавливаем настройки
        this.options = {
            ...options
        }

        // Проверяем, существует ли уже экземпляр
        if (LoginWithQRCode.instance) {
            return LoginWithQRCode.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        LoginWithQRCode.instance = this;

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

            if (!this.tpl) return;

            // Модальное окно
            this.modal = new Overlay(this.tpl, {
                type: "modal",
                closeOnEsc: false,
                closeOnOverlay: false,
                onBeforeOpen: () => this._setup(),
                onOpen: () => this._handlers(),
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

            // Назад
            const back = this.tpl?.querySelector(`:scope >.content [action-back]`);
            back?.addEventListener("click", () => backHandler(this));

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Данные формы
    // ***************************************************************************
    async _setup(): Promise<void> {

        try {

            // Запрашиваем QR-код
            await getQRCode(this);

            // Запускаем поллинг статуса QR-кода
            getQRCodeStatusPolling(this, {
                onProgress: (response) => qrCodePollingHandler(this, response)
            });

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Закрытие формы
    // ***************************************************************************
    _onBeforeClose(): void {

        // Отключаем поллинг (интервал мог не запускаться)
        if (this.pollingInterval !== null) clearInterval(this.pollingInterval);

        // Удаляем экземпляр формы
        LoginWithQRCode.instance = null;

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement | null {

        return new DOMParser().parseFromString(`

            <div class="cdm-modal login-with-qrcode flex flex-col ${CDM_MODAL_CLASSES()}">
                <div class="${CDM_MODAL_CENTERED_CONTENT_CLASSES()} items-center text-center">

                    <div class="flex flex-col items-center text-center gap-0.5 select-none">
                        <span class="text-base font-bold mt-1 leading-snug">${window._lc.forms.login_with_qrcode.title}</span>
                    </div>

                    <div class="flex items-center justify-center w-full max-w-[220px] p-4 rounded-2xl border-2 border-dashed border-[var(--border-color)] bg-[var(--second-bg)]/40 shadow-sm">
                        <img data-qr-code src="" class="w-full h-auto object-contain rounded-xl" alt="QR код" />
                    </div>

                    <p class="text-sm text-secondary leading-snug max-w-xs">${window._lc.forms.login_with_qrcode.scan_desc}</p>

                    <div class="flex flex-col gap-3 w-full pt-1">
                        ${Buttons.create({
                            attributes: ["action-back"],
                            classes: ["w-full"],
                            text: window._lc.forms.login_with_qrcode.back,
                            icon: "arrow-left"
                        })}
                    </div>

                </div>
            </div>

        `, "text/html").querySelector(".cdm-modal");

    }

}
