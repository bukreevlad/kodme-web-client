// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем functions
import { importAttaches } from "../functions/import_attaches.js";

// Импортируем типы
import type { Comments } from "../index.js";

/**
 * Отписка от drag&drop (гасит обработчики на удалённом элементе списка).
 */
export interface DragAndDropHandle {

    /** Снять обработчики перетаскивания. */
    destroy: () => void;

}

/**
 * ***************************************************************************
 * dragAndDropFilesHandler - подписка на перетаскивание файлов в ленту.
 *
 * Подписываемся на уровне списка комментариев (`[data-list]`), потому что
 * drop происходит на конкретной строке. Все проверки (white-list расширений,
 * размер, mime, лимит количества) делает `importAttaches` — здесь только
 * достаём файлы и гасим дефолт браузера.
 * @param form - Экземпляр формы.
 * @returns Объект с функцией отписки `destroy`.
 * ***************************************************************************
 */
export function dragAndDropFilesHandler(form: Comments): DragAndDropHandle {

    try {

        // Формы или списка нет — подписываться не на что
        if (!form?.list) return { destroy: () => { } };

        // ========================================
        // Внутреннее состояние
        // ========================================

        // Счётчик вложенных dragover: событие срабатывает на каждом дочернем
        // элементе, поэтому одного флага «мы внутри» мало
        let dragDepth = 0;

        // ========================================
        // Обработчики
        // ========================================

        /**
         * Курсор с файлом над списком: подсвечиваем область и запрещаем
         * дефолтное открытие файла браузером.
         */
        const onDragEnter = (event: DragEvent): void => {
            if (!hasFiles(event)) return;
            dragDepth += 1;
            event.preventDefault();
            setDropState(form, true);
        };

        /**
         * Курсор с файлом двигается над списком: держим подсветку.
         */
        const onDragOver = (event: DragEvent): void => {
            if (!hasFiles(event)) return;
            event.preventDefault();
            if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
        };

        /**
         * Курсор покинул область: снимаем подсветку (по счётчику вложенности).
         */
        const onDragLeave = (event: DragEvent): void => {
            if (!hasFiles(event)) return;
            event.preventDefault();
            dragDepth = Math.max(0, dragDepth - 1);
            if (dragDepth === 0) setDropState(form, false);
        };

        /**
         * Файлы брошены в ленту: добавляем их вложениями к черновику.
         */
        const onDrop = async (event: DragEvent): Promise<void> => {
            event.preventDefault();
            dragDepth = 0;
            setDropState(form, false);

            const files = extractFiles(event);
            if (!files.length) return;

            // Дальше — валидация (importAttaches)
            await importAttaches(form, files);
        };

        // ========================================
        // Подписка
        // ========================================

        form.list.addEventListener("dragenter", onDragEnter);
        form.list.addEventListener("dragover", onDragOver);
        form.list.addEventListener("dragleave", onDragLeave);
        form.list.addEventListener("drop", onDrop);

        Logger.debug(`[app][comments][drag-and-drop]: подписка установлена для поста ${form.postId}.`);

        // Функция отписки вызывается в _onBeforeClose
        return {
            destroy: () => {
                form.list?.removeEventListener("dragenter", onDragEnter);
                form.list?.removeEventListener("dragover", onDragOver);
                form.list?.removeEventListener("dragleave", onDragLeave);
                form.list?.removeEventListener("drop", onDrop);
            }
        };

    } catch (error) {
        Logger.error("[app][comments][drag-and-drop]", error);
        return { destroy: () => { } };
    }

}

/**
 * Проверить, что в перетаскивании есть файлы (а не текст или ссылка).
 * @param event - Событие.
 * @returns true, если перетаскиваются файлы.
 */
function hasFiles(event: DragEvent): boolean {
    const types = event?.dataTransfer?.types;
    if (!types) return false;
    return Array.from(types).includes("Files");
}

/**
 * Достать файлы из события drop (основной путь — FileList, запасной — items).
 * @param event - Событие.
 * @returns Массив файлов.
 */
function extractFiles(event: DragEvent): File[] {
    const transfer = event?.dataTransfer;
    if (!transfer) return [];

    // Основной путь: готовый FileList
    if (transfer.files?.length) return Array.from(transfer.files);

    // Запасной путь: собираем файлы из items
    const items = Array.from(transfer.items || []);
    const files = items
        .filter(item => item.kind === "file")
        .map(item => item.getAsFile())
        .filter((file): file is File => file !== null);

    if (!files.length) {
        Toast.warning(window._lc?.forms?.comments?.toasts?.drop_files_failed || "Не удалось прочитать файлы", {
            position: "bottom-center"
        });
    }

    return files;
}

/**
 * Подсветить/снять подсветку области приёма файлов.
 * @param form - Экземпляр формы.
 * @param isActive - Активна ли область приёма.
 */
function setDropState(form: Comments, isActive: boolean): void {
    // Хранитель класса на самой форме, чтобы не дублировать поиск по DOM
    form.isDropActive = isActive;

    const classes = ["ring-2", "ring-[var(--accent-color)]", "rounded-2xl"];

    if (isActive) {
        form.list?.classList.add(...classes);
    } else {
        form.list?.classList.remove(...classes);
    }
}
