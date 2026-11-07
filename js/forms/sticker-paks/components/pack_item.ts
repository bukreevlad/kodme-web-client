// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { t } from "../../../utils/i18n/index.js";
import { GestureController } from "../../../utils/gesture_controller.js";
import { CacheManager } from "../../../utils/cache_manager.js";
import { forStorage } from "../../../utils/network/storage_url.js";

// Импортируем handlers
import { openPakHandler } from "../handlers/open_pak.js";
import { packContextMenuHandler } from "../handlers/context_menu.js";

// Импортируем типы
import { isStickerPakItem, StickerPakItem } from "../types.js";
import type { StickerPaks } from "../index.js";
import type { StoreEventName } from "../../../utils/store.js";

/**
 * Количество ячеек превью в плашке пака (сетка 2×2).
 */
const PREVIEW_SLOTS = 4;

/**
 * ***************************************************************************
 * Создание DOM-элемента плашки пака стикеров.
 *
 * Плашка — превью 2×2 (первые 4 стикера), название, автор и подписи
 * (количество стикеров, «Пак автора» / «Приватный» / «Добавлен»).
 * Тап открывает пак, долгий тап и правый клик — контекстное меню.
 *
 * @param form - Экземпляр формы.
 * @param data - Данные элемента.
 * @returns DOM-элемент плашки или null без данных.
 * ***************************************************************************
 */
export function createStickerPakItem(form: StickerPaks, data: StickerPakItem): HTMLElement | null {

    // Создаем DOM-элемент из шаблона
    const element = createTemplate();

    // Без шаблона элемент не создаётся
    if (!element) return null;

    // Актуальные данные элемента (переприсваиваются при обновлении)
    let currentData = data;

    /**
     * ***************************************************************************
     * Установка/перерисовка данных.
     * @param itemData - Данные элемента.
     * ***************************************************************************
     */
    const setup = (itemData: StickerPakItem): void => {

        try {

            // Сохраняем актуальные данные
            currentData = itemData;

            // Устанавливаем элементы
            const name = element.querySelector(":scope [data-name]");
            const author = element.querySelector(":scope [data-author]");
            const labels = element.querySelector<HTMLElement>(":scope [data-labels]");
            const preview = element.querySelector<HTMLElement>(":scope [data-preview]");

            // Отображаем данные
            if (name) name.textContent = itemData.name;
            if (author) author.textContent = itemData.author_name ?? "";

            // Подписи пака: количество стикеров + статусные метки
            if (labels) renderLabels(labels, itemData);

            // Превью 2×2 из первых стикеров пака
            if (preview) renderPreview(preview, itemData);

        } catch (error) {
            Logger.error("[app][sticker-paks][pack-item][setup]:", error);
        }

    };

    /**
     * ***************************************************************************
     * Обработчики элемента: тап — открыть пак, долгий тап и правый клик —
     * контекстное меню (долгий тап заменяет правый клик на тач-устройствах).
     * ***************************************************************************
     */
    const actions = (): void => {

        new GestureController(element, {
            threshold: 5,

            tap: {

                // Тап: открываем пак со стикерами
                onTap: () => openPakHandler(currentData.id),

            },

            // Правый клик (мышь): меню по координатам курсора
            onContextMenu: (event) => {
                event.preventDefault();
                packContextMenuHandler(event.clientX, event.clientY, form, currentData);
            }
        });

    };

    /**
     * ***************************************************************************
     * Подписка на точечное событие обновления элемента в сторе.
     * ***************************************************************************
     */
    const subscribeToUpdates = (): void => {

        try {

            // Формируем уникальное имя события
            const itemUpdatedEvent: StoreEventName = `item::updated::${currentData.id}`;

            // Подписываемся и сохраняем функцию отписки
            const unsubscribe = form.store.on(itemUpdatedEvent, (payload) => {

                // Стор шлёт payload как unknown — сверяемся guard'ом
                if (!isStickerPakItem(payload)) return;

                // Обновляем данные
                setup(payload);

            });

            // Сохраняем функцию отписки в data, чтобы форма могла вызвать её при удалении
            currentData.__unsubscribeStore__ = unsubscribe;

        } catch (error) {
            Logger.error("[app][sticker-paks][pack-item][subscribe]:", error);
        }

    };

    // Записываем ссылку на DOM-элемент в данные
    if (!currentData.__domElements__) {
        currentData.__domElements__ = [];
    }
    currentData.__domElements__.push(element);

    // Устанавливаем начальные данные
    setup(currentData);

    // Прикрепляем обработчики событий
    actions();

    // Подписываем на обновление
    subscribeToUpdates();

    // Возвращаем сам элемент для вставки в DOM
    return element;

}

