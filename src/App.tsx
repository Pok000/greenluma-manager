import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { fetch } from "@tauri-apps/plugin-http";
import { Search, Plus, Trash2, Power, Save, Gamepad2, AlertCircle, Library, Settings, FolderOpen, FolderPlus, FolderMinus } from "lucide-react";
import "./App.css";

interface Game {
  id: string;
  name: string;
  imageUrl?: string;
}

interface SearchResult {
  id: string;
  name: string;
  tiny_image: string;
}

type TabState = "library" | "search" | "settings";

const STORAGE_KEY = "greenluma_profiles";

function App() {
  const [activeTab, setActiveTab] = useState<TabState>("library");

  const [profiles, setProfiles] = useState<Record<string, Game[]>>({ "Default Profile": [] });
  const [activeProfileName, setActiveProfileName] = useState<string>("Default Profile");
  const games = profiles[activeProfileName] || [];

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchErrorMsg, setSearchErrorMsg] = useState("");

  // Load profiles from LocalStorage on mount
  useEffect(() => {
    document.documentElement.classList.add('dark');
    const savedProfiles = localStorage.getItem(STORAGE_KEY);
    if (savedProfiles) {
      try {
        const parsed = JSON.parse(savedProfiles);
        if (Object.keys(parsed).length > 0) {
          setProfiles(parsed);
          const firstProfile = Object.keys(parsed)[0];
          setActiveProfileName(firstProfile);
        }
      } catch (e) {
        console.error("Failed to parse profiles", e);
      }
    }
  }, []);

  // Sync games list mutations to the active profile
  const setGames = (newGames: Game[]) => {
    const updatedProfiles = { ...profiles, [activeProfileName]: newGames };
    setProfiles(updatedProfiles);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedProfiles));
  };

  // Profile Management Functions
  const createNewProfile = () => {
    const name = prompt("Enter a name for the new profile:");
    if (!name || name.trim() === "") return;
    const trimmedName = name.trim();
    if (profiles[trimmedName]) {
      alert("A profile with that name already exists!");
      return;
    }

    const updatedProfiles = { ...profiles, [trimmedName]: [] };
    setProfiles(updatedProfiles);
    setActiveProfileName(trimmedName);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedProfiles));
  };

  const deleteActiveProfile = () => {
    const keys = Object.keys(profiles);
    if (keys.length <= 1) {
      alert("You cannot delete your only profile.");
      return;
    }

    if (confirm(`Are you sure you want to delete the profile "${activeProfileName}"?`)) {
      const updatedProfiles = { ...profiles };
      delete updatedProfiles[activeProfileName];
      setProfiles(updatedProfiles);

      const newActive = Object.keys(updatedProfiles)[0];
      setActiveProfileName(newActive);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedProfiles));
    }
  };


  const searchSteamGames = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearchErrorMsg("");
    const query = searchQuery.trim();
    if (!query) return;

    setIsSearching(true);
    setSearchResults([]);

    try {
      if (/^\d+$/.test(query)) {
        const res = await fetch(`https://store.steampowered.com/api/appdetails?appids=${query}`, {
          method: "GET",
        });
        if (res.ok) {
          const data = await res.json();
          const appData = data[query];
          if (appData && appData.success) {
            setSearchResults([
              {
                id: query,
                name: appData.data.name,
                tiny_image: appData.data.header_image,
              },
            ]);
            setIsSearching(false);
            return;
          }
        }
      }

      const res = await fetch(
        `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(query)}&l=english&cc=US`,
        { method: "GET" }
      );
      if (!res.ok) throw new Error("Network response was not ok");

      const data = await res.json();

      if (data.items && data.items.length > 0) {
        setSearchResults(
          data.items.slice(0, 10).map((item: any) => ({
            id: item.id.toString(),
            name: item.name,
            tiny_image: item.tiny_image,
          }))
        );
      } else {
        setSearchErrorMsg(`Could not find a game matching "${query}" on Steam.`);
      }
    } catch (err) {
      console.error("Failed to search games:", err);
      setSearchErrorMsg("Error contacting Steam API. Please check your connection.");
    } finally {
      setIsSearching(false);
    }
  };

  const addGameToList = (game: SearchResult) => {
    if (games.some((g) => g.id === game.id)) {
      setSearchErrorMsg("Game is already in your AppList.");
      return;
    }

    setSearchErrorMsg("");
    setGames([{ id: game.id, name: game.name, imageUrl: game.tiny_image }, ...games]);

    // Switch to library tab after adding
    setActiveTab("library");
  };

  const removeGame = (idToRemove: string) => {
    setGames(games.filter((g) => g.id !== idToRemove));
  };

  const saveAppList = async () => {
    if (games.length === 0) return;
    console.log("Saving app list...", games);
    try {
      // 1. Generate the GreenLuma AppList directory and files
      const gameIds = games.map(g => g.id);
      const appListRes = await invoke("generate_app_list", { gameIds });
      console.log(appListRes);

      // 2. Enable GreenLuma (for now, testing with relative path)
      const res = await invoke("enable_greenluma", { sourceDllPath: "./greenluma.dll" });
      alert(`${appListRes}\n\n${res}`);
    } catch (err) {
      alert("Error: " + err);
    }
  };

  const disableGreenLuma = async () => {
    console.log("Disabling GreenLuma...");
    try {
      const res = await invoke("disable_greenluma");
      alert(res);
    } catch (err) {
      alert("Error: " + err);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary/30">

      {/* Header Bar */}
      <header className="sticky top-0 z-30 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center mx-auto px-6 max-w-7xl">
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                <Gamepad2 size={20} />
              </div>
              <h1 className="text-xl font-bold tracking-tight hidden sm:block">GreenLuma <span className="text-primary font-medium">Manager</span></h1>
            </div>

            {/* Tab Navigation */}
            <nav className="flex items-center space-x-1 sm:space-x-2 bg-muted/50 p-1 rounded-lg border">
              <button
                onClick={() => setActiveTab("library")}
                className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 sm:px-4 py-1.5 text-sm font-medium transition-all ${activeTab === "library"
                    ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                    : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                  }`}
              >
                <Library size={16} className="mr-2 hidden sm:inline-block" />
                Library
                <span className="ml-2 inline-flex items-center justify-center rounded-full bg-primary/20 text-primary px-1.5 py-0.5 text-xs font-semibold">
                  {games.length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab("search")}
                className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 sm:px-4 py-1.5 text-sm font-medium transition-all ${activeTab === "search"
                    ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                    : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                  }`}
              >
                <Search size={16} className="mr-2 hidden sm:inline-block" />
                Search
              </button>
              <button
                onClick={() => setActiveTab("settings")}
                className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 sm:px-4 py-1.5 text-sm font-medium transition-all ${activeTab === "settings"
                    ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                    : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                  }`}
              >
                <Settings size={16} className="mr-2 hidden sm:inline-block" />
                Actions
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content Areas */}
      <main className="flex-1 container mx-auto px-6 py-8 max-w-5xl">

        {/* --- LIBRARY TAB --- */}
        {activeTab === "library" && (
          <div className="flex flex-col h-full min-h-[500px] animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Profile Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 pb-6 border-b gap-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Your AppList</h2>
                <p className="text-muted-foreground mt-1">Manage the games for your active profile.</p>
              </div>

              <div className="flex items-center gap-2 bg-muted/40 p-2 rounded-lg border w-full sm:w-auto">
                <FolderOpen size={16} className="text-muted-foreground ml-1 hidden sm:block" />
                <select
                  value={activeProfileName}
                  onChange={(e) => setActiveProfileName(e.target.value)}
                  className="bg-background border rounded-md text-sm px-3 py-1.5 outline-none focus:ring-2 focus:ring-primary flex-1 sm:w-48 appearance-none"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em`, paddingRight: `2.5rem` }}
                >
                  {Object.keys(profiles).map(profileName => (
                    <option key={profileName} value={profileName}>{profileName}</option>
                  ))}
                </select>

                <button
                  onClick={createNewProfile}
                  className="p-1.5 bg-background border rounded-md text-muted-foreground hover:text-primary hover:border-primary transition-colors"
                  title="Create New Profile"
                >
                  <FolderPlus size={16} />
                </button>
                <button
                  onClick={deleteActiveProfile}
                  disabled={Object.keys(profiles).length <= 1}
                  className="p-1.5 bg-background border rounded-md text-muted-foreground hover:text-destructive hover:border-destructive transition-colors disabled:opacity-50 disabled:pointer-events-none"
                  title="Delete Profile"
                >
                  <FolderMinus size={16} />
                </button>
              </div>
            </div>

            <div className="flex justify-end mb-4">
              <button
                onClick={() => setActiveTab("search")}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 shadow-sm"
              >
                <Plus size={16} className="mr-2" />
                Add Game to Profile
              </button>
            </div>

            {games.length === 0 ? (
              <div className="flex-1 flex items-center justify-center rounded-xl border border-dashed bg-card/30 shadow-sm relative overflow-hidden min-h-[400px]">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
                <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center z-10 p-8">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4 shadow-sm border">
                    <Library className="h-8 w-8 text-muted-foreground opacity-50" />
                  </div>
                  <h3 className="text-xl font-semibold">Profile is empty</h3>
                  <p className="mt-2 mb-6 text-sm text-muted-foreground/80 leading-relaxed">
                    Search for games on the Steam store and add them to your <strong>{activeProfileName}</strong> configuration.
                  </p>
                  <button
                    onClick={() => setActiveTab("search")}
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-6 py-2 shadow-sm"
                  >
                    Go to Search
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 pb-8">
                {games.map((game, index) => (
                  <div
                    key={`${game.id}-${index}`}
                    className="group relative overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm transition-all hover:shadow-md hover:border-primary/40 flex flex-col"
                  >
                    {game.imageUrl ? (
                      <div className="aspect-[460/215] w-full overflow-hidden bg-muted border-b">
                        <img
                          src={game.imageUrl}
                          alt={game.name}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </div>
                    ) : (
                      <div className="aspect-[460/215] w-full overflow-hidden bg-muted border-b flex items-center justify-center">
                        <Gamepad2 className="h-10 w-10 text-muted-foreground/30" />
                      </div>
                    )}
                    <div className="p-4 flex flex-col flex-1 pb-16">
                      <h3 className="font-semibold leading-tight tracking-tight line-clamp-2" title={game.name}>
                        {game.name}
                      </h3>
                      <p className="text-sm mt-2 text-muted-foreground flex items-center gap-1.5">
                        <span className="inline-block w-2 h-2 rounded-full bg-primary/60"></span>
                        ID: {game.id}
                      </p>
                    </div>

                    <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-full opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-200 bg-gradient-to-t from-background/95 via-background/90 to-background/40 backdrop-blur-sm border-t border-border/50">
                      <button
                        onClick={() => removeGame(game.id)}
                        className="inline-flex w-full items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring border border-destructive/20 bg-destructive/90 text-destructive-foreground hover:bg-destructive h-9 gap-2 shadow-sm"
                        title="Remove Game"
                      >
                        <Trash2 size={16} />
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* --- SEARCH TAB --- */}
        {activeTab === "search" && (
          <div className="flex flex-col max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-8 text-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
                <Search size={24} />
              </div>
              <h2 className="text-3xl font-bold tracking-tight">Find Games</h2>
              <p className="text-muted-foreground mt-2">Search the Steam store to add titles to <strong>{activeProfileName}</strong>.</p>
            </div>

            <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden flex flex-col">
              <div className="p-6 flex flex-col">
                <form className="space-y-4" onSubmit={searchSteamGames}>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <input
                      id="search-query"
                      type="text"
                      placeholder="Title or App ID (e.g. 730 or Counter-Strike)..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      required
                      className="flex h-14 w-full rounded-lg border border-input bg-background pl-12 pr-4 py-3 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary transition-colors shadow-sm"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSearching}
                    className="inline-flex items-center justify-center whitespace-nowrap rounded-lg text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-14 px-8 w-full shadow-sm"
                  >
                    {isSearching ? (
                      <span className="flex items-center gap-2">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                        Searching Steam...
                      </span>
                    ) : (
                      "Search"
                    )}
                  </button>
                  {searchErrorMsg && (
                    <div className="flex items-start gap-2 text-sm text-destructive mt-3 bg-destructive/10 p-4 rounded-md border text-left animate-in fade-in slide-in-from-top-1">
                      <AlertCircle className="h-5 w-5 shrink-0" />
                      <p>{searchErrorMsg}</p>
                    </div>
                  )}
                </form>

                {searchResults.length > 0 && (
                  <div className="mt-8 flex flex-col overflow-hidden animate-in fade-in">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 border-b pb-2">Top Results</h3>
                    <div className="space-y-3">
                      {searchResults.map((result) => (
                        <div
                          key={result.id}
                          className="group flex flex-col sm:flex-row items-center justify-between p-3 rounded-lg border bg-background hover:bg-accent/30 hover:border-primary/50 transition-all gap-4 shadow-sm hover:shadow"
                        >
                          <img
                            src={result.tiny_image}
                            alt={result.name}
                            className="h-[60px] w-[130px] object-cover rounded shadow-sm bg-muted shrink-0"
                          />
                          <div className="flex-1 min-w-0 text-center sm:text-left w-full">
                            <p className="text-base font-semibold truncate leading-tight pb-1" title={result.name}>
                              {result.name}
                            </p>
                            <p className="text-sm text-muted-foreground">App ID: {result.id}</p>
                          </div>
                          <button
                            onClick={() => addGameToList(result)}
                            className="inline-flex shrink-0 items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring border border-input bg-background hover:bg-primary hover:text-primary-foreground h-10 px-4 w-full sm:w-auto mt-2 sm:mt-0 shadow-sm"
                            title="Add to AppList"
                          >
                            <Plus size={18} className="sm:mr-2 mr-2" />
                            <span>Add</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* --- SETTINGS/ACTIONS TAB --- */}
        {activeTab === "settings" && (
          <div className="flex flex-col max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-8">
              <h2 className="text-3xl font-bold tracking-tight">Manager Actions</h2>
              <p className="text-muted-foreground mt-2">Generate your configuration and launch the unlocker.</p>
            </div>

            <div className="space-y-6">
              {/* Primary Actions */}
              <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
                <div className="p-6 pb-4 border-b bg-muted/30">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Gamepad2 size={20} className="text-primary" />
                    Launch GreenLuma
                  </h3>
                </div>
                <div className="p-6 flex flex-col gap-4">
                  <p className="text-sm text-muted-foreground">
                    This will close Steam if it is running, generate your new AppList files with <strong className="text-foreground">{games.length} games</strong> from <strong>{activeProfileName}</strong>, and boot GreenLuma using the DLLInjector.
                  </p>
                  <button
                    onClick={saveAppList}
                    disabled={games.length === 0}
                    className="inline-flex items-center justify-center whitespace-nowrap rounded-lg text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring bg-green-600 text-white hover:bg-green-700 h-14 px-8 shadow-sm gap-3 w-full sm:w-auto self-start disabled:opacity-50 disabled:pointer-events-none disabled:bg-muted disabled:text-muted-foreground"
                  >
                    <Save size={20} />
                    {games.length === 0 ? "Add games to Generate" : "Generate AppList & Run"}
                  </button>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="rounded-xl border border-destructive/20 bg-card text-card-foreground shadow-sm">
                <div className="p-6 pb-4 border-b border-destructive/10 bg-destructive/5">
                  <h3 className="text-lg font-semibold flex items-center gap-2 text-destructive">
                    <AlertCircle size={20} />
                    Danger Zone
                  </h3>
                </div>
                <div className="p-6 flex flex-col gap-4">
                  <p className="text-sm text-muted-foreground">
                    Instantly kill GreenLuma processes and revert to standard Steam.
                  </p>
                  <button
                    onClick={disableGreenLuma}
                    className="inline-flex items-center justify-center whitespace-nowrap rounded-lg text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring border border-destructive/20 bg-destructive/10 hover:bg-destructive text-destructive hover:text-destructive-foreground h-12 px-6 shadow-sm gap-2 w-full sm:w-auto self-start"
                  >
                    <Power size={18} />
                    Force Disable GreenLuma
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

      </main>
    </div>
  );
}

export default App;
