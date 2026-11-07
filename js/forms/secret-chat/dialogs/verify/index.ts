// Импортируем config
import { CDM_MODAL_CLASSES, CDM_MODAL_CONTENT_CLASSES, CDM_MODAL_FOOTER_CLASSES, CDM_MODAL_HEADER_CLASSES } from "../../../../config/constants.js";

// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";
import { Icons } from "../../../../utils/icons.js";
import { fingerprintToEmoji, fingerprintToHex } from "../../../../utils/crypto/fingerprint.js";

// Импортируем components
import { Overlay } from "../../../../components/overlay/index.js";
import { Buttons } from "../../../../components/buttons.js";

// Импортируем forms
import { SecretChat } from "../../index.js";

// Импортируем менеджеры
import { SecretChatsManager } from "../../../../core/managers/secret_chats_manager.js";

// Импортируем handlers
import { verifyHandler } from "./handlers/verify.js";
import { t } from "../../../../utils/i18n/index.js";

/**
 * Настройки диалога сверки ключей.
 */
export interface VerifyChatOptions {

    /** Куда вставить диалог. */
    insertInto?: HTMLElement | null | undefined;

}

/**
 * Данные конструктора диалога сверки ключей.
 */
export interface VerifyChatData {

    /** Id секретного чата. */
    chatId: string;

    /** Настройки диалога. */
    options?: VerifyChatOptions;

}

/**
 * ***************************************************************************
 * VERIFY_CHAT - диалог сверки ключей секретного чата (эмодзи + отпечаток).
 *
 * Показывает общий отпечаток пары identity-ключей двух устройств: 4 эмодзи
 * и hex-код. Участники сверяют их вживую (по телефону/видеосвязи): совпадает
 * — «Совпало» (verified = true), расходится — «Не совпало». QR-сканирования
 * нет: сверка только визуальная.
 * ***************************************************************************
 */
export class VerifyChat {

    // Переменная для хранения единственного экземпляра формы
    static instance: VerifyChat | null = null;

