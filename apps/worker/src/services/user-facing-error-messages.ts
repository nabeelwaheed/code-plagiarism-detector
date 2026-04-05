export function getUserFacingUploadFailureMessage(error: unknown) {
  const message = error instanceof Error ? error.message.trim() : "";
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.startsWith("failed to read zip archive:")) {
    return "We couldn't read that zip archive. Please upload a valid zip file.";
  }

  if (normalizedMessage === "archive nesting depth limit exceeded") {
    return "That archive is too deeply nested to process.";
  }

  if (normalizedMessage === "archive contained too many source files") {
    return "That archive contains too many source files to process.";
  }

  if (normalizedMessage === "archive expanded beyond the allowed extraction size") {
    return "That archive is too large to process after extraction.";
  }

  if (normalizedMessage.startsWith("unsafe archive entry path:")) {
    return "That archive contains invalid file paths and could not be processed.";
  }

  if (
    normalizedMessage
    === "bulk current archive must contain child zip files directly at the top level or inside one top-level folder"
  ) {
    return "That bulk archive must contain direct child zip files, or one top-level folder containing child zip files, with one child zip per submission.";
  }

  if (
    normalizedMessage
    === "bulk current archive may only contain direct child zip files or one top-level folder containing child zip files"
  ) {
    return "That bulk archive can only contain direct child zip files at the top level, or one top-level folder containing child zip files.";
  }

  if (
    normalizedMessage
    === "historical archive must contain child zip files directly at the top level or inside one top-level folder"
  ) {
    return "That historical archive must contain child zip files either directly at the top level or inside one top-level folder.";
  }

  if (
    normalizedMessage
    === "historical archive may only contain direct child zip files or one top-level folder containing child zip files"
  ) {
    return "That historical archive can only contain direct child zip files at the top level, or one top-level folder containing child zip files.";
  }

  if (normalizedMessage === "bulk current archive contains duplicate submission names after sanitization") {
    return "Two or more child zip files resolve to the same submission name. Please rename them and try again.";
  }

  if (normalizedMessage === "bulk current archive contains a child zip with an invalid name") {
    return "One or more child zip filenames become invalid after sanitization. Please rename those child zip files and try again.";
  }

  if (
    normalizedMessage.startsWith("no relevant ")
    && normalizedMessage.endsWith(" source files found in uploaded archive")
  ) {
    return "No supported source files were found in that archive for this assignment language.";
  }

  return "We couldn't process that upload. Please check the archive contents and try again.";
}

export function getUserFacingComparisonFailureMessage() {
  return "We couldn't complete the similarity comparison. Please try again.";
}
