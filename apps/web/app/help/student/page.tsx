import { HelpGuidePage } from "../../../components/help-guide-page";

const studentSections = [
  {
    id: "visual-guide",
    badge: "Visual Guide",
    title: "Visual Guide",
    subtitle: "How to use the page",
    description: "This section covers what students see, fill in, upload, and expect after submitting.",
    items: [
      {
        title: "What this page is for",
        body: "Use the top part of this page to submit one assignment zip for one assignment key. A separate bulk upload section for TA convenience appears lower on the same page, so you may need to scroll down to reach it.",
      },
      {
        title: "Required fields",
        body: "Fill in the required submission details before the Submit button becomes available.",
        bullets: [
          "Student name",
          "Student number",
          "Assignment key",
          "Zip file",
          "Student email is optional.",
        ],
      },
      {
        title: "What to upload",
        body: "Upload one zip file. Only supported source files are used for analysis.",
      },
      {
        title: "Accepted structures",
        body: "Normal single uploads and bulk-style uploads follow different archive rules.",
        bullets: [
          "Single submission should be a zip folder.",
          "Accepted Structure for Bulk and Historical:",
          "option 1: parent zip -> child submission zips",
          "option 2: parent zip -> one wrapper folder -> child submission zips",
          "Only first-layer child zips define submissions in bulk or historical uploads.",
        ],
      },
      {
        title: "One upload = one submission",
        body: "A normal student upload creates one submission.",
      },
      {
        title: "After you submit",
        body: "Your upload is prepared first. Comparisons are not run automatically. The professor runs comparisons manually later.",
      },
      {
        title: "Privacy",
        body: "Your identifying information is protected before being stored. Professors do not see your raw identity by default.",
      },
      {
        title: "Common mistakes",
        body: "These are the most common reasons a submission does not behave as expected.",
        bullets: [
          "Wrong assignment key",
          "Uploading a non-zip file",
          "Uploading a zip with no supported source files",
          "Uploading the wrong project files",
        ],
      },
    ],
  },
  {
    id: "technical-behavior",
    badge: "Technical Behavior",
    title: "Technical Behavior",
    subtitle: "What happens behind the scenes",
    description: "This section explains the system behavior that supports the student submission flow.",
    items: [
      {
        title: "Identity protection",
        body: "For normal student submissions, student identity information is encrypted before storage. Professors usually see an alias-style label such as SUB-... instead of raw identity.",
      },
      {
        title: "Repeated submissions",
        body: "If the same student submits again, it appears as a separate submission entry.",
      },
      {
        title: "Preparation vs comparison",
        body: "Uploading prepares the submission only. The professor must manually start comparison runs.",
      },
      {
        title: "Supported files",
        body: "Only supported language source files are kept for preparation and analysis.",
      },
    ],
  },
] as const;

export default function StudentHelpPage() {
  return (
    <HelpGuidePage
      title="Student Submission Guide"
      intro="Use the visual guide first if you just want to complete a submission. The top of the page is for normal single-student upload, and a separate bulk upload section for TA convenience appears lower on the page."
      backHref="/"
      backLabel="Back to Submission Page"
      sections={[...studentSections]}
    />
  );
}
