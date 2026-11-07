// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { buildLocalMediaMetadata } from "../../../utils/media/local_media_metadata.js";
import { filterFiles } from "../../../utils/validation/file_validator.js";
import { getLimits } from "../../../config/limits.js";
import * as Attachments from "../../../utils/messages/attachments.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем functions
import { updateStateButtons } from "./update_state_buttons.js";
import { createDraftComment, getDraftComment, setDraftComment } from "./draft_comment.js";

// Импортируем типы
import type { AttachmentsRaw } from "../../../utils/messages/attachments.js";
import type { FileValidationError } from "../../../utils/validation/file_validator.js";
import type { CommentRecord } from "../types.js";
import type { Comments } from "../index.js";

/** Локальная форма мапы вложений (массив возможен только в ответе сервера). */
type AttachmentsMap = Extract<AttachmentsRaw, Record<string, unknown>>;

/**
 * ***************************************************************************
 * importAttaches - импорт выбранных файлов как вложений черновика комментария.
 *
 * Валидация (white-list расширений, размер, mime, лимит количества) идёт до
 * генерации метадаты: тяжёлый декодирование кадра выполняется только для
 * файлов, которые реально долетят до черновика. Черновик создаётся при первом
 * импорте и обновляется в Store (строка в ленте сразу показывает превью).
 *
 * Все данные живут в памяти формы — без IndexedDB (решение по комментариям).
 * @param form - Экземпляр формы.
 * @param files - Выбранные/перетащенные файлы.
 * @returns Promise<void>
 * ***************************************************************************
 */
export async function importAttaches(form: Comments, files: File[]): Promise<void> {

    // Если формы нет
    if (!form || !files.length) return;

    try {

        // Фильтруем файлы: отсекаем запрещённые расширения, превышение размера и
        // у которых mime-тип противоречит расширению
        const { files: validFiles, errors } = filterFiles(files);

        Logger.debug(`[app][comments][import]: после фильтра: валидных ${validFiles.length}, ошибок ${errors.length}`);

        // Показываем по одному тосту на тип проблемы (иначе при выборе 20 файлов
        // пользователь получил бы 20 одинаковых всплывающих окон)
        showValidationErrors(errors);

        // После фильтрации не осталось ничего — импортировать нечего
        if (validFiles.length === 0) return;

        // ========================================
        // Ограничиваем количество ДО генерации метадаты
        // ========================================

        // Текущий черновик (мог быть создан предыдущим импортом)
        const draft = getDraftComment(form);

        // Сколько вложений уже висит в черновике.
        // Считаем через нормализатор: сервер отдаёт массив, локальные — объект-мап
        const existCount = Attachments.count(draft?.attachments);

        // Максимум файлов из лимитов авторизации (config/limits.js). Пока ответ
        // не принят — обрезку ведёт сервер, клиент файлы не отсекает
        const maxFiles = getLimits()?.files.max_files_per_message;

        // Обрезаем список заранее: генерация превью тяжёлая, и файлы, которые
        // всё равно отлетят в корзину, обрабатывать бессмысленно
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

        // Мап новых вложений
        const attachments: AttachmentsMap = {};

        // Проходим по файлам
        for (let file of limitedFiles) {

            const fileStartedAt = performance.now();

            Logger.debug(`[app][comments][import]: обработка "${file.name}" (${file.size} Б, ${file.type || "?"})`);

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

            // Собираем метадату (оригинальные размеры, длительность, превью):
            // оркестратор сам разбирает тип файла и не бросает исключений,
            // поэтому одно битое вложение не отменяет импорт остальных
            attach.metadata = await buildLocalMediaMetadata(file);

            Logger.debug(
                `[app][comments][import]: "${file.name}" обработано за ${Math.round(performance.now() - fileStartedAt)} мс`
            );

            attachments[tempId] = attach;

        }

        // ========================================

        // Черновик уже висит в ленте — дописываем вложения в него
        if (draft) {

            // Явная типизация: поле в типе опционально, а spread требует объект
            const existAttaches = (draft.attachments || {}) as AttachmentsMap;
            draft.attachments = { ...existAttaches, ...attachments };

            setDraftComment(form, draft);

        } else {

            // Черновика ещё нет — создаём по тексту из поля ввода
            const newDraft: CommentRecord = createDraftComment(
                form,
                form.textarea?.value ?? "",
                attachments,
                form.replyComment ? form.replyComment.id : null
            );

            setDraftComment(form, newDraft);

        }

        // Обновляем состояние кнопок футера
        updateStateButtons(form);

    } catch (error) {
        Logger.error("[app][comments][import-attaches]", error);
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
            Logger.warn("[app][comments][import-attaches]: файл отклонён без кода ошибки.", error.params);
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
function formatToast(code: string, params?: object): string {

    // Локаль типизирована фиксированными ключами, а коды ошибок приходят
    // динамически — копируем секцию в словарь для поиска по строке
    const toasts: Record<string, string> = { ...window._lc?.forms?.comments?.toasts };
    let text = toasts[code] || toasts.invalid_extension || "Файл нельзя прикреплять";

    for (const [key, value] of Object.entries(params || {})) {
        text = text.replaceAll(`%{${key}}%`, String(value));
    }

    return text;

}
