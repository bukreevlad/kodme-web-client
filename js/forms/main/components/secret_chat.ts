// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { TimeAgoFormatter } from "../../../utils/date/time_ago_formatter.js";
import { Icons } from "../../../utils/icons.js";

// Импортируем components
import { Avatars } from "../../../components/avatars.js";

// Импортируем forms
import { SecretChat } from "../../secret-chat/index.js";

// Импортируем components
import { createSecretChatLastMessage } from "./secret_chat_last_message.js";

// Импортируем типы
import { isChannelRecord } from "../types.js";
import type { Main } from "../index.js";
import type { ChannelRecord } from "../types.js";

/**
 * ***************************************************************************
 * SECRET_CHAT_ITEM - строка секретного чата в списках главного экрана.
 *
 * Своя строка для секретных чатов (не ChannelItem): чат живёт только
 * локально, превью собирается из расшифрованных данных payload, а не из
 * серверных сообщений. Механика копий строки и подписки на стор — та же:
 * одна запись может дать несколько строк (общая папка + папки пользователя),
 * каждая строка подписывается на `item::updated::<id>` и держит ссылку на
 * себя в `data.__domElements__`, чтобы стор удалил все копии разом.
 * ***************************************************************************
 */
export class SecretChatItem {

    /** Форма-владелец строки (главный экран). */
    form: Main;

    /** Данные строки (запись канала из стора). */
    data: ChannelRecord;

    /** DOM-элемент строки. */
    element: HTMLElement;

    /** Контейнер превью последнего сообщения (привязывается в _setup). */
    lastMessage: HTMLElement | null = null;

    /** Метка времени последнего сообщения (привязывается в _setup). */
    lastMessagecreatedAt: HTMLElement | null = null;

    /**
     * ***************************************************************************
     * Создать строку секретного чата.
     * @param form - Форма-владелец (главный экран).
     * @param data - Данные секретного чата.
     * ***************************************************************************
     */
    constructor(form: Main, data: ChannelRecord) {

        // Записываем данные
        this.form = form;
        this.data = data;

        // Создаем DOM-элемент из шаблона
        this.element = this._template();

        // Инициализируем массив, если его еще нет, и добавляем текущий DOM-элемент
        if (!this.data.__domElements__) {
            this.data.__domElements__ = [];
        }
        this.data.__domElements__.push(this.element);

        // Устанавливаем начальные данные
        this._setup(this.data);

        // Прикрепляем обработчики событий
        this._actions();

        // Подписываем на обновление
        this._subscribeToUpdates();

    }

    // ***************************************************************************
    // Шаблон элемента (Private Method)
    // Используем DOMParser для безопасного и чистого создания элемента
    // ***************************************************************************
    _template(): HTMLElement {

        // Мы используем <template> tag или DOMParser для создания DOM без innerHTML

        // invariant: корневой .item входит в сам шаблон — querySelector
        // с текстовым HTML всегда находит его
        return new DOMParser().parseFromString(`
            <div class="item flex flex-row gap-3 p-2 items-center rounded-lg transition-colors duration-150 hover:bg-[var(--second-bg)] active:bg-[var(--second-bg)] cursor-pointer">
                <div class="cdm-avatar relative"></div>
                <div class="flex flex-row justify-between w-full overflow-hidden">
                    <div class="flex flex-col gap-1 justify-center w-full">
                        <div class="flex flex-row gap-2 justify-between items-center">
                            <div data-name class="flex flex-row gap-2 flex-1 items-center font-semibold truncate"></div>
                            <span data-created-at class="text-sm text-muted"></span>
                        </div>
                        <span data-last-message class="text-secondary"></span>
                    </div>
                </div>
            </div>
        `, "text/html").querySelector<HTMLElement>(".item")!;

    }

