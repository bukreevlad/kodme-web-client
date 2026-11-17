// Импортируем utils
import { FormsRegistry } from "../../../../../core/managers/forms_registry.js";
import { isChannelRecord as isMessagesChannelRecord } from "../../../../messages/types.js";
import { Logger } from "../../../../../utils/logs/logger.js";
import { getErrorName } from "../../../../../utils/helpers/error_util.js";

// Импортируем forms
import { Main } from "../../../index.js";
import { GroupTopics } from "../../../../group-topics/index.js";
import { Messages } from "../../../../messages/index.js";

// Импортируем типы соседней формы (только для передачи канала в неё)

// Импортируем components
import { Toast } from "../../../../../components/toast.js";

// Импортируем db
import { channelsTable, cleanChannel } from "../../../db.js";

// Импортируем типы
import { isChannelWithTopics } from "../../../types.js";
import type { ChannelRecord } from "../../../types.js";
import { t } from "../../../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Применяет событие обновления канала к локальным хранилищам и UI: запись
 * мержится поверх текущей в локальной БД, после чего обновляются сайдбар
 * и открытые формы (диалог, темы).
 * @param data - Нагрузка события (запись канала).
 * @returns {void}
 * ***************************************************************************
 */
export async function applyChannelUpdate(data: unknown): Promise<void> {
    Logger.debug("[app][feed]::channel_updated", data);

    try {

        // Нагрузка сокета типизирована как unknown: мержим только запись канала
        if (!isChannelWithTopics(data)) return;

        // Чистим входящие данные (вырезаем topics, если они там есть)
        const updateData = { ...data };
        delete updateData.topics;

        // Подготавливаем данные для IndexedDB
        const cleanUpdate = cleanChannel(updateData);

        // Получаем текущее состояние из БД
        const currentEntity = await channelsTable().get(data.id);
        if (!currentEntity) return;

        // Смержим данные (патч: удалённый параллельно канал не «воскресает»)
        const updatedEntity: ChannelRecord = { ...currentEntity, ...cleanUpdate };
        await channelsTable().update(data.id, cleanUpdate);

        // Обновляем в Main.store, если сущность там есть (каналы/группы)
        if (FormsRegistry.getOwner<Main>("main")?.store.get(updatedEntity.id)) {
            FormsRegistry.getOwner<Main>("main")?.store.update(updatedEntity.id, updatedEntity);
        }

        // Если канал открыт: форма сообщений типизирует канал
        // по-своему (обязательные type и display_name) — сверяем
        // структуру их guard'ом перед передачей
        const messagesForm = FormsRegistry.getOwner<Messages>(`messages:${updatedEntity.id}`);
        if (messagesForm && isMessagesChannelRecord(updatedEntity)) {
            messagesForm._update(updatedEntity);
        }

        // Если это тема группы — обновляем её в GroupTopics
        if (updatedEntity.parent_channel_id) {
            const groupTopicsForm = FormsRegistry.getOwner<GroupTopics>(`group-topics:${updatedEntity.parent_channel_id}`);
            if (groupTopicsForm) groupTopicsForm.store.update(updatedEntity.id, updatedEntity);
        }

    } catch (error) {
        Logger.error(error);

        // Если ошибка была вызвана IndexedDB
        if (getErrorName(error) === "QuotaExceededError" || getErrorName(error) === "ConstraintError") {
            Toast.error(t("forms.main.toasts.storage_write_failed"));
        }
    }
}
