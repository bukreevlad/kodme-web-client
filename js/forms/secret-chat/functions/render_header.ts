// Импортируем менеджеры
import { SecretChatsManager } from "../../../core/managers/secret_chats_manager.js";

// Импортируем типы
import type { SecretConnectionState } from "../../../utils/secret_chats/secret_connection.js";
import type { SecretChat } from "../index.js";
import { I18n } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * renderHeader - перерисовка шапки секретного чата: имя собеседника,
 * бейдж таймера самоуничтожения и подзаголовок состояния (печатает… /
 * подключение / соединение потеряно).
 * @param form - Экземпляр формы.
 * @returns void
 * ***************************************************************************
 */
export function renderHeader(form: SecretChat): void {

    // Каркас создаётся в _open: без шаблона заполнять нечего
    if (!form.tpl) return;

    // Имя собеседника: пишем в текстовый узел, чтобы не затирать
    // иконку шифрования внутри контейнера имени
    const nameText = form.name?.querySelector<HTMLElement>("[data-peer-name]");
    if (nameText) nameText.textContent = form.peerName;

    // Индикатор таймера самоуничтожения: часики на аватарке (текстовый бейдж
    // в шапке раздувал её до трёх строк)
    const badge = form.tpl.querySelector<HTMLElement>(":scope >.header [data-self-destruct]");
    if (badge) {
        const active = (form.chat?.self_destruct ?? null) != null;
        badge.classList.toggle("hidden", !active);
        badge.classList.toggle("flex", active);
    }

    // Индикатор верификации: проверенный чат подсвечивает кнопку сверки ключей
    const verifyButton = form.tpl.querySelector<HTMLElement>(":scope >.header [action-verify]");
    if (verifyButton) {
        verifyButton.classList.toggle("text-[var(--color-green)]", form.chat?.verified === true);
    }

    // Подзаголовок: статус активности собеседника имеет приоритет
    if (!form.subtitle) return;

    // Состояние соединения читаем из менеджера (живое значение): событие
    // connection::state приходит только на смену состояния, и при открытии
    // уже поднятого чата кэш формы был бы пуст — висело «Переподключение…»
    const manager = SecretChatsManager.instance;
    const state = manager?.getConnectionState(form.chatId) ?? form.connectionState ?? null;

    if (form.typingStatusText) {
        form.subtitle.textContent = form.typingStatusText;
    } else {
        form.subtitle.textContent = connectionStateLabel(state, form.chat?.status);
    }

    // Онлайн собеседника (живое соединение) — фирменный цвет подзаголовка
    const isOnline = state === "connected";
    form.subtitle.classList.toggle("text-[var(--color-brand)]", isOnline);
    form.subtitle.classList.toggle("dark:text-[var(--color-brand)]", isOnline);
    form.subtitle.classList.toggle("text-secondary", !isOnline);

}

/**
 * ***************************************************************************
 * Подпись состояния соединения из локали.
 * @param state - Состояние P2P-соединения (null — ещё не поднималось).
 * @param chatStatus - Статус чата из локальной записи.
 * @returns Локализованная подпись подзаголовка.
 * ***************************************************************************
 */
function connectionStateLabel(state: SecretConnectionState | null, chatStatus: string | undefined): string {

    const locale = I18n.tree.forms.secret_chat.states;

    // Живое состояние соединения — источник правды: запись чата могла
    // остаться "pending" до обработки accept, а канал уже работает
    switch (state) {
        case "connected": return locale.connected;
        case "new":
        case "connecting": return locale.connecting;
        case "failed":
        case "closed":
        default:

            // Соединения нет: чат ещё не прошёл handshake — ждём собеседника
            return chatStatus === "active" ? locale.reconnecting : locale.pending;
    }

}
