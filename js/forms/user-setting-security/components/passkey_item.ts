// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { Icons } from "../../../utils/icons.js";
import { TimeAgoFormatter } from "../../../utils/date/time_ago_formatter.js";

// Импортируем components
import { Buttons } from "../../../components/buttons.js";

// Импортируем handlers
import { renamePasskeyHandler } from "../handlers/rename_passkey.js";
import { removePasskeyHandler } from "../handlers/remove_passkey.js";

// Импортируем типы
import type { UserSettingSecurity } from "../index.js";
import type { PasskeyListItem } from "../types.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * createPasskeyItem - строка ключа доступа (Passkey) в списке.
 *
 * Показывает имя ключа, время регистрации и последнего использования.
 * Кнопки «переименовать» и «удалить» управляют ключом (удаление —
 * через диалог подтверждения).
 *
 * Фабрика возвращает готовый DOM-элемент (паттерн createSessionItem
 * формы устройств): `createPasskeyItem(form, data)`.
 *
 * @param form - Форма безопасности.
 * @param data - Данные ключа доступа.
 * @returns Готовый DOM-элемент строки.
 * ***************************************************************************
 */
export function createPasskeyItem(form: UserSettingSecurity, data: PasskeyListItem): HTMLElement {

    // Записываем данные: setup обновляет ссылку, как в компоненте сессий
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
            <div class="item flex flex-row items-center gap-3 p-3 rounded-lg bg-[var(--second-bg)]/40 transition-all duration-200 hover:bg-[var(--second-bg)] select-none">
                <div class="flex items-center justify-center shrink-0 w-10 h-10 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                    ${Icons.icon("key", { settings: { size: 20 } })?.outerHTML ?? ""}
                </div>
                <div class="flex flex-col gap-0.5 justify-center min-w-0 flex-1">
                    <span class="name font-semibold text-sm truncate"></span>
                    <span class="meta text-xs text-muted truncate"></span>
                </div>
                ${Buttons.transparent({
            intent: "transparent",
            shape: "circle",
            attributes: ["action-rename"],
            icon: "pencil"
        })}
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
     * @param next - Новые данные ключа.
     * ***************************************************************************
     */
    function setup(next: PasskeyListItem): void {

        try {

            // Сохраняем актуальные данные
            current = next;

            // Устанавливаем элементы: invariant — все классы ниже есть в шаблоне
            let name = element.querySelector<HTMLElement>(".name");
            let meta = element.querySelector<HTMLElement>(".meta");

            // Имя ключа
            if (name) name.textContent = next.name;

            // Мета: время регистрации и последнего использования
            if (meta) {

                // Время регистрации
                let createdAt = new TimeAgoFormatter(next.created_at, "short");
                let parts = [`${t("forms.user_setting_security.passkey_created")}: ${createdAt.formattedTime || "-"}`];

                // Последнее использование (если ключ уже применялся)
                if (next.last_used_at) {
                    let lastUsedAt = new TimeAgoFormatter(next.last_used_at, "short");
                    parts.push(`${t("forms.user_setting_security.passkey_last_used")}: ${lastUsedAt.formattedTime || "-"}`);
                }

                meta.textContent = parts.join(" · ");

            }

        } catch (error) {
            Logger.error(error);
        }

    }

    /**
     * ***************************************************************************
     * Обработчики: переименование и удаление ключа доступа.
     * ***************************************************************************
     */
    function actions(): void {

        // Переименовать
        let rename = element.querySelector("[action-rename]");
        rename?.addEventListener("click", () => renamePasskeyHandler(form, current, element));

        // Удалить
        let remove = element.querySelector("[action-remove]");
        remove?.addEventListener("click", () => removePasskeyHandler(form, current));

    }

}
