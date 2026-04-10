import { HelpGuidePage } from "../../../components/help-guide-page";

function getSafeReturnPath(returnTo?: string) {
  if (!returnTo || !returnTo.startsWith("/")) {
    return "/professor";
  }

  return returnTo;
}

function getBackLabel(returnTo?: string) {
  if (returnTo?.startsWith("/professor/assignments/")) {
    return "Back to Workspace";
  }

  return "Back to Dashboard";
}

const professorSections = [
  {
    id: "visual-guide",
    badge: "Visual Guide",
    title: "Visual Guide",
    subtitle: "How to use the professor side",
    description: "This section focuses on the instructor-facing workflow and the main actions available in the dashboard and assignment workspace.",
    items: [
      {
        title: "What this system does",
        body: "This system lets instructors and TAs manage assignments, uploads, comparisons, and suspicious-pair review.",
        bullets: [
          "Create assignments",
          "Collect current submissions",
          "Upload historical repositories",
          "Upload template or reference code",
          "Run comparisons",
          "Review suspicious pairs",
        ],
      },
      {
        title: "Assignment setup",
        body: "Each assignment uses exactly one language. A due date can be added, but it is currently for display only and does not block uploads.",
        bullets: ["Java", "C", "C++"],
      },
      {
        title: "Upload types",
        body: "The interface supports several upload flows with different boundaries and purposes.",
        bullets: [
          "Current submission: one zip = one current submission.",
          "Bulk current upload: one parent zip containing child submission zips.",
          "Historical upload: one parent zip containing child submission zips.",
          "Template or reference upload: reference material only, not suspicious submissions.",
        ],
      },
      {
        title: "Accepted structures",
        body: "Normal single uploads and bulk-style uploads follow different archive rules.",
        bullets: [
          "Single submission should be a zip folder.",
          "Template or reference uploads should also be wrapped in a zip file and are treated like a single submission.",
          "Accepted Structure for Bulk and Historical:",
          "option 1: parent zip -> child submission zips",
          "option 2: parent zip -> one wrapper folder -> child submission zips",
          "Only first-layer child zips define submissions in bulk or historical uploads.",
        ],
      },
      {
        title: "Running comparisons",
        body: "Comparisons do not run automatically after upload. Use the Run action to start them manually.",
      },
      {
        title: "Viewing suspicious pairs",
        body: "Code matches and comment matches are shown separately, and each section has its own navigation controls.",
        bullets: [
          "Code matches have numbered buttons and Back/Next arrows.",
          "Comment matches also have numbered buttons and Back/Next arrows.",
          "Clicking a button, arrow, or highlighted match reveals the corresponding evidence.",
        ],
      },
      {
        title: "Comments",
        body: "Comments are supporting evidence only. They do not affect the numeric code similarity score, there is no separate comment similarity score, and the UI shows comment match count instead.",
      },
      {
        title: "Submission viewing",
        body: "In the submissions view, clicking the view icon opens submission details inline under that row. Clicking again closes it.",
      },
      {
        title: "Danger Zone",
        body: "Danger Zone contains destructive actions that should be used carefully.",
        bullets: [
          "Delete assignment",
          "Delete all items in a category",
          "Delete one validated submission",
        ],
      },
    ],
  },
  {
    id: "technical-behavior",
    badge: "Technical Behavior",
    title: "Technical Behavior",
    subtitle: "What happens behind the scenes",
    description: "This section describes the comparison model, upload boundaries, masking behavior, identity handling, and evidence rendering rules.",
    items: [
      {
        title: "Comparison scope",
        body: "Suspicious pair generation is limited to current vs current and current vs historical. The system does not compare historical vs historical, and it does not compare template or reference material as suspicious submissions.",
      },
      {
        title: "Template behavior",
        body: "Template or reference uploads are treated as reference material for masking and exclusion, not as suspicious submissions.",
      },
      {
        title: "Submission identity",
        body: "For normal encrypted public student submissions, professors see alias-like labels such as SUB-... by default. These aliases protect identity and are not guaranteed to stay the same across repeated uploads by the same student.",
      },
      {
        title: "Deletion behavior",
        body: "Deleting submissions or assignment artifacts clears comparison state and requires rerunning comparisons for fresh results.",
      },
      {
        title: "Evidence viewer behavior",
        body: "The same match pair uses the same color on both sides. Different match pairs use different colors. Only one match is active at a time.",
      },
      {
        title: "Comment highlighting",
        body: "Trailing same-line comments to the right of code are visually trimmed out of code-match highlighting.",
      },
    ],
  },
] as const;

export default async function ProfessorHelpPage({
  searchParams,
}: {
  searchParams?: Promise<{ returnTo?: string }>;
}) {
  const params = await searchParams;
  const returnTo = getSafeReturnPath(params?.returnTo);

  return (
    <HelpGuidePage
      title="Instructor / TA Guide"
      intro="Use the visual guide first for the dashboard and workspace workflow. Use the technical section below for comparison boundaries, identity handling, deletion effects, and evidence-viewer behavior."
      backHref={returnTo}
      backLabel={getBackLabel(params?.returnTo)}
      sections={[...professorSections]}
    />
  );
}
