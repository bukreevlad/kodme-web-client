// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { TimeAgoFormatter } from "../../../utils/date/time_ago_formatter.js";

// Импортируем components
import { Avatars } from "../../../components/avatars.js";

// Импортируем forms
import { Messages } from "../../messages/index.js";

// Импортируем components
import { createLastMessage } from "./channel_last_message.js";

// Импортируем типы
import { isChannelRecord } from "../../main/types.js";
import type { GroupTopics } from "../index.js";
import type { ChannelRecord } from "../../main/types.js";

/**
 * ***************************************************************************
 * TOPIC_ITEM - строка темы (или общего чата группы) в списке формы тем.
 *
 * Строка подписывается на `item::updated::<id>` локального стора формы и
 * держит ссылку на себя в `data.__domElements__`, чтобы стор удалил все
 * копии разом.
 *
 * Элемент раньше возвращался самим конструктором (`return this.element`) —
 * в TS это запрещено (конструктор обязан возвращать `this`), поэтому строка
 * создаётся через `new TopicItem(...)`, а в DOM вставляется её поле `element`.
 * Мёртвые геттеры getDOM()/getData() удалены — их никто не вызывает.
 * ***************************************************************************
 */
export class TopicItem {

    /** Форма-владелец строки. */
    form: GroupTopics;

    /** Данные строки (запись канала из стора). */
    data: ChannelRecord;

    /** DOM-элемент строки. */
    element: HTMLElement;

    /**
     * ***************************************************************************
     * Создать строку темы.
     * @param form - Форма-владелец.
     * @param data - Данные канала.
     * ***************************************************************************
     */
    constructor(form: GroupTopics, data: ChannelRecord) {

        // Записываем данные
        this.form = form;
        this.data = data;

        // Создаем DOM-элемент из шаблона
        this.element = this._template();

        // Записываем ссылку на dom элемент
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
        const element = new DOMParser().parseFromString(`
            <div class="item flex flex-row gap-2 p-2 items-center rounded-lg hover:bg-[var(--second-bg)] active:bg-[var(--second-bg)] cursor-pointer">
                <div class="cdm-avatar relative"></div>
                <div class="flex flex-row justify-between w-full overflow-hidden">
                    <div class="flex flex-col gap-1 justify-center w-full">
                        <div class="flex flex-row gap-2 justify-between items-center">
                            <span data-name class="flex flex-1 font-semibold truncate"></span>
                            <span data-created-at class="text-sm text-muted"></span>
                        </div>
                        <span data-last-message class="text-secondary text-sm"></span>
                    </div>
                </div>
            </div>
        `, "text/html").querySelector<HTMLElement>(".item");

        // Своя разметка всегда содержит «.item» — без элемента элемент списка не создаётся
        if (!element) throw new Error("Не найден шаблон: .item");

        return element;

    }

    // ***************************************************************************
    // Установка/Перерисовка данных (Private Method)
    // ***************************************************************************
    _setup(data: ChannelRecord): void {

        try {

            // Сохраняем актуальные данные
            this.data = data;

            // Устанавливаем элементы
            let avatar = this.element.querySelector<HTMLElement>(":scope >.cdm-avatar");
            let name = this.element.querySelector<HTMLElement>(":scope [data-name]");
            let lastMessage = this.element.querySelector<HTMLElement>(":scope [data-last-message]");
            let lastMessagecreatedAt = this.element.querySelector<HTMLElement>(":scope [data-created-at]");

            // Аватар
            new Avatars({
                element: avatar,
                id: data.id,
                name: data.display_name,
                image: data.avatar,
                size: "xl",
                wrapClasses: [data.type === 2 ? "rounded-xl" : "rounded-full"]
            });

            // Название
            if (name) name.textContent = data.display_name ?? null;

            // Последнее сообщение
            if (data.last_message) {

                // Очищаем
                if (lastMessage) lastMessage.innerHTML = "";

                // Отображаем сообщение
                lastMessage?.appendChild(createLastMessage(this, this.data));

                // Парсим created_at
                let timeAgo = new TimeAgoFormatter(data.last_message.created_at, "telegram");
                if (lastMessagecreatedAt) lastMessagecreatedAt.textContent = timeAgo.formattedTime;

            } else {
                if (lastMessage) lastMessage.textContent = window._lc.forms.main.components.channels.last_message.empty_messages;
            }

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Обработчики (Private Method)
    // ***************************************************************************
    _actions(): void {

        // Открыть канал
        this.element?.addEventListener("click", () => {
            let instance = Messages.instances.get(this.data.id);
            if (instance) {
                instance?.modal?.activate();
            } else {
                new Messages({ channelId: this.data.id, ignoreGroupTopics: true });
            }
        });

    }

    // ***************************************************************************
    // ПУБЛИЧНЫЙ МЕТОД: Обновление элемента
    // @param data - Новые данные канала.
    // ***************************************************************************
    update(data: ChannelRecord): void {

        // Передаем новые данные в _setup, чтобы перерисовать DOM
        this._setup(data);

    }

    // ***************************************************************************
    // Подписка на точечное событие обновления (Private Method)
    // ***************************************************************************
    _subscribeToUpdates(): void {

        try {

            // Подписываемся на событие обновления: шаблон события передаётся
            // в вызов напрямую — промежуточная const схлопнула бы шаблонный
            // литерал в string, не проходящий в тип события стора
            let unsubscribe = this.form.store.on(`item::updated::${this.data.id}`, (data) => {

                // Пейлоад типизирован как unknown: перерисовываем строку
                // только если пришла запись канала
                if (isChannelRecord(data)) this.update(data);

            });

            // Сохраняем функцию отписки в data, чтобы стор мог вызвать её при удалении
            this.data.__unsubscribeStore__ = unsubscribe;

        } catch (error) {
            Logger.error(error);
        }

    }

}