    // ***************************************************************************
    // Установка/Перерисовка данных (Private Method)
    // ***************************************************************************
    _setup(data: ChannelRecord): void {

        try {

            // Сохраняем актуальные данные
            this.data = data;

            // Устанавливаем элементы
            const avatar = this.element.querySelector<HTMLElement>(":scope >.cdm-avatar");
            const name = this.element.querySelector<HTMLElement>(":scope [data-name]");

            // Последнее сообщение
            const lastMessage = this.element.querySelector<HTMLElement>(":scope [data-last-message]");

            // Дата сообщения
            const lastMessagecreatedAt = this.element.querySelector<HTMLElement>(":scope [data-created-at]");

            // Элементы строки входят в шаблон компонента — иначе заполнять нечего
            if (!avatar || !name || !lastMessage || !lastMessagecreatedAt) return;
            this.lastMessage = lastMessage;
            this.lastMessagecreatedAt = lastMessagecreatedAt;

            // Название (display_name опционален — нормализуем к null)
            name.textContent = this.data.display_name ?? null;

            // Устанавливаем атрибут id
            this.element.setAttribute("data-id", this.data.id);

            // Аватар собеседника
            const avatarEl = new Avatars({
                element: avatar,
                id: this.data.display_user_id,
                name: this.data.display_name,
                image: this.data?.avatar,
                size: "xl",
                wrapClasses: ["rounded-full"]
            });

            // Пометка секретного чата: замок и подпись в имени
            const lockIcon = Icons.icon("lock", { settings: { size: 16 } });
            if (lockIcon) name.prepend(lockIcon);

            const secretLabel = document.createElement("span");
            secretLabel.classList.add("text-xs", "text-[var(--color-brand)]", "font-normal", "truncate");
            secretLabel.textContent = window._lc.forms.main.components.channels.secret_chat;
            name.append(secretLabel);

            // Бейдж на аватарке: зелёный при живом P2P-соединении, серый иначе
            avatarEl.setStatus(this.data.display_user_is_online ? "online" : "offline");

        } catch (error) {
            Logger.error(error);
        } finally {

            // Превью рендерится всегда: сбой шагов выше не должен оставлять
            // в строке устаревшее превью
            this._updateLastMessage();

        }

    }

    // ***************************************************************************
    // Обработчики (Private Method)
    // ***************************************************************************
    _actions(): void {

        // Открыть секретный чат (живёт только локально)
        this.element.addEventListener("click", () => {

            const instance = SecretChat.instances.get(this.data.id);
            if (instance) {
                instance.modal?.activate();
            } else {
                new SecretChat({ chatId: this.data.id });
            }

        });

    }

    // ***************************************************************************
    // ПУБЛИЧНЫЙ МЕТОД: Обновление элемента
    // @param data - Новые данные секретного чата.
    // ***************************************************************************
    update(data: ChannelRecord): void {

        // Передаем новые данные в _setup, чтобы перерисовать DOM
        this._setup(data);

    }

    // ***************************************************************************
    // Обновление последнего сообщения
    // ***************************************************************************
    _updateLastMessage(): void {

        // Узлы строки привязываются в _setup() — при несобранном шаблоне обновлять нечего
        if (!this.lastMessage || !this.lastMessagecreatedAt) return;

        // Последнее сообщение
        const preview = this.data?.last_secret_message;
        if (preview) {

            // Очищаем
            this.lastMessage.innerHTML = "";

            // Отображаем сообщение (строка может не собраться — тогда
            // пропускаем, как в превью обычных чатов)
            const lastMessageEl = createSecretChatLastMessage(this);
            if (lastMessageEl) this.lastMessage.appendChild(lastMessageEl);

            // Парсим created_at
            const timeAgo = new TimeAgoFormatter(preview.created_at, "telegram-list");
            this.lastMessagecreatedAt.textContent = timeAgo.formattedTime;

        } else {
            this.lastMessage.textContent = window._lc.forms.main.components.channels.last_message.empty_messages;
        }

    }

    // ***************************************************************************
    // Подписка на точечное событие обновления (Private Method)
    // ***************************************************************************
    _subscribeToUpdates(): void {

        try {

            // Формируем уникальное имя события и подписываемся: шаблон
            // передаётся в вызов напрямую — промежуточная const схлопывает
            // шаблонный литерал в string, который не проходит в StoreEventName
            const unsubscribe = this.form.store.on(`item::updated::${this.data.id}`, (data) => {

                // Пейлоад стора типизирован как unknown: перерисовываем
                // строку только если пришла запись канала
                if (isChannelRecord(data)) this.update(data);

            });

            // Сохраняем функцию отписки в data, чтобы Main мог вызвать ее при удалении
            this.data.__unsubscribeStore__ = unsubscribe;

        } catch (error) {
            Logger.error(error);
        }

    }

}
