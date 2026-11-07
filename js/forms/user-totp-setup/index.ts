// Импортируем config
import { CDM_FORM_CLASSES, CDM_FORM_HEADER_CLASSES, CDM_FORM_CONTENT_CLASSES, CDM_FORM_SECTION_CLASSES } from "../../config/constants.js";

// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";
import { copyText } from "../../utils/helpers/clipboard.js";
import { Icons } from "../../utils/icons.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Buttons } from "../../components/buttons.js";
import { Inputs } from "../../components/inputs.js";

/**
 * Настройки диалога включения TOTP.
 */
export interface TotpSetupDialogOptions {

    /** QR-картинка (data-URL). */
    qrImage: string;

    /** Секрет в base32 (для ручного ввода). */
    secret: string;

    /** Количество цифр кода. */
    digits: number;

    /** Шаг кода в секундах. */
    step: number;

    /** Куда вставить диалог. */
    insertInto?: HTMLElement | null | undefined;

    /** Callback подтверждения (код из приложения-генератора). */
    callback?: ((code: string) => void) | null;

}

// Form
export class TotpSetupDialog {

    // Переменная для хранения единственного экземпляра формы
    static instance: TotpSetupDialog | null = null;

    /** Настройки диалога. */
    options: Required<TotpSetupDialogOptions>;

    /** Шаблон диалога. */
    tpl: HTMLElement | null = null;

    /** Модальное окно диалога. */
    modal: Overlay | null = null;

    /**
     * ***************************************************************************
     * Диалог включения TOTP: QR-код, секрет и ввод первого кода.
     * @param data - Данные.
     * @param data.qrImage - QR-картинка (data-URL).
     * @param data.secret - Секрет в base32.
     * @param data.digits - Количество цифр кода.
     * @param data.step - Шаг кода в секундах.
     * @param data.insertInto - Куда вставить диалог.
     * @param data.callback - Callback подтверждения (код из приложения).
     * ***************************************************************************
     */
    constructor({
        qrImage = "",
        secret = "",
        digits = 6,
        step = 30,
        insertInto = null,
        callback = null
    }: TotpSetupDialogOptions) {

        // Устанавливаем настройки. Родитель (форма безопасности) приходит
        // от вызывающего, без него остаётся левая колонка home
        this.options = {
            qrImage,
            secret,
            digits,
            step,
            insertInto: insertInto ?? document.querySelector(".cdm-form.home .left"),
            callback
        };

        // Проверяем, существует ли уже экземпляр
        if (TotpSetupDialog.instance) {
            return TotpSetupDialog.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        TotpSetupDialog.instance = this;

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

        // Фокусируем поле ввода кода
        const codeInput = this.tpl?.querySelector<HTMLInputElement>("[name=\"code\"]");
        codeInput?.focus?.();

    }

    // ***************************************************************************
    // Обработчики
    // ***************************************************************************
    _handlers(): void {

        try {

            // Закрыть из шапки
            let headerClose = this.tpl?.querySelector(":scope >.header [action-close]");
            headerClose?.addEventListener("click", () => this.modal?.close());

            // Копирование секрета по клику на блок
            let copySecret = this.tpl?.querySelector("[action-copy-secret]");
            copySecret?.addEventListener("click", async () => {

                // Тосты об успехе/ошибке показывает сам copyText
                await copyText(this.options.secret, {
                    context: "[app][user-setting-security][totp-setup][copy-secret]",
                    successText: window._lc.forms.user_setting_security.totp_secret_copied
                });

            });

            // Подтвердить включение (код уходит в callback — обработчик формы)
            let confirm = this.tpl?.querySelector(":scope >.header [action-confirm]");
            confirm?.addEventListener("click", () => {

                // Считываем код и передаём наружу
                const code = this.tpl?.querySelector<HTMLInputElement>("[name=\"code\"]");
                this.options.callback?.(code?.value.trim() ?? "");

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
        TotpSetupDialog.instance = null;

    }

    // ***************************************************************************
    // Шаблон диалога
    // ***************************************************************************
    _template(): HTMLElement {

        return new DOMParser().parseFromString(`

            <div class="cdm-form security-totp-setup flex flex-col gap-0 ${CDM_FORM_CLASSES()} w-full">
                <div class="header flex flex-row gap-2 p-2 items-center ${CDM_FORM_HEADER_CLASSES()}">
                    ${Buttons.transparent({ shape: "circle", attributes: ["action-close"], icon: "ArrowLeft" })}
                    <span class="flex-1 font-semibold text-base truncate">${window._lc.forms.user_setting_security.totp_setup_title}</span>
                    ${Buttons.transparent({ shape: "circle", attributes: ["action-confirm"], icon: "check" })}
                </div>
                <div class="content w-full h-full flex ${CDM_FORM_CONTENT_CLASSES()}">
                    <div class="flex flex-col gap-3 p-3 max-w-[var(--form-max-content-width)] m-auto w-full">

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="text-secondary text-sm">${window._lc.forms.user_setting_security.totp_setup_desc}</span>

                            <div class="flex justify-center">
                                <!-- QR-картинка сама содержит белый фон (генерация на сервере),
                                     контейнер — на токене темы, чтобы рамка читалась в обеих темах -->
                                <img src="${this.options.qrImage}" alt="${window._lc.forms.user_setting_security.totp_setup_title}" class="w-40 h-40 rounded-xl bg-[var(--form-bg)] p-2 select-none" />
                            </div>
                        </div>

                        <!-- Блок с секретом целиком кликабелен: копирует секрет в буфер.
                             Иконка-бейдж справа — визуальная подсказка действия -->
                        <div action-copy-secret class="flex flex-row gap-3 items-center ${CDM_FORM_SECTION_CLASSES()} hover:bg-[color-mix(in_srgb,var(--second-bg),var(--color-brand)_10%)] cursor-pointer">
                            <div class="flex flex-col gap-1 flex-1 min-w-0">
                                <span class="text-xs text-muted">${window._lc.forms.user_setting_security.totp_secret}</span>
                                <span class="font-mono text-sm break-all">${this.options.secret}</span>
                            </div>
                            <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                ${Icons.icon("copy", { settings: { size: 20 } })?.outerHTML ?? ""}
                            </span>
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="text-sm font-semibold">${window._lc.forms.user_setting_security.totp_code}</span>
                            ${Inputs.create({
                                placeholder: window._lc.forms.user_setting_security.totp_code,
                                name: "code",
                                icon: "key",
                                attributes: [
                                    "required",
                                    { name: "autocomplete", value: "off" },
                                    { name: "inputmode", value: "numeric" },
                                    { name: "maxlength", value: "10" }
                                ],
                                classes: ["font-mono", "tracking-widest"]
                            })}
                        </div>

                    </div>
                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-form")!;

    }

}
