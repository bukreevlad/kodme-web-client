# Форма сообщений (`js/forms/messages`)

Документ описывает устройство формы чата: потоки данных, формат вложений, порядок
отправки и правила, по которым здесь добавляются хендлеры и утилиты.

---

## 1. Структура

```
js/forms/messages/
  index.ts                 # Каркас формы (жизненный цикл + состояние)
  handlers/                # Действия по событиям: клики, paste, drag&drop
  functions/               # Вспомогательная логика формы (загрузка, скролл, реакции)
  requests/                # Запросы к API через сокет (пробрасывают ошибку наружу)
  components/              # Классы элементов сообщения (message, attaches_*, reactions)
    functions/             # Общие сборщики превью и рендер-плагины markdown
    handlers/              # Действия внутри компонента сообщения
    requests/              # Запросы из компонента сообщения
    dialogs/               # Вложенные диалоги (подтверждение перехода по ссылке)
  events/
    store/                 # Подписки на события Store (добавление/удаление/обновление)
```

Правило скелета формы: в `index.ts` живут только `constructor`, `_init`, `_open`,
`_template`, `_onBeforeOpen`, `_onOpen`, `_handlers`, `update`, `_onBeforeClose`.
Всё остальное — в подпапках и вызывается из нужной точки жизненного цикла.

## 2. Состояние формы

| Поле | Назначение |
|---|---|
| `store` | Сообщения в окне чата (`utils/store.ts`, окно 300 элементов) |
| `channel` / `channelId` | Данные канала, из которого считается непрочитанное |
| `textarea`, `textareaAutosize` | Поле ввода и его авторазмер |
| `tempMessage` | Черновик (local_id + неотправленные вложения) |
| `pendingIds` | Id отправляемых сообщений, ожидающих ack |
| `uploadAbort` | `AbortController` цикла загрузки вложений |
| `pendingAcks` | Ожидания ack-ответа: `Map<string, PendingAck>` (резолвер на форме; промисы живут в модульной карте `functions/sending_messages.ts`) |
| `lastViewedBatcher` | Батчер отметки «прочитано до» |
| `reactionsUpdater` | Менеджер поллинга реакций |
| `dragAndDrop` | Функция отписки drag&drop |
| `storeUnsubs` | Отписки от событий Store |

Всё, что нужно погасить при закрытии, гасится в `_onBeforeClose()`:
отписки Store, `uploadAbort.abort()`, `pendingAcks`, батчер, поллинг реакций,
drag&drop, подписчики жестов микрофона. Гард параллельного цикла отправки
(форм-scoped, чтобы несколько открытых чатов не блокировали друг друга)
живёт не полем формы, а модульным `WeakSet` внутри
`functions/sending_messages.ts`.

## 3. Формат вложений — главный источник багов

`attachments` приходит в двух формах:

- **Array** — от сервера (`services/messages/components/get_data.js`);
- **object-map** — у локальных temp/pending сообщений, ключ = `temp_id`,
  после получения presigned URL — `document_id`.

Поэтому **никогда** не пишите `attachments.forEach` / `Object.keys(attachments)` /
`attachments?.length > 0` напрямую. Используйте нормализатор:

```ts
import * as Attachments from "../../../utils/messages/attachments.js";

const list = Attachments.normalize(message.attachments); // всегда Array
const keys = Attachments.toKeys(message.attachments);    // id/temp_id/document_id
if (Attachments.isNotEmpty(message.attachments)) { /* ... */ }
const map = Attachments.toServerMap(message.attachments); // форма для [message]: send
```

Тип вложения (изображение / аудио / голосовое / видео / кружок / документ)
определяйте через `utils/messages/attach_classifier.ts`, а не сравнением
`mime_type` вручную: он учитывает и `mime_type`/`type`, и метадату кружков.

Ссылки на файлы собирайте через `utils/network/storage_url.ts` —
он использует `location.origin` (с портом) и единообразно добавляет
`?size=`/`?hls=`.

## 4. Поток отправки

