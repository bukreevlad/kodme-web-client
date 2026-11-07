// Импортируем config
import { CDM_MODAL_CLASSES, CDM_MODAL_CONTENT_CLASSES, CDM_MODAL_FOOTER_CLASSES, CDM_MODAL_HEADER_CLASSES } from "../../config/constants.js";

// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";
import { Icons } from "../../utils/icons.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Buttons } from "../../components/buttons.js";
import { Avatars } from "../../components/avatars.js";

// Импортируем менеджеры
import { SecretCallsManager } from "../../core/managers/secret_calls_manager.js";

// Импортируем requests
import { getUserInfoRequest } from "../user-profile/requests/get_user_info.js";

// Импортируем handlers
import { acceptCallHandler } from "./handlers/accept.js";
import { declineCallHandler } from "./handlers/decline.js";
import { I18n } from "../../utils/i18n/index.js";

/**
 * Данные конструктора модалки входящего звонка.
 */
export interface SecretCallIncomingData {

    /** Id звонка (UUIDv7, живёт в сигналинге как chat_id). */
    callId: string;

}

/**
 * ***************************************************************************
 * SECRET_CALL_INCOMING - модалка входящего секретного звонка.
 *
 * Появляется на всех онлайн-устройствах собеседника: кто принял — тот
 * получает соединение, остальным уходит завершение. Показывает аватар и
 * имя звонящего, кнопки «Принять / Отклонить». Сама закрывается, когда
 * звонок берут на другом устройстве, отменяют или завершают.
 * ***************************************************************************
 */
export class SecretCallIncoming {

    // Экземпляры по id звонка (звонков может прийти несколько подряд)
    static instances = new Map<string, SecretCallIncoming>();

    /**
     * ***************************************************************************
     * Модалка входящего звонка.
     * @param data - Данные: id звонка.
     * ***************************************************************************
     */
    constructor(data: SecretCallIncomingData) {

        // Id звонка (профиль звонящего читает менеджер)
        this.callId = data.callId;

        // Переменные формы
        this.tpl = null;
        this.modal = null;

        // Проверяем, существует ли уже экземпляр этого звонка
        if (SecretCallIncoming.instances.has(data.callId)) return;

        // Сохраняем ссылку на текущий экземпляр
        SecretCallIncoming.instances.set(data.callId, this);

        // Инициализация
        this._init();

    }

    // Id звонка
    callId: string;

    // Каркас: шаблон и модалка
    tpl: HTMLElement | null;
    modal: Overlay | null;

    /** Отписки от событий менеджера. */
    unsubscribes: (() => void)[] = [];

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
                closeOnEsc: false,
                closeOnOverlay: false,
                onBeforeOpen: async () => await this._onBeforeOpen(),
                onOpen: async () => await this._onOpen(),
                onBeforeClose: () => this._onBeforeClose()
            });

            // Открываем форму
            this.modal.open();

        } catch (error) {
            Logger.error("[app][secret-call-incoming]: ошибка открытия:", error);
        }

    }

    // ***************************************************************************
    // Настройка формы: профиль звонящего и подписки
    // ***************************************************************************
    async _onBeforeOpen(): Promise<void> {

        try {

            if (!this.tpl) return;

            // Профиль звонящего: имя и аватар
            this._loadPeer();

            // Звонок завершился (отменён/взят на другом устройстве) — закрываемся
            const manager = SecretCallsManager.instance;
            if (manager) {
                this.unsubscribes.push(manager.on("call::ended", ({ callId }) => {
                    if (callId !== this.callId) return;
                    this.modal?.close();
                }));
            }

        } catch (error) {
            Logger.error("[app][secret-call-incoming]: ошибка настройки:", error);
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
    // Обработчики кнопок формы
    // ***************************************************************************
    _handlers(): void {

        try {

            // Обработчики вешаются на узлы шаблона — без него нечего слушать
            if (!this.tpl) return;

            this.tpl.querySelector(":scope [action-accept]")
                ?.addEventListener("click", () => acceptCallHandler(this));
            this.tpl.querySelector(":scope [action-decline]")
                ?.addEventListener("click", () => declineCallHandler(this));

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Действия при закрытии формы: очистка подписок
    // ***************************************************************************
    _onBeforeClose(): void {

        for (const unsubscribe of this.unsubscribes) unsubscribe();
        this.unsubscribes = [];

        // Удаляем экземпляр формы
        SecretCallIncoming.instances.delete(this.callId);

    }

    // ***************************************************************************
    // Профиль звонящего: имя и аватар
    // ***************************************************************************
    async _loadPeer(): Promise<void> {

        try {

            const manager = SecretCallsManager.instance;
            const snapshot = manager?.getSnapshot(this.callId);
            if (!snapshot || !this.tpl) return;

            const response = await getUserInfoRequest({ user_id: snapshot.peerUserId });
            if (!response.status || !response.data || !this.tpl) return;

            const name = response.data.display_name;
            const nameEl = this.tpl.querySelector<HTMLElement>(":scope [data-peer-name]");
            if (nameEl) nameEl.textContent = name;

            const avatar = this.tpl.querySelector<HTMLElement>(":scope .cdm-avatar");
            if (avatar) {
                new Avatars({
                    element: avatar,
                    id: snapshot.peerUserId,
                    name: name,
                    image: response.data.avatar ?? null,
                    size: "xl",
                    wrapClasses: ["rounded-full"]
                });
            }

        } catch (error) {
            Logger.debug("[app][secret-call-incoming]: профиль звонящего недоступен.", error);
        }

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement | null {

        // Локализация
        const locale = I18n.tree.forms.secret_call;

        return new DOMParser().parseFromString(`

            <div class="cdm-modal secret-call-incoming flex flex-col p-0 gap-0 ${CDM_MODAL_CLASSES()}">
                 <div class="${CDM_MODAL_HEADER_CLASSES()}">
                    <span class="flex flex-row gap-2 items-center font-semibold text-lg">
                        <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                            ${Icons.icon("phone", { settings: { size: 20 } })?.outerHTML ?? ""}
                        </span>
                        ${locale.incoming_title}
                    </span>
                </div>
                 <div class="${CDM_MODAL_CONTENT_CLASSES()} items-center">
                    <div class="flex flex-col gap-3 items-center">
                        <div class="cdm-avatar relative"></div>
                        <span data-peer-name class="font-semibold text-lg truncate max-w-full"></span>
                        <span data-status class="text-sm text-secondary">${locale.status_calling}</span>
                    </div>
                </div>
                <div class="${CDM_MODAL_FOOTER_CLASSES()}">
                    ${Buttons.danger({
            shape: "square",
            attributes: ["action-decline"],
            classes: ["w-full"],
            text: locale.incoming_decline
        })}
                    ${Buttons.primary({
            shape: "square",
            attributes: ["action-accept"],
            classes: ["w-full"],
            text: locale.incoming_accept
        })}
                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-modal");

    }

}
