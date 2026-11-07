// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { IsMobile } from "../../../utils/helpers/is_mobile.js";

// Импортируем managers
import { TabsManager } from "../../../core/managers/form_tabs_manager.js";

// Импортируем типы
import { isWindowGeometryOverlay } from "../types.js";
import type { BotApp } from "../index.js";
import type { FormTabData } from "../../../core/managers/form_tabs_manager.js";

/**
 * ***************************************************************************
 * Разворачивает WebApp-приложение на весь контейнер форм главного экрана.
 * @param form - Форма.
 * ***************************************************************************
 */
export async function maximizeHandler(form: BotApp): Promise<void> {

    try {

        // На мобильных разворот не работает: табы форм там недоступны —
        // проверка закрывает и путь web_app_expand от приложения
        if (IsMobile.get()) return;

        // Уже развёрнуто — повторный web_app_expand не перезаписывает
        // сохранённую геометрию окна
        if (form.maximized) return;

        // Переносим в контейнер форм
        const container = document.querySelector<HTMLElement>(".cdm-form.home .middle .form-container");

        // Геометрией обладает только модальное окно с капабилти window_geometry;
        // без контейнера разворачивать нечего — тогда и таб не добавляем,
        // чтобы не создавать запись несуществующего развёрнутого окна
        if (!container || !form.modal?.tpl || !isWindowGeometryOverlay(form.modal)) return;

        // Сохраняем геометрию окна
        const geometry = form.modal.saveGeometry();
        form.modal.geometry = geometry;

        // Отключаем передвижение и изменение размеров формы
        form.modal.resetGeometry();
        form.modal.disableMove();
        form.modal.disableResize();

        container.moveBefore(form.modal.tpl, null);
        form.modal.setWrapPadding("p-0");

        // Кнопки управления окном
        form.maximize?.classList.add("hidden");
        form.minimize?.classList.remove("hidden");

        // Настраиваем
        const modal = form?.tpl;
        if (modal) {
            modal.classList.add("min-w-full", "min-h-full", "rounded-none");
        }

        // Окно развёрнуто — добавляем таб напрямую: событие [app][form]::opened
        // означает реальное открытие формы, а форма открыта давно
        form.maximized = true;

        const tabData: FormTabData = {
            instance: form,
            subtitle: window._lc.forms.bot_app.webapp_subtitle
        };
        if (form.initData) tabData.title = form.initData.name;

        TabsManager.addTab(form.modal.options.id, tabData);

    } catch (error) {
        Logger.error(error);
    }

}
