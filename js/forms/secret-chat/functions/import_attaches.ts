// Импортируем сторонние пакеты
import { v7 as Uuidv7 } from "uuid";

// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { buildLocalMediaMetadata } from "../../../utils/media/local_media_metadata.js";
import { filterFiles } from "../../../utils/validation/file_validator.js";
import { getLimits } from "../../../config/limits.js";
import * as Attachments from "../../../utils/messages/attachments.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем функции
import { updateStateButtons } from "./update_state_buttons.js";

// Импортируем типы
import type { AttachmentsRaw } from "../../../utils/messages/attachments.js";
import type { FileValidationError } from "../../../utils/validation/file_validator.js";
import type { SecretChatMessageRecord } from "../types.js";
import type { SecretChat } from "../index.js";

/** Объект-мап вложений черновика (тот же тип, что хранит SecretChatMessageRecord.attachments). */
type AttachmentsMap = Extract<AttachmentsRaw, Record<string, unknown>>;

/** Параметры подстановки в текст тоста (коды валидации + лимит количества). */
interface ToastParams {

    /** Число файлов (для тоста о лимите количества). */
    count?: number;

    /** Имя файла. */
    name?: string;

    /** Размер файла. */
    size?: string;

}

/**
 * ***************************************************************************
 * Импорт вложений из выбранных пользователем файлов.
 *
 * Порядок проверок важен: сначала дешёвые синхронные проверки файла и лимита
 * количества, и только потом тяжёлая генерация метадаты (декодирование кадра
 * видео в canvas). Механика — как в forms/messages/functions/import_attaches.ts.
 * @param form - Форма секретного чата.
 * @param files - Массив файлов.
 * @returns Promise<void>
 * ***************************************************************************
 */
