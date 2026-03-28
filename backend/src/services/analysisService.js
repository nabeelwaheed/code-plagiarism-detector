const analysisRepository = require('../repositories/analysisRepository');
const enrollmentRepository = require('../repositories/enrollmentRepository');
const assignmentRepository = require('../repositories/assignmentRepository');
const zipExtractorService = require('./zipExtractorService');

const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

// Note for the backend guys: we have to change this before deployment cuz current approach is a security vulnerability! 
const ENGINE_PATH =
    process.env.ENGINE_PATH || path.join(__dirname, 'engine.exe');
const ENGINE_JAVA_PATH = process.env.ENGINE_JAVA_PATH || path.join(__dirname, 'cosc_4p02.exe');

const ALLOWED_LANGUAGES = new Set(['c', 'cpp', 'java']);

class AnalysisService {
    async startAnalysis(userId, courseId, assignmentId, templateId = null, params = {}, language = 'cpp') {
        await this.assertAnalysisPermission(userId, courseId);
        this.assertLanguage(language);

        const job = await this.createJobSafe({
            assignmentId,
            templateId,
            createdBy: userId,
            params,
            mode: 'batch',
            language
        });

        try {
            await this.updateJobStatusSafe(job.id, 'running');
            const submissions = await this.getAssignmentSubmissions(assignmentId);
            
            if (!Array.isArray(submissions) || submissions.length < 2) {
                throw new Error('At least two submissions are required for analysis');
            }

            let engineOutput;

            if (language === 'java') {
                const engineSubmissions = [];
                for (const sub of submissions) {
                    const sourceText = await this.getSubmissionText(sub, courseId, assignmentId);
                    engineSubmissions.push({
                        submission_id: String(sub.id || sub.submission_id || sub.student_id),
                        source: sourceText
                    });
                }

                const requestData = {
                    language: "java",
                    submissions: engineSubmissions
                };

                engineOutput = await this.runJavaAnalysis(requestData);
            } else {
                const engineSubmissions = [];
                for (const submission of submissions) {
                    const prepared = await this.prepareSubmissionForEngine(submission, { courseId, assignmentId });
                    engineSubmissions.push({
                        submission_id: String(submission.id ?? submission.submission_id),
                        source: prepared.source,
                        source_map: prepared.sourceMap
                    });
                }

                const requestData = {
                    schema_version: '1.0',
                    engine_version: '0.1.0',
                    language,
                    submissions: engineSubmissions,
                    params: this.buildParams(params)
                };

                engineOutput = await this.runCppAnalysis(requestData);
            }

            await this.persistBatchResults(job.id, engineOutput);
            await this.updateJobStatusSafe(job.id, 'completed');

            return { job, result: engineOutput };
        } catch (error) {
            await this.updateJobStatusSafe(job.id, 'failed', error.message);
            console.error('Analysis failed:', error);
            throw error;
        }
    }

    async getSubmissionText(submission, courseId, assignmentId) {
        try {
            const zipPath = this.resolveSubmissionZipPath(submission, { courseId, assignmentId });
            const absolutePath = path.resolve(process.cwd(), zipPath);
            
            if (!fsSync.existsSync(absolutePath)) {
                console.warn(`Zip file not found: ${absolutePath}`);
                return "";
            }

            const files = zipExtractorService.extract(absolutePath);
            if (!files || files.length === 0) return "";

            return files
                .map(f => `// --- ${f.filePath} ---\n${f.content}`)
                .join('\n\n');
        } catch (err) {
            console.error("getSubmissionText Error:", err.message);
            return "";
        }
    }

