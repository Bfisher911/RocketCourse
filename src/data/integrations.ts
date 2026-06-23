// Per-LMS / per-format integration landing pages. Each entry powers a crawlable SEO page at
// /integration/<slug> (prerendered from src/seo-routes.json) and the live IntegrationPage view.
// The data here drives the page body (blurb + export steps); SEO meta lives in seo-routes.json.

export interface IntegrationEntry {
  slug: string;
  name: string;
  kind: "lms" | "format";
  tagline: string;
  blurb: string;
  /** "How RocketCourse exports to <name>" — concrete, honest steps. */
  steps: string[];
}

export const INTEGRATIONS: IntegrationEntry[] = [
  {
    slug: "canvas",
    name: "Canvas",
    kind: "lms",
    tagline: "Generate a Canvas course and export a validated .imscc.",
    blurb:
      "Canvas is Instructure's open LMS used across higher education and K-12. RocketCourse generates Canvas-native objects — modules, pages, assignments, QTI quizzes, rubrics, outcomes, and gradebook groups — and exports an IMS Common Cartridge (.imscc) you import directly into a Canvas course.",
    steps: [
      "Generate a course from a topic or syllabus, or import an existing Canvas export.",
      "Review the readiness score and resolve any flagged issues.",
      "Export the locally validated .imscc package.",
      "In Canvas: Settings → Import Course Content → Common Cartridge 1.x, then upload the .imscc."
    ]
  },
  {
    slug: "moodle",
    name: "Moodle",
    kind: "lms",
    tagline: "Build a course and import it into Moodle.",
    blurb:
      "Moodle is a widely used open-source LMS. RocketCourse exports an IMS Common Cartridge package that Moodle can import, bringing your modules, pages, and quizzes across.",
    steps: [
      "Generate your course in RocketCourse.",
      "Export the validated .imscc (Common Cartridge) package.",
      "In Moodle: Course administration → Restore/Import → upload the Common Cartridge file.",
      "Review the imported activities and adjust Moodle-specific settings."
    ]
  },
  {
    slug: "blackboard",
    name: "Blackboard",
    kind: "lms",
    tagline: "Export a Common Cartridge for Blackboard Learn.",
    blurb:
      "Blackboard Learn is a virtual learning environment used by universities worldwide. RocketCourse exports an IMS Common Cartridge package that Blackboard Learn can import.",
    steps: [
      "Generate your course in RocketCourse.",
      "Export the validated .imscc (Common Cartridge) package.",
      "In Blackboard: Course → Import Package / View Logs → Import Package, then upload the file.",
      "Review imported content areas and tests, and confirm point values."
    ]
  },
  {
    slug: "brightspace",
    name: "Brightspace (D2L)",
    kind: "lms",
    tagline: "Import an AI-built course into D2L Brightspace.",
    blurb:
      "Brightspace by D2L is a cloud LMS used in higher ed and K-12. RocketCourse exports an IMS Common Cartridge package Brightspace can import.",
    steps: [
      "Generate your course in RocketCourse.",
      "Export the validated .imscc (Common Cartridge) package.",
      "In Brightspace: Course Admin → Import/Export/Copy Components → Import, then upload the package.",
      "Review imported content and quizzes, and adjust release conditions."
    ]
  },
  {
    slug: "schoology",
    name: "Schoology",
    kind: "lms",
    tagline: "Bring a structured course into Schoology.",
    blurb:
      "Schoology is a K-12 learning management system. RocketCourse exports an IMS Common Cartridge package that Schoology can import as course materials.",
    steps: [
      "Generate your course in RocketCourse.",
      "Export the validated .imscc (Common Cartridge) package.",
      "In Schoology: Course → Options → Import → Common Cartridge, then upload the file.",
      "Review imported materials and assessments before publishing."
    ]
  },
  {
    slug: "google-classroom",
    name: "Google Classroom",
    kind: "lms",
    tagline: "Use generated materials in Google Classroom.",
    blurb:
      "Google Classroom is a lightweight LMS for K-12 and beyond. It does not import Common Cartridge directly, so RocketCourse gives you exportable, ready-to-paste materials — pages, syllabus, and QTI/printable quizzes — to add to Classroom.",
    steps: [
      "Generate your course in RocketCourse.",
      "Export quizzes as QTI or printable PDFs, and copy page content.",
      "Create assignments and materials in Google Classroom.",
      "Paste or attach the generated content into each Classroom item."
    ]
  },
  {
    slug: "common-cartridge",
    name: "Common Cartridge (IMSCC)",
    kind: "format",
    tagline: "The .imscc interoperability standard RocketCourse exports.",
    blurb:
      "IMS Common Cartridge (.imscc) is the standard for moving course content between learning management systems. RocketCourse builds a Canvas-flavored Common Cartridge with modules, pages, assignments, QTI quizzes, rubrics, outcomes, and gradebook groups.",
    steps: [
      "RocketCourse assembles your course as Common Cartridge XML plus HTML content.",
      "It validates the manifest, cross-references, and HTML locally before download.",
      "Import the .imscc into Canvas, Moodle, Blackboard, Brightspace, or Schoology.",
      "Review the imported course and publish."
    ]
  },
  {
    slug: "qti",
    name: "QTI Quizzes",
    kind: "format",
    tagline: "Standards-based, portable quiz export.",
    blurb:
      "QTI (Question & Test Interoperability) is the standard for portable quizzes. RocketCourse exports Canvas-compatible QTI so multiple-choice, true/false, fill-in-the-blank, and essay questions import cleanly into LMS quiz tools.",
    steps: [
      "Build quizzes in RocketCourse with auto-graded and instructor-reviewed questions.",
      "Export quizzes as QTI — bundled inside the .imscc or as a standalone package.",
      "Import the QTI package into your LMS quiz or assessment tool.",
      "Verify answer keys and point values before publishing."
    ]
  }
];

export const getIntegration = (slug?: string | null): IntegrationEntry | undefined =>
  INTEGRATIONS.find((entry) => entry.slug === slug);

/** Extract the integration slug from a pathname, or null for the hub / non-integration paths. */
export const integrationSlugFromPath = (pathname: string): string | null => {
  const match = pathname.replace(/\/+$/, "").match(/^\/integration\/([a-z0-9-]+)$/i);
  return match ? match[1].toLowerCase() : null;
};