/**
 * ***************************************************************************
 * Приватная: отрисовка подписей пака (количество стикеров и статусные метки).
 * @param container - Контейнер подписей.
 * @param itemData - Данные элемента.
 * ***************************************************************************
 */
function renderLabels(container: HTMLElement, itemData: StickerPakItem): void {

    // Чистим предыдущие подписи
    container.replaceChildren();

    // Количество стикеров со склонением (1 стикер / 2 стикера / 5 стикеров)
    const count = document.createElement("span");
    count.className = "text-muted text-xs";
    count.textContent = `${itemData.stickers_count} ${t("forms.sticker_paks.labels.stickers", { count: itemData.stickers_count })}`.trim();
    container.appendChild(count);

    // Метка «Пак автора» — свой пак
    if (itemData.is_author) {
        const badge = document.createElement("span");
        badge.className = "badge px-1.5 py-0.5 rounded-md text-[0.65rem] font-medium bg-[var(--second-bg)] text-secondary";
        badge.textContent = t("forms.sticker_paks.labels.author_pack");
        container.appendChild(badge);
    }

    // Метка «Приватный» — пак виден только автору
    if (!itemData.is_public) {
        const badge = document.createElement("span");
        badge.className = "badge px-1.5 py-0.5 rounded-md text-[0.65rem] font-medium bg-[var(--second-bg)] text-secondary";
        badge.textContent = t("forms.sticker_paks.labels.private");
        container.appendChild(badge);
    }

    // Метка «Добавлен» — публичный пак, подписанный пользователем
    if (itemData.is_member && !itemData.is_author) {
        const badge = document.createElement("span");
        badge.className = "badge px-1.5 py-0.5 rounded-md text-[0.65rem] font-medium bg-[var(--second-bg)] text-secondary";
        badge.textContent = t("forms.sticker_paks.labels.added");
        container.appendChild(badge);
    }

}

/**
 * ***************************************************************************
 * Приватная: отрисовка превью пака — сетка 2×2 из первых стикеров.
 *
 * Ссылки собираются через CacheManager: токен доступа кладётся в query
 * `?token=…`, дальше ресурс перехватывает Service Worker (медиа-кеш).
 * @param container - Контейнер превью.
 * @param itemData - Данные элемента.
 * ***************************************************************************
 */
function renderPreview(container: HTMLElement, itemData: StickerPakItem): void {

    // Чистим предыдущее превью
    container.replaceChildren();

    for (let i = 0; i < PREVIEW_SLOTS; i++) {

        const sticker = itemData.preview?.[i];

        // Ячейка без стикера — пустой фон-заглушка
        if (!sticker) {
            const slot = document.createElement("div");
            slot.className = "aspect-square bg-[var(--second-bg)]";
            container.appendChild(slot);
            continue;
        }

        // Ячейка со стикером
        const image = document.createElement("img");
        image.className = "aspect-square object-contain bg-[var(--second-bg)]";
        image.loading = "lazy";
        image.alt = "";

        // Формируем ссылку через CacheManager (без document_id хранилище
        // не найдёт файл — тогда src остаётся пустым)
        if (sticker.document_id) {
            image.src = CacheManager.getMediaSrc({
                url: forStorage(sticker.document_id),
                file_token: sticker.file_token ?? undefined,
                type: "media"
            });
        }

        container.appendChild(image);

    }

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
 * Шаблон плашки: DOMParser для безопасного создания DOM без innerHTML.
 * @returns DOM-элемент плашки пака.
 * ***************************************************************************
 */
function createTemplate(): HTMLElement | null {

    const element = new DOMParser().parseFromString(`
        <div class="item flex flex-row gap-3 p-2 hover:bg-[var(--second-bg)] active:bg-[var(--second-bg)] rounded-lg cursor-pointer">
            <div data-preview class="grid grid-cols-2 gap-0.5 w-[72px] h-[72px] shrink-0 rounded-lg overflow-hidden"></div>
            <div class="flex flex-col gap-1 w-full min-w-0 justify-center">
                <span data-name class="font-semibold truncate"></span>
                <span data-author class="text-secondary text-sm truncate"></span>
                <div data-labels class="flex flex-row gap-1 items-center flex-wrap"></div>
            </div>
        </div>
    `, "text/html").querySelector<HTMLElement>(".item");

    // Своя разметка всегда содержит «.item» — без элемента плашка не создаётся
    if (!element) throw new Error("Не найден шаблон: .item");

    return element;

}
