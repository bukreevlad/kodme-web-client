// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { formatBytes } from "../../../utils/string/format_bytes.js";
import { IsMobile } from "../../../utils/helpers/is_mobile.js";
import { FileDownloader } from "../../../utils/network/file_downloader.js";
import { getErrorName } from "../../../utils/helpers/error_util.js";
import { GestureController } from "../../../utils/gesture_controller.js";

// Импортируем components
import { Buttons } from "../../../components/buttons.js";
import { ProgressIndicator } from "../../../components/progress.js";

// Импортируем handlers
import { documentContextMenuHandler } from "./handlers/document_context_menu.js";

// Импортируем типы
import type { AttachmentData } from "./types.js";

/**
 * ***************************************************************************
 * createDocumentItem - строка документа секретного чата: имя, размер,
 * кнопка скачивания (расшифрованный локальный файл сохраняется на устройство)
 * и контекстное меню.
 *
 * Источник файла — только локальный blob (`_file`, vault-расшифровка):
 * серверного хранилища у секретных чатов нет. Копия
 * forms/messages/components/attaches_document.ts под секретные чаты.
 * @param data - Данные вложения (id, file_name, size и т.д.).
 * @returns DOM-элемент вложения.
 * ***************************************************************************
 */
export function createDocumentItem(data: AttachmentData): HTMLElement {

    // Состояние загрузки документа
    let current = data;
    let downloader: FileDownloader | null = null;
    let progress: ProgressIndicator | null = null;
    let isDownloadProccess = false;
    let downloadButton: Buttons | null = null;

    // **************************************************************************
    // Шаблон элемента
    // **************************************************************************
    function template(): HTMLElement {
        const element = new DOMParser().parseFromString(`
            <div class="item document relative flex flex-row items-center w-full gap-2 p-1 rounded-lg hover:bg-[var(--second-bg)] active:bg-[var(--second-bg)] cursor-pointer">
                <button action-download></button>
                <div class="flex flex-col gap-0 justify-center overflow-hidden">
                    <span data-name class="font-semibold w-full truncate"></span>
                    <span data-size class="text-muted text-sm"></span>
                </div>
            </div>
        `, "text/html").querySelector<HTMLElement>(".item");

        // Своя разметка всегда содержит «.item» — без элемента элемент списка не создаётся
        if (!element) throw new Error("Не найден шаблон: .item");

        return element;
    }

    // **************************************************************************
    // Установка/Перерисовка данных
    // **************************************************************************
    function setup(data: AttachmentData): void {

        try {

            // Записываем данные
            current = data;

            // Устанавливаем элементы
            let downloadPlaceholder = element.querySelector("[action-download]");
            const name = element.querySelector<HTMLElement>(":scope [data-name]");
            const size = element.querySelector<HTMLElement>(":scope [data-size]");

            // Устанавливаем данные
            if (name) name.textContent = data.file_name || data.name || null;
            if (size) size.textContent = formatBytes(data.size ?? 0);

            // Устанавливаем кнопку управления
            downloadButton = Buttons.circle({
                attributes: ["action-download", "data-progress-wrap"],
                classes: ["relative"],
                icon: "ArrowBigDown",
                intent: "primary"
            });

            // Заменяем элемент кнопки
            downloadPlaceholder?.replaceWith(downloadButton.dom);

            // Файл пока не принят — показываем иконку ожидания; готовый
            // локальный файл сразу доступен к сохранению (иконка File)
            if (current._file instanceof File || current._file instanceof Blob) {
                downloadButton.setIcon("File");
            }

        } catch (error) {
            Logger.error("Setup Error:", error);
        }

    }

    // **************************************************************************
    // Обработчики
    // **************************************************************************
    function actions(): void {

        // Клик по кнопке: запуск или отмена загрузки
        downloadButton?.dom?.addEventListener("click", async (event) => {
            event.stopPropagation();
            event.preventDefault();

            if (isDownloadProccess) {
                abortDownload();
            } else {
                await initDownload();
            }
        });

        // ======================

        // Конекстное меню или скачивание
        let controller = new GestureController(element, {
            threshold: 5,
            onContextMenu: (event) => {
                event.preventDefault();
                if (!IsMobile.get()) {
                    event.stopPropagation();
                    documentContextMenuHandler(event, { initDownload });
                }
            },
            tap: {
                longTapTimeout: 500,
                onTap: async (event) => {

                    // Кнопка скачивания обрабатывает свой click: tap стартовал бы
                    // загрузку, а идущий следом click сразу отменил бы её
                    const target = event.target instanceof Element ? event.target : null;
                    if (target?.closest("[action-download]")) return;

                    await initDownload();
                },
                onLongTap: (event) => {

                    // Если мобильная версия
                    if (IsMobile.get()) {
                        if (event.cancelable) event.preventDefault();
                        event.stopPropagation();
                        documentContextMenuHandler(event, { initDownload });
                    }

                }
            }
        });

    }

    // **************************************************************************
    // Логика запуска загрузки
    // **************************************************************************
    async function startDownload(): Promise<void> {

        // Файл ещё не принят (оригинал летит чанками) — скачивать нечего
        if (!(current._file instanceof File || current._file instanceof Blob)) return;

        isDownloadProccess = true;
        const localUrl = URL.createObjectURL(current._file);

        try {

            // Инициализация прогресс-бара
            progress = new ProgressIndicator({ width: "100%" });
            downloadButton?.dom?.appendChild(progress.getElement());
            progress.setProcessing();

            // Иконка "X" для отмены
            downloadButton?.setIcon("X");

            // Создаем загрузчик: сохраняем расшифрованный локальный файл
            // через blob-ссылку (серверного хранилища у секретных чатов нет)
            downloader = new FileDownloader({
                url: localUrl,
                file_name: current.file_name,
                callback: (loaded, total, percent) => {
                    if (progress) progress.update(percent);
                }
            });

            // Ждём завершения загрузки
            await downloader.download();

        } catch (error) {
            if (getErrorName(error) !== "AbortError") {
                Logger.error("Download Error:", error);
            }
        } finally {
            URL.revokeObjectURL(localUrl);
            cleanupUI();
            isDownloadProccess = false;
        }

    }

    // **************************************************************************
    // Принудительная остановка
    // **************************************************************************
    function abortDownload(): void {
        if (downloader) downloader.destroy();
        cleanupUI();
    }

    // **************************************************************************
    // Очистка UI после загрузки/ошибки/отмены
    // **************************************************************************
    function cleanupUI(): void {

        // Удаляем прогресс
        if (progress) {
            progress.destroy();
            progress = null;
        }

        // Очищаем данные
        downloader = null;
        isDownloadProccess = false;

        // Возвращаем корректную иконку
        downloadButton?.setIcon("File");

    }

    // **************************************************************************
    // Инициализация загрузки или открытия
    // **************************************************************************
    async function initDownload(): Promise<void> {

        // Если идет скачивание
        if (isDownloadProccess) return;

        // Начинаем процесс загрузки
        await startDownload();

    }

    // Создаем DOM-элемент из шаблона
    const element = template();

    // Записываем ссылку на dom элемент
    if (!data.__domElements__) {
        data.__domElements__ = [];
    }
    data.__domElements__.push(element);

    // Функции обновления и чтения данных (хуки для загрузчика)
    data.__update__ = (next) => setup(next);
    data.__getData__ = () => current;

    // Устанавливаем начальные данные
    setup(data);

    // Прикрепляем обработчики событий
    actions();

    // Возвращаем сам элемент для вставки в DOM
    return element;

}
