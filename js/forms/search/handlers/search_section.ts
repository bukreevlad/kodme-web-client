// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { toastError } from "../../../utils/ui/toast_error.js";

// Импортируем config формы
import { SECTIONS } from "../config/sections.js";

// Импортиваем requests
import { sectionRequest } from "../requests/index.js";

// Импортируем functions
import { setSectionState } from "../functions/set_section_state.js";

// Импортируем типы
import type { SectionId } from "../config/sections.js";
import type { Search } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Поиск по одной категории: заменить содержимое вкладки результатами запроса.
 *
 * Замена четырёх файлов `set_type_search_*.js`, которые различались стором и
 * строкой события. Что здесь принципиально:
 *
 * 1. Гонка отменяется номером поиска `seq`. Раньше стор очищался ДО запроса,
 *    а последовательность ответов не проверялась: два клика подряд — и более
 *    старый ответ мог прийти позже и переписать список более нового. Теперь
 *    ответ применяется, только если он последний.
 *
 * 2. Поле остаётся с прошлым запросом, а не пустеет: `form.search` хранит
 *    применённую строку, и догрузка по скроллу едет по ней (а не по «живому»
 *    значению поля ввода — см. functions/load_section.ts).
 *
 * 3. Стор очищается ПОСЛЕ успешного ответа. Раньше `removeAll()` шел до
 *    запроса, и упавший запрос оставлял вкладку пустой навсегда: повторно
 *    нажать «Поиск» пользователь обычно не догадывается.
 *
 * @param form - Экземпляр формы.
 * @param id - Категория ["channels" | "groups" | "users" | "bots"].
 * @param search - Поисковая строка. Если не передана — берётся
 *                            из поля ввода формы.
 * @param seq - Номер поиска на форме. Задаёт вызывающий
 *                         (handlers/search.ts), чтобы категории одного поиска
 *                         не гасили друг друга. Если не передан — берётся
 *                         следующий номер.
 * @returns true, если результаты применены.
 ***************************************************************************
 */
export async function searchSectionHandler(form: Search, id: SectionId, search?: string, seq?: number): Promise<boolean> {

    const section = SECTIONS[id];
    if (!form || !section) return false;

    const store = form.stores[id];
    if (!store) return false;

    // Применённая строка: пустая тоже осмысленна («показать всех»)
    const value = (search ?? form?.text?.value ?? "").trim();

    // Счётчик относится ко ВСЕМУ поиску, а не к категории. Когда его увеличивал
    // сам SearchSection, четыре параллельные категории гасили друг друга: к
    // моменту ответа счётчик уже был на 4, поэтому применялся только последний
    // ответ, а остальные три вкладки молча оставались со старыми данными.
    // Номер поиска задаёт вызывающий (handlers/search.ts). Если не передан —
    // считаем, что это отдельная точечная перезагрузка вкладки
    if (typeof seq !== "number") {
        form.searchSeq = (form.searchSeq || 0) + 1;
        seq = form.searchSeq;
    }

    // Пока идёт запрос — вкладка показывает «Загрузка...», а не пустоту
    setSectionState(form, id, "loading");

    try {

        const response = await sectionRequest(id, { search: value });

        // Пока летел запрос, пользователь нажал «Поиск» ещё раз или закрыл
        // форму: этот ответ уже неактуален
        if (seq !== form.searchSeq || form.isClosed) return false;

        // Неожиданный ответ: НЕ чистим стор и не показываем пустоту —
        // раньше не-массив молча обрушивал вкладку в «ничего не найдено»
        if (!Array.isArray(response?.data)) {
            Logger.error(`[app][search][search-section][${id}]: в ответе нет массива`, response);
            setSectionState(form, id, "error");
            return false;
        }

        // Чистим стор только сейчас: при упавшем запросе вкладка сохраняет
        // прежние результаты вместо пустоты
        store.removeAll();

        for (const item of response.data) {
            if (!item?.id) continue;
            store.add(item);
        }

        // Запоминаем применённый запрос: по нему поедет догрузка
        form.search = value;

        // Состояние пагинации новой первой страницы: side next открыт по
        // has_more, prev закрыт (см. functions/first_loaded.ts)
        const state = form.pagination[id];
        state.firstLoaded = true;
        state.hasMorePrev = false;
        state.hasMoreNext = response.has_more === true;

        setSectionState(form, id, store.size ? null : "empty");

        return true;

    } catch (error) {

        // Поздняя ошибка неактуальна: пользователь ушёл или уже ищет заново
        if (seq !== form.searchSeq || form.isClosed) return false;

        Logger.error(`[app][search][search-section][${id}]:`, error);

        setSectionState(form, id, "error");

        toastError(error, {
            context: `[app][search][search-section][${id}]`,
            codes: ["INVALID_OFFSET", "INVALID_USER_ID", "USER_ID_REQUIRED"],
            fallback: t("forms.search.toasts.search_error")
        });

        return false;

    }

}
