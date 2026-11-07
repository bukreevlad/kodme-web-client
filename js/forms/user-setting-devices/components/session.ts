// Импортируем сторонние пакеты
import Bowser from "bowser";

// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { Icons } from "../../../utils/icons.js";
import { TimeAgoFormatter } from "../../../utils/date/time_ago_formatter.js";

// Импортируем functions
import { getDeviceIcon } from "../functions/get_device_icon.js";

// Импортируем components
import { Avatars } from "../../../components/avatars.js";
import { Buttons } from "../../../components/buttons.js";

// Импортируем handlers
import { removeSessionHandler } from "../handlers/remove.js";

// Импортируем типы
import type { UserSettingDevices } from "../index.js";
import type { SessionListItem } from "../types.js";

/**
 * ***************************************************************************
 * createSessionItem - строка сессии (устройства) в списке.
 *
 * Показывает аватар с иконкой устройства (по user-agent), название
 * платформы/браузера (парсится из user-agent) и время последней активности.
 * Кнопка «удалить» открывает диалог подтверждения и удаляет сессию.
 *
 * Фабрика возвращает готовый DOM-элемент (легаси-конструктор возвращал
 * элемент вместо this — в TS такой паттерн не типизируется честно):
 * `createSessionItem(form, data)`.
 *
 * @param form - Экземпляр формы устройств.
 * @param data - Данные сессии.
 * @returns Готовый DOM-элемент строки.
 * ***************************************************************************
 */
export function createSessionItem(form: UserSettingDevices, data: SessionListItem): HTMLElement {

    // Записываем данные: setup обновляет ссылку, как раньше это делал this.data
    let current = data;

    // Создаем DOM-элемент из шаблона
    const element = template();

    // Записываем ссылку на dom элемент (для удаления копий при item::removed)
    if (!current.__domElements__) {
        current.__domElements__ = [];
    }
    current.__domElements__.push(element);

    // Устанавливаем начальные данные
    setup(current);

    // Прикрепляем обработчики событий
    actions();

    // Возвращаем сам элемент для вставки в DOM
    return element;

    /**
     * ***************************************************************************
     * Шаблон элемента: DOMParser создаёт DOM без innerHTML.
     * @returns DOM-элемент строки.
     * ***************************************************************************
     */
    function template(): HTMLElement {

        // invariant: шаблон выше — наши строки, .item в нём всегда есть
        return new DOMParser().parseFromString(`
            <div class="item flex flex-row items-center gap-2.5 p-2.5 rounded-lg bg-[var(--second-bg)]/40 transition-all duration-200 hover:bg-[var(--second-bg)] select-none">
                <div class="cdm-avatar relative shrink-0"></div>
                <div class="flex flex-col gap-0.5 justify-center min-w-0 flex-1">
                    <span class="platform font-semibold text-sm truncate"></span>
                    <span class="last-action-at text-xs text-muted truncate"></span>
                </div>
                ${Buttons.transparent({
            intent: "transparent",
            shape: "circle",
            attributes: ["action-remove"],
            icon: "trash"
        })}
            </div>
        `, "text/html").querySelector<HTMLElement>(".item")!;

    }

    /**
     * ***************************************************************************
     * Установка/Перерисовка данных.
     * @param next - Новые данные сессии.
     * ***************************************************************************
     */
    function setup(next: SessionListItem): void {

        try {

            // Сохраняем актуальные данные
            current = next;

            // Устанавливаем элементы: invariant — все классы ниже есть в шаблоне
            let avatar = element.querySelector<HTMLElement>(".cdm-avatar");
            let platform = element.querySelector<HTMLElement>(".platform");
            let lastActionAt = element.querySelector<HTMLElement>(".last-action-at");

            // Название устройства: парсим user-agent («ОС (браузер)»).
            // Пустой user-agent парсер отклоняет — такое бывает у сессий,
            // созданных до сохранения user-agent в БД, — тогда показываем
            // platform из ответа сервера
            let osName: string | null = null;
            let browserName: string | null = null;
            if (next.user_agent) {
                let userAgent = Bowser.parse(next.user_agent);
                osName = userAgent.os.name ?? null;
                browserName = userAgent.browser.name ?? null;
            }
            if (platform) platform.textContent = osName && browserName ? `${osName} (${browserName})` : (osName ?? next.platform ?? "");

            // Парсим last_action_at
            let timeAgo = new TimeAgoFormatter(next.last_action_at, "short");
            if (lastActionAt) lastActionAt.textContent = timeAgo.formattedTime || window._lc.forms.user_setting_devices.not_in_online;

            // Аватар: иконка устройства из user-agent (md — компактнее
            // дефолтного lg и совпадает с двойником-формой sessions)
            new Avatars({
                element: avatar,
                id: browserName ?? next.platform ?? "",
                name: browserName ?? next.platform ?? "",
                icon: getDeviceIcon(next.user_agent, next.platform),
                size: "md"
            });

        } catch (error) {
            Logger.error(error);
        }

    }

    /**
     * ***************************************************************************
     * Обработчики: удаление сессии через диалог подтверждения.
     * ***************************************************************************
     */
    function actions(): void {

        // Удалить
        let remove = element.querySelector("[action-remove]");
        remove?.addEventListener("click", () => removeSessionHandler(form, current));

    }

}
