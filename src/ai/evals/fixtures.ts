import { defaultSettings } from "../../data/defaultSettings";
import type { CourseSettings } from "../../types";

type CourseSettingsOverrides = Partial<Omit<CourseSettings, "schedule" | "imageSettings" | "sourceFiles">> & {
  schedule?: Partial<CourseSettings["schedule"]>;
  imageSettings?: Partial<CourseSettings["imageSettings"]>;
  sourceFiles?: CourseSettings["sourceFiles"];
};

export interface CourseEvalFixture {
  id: string;
  discipline: string;
  courseTitle: string;
  prompt: string;
  audience: string;
  modality: string;
  level: string;
  creditHours: number;
  courseLength: string;
  moduleCount: number;
  tone: string;
  assignmentPreferences: string[];
  discussionFrequency: CourseSettings["discussionFrequency"];
  quizFrequency: CourseSettings["quizFrequency"];
  finalProjectPreference: string;
  sourceNotes: string;
  specialRequirements: string[];
  settings: CourseSettings;
}

const fixtureSettings = (overrides: CourseSettingsOverrides): CourseSettings => ({
  ...defaultSettings,
  ...overrides,
  schedule: { ...defaultSettings.schedule, ...overrides.schedule },
  imageSettings: { ...defaultSettings.imageSettings, ...overrides.imageSettings },
  sourceFiles: overrides.sourceFiles ?? []
});

