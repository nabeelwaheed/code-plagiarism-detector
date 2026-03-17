const analysisRepository = require('../repositories/analysisRepository');
const enrollmentRepository = require('../repositories/enrollmentRepository');
const assignmentRepository = require('../repositories/assignmentRepository');
const zipExtractorService = require('./zipExtractorService') //Added service here (K)
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const ENGINE_PATH = path.join(__dirname, 'engine.exe');

class AnalysisService {
	
	/**
     * @param {Object} subA - Submission object
     * @param {Object} subB - Submission object
     * @param {string} language - 'c' or 'cpp'
     */
    async compareSubmissions(subA, subB, language = 'cpp') {
        let clrSubA = subA.map(file => file.content).join('\n');
        let clrSubB = subB.map(file => file.content).join('\n');
        const requestData = {
            schema_version: "1.0",
            engine_version: "0.1.0",
            language: language, 
            submissions: [
                {
                    submission_id: "template",
                    source: clrSubA
                }, 
                {
                    submission_id: "student",
                    source: clrSubB
                }
            ],
            params: { k_gram: 5, window: 10, gst_min_match: 10, top_k: 5 }
        };

        const inputPath = path.join(__dirname, 'req_compare.json');
        const outputPath = path.join(__dirname, 'out_compare.json');

        fs.writeFileSync(inputPath, JSON.stringify(requestData));

        try {
            execSync(`"${ENGINE_PATH}" ccpp rank --input "${inputPath}" --output "${outputPath}"`);

            return JSON.parse(fs.readFileSync(outputPath, 'utf8'));
        } catch (error) {
            console.error("Comparison execution failed:", error);
            throw new Error(`Engine comparison failed for language: ${language}`);
        }
    }
	
	
    async startAnalysis(userId, courseId, assignmentId, templateId, submissionId, params) { //Adding more parameters
		
        let role = await enrollmentRepository.getEnrollmentRole(courseId, userId);
		let validRoles = ['instructor', 'admin', 'ta'];
        if (!validRoles.includes(role)) throw new Error("Unauthorized");
		
        let template = await assignmentRepository.getTemplateByAssignmentId(assignmentId,templateId);
        if (!template) throw new Error("No template found for this assignment");
        let assignment = await assignmentRepository.getSubmissionById(assignmentId,submissionId); //Added function
        let student = await assignmentRepository.getStudent(submissionId);
        //Paths to directory for template and assignment
        let templatePath = path.join('AssignmentRepository',String(courseId),String(assignmentId),'template',`v${template.version}.zip`);
        let submissionPath = path.join('AssignmentRepository',String(courseId),String(assignmentId),'Submissions',`${student.student_id}`,`${student.student_id}.zip`);
        
		//Call the other function compareSubmissions here, after extracting the zips of both assignments 
        let assign1 = zipExtractorService.extraction(templatePath); //I'm assuming assignmentId is the student assignment?
        let assign2 = zipExtractorService.extraction(submissionPath); //I'm also assuming you extracted the base template from student assignment?
        let output = await this.compareSubmissions(assign1,assign2,'cpp'); //Temporary java
        let theScore = 0;
        if (output.pairs && output.pairs.length>0) {
            theScore = output.pairs[0].score_primary;
        }

		//Use the methods on analysisRepository to save to database, create ones if there's something missing (I don't think so )
        //Okay so there is this method called createSimilarityPair which holds jobId, both assignments, and score
        //I'm assuming that's where we'd store our finished analysis, if thats the case \/
        let job = await analysisRepository.createJob(assignmentId, template.id, userId, params);
        let pair = await analysisRepository.createSimilarityPair(job.id,template.id,assignment.id,theScore);
        //await analysisRepository.addEvidenceSpan(pair.id,)
        //return await analysisRepository.createJob(assignmentId, template.id, userId, params);
        return job;
    }
	
	async getResults(jobId) {
		return await analysisRepository.getResults(jobId);
	}
}

module.exports = new AnalysisService();