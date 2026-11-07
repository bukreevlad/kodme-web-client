// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { toastError } from "../../../utils/ui/toast_error.js";

// Импортируем functions
import { updateEmptyState } from "./update_empty_state.js";

// Импортируем requests
import { getPakRequest } from "../requests/get_pak.js";

// Импортируем типы
import { createStickerItem } from "../components/sticker_item.js";
import type { StickerPak } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Загрузка пака со стикерами и отрисовка формы содержимого.
 *
 * Ошибка запроса (например, PAK_NOT_FOUND — пак удалён или чужой
 * приватный) показывается тостом, форма закрывается: смотреть нечего.
 *
 * @param form - Экземпляр формы.
 * @returns Promise без значения.
 * ***************************************************************************
 */
export async function loadStickerPak(form: StickerPak): Promise<void> {

    try {

        // Запрос пака (ошибки сервера сокет пробрасывает reject'ом)
        const response = await getPakRequest({ pak_id: form.pakId });

        // Неожиданный ответ — просто выходим
        if (!response?.data) return;

        // Сохраняем данные пака
        form.pak = response.data;
        form.stickers = Array.isArray(response.data.stickers) ? response.data.stickers : [];

        // Заголовок — название пака
        const title = form.tpl?.querySelector(":scope >.header [data-title]");
        if (title) title.textContent = form.pak.name;

        // Кнопка «+» (загрузка стикера) — только у автора пака
        const authorActions = form.tpl?.querySelector<HTMLElement>(":scope >.header [data-author-actions]");
        authorActions?.classList.toggle("hidden", !form.pak.is_author);

        // Кнопка «Добавить к себе» — чужой публичный пак, ещё не добавленный
        const canAdd = !form.pak.is_author && form.pak.is_public && !form.pak.is_member;
        const memberActions = form.tpl?.querySelector<HTMLElement>(":scope >.header [data-member-actions]");
        memberActions?.classList.toggle("hidden", !canAdd);

        // Устанавливаем контейнеры
        form.list = form.tpl?.querySelector(":scope >.content [data-list]") ?? null;
        form.empty = form.tpl?.querySelector(":scope >.content [data-empty]") ?? null;
        form.progressSlot = form.tpl?.querySelector<HTMLElement>(":scope >.content [data-progress]") ?? null;

        // Отрисовываем сетку стикеров
        const list = form.list;
        if (list) {
            form.stickers.forEach((sticker) => {
                const element = createStickerItem(form, sticker);
                if (element) list.appendChild(element);
            });
        }

        // Показываем/прячем пустое состояние
        updateEmptyState(form);

    } catch (error) {

        // Показываем тост (коды ошибок разбирает сам toastError)
        toastError(error, {
            context: "[app][sticker-pak][load-pak]",
            fallback: t("forms.sticker_pak.toasts.load_error")
        });

        // Пак недоступен — закрываем форму
        Logger.debug("[app][sticker-pak][load-pak]:", error);
        form.modal?.close();

    }

}