export const courseEvalFixtures: CourseEvalFixture[] = [
  {
    id: "humanities-scifi-ethics",
    discipline: "Humanities",
    courseTitle: "Ethics and Technology through Science Fiction",
    prompt: "Build a course on Ethics and Technology through Science Fiction for undergraduate humanities students.",
    audience: "Undergraduate general education students",
    modality: "Online asynchronous",
    level: "Undergraduate",
    creditHours: 3,
    courseLength: "8 weeks",
    moduleCount: 8,
    tone: "Inviting humanities seminar",
    assignmentPreferences: ["Close reading", "Case analysis", "Final interpretive portfolio"],
    discussionFrequency: "weekly",
    quizFrequency: "biweekly",
    finalProjectPreference: "Portfolio connecting speculative fiction to contemporary technology ethics",
    sourceNotes: "Use placeholders for short fiction, film clips, and institution-licensed readings. Do not invent citations.",
    specialRequirements: ["Include ethical frameworks", "Avoid fake story citations", "Use discussion-heavy interaction"],
    settings: fixtureSettings({
      title: "Ethics and Technology through Science Fiction",
      description: "A humanities course using speculative fiction to examine technology ethics, agency, labor, identity, and responsibility.",
      modality: "Online asynchronous",
      level: "Undergraduate",
      courseLengthPreset: "8-weeks",
      lengthWeeks: 8,
      moduleCount: 8,
      tone: "Inviting humanities seminar",
      assignmentTypes: ["Close reading", "Case analysis", "Final portfolio"],
      discussionFrequency: "weekly",
      quizFrequency: "biweekly",
      finalProjectType: "portfolio"
    })
  },
  {
    id: "stem-environmental-data",
    discipline: "STEM",
    courseTitle: "Introduction to Environmental Data Science",
    prompt: "Build a course on Introduction to Environmental Data Science for early undergraduate STEM learners.",
    audience: "Early undergraduate STEM and environmental studies students",
    modality: "Hybrid",
    level: "Undergraduate",
    creditHours: 4,
    courseLength: "12 weeks",
    moduleCount: 12,
    tone: "Clear applied STEM",
    assignmentPreferences: ["Dataset labs", "Visualization critique", "Final analysis project"],
    discussionFrequency: "biweekly",
    quizFrequency: "weekly",
    finalProjectPreference: "Applied environmental dataset analysis project",
    sourceNotes: "Use placeholders for public datasets, campus lab files, and software setup links.",
    specialRequirements: ["Include reproducibility", "Include data ethics", "Include practice with interpretation"],
    settings: fixtureSettings({
      title: "Introduction to Environmental Data Science",
      description: "A hybrid course introducing environmental datasets, visualization, interpretation, reproducibility, and applied decision-making.",
      modality: "Hybrid",
      level: "Undergraduate",
      creditHours: 4,
      courseLengthPreset: "12-weeks",
      lengthWeeks: 12,
      moduleCount: 12,
      tone: "Clear applied STEM",
      assignmentTypes: ["Dataset labs", "Visualization critique", "Final project"],
      discussionFrequency: "biweekly",
      quizFrequency: "weekly",
      finalProjectType: "project"
    })
  },
  {
    id: "health-emergency-management",
    discipline: "Health and emergency management",
    courseTitle: "Health and Medical Issues in Emergency Management",
    prompt: "Build a course on Health and Medical Issues in Emergency Management for emergency management professionals.",
    audience: "Emergency management, public safety, and public health professionals",
    modality: "Online asynchronous",
    level: "Upper undergraduate",
    creditHours: 3,
    courseLength: "8 weeks",
    moduleCount: 8,
    tone: "Professional applied",
    assignmentPreferences: ["Incident scenario analysis", "Planning memo", "Final response framework"],
    discussionFrequency: "weekly",
    quizFrequency: "weekly",
    finalProjectPreference: "Emergency health operations planning case study",
    sourceNotes: "Use placeholders for FEMA, CDC, local emergency plans, and instructor-provided incident reports.",
    specialRequirements: ["Include ethical triage", "Include public health coordination", "Avoid unsupported medical advice"],
    settings: fixtureSettings({
      title: "Health and Medical Issues in Emergency Management",
      description: "An applied course on health, medical, operational, and coordination issues during emergencies and disasters.",
      modality: "Online asynchronous",
      level: "Upper undergraduate",
      courseLengthPreset: "8-weeks",
      lengthWeeks: 8,
      moduleCount: 8,
      tone: "Professional applied",
      assignmentTypes: ["Scenario analysis", "Planning memo", "Final case study"],
      discussionFrequency: "weekly",
      quizFrequency: "weekly",
      finalProjectType: "case-study"
    })
  },
  {
    id: "business-project-management",
    discipline: "Business",
    courseTitle: "Foundations of Project Management",
    prompt: "Build a course on Foundations of Project Management for adult professional learners.",
    audience: "Adult learners moving into project coordination or management roles",
    modality: "Online asynchronous",
    level: "Professional",
    creditHours: 3,
    courseLength: "6 weeks",
    moduleCount: 6,
    tone: "Practical and workplace-focused",
    assignmentPreferences: ["Charter draft", "Risk register", "Final project plan"],
    discussionFrequency: "weekly",
    quizFrequency: "weekly",
    finalProjectPreference: "Complete project management plan",
    sourceNotes: "Use placeholders for templates, organizational examples, and optional PMBOK-aligned readings.",
    specialRequirements: ["Include scope, risk, stakeholders, communication", "Use workplace scenarios"],
    settings: fixtureSettings({
      title: "Foundations of Project Management",
      description: "A professional course on planning, coordinating, communicating, and closing projects in workplace contexts.",
      modality: "Online asynchronous",
      level: "Professional",
      courseLengthPreset: "6-weeks",
      lengthWeeks: 6,
      moduleCount: 6,
      tone: "Practical and workplace-focused",
      assignmentTypes: ["Project charter", "Risk register", "Final project plan"],
      discussionFrequency: "weekly",
      quizFrequency: "weekly",
      assignmentCadence: "every-module",
      finalProjectType: "project"
    })
  },
  {
    id: "social-science-public-policy",
    discipline: "Social science",
    courseTitle: "Introduction to Public Policy",
    prompt: "Build a course on Introduction to Public Policy for first-year public affairs students.",
    audience: "First-year public affairs and social science students",
    modality: "Face-to-face with Canvas support",
    level: "Undergraduate",
    creditHours: 3,
    courseLength: "15 weeks",
    moduleCount: 15,
    tone: "Accessible civic analysis",
    assignmentPreferences: ["Policy memo", "Stakeholder map", "Final policy brief"],
    discussionFrequency: "biweekly",
    quizFrequency: "biweekly",
    finalProjectPreference: "Policy brief and reflection",
    sourceNotes: "Use placeholders for local policy cases, official reports, and instructor-selected readings.",
    specialRequirements: ["Include policy process", "Include stakeholder analysis", "Include evidence quality"],
    settings: fixtureSettings({
      title: "Introduction to Public Policy",
      description: "A social science course introducing policy problems, institutions, actors, evidence, and implementation.",
      modality: "Face-to-face with Canvas support",
      level: "Undergraduate",
      courseLengthPreset: "15-weeks",
      lengthWeeks: 15,
      moduleCount: 15,
      tone: "Accessible civic analysis",
      assignmentTypes: ["Policy memo", "Stakeholder map", "Final brief"],
      discussionFrequency: "biweekly",
      quizFrequency: "biweekly",
      finalProjectType: "paper"
    })
  },
  {
    id: "professional-grant-writing",
    discipline: "Skills-based professional",
    courseTitle: "Grant Writing for Nonprofit Professionals",
    prompt: "Build a course on Grant Writing for Nonprofit Professionals for community organization staff.",
    audience: "Nonprofit staff, volunteers, and program managers",
    modality: "Online asynchronous",
    level: "Professional",
    creditHours: 2,
    courseLength: "6 weeks",
    moduleCount: 6,
    tone: "Supportive skills workshop",
    assignmentPreferences: ["Needs statement", "Budget narrative", "Final grant proposal package"],
    discussionFrequency: "weekly",
    quizFrequency: "none",
    finalProjectPreference: "Draft grant proposal package",
    sourceNotes: "Use placeholders for funder guidelines, local organization data, and sample budgets.",
    specialRequirements: ["Include funder alignment", "Include revision cycles", "Avoid fabricated funder requirements"],
    settings: fixtureSettings({
      title: "Grant Writing for Nonprofit Professionals",
      description: "A practical course guiding nonprofit professionals through funder research, proposal writing, budgets, and revision.",
      modality: "Online asynchronous",
      level: "Professional",
      creditHours: 2,
      courseLengthPreset: "6-weeks",
      lengthWeeks: 6,
      moduleCount: 6,
      tone: "Supportive skills workshop",
      assignmentTypes: ["Needs statement", "Budget narrative", "Proposal package"],
      discussionFrequency: "weekly",
      quizFrequency: "none",
      finalProjectType: "portfolio"
    })
  },
  {
    id: "online-ai-fundamentals-faculty",
    discipline: "Online asynchronous faculty development",
    courseTitle: "AI Fundamentals for Faculty",
    prompt: "Build a course on AI Fundamentals for Faculty for instructors redesigning assignments.",
    audience: "Faculty and instructional staff",
    modality: "Online asynchronous",
    level: "Professional development",
    creditHours: 1,
    courseLength: "4 weeks",
    moduleCount: 4,
    tone: "Plain-language faculty development",
    assignmentPreferences: ["AI policy audit", "Assignment redesign", "Final teaching plan"],
    discussionFrequency: "weekly",
    quizFrequency: "biweekly",
    finalProjectPreference: "AI-aware assignment redesign portfolio",
    sourceNotes: "Use placeholders for institutional AI guidance and instructor-added policy examples.",
    specialRequirements: ["Include AI policy placeholders", "Include accessibility", "Avoid legal claims"],
    settings: fixtureSettings({
      title: "AI Fundamentals for Faculty",
      description: "A short faculty development course on AI concepts, classroom policy, assessment design, and responsible use.",
      modality: "Online asynchronous",
      level: "Professional development",
      creditHours: 1,
      courseLengthPreset: "4-weeks",
      lengthWeeks: 4,
      moduleCount: 4,
      tone: "Plain-language faculty development",
      assignmentTypes: ["Policy audit", "Assignment redesign", "Teaching plan"],
      discussionFrequency: "weekly",
      quizFrequency: "biweekly",
      finalProjectType: "portfolio"
    })
  },
  {
    id: "hybrid-gis-remote-sensing",
    discipline: "Hybrid applied geospatial",
    courseTitle: "GIS and Remote Sensing Applications",
    prompt: "Build a course on GIS and Remote Sensing Applications for applied environmental planning students.",
    audience: "Applied environmental planning and geography students",
    modality: "Hybrid",
    level: "Upper undergraduate",
    creditHours: 4,
    courseLength: "12 weeks",
    moduleCount: 12,
    tone: "Applied lab and fieldwork",
    assignmentPreferences: ["Map critique", "Lab workflow", "Final geospatial analysis project"],
    discussionFrequency: "biweekly",
    quizFrequency: "weekly",
    finalProjectPreference: "Geospatial analysis project with map deliverables",
    sourceNotes: "Use placeholders for datasets, software lab files, image sources, and campus GIS support links.",
    specialRequirements: ["Include software setup placeholders", "Include data ethics", "Include map accessibility"],
    settings: fixtureSettings({
      title: "GIS and Remote Sensing Applications",
      description: "A hybrid course on geospatial workflows, remote sensing interpretation, spatial analysis, and map communication.",
      modality: "Hybrid",
      level: "Upper undergraduate",
      creditHours: 4,
      courseLengthPreset: "12-weeks",
      lengthWeeks: 12,
      moduleCount: 12,
      tone: "Applied lab and fieldwork",
      assignmentTypes: ["Map critique", "Lab workflow", "Final geospatial project"],
      discussionFrequency: "biweekly",
      quizFrequency: "weekly",
      finalProjectType: "project"
    })
  }
];

export const getCourseEvalFixture = (id: string): CourseEvalFixture | undefined => courseEvalFixtures.find((fixture) => fixture.id === id);
