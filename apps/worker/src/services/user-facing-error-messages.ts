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
