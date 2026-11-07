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
import { SecretChatsManager } from "../../core/managers/secret_chats_manager.js";

// Импортируем requests
import { getUserInfoRequest } from "../user-profile/requests/get_user_info.js";

// Импортируем handlers
import { acceptChatHandler } from "./handlers/accept.js";
import { declineChatHandler } from "./handlers/decline.js";

/**
 * Данные конструктора модалки входящего секретного чата.
 */
export interface SecretChatIncomingData {

    /** Id чата (приглашения; UUIDv7, генерирует инициатор). */
    chatId: string;

}

/**
 * ***************************************************************************
 * SECRET_CHAT_INCOMING - модалка входящего приглашения в секретный чат.
 *
 * Появляется на всех онлайн-устройствах собеседника: чат привязывается к
 * тому устройству, на котором его примут (как у звонков — выбор устройства).
 * Показывает аватар и имя приглашающего, кнопки «Принять / Отклонить».
 * Сама закрывается, когда приглашение принято на другом устройстве,
 * отменено инициатором или истекло время.
 * ***************************************************************************
 */
export class SecretChatIncoming {

    // Экземпляры по id приглашения (приглашений может прийти несколько подряд)
    static instances = new Map<string, SecretChatIncoming>();

    /**
     * ***************************************************************************
     * Модалка входящего приглашения в секретный чат.
     * @param data - Данные: id чата (приглашения).
     * ***************************************************************************
     */
    constructor(data: SecretChatIncomingData) {

        // Id чата (профиль инициатора читает менеджер)
        this.chatId = data.chatId;

        // Переменные формы
        this.tpl = null;
        this.modal = null;

        // Проверяем, существует ли уже экземпляр этого приглашения
        if (SecretChatIncoming.instances.has(data.chatId)) return;

        // Сохраняем ссылку на текущий экземпляр
        SecretChatIncoming.instances.set(data.chatId, this);

        // Инициализация
        this._init();

    }

    // Id чата (приглашения)
    chatId: string;

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
            Logger.error("[app][secret-chat-incoming]: ошибка открытия:", error);
        }

    }

    // ***************************************************************************
    // Настройка формы: профиль приглашающего и подписки
    // ***************************************************************************
    async _onBeforeOpen(): Promise<void> {

        try {

            if (!this.tpl) return;

            // Профиль приглашающего: имя и аватар
            this._loadPeer();

            // Приглашение закрыли (принято в другом месте/отмена/таймаут) — закрываемся
            const manager = SecretChatsManager.instance;
            if (manager) {
                this.unsubscribes.push(manager.on("chat::invite-ended", ({ chatId }) => {
                    if (chatId !== this.chatId) return;
                    this.modal?.close();
                }));
            }

        } catch (error) {
            Logger.error("[app][secret-chat-incoming]: ошибка настройки:", error);
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
                ?.addEventListener("click", () => acceptChatHandler(this));
            this.tpl.querySelector(":scope [action-decline]")
                ?.addEventListener("click", () => declineChatHandler(this));

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
        SecretChatIncoming.instances.delete(this.chatId);

    }

    // ***************************************************************************
    // Профиль приглашающего: имя и аватар
    // ***************************************************************************
    async _loadPeer(): Promise<void> {

        try {

            const manager = SecretChatsManager.instance;
            const invite = manager?.getPendingInvite(this.chatId);
            if (!invite || !this.tpl) return;

            const response = await getUserInfoRequest({ user_id: invite.peerUserId });
            if (!response.status || !response.data || !this.tpl) return;

            const name = response.data.display_name;
            const nameEl = this.tpl.querySelector<HTMLElement>(":scope [data-peer-name]");
            if (nameEl) nameEl.textContent = name;

            const avatar = this.tpl.querySelector<HTMLElement>(":scope .cdm-avatar");
            if (avatar) {
                new Avatars({
                    element: avatar,
                    id: invite.peerUserId,
                    name: name,
                    image: response.data.avatar ?? null,
                    size: "xl",
                    wrapClasses: ["rounded-full"]
                });
            }

        } catch (error) {
            Logger.debug("[app][secret-chat-incoming]: профиль приглашающего недоступен.", error);
        }

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement | null {

        // Локализация
        const locale = window._lc.forms.secret_chat.dialogs.invite;

        return new DOMParser().parseFromString(`

            <div class="cdm-modal secret-chat-incoming flex flex-col p-0 gap-0 ${CDM_MODAL_CLASSES()}">
                 <div class="${CDM_MODAL_HEADER_CLASSES()}">
                    <span class="flex flex-row gap-2 items-center font-semibold text-lg">
                        <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                            ${Icons.icon("lock", { settings: { size: 20 } })?.outerHTML ?? ""}
                        </span>
                        ${locale.title}
                    </span>
                </div>
                 <div class="${CDM_MODAL_CONTENT_CLASSES()} items-center">
                    <div class="flex flex-col gap-3 items-center">
                        <div class="cdm-avatar relative"></div>
                        <span data-peer-name class="font-semibold text-lg truncate max-w-full"></span>
                        <span class="text-sm text-secondary text-center">${locale.desc}</span>
                    </div>
                </div>
                <div class="${CDM_MODAL_FOOTER_CLASSES()}">
                    ${Buttons.danger({
            shape: "square",
            attributes: ["action-decline"],
            classes: ["w-full"],
            text: locale.action_decline
        })}
                    ${Buttons.primary({
            shape: "square",
            attributes: ["action-accept"],
            classes: ["w-full"],
            text: locale.action_accept
        })}
                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-modal");

    }

}
