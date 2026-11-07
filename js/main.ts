// Загружаем locales
import ru from "../locales/ru.json";

// Импортируем сторонние пакеты
import "overlayscrollbars/overlayscrollbars.css";

// Загружаем utils
import { LocalStorage } from "./utils/local_storage.js";
import { Themes } from "./utils/themes.js";
import { Decorations } from "./utils/decorations.js";
import { Logger } from "./utils/logs/logger.js";
import { PlatformBridge } from "./utils/platform.bridge.js";
import { ElectronNotifications } from "./utils/electron_notifications.js";
import { AudioPlayerManager } from "./utils/audio/audio_player.js";
import { Navigation } from "./utils/navigation.js";
import { initNotificationRouter } from "./router/routes.js";

// Загружаем components
import { Tooltip } from "./components/tooltip.js";

// Загружаем forms
import { Sessions } from "./forms/sessions/index.js";
import { Login } from "./forms/login/index.js";
import { BroadcastOnlineChat } from "./forms/broadcast-online-chat/index.js";
import { AppNewVersionAvailable } from "./forms/app-new-version-available/index.js";

// ===========================================================================
// Инициализируем мост, до всяких событий загрузки.
// Таким образом window.updateSafeAreaInsets будет объявлена сразу же.
// ===========================================================================
const precalcSession = LocalStorage.getLastActionSession();
let precalcIsDark = false;

if (precalcSession && precalcSession.settings.user.themes) {
    if (precalcSession.settings.user.themes.color_scheme === "system") {
        precalcIsDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    } else {
        precalcIsDark = precalcSession.settings.user.themes.color_scheme === "dark";
    }
} else {
    precalcIsDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
}

// Запускаем мост на первой же миллисекунде работы JS
PlatformBridge.init({ isDarkTheme: precalcIsDark });

// ***************************************************************************
// Приложение загружено
// ***************************************************************************
window.addEventListener("load", async () => {

    // Проверка запуска онлайн чата для стрима
    const openParams = new URL(`${window.location.protocol}//${window.location.hostname}/${window.location.search}`).searchParams;
    const openBroadcastLiveChat = openParams.get("broadcastOnlineChat");

    // Если открывают чат трансляции
    if (openBroadcastLiveChat) {

        // Открываем форму live чата трансляции
        new BroadcastOnlineChat({
            auth: openBroadcastLiveChat
        });

        return;

    }

    // ==================================

    // Записываем локализацию
    window._lc = ru;

    // Записываем глобальный проигрыватель
    window.audioPlayer = new AudioPlayerManager();

    // ==================================

    // Инициализируем тему
    Themes.initialTheme();

    // Глобальный тултип: делегированные слушатели по data-tooltip
    Tooltip.init();

    // ==================================

    // Удаляем сессии старых версий
    LocalStorage.deleteOldVersionSessions();

    // Получаем сессии
    const sessions = LocalStorage.getAllSessions();

    // Получаем последнюю сессию
    const session = LocalStorage.getLastActionSession();

    // Если была последняя сессия
    if (session) {

        // Получаем значение рут переменной
        const root = document.documentElement;

        // Устанавливаем размер интерфейса
        root.style.setProperty("--interface-size", `${session.settings.user.decorations.interface_size}rem`);

        // Применяем локальные настройки оформления (цвет, скругления, шрифты, плотность)
        Decorations.apply(session);

    }

    // ==================================

    // Проверка сессии
    sessions.length > 0 ? new Sessions() : new Login();

    // ==================================

    // Подписка на клики по нативным уведомлениям Electron: main-процесс
    // фокусирует окно, роутер открывает форму по deep-link (в браузере no-op)
    ElectronNotifications.initClickHandler();

    // Регистрация ServiceWorker
    if ("serviceWorker" in navigator) {
        let refreshing = false;

        // Подписка на клики по push-уведомлениям при открытом приложении:
        // SW шлёт FOCUS_NOTIFICATION_CLICK, роутер открывает нужную форму
        initNotificationRouter();

        // Слушаем событие смены контроллера. 
        // Оно сработает, когда новый SW вызовет self.skipWaiting() и станет активным.
        navigator.serviceWorker.addEventListener("controllerchange", () => {
            if (refreshing) return;
            refreshing = true;
            Logger.debug("[sw]: Контроллер сменился, обновляем страницу для применения новой версии...");
            window.location.reload();
        });

        navigator.serviceWorker
            .register(__SW_FILE_NAME__)
            .then((registration) => {
                Logger.debug("[sw]: зарегистрирован:", registration.scope);

                // Проверка обновлений при загрузке
                registration.onupdatefound = () => {
                    const installingWorker = registration.installing;
                    if (installingWorker == null) return;

                    installingWorker.onstatechange = () => {
                        if (installingWorker.state === "installed") {
                            if (navigator.serviceWorker.controller) {
                                Logger.debug("[sw]: Новая версия загружена.");

                                // Отображаем диалог о новой версии
                                new AppNewVersionAvailable({
                                    callback: (data) => {

                                        // Даем команду новому воркеру немедленно вытеснить старый
                                        if (data === true) {
                                            installingWorker.postMessage({ type: "SKIP_WAITING" });
                                        }

                                    }
                                });

                            } else {
                                Logger.debug("[sw]: Контент закеширован впервые");
                            }
                        }
                    };
                };
            })
            .catch((error) => {
                Logger.error("[sw]: Ошибка при регистрации:", error);
            });
    }

    // ==================================

    // Навигация в приложении
    window.addEventListener("popstate", () => {
        Navigation.popState(history.state);
    });

});
