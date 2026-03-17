//Extracting contains into Memory
const AdmZip = require('adm-zip');

class ZipExtractorService {
    static extraction(zipFilePath) {
        try {
            const zip = new AdmZip(zipFilePath);
            const zipEntries = zip.getEntries();
            const extractFileList = [];
            zipEntries.forEach(entry => {
                if (!entry.isDirectory && !entry.entryName.includes('__MACOSX')) {
                    extractFileList.push({
                        fName: entry.entryName,
                        content: entry.getData().toString('utf8')
                    });
                }
            });
            return extractFileList;
        } catch (error) {
            console.error("Extraction Error in the Memory", error);
            throw new Error("Failed to read zip file content");
        }
    }
}

module.exports = ZipExtractorService;