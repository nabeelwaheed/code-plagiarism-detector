const AdmZip = require('adm-zip');
const path = require('path');

const DEFAULT_CODE_EXTENSIONS = new Set([
    '.c',
    '.cc',
    '.cpp',
    '.cxx',
    '.h',
    '.hh',
    '.hpp',
    '.hxx',
    '.java'
]);

class ZipExtractorService {
    /**
     * Extract the code files from a zip folder.
     * @param {string} zipFilePath
     * @param {Object} [options]
     * @param {Set<string>} [options.allowedExtensions]
     * @returns {Array<{filePath: string, content: string}>}
     */
    static extract(zipFilePath, options = {}) {
        const allowedExtensions = options.allowedExtensions || DEFAULT_CODE_EXTENSIONS;

        try {
            const zip = new AdmZip(zipFilePath);
            const entries = zip.getEntries();
            const files = [];

            for (const entry of entries) {
                if (entry.isDirectory) continue;
                const normalizedPath = entry.entryName.replace(/\\/g, '/');
                if (
                    normalizedPath.startsWith('__MACOSX/') ||
                    path.basename(normalizedPath).startsWith('.')
                ) {
                    continue;
                }
                const ext = path.extname(normalizedPath).toLowerCase();
                if (!allowedExtensions.has(ext)) {
                    continue;
                }
                let content = entry.getData().toString('utf8');
                if (content.charCodeAt(0) === 0xfeff) {
                    content = content.slice(1);
                }

                files.push({
                    filePath: normalizedPath,
                    content
                });
            }

            files.sort((a, b) => a.filePath.localeCompare(b.filePath));
            if (files.length === 0) {
                throw new Error('No supported source files found in zip');
            }

            return files;
        } catch (error) {
            console.error('Zip extraction failed:', error);
            throw new Error(`Failed to extract source files from zip: ${zipFilePath}`);
        }
    }
}

module.exports = ZipExtractorService;