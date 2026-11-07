// Импортируем хелперы и формы
import { Logger } from "../../utils/logs/logger.js";
import { LocalStorage } from "../../utils/local_storage.js";
import { Messages } from "../../forms/messages/index.js";
import { Main } from "../../forms/main/index.js";
import { I18n, t } from "../../utils/i18n/index.js";

/** Действие пользователя, которое показывает статус активности. */
export type ActivityAction = "typing" | "recording_audio" | "recording_video" | "uploading_document";

/** Входные данные активности с сокета. */
export interface ActivityData {
    /** Id канала. */
    channel_id?: string;
    /** Id пользователя. */
    user_id?: string;
    /** Имя пользователя. */
    display_name?: string;
    /** Тип действия (по умолчанию «печатает»). */
    action?: ActivityAction;
}

/** Активность одного пользователя в канале. */
interface UserActivity {
    /** Отображаемое имя пользователя. */
    display_name: string;
    /** Тип действия. */
    action: ActivityAction;
    /** Таймер сброса активности. */
    timeoutId: ReturnType<typeof setTimeout>;
}

// Класс
export class ActivityStatusManager {

    // Хранилище активностей по каналам
    channels: Map<string, Map<string, UserActivity>> = new Map();

    /**
     * Сужение внешних данных сессии до структуры с полем id: сессия —
     * данные из localStorage, поэтому сверяемся через guard, а не приведением.
     */
    private static _isUserIdentity(value: unknown): value is { id: string } {
        return !!value && typeof value === "object" && "id" in value && typeof value.id === "string";
    }

    /**
     * Id текущего пользователя из сессии (null, если сессия неполная).
     */
    private static _getSessionUserId(): string | null {
        const user: unknown = LocalStorage.session?.user;
        return ActivityStatusManager._isUserIdentity(user) ? user.id : null;
    }

    /**
     * ***************************************************************************
     * Регистрация активности пользователя в канале
     * @param {ActivityData} [data] - Входные данные
     * ***************************************************************************
     */
    setActivity(data?: ActivityData) {
        try {

            // Проверяем входные данные
            if (!data || !data.channel_id || !data.user_id || !data.display_name) return;

            // Без id в сессии не можем отличить чужую активность от своей — пропускаем
            const ownUserId = ActivityStatusManager._getSessionUserId();
            if (!ownUserId || data.user_id === ownUserId) return;

            // Записываем данные
            const { channel_id, user_id, display_name, action = "typing" } = data;

            // Инициализируем Map для конкретного канала, если её ещё нет:
            // get() после set() не выводится компилятором, поэтому берём Map
            // одним заходом и сразу в переменную с нужным типом
            let activeUsers = this.channels.get(channel_id);
            if (!activeUsers) {
                activeUsers = new Map();
                this.channels.set(channel_id, activeUsers);
            }

            // Если этот юзер уже активничал — сбрасываем его старый таймер
            const previous = activeUsers.get(user_id);
            if (previous) {
                clearTimeout(previous.timeoutId);
            }

            // Ставим таймер на удаление этого пользователя через 5 секунд
            const timeoutId = setTimeout(() => {
                this.removeUserActivity(channel_id, user_id);
            }, 5000);

            // Сохраняем состояние юзера
            activeUsers.set(user_id, { display_name, action, timeoutId });

            // Обновляем UI
            this.render(channel_id);

        } catch (error) {
            Logger.error("[ActivityStatusManager] Error setting activity:", error);
        }
    }

    /**
     * ***************************************************************************
     * Удаление активности конкретного пользователя (по таймауту)
     * @param {string} channelId - Id канала
     * @param {string} userId - Id пользователя
     * ***************************************************************************
     */
    removeUserActivity(channelId: string, userId: string) {
        const activeUsers = this.channels.get(channelId);
        if (!activeUsers) return;

        activeUsers.delete(userId);

        if (activeUsers.size === 0) {
            this.resetChannelStatus(channelId);
        } else {
            this.render(channelId);
        }
    }

    /**
     * ***************************************************************************
     * Полный сброс активности в канале (по таймауту или при получении нового сообщения)
     * @param {string} channelId - Id канала
     * ***************************************************************************
     */
    resetChannelStatus(channelId: string) {
        const activeUsers = this.channels.get(channelId);

        if (activeUsers) {
            for (const user of activeUsers.values()) {
                clearTimeout(user.timeoutId);
            }
            this.channels.delete(channelId);
        }

        // Вместо восстановления старого текста просто вызываем штатное обновление компонентов
        this.triggerUIUpdate(channelId);
    }

