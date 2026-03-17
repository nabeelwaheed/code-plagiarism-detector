const assignmentService = require('../services/assignmentService');

class AssignmentController {
    create = async (req, res) => {
        let file = req.files?.file;
        if (!file) throw new Error("Assignment file is required");

        let assignment = await assignmentService.createAssignment(
            req.user.id, 
            req.params.courseId, 
            { title: req.body.title, dueDate: req.body.due_date }, 
            file
        );
        res.status(201).json(assignment);
    }

    list = async (req, res) => {
        let assignments = await assignmentService.getAssignmentsByCourse(req.user.id, req.params.courseId);
        res.json(assignments);
    }

    editFile = async (req, res) => {
        let file = req.files?.file;
        if (!file) throw new Error("New assignment file is required");

        await assignmentService.editAssignmentFile(req.user.id, req.params.courseId, req.params.assignmentId, req.body.title, file);
        res.json({ message: "Assignment file updated successfully" });
    }

    delete = async (req, res) => {
        await assignmentService.deleteAssignment(req.user.id, req.params.courseId, req.params.assignmentId);
        res.json({ message: "Assignment deleted successfully" });
    }

    uploadTemplate = async (req, res) => {
        let file = req.files?.file;
        if (!file) throw new Error("Template file is required");

        await assignmentService.uploadTemplate(req.user.id, req.params.courseId, req.params.assignmentId, req.body.version, file);
        res.status(201).json({ message: "Template uploaded successfully" });
    }

    submit = async (req, res) => {
        let submission = await assignmentService.submitAssignment(
            req.user.id, 
            req.params.courseId, 
            req.params.assignmentId, 
            req.body.metadata, 
            req.files.file
        );
        res.status(201).json(submission);
    }

    replaceSubmission = async (req, res) => {
        await assignmentService.replaceSubmission(req.user.id, req.params.courseId, req.params.assignmentId, req.files.file);
        res.json({ message: "Submission replaced" });
    }

    deleteSubmission = async (req, res) => {
        await assignmentService.deleteSubmission(req.user.id, req.params.courseId, req.params.assignmentId);
        res.json({ message: "Submission deleted" });
    }

    getAllSubmissions = async (req, res) => { //Added function
        let submissions = await assignmentService.allAvailableSubmissions();
        res.status(200).json(submissions);
    }

    getAllTemplates = async (req, res) => { //Added function
        let templates = await assignmentService.allAvailableTemplates(req.params.assignmentId);
        res.status(200).json(templates);
    }
}

module.exports = new AssignmentController();