    async runJavaAnalysis(requestData) {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'java-analysis-'));
        const inputPath = path.join(tmpDir, 'input.json');
        
        try {
            await fs.writeFile(inputPath, JSON.stringify(requestData, null, 2), 'utf8');

            const { stdout, stderr } = await execFileAsync(ENGINE_JAVA_PATH, [inputPath], {
                timeout: 120000,
                maxBuffer: 10 * 1024 * 1024
            });

            if (stderr) console.warn("Java Engine Stderr:", stderr);
            
            return JSON.parse(stdout);
        } catch (error) {
            throw new Error(`Java Engine Execution failed: ${error.message}`);
        } finally {
            await this.safeRemoveDir(tmpDir);
        }
    }

    async runCppAnalysis(requestData) {
        return await this.runEngineCommand('rank', requestData);
    }



    async runEngineCommand(command, requestData, extraArgs = []) {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'code-sim-engine-'));
        const inputPath = path.join(tmpDir, `${command}-in.json`);
        const outputPath = path.join(tmpDir, `${command}-out.json`);

        try {
            await fs.writeFile(inputPath, JSON.stringify(requestData, null, 2), 'utf8');

            const args = [
                'ccpp',
                command,
                '--input', inputPath,
                ...extraArgs,
                '--output', outputPath
            ];

            await execFileAsync(ENGINE_PATH, args, { timeout: 120000 });

            if (!fsSync.existsSync(outputPath)) {
                throw new Error(`Engine output file missing for ${command}`);
            }

            const rawOutput = await fs.readFile(outputPath, 'utf8');
            return JSON.parse(rawOutput);
        } finally {
            await this.safeRemoveDir(tmpDir);
        }
    }

    async compareTwoSubmissions(
        userId,
        courseId,
        assignmentId,
        submissionAId,
        submissionBId,
        templateId = null,
        params = {},
        language = 'cpp'
    ) {
        await this.assertAnalysisPermission(userId, courseId);
        this.assertLanguage(language);

        if (!submissionAId || !submissionBId) {
            throw new Error('Both submission IDs are required');
        }

        if (String(submissionAId) === String(submissionBId)) {
            throw new Error('submissionAId and submissionBId must be different');
        }

        const submissionA = await this.getSubmissionById(assignmentId, submissionAId);
        const submissionB = await this.getSubmissionById(assignmentId, submissionBId);

        if (!submissionA || !submissionB) {
            throw new Error('One or both submissions were not found');
        }

        const preparedA = await this.prepareSubmissionForEngine(submissionA, {
            courseId,
            assignmentId
        });

        const preparedB = await this.prepareSubmissionForEngine(submissionB, {
            courseId,
            assignmentId
        });

        let templatePayload = null;
        if (templateId) {
            const template = await this.getAssignmentTemplate(assignmentId, templateId);
            if (template) {
                const preparedTemplate = await this.prepareTemplateForEngine(template, {
                    courseId,
                    assignmentId
                });

                templatePayload = {
                    source: preparedTemplate.source,
                    source_map: preparedTemplate.sourceMap
                };
            }
        }

        const aId = String(submissionA.id ?? submissionA.submission_id);
        const bId = String(submissionB.id ?? submissionB.submission_id);

        const requestData = {
            schema_version: '1.0',
            engine_version: '0.1.0',
            language,
            submissions: [
                {
                    submission_id: aId,
                    source: preparedA.source,
                    source_map: preparedA.sourceMap
                },
                {
                    submission_id: bId,
                    source: preparedB.source,
                    source_map: preparedB.sourceMap
                }
            ],
            params: this.buildParams(params),
            ...(templatePayload ? { template: templatePayload } : {})
        };
        return await this.runCompare(requestData, aId, bId);
    }

    async getResults(jobId) {
        return await analysisRepository.getResults(jobId);
    }

    async assertAnalysisPermission(userId, courseId) {
        const role = await enrollmentRepository.getEnrollmentRole(courseId, userId);
        const validRoles = ['instructor', 'admin', 'ta'];

        if (!validRoles.includes(role)) {
            throw new Error('Unauthorized');
        }
    }

    assertLanguage(language) {
        if (!ALLOWED_LANGUAGES.has(language)) {
            throw new Error(`Unsupported language: ${language}`);
        }
    }

    buildParams(params = {}) {
        return {
            k_gram: params.k_gram ?? 5,
            window: params.window ?? 10,
            gst_min_match: params.gst_min_match ?? 10,
            top_k: params.top_k ?? 50,
            threshold_primary:
                typeof params.threshold_primary === 'number'
                    ? params.threshold_primary
                    : undefined,
            options: {
                ignore_comments: params.ignore_comments ?? true,
                ignore_pp_directives: params.ignore_pp_directives ?? true,
                consistent_identifier_renaming: true,
                anonymize_literals: true
            }
        };
    }

    async prepareSubmissionForEngine(submission, context) {
        const zipPath = this.resolveSubmissionZipPath(submission, context);

        const files = zipExtractorService.extract(zipPath);
        return await this.prepareFilesForEngine(files);
    }

    async prepareTemplateForEngine(template, context) {
        const zipPath = this.resolveTemplateZipPath(template, context);

        const files = zipExtractorService.extract(zipPath);
        return await this.prepareFilesForEngine(files);
    }

    async prepareFilesForEngine(files) {
        if (!Array.isArray(files) || files.length === 0) {
            throw new Error('No source files available for engine');
        }

        if (files.length === 1) {
            return {
                source: files[0].content.endsWith('\n')
                    ? files[0].content
                    : `${files[0].content}\n`,
                sourceMap: [
                    {
                        file_path: files[0].filePath,
                        byte_start: 0,
                        byte_end: Buffer.byteLength(
                            files[0].content.endsWith('\n')
                                ? files[0].content
                                : `${files[0].content}\n`,
                            'utf8'
                        )
                    }
                ]
            };
        }

        return await this.runConcat(files);
    }

    async runRank(requestData) {
        return await this.runEngineCommand('rank', requestData);
    }

    async runCompare(requestData, aId, bId) {
        return await this.runEngineCommand('compare', requestData, [
            '--a-id',
            String(aId),
            '--b-id',
            String(bId)
        ]);
    }

    async runConcat(files) {
        const concatRequest = {
            files: files.map(file => ({
                file_path: file.filePath,
                source: file.content
            }))
        };

        return await this.runEngineCommand('concat', concatRequest);
    }

    async runEngineCommand(command, requestData, extraArgs = []) {
        const tmpDir = await fs.mkdtemp(
            path.join(os.tmpdir(), 'code-sim-engine-')
        );

        const inputPath = path.join(
            tmpDir,
            `${command}-${crypto.randomUUID()}-in.json`
        );
        const outputPath = path.join(
            tmpDir,
            `${command}-${crypto.randomUUID()}-out.json`
        );

        try {
            await fs.writeFile(inputPath, JSON.stringify(requestData, null, 2), 'utf8');

            const args = [
                'ccpp',
                command,
                '--input',
                inputPath,
                ...extraArgs,
                '--output',
                outputPath
            ];

            const { stdout, stderr } = await execFileAsync(ENGINE_PATH, args, {
                timeout: 120000,
                maxBuffer: 10 * 1024 * 1024
            });

            if (stdout) {
                console.log(`[engine ${command}] stdout:`, stdout);
            }
            if (stderr) {
                console.log(`[engine ${command}] stderr:`, stderr);
            }

            if (!fsSync.existsSync(outputPath)) {
                throw new Error(`Engine did not produce output for command: ${command}`);
            }

            const rawOutput = await fs.readFile(outputPath, 'utf8');
            return JSON.parse(rawOutput);
        } catch (error) {
            const details =
                error.stderr?.toString?.() ||
                error.stdout?.toString?.() ||
                error.message;

            console.error(`Engine ${command} failed:`, details);
            throw new Error(`Engine ${command} failed: ${details}`);
        } finally {
            await this.safeRemoveFile(inputPath);
            await this.safeRemoveFile(outputPath);
            await this.safeRemoveDir(tmpDir);
        }
    }

    async persistBatchResults(jobId, engineOutput) {
        if (!engineOutput || !Array.isArray(engineOutput.pairs)) {
            return;
        }

        for (const pair of engineOutput.pairs) {
            const createdPairId = await analysisRepository.createSimilarityPair(
                jobId,
                pair.a_id,
                pair.b_id,
                pair.score_primary,
                pair.score_secondary
            );

            if (
                createdPairId &&
                Array.isArray(pair.matches) &&
                typeof analysisRepository.addEvidenceSpan === 'function'
            ) {
                for (const match of pair.matches) {
                    await analysisRepository.addEvidenceSpan(createdPairId, match);
                }
            }
        }
    }

    async createJobSafe({ assignmentId, templateId, createdBy, params, mode, language }) {
        if (typeof analysisRepository.createJob === 'function') {
            return await analysisRepository.createJob(
                assignmentId,
                templateId,
                createdBy,
                {
                    ...params,
                    mode,
                    language
                }
            );
        }

        throw new Error('analysisRepository.createJob is required');
    }

    async updateJobStatusSafe(jobId, status, errorMessage = null) {
        if (typeof analysisRepository.updateJobStatus === 'function') {
            await analysisRepository.updateJobStatus(jobId, status, errorMessage);
        }
    }

    async getAssignmentSubmissions(assignmentId) {
        if (typeof assignmentRepository.getSubmissionsByAssignmentId === 'function') {
            return await assignmentRepository.getSubmissionsByAssignmentId(assignmentId);
        }
        if (typeof assignmentRepository.getAllSubmissionsByAssignmentId === 'function') {
            return await assignmentRepository.getAllSubmissionsByAssignmentId(assignmentId);
        }
        throw new Error(
            'Missing repository method: getSubmissionsByAssignmentId or getAllSubmissionsByAssignmentId'
        );
    }

    async getSubmissionById(assignmentId, submissionId) {
        if (typeof assignmentRepository.getSubmissionById === 'function') {
            return await assignmentRepository.getSubmissionById(assignmentId, submissionId);
        }
        throw new Error('Missing repository method: getSubmissionById');
    }

    async getAssignmentTemplate(assignmentId, templateId) {
        if (typeof assignmentRepository.getTemplateByAssignmentId === 'function') {
            return await assignmentRepository.getTemplateByAssignmentId(
                assignmentId,
                templateId
            );
        }
        return null;
    }

    resolveSubmissionZipPath(submission, { courseId, assignmentId }) {
        if (submission.zip_path) return submission.zip_path;
        if (submission.zipPath) return submission.zipPath;
        if (submission.archive_path) return submission.archive_path;

        const studentId =
            submission.student_id ||
            submission.studentId ||
            submission.user_id ||
            submission.userId;

        if (!studentId) {
            throw new Error(
                `Unable to resolve zip path for submission ${submission.id ?? submission.submission_id}`
            );
        }

        return path.join(
            'AssignmentRepository',
            String(courseId),
            String(assignmentId),
            'Submissions',
            String(studentId),
            `${studentId}.zip`
        );
    }

    resolveTemplateZipPath(template, { courseId, assignmentId }) {
        if (template.zip_path) return template.zip_path;
        if (template.zipPath) return template.zipPath;
        if (template.archive_path) return template.archive_path;

        if (template.version == null) {
            throw new Error('Unable to resolve template zip path: missing template version');
        }

        return path.join(
            'AssignmentRepository',
            String(courseId),
            String(assignmentId),
            'template',
            `v${template.version}.zip`
        );
    }

    async safeRemoveFile(filePath) {
        try {
            if (filePath && fsSync.existsSync(filePath)) {
                await fs.unlink(filePath);
            }
        } catch (error) {
            console.warn('Failed to remove temp file:', filePath, error.message);
        }
    }

    async safeRemoveDir(dirPath) {
        try {
            if (dirPath && fsSync.existsSync(dirPath)) {
                await fs.rm(dirPath, { recursive: true, force: true });
            }
        } catch (error) {
            console.warn('Failed to remove temp dir:', dirPath, error.message);
        }
    }

    async getPairDetails(jobId, pairId) {
        const pairRecord = await analysisRepository.getPairById(pairId);
        if (!pairRecord) return null;
        const matchSpans = await analysisRepository.getEvidenceSpans(pairId);
        const jobRecord = await analysisRepository.getJobById(jobId);
        if (!jobRecord) return null;
        const assignmentId = jobRecord.assignment_id;
        const assignment = await assignmentRepository.getAssignmentById(assignmentId);
        if (!assignment) {
            return null;
        }

        const courseId = assignment.course_id; 
        const submissionA = await assignmentRepository.getSubmissionById(assignmentId, pairRecord.sub_a_id);
        const submissionB = await assignmentRepository.getSubmissionById(assignmentId, pairRecord.sub_b_id);

        let fileAText = "// Could not extract Submission A.";
        let fileBText = "// Could not extract Submission B.";

        if (!submissionA || !submissionB) {
            return { ...pairRecord, fileA_text: fileAText, fileB_text: fileBText, language: "cpp" };
        }

        try {
            const subAZipPath = this.resolveSubmissionZipPath(submissionA, { courseId, assignmentId });
            const subBZipPath = this.resolveSubmissionZipPath(submissionB, { courseId, assignmentId });

            const filesA = zipExtractorService.extract(path.resolve(process.cwd(), subAZipPath));
            const filesB = zipExtractorService.extract(path.resolve(process.cwd(), subBZipPath));

            if (filesA.length > 0) {
                fileAText = filesA.map(f => `// --- ${f.filePath} ---\n${f.content}`).join('\n\n');
            }
            if (filesB.length > 0) {
                fileBText = filesB.map(f => `// --- ${f.filePath} ---\n${f.content}`).join('\n\n');
            }

        } catch (err) {
            console.error("Extractor or File Read Error:", err.message);
        }

        return {
            ...pairRecord,
            matches: matchSpans,
            fileA_text: fileAText,
            fileB_text: fileBText,
            language: "cpp"
        };
    }

    async getAllJobs() {
        return await analysisRepository.getAllJobs();
    }
}

module.exports = new AnalysisService();