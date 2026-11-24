
import {
  BarChart3,
  BrainCircuit,
  BriefcaseBusiness,
  ClipboardCheck,
  GraduationCap,
  Lightbulb,
  ListChecks,
  Mic,
  Rocket,
  Target,
  TrendingUp,
  UserRound,
} from "lucide-react";

/** Section ids used by the navbar and footer anchors. */
export const navLinks = [
  { label: "Features", id: "features" },
  { label: "How it works", id: "how-it-works" },
  { label: "Journey", id: "journey" },
  { label: "FAQ", id: "faq" },
];

/**
 * The four tools. Every point below matches something the backend really
 * returns (see the AI schemas in guidio-backend/src/ai).
 */
export const features = [
  {
    id: "assistant",
    icon: BrainCircuit,
    title: "AI Student Assistant",
    description:
      "Ask about your subjects, resumes, interviews, careers or any concept you are stuck on and get clear, step-by-step help.",
    points: [
      "Clear, formatted answers with examples from your field",
      "Saved conversations you can come back to",
      "Roadmaps and interview preparation help",
    ],
  },
  {
    id: "skill-gap",
    icon: BarChart3,
    title: "Skill Gap Analysis",
    description:
      "Compare your current skills with a target role and see exactly what to learn next.",
    points: [
      "Skill match percentage and your strengths",
      "Missing skills ranked high, medium or low",
      "Learning plan and project ideas",
    ],
  },
  {
    id: "career",
    icon: BriefcaseBusiness,
    title: "Career Guidance",
    description:
      "Explore a target career and get a personalised roadmap built around your profile.",
    points: [
      "Readiness score and alternative roles",
      "Phase-by-phase learning roadmap",
      "Project ideas and interview topics",
    ],
  },
  {
    id: "interview",
    icon: Mic,
    title: "AI Mock Interview",
    description:
      "Practise role-based, HR or behavioural interviews for your own field and get scored feedback on every session.",
    points: [
      "Overall, subject knowledge and communication scores",
      "Strengths and improvement suggestions",
      "Interview history to track progress",
    ],
  },
];

export const steps = [
  {
    icon: UserRound,
    title: "Create your profile",
    description:
      "Sign up and tell us about your education, skills, interests and the role you want.",
  },
  {
    icon: Target,
    title: "Choose a tool",
    description:
      "Run a skill gap analysis, get a career roadmap, ask the assistant or start a mock interview.",
  },
  {
    icon: TrendingUp,
    title: "Act and improve",
    description:
      "Follow your learning plan, practise again and review your saved reports and interview history.",
  },
];

export const journey = [
  {
    icon: BriefcaseBusiness,
    title: "Explore",
    tool: "Career Guidance",
    description:
      "Not sure which role fits you? Get a career overview, alternative roles and a readiness score.",
  },
  {
    icon: Target,
    title: "Measure",
    tool: "Skill Gap Analysis",
    description:
      "Compare your skills with a target role. See your match percentage and the gaps that matter most.",
  },
  {
    icon: BrainCircuit,
    title: "Learn",
    tool: "AI Student Assistant",
    description:
      "Work through your learning plan and ask the assistant whenever a concept or a problem blocks you.",
  },
  {
    icon: Mic,
    title: "Practise",
    tool: "AI Mock Interview",
    description:
      "Take role-based, HR or behavioural mock interviews and review your scored feedback.",
  },
];

export const benefits = [
  {
    icon: UserRound,
    title: "Personalised to you",
    description:
      "Guidance starts from your own profile: your degree, skills, interests and goals.",
  },
  {
    icon: Rocket,
    title: "Built for every field",
    description:
      "Interview practice, study help and career guidance for engineering, medicine, commerce, law, arts, design, teaching and more.",
  },
  {
    icon: ListChecks,
    title: "Clear priorities",
    description:
      "Missing skills are ranked high, medium or low, so you know what to learn first.",
  },
  {
    icon: ClipboardCheck,
    title: "Plans you can follow",
    description:
      "Roadmaps, learning phases and project ideas broken into steps you can act on.",
  },
  {
    icon: Lightbulb,
    title: "Track your progress",
    description:
      "Saved skill reports and interview history show how you are improving over time.",
  },
  {
    icon: GraduationCap,
    title: "Free for students",
    description:
      "No payment is needed to use Guidio AI. AI features run on a free tier, so limits can apply.",
  },
];

export const faqs = [
  {
    value: "free",
    question: "Is Guidio AI free?",
    answer:
      "Yes, Guidio AI is free for students to use. The AI features run on free AI services such as Google Gemini and Groq, which have usage limits, so during busy periods a request may be temporarily limited.",
  },
  {
    value: "limits",
    question: "What happens when the AI limit is reached?",
    answer:
      "You will see a clear message and can try again shortly. Free-tier quotas are set by the AI providers and can change, so availability is not guaranteed.",
  },
  {
    value: "who",
    question: "Who is Guidio AI for?",
    answer:
      "Students and fresh graduates from any field, including engineering, medicine, commerce, law, arts, design, education and government exam preparation, as well as anyone looking for career direction.",
  },
  {
    value: "skill-gap",
    question: "How does the skill gap analysis work?",
    answer:
      "You choose a target role and share your skills. The AI compares them and returns a match percentage, your strengths, missing skills ranked by priority, a learning plan and project ideas.",
  },
  {
    value: "accuracy",
    question: "Are the AI answers always correct?",
    answer:
      "No. AI can make mistakes. Treat the results as guidance and double-check important information before making decisions.",
  },
  {
    value: "account",
    question: "Do I need an account?",
    answer:
      "Yes. An account lets you save your profile, skill reports, career plans and interview history so you can return to them.",
  },
];
