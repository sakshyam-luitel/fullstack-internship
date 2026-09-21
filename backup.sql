--
-- PostgreSQL database dump
--

\restrict 8HQrQd1JabZWe0qF2zF4CtJlIbsbnL3EHyXD90AQIr8Cfa2U4Uwd3lOId3b1DoW

-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: degreelevel; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.degreelevel AS ENUM (
    'bachelors',
    'masters',
    'phd'
);


ALTER TYPE public.degreelevel OWNER TO postgres;

--
-- Name: phasetype; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.phasetype AS ENUM (
    'proposal',
    'progress_report',
    'defense'
);


ALTER TYPE public.phasetype OWNER TO postgres;

--
-- Name: role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.role AS ENUM (
    'super_admin',
    'admin',
    'student',
    'professor',
    'external'
);


ALTER TYPE public.role OWNER TO postgres;

--
-- Name: submissionentitytype; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.submissionentitytype AS ENUM (
    'proposal',
    'progress_report',
    'defense'
);


ALTER TYPE public.submissionentitytype OWNER TO postgres;

--
-- Name: submissionstatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.submissionstatus AS ENUM (
    'pending',
    'accepted',
    'rejected'
);


ALTER TYPE public.submissionstatus OWNER TO postgres;

--
-- Name: userrole; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.userrole AS ENUM (
    'SUPER_ADMIN',
    'DEPARTMENT_ADMIN',
    'STUDENT',
    'PROFESSOR',
    'EXTERNAL'
);


ALTER TYPE public.userrole OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);


ALTER TABLE public.alembic_version OWNER TO postgres;

