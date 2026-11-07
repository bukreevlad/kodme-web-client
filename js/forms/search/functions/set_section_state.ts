// Импортируем components
import { EmptyState } from "../../../components/empty_state.js";

// Импортируем config
import { SECTIONS } from "../config/sections.js";

// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем типы
import type { SectionId } from "../config/sections.js";
import type { SectionState } from "../types.js";
import type { Search } from "../index.js";

/**
 * ***************************************************************************
 * Текстовые состояния вкладки поиска и ключи для них.
 * Ключи берём из locales/ru.json → forms.search.states
 *
 * «Пусто» в словарь не входит: оно рисуется компонентом EmptyState с
 * иконкой и подписями своей вкладки (см. setSectionState).
 ***************************************************************************
 */
const STATES = {
    loading: ["states", "loading"],
    error: ["states", "error"]
} as const;

/**
 * ***************************************************************************
 * Служебное состояние вкладки поиска: «загрузка», пустой результат или
 * «не удалось загрузить» либо его отсутствие.
 *
 * Зачем: список вкладки пуст сразу после открытия формы (данные грузятся
 * неблокирующе, см. first_loaded.ts), и без подписи пользователь не мог
 * отличить три разных ситуации — «ищу», «ничего не нашлось» и «сервер недоступен».
 * Плюс это единственный способ сообщить об ошибке вкладки: тост показывается
 * один раз, а вкладка остаётся на экране.
 *
 * «Пусто» показываем компонентом EmptyState (круг с иконкой вкладки,
 * заголовок и описание из локали) — раньше на все четыре категории шла одна
 * строка «ничего не найдено» без визуального различия. Как и на остальных
 * формах, заглушка идёт сверху списка с естественной высотой: блок состояния
 * лежит в потоке панели, поэтому при смене состояния ничего не прыгает
 * по вертикали.
 *
 * Видимость переключается парой hidden/flex, а не hidden вместе с
 * display-утилитой в статичных классах: в собранном CSS display-утилиты идут
 * по алфавиту, и `.hidden` побеждает `.flex`, так что связка работает
 * предсказуемо в обе стороны.
 *
 * @param form - Экземпляр формы.
 * @param name - Имя категории ["channels" | "groups" | "users" | "bots"].
 * @param state - Состояние ["loading" | "empty" | "error"].
 *                null — скрыть блок (в списке есть данные).
 * @returns true, если блок найден и обновлён.
 ***************************************************************************
 */
export function setSectionState(form: Search, name: SectionId, state: SectionState | null): boolean {

    // Форма уже закрыта или шаблона нет — трогать нечего
    if (!form?.tpl) return false;

    const element = form.tpl.querySelector<HTMLElement>(`:scope [data-state="${name}"]`);
    if (!element) return false;

    try {

        // Состояния нет — прячем блок, данные на месте; textContent чистит
        // и вложенный EmptyState, если он был показан
        if (!state) {
            element.classList.add("hidden");
            element.classList.remove("flex");
            element.textContent = "";
            return true;
        }

        // Пусто — компонент с иконкой вкладки вместо строки «Ничего не найдено»
        if (state === "empty") {

            const locale = window._lc?.forms?.search?.empty?.[name];

            element.replaceChildren(EmptyState.create({
                // Фолбэк для новой категории без перевода: заглушка не может
                // остаться пустой
                title: locale?.title || window._lc?.forms?.search?.states?.not_found || "",
                description: locale?.desc,
                icon: SECTIONS[name].emptyIcon,
                compact: true
            }).dom);
        }

        // Текстовые состояния: путь задан массивом, а не строкой
        // "states.loading": обращение через точку не сработает, так как
        // в локализации states — вложенный объект
        else if (state === "loading" || state === "error") {
            const texts = window._lc?.forms?.search;
            const [group, key] = STATES[state];
            element.textContent = texts?.[group]?.[key] || "";
        }

        // Неизвестное состояние (мусор вне типов) — не показываем
        else {
            element.classList.add("hidden");
            element.classList.remove("flex");
            element.textContent = "";
            return true;
        }

        element.classList.remove("hidden");
        element.classList.add("flex");

        return true;

    } catch (error) {
        Logger.error(`[app][search][set-section-state][${name}]:`, error);
        return false;
    }

}
