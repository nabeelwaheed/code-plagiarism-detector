BEGIN;

CREATE TABLE IF NOT EXISTS public."User"
(
    id uuid NOT NULL,
    email character varying(100) NOT NULL,
    name character varying(100) NOT NULL,
    role character varying(100) NOT NULL,
	password_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY (id),
    CONSTRAINT unique_email UNIQUE (email)
);

CREATE TABLE IF NOT EXISTS public."Course"
(
    id uuid NOT NULL,
    course_code character varying(20) NOT NULL,
    term character varying(20) NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    CONSTRAINT "course_pkey" PRIMARY KEY (id),
    CONSTRAINT course_term UNIQUE (course_code, term)
);

CREATE TABLE IF NOT EXISTS public."Enrollment"
(
    course_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role character varying(20) NOT NULL,
    CONSTRAINT "Enrollment_pkey" PRIMARY KEY (course_id, user_id),
    CONSTRAINT fk_course FOREIGN KEY (course_id) REFERENCES public."Course"(id),
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES public."User"(id)
);

CREATE TABLE IF NOT EXISTS public."Assignment"
(
    id uuid NOT NULL,
    course_id uuid NOT NULL,
    title character varying(100) NOT NULL,
    due_date timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Assignment_pkey" PRIMARY KEY (id),
    CONSTRAINT course_title UNIQUE (course_id, title),
    CONSTRAINT "course_id_fkey" FOREIGN KEY (course_id)
        REFERENCES public."Course" (id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public."AssignmentTemplate"
(
    id uuid NOT NULL,
    assignment_id uuid NOT NULL,
    version integer NOT NULL,
    CONSTRAINT "Template_pkey" PRIMARY KEY (id),
    CONSTRAINT assignment_version UNIQUE (assignment_id, version),
    CONSTRAINT "Assignment_id_fkey" FOREIGN KEY (assignment_id)
        REFERENCES public."Assignment" (id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public."Submission"
(
    id uuid NOT NULL,
    assignment_id uuid NOT NULL,
    student_id uuid NOT NULL,
    submission_date timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    metadata jsonb NOT NULL,
    CONSTRAINT "Submission_pkey" PRIMARY KEY (id),
    CONSTRAINT "Assignment_id_fkey" FOREIGN KEY (assignment_id)
        REFERENCES public."Assignment" (id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT "Student_id_fkey" FOREIGN KEY (student_id)
        REFERENCES public."User" (id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public."AnalysisJob"
(
    id uuid NOT NULL,
    assignment_id uuid NOT NULL,
    template_version_id uuid,
    status character varying(50) NOT NULL,
    params jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    finished_at timestamp with time zone,
    triggered_by uuid NOT NULL,
    CONSTRAINT "AnalysisJob_pkey" PRIMARY KEY (id),
    CONSTRAINT "Assignment_id_fkey" FOREIGN KEY (assignment_id)
        REFERENCES public."Assignment" (id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT "Template_version_id_fkey" FOREIGN KEY (template_version_id)
        REFERENCES public."AssignmentTemplate" (id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT "Triggered_by_fkey" FOREIGN KEY (triggered_by)
        REFERENCES public."User" (id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public."SimilarityPair"
(
    id bigserial NOT NULL,
    job_id uuid NOT NULL,
    sub_a_id uuid NOT NULL,
    sub_b_id uuid NOT NULL,
    score real NOT NULL,
    CONSTRAINT "SimilarityPair_pkey" PRIMARY KEY (id),
    CONSTRAINT "Job_id_fkey" FOREIGN KEY (job_id)
        REFERENCES public."AnalysisJob" (id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT "Sub_a_id_fkey" FOREIGN KEY (sub_a_id)
        REFERENCES public."Submission" (id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT "Sub_b_id_fkey" FOREIGN KEY (sub_b_id)
        REFERENCES public."Submission" (id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public."EvidenceSpan"
(
    id bigserial NOT NULL,
    pair_id bigint NOT NULL,
    start_line integer NOT NULL,
    end_line integer NOT NULL,
    CONSTRAINT "EvidenceSpan_pkey" PRIMARY KEY (id),
    CONSTRAINT "Pair_id_fkey" FOREIGN KEY (pair_id)
        REFERENCES public."SimilarityPair" (id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public."AuditLog"
(
    id bigserial NOT NULL,
    user_id uuid NOT NULL,
    action character varying(100) NOT NULL,
    target_id uuid NOT NULL,
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY (id),
    CONSTRAINT "User_id_fkey" FOREIGN KEY (user_id)
        REFERENCES public."User" (id) ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE INDEX idx_assignment_course_id ON public."Assignment"(course_id);
CREATE INDEX idx_template_assignment_id ON public."AssignmentTemplate"(assignment_id);
CREATE INDEX IF NOT EXISTS fki_submission_assignment ON public."Submission"(assignment_id);
CREATE INDEX IF NOT EXISTS fki_job_assignment ON public."AnalysisJob"(assignment_id);
CREATE INDEX idx_enrollment_user_id ON public."Enrollment"(user_id);

END;