--
-- Name: clusters; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.clusters (
    id uuid NOT NULL,
    department_id uuid NOT NULL,
    name character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.clusters OWNER TO postgres;

--
-- Name: conferencepresentations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.conferencepresentations (
    id uuid NOT NULL,
    conference_id uuid NOT NULL,
    paper_id uuid NOT NULL,
    presenter_id uuid NOT NULL
);


ALTER TABLE public.conferencepresentations OWNER TO postgres;

--
-- Name: conferences; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.conferences (
    id uuid NOT NULL,
    name character varying NOT NULL,
    location character varying,
    conference_date timestamp with time zone,
    description character varying
);


ALTER TABLE public.conferences OWNER TO postgres;

--
-- Name: deadlines; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.deadlines (
    id uuid NOT NULL,
    paper_id uuid NOT NULL,
    deadline_type character varying NOT NULL,
    due_date timestamp with time zone NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.deadlines OWNER TO postgres;

--
-- Name: defensepanels; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.defensepanels (
    id uuid NOT NULL,
    defense_id uuid NOT NULL,
    professor_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.defensepanels OWNER TO postgres;

--
-- Name: defenses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.defenses (
    id uuid NOT NULL,
    paper_id uuid,
    defense_date timestamp with time zone NOT NULL,
    location character varying,
    submission_confirmed boolean NOT NULL,
    scheduled_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    file_path character varying,
    original_filename character varying,
    file_size_bytes integer,
    content_type character varying,
    uploaded_at timestamp with time zone,
    checksum character varying,
    phase_id uuid,
    scheduled_time time without time zone,
    current_status character varying DEFAULT 'pending'::character varying NOT NULL,
    proposal_id uuid,
    progress_report_id uuid
);


ALTER TABLE public.defenses OWNER TO postgres;

--
-- Name: degreeprograms; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.degreeprograms (
    id uuid NOT NULL,
    name character varying NOT NULL,
    level public.degreelevel NOT NULL,
    department_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.degreeprograms OWNER TO postgres;

--
-- Name: departments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.departments (
    id uuid NOT NULL,
    name character varying NOT NULL,
    code character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


ALTER TABLE public.departments OWNER TO postgres;

--
-- Name: feedback; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.feedback (
    id uuid NOT NULL,
    progress_report_id uuid NOT NULL,
    supervisor_id uuid NOT NULL,
    content character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.feedback OWNER TO postgres;

--
-- Name: journalsubmissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.journalsubmissions (
    id uuid NOT NULL,
    paper_id uuid NOT NULL,
    status character varying NOT NULL,
    submitted_at timestamp with time zone DEFAULT now() NOT NULL,
    published_at timestamp with time zone
);


ALTER TABLE public.journalsubmissions OWNER TO postgres;

--
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notifications (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    paper_id uuid,
    type character varying NOT NULL,
    is_sent boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    phase_id uuid,
    title character varying DEFAULT ''::character varying NOT NULL,
    message character varying DEFAULT ''::character varying NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    defense_id uuid
);


ALTER TABLE public.notifications OWNER TO postgres;

--
-- Name: paperauthors; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.paperauthors (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    author_role character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    paper_id uuid NOT NULL
);


ALTER TABLE public.paperauthors OWNER TO postgres;

--
-- Name: papers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.papers (
    id uuid NOT NULL,
    supervisor_id uuid NOT NULL,
    proposal_id uuid,
    cluster_id uuid,
    title character varying NOT NULL,
    status character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    final_report_file_path character varying,
    final_report_original_filename character varying,
    final_report_file_size_bytes integer,
    final_report_content_type character varying,
    final_report_uploaded_at timestamp with time zone,
    final_report_checksum character varying,
    final_report_status character varying,
    final_report_review_comment character varying,
    final_report_reviewed_by uuid
);


ALTER TABLE public.papers OWNER TO postgres;

--
-- Name: peerreviews; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.peerreviews (
    id uuid NOT NULL,
    journal_submission_id uuid NOT NULL,
    reviewer_id uuid NOT NULL,
    decision character varying,
    comments character varying,
    reviewed_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.peerreviews OWNER TO postgres;

--
-- Name: professorprofile; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.professorprofile (
    user_id uuid NOT NULL,
    academic_rank character varying NOT NULL,
    max_students integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.professorprofile OWNER TO postgres;

--
-- Name: progressreports; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.progressreports (
    id uuid NOT NULL,
    paper_id uuid NOT NULL,
    submitted_by uuid NOT NULL,
    content character varying NOT NULL,
    status character varying NOT NULL,
    submitted_at timestamp with time zone DEFAULT now() NOT NULL,
    file_path character varying,
    original_filename character varying,
    file_size_bytes integer,
    content_type character varying,
    uploaded_at timestamp with time zone,
    checksum character varying,
    review_comment character varying,
    reviewed_by uuid,
    phase_id uuid
);


ALTER TABLE public.progressreports OWNER TO postgres;

--
-- Name: proposalcandidates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.proposalcandidates (
    id uuid NOT NULL,
    proposal_id uuid NOT NULL,
    student_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    status character varying DEFAULT 'pending'::character varying NOT NULL
);


ALTER TABLE public.proposalcandidates OWNER TO postgres;

--
-- Name: proposals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.proposals (
    id uuid NOT NULL,
    submitted_by uuid,
    title character varying NOT NULL,
    status character varying NOT NULL,
    reviewed_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cluster_id uuid,
    supervisor_id uuid,
    review_comment character varying,
    student_response character varying,
    responded_by uuid,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    file_path character varying,
    original_filename character varying,
    file_size_bytes integer,
    content_type character varying,
    uploaded_at timestamp with time zone,
    checksum character varying,
    phase_id uuid
);


ALTER TABLE public.proposals OWNER TO postgres;

--
-- Name: researchphases; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.researchphases (
    id uuid NOT NULL,
    phase_type public.phasetype NOT NULL,
    degree_level public.degreelevel NOT NULL,
    department_id uuid,
    label character varying NOT NULL,
    sequence_number integer NOT NULL,
    opens_at timestamp with time zone,
    deadline_at timestamp with time zone,
    defense_date timestamp with time zone,
    grace_period_enabled boolean DEFAULT false NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid
);


ALTER TABLE public.researchphases OWNER TO postgres;

--
-- Name: studentprofile; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.studentprofile (
    user_id uuid NOT NULL,
    degree_program_id uuid NOT NULL,
    supervisor_id uuid,
    status character varying DEFAULT 'active'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    roll_number character varying
);


ALTER TABLE public.studentprofile OWNER TO postgres;

--
-- Name: submissionhistory; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.submissionhistory (
    id uuid NOT NULL,
    entity_type public.submissionentitytype NOT NULL,
    entity_id uuid NOT NULL,
    phase_id uuid NOT NULL,
    submitted_by uuid NOT NULL,
    status public.submissionstatus NOT NULL,
    reviewed_by uuid,
    comments character varying,
    file_path character varying,
    original_filename character varying,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.submissionhistory OWNER TO postgres;

--
-- Name: submissionwindows; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.submissionwindows (
    id uuid NOT NULL,
    department_id uuid NOT NULL,
    phase character varying NOT NULL,
    due_at timestamp with time zone,
    is_closed boolean DEFAULT false NOT NULL,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.submissionwindows OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    department_id uuid,
    name character varying NOT NULL,
    email character varying NOT NULL,
    password character varying NOT NULL,
    role public.role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    avatar_url character varying,
    degree_program_id uuid
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Data for Name: alembic_version; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.alembic_version (version_num) FROM stdin;
20260926_defense_planning
\.


--
-- Data for Name: clusters; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.clusters (id, department_id, name, created_at) FROM stdin;
b8402cb1-39e0-4b23-b2e6-560ead3e142f	ce61445f-930c-498d-b7a1-9e4d3f016378	Artificial Intelligence and Machine Learning (AIML)	2026-09-09 12:39:14.728781+05:45
438c0c58-26e1-4fd3-aae2-0d3249cbde95	ce61445f-930c-498d-b7a1-9e4d3f016378	Electronic Devices and Machine Equiments System ( EDMES)	2026-09-14 13:36:16.046155+05:45
\.


--
-- Data for Name: conferencepresentations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.conferencepresentations (id, conference_id, paper_id, presenter_id) FROM stdin;
\.


--
-- Data for Name: conferences; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.conferences (id, name, location, conference_date, description) FROM stdin;
\.


--
-- Data for Name: deadlines; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.deadlines (id, paper_id, deadline_type, due_date, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: defensepanels; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.defensepanels (id, defense_id, professor_id, created_at) FROM stdin;
ef53881d-e8fa-4ed5-964e-245f942a2028	eecc9e74-ccb3-4df7-8aa9-26e03ff90f1b	d43291bc-2e6c-412c-8ed5-cc0f1b523e87	2026-09-17 09:04:32.158149+05:45
11287cc3-bb3b-492f-8a8f-c46009577fe5	eecc9e74-ccb3-4df7-8aa9-26e03ff90f1b	313e2525-1248-45b8-8691-7e84a676e0c3	2026-09-17 09:04:32.158149+05:45
79590412-3733-41bb-b9ab-5fe17b658e28	32ddfa76-3550-497c-843e-bc13b3e5df04	ea472eec-0a8a-4e4e-a602-79b0531849ea	2026-09-18 08:51:48.479711+05:45
f6ac6088-959e-47c5-b7d1-e033785c8e5f	09cac47e-184a-4435-a594-bf0c317e05bd	ea472eec-0a8a-4e4e-a602-79b0531849ea	2026-09-18 08:52:24.324039+05:45
\.


--
-- Data for Name: defenses; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.defenses (id, paper_id, defense_date, location, submission_confirmed, scheduled_by, created_at, file_path, original_filename, file_size_bytes, content_type, uploaded_at, checksum, phase_id, scheduled_time, current_status, proposal_id, progress_report_id) FROM stdin;
32ddfa76-3550-497c-843e-bc13b3e5df04	\N	2026-09-23 00:00:00+05:45	Phoksundo Block	f	5e1fcf35-271b-40d8-87ca-4a400de0ff7d	2026-09-18 08:51:48.479711+05:45	\N	\N	\N	\N	\N	\N	6be5471b-0229-40c0-b598-28d17acfe6dd	11:50:00	pending	d4358899-99ff-46f8-ac2c-4f2ab5f735eb	\N
09cac47e-184a-4435-a594-bf0c317e05bd	\N	2026-09-30 00:00:00+05:45	Lo Manthang Block	f	5e1fcf35-271b-40d8-87ca-4a400de0ff7d	2026-09-18 08:52:18.288643+05:45	\N	\N	\N	\N	\N	\N	6be5471b-0229-40c0-b598-28d17acfe6dd	14:00:00	pending	833e1056-f2d4-4929-9a23-f6546f38a803	\N
eecc9e74-ccb3-4df7-8aa9-26e03ff90f1b	\N	2026-09-17 00:00:00+05:45	Seminar Hall	f	8e021c80-697b-44a3-8427-f4c9e5d7d597	2026-09-16 22:46:06.962027+05:45	\N	\N	\N	\N	\N	\N	ad2ece69-8848-4365-81db-0d0409ddabfa	10:45:00	pending	\N	660eee36-d098-49ad-8f49-729dca3c8a93
\.


--
-- Data for Name: degreeprograms; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.degreeprograms (id, name, level, department_id, created_at) FROM stdin;
3a00c670-1d7e-44ce-a808-c954126dea35	Civil Engineering 	bachelors	3fa85f64-5717-4562-b3fc-2c963f66afa6	2026-09-11 12:58:32.680197+05:45
7506859d-0c46-4f07-9aac-e8ad54ddb8cd	Electronics Engineering	bachelors	ce61445f-930c-498d-b7a1-9e4d3f016378	2026-09-11 13:02:14.650094+05:45
40171749-0e87-4ef2-babf-a10c4d650efa	Bachelor's in Architecture	bachelors	6fb99b12-5941-4b8a-a939-31444e33c587	2026-09-14 08:08:03.062731+05:45
a5c8d12b-5254-4db6-83e9-cfee5e5a550a	Master's in Electronics Engineering	masters	ce61445f-930c-498d-b7a1-9e4d3f016378	2026-09-16 23:07:34.259556+05:45
47ade021-71b1-4f46-8f4f-dbb1a7d4db22	PhD in Electronics Engineering	phd	ce61445f-930c-498d-b7a1-9e4d3f016378	2026-09-16 23:08:08.353784+05:45
\.


--
-- Data for Name: departments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.departments (id, name, code, created_at, is_active) FROM stdin;
3fa85f64-5717-4562-b3fc-2c963f66afa6	Department of Civil Engineering	CVL	2026-09-03 09:52:55.984259+05:45	t
ce61445f-930c-498d-b7a1-9e4d3f016378	Department of Electronics Engineering	ELX	2026-09-03 08:57:22.581509+05:45	t
3de918bd-db27-46f1-8f11-ac5b0c6e010f	Department of Chemical Engineering	CHE	2026-09-09 09:16:00.2846+05:45	t
6447879f-f0f8-4580-891d-5f825c3ee7d6	Department of Mechanical Engineering	MEC	2026-09-11 13:26:03.143256+05:45	t
6fb99b12-5941-4b8a-a939-31444e33c587	Department of Architecture	ARC	2026-09-14 08:01:43.294156+05:45	f
d1ef1bf5-682f-40f4-8f94-54be82e69693	Department of Applied Sciences	ASC	2026-09-13 08:19:23.870809+05:45	f
\.


--
-- Data for Name: feedback; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.feedback (id, progress_report_id, supervisor_id, content, created_at) FROM stdin;
\.


--
-- Data for Name: journalsubmissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.journalsubmissions (id, paper_id, status, submitted_at, published_at) FROM stdin;
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.notifications (id, user_id, paper_id, type, is_sent, created_at, phase_id, title, message, is_read, defense_id) FROM stdin;
353a43e3-17a9-49d7-ba41-e2258f45ada6	313e2525-1248-45b8-8691-7e84a676e0c3	\N	phase_scheduled	f	2026-09-16 20:46:07.527557+05:45	81468587-aee9-4437-830d-ab3822d0a351	Progress report scheduled: Progress report 2	A new progress report phase has been scheduled for Bachelor's students. Submit before the deadline.	t	\N
6fa61bc4-42f8-4eab-99b9-b291a81f58ec	313e2525-1248-45b8-8691-7e84a676e0c3	\N	phase_scheduled	f	2026-09-16 21:44:38.68005+05:45	1f246a49-bee6-4a7d-b08a-ce1b168ef9b7	Proposal scheduled: Proposal submission	A new proposal phase has been scheduled for Master's students. Submit before the deadline.	t	\N
da91c117-f931-494f-b3b9-913a482a79ff	313e2525-1248-45b8-8691-7e84a676e0c3	\N	phase_scheduled	f	2026-09-16 21:55:35.135737+05:45	868fea79-67a5-416c-85fa-3423ec34d4cc	Proposal scheduled: Proposal submission	A new proposal phase has been scheduled for PhD students. Submit before the deadline.	t	\N
fd00d4c5-8c5c-43f7-9f56-6ee11f315df5	94a2549e-427f-4eb3-a872-6b265e3f1a05	2dcb32a0-038f-4143-8407-5d9e1779b65b	defense_rescheduled	f	2026-09-17 09:04:32.158149+05:45	ad2ece69-8848-4365-81db-0d0409ddabfa	Progress defense rescheduled: Commercial data mining: processing, analysis and modeling for predictive analytics projects	The progress defense for "Commercial data mining: processing, analysis and modeling for predictive analytics projects" has been rescheduled (at 10:45 in Seminar Hall).	f	eecc9e74-ccb3-4df7-8aa9-26e03ff90f1b
05b2c601-22f9-4cb8-898e-86b7f600d231	e18bb8d7-8b9d-4f1a-9862-ca9fd4ad8a43	2dcb32a0-038f-4143-8407-5d9e1779b65b	defense_rescheduled	f	2026-09-17 09:04:32.158149+05:45	ad2ece69-8848-4365-81db-0d0409ddabfa	Progress defense rescheduled: Commercial data mining: processing, analysis and modeling for predictive analytics projects	The progress defense for "Commercial data mining: processing, analysis and modeling for predictive analytics projects" has been rescheduled (at 10:45 in Seminar Hall).	f	eecc9e74-ccb3-4df7-8aa9-26e03ff90f1b
de448026-b0a2-48a9-9b00-89e95f76516e	8e5a3eb2-b32d-46f0-a5f3-6a7df4b75c48	2dcb32a0-038f-4143-8407-5d9e1779b65b	defense_rescheduled	f	2026-09-17 09:04:32.158149+05:45	ad2ece69-8848-4365-81db-0d0409ddabfa	Progress defense rescheduled: Commercial data mining: processing, analysis and modeling for predictive analytics projects	The progress defense for "Commercial data mining: processing, analysis and modeling for predictive analytics projects" has been rescheduled (at 10:45 in Seminar Hall).	t	eecc9e74-ccb3-4df7-8aa9-26e03ff90f1b
d6d5fb6a-d74f-4a7a-819b-97748c24d016	94a2549e-427f-4eb3-a872-6b265e3f1a05	\N	phase_scheduled	f	2026-09-16 22:40:59.999063+05:45	ad2ece69-8848-4365-81db-0d0409ddabfa	Progress report scheduled: Progress report 1	A new progress report phase has been scheduled for Bachelor's students. Submit before the deadline.	f	\N
8487c2c9-288d-42a7-85af-4e7a343588b9	01ce4d2b-4b02-4d8f-9108-cdf5c7a1cc2e	\N	phase_scheduled	f	2026-09-16 22:40:59.999063+05:45	ad2ece69-8848-4365-81db-0d0409ddabfa	Progress report scheduled: Progress report 1	A new progress report phase has been scheduled for Bachelor's students. Submit before the deadline.	f	\N
6cb8b43b-cd1e-4af1-8dd5-64a3d25af16b	d43291bc-2e6c-412c-8ed5-cc0f1b523e87	\N	phase_scheduled	f	2026-09-16 21:44:38.68005+05:45	1f246a49-bee6-4a7d-b08a-ce1b168ef9b7	Proposal scheduled: Proposal submission	A new proposal phase has been scheduled for Master's students. Submit before the deadline.	t	\N
edce22f2-23f0-44a2-9835-5e84ee34015b	313e2525-1248-45b8-8691-7e84a676e0c3	\N	phase_updated	f	2026-09-16 20:25:49.274756+05:45	2349f282-1890-4f18-b433-5f0ef72af011	Progress report updated: Progress Report 1	The dates for this progress report phase for Bachelor's students have changed.	t	\N
51840c22-a3b7-4ca9-9010-aad90ac2e6eb	e18bb8d7-8b9d-4f1a-9862-ca9fd4ad8a43	\N	phase_scheduled	f	2026-09-16 22:40:59.999063+05:45	ad2ece69-8848-4365-81db-0d0409ddabfa	Progress report scheduled: Progress report 1	A new progress report phase has been scheduled for Bachelor's students. Submit before the deadline.	f	\N
c61d8ed0-99cd-483b-b571-9cad6767308a	d43291bc-2e6c-412c-8ed5-cc0f1b523e87	\N	phase_scheduled	f	2026-09-16 21:55:35.135737+05:45	868fea79-67a5-416c-85fa-3423ec34d4cc	Proposal scheduled: Proposal submission	A new proposal phase has been scheduled for PhD students. Submit before the deadline.	t	\N
634a93ac-74e7-4584-b3e4-ac4499b6df72	d43291bc-2e6c-412c-8ed5-cc0f1b523e87	2dcb32a0-038f-4143-8407-5d9e1779b65b	defense_rescheduled	f	2026-09-17 09:04:32.158149+05:45	ad2ece69-8848-4365-81db-0d0409ddabfa	Progress defense rescheduled: Commercial data mining: processing, analysis and modeling for predictive analytics projects	The progress defense for "Commercial data mining: processing, analysis and modeling for predictive analytics projects" has been rescheduled (at 10:45 in Seminar Hall).	t	eecc9e74-ccb3-4df7-8aa9-26e03ff90f1b
3911fa3e-00ba-4db6-b9c9-9abe51202923	94a2549e-427f-4eb3-a872-6b265e3f1a05	\N	phase_updated	f	2026-09-16 20:25:49.274756+05:45	2349f282-1890-4f18-b433-5f0ef72af011	Progress report updated: Progress Report 1	The dates for this progress report phase for Bachelor's students have changed.	f	\N
d75b1130-152b-4b34-955d-dd6ae79edb4f	e18bb8d7-8b9d-4f1a-9862-ca9fd4ad8a43	\N	phase_updated	f	2026-09-16 20:25:49.274756+05:45	2349f282-1890-4f18-b433-5f0ef72af011	Progress report updated: Progress Report 1	The dates for this progress report phase for Bachelor's students have changed.	f	\N
a721ae63-8e37-4edf-aa26-334cb8d6421a	8e5a3eb2-b32d-46f0-a5f3-6a7df4b75c48	\N	phase_updated	f	2026-09-16 20:25:49.274756+05:45	2349f282-1890-4f18-b433-5f0ef72af011	Progress report updated: Progress Report 1	The dates for this progress report phase for Bachelor's students have changed.	t	\N
f9f12f92-5316-43e5-bbc0-b532ffa735da	94a2549e-427f-4eb3-a872-6b265e3f1a05	\N	phase_scheduled	f	2026-09-16 20:46:07.527557+05:45	81468587-aee9-4437-830d-ab3822d0a351	Progress report scheduled: Progress report 2	A new progress report phase has been scheduled for Bachelor's students. Submit before the deadline.	f	\N
379e4fda-36ba-4e00-b045-c73e9a745109	e18bb8d7-8b9d-4f1a-9862-ca9fd4ad8a43	\N	phase_scheduled	f	2026-09-16 20:46:07.527557+05:45	81468587-aee9-4437-830d-ab3822d0a351	Progress report scheduled: Progress report 2	A new progress report phase has been scheduled for Bachelor's students. Submit before the deadline.	f	\N
2b58cd9c-d96b-4891-a810-1c96106977d4	8e5a3eb2-b32d-46f0-a5f3-6a7df4b75c48	\N	phase_scheduled	f	2026-09-16 20:46:07.527557+05:45	81468587-aee9-4437-830d-ab3822d0a351	Progress report scheduled: Progress report 2	A new progress report phase has been scheduled for Bachelor's students. Submit before the deadline.	t	\N
7d92559d-975c-4a07-9819-fdc99eb85476	fd586d07-f85f-4394-9558-b7626b90b70f	\N	phase_updated	f	2026-09-16 20:25:49.274756+05:45	2349f282-1890-4f18-b433-5f0ef72af011	Progress report updated: Progress Report 1	The dates for this progress report phase for Bachelor's students have changed.	t	\N
ad071bc8-3423-48e0-8057-cba571c7c6fa	fd586d07-f85f-4394-9558-b7626b90b70f	\N	phase_scheduled	f	2026-09-16 20:46:07.527557+05:45	81468587-aee9-4437-830d-ab3822d0a351	Progress report scheduled: Progress report 2	A new progress report phase has been scheduled for Bachelor's students. Submit before the deadline.	t	\N
bd62edfc-959b-4dd9-b263-091495e00ea5	fd586d07-f85f-4394-9558-b7626b90b70f	\N	phase_scheduled	f	2026-09-16 22:40:59.999063+05:45	ad2ece69-8848-4365-81db-0d0409ddabfa	Progress report scheduled: Progress report 1	A new progress report phase has been scheduled for Bachelor's students. Submit before the deadline.	f	\N
a909383c-3044-45ab-bdef-dc2dd343b9f8	8e5a3eb2-b32d-46f0-a5f3-6a7df4b75c48	\N	phase_scheduled	f	2026-09-16 22:40:59.999063+05:45	ad2ece69-8848-4365-81db-0d0409ddabfa	Progress report scheduled: Progress report 1	A new progress report phase has been scheduled for Bachelor's students. Submit before the deadline.	t	\N
2c444dc0-e193-44c6-87a4-06123c6b2899	e18bb8d7-8b9d-4f1a-9862-ca9fd4ad8a43	2dcb32a0-038f-4143-8407-5d9e1779b65b	defense_scheduled	f	2026-09-16 22:46:06.962027+05:45	ad2ece69-8848-4365-81db-0d0409ddabfa	Progress defense planned: Commercial data mining: processing, analysis and modeling for predictive analytics projects	The progress defense for "Commercial data mining: processing, analysis and modeling for predictive analytics projects" has been planned (at 10:45 in Seminar Hall).	f	eecc9e74-ccb3-4df7-8aa9-26e03ff90f1b
370271f5-c4a2-4483-9de1-450a8f4785c0	94a2549e-427f-4eb3-a872-6b265e3f1a05	2dcb32a0-038f-4143-8407-5d9e1779b65b	defense_scheduled	f	2026-09-16 22:46:06.962027+05:45	ad2ece69-8848-4365-81db-0d0409ddabfa	Progress defense planned: Commercial data mining: processing, analysis and modeling for predictive analytics projects	The progress defense for "Commercial data mining: processing, analysis and modeling for predictive analytics projects" has been planned (at 10:45 in Seminar Hall).	f	eecc9e74-ccb3-4df7-8aa9-26e03ff90f1b
c978937d-08bb-4818-9ce5-e7cb98b4eb96	e18bb8d7-8b9d-4f1a-9862-ca9fd4ad8a43	2dcb32a0-038f-4143-8407-5d9e1779b65b	defense_rescheduled	f	2026-09-16 22:46:32.987982+05:45	ad2ece69-8848-4365-81db-0d0409ddabfa	Progress defense rescheduled: Commercial data mining: processing, analysis and modeling for predictive analytics projects	The progress defense for "Commercial data mining: processing, analysis and modeling for predictive analytics projects" has been rescheduled (at 10:45 in Seminar Hall).	f	eecc9e74-ccb3-4df7-8aa9-26e03ff90f1b
2f425409-ebb5-4bd4-b4b8-c656edf639d9	94a2549e-427f-4eb3-a872-6b265e3f1a05	2dcb32a0-038f-4143-8407-5d9e1779b65b	defense_rescheduled	f	2026-09-16 22:46:32.987982+05:45	ad2ece69-8848-4365-81db-0d0409ddabfa	Progress defense rescheduled: Commercial data mining: processing, analysis and modeling for predictive analytics projects	The progress defense for "Commercial data mining: processing, analysis and modeling for predictive analytics projects" has been rescheduled (at 10:45 in Seminar Hall).	f	eecc9e74-ccb3-4df7-8aa9-26e03ff90f1b
f49cda67-b853-4432-b0bf-c9f54e20f3a4	8e5a3eb2-b32d-46f0-a5f3-6a7df4b75c48	2dcb32a0-038f-4143-8407-5d9e1779b65b	defense_scheduled	f	2026-09-16 22:46:06.962027+05:45	ad2ece69-8848-4365-81db-0d0409ddabfa	Progress defense planned: Commercial data mining: processing, analysis and modeling for predictive analytics projects	The progress defense for "Commercial data mining: processing, analysis and modeling for predictive analytics projects" has been planned (at 10:45 in Seminar Hall).	t	eecc9e74-ccb3-4df7-8aa9-26e03ff90f1b
75452a25-959d-4e50-8b17-b7ffa8d7e226	8e5a3eb2-b32d-46f0-a5f3-6a7df4b75c48	2dcb32a0-038f-4143-8407-5d9e1779b65b	defense_rescheduled	f	2026-09-16 22:46:32.987982+05:45	ad2ece69-8848-4365-81db-0d0409ddabfa	Progress defense rescheduled: Commercial data mining: processing, analysis and modeling for predictive analytics projects	The progress defense for "Commercial data mining: processing, analysis and modeling for predictive analytics projects" has been rescheduled (at 10:45 in Seminar Hall).	t	eecc9e74-ccb3-4df7-8aa9-26e03ff90f1b
ce923a10-c435-45fe-9069-2d5c348c4b79	313e2525-1248-45b8-8691-7e84a676e0c3	\N	phase_scheduled	f	2026-09-16 22:40:59.999063+05:45	ad2ece69-8848-4365-81db-0d0409ddabfa	Progress report scheduled: Progress report 1	A new progress report phase has been scheduled for Bachelor's students. Submit before the deadline.	t	\N
ce5338d7-11be-419a-8a5e-137699dba36a	313e2525-1248-45b8-8691-7e84a676e0c3	2dcb32a0-038f-4143-8407-5d9e1779b65b	defense_scheduled	f	2026-09-16 22:46:06.962027+05:45	ad2ece69-8848-4365-81db-0d0409ddabfa	Progress defense planned: Commercial data mining: processing, analysis and modeling for predictive analytics projects	The progress defense for "Commercial data mining: processing, analysis and modeling for predictive analytics projects" has been planned (at 10:45 in Seminar Hall).	t	eecc9e74-ccb3-4df7-8aa9-26e03ff90f1b
eb2a0ac7-5584-4c0d-8fd6-643d5528fddf	313e2525-1248-45b8-8691-7e84a676e0c3	2dcb32a0-038f-4143-8407-5d9e1779b65b	defense_rescheduled	f	2026-09-16 22:46:32.987982+05:45	ad2ece69-8848-4365-81db-0d0409ddabfa	Progress defense rescheduled: Commercial data mining: processing, analysis and modeling for predictive analytics projects	The progress defense for "Commercial data mining: processing, analysis and modeling for predictive analytics projects" has been rescheduled (at 10:45 in Seminar Hall).	t	eecc9e74-ccb3-4df7-8aa9-26e03ff90f1b
6426ffed-dde0-46c3-aeb6-e2639567d275	c4fb7ece-606d-48ba-8636-e91c3e1de5ad	\N	phase_scheduled	f	2026-09-17 07:36:37.095909+05:45	6be5471b-0229-40c0-b598-28d17acfe6dd	Proposal scheduled: Proposal submission	A new proposal phase has been scheduled for Bachelor's students. Submit before the deadline.	t	\N
e401874d-3cbb-4bf0-b1f2-1654c06cf7ac	313e2525-1248-45b8-8691-7e84a676e0c3	2dcb32a0-038f-4143-8407-5d9e1779b65b	defense_rescheduled	f	2026-09-17 09:04:32.158149+05:45	ad2ece69-8848-4365-81db-0d0409ddabfa	Progress defense rescheduled: Commercial data mining: processing, analysis and modeling for predictive analytics projects	The progress defense for "Commercial data mining: processing, analysis and modeling for predictive analytics projects" has been rescheduled (at 10:45 in Seminar Hall).	f	eecc9e74-ccb3-4df7-8aa9-26e03ff90f1b
a32f71e2-8b42-4350-a369-b19c06699be4	ea472eec-0a8a-4e4e-a602-79b0531849ea	\N	phase_scheduled	f	2026-09-17 07:36:37.095909+05:45	6be5471b-0229-40c0-b598-28d17acfe6dd	Proposal scheduled: Proposal submission	A new proposal phase has been scheduled for Bachelor's students. Submit before the deadline.	t	\N
8ffae6c7-d0bb-4e7f-8067-2ea64d550531	88883fc5-025b-431f-b8f5-5be49383eab7	\N	defense_scheduled	f	2026-09-18 08:52:18.288643+05:45	6be5471b-0229-40c0-b598-28d17acfe6dd	Proposal defense planned: My Research Proposal	The proposal defense for "My Research Proposal" has been planned (at 14:00 in Lo Manthang Block).	t	09cac47e-184a-4435-a594-bf0c317e05bd
e076e673-f445-494e-bca1-4b128ea1bd34	ea472eec-0a8a-4e4e-a602-79b0531849ea	\N	defense_scheduled	f	2026-09-18 08:51:48.479711+05:45	6be5471b-0229-40c0-b598-28d17acfe6dd	Proposal defense planned: Bachelor's Proposal(Architecture)	The proposal defense for "Bachelor's Proposal(Architecture)" has been planned (at 11:50 in Phoksundo Block).	t	32ddfa76-3550-497c-843e-bc13b3e5df04
de8df0c9-0f57-4f63-8dcf-26b69a2ff721	ea472eec-0a8a-4e4e-a602-79b0531849ea	\N	defense_scheduled	f	2026-09-18 08:52:18.288643+05:45	6be5471b-0229-40c0-b598-28d17acfe6dd	Proposal defense planned: My Research Proposal	The proposal defense for "My Research Proposal" has been planned (at 14:00 in Lo Manthang Block).	t	09cac47e-184a-4435-a594-bf0c317e05bd
ebec1b86-a371-415d-b8cb-c81d2aa443f3	c4fb7ece-606d-48ba-8636-e91c3e1de5ad	\N	defense_scheduled	f	2026-09-18 08:51:48.479711+05:45	6be5471b-0229-40c0-b598-28d17acfe6dd	Proposal defense planned: Bachelor's Proposal(Architecture)	The proposal defense for "Bachelor's Proposal(Architecture)" has been planned (at 11:50 in Phoksundo Block).	t	32ddfa76-3550-497c-843e-bc13b3e5df04
6ebc682b-79a2-48a5-884c-11554240e24b	88883fc5-025b-431f-b8f5-5be49383eab7	\N	defense_rescheduled	f	2026-09-18 08:52:24.324039+05:45	6be5471b-0229-40c0-b598-28d17acfe6dd	Proposal defense rescheduled: My Research Proposal	The proposal defense for "My Research Proposal" has been rescheduled (at 14:00 in Lo Manthang Block).	t	09cac47e-184a-4435-a594-bf0c317e05bd
609a2e29-7e25-49b8-bbac-2c8d32c61923	ea472eec-0a8a-4e4e-a602-79b0531849ea	\N	defense_rescheduled	f	2026-09-18 08:52:24.324039+05:45	6be5471b-0229-40c0-b598-28d17acfe6dd	Proposal defense rescheduled: My Research Proposal	The proposal defense for "My Research Proposal" has been rescheduled (at 14:00 in Lo Manthang Block).	t	09cac47e-184a-4435-a594-bf0c317e05bd
74bf31aa-6bc7-4d21-a3cc-15e92212f37b	5e1fcf35-271b-40d8-87ca-4a400de0ff7d	\N	supervision_over_capacity	f	2026-09-18 09:08:26.851512+05:45	\N	Supervision limit exceeded: Bachelor's Proposal(Architecture)	Manoj Pandey is already supervising a Bachelor's group — a professor can supervise only one project per degree level. Reassign "Bachelor's Proposal(Architecture)" to another professor.	f	\N
ed3e056a-f15f-472c-8e34-cd6cf8d9774b	58bc47d0-ad67-43c1-99db-bc676b3ad66d	\N	phase_scheduled	f	2026-09-18 09:25:55.321023+05:45	dcbed330-3479-4310-a090-dac26fa453b3	Progress report scheduled: Progress report 1	A new progress report phase has been scheduled for Bachelor's students. Submit before the deadline.	f	\N
eaa0863e-60a4-4539-b36b-3ab78b7b6455	c457dd0e-5477-43c1-ba55-bbb6079d6573	\N	phase_scheduled	f	2026-09-18 09:25:55.321023+05:45	dcbed330-3479-4310-a090-dac26fa453b3	Progress report scheduled: Progress report 1	A new progress report phase has been scheduled for Bachelor's students. Submit before the deadline.	f	\N
1bf81104-dba9-4026-9f96-e1841091289c	c4fb7ece-606d-48ba-8636-e91c3e1de5ad	\N	phase_scheduled	f	2026-09-18 09:25:55.321023+05:45	dcbed330-3479-4310-a090-dac26fa453b3	Progress report scheduled: Progress report 1	A new progress report phase has been scheduled for Bachelor's students. Submit before the deadline.	f	\N
cc972a72-88c4-4b67-89d6-4a32e7ca0f84	ea472eec-0a8a-4e4e-a602-79b0531849ea	\N	phase_scheduled	f	2026-09-18 09:25:55.321023+05:45	dcbed330-3479-4310-a090-dac26fa453b3	Progress report scheduled: Progress report 1	A new progress report phase has been scheduled for Bachelor's students. Submit before the deadline.	f	\N
5423a930-2be3-4e26-a9e8-c2355a8ed9ea	88883fc5-025b-431f-b8f5-5be49383eab7	\N	phase_scheduled	f	2026-09-18 09:25:55.321023+05:45	dcbed330-3479-4310-a090-dac26fa453b3	Progress report scheduled: Progress report 1	A new progress report phase has been scheduled for Bachelor's students. Submit before the deadline.	t	\N
\.


--
-- Data for Name: paperauthors; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.paperauthors (id, user_id, author_role, created_at, paper_id) FROM stdin;
\.


--
-- Data for Name: papers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.papers (id, supervisor_id, proposal_id, cluster_id, title, status, created_at, final_report_file_path, final_report_original_filename, final_report_file_size_bytes, final_report_content_type, final_report_uploaded_at, final_report_checksum, final_report_status, final_report_review_comment, final_report_reviewed_by) FROM stdin;
2866eb8b-c2c2-45ee-afc4-8ae36190759b	d43291bc-2e6c-412c-8ed5-cc0f1b523e87	833d67d8-4ce3-4d86-9586-81d2edb452fe	438c0c58-26e1-4fd3-aae2-0d3249cbde95	My phd proposal	in_progress	2026-09-18 07:53:18.290077+05:45	\N	\N	\N	\N	\N	\N	\N	\N	\N
061144ca-804e-40be-bd1d-130d16f09f70	ea472eec-0a8a-4e4e-a602-79b0531849ea	d4358899-99ff-46f8-ac2c-4f2ab5f735eb	\N	Bachelor's Proposal(Architecture)	in_progress	2026-09-18 09:08:26.851512+05:45	\N	\N	\N	\N	\N	\N	\N	\N	\N
543ebfb3-5301-4cb0-8e9b-c992e0b2d313	ea472eec-0a8a-4e4e-a602-79b0531849ea	833e1056-f2d4-4929-9a23-f6546f38a803	\N	My Research Proposal	in_progress	2026-09-18 09:23:41.16235+05:45	\N	\N	\N	\N	\N	\N	\N	\N	\N
2dcb32a0-038f-4143-8407-5d9e1779b65b	313e2525-1248-45b8-8691-7e84a676e0c3	47663198-945e-4213-ab00-3b449aad9084	b8402cb1-39e0-4b23-b2e6-560ead3e142f	Commercial data mining: processing, analysis and modeling for predictive analytics projects	in_progress	2026-09-16 20:56:46.650033+05:45	\N	\N	\N	\N	\N	\N	\N	\N	\N
\.


--
-- Data for Name: peerreviews; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.peerreviews (id, journal_submission_id, reviewer_id, decision, comments, reviewed_at) FROM stdin;
\.


--
-- Data for Name: professorprofile; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.professorprofile (user_id, academic_rank, max_students, created_at) FROM stdin;
313e2525-1248-45b8-8691-7e84a676e0c3	Professor	5	2026-09-17 07:24:06.039823+05:45
d43291bc-2e6c-412c-8ed5-cc0f1b523e87	Associate Professor	5	2026-09-17 07:24:17.390072+05:45
ea472eec-0a8a-4e4e-a602-79b0531849ea	Professor	5	2026-09-17 07:33:34.836401+05:45
\.


--
-- Data for Name: progressreports; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.progressreports (id, paper_id, submitted_by, content, status, submitted_at, file_path, original_filename, file_size_bytes, content_type, uploaded_at, checksum, review_comment, reviewed_by, phase_id) FROM stdin;
d349166b-82da-4c0b-9a65-01f9adc4c5b5	2dcb32a0-038f-4143-8407-5d9e1779b65b	8e5a3eb2-b32d-46f0-a5f3-6a7df4b75c48	Image based plant disease	approved	2026-09-16 21:38:58.630789+05:45	progress-reports/d349166b-82da-4c0b-9a65-01f9adc4c5b5/913e15cb31730038-ImagebasedplantdiseasedetectionusingCVconfpaper.pdf	ImagebasedplantdiseasedetectionusingCVconfpaper.pdf	2079147	application/pdf	2026-09-16 21:38:58.777353+05:45	913e15cb31730038a7985661a8a4c9dbfbe98de4b19ee965c3feeb2b4c6c1d30	\N	313e2525-1248-45b8-8691-7e84a676e0c3	81468587-aee9-4437-830d-ab3822d0a351
660eee36-d098-49ad-8f49-729dca3c8a93	2dcb32a0-038f-4143-8407-5d9e1779b65b	8e5a3eb2-b32d-46f0-a5f3-6a7df4b75c48	kjljdlfjadf	approved	2026-09-16 22:44:03.266693+05:45	progress-reports/660eee36-d098-49ad-8f49-729dca3c8a93/14cde32b452b5cd5-ECB-DiseaseandPestdetection.pdf	ECB-DiseaseandPestdetection.pdf	315501	application/pdf	2026-09-16 22:44:03.344013+05:45	14cde32b452b5cd5080a01d99a4bbcf8852679a3e27ad9498a772430d2a51099	Good you are defense ready	313e2525-1248-45b8-8691-7e84a676e0c3	ad2ece69-8848-4365-81db-0d0409ddabfa
\.


--
-- Data for Name: proposalcandidates; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.proposalcandidates (id, proposal_id, student_id, created_at, status) FROM stdin;
fd9c4624-5bdc-4f0b-8865-e1df2655fe8f	47663198-945e-4213-ab00-3b449aad9084	94a2549e-427f-4eb3-a872-6b265e3f1a05	2026-09-15 11:46:28.674716+05:45	accepted
68734983-96d7-4592-af46-12f3191da828	47663198-945e-4213-ab00-3b449aad9084	e18bb8d7-8b9d-4f1a-9862-ca9fd4ad8a43	2026-09-15 11:46:22.691124+05:45	accepted
\.


--
-- Data for Name: proposals; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.proposals (id, submitted_by, title, status, reviewed_by, created_at, cluster_id, supervisor_id, review_comment, student_response, responded_by, deleted_at, deleted_by, file_path, original_filename, file_size_bytes, content_type, uploaded_at, checksum, phase_id) FROM stdin;
833d67d8-4ce3-4d86-9586-81d2edb452fe	d8992317-ae0d-4e5c-a10e-1514406b8e06	My phd proposal	approved	d43291bc-2e6c-412c-8ed5-cc0f1b523e87	2026-09-16 23:12:53.129061+05:45	438c0c58-26e1-4fd3-aae2-0d3249cbde95	d43291bc-2e6c-412c-8ed5-cc0f1b523e87	Need minor adjustments for this project like having proper alignement , need a proper references. I tried to go to the references but it seems as it is random references generated by LLMs. Fix this and provide a proper references as it is reffered by other individuals as well	\N	\N	\N	\N	proposals/833d67d8-4ce3-4d86-9586-81d2edb452fe/2f232c7249473dc0-Nagarikta_-min.pdf	Nagarikta -min.pdf	361515	application/pdf	2026-09-16 23:12:53.209907+05:45	2f232c7249473dc0abdf2cda835913ffc4bcdad5c50670339ebdc084d055c72f	868fea79-67a5-416c-85fa-3423ec34d4cc
d4358899-99ff-46f8-ac2c-4f2ab5f735eb	c4fb7ece-606d-48ba-8636-e91c3e1de5ad	Bachelor's Proposal(Architecture)	approved	58bc47d0-ad67-43c1-99db-bc676b3ad66d	2026-09-17 07:42:15.512841+05:45	\N	58bc47d0-ad67-43c1-99db-bc676b3ad66d	\N	\N	\N	\N	\N	proposals/d4358899-99ff-46f8-ac2c-4f2ab5f735eb/c1418e7c2ec3d628-Devops_A_New_Approach_To_Cloud_Development_amp_Testing.pdf	Devops_A_New_Approach_To_Cloud_Development_amp_Testing.pdf	2298189	application/pdf	2026-09-17 07:42:15.637693+05:45	c1418e7c2ec3d628165f1f9c71c159ecd56db835218bebdaba0a26c539330ccb	6be5471b-0229-40c0-b598-28d17acfe6dd
f320e383-317e-4a4f-9e38-5fc5be087295	fd586d07-f85f-4394-9558-b7626b90b70f	An Expert System for Monitoring Environmental Control and Life Support Data	rejected	d43291bc-2e6c-412c-8ed5-cc0f1b523e87	2026-09-15 13:52:37.635233+05:45	b8402cb1-39e0-4b23-b2e6-560ead3e142f	d43291bc-2e6c-412c-8ed5-cc0f1b523e87	\N	\N	\N	2026-09-16 15:28:47.945979+05:45	8e021c80-697b-44a3-8427-f4c9e5d7d597	proposals/f320e383-317e-4a4f-9e38-5fc5be087295/Interns_Onboarding_by_HR_.pdf	Interns Onboarding (by HR).pdf	1864607	application/pdf	2026-09-16 14:23:06.549054+05:45	0f6b00aa511f70db686f4f49c16ec2580e5bd369ba77fa20fd1e9f40a4754ebe	\N
833e1056-f2d4-4929-9a23-f6546f38a803	88883fc5-025b-431f-b8f5-5be49383eab7	My Research Proposal	approved	ea472eec-0a8a-4e4e-a602-79b0531849ea	2026-09-18 08:32:24.340384+05:45	\N	ea472eec-0a8a-4e4e-a602-79b0531849ea	\N	\N	\N	\N	\N	proposals/833e1056-f2d4-4929-9a23-f6546f38a803/8467f5b9ec5c885f-class_10_nepali_3.pdf	class 10 nepali 3.pdf	454128	application/pdf	2026-09-18 08:32:24.412842+05:45	8467f5b9ec5c885fb4e0806b314d5d81a705721b4860d4ccb457269eddf70d98	6be5471b-0229-40c0-b598-28d17acfe6dd
47663198-945e-4213-ab00-3b449aad9084	8e5a3eb2-b32d-46f0-a5f3-6a7df4b75c48	Commercial data mining: processing, analysis and modeling for predictive analytics projects	approved	313e2525-1248-45b8-8691-7e84a676e0c3	2026-09-15 11:46:22.663069+05:45	b8402cb1-39e0-4b23-b2e6-560ead3e142f	313e2525-1248-45b8-8691-7e84a676e0c3	Good it's like as I expected	\N	\N	\N	\N	proposals/47663198-945e-4213-ab00-3b449aad9084/New_Enrolment_Form_NPEF998450907.pdf	New_Enrolment_Form_NPEF998450907.pdf	118815	application/pdf	2026-09-16 06:11:19.892319+05:45	0d787d0bf2ac299ea00c07b1872c4319ae2cee447cba5db4752e5ba29f887be3	\N
\.


--
-- Data for Name: researchphases; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.researchphases (id, phase_type, degree_level, department_id, label, sequence_number, opens_at, deadline_at, defense_date, grace_period_enabled, created_by, created_at, deleted_at, deleted_by) FROM stdin;
2349f282-1890-4f18-b433-5f0ef72af011	progress_report	bachelors	ce61445f-930c-498d-b7a1-9e4d3f016378	Progress Report 1	1	2026-09-01 00:00:00+05:45	2026-09-16 17:11:00+05:45	\N	t	8e021c80-697b-44a3-8427-f4c9e5d7d597	2026-09-16 17:02:06.227953+05:45	2026-09-16 22:34:27.263231+05:45	8e021c80-697b-44a3-8427-f4c9e5d7d597
81468587-aee9-4437-830d-ab3822d0a351	progress_report	bachelors	ce61445f-930c-498d-b7a1-9e4d3f016378	Progress report 2	2	2026-09-16 20:45:00+05:45	2026-09-16 21:45:00+05:45	\N	t	8e021c80-697b-44a3-8427-f4c9e5d7d597	2026-09-16 20:46:07.527557+05:45	2026-09-16 22:34:30.896135+05:45	8e021c80-697b-44a3-8427-f4c9e5d7d597
ad2ece69-8848-4365-81db-0d0409ddabfa	progress_report	bachelors	ce61445f-930c-498d-b7a1-9e4d3f016378	Progress report 1	1	2026-09-16 22:40:00+05:45	2026-09-16 22:50:00+05:45	\N	f	8e021c80-697b-44a3-8427-f4c9e5d7d597	2026-09-16 22:40:59.999063+05:45	\N	\N
1f246a49-bee6-4a7d-b08a-ce1b168ef9b7	proposal	masters	ce61445f-930c-498d-b7a1-9e4d3f016378	Proposal submission	1	2026-09-16 21:44:00+05:45	2026-09-17 21:44:00+05:45	\N	t	8e021c80-697b-44a3-8427-f4c9e5d7d597	2026-09-16 21:44:38.68005+05:45	\N	\N
868fea79-67a5-416c-85fa-3423ec34d4cc	proposal	phd	ce61445f-930c-498d-b7a1-9e4d3f016378	Proposal submission	1	2026-09-16 21:54:00+05:45	2026-09-17 00:55:00+05:45	\N	t	8e021c80-697b-44a3-8427-f4c9e5d7d597	2026-09-16 21:55:35.135737+05:45	\N	\N
6be5471b-0229-40c0-b598-28d17acfe6dd	proposal	bachelors	6fb99b12-5941-4b8a-a939-31444e33c587	Proposal submission	1	2026-09-17 07:35:00+05:45	2026-09-18 00:00:00+05:45	\N	t	5e1fcf35-271b-40d8-87ca-4a400de0ff7d	2026-09-17 07:36:37.095909+05:45	\N	\N
dcbed330-3479-4310-a090-dac26fa453b3	progress_report	bachelors	6fb99b12-5941-4b8a-a939-31444e33c587	Progress report 1	2	2026-10-20 00:00:00+05:45	2026-10-30 00:00:00+05:45	\N	f	5e1fcf35-271b-40d8-87ca-4a400de0ff7d	2026-09-18 09:25:55.321023+05:45	\N	\N
\.


--
-- Data for Name: studentprofile; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.studentprofile (user_id, degree_program_id, supervisor_id, status, created_at, roll_number) FROM stdin;
8e5a3eb2-b32d-46f0-a5f3-6a7df4b75c48	7506859d-0c46-4f07-9aac-e8ad54ddb8cd	313e2525-1248-45b8-8691-7e84a676e0c3	active	2026-09-14 08:55:58.591281+05:45	\N
94a2549e-427f-4eb3-a872-6b265e3f1a05	7506859d-0c46-4f07-9aac-e8ad54ddb8cd	313e2525-1248-45b8-8691-7e84a676e0c3	active	2026-09-15 13:16:34.474927+05:45	\N
e18bb8d7-8b9d-4f1a-9862-ca9fd4ad8a43	7506859d-0c46-4f07-9aac-e8ad54ddb8cd	313e2525-1248-45b8-8691-7e84a676e0c3	active	2026-09-15 13:19:40.794596+05:45	\N
01ce4d2b-4b02-4d8f-9108-cdf5c7a1cc2e	7506859d-0c46-4f07-9aac-e8ad54ddb8cd	d43291bc-2e6c-412c-8ed5-cc0f1b523e87	active	2026-09-16 23:10:16.593482+05:45	\N
fd586d07-f85f-4394-9558-b7626b90b70f	7506859d-0c46-4f07-9aac-e8ad54ddb8cd	d43291bc-2e6c-412c-8ed5-cc0f1b523e87	active	2026-09-15 14:09:04.015581+05:45	\N
594a1e95-d58f-4b8d-b09e-26936c6e2f8e	a5c8d12b-5254-4db6-83e9-cfee5e5a550a	313e2525-1248-45b8-8691-7e84a676e0c3	active	2026-09-16 23:10:57.416893+05:45	\N
d8992317-ae0d-4e5c-a10e-1514406b8e06	47ade021-71b1-4f46-8f4f-dbb1a7d4db22	d43291bc-2e6c-412c-8ed5-cc0f1b523e87	active	2026-09-16 23:11:06.854152+05:45	\N
88883fc5-025b-431f-b8f5-5be49383eab7	40171749-0e87-4ef2-babf-a10c4d650efa	ea472eec-0a8a-4e4e-a602-79b0531849ea	active	2026-09-18 08:32:24.429559+05:45	\N
c4fb7ece-606d-48ba-8636-e91c3e1de5ad	40171749-0e87-4ef2-babf-a10c4d650efa	58bc47d0-ad67-43c1-99db-bc676b3ad66d	active	2026-09-14 14:50:33.946965+05:45	\N
\.


--
-- Data for Name: submissionhistory; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.submissionhistory (id, entity_type, entity_id, phase_id, submitted_by, status, reviewed_by, comments, file_path, original_filename, created_at) FROM stdin;
6d0547a4-7999-41af-aa1b-616157ee35cc	proposal	833d67d8-4ce3-4d86-9586-81d2edb452fe	868fea79-67a5-416c-85fa-3423ec34d4cc	d8992317-ae0d-4e5c-a10e-1514406b8e06	rejected	d43291bc-2e6c-412c-8ed5-cc0f1b523e87	Need minor adjustments for this project like having proper alignement , need a proper references. I tried to go to the references but it seems as it is random references generated by LLMs. Fix this and provide a proper references as it is reffered by other individuals as well	proposals/833d67d8-4ce3-4d86-9586-81d2edb452fe/2f232c7249473dc0-Nagarikta_-min.pdf	Nagarikta -min.pdf	2026-09-18 07:53:24.559372+05:45
8efee8df-1417-45e2-98b4-f009132ac2a5	proposal	833d67d8-4ce3-4d86-9586-81d2edb452fe	868fea79-67a5-416c-85fa-3423ec34d4cc	d8992317-ae0d-4e5c-a10e-1514406b8e06	accepted	d43291bc-2e6c-412c-8ed5-cc0f1b523e87	Need minor adjustments for this project like having proper alignement , need a proper references. I tried to go to the references but it seems as it is random references generated by LLMs. Fix this and provide a proper references as it is reffered by other individuals as well	proposals/833d67d8-4ce3-4d86-9586-81d2edb452fe/2f232c7249473dc0-Nagarikta_-min.pdf	Nagarikta -min.pdf	2026-09-18 07:56:13.154789+05:45
5418246c-dffb-4614-9dc3-215e1d9e9756	proposal	833e1056-f2d4-4929-9a23-f6546f38a803	6be5471b-0229-40c0-b598-28d17acfe6dd	88883fc5-025b-431f-b8f5-5be49383eab7	pending	\N	\N	proposals/833e1056-f2d4-4929-9a23-f6546f38a803/8467f5b9ec5c885f-class_10_nepali_3.pdf	class 10 nepali 3.pdf	2026-09-18 08:32:24.429559+05:45
1f1fa7eb-75bd-482a-aed4-7c6ad6f4ba37	proposal	d4358899-99ff-46f8-ac2c-4f2ab5f735eb	6be5471b-0229-40c0-b598-28d17acfe6dd	c4fb7ece-606d-48ba-8636-e91c3e1de5ad	accepted	58bc47d0-ad67-43c1-99db-bc676b3ad66d	\N	proposals/d4358899-99ff-46f8-ac2c-4f2ab5f735eb/c1418e7c2ec3d628-Devops_A_New_Approach_To_Cloud_Development_amp_Testing.pdf	Devops_A_New_Approach_To_Cloud_Development_amp_Testing.pdf	2026-09-18 09:19:07.303365+05:45
56bbd37a-b9c0-421f-a4f2-da58a28f837e	progress_report	d349166b-82da-4c0b-9a65-01f9adc4c5b5	81468587-aee9-4437-830d-ab3822d0a351	8e5a3eb2-b32d-46f0-a5f3-6a7df4b75c48	pending	\N	\N	progress-reports/d349166b-82da-4c0b-9a65-01f9adc4c5b5/913e15cb31730038-ImagebasedplantdiseasedetectionusingCVconfpaper.pdf	ImagebasedplantdiseasedetectionusingCVconfpaper.pdf	2026-09-16 21:39:12.029354+05:45
837f4a54-efe5-4af7-9809-579501d0be05	progress_report	d349166b-82da-4c0b-9a65-01f9adc4c5b5	81468587-aee9-4437-830d-ab3822d0a351	8e5a3eb2-b32d-46f0-a5f3-6a7df4b75c48	accepted	313e2525-1248-45b8-8691-7e84a676e0c3	\N	progress-reports/d349166b-82da-4c0b-9a65-01f9adc4c5b5/913e15cb31730038-ImagebasedplantdiseasedetectionusingCVconfpaper.pdf	ImagebasedplantdiseasedetectionusingCVconfpaper.pdf	2026-09-16 21:40:03.240791+05:45
be11c6b5-4759-4df8-8d6b-18dcbf7d417d	proposal	833d67d8-4ce3-4d86-9586-81d2edb452fe	868fea79-67a5-416c-85fa-3423ec34d4cc	d8992317-ae0d-4e5c-a10e-1514406b8e06	pending	\N	\N	proposals/833d67d8-4ce3-4d86-9586-81d2edb452fe/2f232c7249473dc0-Nagarikta_-min.pdf	Nagarikta -min.pdf	2026-09-16 23:12:53.237807+05:45
b6858283-2688-4739-afdd-ac891dbe2ee0	proposal	d4358899-99ff-46f8-ac2c-4f2ab5f735eb	6be5471b-0229-40c0-b598-28d17acfe6dd	c4fb7ece-606d-48ba-8636-e91c3e1de5ad	pending	\N	\N	proposals/d4358899-99ff-46f8-ac2c-4f2ab5f735eb/c1418e7c2ec3d628-Devops_A_New_Approach_To_Cloud_Development_amp_Testing.pdf	Devops_A_New_Approach_To_Cloud_Development_amp_Testing.pdf	2026-09-17 07:42:15.666088+05:45
04f48f2f-7ad0-4b3e-bada-946dd47250d1	proposal	833d67d8-4ce3-4d86-9586-81d2edb452fe	868fea79-67a5-416c-85fa-3423ec34d4cc	d8992317-ae0d-4e5c-a10e-1514406b8e06	accepted	d43291bc-2e6c-412c-8ed5-cc0f1b523e87	Need minor adjustments for this project like having proper alignement , need a proper references. I tried to go to the references but it seems as it is random references generated by LLMs. Fix this and provide a proper references as it is reffered by other individuals as well	proposals/833d67d8-4ce3-4d86-9586-81d2edb452fe/2f232c7249473dc0-Nagarikta_-min.pdf	Nagarikta -min.pdf	2026-09-18 07:53:18.290077+05:45
b7d2dec0-d53e-4ed7-91f3-91af1cbf00e4	proposal	833d67d8-4ce3-4d86-9586-81d2edb452fe	868fea79-67a5-416c-85fa-3423ec34d4cc	d8992317-ae0d-4e5c-a10e-1514406b8e06	pending	\N	Resubmission after requested changes	proposals/833d67d8-4ce3-4d86-9586-81d2edb452fe/2f232c7249473dc0-Nagarikta_-min.pdf	Nagarikta -min.pdf	2026-09-18 07:55:41.000806+05:45
c0dee23f-d1a9-4a6f-82aa-2b108cbbed07	proposal	d4358899-99ff-46f8-ac2c-4f2ab5f735eb	6be5471b-0229-40c0-b598-28d17acfe6dd	c4fb7ece-606d-48ba-8636-e91c3e1de5ad	rejected	ea472eec-0a8a-4e4e-a602-79b0531849ea	Good I liked  your approach , I want you to change the formattings of your project. It seems good but alignment is out of bounds. Adjust it and resubmit it	proposals/d4358899-99ff-46f8-ac2c-4f2ab5f735eb/c1418e7c2ec3d628-Devops_A_New_Approach_To_Cloud_Development_amp_Testing.pdf	Devops_A_New_Approach_To_Cloud_Development_amp_Testing.pdf	2026-09-18 08:01:57.941152+05:45
b67eafb3-4779-4e13-9575-8c99cdf044d7	proposal	d4358899-99ff-46f8-ac2c-4f2ab5f735eb	6be5471b-0229-40c0-b598-28d17acfe6dd	c4fb7ece-606d-48ba-8636-e91c3e1de5ad	pending	\N	Resubmission after requested changes	proposals/d4358899-99ff-46f8-ac2c-4f2ab5f735eb/c1418e7c2ec3d628-Devops_A_New_Approach_To_Cloud_Development_amp_Testing.pdf	Devops_A_New_Approach_To_Cloud_Development_amp_Testing.pdf	2026-09-18 08:03:07.388434+05:45
05df1bc0-ad9e-435c-90f1-800ac652665e	proposal	d4358899-99ff-46f8-ac2c-4f2ab5f735eb	6be5471b-0229-40c0-b598-28d17acfe6dd	c4fb7ece-606d-48ba-8636-e91c3e1de5ad	accepted	ea472eec-0a8a-4e4e-a602-79b0531849ea	\N	proposals/d4358899-99ff-46f8-ac2c-4f2ab5f735eb/c1418e7c2ec3d628-Devops_A_New_Approach_To_Cloud_Development_amp_Testing.pdf	Devops_A_New_Approach_To_Cloud_Development_amp_Testing.pdf	2026-09-18 09:08:26.851512+05:45
6dbdefd9-f07b-45bf-b775-bb72bc837081	progress_report	660eee36-d098-49ad-8f49-729dca3c8a93	ad2ece69-8848-4365-81db-0d0409ddabfa	8e5a3eb2-b32d-46f0-a5f3-6a7df4b75c48	pending	\N	\N	progress-reports/660eee36-d098-49ad-8f49-729dca3c8a93/14cde32b452b5cd5-ECB-DiseaseandPestdetection.pdf	ECB-DiseaseandPestdetection.pdf	2026-09-16 22:44:03.361278+05:45
883d5ae3-84e4-474a-bf36-2a0378fbf99b	progress_report	660eee36-d098-49ad-8f49-729dca3c8a93	ad2ece69-8848-4365-81db-0d0409ddabfa	8e5a3eb2-b32d-46f0-a5f3-6a7df4b75c48	accepted	313e2525-1248-45b8-8691-7e84a676e0c3	Good you are defense ready	progress-reports/660eee36-d098-49ad-8f49-729dca3c8a93/14cde32b452b5cd5-ECB-DiseaseandPestdetection.pdf	ECB-DiseaseandPestdetection.pdf	2026-09-16 22:44:53.670404+05:45
94286b17-542f-4232-8ee3-50934c956ac6	proposal	d4358899-99ff-46f8-ac2c-4f2ab5f735eb	6be5471b-0229-40c0-b598-28d17acfe6dd	c4fb7ece-606d-48ba-8636-e91c3e1de5ad	rejected	ea472eec-0a8a-4e4e-a602-79b0531849ea	\N	proposals/d4358899-99ff-46f8-ac2c-4f2ab5f735eb/c1418e7c2ec3d628-Devops_A_New_Approach_To_Cloud_Development_amp_Testing.pdf	Devops_A_New_Approach_To_Cloud_Development_amp_Testing.pdf	2026-09-18 09:08:36.556158+05:45
9086f9c2-f0d1-426f-b590-d826dc2ebd35	proposal	833e1056-f2d4-4929-9a23-f6546f38a803	6be5471b-0229-40c0-b598-28d17acfe6dd	88883fc5-025b-431f-b8f5-5be49383eab7	accepted	ea472eec-0a8a-4e4e-a602-79b0531849ea	\N	proposals/833e1056-f2d4-4929-9a23-f6546f38a803/8467f5b9ec5c885f-class_10_nepali_3.pdf	class 10 nepali 3.pdf	2026-09-18 09:23:41.16235+05:45
\.


--
-- Data for Name: submissionwindows; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.submissionwindows (id, department_id, phase, due_at, is_closed, updated_by, created_at, updated_at) FROM stdin;
127e3ad0-10ef-43e7-b273-b39ac9e0ff12	ce61445f-930c-498d-b7a1-9e4d3f016378	proposal	2026-09-14 15:33:00+05:45	t	8e021c80-697b-44a3-8427-f4c9e5d7d597	2026-09-16 15:26:56.609833+05:45	2026-09-16 15:26:56.609833+05:45
2a2a8be0-3b5f-4360-9bd4-f430a8f3e57e	ce61445f-930c-498d-b7a1-9e4d3f016378	progress_report	2026-09-25 17:31:00+05:45	t	8e021c80-697b-44a3-8427-f4c9e5d7d597	2026-09-16 15:25:41.689801+05:45	2026-09-16 15:25:41.689801+05:45
2793712e-c79e-4b02-84c8-89055b15d48c	ce61445f-930c-498d-b7a1-9e4d3f016378	final_report	\N	t	8e021c80-697b-44a3-8427-f4c9e5d7d597	2026-09-16 20:25:25.55206+05:45	2026-09-16 20:25:25.55206+05:45
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, department_id, name, email, password, role, created_at, avatar_url, degree_program_id) FROM stdin;
656837a5-acb3-4a1e-943d-3ee0c97da32f	3fa85f64-5717-4562-b3fc-2c963f66afa6	Osama Bin Laden	osama911@gmail.com	$argon2id$v=19$m=65536,t=3,p=4$xHPu/lKu+lb5feSI683S6Q$huF0Raf1Md1cFMVY6UvLvr9Ekkvp0Yj0l0eC8xa2YjM	admin	2026-09-03 12:00:11.723707+05:45	\N	\N
a69083e3-d602-4cbe-9d00-d9fc148ca5ee	3fa85f64-5717-4562-b3fc-2c963f66afa6	Ayush Bhetwal	ayush.bhetwal@gmail.com	$argon2id$v=19$m=65536,t=3,p=4$kBQqfxzo5r5MuGbPfTwjdQ$Fd8n9yyf1Ew2IzdydKLmp9pGLGdFuaa4e8+vv0cWM3A	student	2026-09-03 14:31:31.463746+05:45	\N	\N
cfd56712-f14c-422e-8b60-4c479bc39ba0	3fa85f64-5717-4562-b3fc-2c963f66afa6	Aayusha Dhakal	ayusha.dhakal@gmail.com	$argon2id$v=19$m=65536,t=3,p=4$NsmdSuatpVCspsNNH49IaQ$Kp8bkSKFx5Zu/H8nQ5WXPdpQ5GMo1zM5C6TDY6vXs14	student	2026-09-03 13:48:49.561425+05:45	\N	\N
94a2549e-427f-4eb3-a872-6b265e3f1a05	ce61445f-930c-498d-b7a1-9e4d3f016378	Sujala Adhikari	sujala.adhikari@gmail.com	$argon2id$v=19$m=65536,t=3,p=4$lD6w6vfFzB9tDLp2Zmwt2Q$uWQqRGlhe8xinIwO0NL4yjK7fdwn3ae8b2P7CixUL+w	student	2026-09-11 09:18:10.428748+05:45	\N	\N
e18bb8d7-8b9d-4f1a-9862-ca9fd4ad8a43	ce61445f-930c-498d-b7a1-9e4d3f016378	Simran Thapa	simran.thapa@gmail.com	$argon2id$v=19$m=65536,t=3,p=4$MLMfaa21SznP1xyoy87eQA$sNksjCL8f2Wocp/9Z1JGjzvteAchnfW64m9+Em1luEc	student	2026-09-11 09:18:52.928685+05:45	\N	\N
d43291bc-2e6c-412c-8ed5-cc0f1b523e87	ce61445f-930c-498d-b7a1-9e4d3f016378	Samip Gajurel	samip.gajurel@gmail.com	$argon2id$v=19$m=65536,t=3,p=4$JmBF7capUYKMeFLtChL86Q$G98Lms2crW8jeJ8iN2cXC9wzBps7i+vn7No5qB1KWa0	professor	2026-09-11 09:20:12.302422+05:45	\N	\N
ea472eec-0a8a-4e4e-a602-79b0531849ea	6fb99b12-5941-4b8a-a939-31444e33c587	Manoj Pandey	manoj.pandey@gmail.com	$argon2id$v=19$m=65536,t=3,p=4$vMuxH1qDY7miqMiO2MkfgQ$hmN1gQrd7YeVs1cSFSuzC4brikDa62WV0+8LLEkIjx8	professor	2026-09-14 08:02:29.941517+05:45	\N	\N
94d9d0c8-948f-49ed-b2b6-475e605e9e5d	\N	Sakshyam Luitel	sakshyam73@gmail.com	$argon2id$v=19$m=65536,t=3,p=4$WvkcLsAOHP3iWeqlimDnxw$g/XoflpPBATtljkBbyrovy+u/MYrBacMsyqRPGD+r6Q	super_admin	2026-09-14 12:11:06.782785+05:45	\N	\N
8e021c80-697b-44a3-8427-f4c9e5d7d597	ce61445f-930c-498d-b7a1-9e4d3f016378	electronics engineering admin	electronics@gmail.com	$argon2id$v=19$m=65536,t=3,p=4$IhWXwJADyu6umorMMiZsMg$PgxTM1/hqV2cacv8B+JfeqRt3jUR7we1KIfiDdB01E4	admin	2026-09-14 13:20:32.822985+05:45	\N	\N
5e1fcf35-271b-40d8-87ca-4a400de0ff7d	6fb99b12-5941-4b8a-a939-31444e33c587	Architecture Admin	architecture@gmail.com	$argon2id$v=19$m=65536,t=3,p=4$6qscgTRYcpo96qIjTEEoSA$XXtXyfTJ73M74cfV4jh0507BbPnsNGdXPm4jAKG63Zg	admin	2026-09-14 14:41:50.219675+05:45	\N	\N
594a1e95-d58f-4b8d-b09e-26936c6e2f8e	ce61445f-930c-498d-b7a1-9e4d3f016378	Ram kumar Maharjan	ram.maharjan@gmail.com	$argon2id$v=19$m=65536,t=3,p=4$b0Rcbp+RAnRGd4KMPyyX5g$ZYdpHkQqw1/waqUUSHvJhsxRl64N798POJKXfN8VdYw	student	2026-09-16 23:07:34.259556+05:45	\N	a5c8d12b-5254-4db6-83e9-cfee5e5a550a
fd586d07-f85f-4394-9558-b7626b90b70f	ce61445f-930c-498d-b7a1-9e4d3f016378	Micheal Jackson	micheal.jackson@gmail.com	$argon2id$v=19$m=65536,t=3,p=4$t0QIqp467x+/UHLBFpu/Cg$qWTUlCERofhGhwhjv8FvW4lGzNmNYFKWhGhECAHP+Fc	student	2026-09-15 09:24:40.731711+05:45	\N	\N
d8992317-ae0d-4e5c-a10e-1514406b8e06	ce61445f-930c-498d-b7a1-9e4d3f016378	Hari Magar	hari.magar@gmail.com	$argon2id$v=19$m=65536,t=3,p=4$O3X4vp9tjmR4oc0fCO4piA$RwpNzcne3mR+Nh5LHNJ95aHw6Rsc1aOnwshcSXhPNCs	student	2026-09-16 23:08:08.353784+05:45	\N	47ade021-71b1-4f46-8f4f-dbb1a7d4db22
313e2525-1248-45b8-8691-7e84a676e0c3	ce61445f-930c-498d-b7a1-9e4d3f016378	Arun Timilsina	arun.timilsina@gmail.com	$argon2id$v=19$m=65536,t=3,p=4$sn+PHuXD8+U+T66iDhZ1Pg$2WNun6j7D4fAu+Si+te+44+cNBYhjPKAtOfsqayl3us	professor	2026-09-15 10:01:41.705031+05:45	\N	\N
c4fb7ece-606d-48ba-8636-e91c3e1de5ad	6fb99b12-5941-4b8a-a939-31444e33c587	Ashmita Basnet	ashmita.basnet@gmail.com	$argon2id$v=19$m=65536,t=3,p=4$L1RnCZK/kOlfWTkwNBLm8g$d7f6hLYk5yyn79WBqYqyhCUg1saSc8BLRjGhEe9Z9vg	student	2026-09-14 08:03:00.552324+05:45	\N	40171749-0e87-4ef2-babf-a10c4d650efa
88883fc5-025b-431f-b8f5-5be49383eab7	6fb99b12-5941-4b8a-a939-31444e33c587	Ram Kumari Jhakri	ram.jhakri@gmail.com	$argon2id$v=19$m=65536,t=3,p=4$nFSxIKOITmKWARpY7/9BuQ$d4b4YedPzTO1q294rF0bL8ihr2ET2hHiQiK4S+kTxMY	student	2026-09-18 08:06:24.108513+05:45	\N	40171749-0e87-4ef2-babf-a10c4d650efa
c457dd0e-5477-43c1-ba55-bbb6079d6573	6fb99b12-5941-4b8a-a939-31444e33c587	Manoj Shrestha	manoj.shrestha@gmail.com	$argon2id$v=19$m=65536,t=3,p=4$XxotoSRM6v7VvEdJJfgDMg$Utl0182Ju3rpoaZVG//gNKwU9LbVztekn7F1nb3HNt0	student	2026-09-18 09:14:58.86813+05:45	\N	40171749-0e87-4ef2-babf-a10c4d650efa
58bc47d0-ad67-43c1-99db-bc676b3ad66d	6fb99b12-5941-4b8a-a939-31444e33c587	Bikal Adhikari	bikal.adhikari@gmail.com	$argon2id$v=19$m=65536,t=3,p=4$v9o635ui7C+jnibBDJX0UQ$mWIOXz+SLCgfmzZa+HlHqc3NVl08J32TDGa4tkQBp/Q	professor	2026-09-18 09:16:17.951504+05:45	\N	\N
8e5a3eb2-b32d-46f0-a5f3-6a7df4b75c48	ce61445f-930c-498d-b7a1-9e4d3f016378	Sakshyam Luitel	sakshyam.luitel@gmail.com	$argon2id$v=19$m=65536,t=3,p=4$nION1rQ/DGOXbGX/KbfSkQ$BlPYfC4Rn8lBVg47D+b1gh/1fzZSIuGmWHopoBF+C4o	student	2026-09-11 07:59:11.152397+05:45	/uploads/avatars/8e5a3eb2-b32d-46f0-a5f3-6a7df4b75c48.jpg?v=1789614451	\N
01ce4d2b-4b02-4d8f-9108-cdf5c7a1cc2e	ce61445f-930c-498d-b7a1-9e4d3f016378	Billie Jean	billie.jean@gmail.com	$argon2id$v=19$m=65536,t=3,p=4$maU54TvZhj95Ge6I4Y3Yfw$o99PmaaiBZvjMrJFxW5iKRhaRbOzzKfUchHLtF48+ho	student	2026-09-15 09:23:54.168877+05:45	\N	7506859d-0c46-4f07-9aac-e8ad54ddb8cd
\.


--
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: clusters clusters_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clusters
    ADD CONSTRAINT clusters_pkey PRIMARY KEY (id);


--
-- Name: conferencepresentations conferencepresentations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conferencepresentations
    ADD CONSTRAINT conferencepresentations_pkey PRIMARY KEY (id);


--
-- Name: conferences conferences_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conferences
    ADD CONSTRAINT conferences_pkey PRIMARY KEY (id);


--
-- Name: deadlines deadlines_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deadlines
    ADD CONSTRAINT deadlines_pkey PRIMARY KEY (id);


--
-- Name: defensepanels defensepanels_defense_professor_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.defensepanels
    ADD CONSTRAINT defensepanels_defense_professor_key UNIQUE (defense_id, professor_id);


--
-- Name: defensepanels defensepanels_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.defensepanels
    ADD CONSTRAINT defensepanels_pkey PRIMARY KEY (id);


--
-- Name: defenses defenses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.defenses
    ADD CONSTRAINT defenses_pkey PRIMARY KEY (id);


--
-- Name: degreeprograms degreeprograms_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.degreeprograms
    ADD CONSTRAINT degreeprograms_pkey PRIMARY KEY (id);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: feedback feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_pkey PRIMARY KEY (id);


--
-- Name: journalsubmissions journalsubmissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.journalsubmissions
    ADD CONSTRAINT journalsubmissions_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: paperauthors paperauthors_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.paperauthors
    ADD CONSTRAINT paperauthors_pkey PRIMARY KEY (id);


--
-- Name: papers papers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.papers
    ADD CONSTRAINT papers_pkey PRIMARY KEY (id);


--
-- Name: peerreviews peerreviews_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.peerreviews
    ADD CONSTRAINT peerreviews_pkey PRIMARY KEY (id);


--
-- Name: professorprofile professorprofile_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.professorprofile
    ADD CONSTRAINT professorprofile_pkey PRIMARY KEY (user_id);


--
-- Name: progressreports progressreports_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.progressreports
    ADD CONSTRAINT progressreports_pkey PRIMARY KEY (id);


--
-- Name: proposalcandidates proposalcandidates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.proposalcandidates
    ADD CONSTRAINT proposalcandidates_pkey PRIMARY KEY (id);


--
-- Name: proposals proposals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.proposals
    ADD CONSTRAINT proposals_pkey PRIMARY KEY (id);


--
-- Name: researchphases researchphases_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.researchphases
    ADD CONSTRAINT researchphases_pkey PRIMARY KEY (id);


--
-- Name: studentprofile studentprofile_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.studentprofile
    ADD CONSTRAINT studentprofile_pkey PRIMARY KEY (user_id);


--
-- Name: studentprofile studentprofile_roll_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.studentprofile
    ADD CONSTRAINT studentprofile_roll_number_key UNIQUE (roll_number);


--
-- Name: submissionhistory submissionhistory_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.submissionhistory
    ADD CONSTRAINT submissionhistory_pkey PRIMARY KEY (id);


--
-- Name: submissionwindows submissionwindows_department_phase_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.submissionwindows
    ADD CONSTRAINT submissionwindows_department_phase_key UNIQUE (department_id, phase);


--
-- Name: submissionwindows submissionwindows_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.submissionwindows
    ADD CONSTRAINT submissionwindows_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: notifications_user_created_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX notifications_user_created_idx ON public.notifications USING btree (user_id, created_at);


--
-- Name: researchphases_active_sequence_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX researchphases_active_sequence_key ON public.researchphases USING btree (department_id, degree_level, sequence_number) WHERE (deleted_at IS NULL);


--
-- Name: submissionhistory_entity_created_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX submissionhistory_entity_created_idx ON public.submissionhistory USING btree (entity_type, entity_id, created_at);


--
-- Name: clusters clusters_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clusters
    ADD CONSTRAINT clusters_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE CASCADE;


--
-- Name: conferencepresentations conferencepresentations_conference_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conferencepresentations
    ADD CONSTRAINT conferencepresentations_conference_id_fkey FOREIGN KEY (conference_id) REFERENCES public.conferences(id) ON DELETE CASCADE;


--
-- Name: conferencepresentations conferencepresentations_paper_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conferencepresentations
    ADD CONSTRAINT conferencepresentations_paper_id_fkey FOREIGN KEY (paper_id) REFERENCES public.papers(id) ON DELETE CASCADE;


--
-- Name: conferencepresentations conferencepresentations_presenter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conferencepresentations
    ADD CONSTRAINT conferencepresentations_presenter_id_fkey FOREIGN KEY (presenter_id) REFERENCES public.users(id);


--
-- Name: deadlines deadlines_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deadlines
    ADD CONSTRAINT deadlines_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: deadlines deadlines_paper_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deadlines
    ADD CONSTRAINT deadlines_paper_id_fkey FOREIGN KEY (paper_id) REFERENCES public.papers(id) ON DELETE CASCADE;


--
-- Name: defensepanels defensepanels_defense_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.defensepanels
    ADD CONSTRAINT defensepanels_defense_id_fkey FOREIGN KEY (defense_id) REFERENCES public.defenses(id) ON DELETE CASCADE;


--
-- Name: defensepanels defensepanels_professor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.defensepanels
    ADD CONSTRAINT defensepanels_professor_id_fkey FOREIGN KEY (professor_id) REFERENCES public.professorprofile(user_id) ON DELETE CASCADE;


--
-- Name: defenses defenses_paper_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.defenses
    ADD CONSTRAINT defenses_paper_id_fkey FOREIGN KEY (paper_id) REFERENCES public.papers(id) ON DELETE CASCADE;


--
-- Name: defenses defenses_phase_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.defenses
    ADD CONSTRAINT defenses_phase_id_fkey FOREIGN KEY (phase_id) REFERENCES public.researchphases(id) ON DELETE SET NULL;


--
-- Name: defenses defenses_progress_report_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.defenses
    ADD CONSTRAINT defenses_progress_report_id_fkey FOREIGN KEY (progress_report_id) REFERENCES public.progressreports(id) ON DELETE CASCADE;


--
-- Name: defenses defenses_proposal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.defenses
    ADD CONSTRAINT defenses_proposal_id_fkey FOREIGN KEY (proposal_id) REFERENCES public.proposals(id) ON DELETE CASCADE;


--
-- Name: defenses defenses_scheduled_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.defenses
    ADD CONSTRAINT defenses_scheduled_by_fkey FOREIGN KEY (scheduled_by) REFERENCES public.users(id);


--
-- Name: degreeprograms degreeprograms_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.degreeprograms
    ADD CONSTRAINT degreeprograms_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: feedback feedback_progress_report_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_progress_report_id_fkey FOREIGN KEY (progress_report_id) REFERENCES public.progressreports(id) ON DELETE CASCADE;


--
-- Name: feedback feedback_supervisor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_supervisor_id_fkey FOREIGN KEY (supervisor_id) REFERENCES public.users(id);


--
-- Name: journalsubmissions journalsubmissions_paper_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.journalsubmissions
    ADD CONSTRAINT journalsubmissions_paper_id_fkey FOREIGN KEY (paper_id) REFERENCES public.papers(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_defense_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_defense_id_fkey FOREIGN KEY (defense_id) REFERENCES public.defenses(id) ON DELETE SET NULL;


--
-- Name: notifications notifications_paper_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_paper_id_fkey FOREIGN KEY (paper_id) REFERENCES public.papers(id);


--
-- Name: notifications notifications_phase_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_phase_id_fkey FOREIGN KEY (phase_id) REFERENCES public.researchphases(id) ON DELETE SET NULL;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: paperauthors paperauthors_paper_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.paperauthors
    ADD CONSTRAINT paperauthors_paper_id_fkey FOREIGN KEY (paper_id) REFERENCES public.papers(id);


--
-- Name: paperauthors paperauthors_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.paperauthors
    ADD CONSTRAINT paperauthors_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: papers papers_cluster_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.papers
    ADD CONSTRAINT papers_cluster_id_fkey FOREIGN KEY (cluster_id) REFERENCES public.clusters(id);


--
-- Name: papers papers_final_report_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.papers
    ADD CONSTRAINT papers_final_report_reviewed_by_fkey FOREIGN KEY (final_report_reviewed_by) REFERENCES public.users(id);


--
-- Name: papers papers_proposal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.papers
    ADD CONSTRAINT papers_proposal_id_fkey FOREIGN KEY (proposal_id) REFERENCES public.proposals(id);


--
-- Name: papers papers_supervisor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.papers
    ADD CONSTRAINT papers_supervisor_id_fkey FOREIGN KEY (supervisor_id) REFERENCES public.users(id);


--
-- Name: peerreviews peerreviews_journal_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.peerreviews
    ADD CONSTRAINT peerreviews_journal_submission_id_fkey FOREIGN KEY (journal_submission_id) REFERENCES public.journalsubmissions(id) ON DELETE CASCADE;


--
-- Name: peerreviews peerreviews_reviewer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.peerreviews
    ADD CONSTRAINT peerreviews_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES public.users(id);


--
-- Name: professorprofile professorprofile_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.professorprofile
    ADD CONSTRAINT professorprofile_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: progressreports progressreports_paper_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.progressreports
    ADD CONSTRAINT progressreports_paper_id_fkey FOREIGN KEY (paper_id) REFERENCES public.papers(id) ON DELETE CASCADE;


--
-- Name: progressreports progressreports_phase_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.progressreports
    ADD CONSTRAINT progressreports_phase_id_fkey FOREIGN KEY (phase_id) REFERENCES public.researchphases(id) ON DELETE SET NULL;


--
-- Name: progressreports progressreports_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.progressreports
    ADD CONSTRAINT progressreports_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- Name: progressreports progressreports_submitted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.progressreports
    ADD CONSTRAINT progressreports_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.users(id);


--
-- Name: proposalcandidates proposalcandidates_proposal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.proposalcandidates
    ADD CONSTRAINT proposalcandidates_proposal_id_fkey FOREIGN KEY (proposal_id) REFERENCES public.proposals(id) ON DELETE CASCADE;


--
-- Name: proposalcandidates proposalcandidates_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.proposalcandidates
    ADD CONSTRAINT proposalcandidates_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: proposals proposals_cluster_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.proposals
    ADD CONSTRAINT proposals_cluster_id_fkey FOREIGN KEY (cluster_id) REFERENCES public.clusters(id) ON DELETE CASCADE;


--
-- Name: proposals proposals_deleted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.proposals
    ADD CONSTRAINT proposals_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.users(id);


--
-- Name: proposals proposals_phase_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.proposals
    ADD CONSTRAINT proposals_phase_id_fkey FOREIGN KEY (phase_id) REFERENCES public.researchphases(id) ON DELETE SET NULL;


--
-- Name: proposals proposals_responded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.proposals
    ADD CONSTRAINT proposals_responded_by_fkey FOREIGN KEY (responded_by) REFERENCES public.users(id);


--
-- Name: proposals proposals_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.proposals
    ADD CONSTRAINT proposals_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: proposals proposals_submitted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.proposals
    ADD CONSTRAINT proposals_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.users(id);


--
-- Name: proposals proposals_supervisor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.proposals
    ADD CONSTRAINT proposals_supervisor_id_fkey FOREIGN KEY (supervisor_id) REFERENCES public.users(id);


--
-- Name: researchphases researchphases_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.researchphases
    ADD CONSTRAINT researchphases_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: researchphases researchphases_deleted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.researchphases
    ADD CONSTRAINT researchphases_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.users(id);


--
-- Name: researchphases researchphases_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.researchphases
    ADD CONSTRAINT researchphases_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE CASCADE;


--
-- Name: studentprofile studentprofile_degree_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.studentprofile
    ADD CONSTRAINT studentprofile_degree_program_id_fkey FOREIGN KEY (degree_program_id) REFERENCES public.degreeprograms(id) ON DELETE CASCADE;


--
-- Name: studentprofile studentprofile_supervisor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.studentprofile
    ADD CONSTRAINT studentprofile_supervisor_id_fkey FOREIGN KEY (supervisor_id) REFERENCES public.users(id);


--
-- Name: studentprofile studentprofile_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.studentprofile
    ADD CONSTRAINT studentprofile_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: submissionhistory submissionhistory_phase_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.submissionhistory
    ADD CONSTRAINT submissionhistory_phase_id_fkey FOREIGN KEY (phase_id) REFERENCES public.researchphases(id) ON DELETE RESTRICT;


--
-- Name: submissionhistory submissionhistory_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.submissionhistory
    ADD CONSTRAINT submissionhistory_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- Name: submissionhistory submissionhistory_submitted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.submissionhistory
    ADD CONSTRAINT submissionhistory_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.users(id);


--
-- Name: submissionwindows submissionwindows_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.submissionwindows
    ADD CONSTRAINT submissionwindows_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE CASCADE;


--
-- Name: submissionwindows submissionwindows_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.submissionwindows
    ADD CONSTRAINT submissionwindows_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: users users_degree_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_degree_program_id_fkey FOREIGN KEY (degree_program_id) REFERENCES public.degreeprograms(id);


--
-- Name: users users_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict 8HQrQd1JabZWe0qF2zF4CtJlIbsbnL3EHyXD90AQIr8Cfa2U4Uwd3lOId3b1DoW

