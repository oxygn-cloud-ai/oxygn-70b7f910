import { HomeIcon, FolderIcon, SettingsIcon } from "lucide-react";
import Index from "./pages/Index.jsx";
import Projects from "./pages/Projects.jsx";
import Settings from "./pages/Settings.jsx";

export const navItems = [
  {
    title: "Home",
    to: "/",
    icon: <HomeIcon className="h-4 w-4" />,
    page: <Index />,
  },
  {
    title: "Prompts",
    to: "/projects",
    icon: <FolderIcon className="h-4 w-4" />,
    page: <Projects />,
  },
  {
    title: "Settings",
    to: "/settings",
    icon: <SettingsIcon className="h-4 w-4" />,
    page: <Settings />,
  },
];
