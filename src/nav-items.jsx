import { FolderIcon, SettingsIcon, LinkIcon, HeartPulse, LayoutTemplate, MessagesSquare } from "lucide-react";
import { Navigate } from "react-router-dom";
import Projects from "./pages/Projects.jsx";
import Settings from "./pages/Settings.jsx";
import Links from "./pages/Links.jsx";
import HealthCheck from "./pages/HealthCheck.jsx";
import Templates from "./pages/Templates.jsx";
import Workbench from "./pages/Workbench.jsx";

export const navItems = [
  {
    title: "Home",
    to: "/",
    page: <Navigate to="/projects" replace />,
    hidden: true,
  },
  {
    title: "Prompts",
    to: "/projects",
    icon: <FolderIcon className="h-4 w-4" />,
    page: <Projects />,
  },
  {
    title: "Workbench",
    to: "/workbench",
    icon: <MessagesSquare className="h-4 w-4" />,
    page: <Workbench />,
  },
  {
    title: "Templates",
    to: "/templates",
    icon: <LayoutTemplate className="h-4 w-4" />,
    page: <Templates />,
  },
  {
    title: "Settings",
    to: "/settings",
    icon: <SettingsIcon className="h-4 w-4" />,
    page: <Settings />,
  },
  {
    title: "Health",
    to: "/health",
    icon: <HeartPulse className="h-4 w-4" />,
    page: <HealthCheck />,
  },
  {
    title: "Links",
    to: "/links",
    icon: <LinkIcon className="h-4 w-4" />,
    page: <Links />,
    hidden: true,
  },
];