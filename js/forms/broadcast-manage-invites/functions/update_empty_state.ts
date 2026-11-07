// Импортируем components
import { syncListState } from "../../../components/empty_state.js";

// Импортируем типы
import type { BroadcastManageInvites } from "../index.js";

/**
 * ***************************************************************************
 * Переключение пустого состояния списка.
 *
 * Тонкая обёртка над общим хелпером `syncListState`: логика «список ↔ пусто ↔
 * скелетон» живёт в модуле компонента `EmptyState`, форма только передаёт
 * свои узлы и данные первой загрузки. Пустота показывается только после
 * первой загрузки — иначе «нет записей» смешалось бы с «ещё не загрузилось».
 *
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function updateEmptyState(form: BroadcastManageInvites): void {

    syncListState(
        { list: form.list, empty: form.empty },
        { loaded: form.isFirstLoaded === true, count: form.store.size }
    );

}