export async function importAttaches(form: SecretChat, files: File[]): Promise<void> {

    try {

        Logger.debug(`[secret-chat:import] старт: получено файлов ${files?.length ?? 0}`);

        // ========================================
        // Фильтруем файлы по white-листу и размеру
        // ========================================

        // Отсекаем запрещённые расширения, слишком большие файлы и файлы,
        // у которых mime-тип противоречит расширению
        const { files: validFiles, errors } = filterFiles(files);

        Logger.debug(`[secret-chat:import] после фильтра: валидных ${validFiles.length}, ошибок ${errors.length}`);

        // Показываем по одному тосту на тип проблемы (иначе при выборе 20 файлов
        // пользователь получил бы 20 одинаковых всплывающих окон)
        showValidationErrors(errors);

        // После фильтрации не осталось ничего — импортировать нечего
        if (validFiles.length === 0) return;

        // ========================================
        // Ограничиваем количество ДО генерации метадаты
        // ========================================

        // Сколько вложений уже висит в черновике.
        // Считаем через нормализатор: вложения — объект-мап
        const existCount = Attachments.count(form.tempMessage?.attachments);

        // Максимум файлов из лимитов авторизации (config/limits.js)
        const maxFiles = getLimits()?.files.max_files_per_message;

        // Обрезаем список заранее. Генерация превью тяжёлая (декодирование кадра
        // в canvas), и файлы, которые всё равно отлетят в корзину, обрабатывать
        // бессмысленно — на телефоне это секунды вождения на каждый файл.
        let limitedFiles = validFiles;
        if (maxFiles !== undefined) {

            // Сколько ещё можем добавить
            const available = maxFiles - existCount;

            // Лимит уже выбран — новые файлы просто игнорируем
            if (available <= 0) {
                Toast.warning(formatToast("maximum_files", { count: maxFiles }), { position: "bottom-center" });
                return;
            }

            if (validFiles.length > available) {
                Toast.warning(formatToast("maximum_files", { count: maxFiles }), { position: "bottom-center" });
                limitedFiles = validFiles.slice(0, available);
            }

        }

        // ========================================

        // Массив
        const attachments: AttachmentsMap = {};

        // Проходим по файлам
        for (let file of limitedFiles) {

            const fileStartedAt = performance.now();

            Logger.debug(`[secret-chat:import] обработка "${file.name}" (${file.size} Б, ${file.type || "?"})`);

            // Создаем объект данных (тип задаём заранее: metadata дописывается ниже).
            // temp_id держим в отдельной переменной: поле в типе опционально,
            // а ключ мапа вложений обязан быть строкой
            const tempId = crypto.randomUUID();
            let attach: AttachmentsMap[string] = {
                _file: file,
                size: file.size,
                temp_id: tempId,
                name: file.name,
                file_name: file.name,
                mime_type: file.type
            };

            // Собираем метадату (оригинальные размеры, длительность, превью).
            // Оркестратор сам разбирает тип файла и никогда не бросает исключений,
            // поэтому одно битое вложение не отменяет импорт остальных.
            attach.metadata = await buildLocalMediaMetadata(file);

            Logger.debug(
                `[secret-chat:import] "${file.name}" обработано за ${Math.round(performance.now() - fileStartedAt)} мс`
            );

            attachments[tempId] = attach;

        }

        Logger.debug(`[secret-chat:import] готово: вложений ${Object.keys(attachments).length}`);

        // ========================================

        // Если временное сообщение уже создано
        if (form.tempMessage) {

            // Текущие вложения
            let existAttaches = form.tempMessage.attachments || {};

            // Объединяем
            form.tempMessage.attachments = {
                ...existAttaches,
                ...attachments
            };

            form.store.update(form.tempMessage.id, form.tempMessage);

        }

        // ========================================

        // Если временное сообщение еще не создано
        if (!form.tempMessage) {

            // Явная типизация: поле формы хранит запись стора, а литерал
            // дополнительно несёт поля черновика (is_temporary и т.д.)
            const tempMessage: SecretChatMessageRecord = {
                id: Uuidv7(),
                chat_id: form.chatId,
                sender: "me",
                type: "text",
                status: "queued",
                text: form.textarea?.value ?? null,
                reply_to: form.replyMessage ? form.replyMessage.id : null,
                reply_to_message: form.replyMessage ? form.replyMessage : null,
                created_at: new Date().toISOString(),
                is_temporary: true,
                attachments: attachments
            };

            form.tempMessage = tempMessage;
            form.store.add(tempMessage);
        }

        // Обновляем состояние кнопок
        updateStateButtons(form);

    } catch (error) {
        Logger.error("[app][secret-chat][import-attaches]:", error);
    }

}

/**
 * ***************************************************************************
 * Показать ошибки валидации файлов (по одному тосту на код).
 * @param errors - Ошибки от FileValidator.
 * @returns void
 * ***************************************************************************
 */
function showValidationErrors(errors: FileValidationError[]): void {

    // Ошибок нет — показывать нечего
    if (!errors?.length) return;

    // Один тост на уникальный код: не заваливаем пользователя одинаковыми окнами
    const shownCodes = new Set();

    for (const error of errors) {

        // Нет кода (например, файл не File) — логируем, тост не показываем
        if (!error.code) {
            Logger.warn("[app][secret-chat][import-attaches]: файл отклонён без кода ошибки.", error.params);
            continue;
        }

        // Код уже показывали — пропускаем дубль
        if (shownCodes.has(error.code)) continue;
        shownCodes.add(error.code);

        Toast.warning(formatToast(error.code, error.params), { position: "bottom-center" });

    }

}

/**
 * ***************************************************************************
 * Подставить параметры в текст тоста (`%{name}%`, `%{count}%`).
 * @param code - Код тоста в локали.
 * @param params - Значения для подстановки.
 * @returns Готовый текст.
 * ***************************************************************************
 */
function formatToast(code: string, params?: ToastParams): string {

    // Локаль типизирована фиксированными ключами, а коды ошибок приходят
    // динамически — копируем секцию в словарь для поиска по строке
    const toasts: Record<string, string> = { ...window._lc?.forms?.secret_chat?.toasts };
    let text = toasts[code] || toasts.invalid_extension || "Файл нельзя прикреплять";

    for (const [key, value] of Object.entries(params || {})) {
        text = text.replaceAll(`%{${key}}%`, String(value));
    }

    return text;

}
