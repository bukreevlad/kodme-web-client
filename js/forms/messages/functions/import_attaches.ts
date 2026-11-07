// Импортируем сторонние пакеты
import { v7 as Uuidv7 } from "uuid";

// Импортируем config
import { TEMP_MESSAGE } from "../../../config/constants.js";

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
import { getSessionUserId, getSessionUserDisplayName } from "../../main/functions/session_identity.js";

// Импортируем типы
import type { AttachmentsRaw } from "../../../utils/messages/attachments.js";
import type { FileValidationError } from "../../../utils/validation/file_validator.js";
import type { MessageRecord } from "../types.js";
import type { Messages } from "../index.js";
import { I18n, t } from "../../../utils/i18n/index.js";

/** Объект-мап вложений черновика (тот же тип, что хранит MessageRecord.attachments). */
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
 * видео в canvas). Раньше проверок не было вовсе — файл с запрещённым
 * расширением честно декодировался и улетал на сервер, где получал отказ.
 * @param form - Форма.
 * @param files - Массив файлов.
 * @returns Promise<void>
 * ***************************************************************************
 */
export async function importAttaches(form: Messages, files: File[]): Promise<void> {

    try {

        Logger.debug(`[messages:import] старт: получено файлов ${files?.length ?? 0}`);

        // ========================================
        // Фильтруем файлы по white-листу и размеру
        // ========================================

        // Отсекаем запрещённые расширения, слишком большие файлы и файлы,
        // у которых mime-тип противоречит расширению
        const { files: validFiles, errors } = filterFiles(files);

        Logger.debug(`[messages:import] после фильтра: валидных ${validFiles.length}, ошибок ${errors.length}`);

        // Показываем по одному тосту на тип проблемы (иначе при выборе 20 файлов
        // пользователь получил бы 20 одинаковых всплывающих окон)
        showValidationErrors(errors);

        // После фильтрации не осталось ничего — импортировать нечего
        if (validFiles.length === 0) return;

        // ========================================
        // Ограничиваем количество ДО генерации метадаты
        // ========================================

        // Сколько вложений уже висит в черновике.
        // Считаем через нормализатор: сервер отдаёт массив, локальные — объект-мап
        const existCount = Attachments.count(form.tempMessage?.attachments);

        // Максимум файлов из лимитов авторизации (config/limits.js). Пока ответ
        // не принят — обрезку ведёт сервер, клиент файлы не отсекает
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

            Logger.debug(`[messages:import] обработка "${file.name}" (${file.size} Б, ${file.type || "?"})`);

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
            //
            // Оркестратор сам разбирает тип файла: картинки, видео и аудио
            // раньше обрабатывались разными ветками в этом файле, и ветку для
            // картинок просто забыли — из-за чего у локальных вложений не было
            // ни пропорций, ни превью. Он же никогда не бросает исключения,
            // поэтому одно битое вложение не отменяет импорт остальных.
            attach.metadata = await buildLocalMediaMetadata(file);

            Logger.debug(
                `[messages:import] "${file.name}" обработано за ${Math.round(performance.now() - fileStartedAt)} мс`
            );

            attachments[tempId] = attach;

        }

        Logger.debug(`[messages:import] готово: вложений ${Object.keys(attachments).length}`);

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
            // дополнительно несёт серверные поля (created_at, reply_to и т.д.)
            const tempMessage: MessageRecord = {
                ...TEMP_MESSAGE,
                id: Uuidv7(),
                created_user_id: getSessionUserId() ?? undefined,
                display_name: getSessionUserDisplayName(),
                channel_id: form.channelId,
                channel_type: form.channel?.type,
                text: form.textarea?.value,
                reply_to_message_id: form.replyMessage ? form.replyMessage.id : null,
                reply_to_message: form.replyMessage ? form.replyMessage : null,
                created_at: new Date().toISOString(),
                attachments: attachments
            };

            form.tempMessage = tempMessage;
            form.store.add(tempMessage);
        }

        // Обновляем состояние кнопок
        updateStateButtons(form);

    } catch (error) {
        Logger.error("[app][messages][import-attaches]:", error);
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
            Logger.warn("[app][messages][import-attaches]: файл отклонён без кода ошибки.", error.params);
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
 * Подставить параметры в текст тоста (`{{name}}`, `{{count}}`).
 * @param code - Код тоста в локали.
 * @param params - Значения для подстановки.
 * @returns Готовый текст.
 * ***************************************************************************
 */
function formatToast(code: string, params?: ToastParams): string {

    // Локаль типизирована фиксированными ключами, а коды ошибок приходят
    // динамически — копируем секцию в словарь для поиска по строке
    const toasts: Record<string, string> = { ...I18n.tree.forms.messages.toasts };
    let text = toasts[code] || toasts.invalid_extension || t("api.errors.invalid_extension");

    for (const [key, value] of Object.entries(params || {})) {
        text = text.replaceAll(`{{${key}}}`, String(value));
    }

    return text;

}
