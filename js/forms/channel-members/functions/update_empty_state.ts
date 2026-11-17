// Импортируем components
import { syncListState } from "../../../components/empty_state.js";

// Импортируем типы
import type { ChannelMembers } from "../index.js";

/**
 * ***************************************************************************
 * Переключение пустого состояния списка.
 *
 * Обёртка над общим хелпером `syncListState`: пустота показывается только
 * после первой загрузки — иначе «нет участников» смешалось бы с «ещё не
 * загрузилось».
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function updateEmptyState(form: ChannelMembers): void {

    syncListState(
        { list: form.list, empty: form.empty },
        { loaded: form.isFirstLoaded === true, count: form.store.size }
    );

}
