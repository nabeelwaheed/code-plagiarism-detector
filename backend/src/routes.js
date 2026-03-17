const express = require('express');
const router = express.Router();
const analysisController = require('./controllers/analysisController');
const userController = require('./controllers/userController');
const courseController = require('./controllers/courseController');
const assignmentController = require('./controllers/assignmentController');
const enrollmentController = require('./controllers/enrollmentController');
const {requireAuth} = require('./auth/authenticator');

router.post('/users/register', userController.register);
router.post('/users/registerI',userController.registerI) //Added instructor registration route
router.post('/users/login', userController.login);
router.patch('/users/:id/promote', userController.promote);
router.patch('/users/password', userController.updatePassword);

router.post('/courses',requireAuth,courseController.create); //Added requireAuth
router.get('/courses',courseController.getAllCourses); //Added another route for getting all courses
router.patch('/courses/:id/status', courseController.updateStatus);

router.get('/enrollments/my-courses', enrollmentController.getMyCourses);
router.post('/courses/:courseId/enroll',requireAuth,enrollmentController.enroll); //Added requireAuth
router.delete('/courses/:courseId/enroll/:userId', enrollmentController.remove);

router.post('/courses/:courseId/assignments',requireAuth,assignmentController.create); //Added requireAuth
router.get('/courses/:courseId/assignments',requireAuth,assignmentController.list); //Added requireAuth
router.patch('/courses/:courseId/assignments/:assignmentId/file', assignmentController.editFile);
router.delete('/courses/:courseId/assignments/:assignmentId', assignmentController.delete);

router.post('/courses/:courseId/assignments/:assignmentId/template',requireAuth,assignmentController.uploadTemplate); //Added requireAuth
router.post('/courses/:courseId/assignments/:assignmentId/submit',requireAuth,assignmentController.submit); //Added requireAuth
router.put('/courses/:courseId/assignments/:assignmentId/submit', assignmentController.replaceSubmission);
router.get('/courses/:courseId/assignments/:assignmentId/submit',assignmentController.getAllSubmissions); //Added another route for getting all submissions
router.get('/courses/:courseId/assignments/:assignmentId/template',assignmentController.getAllTemplates); //Added another route for getting all templates
router.delete('/courses/:courseId/assignments/:assignmentId/submit', assignmentController.deleteSubmission);

router.post('/courses/:courseId/assignments/:assignmentId/analyze',requireAuth,analysisController.trigger); //Added requireAuth
router.get('/analysis/jobs/:jobId', analysisController.getResults);

module.exports = router;