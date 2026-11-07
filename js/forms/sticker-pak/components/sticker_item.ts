// Импортируем utils
import { GestureController } from "../../../utils/gesture_controller.js";
import { CacheManager } from "../../../utils/cache_manager.js";
import { forStorage } from "../../../utils/network/storage_url.js";

// Импортируем handlers
import { stickerContextMenuHandler } from "../handlers/sticker_menu.js";

// Импортируем типы
import type { StickerItem } from "../types.js";
import type { StickerPak } from "../index.js";

/**
 * ***************************************************************************
 * Создание DOM-элемента стикера в сетке пака.
 *
 * Только автор пака получает жесты: тап, долгий тап и правый клик открывают
 * контекстное меню с удалением. Для остальных пользователей стикер —
 * просмотр (без обработчиков и курсора-указателя).
 *
 * @param form - Экземпляр формы.
 * @param sticker - Данные стикера (id, документ, токен).
 * @returns DOM-элемент стикера или null без документа.
 * ***************************************************************************
 */
export function createStickerItem(form: StickerPak, sticker: StickerItem): HTMLElement | null {

    // Создаем DOM-элемент из шаблона
    const element = createTemplate();

    // Без шаблона элемент не создаётся
    if (!element) return null;

    // Без документа хранилище файл не найдёт — элемент бессмыслен
    if (!sticker.document_id) return null;

    // Привязываем id стикера для удаления из сетки (см. functions/remove_sticker)
    element.setAttribute("data-sticker-id", sticker.sticker_id);

    // Формируем ссылку через CacheManager (токен кладётся в query, дальше
    // ресурс перехватывает Service Worker — медиа-кеш)
    const image = element.querySelector("img");
    if (image) {
        image.src = CacheManager.getMediaSrc({
            url: forStorage(sticker.document_id),
            file_token: sticker.file_token ?? undefined,
            type: "media"
        });
    }

    // Жесты — только для автора пака
    if (form.pak?.is_author) {

        // Указатель-рука: элемент интерактивен
        element.classList.add("cursor-pointer");

        new GestureController(element, {
            threshold: 5,

            // Правый клик (мышь): меню по координатам курсора
            onContextMenu: (event) => {
                event.preventDefault();
                stickerContextMenuHandler(event.clientX, event.clientY, form, sticker);
            }
        });

    }

    return element;

}

/**
 * ***************************************************************************
 * Приватная: координаты точки нажатия из события жеста.
 *
 * Долгий тап приходит исходным MouseEvent либо TouchEvent (стартовое
 * событие жеста) — у тача координаты берутся из touches[0]. Если точки
 * нет, отдаём центр элемента.
 * @param event - Событие жеста.
 * @param element - Элемент, на котором ловился жест.
 * @returns Координаты точки в viewport.
 * ***************************************************************************
 */
function getEventPoint(event: Event, element: Element): { x: number; y: number } {

    // Мышь: координаты уже в событии (приведение — Event не несёт
    // мышиных свойств в своей типизации, проверяем значения напрямую)
    const mouseEvent = event as MouseEvent;
    if (typeof mouseEvent.clientX === "number" && typeof mouseEvent.clientY === "number") {
        return { x: mouseEvent.clientX, y: mouseEvent.clientY };
    }

    // Тач: первая точка нажатия (или точка отпускания)
    const touchEvent = event as TouchEvent;
    const touch = touchEvent.touches?.[0] ?? touchEvent.changedTouches?.[0];
    if (touch) return { x: touch.clientX, y: touch.clientY };

    // Фолбэк: центр элемента
    const rect = element.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };

}

/**
 * ***************************************************************************
 * Шаблон стикера: DOMParser для безопасного создания DOM без innerHTML.
 * @returns DOM-элемент стикера.
 * ***************************************************************************
 */
function createTemplate(): HTMLElement | null {

    const element = new DOMParser().parseFromString(`
        <div class="sticker-item flex items-center justify-center p-1.5 aspect-square rounded-lg hover:bg-[var(--second-bg)] active:bg-[var(--second-bg)]">
            <img class="max-w-full max-h-full object-contain" alt="" draggable="false">
        </div>
    `, "text/html").querySelector<HTMLElement>(".sticker-item");

    // Своя разметка всегда содержит «.sticker-item» — без элемента стикер не создаётся
    if (!element) throw new Error("Не найден шаблон: .sticker-item");

    return element;

}
