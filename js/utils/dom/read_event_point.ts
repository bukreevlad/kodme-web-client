/**
 * ***************************************************************************
 * readEventPoint - чтение координат точки из события мыши или касания.
 *
 * GestureController и делегирование отдают слушателям `Event` — конкретный
 * тип события неизвестен, поэтому координаты извлекаем по факту наличия полей,
 * а не через `instanceof TouchEvent`: в окружениях без touch-поддержки
 * (десктопный Safari и др.) глобального конструктора `TouchEvent` нет, и
 * `instanceof` кидает ReferenceError вместо ветвления.
 * @param event - Событие мыши или касания.
 * @returns Координаты точки или null, если координат в событии нет
 *   (пустой changedTouches без clientX — как у touch-события без касаний).
 * ***************************************************************************
 */
export function readEventPoint(event: Event): { x: number; y: number } | null {

    // Мышь: координаты лежат в clientX/clientY
    if (event instanceof MouseEvent) {
        return { x: event.clientX, y: event.clientY };
    }

    // Касание: координаты лежат в changedTouches (первое изменённое касание)
    if ("changedTouches" in event) {

        // invariant: поле changedTouches есть только у touch-событий
        const touches = event.changedTouches as TouchList;
        const touch = touches[0];
        if (!touch) return null;

        return { x: touch.clientX, y: touch.clientY };

    }

    return null;

}
