// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { Icons } from "../../../utils/icons.js";
import { I18n, t } from "../../../utils/i18n/index.js";

// Импортируем components
import { Avatars } from "../../../components/avatars.js";

// Импортируем handlers
import { clickHandler } from "./handlers/click.js";

// Импортируем components (превью последнего сообщения — копия части главной формы)
import { createLastMessage } from "./last_message.js";

// Импортируем типы
import { isForwardChannel } from "../types.js";
import type { ForwardChannelRecord } from "../types.js";
import type { ForwardMessages } from "../index.js";

/**
 * ***************************************************************************
 * FORWARD_CHANNEL_ITEM - строка канала в списке пересылки.
 *
 * Копия ChannelItem главной формы (компоненты строк форм намеренно
 * независимы), адаптированная под форму пересылки: клик выделяет строку
 * вместо открытия чата, контекстного меню нет. Одна запись канала даёт
 * несколько строк (папка «Все» + папки пользователя): каждая подписывается
 * на `item::updated::<id>` и регистрирует себя в реестре DOM-копий стора,
 * чтобы стор удалил все копии разом.
 * ***************************************************************************
 */
export class ForwardChannelItem {

    /** Форма-владелец строки (пересылка). */
    form: ForwardMessages;

    /** Данные строки (запись канала из стора). */
    data: ForwardChannelRecord;

    /** DOM-элемент строки. */
    element: HTMLElement;

    /** Контейнер превью последнего сообщения (привязывается в _setup). */
    lastMessage: HTMLElement | null = null;

    /** Метка времени последнего сообщения (привязывается в _setup). */
    lastMessagecreatedAt: HTMLElement | null = null;

    /**
     * ***************************************************************************
     * Создать строку канала.
     * @param form - Форма-владелец (пересылка).
     * @param data - Данные канала.
     * ***************************************************************************
     */
    constructor(form: ForwardMessages, data: ForwardChannelRecord) {

        // Записываем данные
        this.form = form;
        this.data = data;

        // Создаем DOM-элемент из шаблона
        this.element = this._template();

        // Регистрируем DOM-копию строки в реестре стора
        this.form.store.registerDomElement(this.data.id, this.element);

        // Устанавливаем начальные данные
        this._setup(this.data);

        // Прикрепляем обработчики событий
        this._actions();

        // Подписываем на обновление
        this._subscribeToUpdates();

    }

    // ***************************************************************************
    // Шаблон элемента: DOMParser создаёт DOM без innerHTML (как на Main)
    // ***************************************************************************
    _template(): HTMLElement {

        // invariant: корневой .item входит в сам шаблон — querySelector
        // с текстовым HTML всегда находит его
        return new DOMParser().parseFromString(`
            <div class="item flex flex-row gap-3 p-2 items-center rounded-lg transition-colors duration-150 hover:bg-[var(--second-bg)] active:bg-[var(--second-bg)] cursor-pointer">
                <div class="relative shrink-0">
                    <div class="cdm-avatar relative"></div>
                    <span data-select-badge class="absolute -top-0.5 -right-0.5 z-10 flex items-center justify-center w-[1.125rem] h-[1.125rem] rounded-full bg-[var(--color-brand)] text-white shadow-[0_0_0_2px_var(--form-bg)]">
                        ${Icons.icon("check", { settings: { size: 11, stroke: 3 } })?.outerHTML ?? ""}
                    </span>
                </div>
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
    // Установка/Перерисовка данных
    // ***************************************************************************
    _setup(data: ForwardChannelRecord): void {

        try {

            // Сохраняем актуальные данные
            this.data = data;

            // Устанавливаем элементы
            const avatar = this.element.querySelector<HTMLElement>(":scope .cdm-avatar");
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

            // Определяем id аватара: у диалогов — пользователь, иначе — канал
            // (type опционален — null в includes не попадает)
            const isDialog = this.data.kind === "dialog";
            const avatarId = isDialog ? this.data.display_user_id : this.data.id;

            // Аватар
            const avatarEl = new Avatars({
                element: avatar,
                id: avatarId,
                name: this.data.display_name,
                image: this.data?.avatar,
                size: "xl",
                wrapClasses: [this.data.kind === "group" ? "rounded-xl" : "rounded-full"]
            });

            // Если это избранное
            if (this.data.kind === "favorite") {
                avatarEl.setIcon("bookmark");

                // Название
                name.textContent = t("forms.main.components.channels.favorite");

            }

            // Если это диалог и пользователь онлайн
            if (isDialog) {
                if (this.data.display_user_is_online) {
                    avatarEl.setStatus("online");
                } else {
                    avatarEl.setStatus("offline");
                }
            }

            // Если уведомления выключены
            if (this.data.notifications?.mode !== "all") {
                const icon = Icons.icon("BellOff");
                if (icon) name.append(icon);
            }

            // Рендерим последнее сообщение
            this._updateLastMessage();

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Обработчики: в списке пересылки клик выделяет строку (вместо
    // открытия чата, как на главной форме)
    // ***************************************************************************
    _actions(): void {

        this.element.addEventListener("click", () => clickHandler(this));

    }

    // ***************************************************************************
    // Публичный метод: обновление элемента
    // @param data - Новые данные канала.
    // ***************************************************************************
    update(data: ForwardChannelRecord): void {

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
        if (this.data?.last_message) {

            // Очищаем
            this.lastMessage.innerHTML = "";

            // Отображаем сообщение (строка может не собраться — тогда пропускаем)
            const lastMessageEl = createLastMessage(this);
            if (lastMessageEl) this.lastMessage.appendChild(lastMessageEl);

            // Дата в списке пересобирается при смене языка (Intl на новой локали)
            I18n.setTime(this.lastMessagecreatedAt, this.data?.last_message.created_at, "telegram-list");

        } else {
            this.lastMessage.textContent = t("forms.main.components.channels.last_message.empty_messages");
        }

    }

    // ***************************************************************************
    // Подписка на точечное событие обновления
    // ***************************************************************************
    _subscribeToUpdates(): void {

        try {

            // Формируем уникальное имя события и подписываемся: шаблон
            // передаётся в вызов напрямую — промежуточная const схлопывает
            // шаблонный литерал в string, который не проходит в StoreEventName
            const unsubscribe = this.form.store.on(`item::updated::${this.data.id}`, (data) => {

                // Пейлоад стора типизирован как unknown: перерисовываем
                // строку только если пришла запись канала
                if (isForwardChannel(data)) this.update(data);

            });

            // Запоминаем отписку в сторе — она вызовется при удалении элемента
            this.form.store.addItemSubscription(this.data.id, unsubscribe);

        } catch (error) {
            Logger.error(error);
        }

    }

}