```
handlers/create_message.ts
  └─ MessageValidator.canSend(...)            # синхронная проверка ДО создания
  └─ создание temp/pending сообщения (UUID v7) → IndexedDB + Store
  └─ ScrollManager.restoreAnchor / скролл вниз
      └─ functions/sending_messages.ts  (цикл по form.pendingIds)
          ├─ для каждого вложения:
          │    getUploadAttachURLRequest        # presigned URL + limits
          │    setLimits(...)                   # лимиты с сервера
          │    uploadDerivedAssets              # оригинал (превью строит сервер)
          ├─ сверка полноты набора
          └─ createMessageRequest               # [message]: send
               └─ registerPendingAck(localId)   # ждём push [message]: new
```

Особенности:

- очередь останавливается на сетевой ошибке, но **продолжается** на валидационной;
- отмена загрузки (`UPLOAD_ABORTED`) — не ошибка, цикл идёт к следующему файлу;
- **сообщение не отправляется с неполным набором вложений**: после цикла
  сверяется, что у каждого оставшегося вложения есть `document_id`. Иначе
  получатель увидел бы сообщение без части файлов без всякого статуса ошибки;
- гонки «эхо пришло раньше ack» больше нет: обработчик пуша
  `forms/main/events/socket/messages/new.ts` ждёт `awaitPendingAcks(form)`
  вместо `setTimeout(300)`.

## 4.1. Лимиты и типы файлов — берутся с сервера

Лимиты **не хардкодятся в клиенте**. Ответ `[message]: get upload attach url`
содержит:

```json
{ "url": "...", "document_id": "...", "limits": {
    "max_size_bytes": 524288000,
    "max_files": 10,
    "max_file_name_length": 255,
    "file_types": {
        "image":    { ".jpg": { "mimes": ["image/jpeg", "image/jpg"], "default": "image/jpeg" }, "...": "..." },
        "video":    { "...": "..." },
        "audio":    { "...": "..." },
        "document": { "...": "..." },
        "archive":  { "...": "..." },
        "font":     { "...": "..." },
        "model":    { "...": "..." },
        "other":    { "...": "..." }
    }
} }
```

`file_types` — единый справочник типов файлов целиком, а не производные
плоские списки. Клиент выводит из него те же таблицы, что и сервер
(`EXTENSION_TYPES`, `KIND_MIMES`, `ALLOWED_EXTENSIONS`, `MIME_EXTENSIONS`),
поэтому две копии разойтись не могут. Отдельного `allowed_extensions` в
ответе нет — держать и список, и справочник значило бы снова получить две
копии, которые молча расходятся (так и было: `.bmp`, `.avif`, `.heic`
проходили валидацию, но не считались изображениями, и вложение не
отрисовывалось).

Клиент подхватывает лимиты в `js/utils/validation/upload_limits.ts`
(`setLimits`), который внутри вызывает
`config/file_types.ts → setFileTypes(...)`. Дальше все проверки идут по
актуальным значениям:

| Проверка | Модуль |
|---|---|
| расширение, размер, MIME↔расширение | `utils/validation/file_validator.ts` |
| тип вложения (`isKind`, `getKind`) | `config/file_types.ts` |
| количество вложений, длина текста, символы | `utils/validation/message_validator.ts` |
| отсечение лишнего при импорте | `functions/import_attaches.ts` |

До первого ответа сервера работает локальный фолбэк внутри
`js/config/file_types.ts` — он совпадает с серверным на момент сборки,
поэтому пользователь не увидит отказ раньше времени. Числовые лимиты
(`MESSAGES_MAX_FILE_SIZE`, `MESSAGES_MAX_ATTACHMENTS`) остались в
`js/config/constants.ts` как дефолт.

Проверки выполняются **до** тяжёлой генерации метадаты (декодирование кадра
в canvas — это секунды на видео), поэтому файл с запрещённым расширением
или больше лимита отсекается мгновенно, а не после нескольких секунд ожидания.

Сервер проверяет то же самое повторно: клиентская проверка — это UX,
серверная — единственная, которую нельзя обойти.

## 4.2. Разрешённые символы сообщения

Клиент и сервер используют один и тот же набор Unicode-категорий:

```
[\p{L}\p{M}\p{N}\p{P}\p{S}\p{Zs}‌‍\u{E0020}-\u{E007F}]
```

