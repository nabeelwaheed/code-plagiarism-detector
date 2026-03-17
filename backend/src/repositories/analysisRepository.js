const db = require('../database/db');

class AnalysisRepository {
	
    async createJob(assignmentId, templateId, userId, params) {
        let sql = `
            INSERT INTO public."AnalysisJob" (id, assignment_id, template_version_id, status, params, triggered_by)
            VALUES (gen_random_uuid(), $1, $2, 'pending', $3, $4)
            RETURNING id, assignment_id, template_version_id, status, params, triggered_by`;
        let result = await db.query(sql, [assignmentId, templateId, params, userId]);
        return result.rows[0];
    }

    async updateJobStatus(jobId, status, finishedAt = null) {
        let sql = `UPDATE public."AnalysisJob" SET status = $1, finished_at = $2 WHERE id = $3`;
        await db.query(sql, [status, finishedAt, jobId]);
    }

    async createSimilarityPair(jobId, subA, subB, score) {
        let sql = `
            INSERT INTO public."SimilarityPair" (id, job_id, sub_a_id, sub_b_id, score)
            VALUES ($5, $1, $2, $3, $4) RETURNING id`;
        let result = await db.query(sql, [jobId, subA, subB, score, Date.now()]);
        return result.rows[0].id;
    }

    async addEvidenceSpan(pairId, startLine, endLine) {
        let sql = `INSERT INTO public."EvidenceSpan" (id, pair_id, start_line, end_line) 
                     VALUES ($4, $1, $2, $3)`;
        await db.query(sql, [pairId, startLine, endLine, Date.now()]);
    }

    async getResults(jobId) {
		let sql = `
			SELECT p.*, s.start_line, s.end_line 
			FROM public."SimilarityPair" p
			LEFT JOIN public."EvidenceSpan" s ON p.id = s.pair_id
			WHERE p.job_id = $1`;
        let result = await db.query(sql, [jobId]);
        return result.rows;
    }
}

module.exports = new AnalysisRepository();