    /**
     * ***************************************************************************
     * Диалог сверки ключей секретного чата.
     * @param data - Данные.
     * @param data.chatId - Id секретного чата.
     * @param data.options - Настройки диалога.
     * ***************************************************************************
     */
    constructor(data: VerifyChatData) {

        // Поиск открытой формы секретного чата (диалог живёт поверх неё)
        let chatForm = SecretChat.instances?.get(data.chatId);
        let insertInto = chatForm?.modal?.content || null;

        // Устанавливаем настройки
        this.options = {
            insertInto: insertInto || data.options?.insertInto,
            ...data?.options
        }

        // Переменные формы
        this.tpl = null;
        this.modal = null;

        // Id чата (данные сверки читает менеджер)
        this.chatId = data.chatId;

        // Проверяем, существует ли уже экземпляр
        if (VerifyChat.instance) {
            return VerifyChat.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        VerifyChat.instance = this;

        // Инициализация
        this._init();

    }

    // Настройки формы
    options: VerifyChatOptions;

    // Каркас: шаблон и модалка
    tpl: HTMLElement | null;
    modal: Overlay | null;

    // Id секретного чата
    chatId: string;

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
                type: "modal",
                insertInto: this.options.insertInto,
                closeOnEsc: true,
                closeOnOverlay: true,
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
    // Настройка формы: отпечаток, эмодзи и статус верификации
    // ***************************************************************************
    async _onBeforeOpen(): Promise<void> {

        try {

            // Элементы заполняются из шаблона — без него нечего настраивать
            if (!this.tpl) return;

            const emojiWrap = this.tpl.querySelector<HTMLElement>(":scope >.content [data-emoji]");
            const fingerprintEl = this.tpl.querySelector<HTMLElement>(":scope >.content [data-fingerprint]");
            const statusWrap = this.tpl.querySelector<HTMLElement>(":scope >.content [data-status]");
            const match = this.tpl.querySelector<HTMLButtonElement>(":scope >.footer [action-match]");
            const mismatch = this.tpl.querySelector<HTMLButtonElement>(":scope >.footer [action-mismatch]");

            // Данные сверки: отпечаток пары identity-ключей устройств
            const manager = SecretChatsManager.instance;
            const data = manager ? await manager.getVerificationData(this.chatId) : null;

            // Ключи handshake ещё не обменяны — сверять нечего
            if (!data) {

                // Подпись без данных — текстовый блок, а не ряд эмодзи
                // (text-md в Tailwind нет — средний кегль это text-base)
                if (emojiWrap) {
                    emojiWrap.className = "flex flex-row gap-3 items-center text-center py-2 text-base font-medium";
                    emojiWrap.textContent = t("forms.secret_chat_verify.not_ready");
                }

                if (match) match.disabled = true;
                if (mismatch) mismatch.disabled = true;
                return;
            }

            // 4 эмодзи отпечатка (как в Telegram)
            if (emojiWrap) {
                for (const item of fingerprintToEmoji(data.fingerprint)) {
                    const span = document.createElement("span");
                    span.textContent = item;
                    emojiWrap.appendChild(span);
                }
            }

            // Текстовый отпечаток: hex группами по 8 символов
            if (fingerprintEl) {
                fingerprintEl.textContent = (fingerprintToHex(data.fingerprint).match(/.{1,8}/g) ?? []).join(" ");
            }

            // Статус верификации: у проверенного чата — действие снятия отметки
            if (statusWrap) {
                const label = document.createElement("span");
                label.classList.add("text-sm", data.verified ? "text-[var(--color-green)]" : "text-secondary");
                label.textContent = data.verified
                    ? t("forms.secret_chat_verify.verified")
                    : t("forms.secret_chat_verify.not_verified");
                statusWrap.appendChild(label);

                if (data.verified) {
                    statusWrap.appendChild(Buttons.link({
                        attributes: ["action-unverify"],
                        text: t("forms.secret_chat_verify.action_unverify")
                    }).dom);
                }
            }

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

            // Совпало — чат проверен
            let match = this.tpl.querySelector(":scope >.footer [action-match]");
            match?.addEventListener("click", () => verifyHandler(this, true));

            // Не совпало — отметку не ставим (снимаем, если была)
            let mismatch = this.tpl.querySelector(":scope >.footer [action-mismatch]");
            mismatch?.addEventListener("click", () => verifyHandler(this, false));

            // Отметить непроверенным (появляется у проверенного чата)
            this.tpl.addEventListener("click", (event) => {
                const target = event.target instanceof Element ? event.target.closest("[action-unverify]") : null;
                if (target) verifyHandler(this, false);
            });

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
        VerifyChat.instance = null;

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement | null {

        return new DOMParser().parseFromString(`

            <div class="cdm-modal verify-dialog flex flex-col p-0 gap-0 ${CDM_MODAL_CLASSES()}">
                 <div class="${CDM_MODAL_HEADER_CLASSES()}">
                    <span class="flex flex-row gap-2 items-center font-semibold text-lg">
                        <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                            ${Icons.icon("fingerprint", { settings: { size: 20 } })?.outerHTML ?? ""}
                        </span>
                        ${t("forms.secret_chat_verify.title")}
                    </span>
                    ${Buttons.transparent({ shape: "circle", attributes: ["action-close"], icon: "x" })}
                </div>
                 <div class="${CDM_MODAL_CONTENT_CLASSES()}">
                    <div class="flex flex-col gap-3">
                        <span class="text-sm text-secondary">${t("forms.secret_chat_verify.desc")}</span>
                        <div data-emoji class="flex flex-row gap-3 items-center justify-center py-2 text-3xl"></div>
                        <div class="flex flex-col gap-1 items-center">
                            <span class="text-xs text-muted">${t("forms.secret_chat_verify.fingerprint_title")}</span>
                            <span data-fingerprint class="text-sm font-mono break-all text-center"></span>
                        </div>
                        <div data-status class="flex flex-row gap-2 items-center justify-center flex-wrap"></div>
                    </div>
                </div>
                <div class="${CDM_MODAL_FOOTER_CLASSES()}">
                    ${Buttons.create({
            shape: "square",
            attributes: ["action-mismatch"],
            classes: ["w-full"],
            text: t("forms.secret_chat_verify.action_mismatch")
        })}
                    ${Buttons.primary({
            shape: "square",
            attributes: ["action-match"],
            classes: ["w-full"],
            text: t("forms.secret_chat_verify.action_match")
        })}
                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-modal");

    }

}