- буквы любой письменности (кириллица, иероглифы, арабский, хинди);
- эмодзи, включая ZWJ-последовательности (`👨‍👩‍👧`) и флаги с тегами;
- **не проходят**: невидимые символы (`\p{Cf}`: bidi-override, ZWSP, BOM) —
  ими прячут текст в сообщении.

Клиентская регулярка — `js/utils/validation/message_validator.ts`
(`MESSAGES_TEXT_REGEX`); серверная регулярка должна совпадать с ней
дословно, иначе сервер будет отклонять сообщения, прошедшие клиентскую
проверку.

Длина считается через `[...text]` / `Array.from(text)`: эмодзи занимает
один символ, а не два UTF-16 code units, поэтому лимит 4096 для текста
из эмодзи не «расходуется» вдвое быстрее.

## 5. Прочтение и реакции

- `functions/intersection.ts` — единственный источник событий видимости:
  реакции (`form.reactionsUpdater.track`) и отметка о прочтении.
- Отметка о прочтении **не отправляется сразу**: `LastViewedBatcher` копит
  максимальный `messageId` и отправляет один запрос не чаще раза в 700 мс
  (`[channel-member]: update last viewed message`). Счётчик непрочитанных
  уменьшается на число реально прочитанных сообщений, а не на единицу.
- Реакции сервер в пуш не отдаёт, поэтому `ReactionsUpdater` опрашивает
  `[message]: get reactions` раз в 4 секунды по видимым сообщениям
  (чанками по 100 id). Ответ применяется и в DOM, и в IndexedDB.

## 6. Ошибки API

Ошибки разбираются **по кодам**, а не по подстрокам в тексте:

```ts
import { parseError } from "../../../utils/network/parse_error.js";
import { toastError } from "../../../utils/ui/toast_error.js";

try {
    await SomeRequest(data);
} catch (error) {
    const info = parseError(error);
    if (info.isAccessDenied) { /* ... */ }
    if (info.isRateLimit) { /* ... */ }
    toastError(error, { context: "[app][messages][some-action]" });
}
```

`parseError` разбирает серверный формат `ИМЯ :: код` (например
`ACCESS_DENIED :: 108800`) и HTTP-обёртку `Ошибка 404: <текст>`.

`toastError` сам подбирает текст: код из `options.codes` → локализация по имени
ошибки (`api.errors.*`) → текст сервера → `api.errors.server_error`.

Запрещено: `catch` с одним `Logger.error(error)` для пользовательского действия —
пользователь должен увидеть тост. Исключение — фоновые задачи (поллинг реакций),
которые логируют с пометкой и повторятся в следующем цикле.

## 7. Как добавлять хендлер

1. Положите файл в `handlers/` (действие формы) или `components/handlers/`
   (действие внутри сообщения). Сигнатура: `export async function <camel>Handler(form) {...}`
   (named-экспорт, имя по camelCase файла).
2. Подключите его в `_handlers()` файла формы / в `_handlers` компонента.
3. Запрос выносите в `requests/`: модуль **только отправляет** и
   `throw error` — обработка ошибки в `handlers/`.
4. Тексты тостов — только через `locales/ru.json` (`t()`).
5. Логи — через `Logger` с контекстом вида `[app][messages][что-делаем]`.

## 8. Тесты

```bash
bun test            # все тесты
bun test tests/     # только каталог tests
```

Покрыты чистые модули (без DOM):

| Файл | Что проверяет |
|---|---|
| `tests/attachments.test.js` | `Attachments.normalize/isNotEmpty/toKeys/count` — двойной формат |
| `tests/errors_and_validator.test.js` | `parseError`, `toastError`-совместимость, `MessageValidator`, классификация ошибок |
| `tests/validation_and_utils.test.js` | `FileValidator`, `StorageUrl`, `AttachClassifier`, `Debounce`/`Throttle` |
| `tests/limits_and_sync.test.js` | `UploadLimits` и **совпадение клиентского/серверного набора символов** |

Последний важен: сервер лежит в соседнем репозитории и не является зависимостью
клиента, поэтому его регулярка вклеена в тест вручную. Если измените одну
сторону — тест упадёт и напомнит про вторую.
