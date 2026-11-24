import {
  BarChart3,
  BrainCircuit,
  BriefcaseBusiness,
  History,
  LayoutDashboard,
  Mic,
  Settings,
  Target,
  UserRound,
} from "lucide-react";

export const navigationItems = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "My Profile",
    href: "/profile",
    icon: UserRound,
  },
  {
    title: "AI Assistant",
    href: "/assistant",
    icon: BrainCircuit,
  },
  {
    title: "Skill Gap",
    href: "/skill-gap",
    icon: BarChart3,
  },
  {
    title: "Career Guidance",
    href: "/career-guidance",
    icon: BriefcaseBusiness,
  },
  {
    title: "Mock Interview",
    href: "/mock-interview",
    icon: Mic,
  },
  {
    title: "Interview History",
    href: "/interview-history",
    icon: History,
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

export const quickActionItems = [
  {
    title: "Ask AI Assistant",
    description: "Get help with a topic or study question.",
    href: "/assistant",
    icon: BrainCircuit,
    color: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  {
    title: "Analyze Skill Gap",
    description: "Find the skills needed for your target role.",
    href: "/skill-gap",
    icon: Target,
    color: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  },
  {
    title: "Practice Interview",
    description: "Answer role-based interview questions.",
    href: "/mock-interview",
    icon: Mic,
    color: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
];