// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем components
import { Overlay } from "../../../components/overlay/index.js";
import { Toast } from "../../../components/toast.js";
import { createPopoverMenu } from "../../../components/overlay/popover_menu.js";

// Импортируем functions
import { startRTCPlayer } from "../functions/start_rtc_player.js";
import { startFLVPlayer } from "../functions/start_flv_player.js";
import { startHLSPlayer } from "../functions/start_hls_player.js";

// Импортируем типы
import type { BroadcastPlay } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * SOURCE_HANDLER - открывает меню выбора источника воспроизведения.
 *
 * Единственный вход в поповер — пункт «Источник видео» меню `...` в шапке
 * (см. handlers/menu.ts).
 *
 * Активный пункт помечается классом `is-active` на самом пункте меню.
 * Стилизовать его селектором от формы нельзя: Overlay монтирует поповер
 * в document.body, то есть вне `.cdm-form.broadcast-play`, поэтому
 * поповер получает собственный класс `cdm-bp-source-menu`
 * (см. css/forms/broadcast-play.css, раздел 5).
 *
 * @param form - Экземпляр формы.
 * @param targetNode - Кнопка-якорь открытия (кнопка меню в шапке).
 *        Если не передана, берётся кнопка меню формы.
 * ***************************************************************************
 */
export async function sourceHandler(form: BroadcastPlay, targetNode?: HTMLElement | null): Promise<void> {

    try {

        // Формы нет — событие пришло уже после закрытия
        if (!form?.tpl) return;

        // Выбирать нечего, пока поток не поднят: start*Player всё равно
        // вернутся по проверке `cast.is_live`, а пустое меню с тремя
        // одинаковыми пунктами хуже, чем отсутствие меню
        if (!form.cast?.stream?.online) return;

        // ---------- ПУНКТЫ ----------
        const menuItems = [

            {
                text: t("forms.broadcast_play.context_menu.play_rtc"),
                iconName: "antenna-bars-5",
                cssClasses: form.typePlay === "rtc" ? ["is-active"] : [],
                onClick: () => startRTCPlayer(form)
            },
            {
                text: t("forms.broadcast_play.context_menu.play_flv"),
                iconName: "player-play",
                cssClasses: form.typePlay === "flv" ? ["is-active"] : [],
                onClick: () => startFLVPlayer(form)
            },
            {
                text: t("forms.broadcast_play.context_menu.play_hls"),
                iconName: "video",
                cssClasses: form.typePlay === "hls" ? ["is-active"] : [],
                onClick: () => startHLSPlayer(form)
            }

        ];

        // ---------- ШАПКА МЕНЮ: ТЕКУЩИЙ ИСТОЧНИК ----------
        // createPopoverMenu принимает готовые узлы и добавляет их как есть —
        // такой узел не несёт onClick и не закрывает поповер по клику
        // (автозакрытие вешается только на пункты с data-popover-item),
        // поэтому подпись текущего протокола остаётся на месте, пока открыто
        const current = document.createElement("div");
        current.setAttribute("data-source-current", "");

        const currentLabel = document.createElement("span");
        currentLabel.setAttribute("data-source-label", "");
        currentLabel.textContent = t("forms.broadcast_play.source_label");

        const currentValue = document.createElement("span");
        currentValue.setAttribute("data-source-current-value", "");
        currentValue.textContent = (form.typePlay || "").toUpperCase();

        current.append(currentLabel, currentValue);

        // ---------- ОТКРЫТИЕ ----------
        const content = createPopoverMenu([current, ...menuItems]);

        // Собственный класс поповера: по нему стилизуется активный пункт
        content.classList.add("cdm-bp-source-menu");

        // Кнопка-якорь по умолчанию — кнопка меню в шапке
        const anchor = targetNode || form.menuButton;

        const popover = new Overlay(content, {
            type: "popover",
            targetNode: anchor,
            targetNodeDirection: "bottom"
        });

        popover.open();

    } catch (error) {

        // Выбор источника — пользовательское действие, ошибка не должна
        // остаться только в консоли
        Logger.error(error);

        new Toast(t("forms.broadcast_play.toasts.source_error"), {
            type: "error",
            duration: 3000,
            position: "top-right"
        });

    }

}
