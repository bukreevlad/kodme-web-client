// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем managers
import { TabsManager } from "../../../core/managers/form_tabs_manager.js";

// Импортируем типы
import { isWindowGeometryOverlay } from "../types.js";
import type { BotApp } from "../index.js";

/**
 * ***************************************************************************
 * Сворачивает WebApp-приложение обратно в плавающее окно.
 * @param form - Форма.
 * ***************************************************************************
 */
export async function minimizeHandler(form: BotApp): Promise<void> {

    try {

        // Свёртывание имеет смысл только для развёрнутого окна
        if (!form.maximized) return;

        // Геометрией обладает только модальное окно с капабилти window_geometry
        if (!form.modal?.tpl || !isWindowGeometryOverlay(form.modal)) return;

        // Возвращаем окно туда, куда оно открывалось (insertInto формы или body)
        const container = form.options?.insertInto ?? document.body;

        // Восстанавливаем геометрию окна (только если она сохранялась:
        // без неё restoreGeometry и так выходит, не меняя стили)
        const geometry = form.modal.geometry;
        if (geometry) {
            form.modal.restoreGeometry(geometry);
        }

        // Включаем передвижение и изменение размеров формы
        form.modal.enableMove();
        form.modal.enableResize();

        container.moveBefore(form.modal.tpl, null);
        form.modal.setWrapPadding("p-4");

        // Кнопки управления окном
        form.maximize?.classList.remove("hidden");
        form.minimize?.classList.add("hidden");

        // Настраиваем
        const modal = form?.tpl;
        if (modal) {
            modal.classList.remove("min-w-full", "min-h-full", "rounded-none");
        }

        // Окно свёрнуто — разворот снова возможен
        form.maximized = false;

        // Убираем только таб: форма остаётся открытой, поэтому событие
        // [app][form]::closed не шлём — оно означает закрытие формы
        TabsManager.removeTab(form.modal.options.id);

    } catch (error) {
        Logger.error(error);
    }

}
