const analysisService = require('../services/analysisService');

class AnalysisController {
	
    trigger = async (req, res) => {
        let { courseId, assignmentId } = req.params;
        let { template, submission } = req.body;
        let job = await analysisService.startAnalysis(
            req.user.id, 
            courseId, 
            assignmentId,
            template,
            submission,
            req.body.params
        );
        res.status(202).json(job);
    }

    getResults = async (req, res) => {
        let results = await analysisService.getResults(req.params.jobId);
        res.json(results);
    }
}

module.exports = new AnalysisController();