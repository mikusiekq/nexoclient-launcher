import React, { createContext, useContext, useState } from 'react';

type Lang = 'pl' | 'en';

interface LanguageContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
}

const translations: Record<Lang, Record<string, string>> = {
  pl: {
    // Navbar
    'nav.home': 'Strona Główna',
    'nav.profiles': 'Profile',
    'nav.skins': 'Skiny',
    'nav.accounts': 'Konta',
    'nav.settings': 'Ustawienia',
    'nav.manage_accounts': 'Zarządzaj kontami',
    'nav.logout': 'Wyloguj się',
    'nav.accounts_label': 'Konta',
    'nav.tooltip_add_account': 'Najpierw dodaj konto',
    'nav.tooltip_create_profile': 'Utwórz najpierw profil',
    'nav.discord_tooltip': 'Dołącz do naszego Discorda',

    // Footer
    'footer.version': 'Wersja v1.0',
    'footer.credits': 'Stworzony z ❤️ dla graczy',
    'footer.status': 'Wszystkie systemy działają stabilnie',

    // Home View
    'home.play': 'URUCHOM GRĘ',
    'home.login_to_play': 'ZALOGUJ SIĘ, ABY GRAĆ',
    'home.need_profile': 'UTWÓRZ PROFIL, ABY GRAĆ',
    'home.game_running': 'GRA URUCHOMIONA',
    'home.launching': 'URUCHAMIANIE...',
    'home.logs_console': 'KONSOLA LOGÓW',
    'home.clear_logs': 'Wyczyść',
    'home.hide_console': 'Ukryj konsolę',
    'home.show_console': 'Pokaż konsolę',
    'home.server_status': 'STATUS SERWERA',
    'home.partners': 'PARTNERZY PROJEKTU',
    'home.players': 'GRACZY',
    'home.online': 'ONLINE',
    'home.offline': 'OFFLINE',
    'home.latest_version': 'Najnowsza wersja',
    'home.active_profile': 'Aktywny profil',
    'home.no_profile_active': 'Brak aktywnego profilu',

    // Skins View
    'skins.title': 'SKINY',
    'skins.subtitle': 'Dostosuj i wybierz wygląd swojej postaci w grze',
    'skins.preview_3d': 'Podgląd 3D',
    'skins.movement': 'Ruch',
    'skins.idle': 'Stanie',
    'skins.walk': 'Marsz',
    'skins.run': 'Bieg',
    'skins.auto_rotate': 'Auto-obracanie',
    'skins.apply': 'Zastosuj skin',
    'skins.equipped': 'Wyposażony',
    'skins.add_new': 'Dodaj nowy skin',
    'skins.from_computer': 'Z komputera',
    'skins.by_nickname': 'Pobierz z nicku',
    'skins.choose_file': 'Wybierz plik PNG skina',
    'skins.dimensions_hint': 'Wymiary 64x64 lub 64x32 pikseli',
    'skins.skin_name': 'Nazwa skina',
    'skins.model_type': 'Typ Modelu',
    'skins.classic': 'Classic (Steve)',
    'skins.slim': 'Slim (Alex)',
    'skins.fetch_nick': 'Wpisz nick gracza Minecraft...',
    'skins.download': 'Pobierz',
    'skins.library': 'Biblioteka skinów',
    'skins.default': 'Domyślny',
    'skins.delete': 'Usuń skin',
    'skins.status.setting': 'Ustawianie skina w oficjalnym API Mojang...',
    'skins.status.success': 'Pomyślnie wyposażono skin i zaktualizowano w API Mojang!',

    // Accounts View
    'accounts.title': 'KONTA',
    'accounts.subtitle': 'Zarządzaj swoimi kontami Minecraft',
    'accounts.add_offline': 'Dodaj konto Offline',
    'accounts.add_microsoft': 'Dodaj konto Microsoft',
    'accounts.enter_nick': 'Nazwa gracza (Nick)',
    'accounts.confirm_add': 'Dodaj konto',
    'accounts.confirm_loading': 'Dodawanie...',
    'accounts.your_accounts': 'TWOJE KONTA',
    'accounts.no_accounts': 'Brak zapisanych kont',
    'accounts.no_accounts_hint': 'Dodaj konto Offline lub Microsoft aby rozpocząć grę',
    'accounts.active': 'Aktywne',
    'accounts.use': 'Użyj',

    // Settings View
    'settings.title': 'USTAWIENIA',
    'settings.subtitle': 'Konfiguracja launchera i gry',
    'settings.saved': 'Zapisano',
    'settings.ram_title': 'Pamięć RAM',
    'settings.ram_desc': 'Ilość pamięci przydzielonej dla gry',
    'settings.java_title': 'Środowisko Java',
    'settings.java_desc': 'Wersja Java użyta do uruchomienia gry',
    'settings.scan': 'Skanuj',
    'settings.java_browse': 'Wybierz plik ręcznie...',
    'settings.game_dir': 'Katalog gry',
    'settings.game_dir_desc': 'Folder plików .nexoclient',
    'settings.change': 'Zmień',
    'settings.main_folder': 'Główny folder',
    'settings.main_folder_desc': 'Pliki gry i konfiguracja',
    'settings.mods_folder': 'Mody',
    'settings.mods_folder_desc': 'Modyfikacje Fabric',
    'settings.resourcepacks_folder': 'Paczki zasobów',
    'settings.resourcepacks_folder_desc': 'Tekstury i dźwięki',

    // Profiles View
    'profiles.title': 'PROFILE',
    'profiles.subtitle': 'Zarządzaj wersjami i modyfikacjami gry',
    'profiles.create_new': 'Utwórz nowy profil',
    'profiles.profile_name': 'Nazwa profilu',
    'profiles.version': 'Wersja gry',
    'profiles.mods_pack': 'Paczka modów',
    'profiles.vanilla': 'Czysty Minecraft (Vanilla)',
    'profiles.optimization': 'Optymalizacja (Sodium, Iris, itp.)',
    'profiles.create': 'Utwórz profil',
    'profiles.list': 'TWOJE PROFILE',
    'profiles.no_profiles': 'Brak utworzonych profilów',
    'profiles.no_profiles_hint': 'Utwórz swój pierwszy profil gry, wybierając wersję i paczkę modów',
    'profiles.mods': 'Mody',
    'profiles.launch': 'Graj',
    'profiles.delete': 'Usuń',
    'profiles.edit_mods': 'Modyfikuj mody',
  },
  en: {
    // Navbar
    'nav.home': 'Home',
    'nav.profiles': 'Profiles',
    'nav.skins': 'Skins',
    'nav.accounts': 'Accounts',
    'nav.settings': 'Settings',
    'nav.manage_accounts': 'Manage accounts',
    'nav.logout': 'Log Out',
    'nav.accounts_label': 'Accounts',
    'nav.tooltip_add_account': 'First add an account',
    'nav.tooltip_create_profile': 'First create a profile',
    'nav.discord_tooltip': 'Join our Discord',

    // Footer
    'footer.version': 'Version v1.0',
    'footer.credits': 'Made with ❤️ for players',
    'footer.status': 'All systems running stable',

    // Home View
    'home.play': 'LAUNCH GAME',
    'home.login_to_play': 'LOG IN TO PLAY',
    'home.need_profile': 'CREATE PROFILE TO PLAY',
    'home.game_running': 'GAME RUNNING',
    'home.launching': 'LAUNCHING...',
    'home.logs_console': 'LOG CONSOLE',
    'home.clear_logs': 'Clear',
    'home.hide_console': 'Hide console',
    'home.show_console': 'Show console',
    'home.server_status': 'SERVER STATUS',
    'home.partners': 'PROJECT PARTNERS',
    'home.players': 'PLAYERS',
    'home.online': 'ONLINE',
    'home.offline': 'OFFLINE',
    'home.latest_version': 'Latest release',
    'home.active_profile': 'Active profile',
    'home.no_profile_active': 'No active profile',

    // Skins View
    'skins.title': 'SKINS',
    'skins.subtitle': 'Customize and select your character appearance in game',
    'skins.preview_3d': '3D Preview',
    'skins.movement': 'Animation',
    'skins.idle': 'Idle',
    'skins.walk': 'Walk',
    'skins.run': 'Run',
    'skins.auto_rotate': 'Auto-Rotate',
    'skins.apply': 'Apply skin',
    'skins.equipped': 'Equipped',
    'skins.add_new': 'Add new skin',
    'skins.from_computer': 'From computer',
    'skins.by_nickname': 'By username',
    'skins.choose_file': 'Choose PNG skin file',
    'skins.dimensions_hint': 'Dimensions 64x64 or 64x32 pixels',
    'skins.skin_name': 'Skin name',
    'skins.model_type': 'Model Type',
    'skins.classic': 'Classic (Steve)',
    'skins.slim': 'Slim (Alex)',
    'skins.fetch_nick': 'Type Minecraft username...',
    'skins.download': 'Download',
    'skins.library': 'Skins Library',
    'skins.default': 'Default',
    'skins.delete': 'Delete skin',
    'skins.status.setting': 'Setting skin in official Mojang API...',
    'skins.status.success': 'Skin equipped and updated in Mojang API successfully!',

    // Accounts View
    'accounts.title': 'ACCOUNTS',
    'accounts.subtitle': 'Manage your Minecraft accounts',
    'accounts.add_offline': 'Add Offline account',
    'accounts.add_microsoft': 'Add Microsoft account',
    'accounts.enter_nick': 'Player Name (Nick)',
    'accounts.confirm_add': 'Add account',
    'accounts.confirm_loading': 'Adding...',
    'accounts.your_accounts': 'YOUR ACCOUNTS',
    'accounts.no_accounts': 'No saved accounts',
    'accounts.no_accounts_hint': 'Add an Offline or Microsoft account to start playing',
    'accounts.active': 'Active',
    'accounts.use': 'Use',

    // Settings View
    'settings.title': 'SETTINGS',
    'settings.subtitle': 'Configure launcher and game options',
    'settings.saved': 'Saved',
    'settings.ram_title': 'RAM Memory',
    'settings.ram_desc': 'Amount of memory allocated for the game',
    'settings.java_title': 'Java Environment',
    'settings.java_desc': 'Java version used to launch the game',
    'settings.scan': 'Scan',
    'settings.java_browse': 'Choose file manually...',
    'settings.game_dir': 'Game Directory',
    'settings.game_dir_desc': 'Folder containing .nexoclient files',
    'settings.change': 'Change',
    'settings.main_folder': 'Main folder',
    'settings.main_folder_desc': 'Game files and configurations',
    'settings.mods_folder': 'Mods',
    'settings.mods_folder_desc': 'Fabric modifications',
    'settings.resourcepacks_folder': 'Resource packs',
    'settings.resourcepacks_folder_desc': 'Textures and sounds',

    // Profiles View
    'profiles.title': 'PROFILES',
    'profiles.subtitle': 'Manage game versions and modifications',
    'profiles.create_new': 'Create new profile',
    'profiles.profile_name': 'Profile name',
    'profiles.version': 'Game version',
    'profiles.mods_pack': 'Modpack',
    'profiles.vanilla': 'Pure Minecraft (Vanilla)',
    'profiles.optimization': 'Optimization (Sodium, Iris, etc.)',
    'profiles.create': 'Create profile',
    'profiles.list': 'YOUR PROFILES',
    'profiles.no_profiles': 'No profiles created',
    'profiles.no_profiles_hint': 'Create your first game profile by choosing a version and modpack',
    'profiles.mods': 'Mods',
    'profiles.launch': 'Play',
    'profiles.delete': 'Delete',
    'profiles.edit_mods': 'Edit mods',
  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>(() => {
    return (localStorage.getItem('lang') as Lang) || 'pl';
  });

  const setLang = (newLang: Lang) => {
    setLangState(newLang);
    localStorage.setItem('lang', newLang);
  };

  const t = (key: string): string => {
    return translations[lang]?.[key] || translations['pl']?.[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
