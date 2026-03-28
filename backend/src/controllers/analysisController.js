const analysisService = require('../services/analysisService');

class AnalysisController {
	
    trigger = async (req, res) => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ error: "Unauthorized: Please log in." });
            }

            const { courseId, assignmentId } = req.params;
            const { templateId, params, language } = req.body;
            const result = await analysisService.startAnalysis(
                userId, 
                courseId, 
                assignmentId, 
                templateId, 
                params, 
                language || 'cpp'
            );
        
            res.status(200).json({ 
                message: "Analysis job successfully created and executed.", 
                result 
            });
        } catch (error) {
            console.error("Batch Analysis Error:", error);
            res.status(500).json({ error: error.message || "Failed to run batch analysis." });
        }
    };

    getResults = async (req, res) => {
        let results = await analysisService.getResults(req.params.jobId);
        res.json(results);
    }

    getAllJobs = async (req, res) => {
        let jobs = await analysisService.getAllJobs();
        res.status(200).json(jobs);
    }

    getPairDetails = async (req, res) => {
        const { jobId, pairId } = req.params;
        let pairDetails = await analysisService.getPairDetails(jobId,pairId);
        if (!pairDetails) {
            return res.status(404).json({ error: "Similarity pair not found" });
        }
        res.status(200).json(pairDetails);
    }

    runBatchAnalysis = async (req, res) => {
        try {
            const userId = req.user.id; 
            const { courseId, assignmentId } = req.params;
            const { templateId, params, language } = req.body;
            const result = await analysisService.startAnalysis(
                userId, courseId, assignmentId, templateId, params, language
            );
            res.status(200).json({ message: "Analysis completed successfully", result });
        } catch (error) {
            console.error("Batch Analysis Error:", error);
            res.status(500).json({ error: error.message || "Failed to run analysis." });
        }
    };

    runDirectCompare = async (req, res) => {
        try {
            const userId = req.user.id;
            const { courseId, assignmentId } = req.params;
            const { submissionAId, submissionBId, templateId, params, language } = req.body;

            const result = await analysisService.compareTwoSubmissions(
                userId, courseId, assignmentId, submissionAId, submissionBId, templateId, params, language
            );
        
            res.status(200).json({ message: "Comparison completed", result });
        } catch (error) {
            console.error("Direct Compare Error:", error);
            res.status(500).json({ error: error.message || "Failed to run comparison." });
        }
    };
}

module.exports = new AnalysisController();