    /**
     * ***************************************************************************
     * Принудительный вызов родных методов обновления формы и списка каналов
     * @param {string} channelId - Id канала
     * ***************************************************************************
     */
    triggerUIUpdate(channelId: string) {

        // Обновляем форму сообщений, если она открыта
        // (без канала обновлять нечего — раньше сюда мог уйти null)
        const messagesForm = Messages.instances.get(channelId);
        if (messagesForm && messagesForm.channel && typeof messagesForm._update === "function") {
            messagesForm._update(messagesForm.channel);
        }

        // Обновляем элемент в списке каналов (сайдбаре) через глобальный Store/Main
        const channelStore = Main.instance?.store?.get(channelId);
        if (channelStore) {
            Main.instance?.store?.update(channelStore.id, channelStore);
        }

    }

    /**
     * ***************************************************************************
     * Генерация текста активности и применение к DOM элементам
     * @param {string} channelId - Id канала
     * ***************************************************************************
     */
    render(channelId: string) {

        // Получаем активных пользователей
        const activeUsers = this.channels.get(channelId);
        if (!activeUsers || activeUsers.size === 0) return;

        // Группируем по экшенам
        const groups: Partial<Record<ActivityAction, string[]>> = {};
        for (const user of activeUsers.values()) {
            const bucket = groups[user.action];
            if (bucket) {
                bucket.push(user.display_name);
            } else {
                groups[user.action] = [user.display_name];
            }
        }

        // invariant: ключи собраны только из значений типа ActivityAction
        const actionTypes = Object.keys(groups) as ActivityAction[];
        let finalString = "";

        if (actionTypes.length > 1) {
            finalString = t("forms.main.components.channels.last_message.status_activity.several_actions");
        } else {

            const currentAction = actionTypes[0];
            const usersInAction = currentAction !== undefined ? groups[currentAction] : undefined;

            // Нечего отображать: активных пользователей нет, а группа не собрана
            if (usersInAction === undefined || currentAction === undefined) return;

            const count = usersInAction.length;

            const maxNamesToShow = 3;
            let namesString = usersInAction.slice(0, maxNamesToShow).join(", ");

            if (count > maxNamesToShow) {
                namesString += ` ${t("forms.main.components.channels.last_message.status_activity.and_or")} ${count - maxNamesToShow}`;
            }

            const isMultiple = count > 1;
            let actionText = "";

            switch (currentAction) {
                case "recording_audio":
                    actionText = isMultiple ?
                        I18n.tree.forms.main.components.channels.last_message.status_activity.recording_audio[0] ?? ""
                        : I18n.tree.forms.main.components.channels.last_message.status_activity.recording_audio[1] ?? "";
                    break;
                case "recording_video":
                    actionText = isMultiple ? I18n.tree.forms.main.components.channels.last_message.status_activity.recording_video[0] ?? ""
                        : I18n.tree.forms.main.components.channels.last_message.status_activity.recording_video[1] ?? "";
                    break;
                case "uploading_document":
                    actionText = isMultiple ? I18n.tree.forms.main.components.channels.last_message.status_activity.uploading_document[0] ?? ""
                        : I18n.tree.forms.main.components.channels.last_message.status_activity.uploading_document[1] ?? "";
                    break;
                case "typing":
                default:
                    actionText = isMultiple ? I18n.tree.forms.main.components.channels.last_message.status_activity.typing[0] ?? ""
                        : I18n.tree.forms.main.components.channels.last_message.status_activity.typing[1] ?? "";
                    break;
            }

            // Финальная строка
            finalString = `${namesString} ${actionText}`;

        }

        // К подзаголовку формы
        const messagesForm = Messages.instances.get(channelId);
        if (messagesForm?.subtitle) {
            messagesForm.subtitle.textContent = finalString;
            messagesForm.subtitle.classList.add("text-[var(--color-brand)]", "dark:text-[var(--color-brand)]");
            messagesForm.subtitle.classList.remove("text-secondary");
        }

        // К списку каналов вместо последнего сообщения
        const channelStore = Main.instance?.store?.get(channelId);
        const channelElements = channelStore?.__domElements__;

        // Если Dom элементы найдены
        if (channelElements && channelElements.length > 0) {
            channelElements.forEach((c: Element) => {
                const lastMessage = c.querySelector(":scope [data-last-message]");
                if (lastMessage) {

                    // Имена пользователей — внешние данные: вставка только
                    // через textContent (innerHTML открыл бы XSS)
                    const span = document.createElement("span");
                    span.classList.add("text-[var(--color-brand)]", "dark:text-[var(--color-brand)]");
                    span.textContent = finalString;
                    lastMessage.replaceChildren(span);

                }
            });
        }

    }

}

/**
 * Глобальный экземпляр менеджера активностей (единственный на приложение).
 */
export const activityStatusManager = new ActivityStatusManager();
